import { contentArea, state, setState } from "../../state.js";
import { fetchWithAuth } from "../../auth.js";
import { parseMarkdown } from "../../utils/markdown.js";
import { syncPaneHeights } from "../../utils/helpers.js";
import { renderNotFoundView } from "../global/errorViews.js";
import { renderImageGallery, initializeUploader } from "./fileManager.js";
import { initializeTagManager } from "./tagManager.js";
import { initializeCoreEditorEvents } from "./editorEvents.js";
import Prism from "prismjs";

export const renderEditorView = async (id) => {
  contentArea.innerHTML = `
    <a href="/a" class="back-to-list-link">&larr; 記事一覧に戻る</a>
    <div class="editor-main-container">
      <div class="flex">
        <div id="edit" class="editor-pane"><p>記事を読み込み中...</p></div>
        <div id="view" class="editor-pane"></div>
      </div>
    </div>`;

  const menuContainer = document.getElementById("editor-menu-container");
  menuContainer.innerHTML = `
    <div class="editor-menu-header">
      <h3>設定とファイル</h3>
      <button id="editor-menu-close-btn" class="icon-btn" title="閉じる">
        <span class="icon close-icon"></span>
      </button>
    </div>
    <div class="editor-menu-content">
      <div class="view-toggle">
        <button id="show-editor-btn" class="button view-toggle-btn active">編集</button>
        <button id="show-preview-btn" class="button view-toggle-btn">プレビュー</button>
      </div>
      <div class="editor-actions"></div>
      <div class="tags-container">
        <h4>タグ編集</h4>
        <div id="tags-list"></div>
        <div class="tag-input-group">
          <input type="text" id="tag-input" placeholder="新しいタグを追加" />
          <button id="add-tag-btn" class="button">+</button>
        </div>
      </div>
      <div class="upload-container">
        <h4>ファイル管理</h4>
        <div class="file-input-wrapper">
          <input type="file" id="file-input" class="file-input-hidden" />
          <label for="file-input" class="button">ファイルを選択</label>
          <span id="file-name-display">選択されていません</span>
        </div>
        <input type="text" id="filename-input" placeholder="保存ファイル名 (拡張子不要)" autocomplete="off" />
        <button id="upload-btn" class="button">アップロード</button>
      </div>
      <h4>クリックして挿入</h4>
      <div id="image-gallery" class="image-gallery">
        <p>画像を読み込み中...</p>
      </div>
    </div>`;

  try {
    const response = await fetchWithAuth(`/api/articles/${id}`);
    if (!response.ok) {
      return await renderNotFoundView("記事の読み込みに失敗しました。");
    }
    const { content, meta: articleData } = await response.json();

    document.getElementById("edit").innerHTML =
      `<textarea id="editor">${content || ""}</textarea>`;
    const view = document.getElementById("view");
    const editor = document.getElementById("editor");
    view.innerHTML = await parseMarkdown(content || "");
    Prism.highlightAll();

    initializeUploader(id);
    const tagManager = initializeTagManager(articleData.tags);
    initializeCoreEditorEvents(id, articleData, tagManager.getTags);
    await renderImageGallery(id);

    editor.addEventListener("input", async () => {
      view.innerHTML = await parseMarkdown(editor.value);
      if (window.initializeXpdfViewers) {
        setTimeout(() => window.initializeXpdfViewers(), 0);
      }
      syncPaneHeights();
      setState({ hasUnsavedChanges: true });
      Prism.highlightAll();
    });

    const beforeUnloadHandler = (e) => {
      if (state.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);
    setState({ beforeUnloadHandler });

    document
      .getElementById("editor-menu-close-btn")
      ?.addEventListener("click", () => {
        menuContainer.classList.remove("is-open");
        document.getElementById("editor-menu-overlay").classList.add("hidden");
      });

    const flexContainer = document.querySelector(".flex");
    document
      .getElementById("show-editor-btn")
      ?.addEventListener("click", (e) => {
        flexContainer.classList.remove("show-preview");
        e.currentTarget.classList.add("active");
        document.getElementById("show-preview-btn").classList.remove("active");
      });
    document
      .getElementById("show-preview-btn")
      ?.addEventListener("click", (e) => {
        flexContainer.classList.add("show-preview");
        e.currentTarget.classList.add("active");
        document.getElementById("show-editor-btn").classList.remove("active");
      });

    document.getElementById("editor-menu-open-btn").classList.remove("hidden");
    syncPaneHeights();

    if (window.initializeXpdfViewers) {
      setTimeout(() => window.initializeXpdfViewers(), 0);
    }
  } catch (err) {
    contentArea.innerHTML = `<p>${err.message}</p>`;
  }
};
