import { marked } from "marked";
import "xpdf-viewer";

// marked.setOptions({
//   breaks: true,
// });

const underlineExtension = {
  name: "underline",
  level: "inline",

  tokenizer(src) {
    const rule = /^__(.+?)__/;
    const match = rule.exec(src);

    if (match) {
      const text = match[1];
      return {
        type: "underline",
        raw: match[0],
        text: text,
        tokens: this.lexer.inlineTokens(text),
      };
    }
  },

  renderer(token) {
    return `<u>${this.parser.parseInline(token.tokens)}</u>`;
  },
};

marked.use({
  extensions: [underlineExtension],
  breaks: true,
});

const contentArea = document.getElementById("content-area");
let keydownHandler = null;
let isSaving = false;

let beforeUnloadHandler = null;
let hasUnsavedChanges = false;

const getAuthBody = (body = {}) => {
  const password = dataStorage.getItem("adminPassword");
  return { ...body, password };
};

const router = async () => {
  if (keydownHandler) {
    window.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
  }
  if (beforeUnloadHandler) {
    window.removeEventListener("beforeunload", beforeUnloadHandler);
    beforeUnloadHandler = null;
  }

  const path = window.location.pathname;
  const loginModal = document.getElementById("login-modal");

  document.getElementById("editor-menu-open-btn").classList.add("hidden");
  document.getElementById("editor-menu-container").classList.remove("is-open");
  document.getElementById("editor-menu-overlay").classList.add("hidden");

  contentArea.innerHTML = "";

  if (path.startsWith("/a")) {
    const authenticated = await checkAuth();
    if (authenticated) {
      if (loginModal) loginModal.remove();
      await handleAdminRoutes(path);
    } else {
      showLoginModal();
    }
  } else {
    if (loginModal) loginModal.remove();
    await handlePublicRoutes(path);
  }

  updateGlobalUI();
};

window.addEventListener("popstate", router);
document.addEventListener("DOMContentLoaded", () => {
  const themeToggleButton = document.getElementById("theme-toggle-btn");
  if (themeToggleButton) {
    themeToggleButton.addEventListener("click", () => {
      const currentTheme = document.documentElement.getAttribute("data-theme");
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", newTheme);
      dataStorage.setItem("theme", newTheme);
    });
  }

  const menuContainer = document.getElementById("editor-menu-container");
  const menuOpenBtn = document.getElementById("editor-menu-open-btn");
  const menuOverlay = document.getElementById("editor-menu-overlay");
  const openMenu = () => {
    menuContainer.classList.add("is-open");
    menuOverlay.classList.remove("hidden");
  };
  const closeMenu = () => {
    menuContainer.classList.remove("is-open");
    menuOverlay.classList.add("hidden");
  };
  menuOpenBtn.addEventListener("click", openMenu);
  menuOverlay.addEventListener("click", closeMenu);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuContainer.classList.contains("is-open")) {
      closeMenu();
    }
  });

  document.body.addEventListener("click", (e) => {
    const anchor = e.target.closest("a");
    if (
      anchor &&
      !anchor.classList.contains("page-link") &&
      anchor.href.startsWith(window.location.origin)
    ) {
      e.preventDefault();

      if (hasUnsavedChanges) {
        if (
          !confirm(
            "編集中の内容が保存されていません。ページを離れてもよろしいですか？",
          )
        ) {
          return;
        }
        hasUnsavedChanges = false;
      }

      history.pushState(null, "", anchor.href);
      router();
    }
  });

  const loginButton = document.getElementById("login-button");
  if (loginButton) {
    loginButton.addEventListener("click", handleLogin);
  }

  const currentYearSpan = document.getElementById("current-year");
  if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
  }

  const copyUrlBtn = document.getElementById("copy-url-btn");
  if (copyUrlBtn) {
    copyUrlBtn.addEventListener("click", () => {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          const icon = copyUrlBtn.querySelector(".icon");
          if (!icon) return;
          const originalIconClass = icon.className;
          const originalTitle = copyUrlBtn.title;

          copyUrlBtn.title = "コピーしました！";
          icon.className = "icon check-icon";

          setTimeout(() => {
            icon.className = originalIconClass;
            copyUrlBtn.title = originalTitle;
          }, 1500);
        })
        .catch((err) => {
          console.error("URLのコピーに失敗しました: ", err);
          alert("URLのコピーに失敗しました。");
        });
    });
  }

  const copyFeedBtn = document.getElementById("copy-feed-btn");
  if (copyFeedBtn) {
    copyFeedBtn.addEventListener("click", () => {
      const feedUrl = `${window.location.origin}/feed`;
      navigator.clipboard
        .writeText(feedUrl)
        .then(() => {
          const icon = copyFeedBtn.querySelector(".icon");
          if (!icon) return;
          const originalIconClass = icon.className;
          const originalTitle = copyFeedBtn.title;

          copyFeedBtn.title = "コピーしました！";
          icon.className = "icon check-icon";

          setTimeout(() => {
            icon.className = originalIconClass;
            copyFeedBtn.title = originalTitle;
          }, 1500);
        })
        .catch((err) => {
          console.error("RSS Feed URLのコピーに失敗しました: ", err);
          alert("RSS Feed URLのコピーに失敗しました。");
        });
    });
  }

  router();
});

const checkAuth = async () => {
  const storedPassword = dataStorage.getItem("adminPassword");
  if (!storedPassword) return false;
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: storedPassword }),
    });
    return response.ok;
  } catch (err) {
    console.error("Login check failed:", err);
    return false;
  }
};
const showLoginModal = () => {
  const loginModal = document.getElementById("login-modal");
  if (loginModal) {
    loginModal.classList.remove("hidden");
  }
};
const handleLogin = async () => {
  const passwordInput = document.getElementById("password-input");
  const loginError = document.getElementById("login-error");
  const password = passwordInput.value;
  if (!password) return;
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (response.ok) {
    dataStorage.setItem("adminPassword", password);
    await router();
  } else {
    loginError.textContent = "パスワードが違います。";
    passwordInput.value = "";
  }
};

const handleAdminRoutes = async (path) => {
  const pathParts = path.split("/").filter((p) => p);
  const urlParams = new URLSearchParams(window.location.search);
  const page = parseInt(urlParams.get("page"), 10) || 1;
  if (pathParts.length === 1) {
    await renderArticleList("admin", page);
  } else if (pathParts.length === 2) {
    await renderEditorView(pathParts[1]);
  }
};
const handlePublicRoutes = async (path) => {
  const urlParams = new URLSearchParams(window.location.search);
  const page = parseInt(urlParams.get("page"), 10) || 1;
  if (path === "/") {
    await renderArticleList("public", page);
  } else if (path.startsWith("/b/")) {
    const id = path.split("/")[2];
    await renderPublicView(id);
  }
};

const parseMarkdown = (markdownText) => {
  const rawHtml = marked.parse(markdownText || "");
  // 外部リンク
  let processedHtml = rawHtml.replace(
    /<a href="http/g,
    '<a target="_blank" rel="noopener noreferrer" href="http',
  );
  // PDF
  processedHtml = processedHtml.replace(
    /<img src="([^"]+\.pdf)"[^>]*>/g,
    '<embed class="xpdf" data-pdf="$1" data-pdf-size="100%">',
  );
  return processedHtml;
};

const syncPaneHeights = () => {
  const editor = document.getElementById("editor");
  const view = document.getElementById("view");
  if (editor && view) {
    const viewHeight = view.scrollHeight;
    editor.style.minHeight = `${viewHeight}px`;
  }
};

const renderEditorView = async (id) => {
  document.getElementById("editor-menu-open-btn").classList.remove("hidden");
  contentArea.innerHTML = `
    <a href="/a" class="back-to-list-link">&larr; 記事一覧に戻る</a>
    <div class="editor-main-container">
      <div class="flex">
        <div id="edit" class="editor-pane"><p>記事を読み込み中...</p></div>
        <div id="view" class="editor-pane"></div>
      </div>
    </div>
  `;
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
        <div class="tag-input-group"><input type="text" id="tag-input" placeholder="新しいタグを追加" /><button id="add-tag-btn" class="button">+</button></div>
      </div>
      <div class="upload-container">
        <h4>ファイル管理</h4>
        <input type="file" id="file-input" />
        <input type="text" id="filename-input" placeholder="保存ファイル名 (拡張子不要)" />
        <button id="upload-btn" class="button">アップロード</button>
      </div>
      <div id="image-gallery" class="image-gallery"><p>画像を読み込み中...</p></div>
    </div>
  `;
  menuContainer
    .querySelector("#editor-menu-close-btn")
    .addEventListener("click", () => {
      menuContainer.classList.remove("is-open");
      document.getElementById("editor-menu-overlay").classList.add("hidden");
    });
  const response = await fetch(`/api/articles/${id}`);
  if (!response.ok) {
    contentArea.innerHTML = "<p>記事の読み込みに失敗しました。</p>";
    return;
  }
  const data = await response.json();
  const markdownContent = data.content;
  document.getElementById("edit").innerHTML =
    `<textarea id="editor">${markdownContent}</textarea>`;
  document.getElementById("view").innerHTML = parseMarkdown(markdownContent);

  if (window.initializeXpdfViewers) {
    window.initializeXpdfViewers();
  }

  await setupEditorEvents(id);
  await renderImageGallery(id);

  setTimeout(syncPaneHeights, 0);
};

const renderImageGallery = async (id) => {
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
      if (filename.toLowerCase().endsWith(".pdf")) {
        return `<div class="thumbnail pdf-thumbnail">
                  <a href="${filePath}" title="${filename}をクリックしてMarkdownを挿入" data-filepath="${filePath}">${filename}</a>
                  <button class="delete-btn" data-filename="${filename}" title="削除する">×</button>
                </div>`;
      }
      return `<div class="thumbnail">
                <img src="${filePath}" alt="${filename}" title="クリックしてMarkdownを挿入" data-filepath="${filePath}" />
                <button class="delete-btn" data-filename="${filename}" title="削除する">×</button>
              </div>`;
    })
    .join("");

  gallery.querySelectorAll(".thumbnail img, .thumbnail a").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (e.currentTarget.tagName === "A") {
        e.preventDefault();
      }
      const markdownToInsert = `\n![${item.alt || item.textContent}](${
        item.dataset.filepath
      })\n`;
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
      const filename = e.target.dataset.filename;
      handleDeleteFile(id, filename);
    });
  });
};

const renderPublicView = async (id) => {
  contentArea.innerHTML = "<p>読み込み中...</p>";
  const response = await fetch(`/api/articles/${id}`);
  if (!response.ok) {
    contentArea.innerHTML = "<p>記事の読み込みに失敗しました。</p>";
    return;
  }
  const data = await response.json();
  contentArea.innerHTML = `
      <a href="/" class="back-to-list-link">&larr; 記事一覧に戻る</a>
      <div class="view-public">${parseMarkdown(data.content)}</div>
    `;

  if (window.initializeXpdfViewers) {
    window.initializeXpdfViewers();
  }
};

const renderArticleList = async (mode, page = 1) => {
  let searchTerm = "";
  let sortKey = "createdAt";
  let sortOrder = "desc";
  const render = async (currentPage) => {
    const response = await fetch(
      `/api/articles?view=${mode}&q=${encodeURIComponent(
        searchTerm,
      )}&page=${currentPage}&sortKey=${sortKey}&sortOrder=${sortOrder}`,
    );
    const {
      articles,
      totalPages,
      currentPage: returnedPage,
    } = await response.json();
    let articlesHTML = "";
    if (articles.length === 0) {
      articlesHTML = "<p>該当する記事がありません。</p>";
    } else {
      articles.forEach((article) => {
        const link = mode === "admin" ? `/a/${article.id}` : `/b/${article.id}`;
        const createdAtDate = new Date(article.createdAt);
        const updatedAtDate = new Date(article.updatedAt);
        const formatDate = (date) =>
          date.toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        const createdDateStr = article.createdAt
          ? formatDate(createdAtDate)
          : "---";
        const updatedDateStr = article.updatedAt
          ? formatDate(updatedAtDate)
          : "---";
        const isUpdated =
          article.createdAt &&
          article.updatedAt &&
          createdAtDate.toDateString() !== updatedAtDate.toDateString();
        const tagsHTML =
          article.tags && article.tags.length > 0
            ? article.tags
                .map((tag) => `<span class="tag">${tag}</span>`)
                .join(" / ")
            : "";
        articlesHTML += `<div class="article-card"><div class="article-tags">${tagsHTML}</div><a href="${link}" class="article-title"><h2>${
          article.title
        }</h2></a><div class="article-meta"><div class="article-dates"><span>投稿日: ${
          article.createdAt
            ? `<time datetime="${article.createdAt}">${createdDateStr}</time>`
            : "<span>---</span>"
        }</span>${
          isUpdated
            ? `<span>最終更新日: <time datetime="${article.updatedAt}">${updatedDateStr}</time></span>`
            : ""
        }</div><div class="article-meta-right">${
          mode === "admin"
            ? `<span class="status ${article.public ? "public" : "private"}">${
                article.public ? "公開" : "非公開"
              }</span>`
            : ""
        }${
          mode === "admin"
            ? `<button class="article-delete-btn" data-id="${article.id}" data-title="${article.title}">削除</button>`
            : ""
        }</div></div></div>`;
      });
    }
    document.getElementById("articles-grid").innerHTML = articlesHTML;
    document.getElementById("pagination-container").innerHTML =
      renderPagination(mode, totalPages, returnedPage);
    setupEventListeners(returnedPage);
  };
  const setupEventListeners = (currentPage) => {
    const searchInput = document.getElementById("search-input");
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        searchTerm = e.target.value;
        render(1);
      }, 300);
    });

    const sortKeySelect = document.getElementById("sort-key");
    const sortOrderSelect = document.getElementById("sort-order");
    sortKeySelect.value = sortKey;
    sortOrderSelect.value = sortOrder;
    sortKeySelect.addEventListener("change", (e) => {
      sortKey = e.target.value;
      render(1);
    });
    sortOrderSelect.addEventListener("change", (e) => {
      sortOrder = e.target.value;
      render(1);
    });

    document.querySelectorAll(".page-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const pageToGo = parseInt(e.target.dataset.page, 10);
        if (pageToGo) {
          const newUrl = new URL(window.location);
          newUrl.searchParams.set("page", pageToGo);
          history.pushState({}, "", newUrl);
          render(pageToGo);
        }
      });
    });
    if (mode === "admin") {
      document
        .getElementById("new-article-btn")
        ?.addEventListener("click", handleNewArticle);
      document.querySelectorAll(".article-delete-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const { id, title } = btn.dataset;
          handleDeleteArticle(id, title);
        });
      });
    }
  };
  contentArea.innerHTML = `
    <div class="list-header">
      <h2>${mode === "admin" ? "記事管理" : "記事一覧"}</h2>
      <div class="sort-options">
        <select id="sort-key">
          <option value="createdAt">作成日</option>
          <option value="updatedAt">更新日</option>
          <option value="title">タイトル</option>
        </select>
        <select id="sort-order">
          <option value="desc">降順</option>
          <option value="asc">昇順</option>
        </select>
      </div>
    </div>
    ${
      mode === "admin"
        ? `<button id="new-article-btn" class="button">新規作成</button>`
        : ""
    }
    <div class="search-container">
      <input type="search" id="search-input" placeholder="記事名またはタグで検索...">
    </div>
    <div id="articles-grid"></div>
    <div id="pagination-container" class="pagination"></div>
  `;

  await render(page);
};
const renderPagination = (mode, totalPages, currentPage) => {
  if (totalPages <= 1) return "";
  const basePath = mode === "admin" ? "/a" : "/";
  let html = "";
  html +=
    currentPage > 1
      ? `<a href="${basePath}?page=${
          currentPage - 1
        }" class="page-link" data-page="${currentPage - 1}">&laquo; 前へ</a>`
      : `<span class="page-link disabled">&laquo; 前へ</span>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<a href="${basePath}?page=${i}" class="page-link ${
      i === currentPage ? "active" : ""
    }" data-page="${i}">${i}</a>`;
  }
  html +=
    currentPage < totalPages
      ? `<a href="${basePath}?page=${
          currentPage + 1
        }" class="page-link" data-page="${currentPage + 1}">次へ &raquo;</a>`
      : `<span class="page-link disabled">次へ &raquo;</span>`;
  return html;
};

const setupEditorEvents = async (id) => {
  const editor = document.getElementById("editor");
  const view = document.getElementById("view");
  if (!editor || !view) {
    console.error("Editor elements not found!");
    return;
  }

  hasUnsavedChanges = false;

  editor.addEventListener("input", () => {
    view.innerHTML = parseMarkdown(editor.value);
    hasUnsavedChanges = true;
    syncPaneHeights();
    if (window.initializeXpdfViewers) {
      window.initializeXpdfViewers();
    }
  });

  beforeUnloadHandler = (e) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", beforeUnloadHandler);

  keydownHandler = (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === "S" || e.key === "s")) {
      e.preventDefault();

      const saveBtn = document.getElementById("save-btn");
      if (saveBtn && !isSaving) {
        saveBtn.click();
      }
    }
  };
  window.addEventListener("keydown", keydownHandler);

  const showEditorBtn = document.getElementById("show-editor-btn");
  const showPreviewBtn = document.getElementById("show-preview-btn");
  const flexContainer = document.querySelector(".flex");
  showEditorBtn.addEventListener("click", () => {
    flexContainer.classList.remove("show-preview");
    showEditorBtn.classList.add("active");
    showPreviewBtn.classList.remove("active");
  });
  showPreviewBtn.addEventListener("click", () => {
    flexContainer.classList.add("show-preview");
    showEditorBtn.classList.remove("active");
    showPreviewBtn.classList.add("active");
  });
  const uploadBtn = document.getElementById("upload-btn");
  const fileInput = document.getElementById("file-input");
  const filenameInput = document.getElementById("filename-input");
  uploadBtn.addEventListener("click", async () => {
    if (!fileInput.files[0]) {
      alert("ファイルを選択してください。");
      return;
    }
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    formData.append("filename", filenameInput.value);
    formData.append("password", dataStorage.getItem("adminPassword"));
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
  });
  const res = await fetch(`/api/articles?view=admin`);
  const data = await res.json();
  let currentArticle = data.articles.find((a) => a.id === id);
  if (!currentArticle) {
    contentArea.innerHTML = `<p>記事データが見つかりません。</p><a href="/a">一覧に戻る</a>`;
    return;
  }
  const actionsDiv = document.querySelector(".editor-actions");
  const tagsListDiv = document.getElementById("tags-list");
  const tagInput = document.getElementById("tag-input");
  const addTagBtn = document.getElementById("add-tag-btn");
  let currentTags = [...(currentArticle.tags || [])];
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
  const updateButtons = () => {
    const publicButtonText = currentArticle.public
      ? "非公開にする"
      : "公開する";
    actionsDiv.innerHTML = `
      <button id="save-btn" class="button">保存</button>
      <button id="settings-btn" class="button">記事設定</button>
      <button id="toggle-public-btn" class="button ${
        currentArticle.public ? "public" : "private"
      }">
        ${publicButtonText}
      </button>
    `;
    document.getElementById("save-btn").addEventListener("click", async () => {
      const saveStatus = document.createElement("span");
      isSaving = true;
      saveStatus.id = "save-status";
      actionsDiv.appendChild(saveStatus);
      saveStatus.textContent = "保存中...";
      await fetch(`/api/articles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          getAuthBody({ content: editor.value, tags: currentTags }),
        ),
      });
      saveStatus.textContent = "完了！";
      hasUnsavedChanges = false;
      isSaving = false;
      alert("保存しました！");
      setTimeout(() => {
        saveStatus.remove();
      }, 1500);
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
  updateButtons();
};
const handleNewArticle = async () => {
  const id = prompt(
    "新しい記事のIDを入力してください (小文字英数、ハイフンのみ)",
  );
  if (!id || !/^[a-z0-9-]+$/.test(id)) {
    if (id !== null) alert("無効なIDです。");
    return;
  }
  const title = prompt("記事のタイトルを入力してください");
  if (!title) return;
  try {
    const response = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getAuthBody({ id, title })),
    });
    if (response.ok) {
      history.pushState(null, "", `/a/${id}`);
      router();
    } else {
      const err = await response.json();
      alert(`記事の作成に失敗しました: ${err.message}`);
    }
  } catch (err) {
    alert("通信エラーが発生しました。");
  }
};
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
const handleDeleteFile = async (id, filename) => {
  if (!confirm(`"${filename}" を削除しますか？`)) {
    return;
  }
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
const handleDeleteArticle = async (id, title) => {
  if (!confirm(`"${title}" を完全に削除しますか？`)) {
    return;
  }
  try {
    const response = await fetch(`/api/articles/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getAuthBody()),
    });
    const result = await response.json();
    if (response.ok) {
      alert(result.message);
      await renderArticleList("admin", 1);
    } else {
      alert(`エラー: ${result.message}`);
    }
  } catch (err) {
    alert("記事の削除中にエラーが発生しました。");
  }
};
const updateGlobalUI = async () => {
  const adminLinkContainer = document.getElementById("admin-link-container");
  if (adminLinkContainer) {
    const authenticated = await checkAuth();
    if (authenticated) {
      adminLinkContainer.innerHTML = `<a href="/a">管理画面</a>`;
    } else {
      adminLinkContainer.innerHTML = "";
    }
  }
};
