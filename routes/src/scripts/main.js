import "xpdf-viewer";
import router from "./router.js";
import { initializeGlobalEventListeners } from "./ui/global/main.js";
import {
  isStrictSecurity,
  dataStorage,
  contentArea,
  state,
  setState,
} from "./state.js";

// テーマ
(function () {
  const theme = dataStorage.getItem("theme");
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = theme || (prefersDark ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", initialTheme);
})();

// popstateイベント（ブラウザの戻る/進む）でルーターを実行
window.addEventListener("popstate", router);

// DOMが読み込まれたら、グローバルなイベントリスナーを設定し、ルーターを初回実行
document.addEventListener("DOMContentLoaded", () => {
  initializeGlobalEventListeners();
  router();
});
