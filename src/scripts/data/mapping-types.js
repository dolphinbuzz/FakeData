const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

export const MAPPING_TYPES = [
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
  ["brand", "Marca"],
  ["model", "Modelo"],
  ["year", "Ano"],
  ["plate", "Placa"],
  ["chassi", "Chassi"],
  ["renavam", "Renavam"],
  ["website", "Site / URL"],
  ["checkbox", "Checkbox"],
  ["radio", "Radio"],
  ["text", "Texto"]
].sort(([, firstLabel], [, secondLabel]) => collator.compare(firstLabel, secondLabel));

function normalizeSearchTerm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function filterMappingTypes(query) {
  const searchTerm = normalizeSearchTerm(query).trim();
  if (!searchTerm) return MAPPING_TYPES;

  return MAPPING_TYPES.filter(([value, label]) =>
    normalizeSearchTerm(`${label} ${value}`).includes(searchTerm)
  );
}
