import { marked } from "marked";
import DOMPurify from "dompurify";
import katex from "katex";
import Prism from "prismjs";
import { dataStorage } from "../state";
import { sha256 } from "./crypto";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false });

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

const mermaidBlock = {
  name: "mermaidBlock",
  level: "block",
  start(src) {
    return src.match(/^\s*:::/)?.index;
  },
  tokenizer(src) {
    const rule = /^\s*:::\s*([\s\S]+?)\s*:::\s*/;
    const match = rule.exec(src);
    if (match) {
      return {
        type: "mermaidBlock",
        raw: match[0],
        text: match[1].trim(),
      };
    }
  },
  renderer(token) {
    return `<div class="mermaid">${escapeHtml(token.text)}</div>`;
  },
};

const escapeHtml = (str) => {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (match) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[match];
  });
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
  extensions: [latexInline, latexBlock, mermaidBlock, underline, details],
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
    '<video src="$1" alt="$3" controls playsinline style="max-width: 100%; border-radius: var(--border-radius);" controlsList="nodownload" oncontextmenu="return false;"></video>',
  );
  processedHtml = processedHtml.replace(
    /<img src="([^"]+\.(mp3|wav|weba|m4a|oga|ogg|opus|aac|midi?|rmi?|aiff|flac|alac|wma))" alt="([^"]*)"[^>]*>/gi,
    '<audio src="$1" controls preload="metadata" controlsList="nodownload" oncontextmenu="return false;"></audio>',
  );

  processedHtml = processedHtml.replace(
    /<img/gi,
    '<img oncontextmenu="return false;"',
  );

  const currentPath = window.location.pathname;
  if (currentPath.startsWith("/a/")) {
    const password = dataStorage.getItem("adminPassword");
    const parts = currentPath.split("/").filter((p) => p !== "");
    if (password && parts.length > 1) {
      const articleId = parts[1];

      const urlRegex = /(src|data-pdf)="(\/files\/[^"]+)"/g;
      const matches = [...processedHtml.matchAll(urlRegex)];

      const hashPromises = matches.map((match) => {
        const url = match[2];
        const filename = url.substring(url.lastIndexOf("/") + 1);
        const baseToHash = `${password}${articleId}${filename}`;
        return sha256(baseToHash);
      });
      const hashes = await Promise.all(hashPromises);

      matches.forEach((match, index) => {
        const originalAttribute = match[0];
        const url = match[2];
        const newAttribute = originalAttribute.replace(
          url,
          `${url}?key=${hashes[index]}`,
        );
        processedHtml = processedHtml.replace(originalAttribute, newAttribute);
      });
    }
  }

  return processedHtml;
};

export const runMermaid = async () => {
  try {
    await mermaid.run({
      nodes: document.body.querySelectorAll(".mermaid"),
    });
  } catch (err) {
    console.error("Mermaid rendering error:", err);
  }
};
