// Interface e regras do gerador da extensão.
const DDDS = ["11", "21", "31", "41", "51", "61", "71", "81", "85", "47", "48", "62", "65", "67", "91", "98"];
const ESTADOS = [
  { sigla: "AC", nome: "Acre", cidades: ["Rio Branco", "Cruzeiro do Sul"], ddds: ["68"] },
  { sigla: "AL", nome: "Alagoas", cidades: ["Maceió", "Arapiraca"], ddds: ["82"] },
  { sigla: "AM", nome: "Amazonas", cidades: ["Manaus", "Parintins"], ddds: ["92", "97"] },
  { sigla: "AP", nome: "Amapá", cidades: ["Macapá", "Santana"], ddds: ["96"] },
  { sigla: "BA", nome: "Bahia", cidades: ["Salvador", "Feira de Santana", "Vitória da Conquista"], ddds: ["71", "73", "74", "75", "77"] },
  { sigla: "CE", nome: "Ceará", cidades: ["Fortaleza", "Caucaia", "Juazeiro do Norte"], ddds: ["85", "88"] },
  { sigla: "DF", nome: "Distrito Federal", cidades: ["Brasília"], ddds: ["61"] },
  { sigla: "ES", nome: "Espírito Santo", cidades: ["Vitória", "Vila Velha", "Serra"], ddds: ["27", "28"] },
  { sigla: "GO", nome: "Goiás", cidades: ["Goiânia", "Anápolis", "Aparecida de Goiânia"], ddds: ["61", "62", "64"] },
  { sigla: "MA", nome: "Maranhão", cidades: ["São Luís", "Imperatriz"], ddds: ["98", "99"] },
  { sigla: "MG", nome: "Minas Gerais", cidades: ["Belo Horizonte", "Uberlândia", "Juiz de Fora"], ddds: ["31", "32", "33", "34", "35", "37", "38"] },
  { sigla: "MS", nome: "Mato Grosso do Sul", cidades: ["Campo Grande", "Dourados"], ddds: ["67"] },
  { sigla: "MT", nome: "Mato Grosso", cidades: ["Cuiabá", "Várzea Grande", "Rondonópolis"], ddds: ["65", "66"] },
  { sigla: "PA", nome: "Pará", cidades: ["Belém", "Santarém", "Ananindeua"], ddds: ["91", "93", "94"] },
  { sigla: "PB", nome: "Paraíba", cidades: ["João Pessoa", "Campina Grande"], ddds: ["83"] },
  { sigla: "PE", nome: "Pernambuco", cidades: ["Recife", "Olinda", "Caruaru"], ddds: ["81", "87"] },
  { sigla: "PI", nome: "Piauí", cidades: ["Teresina", "Parnaíba"], ddds: ["86", "89"] },
  { sigla: "PR", nome: "Paraná", cidades: ["Curitiba", "Londrina", "Maringá"], ddds: ["41", "42", "43", "44", "45", "46"] },
  { sigla: "RJ", nome: "Rio de Janeiro", cidades: ["Rio de Janeiro", "Niterói", "Petrópolis"], ddds: ["21", "22", "24"] },
  { sigla: "RN", nome: "Rio Grande do Norte", cidades: ["Natal", "Mossoró"], ddds: ["84"] },
  { sigla: "RO", nome: "Rondônia", cidades: ["Porto Velho", "Ji-Paraná"], ddds: ["69"] },
  { sigla: "RR", nome: "Roraima", cidades: ["Boa Vista", "Rorainópolis"], ddds: ["95"] },
  { sigla: "RS", nome: "Rio Grande do Sul", cidades: ["Porto Alegre", "Caxias do Sul", "Pelotas"], ddds: ["51", "53", "54", "55"] },
  { sigla: "SC", nome: "Santa Catarina", cidades: ["Florianópolis", "Joinville", "Blumenau"], ddds: ["47", "48", "49"] },
  { sigla: "SE", nome: "Sergipe", cidades: ["Aracaju", "Nossa Senhora do Socorro"], ddds: ["79"] },
  { sigla: "SP", nome: "São Paulo", cidades: ["São Paulo", "Campinas", "Santos", "Ribeirão Preto"], ddds: ["11", "12", "13", "14", "15", "16", "17", "18", "19"] },
  { sigla: "TO", nome: "Tocantins", cidades: ["Palmas", "Araguaína"], ddds: ["63"] }
];

const data = {
  person: {
    title: "Pessoa gerada",
    label: "Pessoa",
    // Gera um contexto compartilhado uma única vez por clique em "Gerar",
    // para que campos derivados (ex.: e-mail) sejam consistentes com o nome.
    context: () => {
      const nome = pick([
        "Ana Beatriz", "Carlos Eduardo", "Mariana", "Rafael", "Julia", "Lucas",
        "Beatriz", "Pedro Henrique", "Camila", "Gustavo", "Larissa", "Felipe",
        "Isabela", "Thiago", "Aline", "Bruno", "Leticia", "Mateus",
        "Sofia", "Joao Vitor", "Helena", "Diego", "Manuela", "Vinicius"
      ]);
      const sobrenome = pick([
        "Ferreira", "Costa", "Ribeiro", "Gomes", "Barbosa", "Moura", "Cardoso",
        "Nascimento", "Teixeira", "Araujo", "Monteiro", "Freitas", "Pereira",
        "Alves", "Carvalho", "Mendes", "Lopes", "Correia", "Dias", "Moreira"
      ]);
      const sexo = pick(["Feminino", "Masculino"]);
      const estado = gerarEstadoSelecionado();
      return {
        nome,
        sobrenome,
        sexo,
        mae: gerarNomeFiliacao(),
        pai: gerarNomeFiliacao(),
        cep: `${digits(5)}-${digits(3)}`,
        endereco: pick(["Rua das Flores", "Avenida Brasil", "Rua das Acácias", "Avenida Central", "Rua do Comércio"]),
        numero: String(randomInt(10, 1999)),
        bairro: pick(["Centro", "Jardim América", "Vila Nova", "Bela Vista", "Jardim Paulista"]),
        cidade: pick(estado.cidades),
        estado
      };
    },
    fields: [
      ["Nome", (ctx) => `${ctx.nome} ${ctx.sobrenome}`],
      ["CPF", () => cpf(document.querySelector("#cpf-formatted").checked)],
      ["RG", () => gerarRG()],
      ["Sexo", (ctx) => ctx.sexo],
      ["E-mail", (ctx) => gerarEmailPessoa(ctx.nome, ctx.sobrenome)],
      ["Telefone", (ctx) => gerarTelefoneCelular(ctx.estado)],
      ["Data nasc.", () => `${pad(randomInt(1, 28))}/${pad(randomInt(1, 12))}/${randomInt(1970, 2003)}`],
      ["Mãe", (ctx) => ctx.mae],
      ["Pai", (ctx) => ctx.pai],
      ["CEP", (ctx) => ctx.cep],
      ["Endereço", (ctx) => ctx.endereco],
      ["Número", (ctx) => ctx.numero],
      ["Bairro", (ctx) => ctx.bairro],
      ["Cidade", (ctx) => ctx.cidade],
      ["Estado", (ctx) => `${ctx.estado.sigla} - ${ctx.estado.nome}`],
      ["Profissão", () => pick([
        "Analista de QA", "Desenvolvedor(a)", "Designer", "Gerente de projetos",
        "Contador(a)", "Enfermeiro(a)", "Professor(a)", "Advogado(a)",
        "Arquiteto(a)", "Administrador(a)", "Jornalista", "Engenheiro(a)",
        "Vendedor(a)", "Nutricionista", "Fotógrafo(a)"
      ])],
      ["Renda mensal", () => `R$ ${randomInt(1800, 18000).toLocaleString("pt-BR")},00`]
    ]
  },
  vehicle: {
    title: "Veículo gerado",
    label: "Veículo",
    context: () => ({ estado: gerarEstadoSelecionado() }),
    fields: [
      ["Marca", () => pick(["Toyota", "Volkswagen", "Chevrolet", "Honda", "Fiat", "Hyundai"])],
      ["Modelo", () => pick(["Corolla", "T-Cross", "Onix", "Civic", "Argo", "HB20"])],
      ["Placa", () => gerarPlaca()],
      ["Ano", () => gerarAno()],
      ["Cor", () => pick(["Preto", "Branco", "Prata", "Azul", "Vermelho"])],
      ["UF", (ctx) => `${ctx.estado.sigla} - ${ctx.estado.nome}`]
    ]
  },
  company: {
    title: "Empresa gerada",
    label: "Empresa",
    context: () => {
      const nome = pick(["Horizonte", "Norte", "Ponto", "Viva", "Nexo"]);
      const segmento = pick(["Tecnologia", "Varejo", "Consultoria", "Educação", "Saúde"]);
      const estado = gerarEstadoSelecionado();

      return {
        nome,
        segmento,
        estado,
        cidade: pick(estado.cidades),
        endereco: pick(["Rua das Flores", "Avenida Brasil", "Rua das Acácias", "Avenida Central", "Rua do Comércio"]),
        numero: String(randomInt(10, 1999)),
        bairro: pick(["Centro", "Jardim América", "Vila Nova", "Bela Vista", "Jardim Paulista"]),
        cep: `${digits(5)}-${digits(3)}`
      };
    },
    fields: [
      ["Razão social", (ctx) => `${ctx.nome} ${pick(["Tecnologia", "Soluções", "Serviços", "Comércio"])} Ltda.`],
      ["CNPJ", () => cnpj(
        document.querySelector("#cnpj-formatted").checked,
        document.querySelector("#cnpj-alphanumeric").checked
      )],
      ["Inscrição Estadual", () => gerarInscricaoEstadual()],
      ["Data de abertura", () => gerarDataAbertura()],
      ["E-mail", () => gerarEmailEmpresa()],
      ["Site", (ctx) => gerarSite(ctx.nome)],
      ["Telefone", (ctx) => gerarTelefoneFixo(ctx.estado)],
      ["Segmento", (ctx) => ctx.segmento],
      ["CEP", (ctx) => ctx.cep],
      ["Endereço", (ctx) => ctx.endereco],
      ["Número", (ctx) => ctx.numero],
      ["Bairro", (ctx) => ctx.bairro],
      ["Cidade", (ctx) => ctx.cidade],
      ["Estado", (ctx) => `${ctx.estado.sigla} - ${ctx.estado.nome}`]
    ]
  }
};

let selectedType = "person";
let currentResult = null;
let activeTab = null;
let activePageUrl = "";
let pageFields = [];
let markedSelectors = new Set();

const MAPPING_TYPES = [
  ["auto", "Inferir automaticamente"],
  ["name", "Nome"],
  ["cpf", "CPF"],
  ["cnpj", "CNPJ"],
  ["email", "E-mail"],
  ["phone", "Telefone"],
  ["rg", "RG"],
  ["cep", "CEP"],
  ["address", "Endereço"],
  ["number", "Número"],
  ["neighborhood", "Bairro"],
  ["city", "Cidade"],
  ["state", "Estado / UF"],
  ["profession", "Profissão"],
  ["income", "Renda"],
  ["birthDate", "Data de nascimento"],
  ["gender", "Sexo / gênero"],
  ["mother", "Nome da mãe"],
  ["father", "Nome do pai"],
  ["company", "Empresa"],
  ["plate", "Placa"],
  ["website", "Site / URL"],
  ["checkbox", "Checkbox"],
  ["radio", "Radio"],
  ["text", "Texto"]
];

const resultSection = document.querySelector("#result-section");
const resultFields = document.querySelector("#result-fields");
const resultTitle = document.querySelector("#result-title");
const generateLabel = document.querySelector("#generate-label");
const generateButton = document.querySelector("#generate-button");
const copyJsonButton = document.querySelector("#copy-json-button");
const personOptions = document.querySelector("#person-options");
const companyOptions = document.querySelector("#company-options");
const openSidepanelButton = document.querySelector("#open-sidepanel-button");
const themeToggle = document.querySelector("#theme-toggle");
const ufSelect = document.querySelector("#uf-select");
const scanFieldsButton = document.querySelector("#scan-fields-button");
const markAllButton = document.querySelector("#mark-all-button");
const saveMappingsButton = document.querySelector("#save-mappings-button");
const fillAllButton = document.querySelector("#fill-all-button");
const pageFieldsElement = document.querySelector("#page-fields");
const pageFieldsStatus = document.querySelector("#page-fields-status");
const generatorTab = document.querySelector("#generator-tab");
const mappingTab = document.querySelector("#mapping-tab");
const generatorPanel = document.querySelector("#generator-panel");
const mappingPanel = document.querySelector("#mapping-panel");

ESTADOS.forEach((estado) => {
  const option = document.createElement("option");
  option.value = estado.sigla;
  option.textContent = `${estado.sigla} - ${estado.nome}`;
  ufSelect.appendChild(option);
});
ufSelect.value = localStorage.getItem("fakedata-uf") || "ALL";

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

applyTheme(localStorage.getItem("fakedata-theme") || "dark");

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    applyTheme(nextTheme);
  });
}

document.querySelectorAll(".type-button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedType = button.dataset.type;
    document.querySelectorAll(".type-button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    generateLabel.textContent = data[selectedType].label;
    personOptions.classList.toggle("is-hidden", selectedType !== "person");
    companyOptions.classList.toggle("is-hidden", selectedType !== "company");
    generate();
  });
});

generateButton.addEventListener("click", generate);
ufSelect.addEventListener("change", generate);
ufSelect.addEventListener("change", () => {
  localStorage.setItem("fakedata-uf", ufSelect.value);
});
copyJsonButton.addEventListener("click", () => copyText(JSON.stringify(currentResult, null, 2), copyJsonButton));
openSidepanelButton.addEventListener("click", () => {
  chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT }).catch((error) => {
    console.error("Não foi possível abrir o painel lateral.", error);
  });
  window.close();
});

if (scanFieldsButton) scanFieldsButton.addEventListener("click", scanPageFields);
if (markAllButton) markAllButton.addEventListener("click", toggleMarkAllFields);
if (saveMappingsButton) saveMappingsButton.addEventListener("click", savePageMappings);
if (fillAllButton) fillAllButton.addEventListener("click", fillAllPageFields);

if (pageFieldsElement) scanPageFields();

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

if (generatorTab) generatorTab.addEventListener("click", () => activateTab("generator"));
if (mappingTab) mappingTab.addEventListener("click", () => activateTab("mapping"));

function generate() {
  const definition = data[selectedType];
  const context = definition.context ? definition.context() : {};
  currentResult = Object.fromEntries(definition.fields.map(([label, create]) => [label, create(context)]));

  autovalidar(currentResult);

  resultTitle.textContent = definition.title;
  resultFields.innerHTML = definition.fields.map(([label]) => `
    <div class="result-field">
      <span class="field-label">${label}</span>
      <span class="field-value" title="${currentResult[label]}">${currentResult[label]}</span>
      <button class="copy-field-button" type="button" aria-label="Copiar ${label}" data-value="${currentResult[label]}">⧉</button>
    </div>
  `).join("");
  resultFields.querySelectorAll(".copy-field-button").forEach((button) => {
    button.addEventListener("click", () => copyText(button.dataset.value, button));
  });
  resultSection.classList.remove("is-hidden");
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getActiveTab(callback) {
  if (!chrome.tabs || !chrome.tabs.query) {
    callback(null);
    return;
  }
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => callback(tabs && tabs[0]));
}

function sendToPage(message, callback) {
  if (!chrome.tabs || !chrome.tabs.sendMessage) {
    callback(null, new Error("Nenhuma página ativa."));
    return;
  }
  getActiveTab((tab) => {
    activeTab = tab;
    if (!activeTab || !activeTab.id || !/^https?:/i.test(activeTab.url || "")) {
      callback(null, new Error("Nenhuma página ativa."));
      return;
    }
    chrome.tabs.sendMessage(activeTab.id, message, (response) => {
      const error = chrome.runtime.lastError;
      callback(response, error || null);
    });
  });
}

function readMappings(url, callback) {
  chrome.storage.local.get({ "fakedata-field-mappings": {} }, (result) => {
    const stored = result["fakedata-field-mappings"] || {};
    let mappings = stored[url] || [];
    if (typeof mappings === "string") {
      try { mappings = JSON.parse(mappings); } catch (error) { mappings = []; }
    }
    callback(Array.isArray(mappings) ? mappings : []);
  });
}

function scanPageFields() {
  if (!pageFieldsStatus) return;
  pageFieldsStatus.textContent = "Lendo campos da página...";
  getActiveTab((tab) => {
    activeTab = tab;
    activePageUrl = tab && tab.url ? tab.url : "";
    if (!activeTab || !activeTab.id || !/^https?:/i.test(activePageUrl)) {
      pageFields = [];
      renderPageFields();
      pageFieldsStatus.textContent = "A página ativa não permite acesso a formulários.";
      return;
    }
    sendToPage({ action: "SCAN_FIELDS" }, (response, error) => {
      if (error || !response) {
        pageFields = [];
        renderPageFields();
        pageFieldsStatus.textContent = "Não foi possível ler esta página. Recarregue-a e tente novamente.";
        return;
      }
      readMappings(activePageUrl, (saved) => {
        pageFields = (response.fields || []).map((field) => {
          const mapping = saved.find((item) => item.key === field.key || item.selector === field.selector);
          return {
            ...field,
            dataType: mapping && mapping.dataType ? mapping.dataType : field.inferredType || "text",
            selector: mapping && mapping.selector ? mapping.selector : field.selector
          };
        });
        markedSelectors = new Set();
        updateMarkAllButton();
        renderPageFields();
        pageFieldsStatus.textContent = pageFields.length
          ? `${pageFields.length} campo(s) encontrado(s). Selecione o tipo e ajuste o seletor se necessário.`
          : "Nenhum campo editável encontrado nesta página.";
      });
    });
  });
}

function renderPageFields() {
  if (!pageFieldsElement) return;
  pageFieldsElement.innerHTML = pageFields.map((field, index) => {
    const options = MAPPING_TYPES.map(([value, label]) =>
      `<option value="${escapeHtml(value)}" ${field.dataType === value ? "selected" : ""}>${escapeHtml(label)}</option>`
    ).join("");
    return `
      <div class="page-field" data-index="${index}">
        <div class="page-field-heading">
          <span class="page-field-label" title="${escapeHtml(field.label)}">${escapeHtml(field.label)}</span>
          <span class="muted">${escapeHtml(field.inputType || field.tagName)}</span>
        </div>
        <select class="page-field-type" aria-label="Tipo para ${escapeHtml(field.label)}">${options}</select>
        <input class="page-field-selector" type="text" aria-label="Seletor para ${escapeHtml(field.label)}" value="${escapeHtml(field.selector)}">
        <div class="page-field-actions">
          <button type="button" data-action="highlight">${markedSelectors.has(field.selector) ? "Desmarcar" : "Marcar"}</button>
          <button type="button" data-action="target" title="Capturar o próximo clique na página" aria-label="Capturar seletor do próximo clique">🎯</button>
          <button type="button" data-action="fill">Preencher</button>
        </div>
      </div>
    `;
  }).join("");

  pageFieldsElement.querySelectorAll(".page-field").forEach((row) => {
    const index = Number(row.dataset.index);
    row.querySelector(".page-field-type").addEventListener("change", (event) => {
      pageFields[index].dataType = event.target.value;
    });
    row.querySelector(".page-field-selector").addEventListener("input", (event) => {
      pageFields[index].selector = event.target.value;
    });
    row.querySelector('[data-action="highlight"]').addEventListener("click", () => {
      const selector = pageFields[index].selector;
      const marked = markedSelectors.has(selector);
      sendToPage({ action: marked ? "UNMARK_FIELD" : "MARK_FIELD", selector }, (response, error) => {
        if (!pageFieldsStatus) return;
        if (error || !response) {
          pageFieldsStatus.textContent = "Não foi possível marcar o campo. Recarregue a página e tente novamente.";
        } else if (!(marked ? response.unmarked : response.marked)) {
          pageFieldsStatus.textContent = "Seletor não encontrado na página. Ajuste o seletor e tente novamente.";
        } else {
          if (marked) markedSelectors.delete(selector);
          else markedSelectors.add(selector);
          updateMarkAllButton();
          renderPageFields();
          pageFieldsStatus.textContent = marked ? `${pageFields[index].label} desmarcado.` : `${pageFields[index].label} marcado.`;
        }
      });
    });
    row.querySelector('[data-action="target"]').addEventListener("click", () => captureFieldSelector(index));
    row.querySelector('[data-action="fill"]').addEventListener("click", () => fillPageField(index));
  });
}

function updateMarkAllButton() {
  if (!markAllButton) return;
  const allMarked = pageFields.length > 0 && pageFields.every((field) => markedSelectors.has(field.selector));
  markAllButton.textContent = allMarked ? "Desmarcar todos" : "Marcar todos";
}

function toggleMarkAllFields() {
  if (!pageFields.length) {
    if (pageFieldsStatus) pageFieldsStatus.textContent = "Nenhum campo encontrado para marcar.";
    return;
  }
  const allMarked = pageFields.every((field) => markedSelectors.has(field.selector));
  const action = allMarked ? "UNMARK_ALL_FIELDS" : "MARK_ALL_FIELDS";
  sendToPage({ action, selectors: pageFields.map((field) => field.selector) }, (response, error) => {
    if (error || !response) {
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Não foi possível atualizar as marcações.";
      return;
    }
    markedSelectors = new Set(allMarked ? [] : (response.selectors || []));
    updateMarkAllButton();
    renderPageFields();
    if (pageFieldsStatus) {
      if (allMarked) {
        pageFieldsStatus.textContent = "Todos os campos foram desmarcados.";
      } else if (response.failed && response.failed.length) {
        pageFieldsStatus.textContent = `${response.marked} de ${response.total} campo(s) marcado(s); ${response.failed.length} não foi(ram) localizado(s).`;
      } else {
        pageFieldsStatus.textContent = "Todos os campos foram marcados.";
      }
    }
  });
}

function captureFieldSelector(index) {
  if (pageFieldsStatus) pageFieldsStatus.textContent = "Clique no elemento desejado da página...";
  sendToPage({ action: "CAPTURE_NEXT_CLICK" }, (response, error) => {
    if (error || !response || !response.captured || !response.field) {
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Não foi possível capturar um campo.";
      return;
    }
    pageFields[index] = {
      ...pageFields[index],
      selector: response.field.selector,
      label: response.field.label || pageFields[index].label,
      inferredType: response.field.inferredType || pageFields[index].inferredType,
      dataType: pageFields[index].dataType === "text" ? response.field.inferredType : pageFields[index].dataType
    };
    renderPageFields();
    if (pageFieldsStatus) pageFieldsStatus.textContent = "Seletor capturado. Salve o mapeamento para mantê-lo.";
  });
}

function savePageMappings() {
  if (!activePageUrl || !pageFields.length) {
    if (pageFieldsStatus) pageFieldsStatus.textContent = "Nenhum mapeamento para salvar.";
    return;
  }
  const mappings = pageFields.map((field) => ({
    key: field.key,
    selector: field.selector,
    dataType: field.dataType
  }));
  chrome.storage.local.get({ "fakedata-field-mappings": {} }, (result) => {
    const stored = result["fakedata-field-mappings"] || {};
    stored[activePageUrl] = mappings;
    chrome.storage.local.set({ "fakedata-field-mappings": stored }, () => {
      if (pageFieldsStatus) pageFieldsStatus.textContent = "Mapeamentos salvos para esta URL.";
    });
  });
}

function fillPageField(index) {
  const field = pageFields[index];
  if (!field) return;
  const type = field.dataType === "auto" ? field.inferredType : field.dataType;
  const value = generateMappedValue(type, data.person.context(), field.inputType);
  sendToPage({ action: "FILL_FIELD", selector: field.selector, value }, (response, error) => {
    if (pageFieldsStatus) {
      pageFieldsStatus.textContent = error || !response || !response.filled
        ? "Não foi possível preencher esse campo. Verifique o seletor."
        : `${field.label} preenchido.`;
    }
  });
}

function fillAllPageFields() {
  if (!pageFields.length) {
    if (pageFieldsStatus) pageFieldsStatus.textContent = "Nenhum campo mapeado.";
    return;
  }
  const context = data.person.context();
  const fields = pageFields.map((field) => ({
    selector: field.selector,
    value: generateMappedValue(field.dataType === "auto" ? field.inferredType : field.dataType, context, field.inputType)
  }));
  sendToPage({ action: "FILL_ALL", fields }, (response, error) => {
    if (pageFieldsStatus) {
      pageFieldsStatus.textContent = error || !response
        ? "Não foi possível preencher os campos desta página."
        : `${response.filled} de ${response.total} campo(s) preenchido(s).`;
    }
  });
}

function generateMappedValue(type, context = data.person.context(), inputType = "") {
  if (inputType === "checkbox") return Math.random() >= 0.35;
  if (inputType === "radio") return true;
  const personValues = {
    name: `${context.nome} ${context.sobrenome}`,
    cpf: cpf(document.querySelector("#cpf-formatted") ? document.querySelector("#cpf-formatted").checked : true),
    rg: gerarRG(),
    email: gerarEmailPessoa(context.nome, context.sobrenome),
    phone: gerarTelefoneCelular(context.estado),
    birthDate: `${pad(randomInt(1, 28))}/${pad(randomInt(1, 12))}/${randomInt(1970, 2003)}`,
    gender: pick(["Feminino", "Masculino"]),
    mother: context.mae,
    father: context.pai,
    cep: context.cep,
    address: context.endereco,
    number: context.numero,
    neighborhood: context.bairro,
    city: context.cidade,
    state: `${context.estado.sigla} - ${context.estado.nome}`,
    profession: pick(["Analista de QA", "Desenvolvedor(a)", "Designer", "Gerente de projetos", "Contador(a)", "Professor(a)", "Engenheiro(a)"]),
    income: `R$ ${randomInt(1800, 18000).toLocaleString("pt-BR")},00`,
    company: `${pick(["Horizonte", "Norte", "Ponto", "Viva", "Nexo"])} Tecnologia Ltda.`,
    cnpj: cnpj(document.querySelector("#cnpj-formatted") ? document.querySelector("#cnpj-formatted").checked : true, document.querySelector("#cnpj-alphanumeric") ? document.querySelector("#cnpj-alphanumeric").checked : false),
    plate: gerarPlaca(),
    website: gerarSite(pick(["Horizonte", "Norte", "Ponto", "Viva", "Nexo"])),
    text: randomWord()
  };
  return personValues[type] || personValues.text;
}

function gerarEstadoSelecionado() {
  const selectedUf = ufSelect.value;
  if (selectedUf === "ALL") {
    return pick(ESTADOS);
  }
  return ESTADOS.find((estado) => estado.sigla === selectedUf) || pick(ESTADOS);
}

// Checagem de sanidade em desenvolvimento: garante que o próprio gerador
// nunca produza um CPF/CNPJ com dígito verificador inválido (regressão silenciosa).
function autovalidar(resultado) {
  if (resultado.CPF) {
    console.assert(validarCPF(resultado.CPF), "CPF gerado é inválido:", resultado.CPF);
  }
  if (resultado.CNPJ) {
    console.assert(validarCNPJ(resultado.CNPJ), "CNPJ gerado é inválido:", resultado.CNPJ);
  }
}

async function copyText(value, button) {
  try {
    await navigator.clipboard.writeText(value);
    const original = button.textContent;
    button.textContent = "✓";
    button.classList.add("copied");
    setTimeout(() => {
      button.textContent = original;
      button.classList.remove("copied");
    }, 1200);
  } catch (error) {
    console.error("Não foi possível copiar o dado.", error);
  }
}

function pick(items) {
  return items[randomInt(0, items.length - 1)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function digits(length) {
  return Array.from({ length }, () => randomInt(0, 9)).join("");
}

function letters(length) {
  return Array.from({ length }, () => String.fromCharCode(randomInt(65, 90))).join("");
}

function randomWord() {
  return pick(["acme", "qa-lab", "teste", "sandbox", "exemplo"]) + randomInt(10, 99);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function gerarEmailPessoa(nome, sobrenome) {
  const provedores = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];
  const primeiroNome = normalizar(nome.split(" ")[0]);
  const sobrenomeNorm = normalizar(sobrenome);
  return `${primeiroNome}.${sobrenomeNorm}${randomInt(1, 999)}@${pick(provedores)}`;
}

function gerarEmailEmpresa() {
  const dominios = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];
  return `contato${randomInt(10, 999)}@${pick(dominios)}`;
}

function gerarSite(nome) {
  return `https://www.${normalizar(nome).replace(/\s+/g, "")}${randomInt(1, 99)}.com.br`;
}

function gerarInscricaoEstadual() {
  return `${digits(3)}.${digits(3)}.${digits(3)}-${digits(2)}`;
}

function gerarDataAbertura() {
  return `${pad(randomInt(1, 28))}/${pad(randomInt(1, 12))}/${randomInt(1980, 2025)}`;
}

function gerarNomeFiliacao() {
  const nomes = [
    "Maria Aparecida", "Jose Antonio", "Sandra Regina", "Roberto Carlos",
    "Patricia Cristina", "Marcos Aurelio", "Luciana Maria", "Antonio Carlos",
    "Claudia Regina", "Fernando Luiz", "Adriana Cristina", "Paulo Roberto"
  ];
  return `${pick(nomes)} ${pick(["Ferreira", "Costa", "Ribeiro", "Gomes", "Barbosa", "Moura", "Cardoso", "Teixeira", "Monteiro", "Pereira"])}`;
}

function gerarRG() {
  return `${digits(2)}.${digits(3)}.${digits(3)}-${randomInt(0, 9)}`;
}

function gerarTelefoneCelular(estado) {
  const ddds = estado ? estado.ddds : DDDS;
  return `(${pick(ddds)}) 9${digits(4)}-${digits(4)}`;
}

function gerarTelefoneFixo(estado) {
  const ddds = estado ? estado.ddds : DDDS;
  return `(${pick(ddds)}) ${digits(4)}-${digits(4)}`;
}

// Padrão antigo (LLL-DDDD) e padrão Mercosul (LLLDLDD), vigente desde 2018.
// A maioria das placas em circulação hoje já é Mercosul, por isso o peso de 60%.
function gerarPlaca() {
  const mercosul = Math.random() < 0.6;
  return mercosul
    ? `${letters(3)}${digits(1)}${letters(1)}${digits(2)}`
    : `${letters(3)}-${digits(4)}`;
}

// Ano-modelo agora depende do ano de fabricação (na prática é sempre
// fabricação ou fabricação + 1, nunca um valor fixo desconectado).
function gerarAno() {
  const fabricacao = randomInt(2015, 2026);
  const modelo = fabricacao + (Math.random() < 0.7 ? 0 : 1);
  return `${fabricacao}/${modelo}`;
}

function cpf(formatado = true) {
  const gerarNumeros = (qtd) =>
    Array.from({ length: qtd }, () => Math.floor(Math.random() * 10));

  const calcularDigito = (digitos) => {
    let soma = 0;
    let peso = digitos.length + 1;

    for (const num of digitos) {
      soma += num * peso;
      peso--;
    }

    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const numeros = gerarNumeros(9);
  const dv1 = calcularDigito(numeros);
  const dv2 = calcularDigito([...numeros, dv1]);
  const numeroCompleto = [...numeros, dv1, dv2].join("");

  return formatado
    ? numeroCompleto.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : numeroCompleto;
}

// Confere um CPF (com ou sem máscara) recalculando os dois dígitos verificadores.
// Útil como caso de teste negativo/borda e como autocheck do próprio gerador.
function validarCPF(valor) {
  const numeros = String(valor).replace(/\D/g, "");
  if (numeros.length !== 11 || /^(\d)\1{10}$/.test(numeros)) return false;

  const digitosBase = numeros.slice(0, 9).split("").map(Number);
  const calcularDigito = (digitos) => {
    let soma = 0;
    let peso = digitos.length + 1;
    for (const num of digitos) {
      soma += num * peso;
      peso--;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const dv1 = calcularDigito(digitosBase);
  const dv2 = calcularDigito([...digitosBase, dv1]);

  return numeros === [...digitosBase, dv1, dv2].join("");
}

// alfanumerico=true gera CNPJ no novo formato da Receita Federal (vigente
// desde 31/07/2026): letras e números nas 12 primeiras posições, dígitos
// verificadores sempre numéricos. alfanumerico=false gera o formato legado.
function cnpj(formatado = true, alfanumerico = false) {
  const alfabetoValido = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const valorCaractere = (c) => c.charCodeAt(0) - 48; // '0'-'9' -> 0-9, 'A'-'Z' -> 17-42

  const gerarPosicao = () => alfanumerico
    ? alfabetoValido[randomInt(0, alfabetoValido.length - 1)]
    : String(randomInt(0, 9));

  const calcularDigito = (caracteres, pesos) => {
    const soma = caracteres.reduce((acc, c, i) => acc + valorCaractere(c) * pesos[i], 0);
    const resto = soma % 11;
    return String(resto < 2 ? 0 : 11 - resto);
  };

  const pesosDv1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesosDv2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const base = Array.from({ length: 12 }, gerarPosicao);
  const dv1 = calcularDigito(base, pesosDv1);
  const dv2 = calcularDigito([...base, dv1], pesosDv2);
  const numeroCompleto = [...base, dv1, dv2].join("");

  return formatado
    ? numeroCompleto.replace(/(.{2})(.{3})(.{3})(.{4})(.{2})/, "$1.$2.$3/$4-$5")
    : numeroCompleto;
}

// Confere um CNPJ (numérico ou alfanumérico, com ou sem máscara).
function validarCNPJ(valor) {
  const limpo = String(valor).replace(/[.\-/]/g, "").toUpperCase();
  if (limpo.length !== 14 || !/^[A-Z0-9]{12}\d{2}$/.test(limpo)) return false;

  const valorCaractere = (c) => c.charCodeAt(0) - 48;
  const base = limpo.slice(0, 12).split("");
  const [dv1Informado, dv2Informado] = limpo.slice(12).split("");

  const pesosDv1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const pesosDv2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const calcularDigito = (caracteres, pesos) => {
    const soma = caracteres.reduce((acc, c, i) => acc + valorCaractere(c) * pesos[i], 0);
    const resto = soma % 11;
    return String(resto < 2 ? 0 : 11 - resto);
  };

  const dv1 = calcularDigito(base, pesosDv1);
  const dv2 = calcularDigito([...base, dv1], pesosDv2);

  return dv1 === dv1Informado && dv2 === dv2Informado;
}

generate();