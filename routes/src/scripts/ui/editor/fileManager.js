import { getAuthBody } from "../../auth.js";

// ファイル削除処理
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
      await renderImageGallery(id); // ギャラリーを再描画
    } else {
      alert(`エラー: ${result.message}`);
    }
  } catch (err) {
    alert("ファイルの削除中にエラーが発生しました。");
  }
};

// 画像ギャラリーを描画
export const renderImageGallery = async (id) => {
  const gallery = document.getElementById("image-gallery");
  const editor = document.getElementById("editor");
  if (!gallery || !editor) return;

  const res = await fetch(`/api/articles/${id}/files`);
  const files = await res.json();

  if (files.length === 0) {
    gallery.innerHTML = "<p>アップロードされたファイルはありません。</p>";
    return;
  }

  gallery.innerHTML = files
    .map((filename) => {
      const filePath = `/files/${id}/${filename}`;
      const isPdf = filename.toLowerCase().endsWith(".pdf");
      return `
      <div class="thumbnail ${isPdf ? "pdf-thumbnail" : ""}">
        ${
          isPdf
            ? `<a href="${filePath}" title="${filename}をクリックしてMarkdownを挿入" data-filepath="${filePath}">${filename}</a>`
            : `<img src="${filePath}" alt="${filename}" title="クリックしてMarkdownを挿入" data-filepath="${filePath}" />`
        }
        <button class="delete-btn" data-filename="${filename}" title="削除する">×</button>
      </div>`;
    })
    .join("");

  // サムネイルクリックでMarkdownを挿入
  gallery.querySelectorAll(".thumbnail img, .thumbnail a").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const markdownToInsert = `\n![${item.alt || item.textContent}](${item.dataset.filepath})\n`;
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

  // 削除ボタンのイベント
  gallery.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleDeleteFile(id, e.target.dataset.filename);
    });
  });
};

// ファイルアップロード機能の初期化
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
    // getAuthBodyはJSON用なので、FormData用にパスワードを直接追加
    formData.append(
      "password",
      localStorage.getItem("adminPassword") ||
        sessionStorage.getItem("adminPassword"),
    );

    try {
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
    }
  });
};
