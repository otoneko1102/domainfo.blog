import { marked } from "marked";
import DOMPurify from "dompurify";

// 下線(__text__)を描画するためのmarked拡張機能
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

// markedの初期設定
marked.use({
  extensions: [underlineExtension],
  breaks: true, // 改行を<br>に変換
});

/**
 * Markdownテキストを安全なHTMLに変換する
 * @param {string} markdownText - Markdown形式の文字列
 * @returns {string} サニタイズ済みのHTML文字列
 */
export const parseMarkdown = (markdownText) => {
  const rawHtml = marked.parse(markdownText || "");
  // XSS対策としてHTMLをサニタイズ
  const sanitizedHtml = DOMPurify.sanitize(rawHtml);

  let processedHtml = sanitizedHtml;
  // 外部リンクに target="_blank" などを追加
  processedHtml = processedHtml.replace(
    /<a href="http/g,
    '<a target="_blank" rel="noopener noreferrer nofollow" href="http',
  );
  // PDFのimgタグをembedタグに変換
  processedHtml = processedHtml.replace(
    /<img src="([^"]+\.pdf)"[^>]*>/g,
    '<embed class="xpdf" data-pdf="$1" data-pdf-size="100%">',
  );
  return processedHtml;
};
