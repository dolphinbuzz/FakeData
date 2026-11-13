export function resolveFieldType(field) {
  return field.dataType === "auto" ? field.inferredType : field.dataType;
}

// generate: (type, inputType) => valor. Só é chamada quando o campo NÃO é fixo.
export function resolveFieldValue(field, generate) {
  return field.fixed ? field.fixedValue : generate(resolveFieldType(field), field.inputType);
}
