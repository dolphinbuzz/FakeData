// Interface e regras do gerador da extensão.
const DDDS = ["11", "21", "31", "41", "51", "61", "71", "81", "85", "47", "48", "62", "65", "67", "91", "98"];

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
      const estado = pick([
        { sigla: "SP", nome: "São Paulo", cidades: ["São Paulo", "Campinas", "Santos", "Ribeirão Preto"] },
        { sigla: "RJ", nome: "Rio de Janeiro", cidades: ["Rio de Janeiro", "Niterói", "Petrópolis"] },
        { sigla: "MG", nome: "Minas Gerais", cidades: ["Belo Horizonte", "Uberlândia", "Juiz de Fora"] },
        { sigla: "PR", nome: "Paraná", cidades: ["Curitiba", "Londrina", "Maringá"] },
        { sigla: "RS", nome: "Rio Grande do Sul", cidades: ["Porto Alegre", "Caxias do Sul", "Pelotas"] },
        { sigla: "BA", nome: "Bahia", cidades: ["Salvador", "Feira de Santana", "Vitória da Conquista"] },
        { sigla: "SC", nome: "Santa Catarina", cidades: ["Florianópolis", "Joinville", "Blumenau"] },
        { sigla: "PE", nome: "Pernambuco", cidades: ["Recife", "Olinda", "Caruaru"] },
        { sigla: "GO", nome: "Goiás", cidades: ["Goiânia", "Anápolis", "Aparecida de Goiânia"] }
      ]);
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
      ["Telefone", () => gerarTelefoneCelular()],
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
    fields: [
      ["Marca", () => pick(["Toyota", "Volkswagen", "Chevrolet", "Honda", "Fiat", "Hyundai"])],
      ["Modelo", () => pick(["Corolla", "T-Cross", "Onix", "Civic", "Argo", "HB20"])],
      ["Placa", () => gerarPlaca()],
      ["Ano", () => gerarAno()],
      ["Cor", () => pick(["Preto", "Branco", "Prata", "Azul", "Vermelho"])]
    ]
  },
  company: {
    title: "Empresa gerada",
    label: "Empresa",
    context: () => {
      const nome = pick(["Horizonte", "Norte", "Ponto", "Viva", "Nexo"]);
      const segmento = pick(["Tecnologia", "Varejo", "Consultoria", "Educação", "Saúde"]);
      const estado = pick([
        { sigla: "SP", nome: "São Paulo", cidades: ["São Paulo", "Campinas", "Santos"] },
        { sigla: "RJ", nome: "Rio de Janeiro", cidades: ["Rio de Janeiro", "Niterói", "Petrópolis"] },
        { sigla: "MG", nome: "Minas Gerais", cidades: ["Belo Horizonte", "Uberlândia", "Juiz de Fora"] },
        { sigla: "PR", nome: "Paraná", cidades: ["Curitiba", "Londrina", "Maringá"] },
        { sigla: "RS", nome: "Rio Grande do Sul", cidades: ["Porto Alegre", "Caxias do Sul", "Pelotas"] },
        { sigla: "BA", nome: "Bahia", cidades: ["Salvador", "Feira de Santana", "Vitória da Conquista"] }
      ]);

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
      ["Telefone", () => gerarTelefoneFixo()],
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
  });
});

generateButton.addEventListener("click", generate);
copyJsonButton.addEventListener("click", () => copyText(JSON.stringify(currentResult, null, 2), copyJsonButton));
openSidepanelButton.addEventListener("click", () => {
  chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT }).catch((error) => {
    console.error("Não foi possível abrir o painel lateral.", error);
  });
  window.close();
});

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

function gerarTelefoneCelular() {
  return `(${pick(DDDS)}) 9${digits(4)}-${digits(4)}`;
}

function gerarTelefoneFixo() {
  return `(${pick(DDDS)}) ${digits(4)}-${digits(4)}`;
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