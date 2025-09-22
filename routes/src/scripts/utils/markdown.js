import { marked } from "marked";
import DOMPurify from "dompurify";
import katex from "katex";

const latexInline = {
  name: "latexInline",
  level: "inline",
  start(src) {
    return src.indexOf("$");
  },
  tokenizer(src) {
    const match = src.match(/^\$(?!\$)([^\n$]+?)\$/);
    if (match) {
      return { type: "latexInline", raw: match[0], text: match[1].trim() };
    }
  },
  renderer(token) {
    return katex.renderToString(token.text, { throwOnError: false });
  },
};

const latexBlock = {
  name: "latexBlock",
  level: "block",
  start(src) {
    return src.indexOf("$$");
  },
  tokenizer(src) {
    const match = src.match(/^\$\$([\s\S]+?)\$\$/);
    if (match) {
      return { type: "latexBlock", raw: match[0], text: match[1].trim() };
    }
  },
  renderer(token) {
    return `<p>${katex.renderToString(token.text, { displayMode: true, throwOnError: false })}</p>`;
  },
};

const detailsBlock = {
  name: "detailsBlock",
  level: "block",
  start(src) {
    return src.match(/^\^\^\^/)?.index;
  },
  tokenizer(src) {
    const rule = /^\^\^\^ *(.*)\n([\s\S]+?)\n\^\^\^\n?/;
    const match = rule.exec(src);
    if (match) {
      const summary = match[1].trim() || "詳細";
      const body = match[2].trim();
      return {
        type: "detailsBlock",
        raw: match[0],
        summary,
        body,
        tokens: this.lexer.blockTokens(body),
      };
    }
  },
  renderer(token) {
    const summaryHtml = this.parser.parseInline(
      this.lexer.inlineTokens(token.summary),
    );
    const bodyHtml = this.parser.parse(token.tokens);
    return `<details><summary>${summaryHtml}</summary>${bodyHtml}</details>`;
  },
};

const underlineExtension = {
  name: "underline",
  level: "inline",
  tokenizer(src) {
    const rule = /^__(.+?)__/;
    const match = rule.exec(src);
    if (match) {
      return {
        type: "underline",
        raw: match[0],
        text: match[1],
        tokens: this.lexer.inlineTokens(match[1]),
      };
    }
  },
  renderer(token) {
    return `<u>${this.parser.parseInline(token.tokens)}</u>`;
  },
};

marked.use({
  extensions: [underlineExtension, latexInline, latexBlock, detailsBlock],
  breaks: true,
});

export const parseMarkdown = (markdownText) => {
  const rawHtml = marked.parse(markdownText || "");
  const sanitizedHtml = DOMPurify.sanitize(rawHtml);
  let processedHtml = sanitizedHtml;
  processedHtml = processedHtml.replace(
    /<a href="http/g,
    '<a target="_blank" rel="noopener noreferrer nofollow" href="http',
  );
  processedHtml = processedHtml.replace(
    /<img src="([^"]+\.pdf)"[^>]*>/g,
    '<embed class="xpdf" data-pdf="$1" data-pdf-size="100%">',
  );
  return processedHtml;
};
