import { dataStorage, setState, state } from "../../state.js";
import router from "../../router.js";
import { handleLogin } from "../../auth.js";

const copyToClipboard = (button, text, originalTitle) => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const icon = button.querySelector(".icon");
      if (!icon) return;
      const originalIconClass = icon.className;

      button.title = "コピーしました！";
      icon.className = "icon check-icon";

      setTimeout(() => {
        icon.className = originalIconClass;
        button.title = originalTitle;
      }, 1500);
    })
    .catch((err) => {
      console.error("コピーに失敗しました: ", err);
      alert("コピーに失敗しました。");
    });
};

export const initializeGlobalEventListeners = () => {
  document.getElementById("theme-toggle-btn")?.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    dataStorage.setItem("theme", newTheme);
  });

  const menuContainer = document.getElementById("editor-menu-container");
  const menuOpenBtn = document.getElementById("editor-menu-open-btn");
  const menuOverlay = document.getElementById("editor-menu-overlay");
  if (menuContainer && menuOpenBtn && menuOverlay) {
    const closeMenu = () => {
      menuContainer.classList.remove("is-open");
      menuOverlay.classList.add("hidden");
    };
    menuOpenBtn.addEventListener("click", () => {
      menuContainer.classList.add("is-open");
      menuOverlay.classList.remove("hidden");
    });
    menuOverlay.addEventListener("click", closeMenu);
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuContainer.classList.contains("is-open")) {
        closeMenu();
      }
    });
  }

  document.body.addEventListener("click", (e) => {
    const anchor = e.target.closest("a");
    if (
      anchor &&
      anchor.target !== "_blank" &&
      anchor.href.startsWith(window.location.origin)
    ) {
      e.preventDefault();
      if (
        state.hasUnsavedChanges &&
        !confirm(
          "編集中の内容が保存されていません。ページを離れてもよろしいですか？",
        )
      ) {
        return;
      }
      setState({ hasUnsavedChanges: false });
      history.pushState(null, "", anchor.href);
      router();
    }
  });

  document
    .getElementById("login-button")
    ?.addEventListener("click", handleLogin);
  document
    .getElementById("password-input")
    ?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleLogin();
    });

  const currentYearSpan = document.getElementById("current-year");
  if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();

  document
    .getElementById("copy-url-btn")
    ?.addEventListener("click", (e) =>
      copyToClipboard(
        e.currentTarget,
        window.location.href,
        "現在のURLをコピー",
      ),
    );

  document
    .getElementById("copy-feed-btn")
    ?.addEventListener("click", (e) =>
      copyToClipboard(
        e.currentTarget,
        `${window.location.origin}/feed`,
        "RSS FeedのURLをコピー",
      ),
    );

  document
    .getElementById("clear-storage-btn")
    ?.addEventListener("click", () => {
      if (
        !confirm(
          "ログイン情報を除くすべてのサイト設定（テーマなど）をリセットします。よろしいですか？",
        )
      ) {
        return;
      }

      const adminPassword = dataStorage.getItem("adminPassword");

      localStorage.clear();
      sessionStorage.clear();

      if (adminPassword) {
        dataStorage.setItem("adminPassword", adminPassword);
      }

      alert("サイトデータをリセットしました。");
      location.reload();
    });
};
