import { checkAuth } from "../../auth.js";

// 認証状態に応じて管理画面へのリンクを表示/非表示
export const updateGlobalUI = async () => {
  const adminLinkContainer = document.getElementById("admin-link-container");
  if (adminLinkContainer) {
    const authenticated = await checkAuth();
    adminLinkContainer.innerHTML = authenticated
      ? `<a href="/a">管理画面</a>`
      : "";
  }
};
