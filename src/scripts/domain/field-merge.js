// Atenção: `remapping` pode chegar como objeto truthy (ver achado A1). Não converter nem "corrigir".
export function mergeScannedFields({ scanned, saved, previous, remapping, preserveCurrent }) {
  let merged = scanned.map((field) => {
    const mapping = previous.find((item) => item.key === field.key || item.selector === field.selector) ||
      saved.find((item) => item.key === field.key || item.selector === field.selector);
    return {
      ...field,
      dataType: mapping && mapping.dataType ? mapping.dataType : field.inferredType || "text",
      selector: remapping ? field.selector : (mapping && mapping.selector ? mapping.selector : field.selector),
      label: mapping && mapping.label ? mapping.label : field.label,
      fixed: Boolean(mapping && mapping.fixed),
      fixedValue: mapping && mapping.fixedValue != null ? mapping.fixedValue : ""
    };
  });
  if (preserveCurrent) {
    const scannedKeys = new Set(merged.map((field) => field.key));
    merged = merged.concat(previous.filter((field) => !scannedKeys.has(field.key)));
  }
  return merged;
}
