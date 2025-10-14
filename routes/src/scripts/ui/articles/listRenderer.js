import { contentArea } from "../../state.js";
import { handleNewArticle, handleDeleteArticle } from "./articleHandlers.js";
import router from "../../router.js";

const renderPagination = (mode, totalPages, currentPage, showHidden) => {
  if (totalPages <= 1) return "";
  const basePath = mode === "admin" ? "/a" : "/";
  let queryParams = `page=`;
  if (mode === "admin" && showHidden) {
    queryParams = `range=all&page=`;
  }

  let html = "";
  html +=
    currentPage > 1
      ? `<a href="${basePath}?${queryParams}${
          currentPage - 1
        }" class="page-link" data-page="${currentPage - 1}">&laquo; 前へ</a>`
      : `<span class="page-link disabled">&laquo; 前へ</span>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<a href="${basePath}?${queryParams}${i}" class="page-link ${
      i === currentPage ? "active" : ""
    }" data-page="${i}">${i}</a>`;
  }
  html +=
    currentPage < totalPages
      ? `<a href="${basePath}?${queryParams}${
          currentPage + 1
        }" class="page-link" data-page="${currentPage + 1}">次へ &raquo;</a>`
      : `<span class="page-link disabled">次へ &raquo;</span>`;
  return html;
};

const formatDate = (dateString) => {
  if (!dateString) return "---";
  return new Date(dateString).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export const renderArticleList = async (mode, page = 1) => {
  let searchTerm = "";
  let sortKey = "createdAt";
  let sortOrder = "desc";
  let showHidden = false;

  const setupDynamicEventListeners = () => {
    document.querySelectorAll(".page-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const pageToGo = parseInt(e.currentTarget.dataset.page, 10);
        if (pageToGo) {
          const newUrl = new URL(window.location);
          newUrl.searchParams.set("page", pageToGo);
          history.pushState({}, "", newUrl);
          render(pageToGo);
        }
      });
    });

    if (mode === "admin") {
      document.querySelectorAll(".article-delete-btn").forEach((btn) => {
        btn.addEventListener("click", () =>
          handleDeleteArticle(btn.dataset.id, btn.dataset.title),
        );
      });
    }
  };

  const render = async (currentPage) => {
    const range = showHidden ? "all" : "notHidden";
    let apiUrl = `/api/articles?view=${mode}&q=${encodeURIComponent(
      searchTerm,
    )}&page=${currentPage}&sortKey=${sortKey}&sortOrder=${sortOrder}`;
    if (mode === "admin") {
      apiUrl += `&range=${range}`;
    }
    const response = await fetch(apiUrl);
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
        const createdDate = formatDate(article.createdAt);
        const updatedDate = formatDate(article.updatedAt);
        const isUpdated =
          article.createdAt &&
          article.updatedAt &&
          new Date(article.createdAt).toDateString() !==
            new Date(article.updatedAt).toDateString();
        const tagsHTML =
          article.tags
            ?.map((tag) => `<span class="tag">${tag}</span>`)
            .join(" / ") || '<span class="tag"></span>';

        const hiddenClass =
          mode === "admin" && article.hidden ? " hidden-article" : "";
        articlesHTML += `
          <div class="article-card${
            article.pinned ? " pinned" : ""
          }${hiddenClass}">
            <div class="article-tags">${tagsHTML}</div>
            <a href="${link}" class="article-title${
              article.pinned ? " pinned" : ""
            }${article.hidden ? " hidden-article" : ""}">${
              article.pinned ? '<span class="pinned-icon"></span>' : ""
            }${
              article.hidden ? '<span class="hidden-icon"></span>' : ""
            }<h2>${article.title}</h2></a>
            <div class="article-meta">
              <div class="article-dates">
                <span>投稿日: <time datetime="${
                  article.createdAt
                }">${createdDate}</time></span>
                ${
                  isUpdated
                    ? `<span>最終更新日: <time datetime="${article.updatedAt}">${updatedDate}</time></span>`
                    : ""
                }
              </div>
              <div class="article-meta-right">
                ${
                  mode === "admin"
                    ? `<span class="status ${
                        article.public ? "public" : "private"
                      }">${article.public ? "公開" : "非公開"}</span>`
                    : ""
                }
                ${
                  mode === "admin"
                    ? `<button class="article-delete-btn" data-id="${article.id}" data-title="${article.title}">削除</button>`
                    : ""
                }
              </div>
            </div>
          </div>`;
      });
    }
    document.getElementById("articles-grid").innerHTML = articlesHTML;
    document.getElementById("pagination-container").innerHTML =
      renderPagination(mode, totalPages, returnedPage, showHidden);

    setupDynamicEventListeners();
  };

  const adminControlsHTML =
    mode === "admin"
      ? `
    <div class="admin-controls">
      <button id="new-article-btn" class="button">新規作成</button>
      <div class="checkbox-container">
        <input type="checkbox" id="show-hidden-checkbox" />
        <label for="show-hidden-checkbox">非表示の記事を表示</label>
      </div>
    </div>
  `
      : "";

  contentArea.innerHTML = `
    <div class="list-header">
      <h2>${mode === "admin" ? "記事管理" : "記事一覧"}</h2>
      <div class="sort-options">
        <select id="sort-key">
          <option value="createdAt">作成日</option> <option value="updatedAt">更新日</option> <option value="title">タイトル</option>
        </select>
        <select id="sort-order">
          <option value="desc">降順</option> <option value="asc">昇順</option>
        </select>
      </div>
    </div>
    ${adminControlsHTML}
    <div class="search-container"><input type="search" id="search-input" placeholder="記事名またはタグで検索..."></div>
    <div id="articles-grid"></div>
    <div id="pagination-container" class="pagination"></div>
  `;

  let debounceTimer;
  document.getElementById("search-input").addEventListener("input", (e) => {
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

  if (mode === "admin") {
    document
      .getElementById("new-article-btn")
      ?.addEventListener("click", handleNewArticle);

    const showHiddenCheckbox = document.getElementById("show-hidden-checkbox");
    if (showHiddenCheckbox) {
      showHiddenCheckbox.checked = showHidden;
      showHiddenCheckbox.addEventListener("change", (e) => {
        showHidden = e.target.checked;
        render(1);
      });
    }
  }

  await render(page);
};
