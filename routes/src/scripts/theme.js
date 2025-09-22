(function () {
  const { isStrictSecurity } = window.APP_CONFIG;
  const dataStorage = isStrictSecurity ? sessionStorage : localStorage;

  const theme = dataStorage.getItem("theme");
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = theme || (prefersDark ? "dark" : "light");

  document.documentElement.setAttribute("data-theme", initialTheme);
})();
