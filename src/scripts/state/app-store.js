// Estado mutável compartilhado do popup.
//
// A Fase 2 da refatoração extraiu este estado do `app.js` para que o painel de
// campos e o restante da UI possam lê-lo sem depender de variáveis no escopo do
// módulo. O objeto é intencionalmente simples: a UI continua sendo a dona das
// transições, mas o estado deixa de ficar disperso em 16 `let` no topo do arquivo.

function createInitialState() {
  return {
    selectedType: "person",
    currentResult: null,
    activeTab: null,
    activePageUrl: "",
    activeBaseUrl: "",
    selectedBaseUrl: "",
    savedProfiles: [],
    selectedProfileId: "",
    mappingModalResolver: null,
    mappingModalConfirmHandler: null,
    pageFields: [],
    markedSelectors: new Set(),
    vehicleCatalog: [],
    floatingControlsVisible: true,
    selectorPlaygroundMarked: false,
    selectorPlaygroundMarkedSelector: ""
  };
}

export const state = createInitialState();

export function resetState() {
  Object.assign(state, createInitialState());
  return state;
}
