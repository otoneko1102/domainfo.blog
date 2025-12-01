import { state, setState } from "../../state.js";
import { getAuthBody } from "../../auth.js";
import router from "../../router.js";

const handleSettings = async (oldId, oldTitle) => {
  const newId = prompt(
    "新しい記事IDを入力してください (小文字英数、ハイフン、アンダースコアのみ):",
    oldId,
  );
  if (!newId || !/^[a-z0-9-_]+$/.test(newId)) {
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
    const hiddenButtonText = currentArticle.hidden ? "表示する" : "非表示する";
    const pinnedButtonText = currentArticle.pinned
      ? "ピン止め解除"
      : "ピン止めする";
    const currentDate = currentArticle.createdAt
      ? new Date(currentArticle.createdAt).toISOString().split("T")[0]
      : "";
    actionsDiv.innerHTML = `
      <div class="buttons">
        <button id="save-btn" class="button">保存</button>
        <button id="settings-btn" class="button">記事設定</button>
        <div class="buttons-block">
          <button id="toggle-public-btn" class="button ${currentArticle.public ? "public" : "private"}">
            ${publicButtonText}
          </button>
          <br />
          <button id="toggle-hidden-btn" class="button ${currentArticle.hidden ? "hidden" : "visible"}">
            ${hiddenButtonText}
          </button>
          <br />
          <button id="toggle-pinned-btn" class="button ${currentArticle.pinned ? "pinned" : "unpinned"}">
            ${pinnedButtonText}
          </button>
        </div>
      </div>
      <br />
      <div class="date-editor">
        <h4>投稿日を編集</h4>
        <input type="date" id="date-input" value="${currentDate}" />
        <button id="update-date-btn" class="button">更新</button>
      </div>
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
        const newPublicStatus = !currentArticle.public;
        const response = await fetch(`/api/articles/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(getAuthBody({ public: newPublicStatus })),
        });
        if (response.ok) {
          currentArticle = await response.json();
          updateButtons();
        } else {
          const result = await response.json();
          alert(`エラー: ${result.message}`);
        }
      });

    document
      .getElementById("toggle-hidden-btn")
      .addEventListener("click", async () => {
        const newHiddenStatus = !currentArticle.hidden;
        const response = await fetch(`/api/articles/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(getAuthBody({ hidden: newHiddenStatus })),
        });
        if (response.ok) {
          currentArticle = await response.json();
          updateButtons();
        } else {
          const result = await response.json();
          alert(`エラー: ${result.message}`);
        }
      });

    document
      .getElementById("toggle-pinned-btn")
      .addEventListener("click", async () => {
        const newPinnedStatus = !currentArticle.pinned;
        const response = await fetch(`/api/articles/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(getAuthBody({ pinned: newPinnedStatus })),
        });
        if (response.ok) {
          currentArticle = await response.json();
          updateButtons();
        } else {
          const result = await response.json();
          alert(`エラー: ${result.message}`);
        }
      });

    document
      .getElementById("update-date-btn")
      .addEventListener("click", async () => {
        const newDate = document.getElementById("date-input").value;
        if (!newDate) {
          alert("日付を選択してください。");
          return;
        }
        const confirmed = confirm(`投稿日を ${newDate} に変更しますか？`);
        if (!confirmed) return;

        try {
          const response = await fetch(`/api/articles/${id}/date`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(getAuthBody({ createdAt: newDate })),
          });

          if (response.ok) {
            currentArticle = await response.json();
            alert("投稿日を更新しました。");
            updateButtons();
          } else {
            const result = await response.json();
            alert(`エラー: ${result.message}`);
          }
        } catch (err) {
          alert("失敗しました。");
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
