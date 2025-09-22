import { contentArea, setState } from "../../state.js";
import { parseMarkdown } from "../../utils/markdown.js";
import { syncPaneHeights } from "../../utils/helpers.js";
import { renderImageGallery, initializeUploader } from "./fileManager.js";
import { initializeTagManager } from "./tagManager.js";
import { initializeCoreEditorEvents } from "./editorEvents.js";

export const renderEditorView = async (id) => {
  // 1. 骨格となるHTMLを先に描画
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
      <button id="editor-menu-close-btn" class="icon-btn" title="閉じる"><span class="icon close-icon"></span></button>
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
        <div class="tag-input-group"><input type="text" id="tag-input" placeholder="新しいタグを追加" /><button id="add-tag-btn" class="button">+</button></div>
      </div>
      <div class="upload-container">
        <h4>ファイル管理</h4>
        <input type="file" id="file-input" />
        <input type="text" id="filename-input" placeholder="保存ファイル名 (拡張子不要)" />
        <button id="upload-btn" class="button">アップロード</button>
      </div>
      <div id="image-gallery" class="image-gallery"><p>画像を読み込み中...</p></div>
    </div>`;

  // 2. 記事データをAPIから取得
  try {
    const response = await fetch(`/api/articles/${id}`);
    if (!response.ok) throw new Error("記事の読み込みに失敗しました。");
    const articleData = await response.json();

    // 3. 取得したデータでUIを更新
    document.getElementById("edit").innerHTML =
      `<textarea id="editor">${articleData.content || ""}</textarea>`;
    const view = document.getElementById("view");
    const editor = document.getElementById("editor");
    view.innerHTML = parseMarkdown(articleData.content || "");

    // 4. 各機能モジュールを初期化
    initializeUploader(id);
    const tagManager = initializeTagManager(articleData.tags);
    initializeCoreEditorEvents(id, articleData, tagManager.getTags);
    await renderImageGallery(id);

    // 5. エディタ固有のイベントリスナーを設定
    editor.addEventListener("input", () => {
      view.innerHTML = parseMarkdown(editor.value);
      if (window.initializeXpdfViewers) window.initializeXpdfViewers();
      syncPaneHeights();
      setState({ hasUnsavedChanges: true });
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

    // 6. 最終的なUI調整
    document.getElementById("editor-menu-open-btn").classList.remove("hidden");
    syncPaneHeights();
  } catch (error) {
    contentArea.innerHTML = `<p>${error.message}</p>`;
  }
};
