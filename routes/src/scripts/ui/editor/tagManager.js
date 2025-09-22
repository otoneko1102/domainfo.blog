export const initializeTagManager = (initialTags = []) => {
  const tagsListDiv = document.getElementById("tags-list");
  const tagInput = document.getElementById("tag-input");
  const addTagBtn = document.getElementById("add-tag-btn");

  // 親コンポーネントでタグの状態を管理
  let currentTags = [...initialTags];

  const renderTags = () => {
    tagsListDiv.innerHTML = currentTags
      .map(
        (tag, index) =>
          `<div class="tag-item"><span>${tag}</span><button class="delete-tag-btn" data-index="${index}">×</button></div>`,
      )
      .join("");

    // 削除ボタンにイベントを再設定
    document.querySelectorAll(".delete-tag-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentTags.splice(btn.dataset.index, 1);
        renderTags(); // UIを更新
      });
    });
  };

  const addNewTag = () => {
    const newTag = tagInput.value.trim();
    if (newTag && !currentTags.includes(newTag)) {
      currentTags.push(newTag);
      tagInput.value = "";
      renderTags();
    }
  };

  addTagBtn.addEventListener("click", addNewTag);
  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addNewTag();
    }
  });

  renderTags(); // 初期描画

  // 現在のタグ配列を返すゲッター
  return {
    getTags: () => currentTags,
  };
};
