const themeToggle = document.querySelector("#theme-toggle");

function applyTheme(theme) {
  const selectedTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = selectedTheme;

  const isLight = selectedTheme === "light";
  themeToggle.innerHTML = `<span aria-hidden="true">${isLight ? "☀" : "☾"}</span>`;
  themeToggle.setAttribute("aria-label", isLight ? "Ativar tema escuro" : "Ativar tema claro");
  themeToggle.title = isLight ? "Ativar tema escuro" : "Ativar tema claro";
}

const savedTheme = localStorage.getItem("fakedata-theme") || "dark";
applyTheme(savedTheme);

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  localStorage.setItem("fakedata-theme", nextTheme);
  applyTheme(nextTheme);
});
