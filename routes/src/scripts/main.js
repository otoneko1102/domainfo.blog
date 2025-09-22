import "xpdf-viewer";
import router from "./router.js";
import { initializeGlobalEventListeners } from "./ui/global/main.js";
import { state, setState } from "./state.js";

// popstateイベント（ブラウザの戻る/進む）でルーターを実行
window.addEventListener("popstate", router);

// DOMが読み込まれたら、グローバルなイベントリスナーを設定し、ルーターを初回実行
document.addEventListener("DOMContentLoaded", () => {
  initializeGlobalEventListeners();
  router();
});
