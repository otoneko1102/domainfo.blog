import { marked } from "marked";
import DOMPurify from "dompurify";
import katex from "katex";
import Prism from "prismjs";
import { dataStorage } from "../state";
import { sha256 } from "./crypto";

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

const underline = {
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

const details = {
  name: "details",
  level: "block",
  start(src) {
    return src.match(/^\^\^\^/)?.index;
  },
  tokenizer(src) {
    const rule = /^\^\^\^(.*?)\n([\s\S]+?)\^\^\^/;
    const match = rule.exec(src);

    if (match) {
      const summaryText = match[1].trim();
      const detailsText = match[2].trim();

      const token = {
        type: "details",
        raw: match[0],
        summary: summaryText,
        tokens: this.lexer.blockTokens(detailsText, []),
      };
      return token;
    }
  },
  renderer(token) {
    const summary = this.parser.parseInline(
      token.summary ? [{ type: "text", text: token.summary }] : [],
    );
    const details = this.parser.parse(token.tokens);
    return `<details><summary>${summary}</summary>${details}</details>`;
  },
};

marked.use({
  extensions: [latexInline, latexBlock, underline, details],
  breaks: true,
});

export const parseMarkdown = async (markdownText) => {
  const rawHtml = marked.parse(markdownText || "");
  const sanitizedHtml = DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: ["embed", "details", "summary"],
  });
  let processedHtml = sanitizedHtml;

  processedHtml = processedHtml.replace(
    /<a href="(https?:\/\/[^"]+)"/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer nofollow"',
  );
  processedHtml = processedHtml.replace(
    /<img src="([^"]+\.pdf)"[^>]*>/g,
    '<embed class="xpdf" data-pdf="$1" data-pdf-size="100%">',
  );
  processedHtml = processedHtml.replace(
    /<img src="([^"]+\.(mp4|mov|webm|ogv|mov|qt|avi|flv|mpe?g|mkv|m2ts|wmv|asf|vob))" alt="([^"]*)"[^>]*>/gi,
    '<video src="$1" alt="$3" controls playsinline style="max-width: 100%; border-radius: var(--border-radius);"></video>',
  );
  processedHtml = processedHtml.replace(
    /<img src="([^"]+\.(mp3|wav|weba|m4a|oga|ogg|opus|aac|midi?|rmi?|aiff|flac|alac|wma))" alt="([^"]*)"[^>]*>/gi,
    '<audio src="$1" controls preload="metadata"></audio>',
  );

  if (window.location.pathname.startsWith("/a/")) {
    const password = dataStorage.getItem("adminPassword");
    if (password) {
      const hashedPassword = await sha256(password);
      processedHtml = processedHtml.replace(
        /(src|data-pdf)="(\/files\/[^"]+)"/g,
        `$1="$2?password=${hashedPassword}"`,
      );
    }
  }

  return processedHtml;
};
