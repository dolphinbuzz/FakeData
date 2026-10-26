// Sufixos de segundo nível conhecidos: o host mantém 3 labels nesses casos
// (`qa.app.org.br` -> `app.org.br`). Fora da lista, mantém apenas 2 labels.
const KNOWN_SECOND_LEVEL_SUFFIXES = new Set([
  "com.br",
  "org.br",
  "net.br",
  "edu.br",
  "gov.br",
  "mil.br",
  "art.br",
  "blog.br",
  "dev.br",
  "app.br",
  "co.uk",
  "org.uk",
  "ac.uk",
  "com.au",
  "net.au",
  "co.jp",
  "co.kr",
]);

// TLDs reservados para documentação/testes (RFC 2606/6761). Não são domínios
// públicos, então o host é devolvido como está — inclusive `*.example.test`,
// usado como base distinta nas fixtures de teste.
const RESERVED_SUFFIXES = new Set(["test", "example", "invalid", "localhost"]);

// IPv4 literal: não é um domínio, então o host é devolvido sem colapso.
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function isIpLiteral(hostname) {
  // IPv6 vem do parser entre colchetes (`[::1]`, `[::ffff:192.168.0.1]`).
  return IPV4_PATTERN.test(hostname) || hostname.startsWith("[");
}

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
    const topLevel = labels[labels.length - 1];
    let domain = hostname;
    if (labels.length >= 3 && !isIpLiteral(hostname) && !RESERVED_SUFFIXES.has(topLevel)) {
      const lastTwoLabels = labels.slice(-2).join(".");
      domain = KNOWN_SECOND_LEVEL_SUFFIXES.has(lastTwoLabels)
        ? labels.slice(-3).join(".")
        : lastTwoLabels;
    }
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${domain}${port}`;
  } catch (error) {
    return "";
  }
}
