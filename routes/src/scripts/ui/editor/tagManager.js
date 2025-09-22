export const initializeTagManager = (initialTags = []) => {
  const tagsListDiv = document.getElementById("tags-list");
  const tagInput = document.getElementById("tag-input");
  const addTagBtn = document.getElementById("add-tag-btn");

  let currentTags = [...initialTags];

  const renderTags = () => {
    tagsListDiv.innerHTML = currentTags
      .map(
        (tag, index) =>
          `<div class="tag-item"><span>${tag}</span><button class="delete-tag-btn" data-index="${index}">×</button></div>`,
      )
      .join("");

    document.querySelectorAll(".delete-tag-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentTags.splice(btn.dataset.index, 1);
        renderTags();
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

  renderTags();

  return {
    getTags: () => currentTags,
  };
};
