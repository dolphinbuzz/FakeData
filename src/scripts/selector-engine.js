import { ACTIONS } from "./messages.js";

const FIELD_SELECTOR = "input, select, textarea";
const CUSTOM_FIELD_SELECTOR = "multi-select, [role='combobox'], .ui-autocomplete-multiselect";
const SELECT2_OPTION_SELECTOR = "li.select2-results__option, li[list-select], [role='option'], .ui-menu-item";
const IGNORED_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "file"]);
let lastPageSignature = "";
let pageChangeTimer = null;
let pendingDomChange = false;
let runtimeContextInvalidated = false;

const normalize = (value) => String(value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[_-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

function normalizeInferenceText(value) {
  return String(value || "")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([a-z])(\d)|(\d)([a-z])/gi, "$1$3 $2$4")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const escapeAttribute = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const escapeCssIdentifier = (value) => window.CSS && typeof window.CSS.escape === "function"
  ? window.CSS.escape(String(value))
  : String(value).replace(/([^\w-])/g, "\\$1");

function visible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}

function labelsFor(element) {
  const labels = [];
  if (element.labels) labels.push(...Array.from(element.labels).map((label) => label.textContent));
  const parentLabel = element.closest("label");
  if (parentLabel) labels.push(parentLabel.textContent);
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    labelledBy.split(/\s+/).forEach((id) => {
      const node = document.getElementById(id);
      if (node) labels.push(node.textContent);
    });
  }
  const previous = element.previousElementSibling;
  if (previous && /^(LABEL|SPAN|P|DIV|LEGEND)$/i.test(previous.tagName)) labels.push(previous.textContent);
  return labels.filter(Boolean).join(" ");
}

function fieldText(element) {
  return normalizeInferenceText([
    element.getAttribute("name"),
    element.getAttribute("autocomplete"),
    element.getAttribute("aria-label"),
    element.getAttribute("placeholder"),
    element.getAttribute("title"),
    labelsFor(element),
    element.tagName === "SELECT" ? Array.from(element.options).slice(0, 8).map((option) => option.textContent).join(" ") : ""
  ].join(" "));
}

function hasAny(text, words) {
  const normalizedText = ` ${text} `;
  return words.some((word) => normalizedText.includes(` ${word} `));
}

function inferenceRule(type, keywords = [], inputTypes = []) {
  return {
    type,
    keywords: keywords.map(normalizeInferenceText),
    inputTypes
  };
}

const INFERENCE_RULES = [
  inferenceRule("email", ["e mail", "email", "correo"], ["email"]),
  inferenceRule("cnpj", ["cnpj", "company registration"]),
  inferenceRule("cpf", ["cpf", "taxpayer"]),
  inferenceRule("cep", ["cep", "postal code", "codigo postal", "postcode", "zip code", "zip"]),
  inferenceRule("rg", ["rg", "identity document", "identidade"]),
  inferenceRule("phone", ["phone", "telephone", "telefone", "celular", "mobile", "whatsapp", "tel"], ["tel"]),
  inferenceRule("mother", ["mother", "mae", "mãe"]),
  inferenceRule("father", ["father", "pai"]),
  inferenceRule("birthDate", ["birth", "nascimento", "nasc"]),
  inferenceRule("openingDate", ["opening date", "data de abertura", "data abertura", "company opening"]),
  inferenceRule("stateRegistration", ["state registration", "inscricao estadual", "inscricaoestadual", "ie"]),
  inferenceRule("color", ["vehicle color", "cor do veiculo", "color", "cor"], ["color"]),
  inferenceRule("segment", ["segment", "segmento", "industry", "sector", "ramo de atividade"]),
  inferenceRule("gender", ["gender", "genero", "gênero", "sexo"]),
  inferenceRule("profession", ["profession", "profissao", "profissão", "cargo", "occupation", "job"]),
  inferenceRule("income", ["income", "renda", "salary", "salario", "salário"]),
  inferenceRule("neighborhood", ["neighborhood", "bairro", "district"]),
  inferenceRule("city", ["city", "cidade", "municipality", "municipio", "município"]),
  inferenceRule("state", ["state", "estado", "province", "uf"]),
  inferenceRule("address", ["street", "address", "endereco", "endereço", "logradouro", "avenida", "rua"]),
  inferenceRule("number", ["number", "numero", "número", "house"], ["number"]),
  inferenceRule("plate", ["plate", "placa", "license plate"]),
  inferenceRule("chassi", ["chassi", "vin", "vehicle identification number"]),
  inferenceRule("brand", ["brand", "marca", "montadora"]),
  inferenceRule("model", ["model", "modelo"]),
  inferenceRule("year", ["year", "ano", "fabricação", "fabricacao"]),
  inferenceRule("website", ["website", "site", "url", "homepage"], ["url"]),
  inferenceRule("company", ["company", "empresa", "organization", "razao", "razao social"]),
  inferenceRule("name", ["name", "nome", "full name", "fullname"])
];

const STATE_CODES = new Set(["ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg", "ms", "mt", "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to"]);
const SELECT_GENDER_WORDS = ["masculino", "feminino", "male", "female"].map(normalizeInferenceText);
const SELECT_INFERENCE_RULES = [
  {
    type: "state",
    matches: (options) => options.filter((option) => STATE_CODES.has(option)).length >= 2
  },
  {
    type: "gender",
    matches: (options) => hasAny(options.join(" "), SELECT_GENDER_WORDS)
  }
];
const INPUT_TYPE_FALLBACKS = [
  { type: "checkbox", inputTypes: ["checkbox"] },
  { type: "radio", inputTypes: ["radio"] },
  { type: "birthDate", inputTypes: ["date", "month"] }
];

function isCustomSelect(element) {
  return element instanceof Element && element.matches(CUSTOM_FIELD_SELECTOR);
}

function inferSelectType(element) {
  if (element.tagName !== "SELECT") return "";
  const options = Array.from(element.options).map((option) =>
    normalizeInferenceText(option.value || option.textContent)
  );
  const rule = SELECT_INFERENCE_RULES.find(({ matches }) => matches(options));
  return rule ? rule.type : "";
}

function inferType(element) {
  const selectType = inferSelectType(element);
  if (selectType) return selectType;

  const text = fieldText(element);
  const rule = INFERENCE_RULES.find(({ inputTypes, keywords }) =>
    inputTypes.includes(element.type) || hasAny(text, keywords)
  );
  if (rule) return rule.type;

  const fallback = INPUT_TYPE_FALLBACKS.find(({ inputTypes }) => inputTypes.includes(element.type));
  return fallback ? fallback.type : "text";
}

const ANGULAR_ATTR_PATTERN = /^(ng-reflect-|_ng(content|host)-|ng-version$)/i;
const ANGULAR_CLASS_PATTERN = /^(ng-(valid|invalid|dirty|pristine|touched|untouched|submitted|pending)|cdk-|mat-)/i;
const ANGULAR_ID_PATTERN = /^(mat-input|mat-select|mat-option|mat-autocomplete|cdk-describedby|cdk-overlay)(-\w+)*-\d+$/i;

function isDynamicId(value) {
  return !value || /(^|[-_])[a-f0-9]{6,}($|[-_])|(^|[-_])\d{3,}($|[-_])|^(r|component|ember|headlessui)[-_]/i.test(value) || ANGULAR_ID_PATTERN.test(value);
}

function isAngularAttribute(value) {
  return ANGULAR_ATTR_PATTERN.test(value) || ANGULAR_ID_PATTERN.test(value);
}

function isAngularClass(className) {
  return ANGULAR_CLASS_PATTERN.test(className);
}

function hasAngularAttributes(element) {
  const attrs = Array.from(element.attributes);
  return attrs.some((attr) => isAngularAttribute(attr.name) || isAngularAttribute(attr.value));
}

function uniqueCandidate(element, selector) {
  try {
    return document.querySelectorAll(selector).length === 1 && document.querySelector(selector) === element;
  } catch (error) {
    return false;
  }
}

function staticText(element) {
  const text = (element.textContent || "").replace(/\s+/g, " ").trim();
  if (!text || text.length > 80 || /\{\{|\$\{|<%|%>/.test(text)) return "";
  return text;
}

function selectorFor(element) {
  const tag = element.tagName.toLowerCase();
  const attributeValue = element.getAttribute("value");
  const supportsValueSelector = ["INPUT", "SELECT", "TEXTAREA"].includes(element.tagName);

  // Atributos de teste explícitos (data-cy, data-test, data-testid) - máxima prioridade
  // São adicionados intencionalmente por desenvolvedores para serem únicos e estáveis.
  // Verificados ANTES da detecção Angular para permitir data-cy estável mesmo em elementos Angular.
  const testAttributes = [
    ["data-cy", element.getAttribute("data-cy"), (value) => `[data-cy="${escapeAttribute(value)}"]`, 1],
    ["data-test", element.getAttribute("data-test"), (value) => `[data-test="${escapeAttribute(value)}"]`, 1],
    ["data-testid", element.getAttribute("data-testid"), (value) => `[data-testid="${escapeAttribute(value)}"]`, 1]
  ];
  for (const [rule, value, create, priority] of testAttributes) {
    if (value) {
      const selector = create(value);
      if (uniqueCandidate(element, selector)) return { selector, rule, priority, status: "stable" };
    }
  }

  // Rejeitar elementos com atributos Angular instáveis para evitar seletores quebrados
  // Apenas se não houver um atributo de teste estável já retornado acima
  if (hasAngularAttributes(element)) {
    return {
      selector: fallbackSelector(element),
      rule: "fallback: atributos Angular detectados",
      priority: 4,
      status: "fragile",
      suggestion: "Adicionar data-cy/data-testid estável. Atributos Angular (ng-reflect-*, _ngcontent-*) mudam dinamicamente."
    };
  }

  // Combinações de alta prioridade (mais específicas = mais estáveis)
  const combinations = [
    ["name + type + value", supportsValueSelector && element.getAttribute("name") && element.getAttribute("type") && attributeValue, () => `${tag}[name="${escapeAttribute(element.getAttribute("name"))}"][type="${escapeAttribute(element.getAttribute("type"))}"][value="${escapeAttribute(attributeValue)}"]`, 1],
    ["type + value", supportsValueSelector && element.getAttribute("type") && attributeValue, () => `${tag}[type="${escapeAttribute(element.getAttribute("type"))}"][value="${escapeAttribute(attributeValue)}"]`, 1],
    ["name + value", supportsValueSelector && element.getAttribute("name") && attributeValue, () => `${tag}[name="${escapeAttribute(element.getAttribute("name"))}"][value="${escapeAttribute(attributeValue)}"]`, 1],
    ["autocomplete + name", element.getAttribute("autocomplete") && element.getAttribute("name"), () => `${tag}[autocomplete="${escapeAttribute(element.getAttribute("autocomplete"))}"][name="${escapeAttribute(element.getAttribute("name"))}"]`, 1],
    ["placeholder + name", element.getAttribute("placeholder") && element.getAttribute("name"), () => `${tag}[placeholder="${escapeAttribute(element.getAttribute("placeholder"))}"][name="${escapeAttribute(element.getAttribute("name"))}"]`, 1],
    ["name + type", element.getAttribute("name") && element.getAttribute("type"), () => `${tag}[name="${escapeAttribute(element.getAttribute("name"))}"][type="${escapeAttribute(element.getAttribute("type"))}"]`, 2],
    ["role + aria-label", element.getAttribute("role") && element.getAttribute("aria-label"), () => `${tag}[role="${escapeAttribute(element.getAttribute("role"))}"][aria-label="${escapeAttribute(element.getAttribute("aria-label"))}"]`, 2],
    ["aria-labelledby + role", element.getAttribute("aria-labelledby") && element.getAttribute("role"), () => `${tag}[aria-labelledby="${escapeAttribute(element.getAttribute("aria-labelledby"))}"][role="${escapeAttribute(element.getAttribute("role"))}"]`, 2]
  ];
  for (const [rule, value, create, priority] of combinations) {
    if (value && uniqueCandidate(element, create())) return { selector: create(), rule, priority, status: "stable" };
  }

  const candidates = [
    ["id", element.id, (value) => `#${escapeCssIdentifier(value)}`, 1, (v) => !isDynamicId(v)],
    ["role", element.getAttribute("role"), (value) => `${tag}[role="${escapeAttribute(value)}"]`, 2],
    ["aria-label", element.getAttribute("aria-label"), (value) => `${tag}[aria-label="${escapeAttribute(value)}"]`, 2],
    ["aria-labelledby", element.getAttribute("aria-labelledby"), (value) => `${tag}[aria-labelledby="${escapeAttribute(value)}"]`, 2],
    ["value", supportsValueSelector && attributeValue, (value) => `${tag}[value="${escapeAttribute(value)}"]`, 3],
    ["value parcial", supportsValueSelector && attributeValue, (value) => `${tag}[value*="${escapeAttribute(value)}"]`, 3],
    ["name", element.getAttribute("name"), (value) => `${tag}[name="${escapeAttribute(value)}"]`, 3, (v) => !isDynamicId(v)],
    ["type", element.getAttribute("type"), (value) => `${tag}[type="${escapeAttribute(value)}"]`, 3],
    ["autocomplete", element.getAttribute("autocomplete"), (value) => `${tag}[autocomplete="${escapeAttribute(value)}"]`, 3],
    ["placeholder", element.getAttribute("placeholder"), (value) => `${tag}[placeholder="${escapeAttribute(value)}"]`, 4]
  ];
  for (const [rule, value, create, priority, validate] of candidates) {
    if (!value) continue;
    if (validate && !validate(value)) continue;
    const selector = create(value);
    if (uniqueCandidate(element, selector)) return { selector, rule, priority, status: "stable" };
  }

  const text = staticText(element);
  if (text && !candidates.some(([, value]) => value)) {
    return {
      selector: fallbackSelector(element),
      rule: "texto visível estático",
      priority: 4,
      status: "fragile",
      suggestion: `Adicionar data-cy estável para o elemento "${text.slice(0, 50)}".`
    };
  }
  return {
    selector: fallbackSelector(element),
    rule: "fallback proibido",
    priority: 5,
    status: "fragile",
    suggestion: `Adicionar data-cy estável para ${tag}${element.getAttribute("name") ? ` ${element.getAttribute("name")}` : ""}.`
  };
}

function fallbackSelector(element) {
  const parts = [];
  let node = element;
  while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body) {
    const siblings = node.parentElement
      ? Array.from(node.parentElement.children).filter((child) => child.tagName === node.tagName)
      : [];
    const index = siblings.indexOf(node);
    parts.unshift(`${node.tagName.toLowerCase()}${siblings.length > 1 ? `:nth-of-type(${index + 1})` : ""}`);
    const selector = parts.join(" > ");
    if (uniqueCandidate(element, selector)) return selector;
    node = node.parentElement;
  }
  return parts.join(" > ");
}

function fieldFromTarget(target) {
  if (!(target instanceof Element)) return null;
  if (target.matches(FIELD_SELECTOR)) return target;
  if (target.matches("li[list-select], [role='option'], .ui-menu-item")) {
    const group = target.closest("form, fieldset, .form-group, .field, .form-field, [role='group']") || target.parentElement;
    const customSelect = group && group.querySelector(CUSTOM_FIELD_SELECTOR);
    if (customSelect) return customSelect;
  }
  const label = target.closest("label");
  if (label) {
    if (label.control) return label.control;
    const nested = label.querySelector(FIELD_SELECTOR);
    if (nested) return nested;
    const forId = label.getAttribute("for");
    if (forId) return document.getElementById(forId);
  }
  const container = target.closest("form, fieldset, .form-group, .field, .form-field, [role='group']");
  return container ? container.querySelector(FIELD_SELECTOR) : null;
}

function captureNextClick(sendResponse) {
  const onClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    document.removeEventListener("click", onClick, true);
    const element = fieldFromTarget(event.target) ||
      (event.target instanceof Element && event.target.closest("button, a[href], [role='button'], [role='link']"));
    if (!element) {
      sendResponse({ captured: false });
      return;
    }
    sendResponse({
      captured: true,
      field: {
        ...describe(element, 0),
        label: labelsFor(element).replace(/\s+/g, " ").trim() || element.getAttribute("name") || element.getAttribute("placeholder") || element.tagName.toLowerCase(),
        inferredType: inferType(element),
        tagName: element.tagName.toLowerCase(),
        inputType: element.type || ""
      }
    });
  };
  document.addEventListener("click", onClick, true);
  setTimeout(() => document.removeEventListener("click", onClick, true), 30000);
}

function describe(element, index) {
  const locator = selectorFor(element);
  const label = labelsFor(element).replace(/\s+/g, " ").trim() ||
    element.getAttribute("name") || element.getAttribute("placeholder") || `${element.tagName.toLowerCase()} ${index + 1}`;
  return {
    key: `${locator.selector || locator.rule}::${index}`,
    selector: locator.selector,
    label: label.slice(0, 120),
    inferredType: inferType(element),
    tagName: element.tagName.toLowerCase(),
    inputType: element.type || "",
    value: element.value || "",
    required: Boolean(element.required),
    disabled: Boolean(element.disabled),
    selectorRule: locator.rule,
    selectorStatus: locator.status,
    selectorSuggestion: locator.suggestion || "",
    locatorName: locatorName(element, label)
  };
}

function locatorName(element, label) {
  const route = (window.location.pathname.split("/").filter(Boolean).pop() || "pagina")
    .replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const context = (label || element.getAttribute("name") || element.tagName).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `${route}-${context}-${(element.getAttribute("type") || element.tagName).toLowerCase()}`.replace(/-+/g, "-");
}

function scan() {
  const nativeFields = Array.from(document.querySelectorAll(FIELD_SELECTOR));
  const customFields = Array.from(document.querySelectorAll(CUSTOM_FIELD_SELECTOR))
    .filter((element) => !element.closest("multi-select") || element.tagName.toLowerCase() === "multi-select");
  const elements = nativeFields.concat(customFields)
    .filter((element, index, fields) => {
      return !IGNORED_TYPES.has(String(element.type || "").toLowerCase()) &&
        visible(element) && !element.disabled && fields.indexOf(element) === index;
    })
    .map(describe);
  const selectors = new Map();
  elements.forEach((item) => {
    if (!item.selector) return;
    selectors.set(item.selector, (selectors.get(item.selector) || 0) + 1);
  });
  return elements.map((item) => item.selector && selectors.get(item.selector) > 1
    ? {
      ...item,
      selectorRule: "colisão após fallback",
      selectorStatus: "fragile",
      selectorSuggestion: "Adicionar data-cy único ao elemento para eliminar a colisão."
    }
    : item);
}

function currentPageUrl() {
  try {
    return window.location.href;
  } catch (error) {
    return null;
  }
}

function pageSignature() {
  const url = currentPageUrl();
  if (url === null) return "";
  return url + "::" + Array.from(document.querySelectorAll(`${FIELD_SELECTOR}, ${CUSTOM_FIELD_SELECTOR}`))
    .filter(visible)
    .map((element) => {
      const locator = selectorFor(element);
      return `${locator.selector}|${locator.rule}|${locator.status}`;
    })
    .join("|");
}

function notifyPageChanged() {
  const url = currentPageUrl();
  if (url === null) return;
  const signature = pageSignature();
  if (!pendingDomChange && signature === lastPageSignature) return;
  const previousUrl = lastPageSignature.split("::")[0];
  const urlChanged = previousUrl !== url;
  lastPageSignature = signature;
  pendingDomChange = false;
  if (runtimeContextInvalidated || typeof chrome === "undefined" || !chrome.runtime ||
    typeof chrome.runtime.sendMessage !== "function") return;
  try {
    chrome.runtime.sendMessage({
      action: ACTIONS.PAGE_CONTENT_CHANGED,
      url,
      changeType: urlChanged ? "route" : "dom"
    });
  } catch (error) {
    if (!/Extension context invalidated/i.test(String(error && error.message))) throw error;
    runtimeContextInvalidated = true;
  }
}

function schedulePageChangeNotification(domChanged = false) {
  pendingDomChange = pendingDomChange || domChanged;
  clearTimeout(pageChangeTimer);
  pageChangeTimer = setTimeout(notifyPageChanged, 250);
}

function installNavigationObserver() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  const onPushState = function (...args) {
    const result = originalPushState.apply(this, args);
    schedulePageChangeNotification();
    return result;
  };
  const onReplaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    schedulePageChangeNotification();
    return result;
  };
  history.pushState = onPushState;
  history.replaceState = onReplaceState;
  const onPopState = () => schedulePageChangeNotification();
  const onHashChange = () => schedulePageChangeNotification();
  window.addEventListener("popstate", onPopState);
  window.addEventListener("hashchange", onHashChange);
  let observer = null;
  if (document.body) {
    observer = new MutationObserver((records) => {
      const relevant = records.some((record) => {
        if (record.target instanceof Element && record.target.closest("[data-fakedata-control]")) return false;
        return Array.from(record.addedNodes).some((node) =>
          node instanceof Element && !node.closest("[data-fakedata-control]") &&
          !node.querySelector("[data-fakedata-control]")
        );
      });
      if (relevant) schedulePageChangeNotification(true);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  lastPageSignature = pageSignature();
  return () => {
    observer?.disconnect();
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("hashchange", onHashChange);
    if (history.pushState === onPushState) history.pushState = originalPushState;
    if (history.replaceState === onReplaceState) history.replaceState = originalReplaceState;
    clearTimeout(pageChangeTimer);
  };
}


export {
  captureNextClick,
  installNavigationObserver,
  inferType,
  isCustomSelect,
  normalize,
  pageSignature,
  notifyPageChanged,
  scan,
  SELECT2_OPTION_SELECTOR,
  selectorFor,
  visible,
  isDynamicId,
  isAngularAttribute,
  isAngularClass,
  hasAngularAttributes,
  fieldFromTarget,
  labelsFor,
  fallbackSelector,
  staticText,
  uniqueCandidate,
  escapeAttribute,
  escapeCssIdentifier,
  hasAny
};
