(() => {
  "use strict";

  const modulesReady = Promise.all([
    import(chrome.runtime.getURL("src/scripts/selector-engine.js")),
    import(chrome.runtime.getURL("src/scripts/messages.js"))
  ]);
  let selectorEngine = null;
  let actions = null;
  const markedFields = new Map();
  const pageControls = new Map();
  let pageControlFields = [];
  const controlStyle = document.createElement("style");
  controlStyle.id = "fakedata-page-control-style";
  controlStyle.textContent = `
    .fakedata-page-fill {
      position: absolute;
      z-index: 2147483647;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid #2563eb;
      border-radius: 6px;
      background: #ffffff;
      color: #1d4ed8;
      box-shadow: 0 2px 8px rgba(15, 23, 42, .25);
      cursor: pointer;
      font: 16px/26px sans-serif;
    }
    .fakedata-page-fill:hover { background: #dbeafe; }
    .fakedata-page-fill:disabled { opacity: .6; cursor: wait; }
    .fakedata-page-fill svg {
      width: 17px;
      height: 17px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.7;
    }
  `;
  document.documentElement.appendChild(controlStyle);
  modulesReady.then(([engine, messages]) => {
    selectorEngine = engine;
    actions = messages.ACTIONS;
  });

  // Selector discovery and inference live in selector-engine.js.
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
      if (selection && selectorEngine.visible(selection)) return selection;
      const select2Container = element.nextElementSibling;
      if (select2Container && select2Container.matches(".select2-container") && selectorEngine.visible(select2Container)) {
        return select2Container;
      }
    }
    if (selectorEngine.isCustomSelect(element)) {
      const customTarget = element.querySelector("input, [role='combobox'], .ui-autocomplete-multiselect") || element;
      if (selectorEngine.visible(customTarget)) return customTarget;
    }
    if (selectorEngine.visible(element)) return element;
    const container = element.closest(".form-group, fieldset, [role='group']");
    return container && selectorEngine.visible(container) ? container : null;
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

      const wanted = selectorEngine.normalize(value);
      const matchingOption = options.find((option) =>
        selectorEngine.normalize(option.value) === wanted || selectorEngine.normalize(option.textContent) === wanted ||
        selectorEngine.normalize(option.textContent).includes(wanted) || wanted.includes(selectorEngine.normalize(option.textContent))
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
    const localOptions = Array.from(element.querySelectorAll(selectorEngine.SELECT2_OPTION_SELECTOR));
    const options = (localOptions.length ? localOptions : Array.from(document.querySelectorAll(selectorEngine.SELECT2_OPTION_SELECTOR)))
      .filter(selectorEngine.visible);
    if (!options.length) {
      closeCustomMenu(element);
      return false;
    }
    const wanted = selectorEngine.normalize(value);
    const option = options.find((item) => selectorEngine.normalize(item.textContent).includes(wanted)) ||
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
    if (selectorEngine.isCustomSelect(element)) {
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
    const target = selectorEngine.isCustomSelect(element)
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

  function removePageControls() {
    pageControls.forEach((button) => button.remove());
    pageControls.clear();
  }

  function updatePageControls(fields) {
    removePageControls();
    pageControlFields = Array.isArray(fields) ? fields : [];
    pageControlFields.filter((field) => field && field.key && field.selector).forEach((field) => {
      const element = find(field.selector);
      if (!element) return;
      const target = visualTarget(element) || element;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fakedata-page-fill";
      button.dataset.fakedataControl = "true";
      button.title = `Preencher ${field.label || "campo"}`;
      button.setAttribute("aria-label", button.title);
      button.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 4h8v3H8zM6 7h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"></path>
          <path d="M8 13h8M13 10l3 3-3 3"></path>
        </svg>`;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.disabled = true;
        chrome.runtime.sendMessage({
          action: actions.PAGE_FIELD_FILL_REQUEST,
          key: field.key,
          selector: field.selector
        }, (response) => {
          button.disabled = false;
          if (chrome.runtime.lastError || !response || !response.filled) {
            button.title = "Não foi possível preencher este campo";
          } else {
            button.title = `Preencher ${field.label || "campo"}`;
          }
        });
      });
      document.documentElement.appendChild(button);
      const rect = target.getBoundingClientRect();
      button.style.left = `${Math.max(4, rect.right + window.scrollX + 6)}px`;
      button.style.top = `${Math.max(4, rect.top + window.scrollY + (rect.height - 28) / 2)}px`;
      pageControls.set(field.key, button);
    });
  }

  function setPageControlsVisibility(visible) {
    if (visible) {
      updatePageControls(pageControlFields);
    } else {
      removePageControls();
    }
  }

  function handleMessage(message, sender, sendResponse) {
    if (!message || !message.action) return;
    if (message.action === actions.SCAN_FIELDS) {
      clearMarks();
      modulesReady.then(() => sendResponse({ fields: selectorEngine.scan() }));
      return true;
    }
    if (message.action === actions.FILL_FIELD) {
      fill(message.selector, message.value).then((filled) => sendResponse({ filled }));
    }
    if (message.action === actions.UPDATE_PAGE_FIELD_CONTROLS) {
      if (message.visible === false) {
        setPageControlsVisibility(false);
      } else {
        updatePageControls(message.fields);
      }
      sendResponse({ updated: true, count: pageControls.size });
    }
    if (message.action === actions.SET_PAGE_FIELD_CONTROLS_VISIBILITY) {
      if (message.visible !== false) setPageControlsVisibility(true);
      else setPageControlsVisibility(false);
      sendResponse({ updated: true, count: pageControls.size });
    }
    if (message.action === actions.FILL_ALL) {
      const fields = message.fields || [];
      fields.reduce((chain, item) => chain.then(async (results) => {
        results.push(await fill(item.selector, item.value));
        return results;
      }), Promise.resolve([])).then((results) => {
        closeCustomMenus();
        sendResponse({ filled: results.filter(Boolean).length, total: results.length });
      });
    }
    if (message.action === actions.HIGHLIGHT_FIELD) sendResponse({ highlighted: highlight(message.selector) });
    if (message.action === actions.MARK_FIELD) sendResponse({ marked: mark(message.selector) });
    if (message.action === actions.UNMARK_FIELD) sendResponse({ unmarked: unmark(message.selector) });
    if (message.action === actions.MARK_ALL_FIELDS) {
      const selectors = Array.isArray(message.selectors) ? message.selectors : [];
      const failed = selectors.filter((selector) => !mark(selector));
      sendResponse({
        marked: selectors.length - failed.length,
        total: selectors.length,
        selectors: selectors.filter((selector) => !failed.includes(selector)),
        failed
      });
    }
    if (message.action === actions.UNMARK_ALL_FIELDS) {
      const selectors = Array.isArray(message.selectors) ? message.selectors : [];
      const total = Math.max(selectors.length, markedFields.size);
      clearMarks();
      sendResponse({ unmarked: total, total });
    }
    if (message.action === actions.COUNT_SELECTOR_MATCHES) {
      try {
        sendResponse({ count: document.querySelectorAll(message.selector || "").length });
      } catch (error) {
        sendResponse({ invalid: true, count: 0 });
      }
    }
    if (message.action === actions.MARK_SELECTOR_MATCHES) sendResponse(markSelectorMatches(message.selector || ""));
    if (message.action === actions.UNMARK_SELECTOR_MATCHES) sendResponse(unmarkSelectorMatches(message.selector || ""));
    if (message.action === actions.CAPTURE_NEXT_CLICK) {
      modulesReady.then(() => selectorEngine.captureNextClick(sendResponse));
      return true;
    }
    return true;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    modulesReady
      .then(() => handleMessage(message, sender, sendResponse))
      .catch(() => sendResponse({ error: "Não foi possível carregar o motor de mapeamento." }));
    return true;
  });

  modulesReady.then(() => selectorEngine.installNavigationObserver());
})();
