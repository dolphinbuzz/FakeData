(() => {
  "use strict";

  const FIELD_SELECTOR = "input, select, textarea";
  const CUSTOM_FIELD_SELECTOR = "multi-select, [role='combobox'], .ui-autocomplete-multiselect";
  const SELECT2_OPTION_SELECTOR = "li.select2-results__option, li[list-select], [role='option'], .ui-menu-item";
  const IGNORED_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "file"]);
  const markedFields = new Map();
  let lastPageSignature = "";
  let pageChangeTimer = null;

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
    if (hasAny(text, ["website", "site", "url", "homepage"])) return "website";
    if (hasAny(text, ["company", "empresa", "organization", "razao", "razão"]) || autocomplete === "organization") return "company";
    if (autocomplete === "given-name" || autocomplete === "family-name" || autocomplete === "name" ||
      hasAny(text, ["name", "nome", "full name", "fullname"])) return "name";
    if (element.type === "number") return "number";
    if (element.type === "date" || element.type === "month") return "birthDate";
    return "text";
  }

  function isDynamicId(value) {
    return !value || /(^|[-_])[a-f0-9]{6,}($|[-_])|(^|[-_])\d{3,}($|[-_])|^(r|component|ember|headlessui)[-_]/i.test(value);
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
    const candidates = [
      ["id", element.id, (value) => `#${escapeCssIdentifier(value)}`, 1],
      ["data-cy", element.getAttribute("data-cy"), (value) => `[data-cy="${escapeAttribute(value)}"]`, 1],
      ["data-test", element.getAttribute("data-test"), (value) => `[data-test="${escapeAttribute(value)}"]`, 1],
      ["data-testid", element.getAttribute("data-testid"), (value) => `[data-testid="${escapeAttribute(value)}"]`, 1],
      ["role", element.getAttribute("role"), (value) => `${tag}[role="${escapeAttribute(value)}"]`, 2],
      ["aria-label", element.getAttribute("aria-label"), (value) => `${tag}[aria-label="${escapeAttribute(value)}"]`, 2],
      ["aria-labelledby", element.getAttribute("aria-labelledby"), (value) => `${tag}[aria-labelledby="${escapeAttribute(value)}"]`, 2],
      ["value", supportsValueSelector && attributeValue, (value) => `${tag}[value="${escapeAttribute(value)}"]`, 3],
      ["value parcial", supportsValueSelector && attributeValue, (value) => `${tag}[value*="${escapeAttribute(value)}"]`, 3],
      ["ng-model", element.getAttribute("ng-model"), (value) => `${tag}[ng-model="${escapeAttribute(value)}"]`, 3],
      ["name", element.getAttribute("name"), (value) => `${tag}[name="${escapeAttribute(value)}"]`, 3],
      ["type", element.getAttribute("type"), (value) => `${tag}[type="${escapeAttribute(value)}"]`, 3]
    ];
    for (const [rule, value, create, priority] of candidates) {
      if (!value) continue;
      const selector = create(value);
      if (uniqueCandidate(element, selector)) return { selector, rule, priority, status: "stable" };
    }
    const combinations = [
      ["ng-model + name + type + value", element.getAttribute("ng-model") && element.getAttribute("name") && element.getAttribute("type") && attributeValue, () => `${tag}[ng-model="${escapeAttribute(element.getAttribute("ng-model"))}"][name="${escapeAttribute(element.getAttribute("name"))}"][type="${escapeAttribute(element.getAttribute("type"))}"][value="${escapeAttribute(attributeValue)}"]`],
      ["ng-model + name + type", element.getAttribute("ng-model") && element.getAttribute("name") && element.getAttribute("type"), () => `${tag}[ng-model="${escapeAttribute(element.getAttribute("ng-model"))}"][name="${escapeAttribute(element.getAttribute("name"))}"][type="${escapeAttribute(element.getAttribute("type"))}"]`],
      ["ng-model + value", element.getAttribute("ng-model") && attributeValue, () => `${tag}[ng-model="${escapeAttribute(element.getAttribute("ng-model"))}"][value="${escapeAttribute(attributeValue)}"]`],
      ["ng-model + name", element.getAttribute("ng-model") && element.getAttribute("name"), () => `${tag}[ng-model="${escapeAttribute(element.getAttribute("ng-model"))}"][name="${escapeAttribute(element.getAttribute("name"))}"]`],
      ["ng-model + type", element.getAttribute("ng-model") && element.getAttribute("type"), () => `${tag}[ng-model="${escapeAttribute(element.getAttribute("ng-model"))}"][type="${escapeAttribute(element.getAttribute("type"))}"]`],
      ["name + type + value", supportsValueSelector && element.getAttribute("name") && element.getAttribute("type") && attributeValue, () => `${tag}[name="${escapeAttribute(element.getAttribute("name"))}"][type="${escapeAttribute(element.getAttribute("type"))}"][value="${escapeAttribute(attributeValue)}"]`],
      ["type + value", supportsValueSelector && element.getAttribute("type") && attributeValue, () => `${tag}[type="${escapeAttribute(element.getAttribute("type"))}"][value="${escapeAttribute(attributeValue)}"]`],
      ["name + value", supportsValueSelector && element.getAttribute("name") && attributeValue, () => `${tag}[name="${escapeAttribute(element.getAttribute("name"))}"][value="${escapeAttribute(attributeValue)}"]`],
      ["name + type", element.getAttribute("name") && element.getAttribute("type"), () => `${tag}[name="${escapeAttribute(element.getAttribute("name"))}"][type="${escapeAttribute(element.getAttribute("type"))}"]`],
      ["role + aria-label", element.getAttribute("role") && element.getAttribute("aria-label"), () => `${tag}[role="${escapeAttribute(element.getAttribute("role"))}"][aria-label="${escapeAttribute(element.getAttribute("aria-label"))}"]`],
      ["aria-labelledby + role", element.getAttribute("aria-labelledby") && element.getAttribute("role"), () => `${tag}[aria-labelledby="${escapeAttribute(element.getAttribute("aria-labelledby"))}"][role="${escapeAttribute(element.getAttribute("role"))}"]`]
    ];
    for (const [rule, value, create] of combinations) {
      if (value && uniqueCandidate(element, create())) return { selector: create(), rule, priority: 3, status: "stable" };
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

  function pageSignature() {
    return window.location.href + "::" + Array.from(document.querySelectorAll(`${FIELD_SELECTOR}, ${CUSTOM_FIELD_SELECTOR}`))
      .filter(visible)
      .map((element) => selectorFor(element))
      .join("|");
  }

  function notifyPageChanged() {
    const signature = pageSignature();
    if (signature === lastPageSignature) return;
    lastPageSignature = signature;
    chrome.runtime.sendMessage({
      action: "PAGE_CONTENT_CHANGED",
      url: window.location.href
    });
  }

  function schedulePageChangeNotification() {
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
      new MutationObserver(schedulePageChangeNotification).observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    lastPageSignature = pageSignature();
  }

  function find(selector) {
    if (typeof selector !== "string" || !selector.trim()) return null;
    try {
      const element = document.querySelector(selector);
      return element instanceof Element ? element : null;
    } catch (error) {
      return null;
    }
  }

  function select2NativeField(element) {
    if (!element) return null;
    if (element.matches("select.select2-hidden-accessible")) return element;

    const combobox = element.matches("[role='combobox']")
      ? element
      : element.querySelector("[role='combobox']");
    if (!combobox) return null;

    const labelledBy = combobox.getAttribute("aria-labelledby") || "";
    const renderedId = labelledBy.split(/\s+/).find((id) => id.startsWith("select2-") && id.endsWith("-container"));
    if (renderedId) {
      const id = renderedId.slice("select2-".length, -"-container".length);
      const field = document.getElementById(id);
      if (field && field.matches("select")) return field;
    }

    const container = element.closest(".select2-container") || combobox.closest(".select2-container");
    if (container) {
      const previous = container.previousElementSibling;
      if (previous && previous.matches("select")) return previous;
    }
    return null;
  }

  function visualTarget(element) {
    if (!element) return null;
    if (element.matches("select.select2-hidden-accessible")) {
      const container = document.getElementById(`select2-${element.id}-container`);
      const selection = container && container.closest(".select2-selection");
      if (selection && visible(selection)) return selection;
      const select2Container = element.nextElementSibling;
      if (select2Container && select2Container.matches(".select2-container") && visible(select2Container)) {
        return select2Container;
      }
    }
    if (isCustomSelect(element)) {
      const customTarget = element.querySelector("input, [role='combobox'], .ui-autocomplete-multiselect") || element;
      if (visible(customTarget)) return customTarget;
    }
    if (visible(element)) return element;
    const container = element.closest(".form-group, fieldset, [role='group']");
    return container && visible(container) ? container : null;
  }

  function waitForSelectOptions(element, timeout = 700) {
    const startedAt = Date.now();
    return new Promise((resolve) => {
      const check = () => {
        const options = Array.from(element.options).filter((option) =>
          !option.disabled && option.value.trim() !== "" && option.textContent.trim() !== ""
        );
        if (options.length || Date.now() - startedAt >= timeout) {
          resolve(options);
          return;
        }
        setTimeout(check, 100);
      };
      check();
    });
  }

  function fillSelect(element, value) {
    return waitForSelectOptions(element).then((options) => {
      if (!options.length) return false;

      const wanted = normalize(value);
      const matchingOption = options.find((option) =>
        normalize(option.value) === wanted || normalize(option.textContent) === wanted ||
        normalize(option.textContent).includes(wanted) || wanted.includes(normalize(option.textContent))
      );
      const option = matchingOption || options[Math.floor(Math.random() * options.length)];
      element.value = option.value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    });
  }

  function closeCustomMenus() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.querySelectorAll("multi-select > div, .ui-autocomplete-multiselect + div").forEach((menu) => {
      if (menu.querySelector("li[list-select]")) menu.style.display = "none";
    });
  }

  function closeCustomMenu(element) {
    const menu = element.querySelector("div > ul.ui-autocomplete, ul.ui-autocomplete");
    if (menu) {
      const wrapper = menu.parentElement;
      if (wrapper) wrapper.style.display = "none";
    }
    closeCustomMenus();
  }

  function fillCustomSelect(element, value) {
    const trigger = element.querySelector("input, [role='combobox'], .ui-autocomplete-multiselect") || element;
    trigger.click();
    const localOptions = Array.from(element.querySelectorAll(SELECT2_OPTION_SELECTOR));
    const options = (localOptions.length ? localOptions : Array.from(document.querySelectorAll(SELECT2_OPTION_SELECTOR)))
      .filter(visible);
    if (!options.length) {
      closeCustomMenu(element);
      return false;
    }
    const wanted = normalize(value);
    const option = options.find((item) => normalize(item.textContent).includes(wanted)) ||
      options[Math.floor(Math.random() * options.length)];
    option.click();
    closeCustomMenu(element);
    return true;
  }

  function setNativeValue(element, value) {
    const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype :
      element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor && descriptor.set) descriptor.set.call(element, String(value));
    else element.value = String(value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function fill(selector, value) {
    const mappedElement = find(selector);
    const element = select2NativeField(mappedElement) || mappedElement;
    if (!element || element.disabled) return false;
    if (element.type === "checkbox" || element.type === "radio") {
      const shouldBeChecked = Boolean(value);
      if (element.checked !== shouldBeChecked) element.click();
      return true;
    }
    if (isCustomSelect(element)) {
      return fillCustomSelect(element, value);
    }
    if (element.tagName === "SELECT") {
      return await fillSelect(element, value);
    }
    if (element.type === "date" && /^\d{2}\/\d{2}\/\d{4}$/.test(String(value))) {
      const parts = String(value).split("/");
      value = `${parts[2]}-${parts[1]}-${parts[0]}`;
    } else if (element.type === "month" && /^\d{2}\/\d{2}\/\d{4}$/.test(String(value))) {
      const parts = String(value).split("/");
      value = `${parts[2]}-${parts[1]}`;
    } else if (element.type === "number" && /^\D*[\d.,]+/.test(String(value))) {
      value = String(value).replace(/[^\d,.-]/g, "");
      value = /,\d{1,2}$/.test(value)
        ? value.replace(/\./g, "").replace(",", ".")
        : value.replace(/[^\d-]/g, "");
    }
    setNativeValue(element, value);
    return true;
  }

  function highlight(selector) {
    const element = find(selector);
    if (!element) return false;
    const target = isCustomSelect(element)
      ? (element.querySelector("input, [role='combobox'], .ui-autocomplete-multiselect") || element)
      : element;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const previousOutline = target.style.outline;
    const previousOffset = target.style.outlineOffset;
    target.style.outline = "3px solid #ef4444";
    target.style.outlineOffset = "2px";
    setTimeout(() => {
      target.style.outline = previousOutline;
      target.style.outlineOffset = previousOffset;
    }, 1400);
    return true;
  }

  function mark(selector) {
    const element = find(selector);
    if (!element) return false;
    return markElement(element, selector);
  }

  function markElement(element, key) {
    if (markedFields.has(key)) return true;
    const target = visualTarget(element);
    if (!target) return false;
    const existing = Array.from(markedFields.values()).find((marked) => marked.target === target);
    if (existing) {
      markedFields.set(key, existing);
      return true;
    }
    const previousOutline = target.style.outline;
    const previousOffset = target.style.outlineOffset;
    const previousOutlinePriority = target.style.getPropertyPriority("outline");
    const previousOffsetPriority = target.style.getPropertyPriority("outline-offset");
    target.style.setProperty("outline", "3px solid #ef4444", "important");
    target.style.setProperty("outline-offset", "2px", "important");
    markedFields.set(key, {
      target,
      previousOutline,
      previousOffset,
      previousOutlinePriority,
      previousOffsetPriority
    });
    return true;
  }

  function selectorMatches(selector, keyPrefix) {
    let elements;
    try {
      elements = Array.from(document.querySelectorAll(selector));
    } catch (error) {
      return null;
    }
    return elements.map((element, index) => ({ element, key: `${keyPrefix}${index}` }));
  }

  function markSelectorMatches(selector) {
    const matches = selectorMatches(selector, `__playground__${selector}::`);
    if (!matches) return { invalid: true, count: 0 };
    const marked = matches.filter(({ element, key }) => markElement(element, key)).length;
    return { count: marked };
  }

  function unmarkSelectorMatches(selector) {
    const prefix = `__playground__${selector}::`;
    const keys = Array.from(markedFields.keys()).filter((key) => key.startsWith(prefix));
    keys.forEach((key) => unmark(key));
    return { count: keys.length };
  }

  function unmark(selector) {
    const marked = markedFields.get(selector);
    if (marked) {
      markedFields.delete(selector);
      const stillMarked = Array.from(markedFields.values()).some((item) => item.target === marked.target);
      if (!stillMarked) {
        marked.target.style.setProperty("outline", marked.previousOutline, marked.previousOutlinePriority);
        marked.target.style.setProperty("outline-offset", marked.previousOffset, marked.previousOffsetPriority);
      }
      return true;
    }
    const element = find(selector);
    const target = visualTarget(element);
    if (target) {
      target.style.removeProperty("outline");
      target.style.removeProperty("outline-offset");
    }
    return true;
  }

  function clearMarks() {
    const uniqueMarks = new Set(markedFields.values());
    uniqueMarks.forEach((marked) => {
      marked.target.style.setProperty("outline", marked.previousOutline, marked.previousOutlinePriority);
      marked.target.style.setProperty("outline-offset", marked.previousOffset, marked.previousOffsetPriority);
    });
    markedFields.clear();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return;
    if (message.action === "SCAN_FIELDS") {
      clearMarks();
      sendResponse({ fields: scan() });
    }
    if (message.action === "FILL_FIELD") {
      fill(message.selector, message.value).then((filled) => sendResponse({ filled }));
    }
    if (message.action === "FILL_ALL") {
      const fields = message.fields || [];
      fields.reduce((chain, item) => chain.then(async (results) => {
        results.push(await fill(item.selector, item.value));
        return results;
      }), Promise.resolve([])).then((results) => {
        closeCustomMenus();
        sendResponse({ filled: results.filter(Boolean).length, total: results.length });
      });
    }
    if (message.action === "HIGHLIGHT_FIELD") sendResponse({ highlighted: highlight(message.selector) });
    if (message.action === "MARK_FIELD") sendResponse({ marked: mark(message.selector) });
    if (message.action === "UNMARK_FIELD") sendResponse({ unmarked: unmark(message.selector) });
    if (message.action === "MARK_ALL_FIELDS") {
      const selectors = Array.isArray(message.selectors) ? message.selectors : [];
      const failed = selectors.filter((selector) => !mark(selector));
      sendResponse({
        marked: selectors.length - failed.length,
        total: selectors.length,
        selectors: selectors.filter((selector) => !failed.includes(selector)),
        failed
      });
    }
    if (message.action === "UNMARK_ALL_FIELDS") {
      const selectors = Array.isArray(message.selectors) ? message.selectors : [];
      const total = Math.max(selectors.length, markedFields.size);
      clearMarks();
      sendResponse({ unmarked: total, total });
    }
    if (message.action === "COUNT_SELECTOR_MATCHES") {
      try {
        sendResponse({ count: document.querySelectorAll(message.selector || "").length });
      } catch (error) {
        sendResponse({ invalid: true, count: 0 });
      }
    }
    if (message.action === "MARK_SELECTOR_MATCHES") sendResponse(markSelectorMatches(message.selector || ""));
    if (message.action === "UNMARK_SELECTOR_MATCHES") sendResponse(unmarkSelectorMatches(message.selector || ""));
    if (message.action === "CAPTURE_NEXT_CLICK") captureNextClick(sendResponse);
    return true;
  });

  installNavigationObserver();
})();
