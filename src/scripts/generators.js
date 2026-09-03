import { DDDS, ESTADOS } from "./data/estados.js";
import { pickVehicle } from "./data/vehicle-catalog.js";

const DEFAULT_PROVIDERS = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];
const VIN_ALPHABET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const VIN_VALUES = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2,
  T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9
};
const PERSON_FIRST_NAMES = [
  "Ana Beatriz", "Carlos Eduardo", "Mariana", "Rafael", "Julia", "Lucas",
  "Beatriz", "Pedro Henrique", "Camila", "Gustavo", "Larissa", "Felipe",
  "Isabela", "Thiago", "Aline", "Bruno", "Leticia", "Mateus", "Sofia",
  "Joao Vitor", "Helena", "Diego", "Manuela", "Vinicius", "Amanda",
  "Arthur", "Bianca", "Caio", "Daniel", "Eduarda", "Enzo", "Fabiana",
  "Gabriel", "Giovana", "Henrique", "Igor", "Joaquim", "Karen", "Leonardo",
  "Livia", "Marcelo", "Nicole", "Otavio", "Priscila", "Rodrigo", "Samuel",
  "Talita", "Valentina", "Vitoria", "Wesley", "Yasmin", "Alice Maria",
  "Joao Gabriel", "Maria Clara", "Maria Eduarda", "Luiz Felipe", "Alessandra",
  "Bernardo", "Cecilia", "Davi", "Emanuel", "Fernando", "Heloisa", "Isadora",
  "Joana", "Laura", "Miguel", "Nicolas", "Raquel", "Sara", "Theo", "Yuri"
];
const PERSON_SURNAMES = [
  "Ferreira", "Costa", "Ribeiro", "Gomes", "Barbosa", "Moura", "Cardoso",
  "Nascimento", "Teixeira", "Araujo", "Monteiro", "Freitas", "Pereira",
  "Alves", "Carvalho", "Mendes", "Lopes", "Correia", "Dias", "Moreira",
  "Martins", "Rocha", "Santos", "Oliveira", "Souza", "Goncalves", "Melo",
  "Pinto", "Macedo", "Barros", "Nogueira", "Batista", "Campos", "Cavalcanti",
  "Andrade", "Rezende", "Borges", "Duarte", "Farias", "Leal", "Miranda",
  "Ramos", "Moraes", "Vieira", "Fonseca", "Matos", "Siqueira", "Tavares",
  "Peixoto", "Coelho", "Neves", "Assis", "Braga", "Macedo", "Vasconcelos"
];

function pickDistinct(items, count) {
  const available = [...items];
  const selected = [];
  while (selected.length < count && available.length) {
    const index = Math.floor(Math.random() * available.length);
    selected.push(available.splice(index, 1)[0]);
  }
  return selected;
}

export function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function digits(length) {
  return Array.from({ length }, () => randomInt(0, 9)).join("");
}

export function letters(length) {
  return Array.from({ length }, () => String.fromCharCode(randomInt(65, 90))).join("");
}

export function randomWord() {
  return pick(["acme", "qa-lab", "teste", "sandbox", "exemplo"]) + randomInt(10, 99);
}

export function pad(value) {
  return String(value).padStart(2, "0");
}

export function normalizar(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function gerarEmailPessoa(nome, sobrenome) {
  const primeiroNome = normalizar(nome.split(" ")[0]);
  const sobrenomeNorm = normalizar(sobrenome).replace(/\s+/g, ".");
  return `${primeiroNome}.${sobrenomeNorm}${randomInt(1, 999)}@${pick(DEFAULT_PROVIDERS)}`;
}

export function gerarEmailEmpresa() {
  return `contato${randomInt(10, 999)}@${pick(DEFAULT_PROVIDERS)}`;
}

export function gerarSite(nome) {
  return `https://www.${normalizar(nome).replace(/\s+/g, "")}${randomInt(1, 99)}.com.br`;
}

export function gerarInscricaoEstadual() {
  return `${digits(3)}.${digits(3)}.${digits(3)}-${digits(2)}`;
}

export function gerarDataAbertura() {
  return `${pad(randomInt(1, 28))}/${pad(randomInt(1, 12))}/${randomInt(1980, 2025)}`;
}

export function gerarNomeFiliacao() {
  const nomes = [
    "Maria Aparecida", "Jose Antonio", "Sandra Regina", "Roberto Carlos",
    "Patricia Cristina", "Marcos Aurelio", "Luciana Maria", "Antonio Carlos",
    "Claudia Regina", "Fernando Luiz", "Adriana Cristina", "Paulo Roberto",
    "Ana Lucia", "Jose Carlos", "Maria Helena", "Luiz Fernando", "Regina Celia",
    "Francisco Jose", "Tereza Cristina", "Carlos Alberto"
  ];
  return `${pick(nomes)} ${pickDistinct(PERSON_SURNAMES, 2).join(" ")}`;
}

export function gerarRG() {
  return `${digits(2)}.${digits(3)}.${digits(3)}-${randomInt(0, 9)}`;
}

export function gerarTelefoneCelular(estado, ddds = DDDS) {
  return `(${pick(estado ? estado.ddds : ddds)}) 9${digits(4)}-${digits(4)}`;
}

export function gerarTelefoneFixo(estado, ddds = DDDS) {
  return `(${pick(estado ? estado.ddds : ddds)}) ${digits(4)}-${digits(4)}`;
}

export function gerarPlaca() {
  return Math.random() < 0.6
    ? `${letters(3)}${digits(1)}${letters(1)}${digits(2)}`
    : `${letters(3)}-${digits(4)}`;
}

export function gerarAno() {
  const fabricacao = randomInt(2015, 2026);
  const modelo = fabricacao + (Math.random() < 0.7 ? 0 : 1);
  return `${fabricacao}/${modelo}`;
}

function vinCheckDigit(value) {
  const total = [...value].reduce((sum, character, index) =>
    sum + VIN_VALUES[character] * VIN_WEIGHTS[index], 0);
  const remainder = total % 11;
  return remainder === 10 ? "X" : String(remainder);
}

export function gerarChassi() {
  const prefix = `9BW${Array.from({ length: 5 }, () => pick(VIN_ALPHABET)).join("")}`;
  const yearAndPlant = `${pick(VIN_ALPHABET)}${pick(VIN_ALPHABET)}`;
  const serial = digits(6);
  const withoutCheckDigit = `${prefix}${pick(VIN_ALPHABET)}${yearAndPlant}${serial}`;
  return `${withoutCheckDigit.slice(0, 8)}${vinCheckDigit(withoutCheckDigit)}${withoutCheckDigit.slice(9)}`;
}

export function validarChassi(value) {
  const normalized = String(value || "").toUpperCase();
  if (normalized.length !== 17 || !new RegExp(`^[${VIN_ALPHABET}]{17}$`).test(normalized)) return false;
  return normalized[8] === vinCheckDigit(normalized);
}

export function cpf(formatado = true) {
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
  const numeros = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv1 = calcularDigito(numeros);
  const dv2 = calcularDigito([...numeros, dv1]);
  const numeroCompleto = [...numeros, dv1, dv2].join("");
  return formatado ? numeroCompleto.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : numeroCompleto;
}

export function validarCPF(valor) {
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

export function cnpj(formatado = true, alfanumerico = false) {
  const alfabetoValido = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const valorCaractere = (c) => c.charCodeAt(0) - 48;
  const gerarPosicao = () => alfanumerico
    ? alfabetoValido[randomInt(0, alfabetoValido.length - 1)]
    : String(randomInt(0, 9));
  const calcularDigito = (caracteres, pesos) => {
    const soma = caracteres.reduce((acc, c, i) => acc + valorCaractere(c) * pesos[i], 0);
    const resto = soma % 11;
    return String(resto < 2 ? 0 : 11 - resto);
  };
  const base = Array.from({ length: 12 }, gerarPosicao);
  const dv1 = calcularDigito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calcularDigito([...base, dv1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const numeroCompleto = [...base, dv1, dv2].join("");
  return formatado ? numeroCompleto.replace(/(.{2})(.{3})(.{3})(.{4})(.{2})/, "$1.$2.$3/$4-$5") : numeroCompleto;
}

export function validarCNPJ(valor) {
  const limpo = String(valor).replace(/[.\-/]/g, "").toUpperCase();
  if (limpo.length !== 14 || !/^[A-Z0-9]{12}\d{2}$/.test(limpo)) return false;
  const valorCaractere = (c) => c.charCodeAt(0) - 48;
  const base = limpo.slice(0, 12).split("");
  const [dv1Informado, dv2Informado] = limpo.slice(12).split("");
  const calcularDigito = (caracteres, pesos) => {
    const soma = caracteres.reduce((acc, c, i) => acc + valorCaractere(c) * pesos[i], 0);
    const resto = soma % 11;
    return String(resto < 2 ? 0 : 11 - resto);
  };
  const dv1 = calcularDigito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calcularDigito([...base, dv1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return dv1 === dv1Informado && dv2 === dv2Informado;
}

export function createGeneratorData({
  getState = () => pick(ESTADOS),
  ddds = DDDS,
  getCpfFormatted = () => true,
  getCnpjFormatted = () => true,
  getCnpjAlphanumeric = () => false,
  getVehicleCatalog = () => []
} = {}) {
  return {
    person: {
      title: "Pessoa gerada",
      label: "Pessoa",
      context: () => {
        const nome = pick(PERSON_FIRST_NAMES);
        const sobrenome = pickDistinct(PERSON_SURNAMES, 2).join(" ");
        const sexo = pick(["Feminino", "Masculino"]);
        const estado = getState();
        return {
          nome, sobrenome, sexo, mae: gerarNomeFiliacao(), pai: gerarNomeFiliacao(),
          cep: `${digits(5)}-${digits(3)}`,
          endereco: pick(["Rua das Flores", "Avenida Brasil", "Rua das Acácias", "Avenida Central", "Rua do Comércio"]),
          numero: String(randomInt(10, 1999)),
          bairro: pick(["Centro", "Jardim América", "Vila Nova", "Bela Vista", "Jardim Paulista"]),
          cidade: pick(estado.cidades), estado
        };
      },
      fields: [
        ["Nome", (ctx) => `${ctx.nome} ${ctx.sobrenome}`],
        ["CPF", () => cpf(getCpfFormatted())],
        ["RG", () => gerarRG()],
        ["Sexo", (ctx) => ctx.sexo],
        ["E-mail", (ctx) => gerarEmailPessoa(ctx.nome, ctx.sobrenome)],
        ["Telefone", (ctx) => gerarTelefoneCelular(ctx.estado, ddds)],
        ["Data nasc.", () => `${pad(randomInt(1, 28))}/${pad(randomInt(1, 12))}/${randomInt(1970, 2003)}`],
        ["Mãe", (ctx) => ctx.mae], ["Pai", (ctx) => ctx.pai], ["CEP", (ctx) => ctx.cep],
        ["Endereço", (ctx) => ctx.endereco], ["Número", (ctx) => ctx.numero], ["Bairro", (ctx) => ctx.bairro],
        ["Cidade", (ctx) => ctx.cidade], ["Estado", (ctx) => `${ctx.estado.sigla} - ${ctx.estado.nome}`],
        ["Profissão", () => pick(["Analista de QA", "Desenvolvedor(a)", "Designer", "Gerente de projetos", "Contador(a)", "Enfermeiro(a)", "Professor(a)", "Advogado(a)", "Arquiteto(a)", "Administrador(a)", "Jornalista", "Engenheiro(a)", "Vendedor(a)", "Nutricionista", "Fotógrafo(a)"])],
        ["Renda mensal", () => `R$ ${randomInt(1800, 18000).toLocaleString("pt-BR")},00`]
      ]
    },
    vehicle: {
      title: "Veículo gerado", label: "Veículo",
      context: () => ({ estado: getState(), ...pickVehicle(getVehicleCatalog(), pick) }),
      fields: [
        ["Marca", (ctx) => ctx.marca],
        ["Modelo", (ctx) => ctx.modelo],
        ["Placa", () => gerarPlaca()], ["Chassi", () => gerarChassi()], ["Ano", () => gerarAno()],
        ["Cor", () => pick(["Preto", "Branco", "Prata", "Azul", "Vermelho", "Cinza", "Verde"])],
        ["UF", (ctx) => `${ctx.estado.sigla} - ${ctx.estado.nome}`]
      ]
    },
    company: {
      title: "Empresa gerada", label: "Empresa",
      context: () => {
        const nome = pick(["Horizonte", "Norte", "Ponto", "Viva", "Nexo", "Aurora", "Integra", "Prisma", "Conecta", "Aliança", "Pleno", "Vértice", "Origem", "Soma", "Mosaico"]);
        const segmento = pick(["Tecnologia", "Varejo", "Consultoria", "Educação", "Saúde", "Logística", "Construção", "Alimentos", "Finanças", "Marketing"]);
        const estado = getState();
        return {
          nome, segmento, estado, cidade: pick(estado.cidades),
          endereco: pick(["Rua das Flores", "Avenida Brasil", "Rua das Acácias", "Avenida Central", "Rua do Comércio"]),
          numero: String(randomInt(10, 1999)), bairro: pick(["Centro", "Jardim América", "Vila Nova", "Bela Vista", "Jardim Paulista"]),
          cep: `${digits(5)}-${digits(3)}`
        };
      },
      fields: [
        ["Razão social", (ctx) => `${ctx.nome} ${pick(["Tecnologia", "Soluções", "Serviços", "Comércio", "Digital", "Inovação", "Negócios", "Logística"])} ${pick(["Ltda.", "S.A.", "e Participações Ltda.", " do Brasil Ltda."])}`],
        ["CNPJ", () => cnpj(getCnpjFormatted(), getCnpjAlphanumeric())],
        ["Inscrição Estadual", () => gerarInscricaoEstadual()], ["Data de abertura", () => gerarDataAbertura()],
        ["E-mail", () => gerarEmailEmpresa()], ["Site", (ctx) => gerarSite(ctx.nome)],
        ["Telefone", (ctx) => gerarTelefoneFixo(ctx.estado, ddds)], ["Segmento", (ctx) => ctx.segmento],
        ["CEP", (ctx) => ctx.cep], ["Endereço", (ctx) => ctx.endereco], ["Número", (ctx) => ctx.numero],
        ["Bairro", (ctx) => ctx.bairro], ["Cidade", (ctx) => ctx.cidade],
        ["Estado", (ctx) => `${ctx.estado.sigla} - ${ctx.estado.nome}`]
      ]
    }
  };
}

export function generateMappedValue(type, context, inputType = "", options = {}) {
  if (inputType === "checkbox") return Math.random() >= 0.35;
  if (inputType === "radio") return true;
  const data = createGeneratorData(options);
  const resolvedContext = context || data.person.context();
  const vehicle = options.vehicleContext ||
    pickVehicle(options.getVehicleCatalog ? options.getVehicleCatalog() : [], pick);
  const personValues = {
    name: `${resolvedContext.nome} ${resolvedContext.sobrenome}`,
    cpf: cpf(options.getCpfFormatted ? options.getCpfFormatted() : true),
    rg: gerarRG(),
    email: gerarEmailPessoa(resolvedContext.nome, resolvedContext.sobrenome),
    phone: gerarTelefoneCelular(resolvedContext.estado, options.ddds || []),
    birthDate: `${pad(randomInt(1, 28))}/${pad(randomInt(1, 12))}/${randomInt(1970, 2003)}`,
    gender: pick(["Feminino", "Masculino"]), mother: resolvedContext.mae, father: resolvedContext.pai,
    cep: resolvedContext.cep, address: resolvedContext.endereco, number: resolvedContext.numero,
    neighborhood: resolvedContext.bairro, city: resolvedContext.cidade,
    state: `${resolvedContext.estado.sigla} - ${resolvedContext.estado.nome}`,
    profession: pick(["Analista de QA", "Desenvolvedor(a)", "Designer", "Gerente de projetos", "Contador(a)", "Professor(a)", "Engenheiro(a)"]),
    income: `R$ ${randomInt(1800, 18000).toLocaleString("pt-BR")},00`,
    company: `${pick(["Horizonte", "Norte", "Ponto", "Viva", "Nexo", "Aurora", "Integra", "Prisma", "Conecta", "Aliança", "Pleno", "Vértice"])} Tecnologia Ltda.`,
    cnpj: cnpj(options.getCnpjFormatted ? options.getCnpjFormatted() : true, options.getCnpjAlphanumeric ? options.getCnpjAlphanumeric() : false),
    brand: vehicle.marca, model: vehicle.modelo, year: gerarAno(),
    plate: gerarPlaca(), chassi: gerarChassi(),
    website: gerarSite(pick(["Horizonte", "Norte", "Ponto", "Viva", "Nexo", "Aurora", "Integra", "Prisma"])), text: randomWord()
  };
  return personValues[type] || personValues.text;
}
