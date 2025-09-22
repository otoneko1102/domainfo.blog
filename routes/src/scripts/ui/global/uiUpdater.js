import { checkAuth } from "../../auth.js";

export const updateGlobalUI = async () => {
  const adminLinkContainer = document.getElementById("admin-link-container");
  if (adminLinkContainer) {
    const authenticated = await checkAuth();
    adminLinkContainer.innerHTML = authenticated
      ? `<a href="/a">管理画面</a>`
      : "";
  }
};
