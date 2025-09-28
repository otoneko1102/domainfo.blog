import { getAuthBody, fetchWithAuth } from "../../auth.js";

const handleDeleteFile = async (id, filename) => {
  if (!confirm(`"${filename}" を削除しますか？`)) return;

  try {
    const response = await fetch(`/api/articles/${id}/files/${filename}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getAuthBody()),
    });
    const result = await response.json();
    if (response.ok) {
      alert(result.message);
      await renderImageGallery(id);
    } else {
      alert(`エラー: ${result.message}`);
    }
  } catch (err) {
    alert("ファイルの削除中にエラーが発生しました。");
  }
};

export const renderImageGallery = async (id) => {
  const gallery = document.getElementById("image-gallery");
  const editor = document.getElementById("editor");
  if (!gallery || !editor) return;

  const res = await fetchWithAuth(`/api/articles/${id}/files`);
  const files = await res.json();

  if (files.length === 0) {
    gallery.innerHTML = "<p>アップロードされたファイルはありません。</p>";
    return;
  }

  gallery.innerHTML = files
    .map((file) => {
      const filePath = `/files/${id}/${file.name}`;
      let thumbnailHtml = "";

      if (file.type === "application/pdf") {
        thumbnailHtml = `
        <div class="thumbnail pdf-thumbnail" data-filepath="${filePath}" data-filename="${file.name}" title="${file.name}">
          <span class="pdf-icon">PDF</span>
          <span class="pdf-name">${file.name}</span>
        </div>`;
      } else if (file.type.startsWith("video/")) {
        thumbnailHtml = `
        <div class="thumbnail" data-filepath="${filePath}" data-filename="${file.name}" title="${file.name}">
          <video data-src="${filePath}" src="" autoplay muted loop playsinline preload="metadata"></video>
        </div>`;
      } else if (file.type.startsWith("image/")) {
        thumbnailHtml = `
        <div class="thumbnail" data-filepath="${filePath}" data-filename="${file.name}" title="${file.name}">
          <img data-src="${filePath}" src="" alt="${file.name}" />
        </div>`;
      } else if (file.type.startsWith("audio/")) {
        thumbnailHtml = `
        <div class="thumbnail audio-thumbnail" data-filepath="${filePath}" data-filename="${file.name}" title="クリックしてMarkdownを挿入">
          <span class="audio-icon music-icon"></span>
          <span class="audio-name">${file.name}</span>
        </div>`;
      } else {
        thumbnailHtml = `
        <div class="thumbnail other-thumbnail" data-filepath="${filePath}" data-filename="${file.name}" title="${file.name}">
          <span>${file.name}</span>
        </div>`;
      }

      return `${thumbnailHtml.replace("</div>", `<button class="delete-btn" data-filename="${file.name}" title="削除する">×</button></div>`)}`;
    })
    .join("");

  gallery.querySelectorAll(".thumbnail").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (e.target.classList.contains("delete-btn")) return;

      e.preventDefault();
      const filename = item.dataset.filename;
      const filepath = item.dataset.filepath;
      const markdownToInsert = `\n![${filename}](${filepath})\n`;

      const currentPos = editor.selectionStart;
      editor.value =
        editor.value.slice(0, currentPos) +
        markdownToInsert +
        editor.value.slice(currentPos);
      editor.focus();
      editor.selectionEnd = currentPos + markdownToInsert.length;

      editor.dispatchEvent(new Event("input"));
    });
  });

  gallery.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDeleteFile(id, e.target.dataset.filename);
    });
  });
};

export const initializeUploader = (id) => {
  const uploadBtn = document.getElementById("upload-btn");
  const fileInput = document.getElementById("file-input");
  const filenameInput = document.getElementById("filename-input");

  uploadBtn?.addEventListener("click", async () => {
    if (!fileInput.files[0]) {
      alert("ファイルを選択してください。");
      return;
    }
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("filename", filenameInput.value);
    formData.append(
      "password",
      localStorage.getItem("adminPassword") ||
        sessionStorage.getItem("adminPassword"),
    );

    const originalText = uploadBtn.textContent;

    try {
      uploadBtn.disabled = true;
      uploadBtn.textContent = "アップロード中...";
      const response = await fetch(`/api/articles/${id}/files`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (response.ok) {
        alert(result.message);
        fileInput.value = "";
        filenameInput.value = "";
        await renderImageGallery(id);
      } else {
        alert(`エラー: ${result.message}`);
      }
    } catch (err) {
      alert("アップロードに失敗しました。");
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = originalText;
    }
  });
};
