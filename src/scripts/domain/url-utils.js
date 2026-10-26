export function normalizePageUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch (error) {
    return url;
  }
}

export function getBaseUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const labels = hostname.split(".").filter(Boolean);
    let domain = hostname;
    if (labels.length >= 3 && labels.slice(-2).join(".") === "com.br") {
      domain = labels.slice(-3).join(".");
    } else if (labels.length >= 2 && labels[labels.length - 1] === "com") {
      domain = labels.slice(-2).join(".");
    }
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${domain}${port}`;
  } catch (error) {
    return "";
  }
}
