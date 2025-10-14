import { contentArea, state, setState } from "./state.js";
import { checkAuth, showLoginModal } from "./auth.js";
import { renderArticleList, renderPublicView } from "./ui/articles/main.js";
import { renderEditorView } from "./ui/editor/main.js";
import { updateGlobalUI } from "./ui/global/main.js";
import { renderCreditsView } from "./ui/global/credits.js";
import {
  renderTeapotView,
  renderNotFoundView,
} from "./ui/global/errorViews.js";

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

const handlePublicRoutes = async (path, status) => {
  const urlParams = new URLSearchParams(window.location.search);
  const page = parseInt(urlParams.get("page"), 10) || 1;
  if (path === "/") {
    await renderArticleList("public", page);
  } else if (path.startsWith("/b/")) {
    const id = path.split("/")[2];
    await renderPublicView(id);
  } else if (path === "/credits") {
    await renderCreditsView();
  } else if (status == 418) {
    await renderTeapotView();
  } else if (status == 404) {
    await renderNotFoundView();
  }
};

const router = async () => {
  if (state.keydownHandler) {
    window.removeEventListener("keydown", state.keydownHandler);
    setState({ keydownHandler: null });
  }
  if (state.beforeUnloadHandler) {
    window.removeEventListener("beforeunload", state.beforeUnloadHandler);
    setState({ beforeUnloadHandler: null });
  }

  const path = window.location.pathname;
  const pathParts = path.split("/").filter((p) => p);
  const loginModal = document.getElementById("login-modal");

  document.getElementById("editor-menu-open-btn").classList.add("hidden");
  document.getElementById("editor-menu-container").classList.remove("is-open");
  document.getElementById("editor-menu-overlay").classList.add("hidden");
  contentArea.innerHTML = "";

  if (pathParts[0] === "a") {
    const authenticated = await checkAuth();
    if (authenticated) {
      if (loginModal) loginModal.classList.add("hidden");
      await handleAdminRoutes(path);
    } else {
      showLoginModal();
    }
  } else {
    if (loginModal) loginModal.classList.add("hidden");
    const res = await fetch(window.location.href, { method: "HEAD" });
    await handlePublicRoutes(path, res.status);
  }

  updateGlobalUI();
};

export default router;
