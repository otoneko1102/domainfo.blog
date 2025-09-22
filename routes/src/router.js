import { contentArea, state, setState } from "./state.js";
import { checkAuth, showLoginModal } from "./auth.js";
import { renderArticleList, renderPublicView } from "./ui/articles/main.js";
import { renderEditorView } from "./ui/editor/main.js";
import { updateGlobalUI } from "./ui/global/main.js";

const handleAdminRoutes = async (path) => {
  const pathParts = path.split("/").filter((p) => p);
  const urlParams = new URLSearchParams(window.location.search);
  const page = parseInt(urlParams.get("page"), 10) || 1;
  if (pathParts.length === 1) {
    await renderArticleList("admin", page);
  } else if (pathParts.length === 2) {
    await renderEditorView(pathParts[1]);
  }
};

const handlePublicRoutes = async (path) => {
  const urlParams = new URLSearchParams(window.location.search);
  const page = parseInt(urlParams.get("page"), 10) || 1;
  if (path === "/") {
    await renderArticleList("public", page);
  } else if (path.startsWith("/b/")) {
    const id = path.split("/")[2];
    await renderPublicView(id);
  }
};

const router = async () => {
  // ページ遷移時に古いイベントリスナーを削除
  if (state.keydownHandler) {
    window.removeEventListener("keydown", state.keydownHandler);
    setState({ keydownHandler: null });
  }
  if (state.beforeUnloadHandler) {
    window.removeEventListener("beforeunload", state.beforeUnloadHandler);
    setState({ beforeUnloadHandler: null });
  }

  const path = window.location.pathname;
  const loginModal = document.getElementById("login-modal");

  // UIを初期状態にリセット
  document.getElementById("editor-menu-open-btn").classList.add("hidden");
  document.getElementById("editor-menu-container").classList.remove("is-open");
  document.getElementById("editor-menu-overlay").classList.add("hidden");
  contentArea.innerHTML = "";

  // 管理者ページ（/a/）へのアクセス制御
  if (path.startsWith("/a")) {
    const authenticated = await checkAuth();
    if (authenticated) {
      if (loginModal) loginModal.classList.add("hidden"); // モーダルを非表示に
      await handleAdminRoutes(path);
    } else {
      showLoginModal();
    }
  } else {
    if (loginModal) loginModal.classList.add("hidden");
    await handlePublicRoutes(path);
  }

  // 全ページ共通のUIを更新
  updateGlobalUI();
};

export default router;
