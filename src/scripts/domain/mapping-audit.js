export function getMappingAudit(fields) {
  const locators = new Set();
  return fields.map((field) => {
    const duplicateLocator = field.locatorName && locators.has(field.locatorName);
    if (field.locatorName) locators.add(field.locatorName);
    return {
      elemento: field.label,
      seletorGerado: field.selector,
      locator: field.locatorName || "",
      regraAplicada: field.selectorRule || "desconhecida",
      status: field.selectorStatus === "stable" && !duplicateLocator ? "estável" : "frágil — requer atenção manual",
      sugestao: duplicateLocator ? "Renomear o locator para eliminar a colisão." : (field.selectorSuggestion || "")
    };
  });
}

export function auditJson(fields) {
  return JSON.stringify(Object.fromEntries(fields
    .filter((field) => field.selector && field.locatorName)
    .map((field) => [field.locatorName, field.selector])), null, 2);
}
