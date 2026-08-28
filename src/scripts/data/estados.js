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

let selectedType = "person";
let currentResult = null;
let activeTab = null;
let activePageUrl = "";
let activeBaseUrl = "";
let savedProfiles = [];
let selectedProfileId = "";
let mappingModalResolver = null;
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
const remapAllButton = document.querySelector("#remap-all-button");
const savedMappingsSelect = document.querySelector("#saved-mappings-select");
const renameMappingButton = document.querySelector("#rename-mapping-button");
const deleteMappingButton = document.querySelector("#delete-mapping-button");
const selectorPlaygroundInput = document.querySelector("#selector-playground-input");
const selectorPlaygroundTarget = document.querySelector("#selector-playground-target");
const selectorPlaygroundCount = document.querySelector("#selector-playground-count");
const selectorPlaygroundMark = document.querySelector("#selector-playground-mark");
const copyAuditButton = document.querySelector("#copy-audit-button");
const automaticMappingTab = document.querySelector("#automatic-mapping-tab");
const playgroundMappingTab = document.querySelector("#playground-mapping-tab");
const automaticMappingPanel = document.querySelector("#automatic-mapping-panel");
const playgroundMappingPanel = document.querySelector("#playground-mapping-panel");
let selectorPlaygroundMarked = false;
let selectorPlaygroundMarkedSelector = "";
const mappingModal = document.querySelector("#mapping-modal");
const mappingNameInput = document.querySelector("#mapping-name-input");
const mappingModalError = document.querySelector("#mapping-modal-error");
const mappingModalConfirm = document.querySelector("#mapping-modal-confirm");
const mappingModalCancel = document.querySelector("#mapping-modal-cancel");
const pageFieldsElement = document.querySelector("#page-fields");
const pageFieldsStatus = document.querySelector("#page-fields-status");
const generatorTab = document.querySelector("#generator-tab");
const mappingTab = document.querySelector("#mapping-tab");
const generatorPanel = document.querySelector("#generator-panel");
const mappingPanel = document.querySelector("#mapping-panel");

export { DDDS, ESTADOS };
