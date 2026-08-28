(() => {
  "use strict";

  const FIELD_SELECTOR = "input, select, textarea";
  const CUSTOM_FIELD_SELECTOR = "multi-select, [role='combobox'], .ui-autocomplete-multiselect";
  const IGNORED_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "file"]);

  const normalize = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const escapeAttribute = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

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

  function structuralSelector(element) {
    const parts = [];
    let node = element;
    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body) {
      let part = node.tagName.toLowerCase();
      const siblings = node.parentElement ? Array.from(node.parentElement.children).filter((child) => child.tagName === node.tagName) : [];
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      parts.unshift(part);
      const selector = parts.join(" > ");
      if (document.querySelectorAll(selector).length === 1) return selector;
      node = node.parentElement;
    }
    return parts.join(" > ");
  }

  function selectorFor(element) {
    const candidates = [
      ["name", element.getAttribute("name"), (value) => `[name="${escapeAttribute(value)}"]`],
      ["autocomplete", element.getAttribute("autocomplete"), (value) => `[autocomplete="${escapeAttribute(value)}"]`],
      ["aria-label", element.getAttribute("aria-label"), (value) => `[aria-label="${escapeAttribute(value)}"]`],
      ["placeholder", element.getAttribute("placeholder"), (value) => `[placeholder="${escapeAttribute(value)}"]`],
      ["type", element.type, (value) => `${element.tagName.toLowerCase()}[type="${escapeAttribute(value)}"]`],
      ["id", element.id, (value) => `[id="${escapeAttribute(value)}"]`]
    ];
    for (const [, value, create] of candidates) {
      if (!value) continue;
      const selector = create(value);
      if (document.querySelectorAll(selector).length === 1) return selector;
    }

    function isCustomSelect(element) {
      return element.matches(CUSTOM_FIELD_SELECTOR);
    }
    return structuralSelector(element);
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
      const element = fieldFromTarget(event.target);
      if (!element) {
        sendResponse({ captured: false });
        return;
      }
      sendResponse({
        captured: true,
        field: {
          selector: selectorFor(element),
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
    const selector = selectorFor(element);
    const label = labelsFor(element).replace(/\s+/g, " ").trim() ||
      element.getAttribute("name") || element.getAttribute("placeholder") || `${element.tagName.toLowerCase()} ${index + 1}`;
    return {
      key: `${selector}::${index}`,
      selector,
      label: label.slice(0, 120),
      inferredType: inferType(element),
      tagName: element.tagName.toLowerCase(),
      inputType: element.type || "",
      value: element.value || "",
      required: Boolean(element.required),
      disabled: Boolean(element.disabled)
    };
  }

  function scan() {
    const nativeFields = Array.from(document.querySelectorAll(FIELD_SELECTOR));
    const customFields = Array.from(document.querySelectorAll(CUSTOM_FIELD_SELECTOR))
      .filter((element) => !element.closest("multi-select") || element.tagName.toLowerCase() === "multi-select");
    return nativeFields.concat(customFields)
      .filter((element) => !IGNORED_TYPES.has(String(element.type || "").toLowerCase()) && visible(element) && !element.disabled)
      .map(describe);
  }

  function find(selector) {
    try {
      return document.querySelector(selector);
    } catch (error) {
      return null;
    }
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

  function fill(selector, value) {
    const element = find(selector);
    if (!element || element.disabled) return false;
    if (element.type === "checkbox" || element.type === "radio") {
      const shouldBeChecked = Boolean(value);
      if (element.checked !== shouldBeChecked) element.click();
      return true;
    }
    if (isCustomSelect(element)) {
      const trigger = element.querySelector("input, [role='combobox'], .ui-autocomplete-multiselect") || element;
      trigger.click();
      const options = Array.from(document.querySelectorAll("li[list-select], [role='option'], .ui-menu-item"))
        .filter(visible);
      if (!options.length) return false;
      const wanted = normalize(value);
      const option = options.find((item) => normalize(item.textContent).includes(wanted)) || options[0];
      option.click();
      return true;
    }
    if (element.tagName === "SELECT") {
      const wanted = normalize(value);
      const option = Array.from(element.options).find((item) =>
        normalize(item.value) === wanted || normalize(item.textContent) === wanted ||
        normalize(item.textContent).includes(wanted) || wanted.includes(normalize(item.textContent))
      );
      if (!option) return false;
      element.value = option.value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
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
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    const previous = element.style.outline;
    element.style.outline = "3px solid #ef4444";
    setTimeout(() => { element.style.outline = previous; }, 1400);
    return true;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return;
    if (message.action === "SCAN_FIELDS") sendResponse({ fields: scan() });
    if (message.action === "FILL_FIELD") sendResponse({ filled: fill(message.selector, message.value) });
    if (message.action === "FILL_ALL") {
      const results = (message.fields || []).map((item) => fill(item.selector, item.value));
      sendResponse({ filled: results.filter(Boolean).length, total: results.length });
    }
    if (message.action === "HIGHLIGHT_FIELD") sendResponse({ highlighted: highlight(message.selector) });
    if (message.action === "CAPTURE_NEXT_CLICK") captureNextClick(sendResponse);
    return true;
  });
})();
