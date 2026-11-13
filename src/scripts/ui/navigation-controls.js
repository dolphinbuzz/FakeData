export function initNavigationControls({ refs }) {
  const {
    themeToggle,
    openSidepanelButton,
    maximizeButton,
    generatorTab,
    mappingTab,
    generatorPanel,
    mappingPanel,
    automaticMappingTab,
    playgroundMappingTab,
    automaticMappingPanel,
    playgroundMappingPanel,
    popupHiddenElements,
    shortcuts
  } = refs;

  function applyTheme(theme) {
    const selectedTheme = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = selectedTheme;
    if (themeToggle) {
      const isLight = selectedTheme === "light";
      themeToggle.innerHTML = `<span aria-hidden="true">${isLight ? "☀" : "☾"}</span>`;
      themeToggle.setAttribute("aria-label", isLight ? "Ativar tema escuro" : "Ativar tema claro");
      themeToggle.title = isLight ? "Ativar tema escuro" : "Ativar tema claro";
    }
    localStorage.setItem("fakedata-theme", selectedTheme);
  }

  function activateTab(tabName) {
    const isGenerator = tabName === "generator";
    if (!generatorTab || !mappingTab || !generatorPanel || !mappingPanel) return;
    generatorTab.classList.toggle("active", isGenerator);
    mappingTab.classList.toggle("active", !isGenerator);
    generatorTab.setAttribute("aria-selected", String(isGenerator));
    mappingTab.setAttribute("aria-selected", String(!isGenerator));
    generatorTab.tabIndex = isGenerator ? 0 : -1;
    mappingTab.tabIndex = isGenerator ? -1 : 0;
    generatorPanel.hidden = !isGenerator;
    mappingPanel.hidden = isGenerator;
  }

  function activateMappingSubtab(tabName) {
    const automatic = tabName === "automatic";
    if (!automaticMappingTab || !playgroundMappingTab || !automaticMappingPanel || !playgroundMappingPanel) return;
    automaticMappingTab.classList.toggle("active", automatic);
    playgroundMappingTab.classList.toggle("active", !automatic);
    automaticMappingTab.setAttribute("aria-selected", String(automatic));
    playgroundMappingTab.setAttribute("aria-selected", String(!automatic));
    automaticMappingTab.tabIndex = automatic ? 0 : -1;
    playgroundMappingTab.tabIndex = automatic ? -1 : 0;
    automaticMappingPanel.hidden = !automatic;
    playgroundMappingPanel.hidden = automatic;
  }

  function applyPopupMode(isPopup) {
    if (!isPopup) return;
    document.documentElement.dataset.extensionMode = "popup";
    activateTab("mapping");
    activateMappingSubtab("automatic");
    popupHiddenElements.forEach((element) => {
      if (element) element.hidden = true;
    });
  }

  function detectPopupMode(callback) {
    if (!chrome.windows || typeof chrome.windows.getCurrent !== "function") {
      callback(false);
      return;
    }
    chrome.windows.getCurrent((currentWindow) => {
      const error = chrome.runtime.lastError;
      callback(!error && currentWindow && currentWindow.type === "popup");
    });
  }

  function isEditableTarget(target) {
    return target instanceof HTMLElement &&
      (target.matches("input, textarea, select") || target.isContentEditable);
  }

  function handleShortcut(event) {
    if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return;
    const controls = {
      s: shortcuts.scan,
      p: shortcuts.fill,
      f: shortcuts.floating,
      l: shortcuts.save,
      m: shortcuts.mark,
      c: shortcuts.clear
    };
    const control = controls[event.key.toLowerCase()];
    if (!control || control.hidden || control.disabled) return;
    event.preventDefault();
    control.click();
  }

  function closeCurrentSidePanel() {
    if (!chrome.sidePanel || typeof chrome.sidePanel.close !== "function" ||
      !chrome.windows || typeof chrome.windows.getCurrent !== "function") {
      window.close();
      return;
    }
    chrome.windows.getCurrent((currentWindow) => {
      const error = chrome.runtime.lastError;
      if (error || !currentWindow || typeof currentWindow.id !== "number") {
        window.close();
        return;
      }
      Promise.resolve(chrome.sidePanel.close({ windowId: currentWindow.id }))
        .catch((closeError) => {
          if (!/No window with id/i.test(String(closeError && closeError.message))) {
            console.error("Não foi possível fechar o painel lateral.", closeError);
          }
        })
        .finally(() => window.close());
    });
  }

  if (openSidepanelButton) openSidepanelButton.addEventListener("click", () => {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT }).catch((error) => {
      console.error("Não foi possível abrir o painel lateral.", error);
    });
    window.close();
  });
  if (maximizeButton) maximizeButton.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("src/popup.html") }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error("Não foi possível abrir a extensão em uma nova aba.", error);
        return;
      }
      closeCurrentSidePanel();
    });
  });

  applyTheme(localStorage.getItem("fakedata-theme") || "dark");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      applyTheme(nextTheme);
    });
  }
  if (generatorTab) generatorTab.addEventListener("click", () => activateTab("generator"));
  if (mappingTab) mappingTab.addEventListener("click", () => activateTab("mapping"));
  if (automaticMappingTab) automaticMappingTab.addEventListener("click", () => activateMappingSubtab("automatic"));
  if (playgroundMappingTab) playgroundMappingTab.addEventListener("click", () => activateMappingSubtab("playground"));
  document.addEventListener("keydown", handleShortcut);

  return { applyPopupMode, detectPopupMode, activateTab, activateMappingSubtab, closeCurrentSidePanel };
}
