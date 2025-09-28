import "dotenv/config";
import fs from "fs-extra";
import path from "path";
import express, { Request, Response, Router, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import * as cheerio from "cheerio";
import multer from "multer";
import crypto from "crypto";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import os from "os";
import RSS from "rss";

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

// 型
interface ArticleFile {
  name: string;
  type: string;
}
interface ArticleMetadata {
  title: string;
  public: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  tags: string[];
}
interface AllMetadata {
  [id: string]: ArticleMetadata;
}

// セットアップ
const app = express();
app.set("trust proxy", 1); // For Nginx
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const BASE_URL: string = process.env?.BASE_URL || `http://localhost:${PORT}`;

const METADATA_PATH = path.join(__dirname, "../lib/metadata.json");
const PAGES_PATH = path.join(__dirname, "../lib/pages");
const HTML_TEMPLATE_PATH = path.join(__dirname, "../lib/components/index.html");

// レートリミット
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

function setup(): void {
  try {
    const libDir = path.join(__dirname, "../lib");
    fs.ensureDirSync(libDir);

    const pagesDir = path.join(__dirname, "../lib/pages");
    fs.ensureDirSync(pagesDir);

    if (!fs.existsSync(METADATA_PATH)) {
      fs.writeJsonSync(METADATA_PATH, {});
    }
  } catch (err) {
    console.error("Setup failed:", err);
    process.exit(1);
  }
}
setup();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(limiter);
app.use(express.static(path.join(__dirname, "../lib/components")));
app.use("/src", express.static(path.join(__dirname, "../routes/src")));
// app.use("/files", express.static(path.join(__dirname, "../lib/pages/files")));

// 読み書き
const readMetadata = async (): Promise<AllMetadata> => {
  try {
    return await fs.readJson(METADATA_PATH);
  } catch (err) {
    console.error("Failed to read or parse metadata.json:", err);
    return {};
  }
};
const writeMetadata = async (data: AllMetadata): Promise<void> => {
  await fs.writeJson(METADATA_PATH, data, { spaces: 2 });
};

// マニフェスト
const getManifestPath = (articleId: string) =>
  path.join(PAGES_PATH, "files", articleId, "manifest.json");
const readManifest = async (articleId: string): Promise<ArticleFile[]> => {
  const manifestPath = getManifestPath(articleId);
  if (await fs.exists(manifestPath)) {
    try {
      return await fs.readJson(manifestPath);
    } catch (e) {
      return [];
    }
  }
  return [];
};
const writeManifest = async (articleId: string, data: ArticleFile[]) => {
  const manifestPath = getManifestPath(articleId);
  await fs.ensureDir(path.dirname(manifestPath));
  await fs.writeJson(manifestPath, data, { spaces: 2 });
};

// 管理者認証ミドルウェア
const adminAuthMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(403).json({ message: "Forbidden: Invalid credentials." });
  }
};

const upload = multer({ storage: multer.memoryStorage() });

// APIルーター
const api = Router();

// ログイン
api.post("/login", (req: Request, res: Response) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Invalid password" });
  }
});

// 記事一覧取得
api.get("/articles", async (req: Request, res: Response) => {
  const view = req.query.view as string;
  const searchTerm = ((req.query.q as string) || "").toLowerCase();
  const page = parseInt(req.query.page as string, 10) || 1;
  const pageSize = 20;
  const sortKey = (req.query.sortKey as string) || "createdAt";
  const sortOrder = (req.query.sortOrder as string) || "desc";

  const metadata = await readMetadata();
  let allArticles = Object.entries(metadata).map(([id, meta]) => ({
    id,
    ...meta,
  }));

  if (view !== "admin") {
    allArticles = allArticles.filter(
      (article) => article.public && article.createdAt,
    ); // 公開済みかつ日付のあるもののみ
  }
  if (searchTerm) {
    allArticles = allArticles.filter(
      (article) =>
        article.title.toLowerCase().includes(searchTerm) ||
        (article.tags || []).some((tag) =>
          tag.toLowerCase().includes(searchTerm),
        ),
    );
  }

  // ソート処理
  allArticles.sort((a, b) => {
    let valA, valB;
    if (sortKey === "createdAt" || sortKey === "updatedAt") {
      // nullの場合は0として扱うことで、エラーを回避し、日付がないものを最後尾にする
      valA = a[sortKey] ? new Date(a[sortKey]!).getTime() : 0;
      valB = b[sortKey] ? new Date(b[sortKey]!).getTime() : 0;
      return sortOrder === "asc" ? valA - valB : valB - valA;
    } else if (sortKey === "title") {
      valA = a.title || "";
      valB = b.title || "";
      return sortOrder === "asc"
        ? valA.localeCompare(valB, "ja")
        : valB.localeCompare(valA, "ja");
    }
    return 0; // 不明なキーの場合はソートしない
  });

  // ページネーション処理
  const totalPages = Math.ceil(allArticles.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedArticles = allArticles.slice(startIndex, endIndex);

  res.json({
    articles: paginatedArticles,
    totalPages,
    currentPage: page,
  });
});

app.get("/files/:id/:filename", async (req: Request, res: Response) => {
  const { id, filename } = req.params;
  const passwordQuery = req.query?.password as string | null | undefined;

  if (filename.includes("..")) {
    return res.status(400).send("Invalid filename");
  }

  try {
    const metadata = await readMetadata();
    const articleData = metadata[id];

    if (!articleData) {
      return res.status(404).send("File not found");
    }

    let isAuthorized = false;

    if (articleData.public) {
      isAuthorized = true;
    } else if (passwordQuery && ADMIN_PASSWORD) {
      const serverHash = crypto
        .createHash("sha256")
        .update(ADMIN_PASSWORD)
        .digest("hex");
      if (passwordQuery === serverHash) {
        isAuthorized = true;
      }
    }

    if (isAuthorized) {
      const filePath = path.join(PAGES_PATH, "files", id, filename);
      if (await fs.exists(filePath)) {
        return res.sendFile(filePath);
      }
    }

    return res.status(404).send("File not found");
  } catch (err) {
    console.error(`Error serving file ${filename} for article ${id}:`, err);
    return res.status(500).send("Internal Server Error");
  }
});

// 記事個別内容取得
api.get("/articles/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  const metadata = await readMetadata();
  const articleData = metadata[id];

  if (!articleData) {
    return res.status(404).json({ message: "Article not found." });
  }

  const isPublic = articleData.public;
  const isAdmin = req.headers["x-admin-password"] === ADMIN_PASSWORD;

  if (isPublic || isAdmin) {
    const mdPath = path.join(PAGES_PATH, `${id}.md`);
    if (await fs.exists(mdPath)) {
      const content = await fs.readFile(mdPath, "utf-8");
      return res.json({ content, meta: articleData });
    } else {
      return res.status(404).json({ message: "Article content not found." });
    }
  }

  if (articleData.public) {
    const mdPath = path.join(PAGES_PATH, `${id}.md`);
    if (await fs.exists(mdPath)) {
      const content = await fs.readFile(mdPath, "utf-8");
      return res.json({ content });
    } else {
      return res.status(404).json({ message: "Article content not found." });
    }
  }

  const providedPassword = req.headers["x-admin-password"];
  if (providedPassword === ADMIN_PASSWORD) {
    const mdPath = path.join(PAGES_PATH, `${id}.md`);
    if (await fs.exists(mdPath)) {
      const content = await fs.readFile(mdPath, "utf-8");
      return res.json({ content });
    } else {
      return res.status(404).json({ message: "Article content not found." });
    }
  }

  return res.status(404).json({ message: "Article not found." });
});

// 記事ファイル一覧取得
api.get("/articles/:id/files", async (req, res) => {
  // const dirPath = path.join(PAGES_PATH, "files", req.params.id);
  // if (await fs.exists(dirPath)) {
  //   const files = await fs.readdir(dirPath);
  //   res.json(files.filter((f) => !f.startsWith(".")));
  // } else {
  //   res.json([]);
  // }
  const { id } = req.params;

  const metadata = await readMetadata();
  const articleData = metadata[id];

  if (!articleData) {
    return res.status(404).json({ message: "Article not found." });
  }

  if (articleData.public) {
    const manifest = await readManifest(id);
    return res.json(manifest);
  }

  const providedPassword = req.headers["x-admin-password"];
  if (providedPassword === ADMIN_PASSWORD) {
    const manifest = await readManifest(id);
    return res.json(manifest);
  }

  return res.status(404).json({ message: "Article not found." });
});

// ファイルアップロード
api.post(
  "/articles/:id/files",
  upload.single("file"),
  adminAuthMiddleware,
  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "ファイルがアップロードされませんでした。" });
    }
    try {
      const { id } = req.params;
      const customName = req.body.filename;
      const originalExt = path.extname(req.file.originalname).toLowerCase();
      const safeCharRegex = /^[a-zA-Z0-9_-]+$/;
      const dir = path.join(PAGES_PATH, "files", id);
      await fs.ensureDir(dir);

      let finalName = "";
      let finalExt = originalExt;
      let buffer = req.file.buffer;

      if (customName) {
        if (!safeCharRegex.test(customName)) {
          return res.status(400).json({
            message:
              "ファイル名には半角英数字とハイフン、アンダースコアのみ使用できます。",
          });
        }
        finalName = customName;
      } else {
        finalName = crypto.randomBytes(8).toString("hex");
      }

      // if (
      //   [".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".png"].includes(
      //     originalExt,
      //   ) &&
      //   ![".apng", ".gif"].includes(originalExt)
      // ) {
      //   buffer = await sharp(req.file.buffer).png().toBuffer();
      //   finalExt = ".png";
      // }

      const mimeType = req.file.mimetype;

      if (mimeType.startsWith("image/")) {
        if (mimeType !== "image/gif" && mimeType !== "image/apng") {
          console.log("Converting image to PNG...");
          buffer = await sharp(req.file.buffer).png().toBuffer();
          finalExt = ".png";
        }
      } else if (mimeType.startsWith("video/")) {
        console.log("Converting video to MP4...");
        const tempInputPath = path.join(
          os.tmpdir(),
          `input_${Date.now()}${originalExt}`,
        );
        const tempOutputPath = path.join(
          os.tmpdir(),
          `output_${Date.now()}.mp4`,
        );

        await fs.writeFile(tempInputPath, req.file.buffer);

        await new Promise<void>((resolve, reject) => {
          ffmpeg(tempInputPath)
            .toFormat("mp4")
            .on("end", () => {
              console.log("Video conversion finished.");
              resolve();
            })
            .on("error", (err) => {
              console.error("Video conversion error:", err);
              reject(err);
            })
            .save(tempOutputPath);
        });

        buffer = await fs.readFile(tempOutputPath);
        finalExt = ".mp4";

        await fs.unlink(tempInputPath);
        await fs.unlink(tempOutputPath);
      } else if (mimeType.startsWith("audio/")) {
        console.log("Converting audio to MP3...");
        const tempInputPath = path.join(
          os.tmpdir(),
          `input_${Date.now()}${originalExt}`,
        );
        const tempOutputPath = path.join(
          os.tmpdir(),
          `output_${Date.now()}.mp3`,
        );

        await fs.writeFile(tempInputPath, req.file.buffer);

        await new Promise<void>((resolve, reject) => {
          ffmpeg(tempInputPath)
            .toFormat("mp3")
            .on("end", () => {
              console.log("Audio conversion finished.");
              resolve();
            })
            .on("error", (err) => {
              console.error("Audio conversion error:", err);
              reject(err);
            })
            .save(tempOutputPath);
        });

        buffer = await fs.readFile(tempOutputPath);
        finalExt = ".mp3";

        await fs.unlink(tempInputPath);
        await fs.unlink(tempOutputPath);
      }

      const finalFilename = `${finalName}${finalExt}`;
      const filePath = path.join(dir, finalFilename);
      await fs.writeFile(filePath, buffer);

      const manifest = await readManifest(id);
      let newMimeType = mimeType;
      if (finalExt === ".png") newMimeType = "image/png";
      if (finalExt === ".mp4") newMimeType = "video/mp4";
      if (finalExt === ".mp3") newMimeType = "audio/mpeg";

      manifest.push({
        name: finalFilename,
        type: newMimeType,
      });
      await writeManifest(id, manifest);

      res.json({
        message: "ファイルが正常にアップロードされました。",
        filename: finalFilename,
        filepath: `/files/${id}/${finalFilename}`,
      });
    } catch (err) {
      console.error("File upload processing error:", err);
      res.status(500).json({ message: "サーバー内部でエラーが発生しました。" });
    }
  },
);

// ファイル削除
api.delete(
  "/articles/:id/files/:filename",
  adminAuthMiddleware,
  async (req, res) => {
    const { id, filename } = req.params;
    const filePath = path.join(PAGES_PATH, "files", id, filename);
    try {
      if (await fs.exists(filePath)) {
        await fs.unlink(filePath);

        let manifest = await readManifest(id);
        manifest = manifest.filter((file) => file.name !== filename);
        await writeManifest(id, manifest);

        res.json({ message: "ファイルが削除されました。" });
      } else {
        res.status(404).json({ message: "ファイルが見つかりません。" });
      }
    } catch (err) {
      console.error("File deletion error:", err);
      res
        .status(500)
        .json({ message: "ファイルの削除中にエラーが発生しました。" });
    }
  },
);

// 記事作成
api.post(
  "/articles",
  adminAuthMiddleware,
  async (req: Request, res: Response) => {
    const { id, title } = req.body;
    if (!id || !title || !/^[a-z0-9-]+$/.test(id)) {
      return res.status(400).json({ message: "Invalid ID or title." });
    }
    const metadata = await readMetadata();
    if (metadata[id]) {
      return res.status(409).json({ message: "Article ID already exists." });
    }
    await fs.writeFile(path.join(PAGES_PATH, `${id}.md`), `# ${title}\n`);
    // const now = new Date().toISOString();
    metadata[id] = {
      title,
      public: false,
      createdAt: null, // now
      updatedAt: null, // now
      tags: [],
    };
    await writeMetadata(metadata);
    res.status(201).json({ id, ...metadata[id] });
  },
);

// 記事保存
api.put(
  "/articles/:id",
  adminAuthMiddleware,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { content, tags } = req.body;

    if (content) {
      await fs.writeFile(path.join(PAGES_PATH, `${id}.md`), content);
    }

    const metadata = await readMetadata();
    if (metadata[id]) {
      // 公開済みの場合のみ更新日時を記録
      if (metadata[id].public) {
        metadata[id].updatedAt = new Date().toISOString();
      }
      if (Array.isArray(tags)) {
        metadata[id].tags = tags.sort((a, b) => a.localeCompare(b, "ja"));
      }
      await writeMetadata(metadata);
    }
    res.json({ message: "保存しました。" });
  },
);

// 公開状態
api.patch(
  "/articles/:id/status",
  adminAuthMiddleware,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { public: isPublic } = req.body;
    const metadata = await readMetadata();
    if (metadata[id]) {
      const wasPublic = metadata[id].public;
      metadata[id].public = isPublic;

      const now = new Date().toISOString();
      // 初めて公開する場合
      if (isPublic && !wasPublic && !metadata[id].createdAt) {
        metadata[id].createdAt = now;
        metadata[id].updatedAt = now;
      }
      // 公開済み記事を更新する場合
      else if (isPublic && metadata[id].createdAt) {
        metadata[id].updatedAt = now;
      }
      // 非公開にする場合は日付を更新しない

      await writeMetadata(metadata);
      res.json(metadata[id]);
    } else {
      res.status(404).json({ message: "Article not found." });
    }
  },
);

// メタデータ
api.put(
  "/articles/:id/metadata",
  adminAuthMiddleware,
  async (req: Request, res: Response) => {
    const { id: oldId } = req.params;
    const { newId, newTitle } = req.body;

    if (!newId || !newTitle || !/^[a-z0-9-]+$/.test(newId)) {
      return res.status(400).json({ message: "入力データが無効です。" });
    }

    const metadata = await readMetadata();
    if (!metadata[oldId]) {
      return res.status(404).json({ message: "元の記事が見つかりません。" });
    }
    if (oldId !== newId && metadata[newId]) {
      return res
        .status(409)
        .json({ message: "新しいIDは既に使用されています。" });
    }

    const articleData = metadata[oldId];
    articleData.title = newTitle;
    articleData.updatedAt = new Date().toISOString();

    delete metadata[oldId];
    metadata[newId] = articleData;
    await writeMetadata(metadata);

    if (oldId !== newId) {
      const oldPath = path.join(PAGES_PATH, `${oldId}.md`);
      const newPath = path.join(PAGES_PATH, `${newId}.md`);
      await fs.rename(oldPath, newPath);
    }
    res.json({ message: "設定を更新しました。", newId: newId });
  },
);

// 記事削除
api.delete("/articles/:id", adminAuthMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const metadata = await readMetadata();
    if (!metadata[id]) {
      return res.status(404).json({ message: "記事が見つかりません。" });
    }
    delete metadata[id];
    await writeMetadata(metadata);

    const mdPath = path.join(PAGES_PATH, `${id}.md`);
    await fs.remove(mdPath);

    const filesDir = path.join(PAGES_PATH, "files", id);
    await fs.remove(filesDir);

    res.json({
      message: `記事「${id}」を関連ファイルごと完全に削除しました。`,
    });
  } catch (err) {
    console.error(`Error deleting article ${id}:`, err);
    res
      .status(500)
      .json({ message: "記事の削除中にサーバーエラーが発生しました。" });
  }
});

app.use("/api", api);

// ページ配信
const serveArticlePage = async (req: Request, res: Response) => {
  const { id } = req.params;
  const metadata = await readMetadata();
  const articleMeta = metadata[id];
  if (!articleMeta || !articleMeta.public) {
    // return res.sendFile(HTML_TEMPLATE_PATH);
    return serveApp(req, res);
  }
  try {
    const mdPath = path.join(PAGES_PATH, `${id}.md`);
    const markdownContent = await fs.readFile(mdPath, "utf-8");
    const htmlTemplate = await fs.readFile(HTML_TEMPLATE_PATH, "utf-8");
    const plainText = markdownContent
      .replace(/!\[.*?\]\(.*?\)/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/[#*`~_=\->|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const description =
      plainText.length > 100 ? `${plainText.substring(0, 100)}...` : plainText;
    const $ = cheerio.load(htmlTemplate);
    const originalTitle = $("title").text();
    const newTitle = `${articleMeta.title} - ${originalTitle}`;
    $("title").text(newTitle);
    $('meta[name="description"]').attr("content", description);
    $('meta[property="og:title"]').attr("content", newTitle);
    $('meta[property="og:description"]').attr("content", description);
    $('meta[name="twitter:title"]').attr("content", newTitle);
    $('meta[name="twitter:description"]').attr("content", description);
    res.send($.html());
  } catch (err) {
    console.error(`Error serving article page for ID: ${id}`, err);
    // res.sendFile(HTML_TEMPLATE_PATH);
    return serveApp(req, res);
  }
};

const serveApp = (req: Request, res: Response) => {
  res.sendFile(HTML_TEMPLATE_PATH);
};

const serveRssFeed = async (req: Request, res: Response) => {
  const feed = new RSS({
    title: process.env.VITE_SERVICE_NAME || "My Blog",
    description: process.env.VITE_SERVICE_DESCRIPTION || "Blog RSS Feed",
    feed_url: `${BASE_URL}/feed`,
    site_url: BASE_URL,
    language: "ja",
  });

  const metadata = await readMetadata();
  const publicArticles = Object.entries(metadata)
    .map(([id, meta]) => ({ id, ...meta }))
    .filter((article) => article.public && article.createdAt)
    .sort(
      (a, b) =>
        new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime(),
    );

  for (const article of publicArticles) {
    const mdPath = path.join(PAGES_PATH, `${article.id}.md`);
    if (await fs.exists(mdPath)) {
      const markdownContent = await fs.readFile(mdPath, "utf-8");
      const plainText = markdownContent
        .replace(/!\[.*?\]\(.*?\)/g, "")
        .replace(/\[(.*?)\]\(.*?\)/g, "$1")
        .replace(/[#*`~_=\->|]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      const description =
        plainText.length > 100
          ? `${plainText.substring(0, 100)}...`
          : plainText;

      feed.item({
        title: article.title,
        description: description,
        url: `${BASE_URL}/b/${article.id}`,
        guid: article.id,
        date: article.createdAt!,
        author: process.env.VITE_SERVICE_AUTHOR || "Anonymous",
      });
    }
  }

  res.set("Content-Type", "application/rss+xml");
  res.send(feed.xml({ indent: true }));
};

app.get("/", serveApp);
app.get("/a", serveApp);
app.get("/a/:id", serveApp);
app.get("/b", (req, res) => res.redirect("/"));
app.get("/b/:id", serveArticlePage);
app.get("/rss", (req, res) => res.redirect(301, "/feed"));
app.get("/feed", serveRssFeed);

// サーバー起動
app.listen(PORT, () =>
  console.log(`Server is running on http://localhost:${PORT}`),
);
