import "xpdf-viewer";
import "../styles/utils/prism.css";
import "katex/dist/katex.min.css";
import router from "./router.js";
import { initializeGlobalEventListeners } from "./ui/global/main.js";

window.addEventListener("popstate", router);

document.addEventListener("DOMContentLoaded", () => {
  initializeGlobalEventListeners();
  router().then(() => {
    document.body.classList.add("loaded");
  });
});
