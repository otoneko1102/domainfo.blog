import { contentArea } from "../../state.js";
import { parseMarkdown } from "../../utils/markdown.js";
import { renderNotFoundView } from "../global/errorViews.js";
import Prism from "prismjs";

export const renderPublicView = async (id) => {
  contentArea.innerHTML = "<p>読み込み中...</p>";
  try {
    const response = await fetch(`/api/articles/${id}`);
    if (!response.ok) {
      return await renderNotFoundView("記事の読み込みに失敗しました。");
    }

    const data = await response.json();

    let htmlContent = await parseMarkdown(data.content);
    htmlContent = htmlContent.replace(
      /data-src="(\/files\/[^"]+)"/g,
      'src="$1"',
    );
    htmlContent = htmlContent.replace(
      /data-src="([^"]+)" data-pdf=""/g,
      'data-pdf="$1"',
    );

    contentArea.innerHTML = `
      <a href="/" class="back-to-list-link">&larr; 記事一覧に戻る</a>
      <div class="view-public">${htmlContent}</div>
    `;
    Prism.highlightAll();
    if (window.initializeXpdfViewers) {
      setTimeout(() => window.initializeXpdfViewers(), 0);
    }
  } catch (err) {
    contentArea.innerHTML = `<p>${err.message}</p>`;
  }
};
