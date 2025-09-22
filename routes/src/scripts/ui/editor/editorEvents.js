import { state, setState } from "../../state.js";
import { getAuthBody } from "../../auth.js";
import router from "../../router.js";

const handleSettings = async (oldId, oldTitle) => {
  const newId = prompt("新しい記事IDを入力してください:", oldId);
  if (!newId || !/^[a-z0-9-]+$/.test(newId)) {
    if (newId !== null) alert("無効なIDです。");
    return;
  }
  const newTitle = prompt("新しい記事タイトルを入力してください:", oldTitle);
  if (!newTitle) return;

  try {
    const response = await fetch(`/api/articles/${oldId}/metadata`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getAuthBody({ newId, newTitle })),
    });
    const result = await response.json();
    if (response.ok) {
      alert(result.message);
      history.pushState(null, "", `/a/${result.newId}`);
      router();
    } else {
      alert(`エラー: ${result.message}`);
    }
  } catch (err) {
    alert("通信エラーが発生しました。");
  }
};

export const initializeCoreEditorEvents = (id, articleData, getTags) => {
  const actionsDiv = document.querySelector(".editor-actions");
  let currentArticle = { ...articleData };

  const updateButtons = () => {
    const publicButtonText = currentArticle.public
      ? "非公開にする"
      : "公開する";
    actionsDiv.innerHTML = `
      <button id="save-btn" class="button">保存</button>
      <button id="settings-btn" class="button">記事設定</button>
      <button id="toggle-public-btn" class="button ${currentArticle.public ? "public" : "private"}">
        ${publicButtonText}
      </button>
    `;

    document.getElementById("save-btn").addEventListener("click", async (e) => {
      if (state.isSaving) return;
      setState({ isSaving: true });
      const button = e.currentTarget;
      const originalText = button.textContent;
      button.textContent = "保存中...";

      const editor = document.getElementById("editor");
      const content = editor.value;
      const tags = getTags();

      try {
        await fetch(`/api/articles/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(getAuthBody({ content, tags })),
        });
        setState({ hasUnsavedChanges: false });
        alert("保存しました！");
      } catch (err) {
        alert("保存に失敗しました。");
      } finally {
        setState({ isSaving: false });
        button.textContent = originalText;
      }
    });

    document
      .getElementById("toggle-public-btn")
      .addEventListener("click", async () => {
        const newStatus = !currentArticle.public;
        const response = await fetch(`/api/articles/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(getAuthBody({ public: newStatus })),
        });
        if (response.ok) {
          currentArticle = await response.json();
          updateButtons();
        }
      });

    document
      .getElementById("settings-btn")
      .addEventListener("click", () =>
        handleSettings(id, currentArticle.title),
      );
  };

  const keydownHandler = (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      document.getElementById("save-btn")?.click();
    }
  };
  window.addEventListener("keydown", keydownHandler);
  setState({ keydownHandler });

  updateButtons();
};
