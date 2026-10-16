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
  return normalize([
    element.getAttribute("name"),
    element.getAttribute("autocomplete"),
    element.getAttribute("aria-label"),
    element.getAttribute("placeholder"),
    element.getAttribute("title"),
    labelsFor(element),
    element.type,
    element.tagName === "SELECT" ? Array.from(element.options).slice(0, 8).map((option) => option.textContent).join(" ") : ""
  ].join(" "));
}

function hasAny(text, words) {
  return words.some((word) => text.includes(word));
}

function isCustomSelect(element) {
  return element instanceof Element && element.matches(CUSTOM_FIELD_SELECTOR);
}

function inferType(element) {
  const text = fieldText(element);
  const autocomplete = normalize(element.getAttribute("autocomplete"));
  if (element.tagName === "SELECT") {
    const options = Array.from(element.options).map((option) => normalize(option.value || option.textContent));
    const stateCodes = new Set(["ac", "al", "am", "ap", "ba", "ce", "df", "es", "go", "ma", "mg", "ms", "mt", "pa", "pb", "pe", "pi", "pr", "rj", "rn", "ro", "rr", "rs", "sc", "se", "sp", "to"]);
    if (options.filter((option) => stateCodes.has(option)).length >= 2) return "state";
    if (hasAny(options.join(" "), ["masculino", "feminino", "male", "female"])) return "gender";
  }
  if (element.type === "email" || hasAny(text, ["e mail", "email", "correo"])) return "email";
  if (hasAny(text, ["cnpj", "company registration"])) return "cnpj";
  if (hasAny(text, ["cpf", "taxpayer"])) return "cpf";
  if (hasAny(text, ["cep", "postal code", "postcode", "zip"])) return "cep";
  if (hasAny(text, ["rg", "identity document", "identidade"])) return "rg";
  if (hasAny(text, ["phone", "telefone", "celular", "mobile", "whatsapp", "tel"])) return "phone";
  if (hasAny(text, ["mother", "mae", "mãe"])) return "mother";
  if (hasAny(text, ["father", "pai"])) return "father";
  if (hasAny(text, ["birth", "nascimento", "nasc"])) return "birthDate";
  if (hasAny(text, ["gender", "genero", "gênero", "sexo"])) return "gender";
  if (hasAny(text, ["profession", "profissao", "profissão", "cargo", "occupation", "job"])) return "profession";
  if (hasAny(text, ["income", "renda", "salary", "salario", "salário"])) return "income";
  if (hasAny(text, ["neighborhood", "bairro", "district"])) return "neighborhood";
  if (hasAny(text, ["city", "cidade", "municipality", "municipio", "município"]) || autocomplete === "address-level2") return "city";
  if (hasAny(text, ["state", "estado", "province", "uf"]) || autocomplete === "address-level1") return "state";
  if (hasAny(text, ["street", "address", "endereco", "endereço", "logradouro", "avenida", "rua"]) || autocomplete === "street-address") return "address";
  if (hasAny(text, ["number", "numero", "número", "house"])) return "number";
  if (hasAny(text, ["plate", "placa", "license"])) return "plate";
  if (hasAny(text, ["chassi", "vin", "vehicle identification number"])) return "chassi";
  if (hasAny(text, ["brand", "marca", "montadora"])) return "brand";
  if (hasAny(text, ["model", "modelo"])) return "model";
  if (hasAny(text, ["year", "ano", "fabricação", "fabricacao"])) return "year";
  if (hasAny(text, ["website", "site", "url", "homepage"])) return "website";
  if (hasAny(text, ["company", "empresa", "organization", "razao", "razão"]) || autocomplete === "organization") return "company";
  if (autocomplete === "given-name" || autocomplete === "family-name" || autocomplete === "name" ||
    hasAny(text, ["name", "nome", "full name", "fullname"])) return "name";
  if (element.type === "number") return "number";
  if (element.type === "date" || element.type === "month") return "birthDate";
  return "text";
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
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    schedulePageChangeNotification();
    return result;
  };
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    schedulePageChangeNotification();
    return result;
  };
  window.addEventListener("popstate", schedulePageChangeNotification);
  window.addEventListener("hashchange", schedulePageChangeNotification);
  if (document.body) {
    new MutationObserver((records) => {
      const relevant = records.some((record) => {
        if (record.target instanceof Element && record.target.closest("[data-fakedata-control]")) return false;
        return Array.from(record.addedNodes).some((node) =>
          node instanceof Element && !node.closest("[data-fakedata-control]") &&
          !node.querySelector("[data-fakedata-control]")
        );
      });
      if (relevant) schedulePageChangeNotification(true);
    }).observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  lastPageSignature = pageSignature();
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
