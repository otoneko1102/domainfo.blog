/**
 * mimeTypeなどを含んだmanifest.jsonを生成するためのhelper
 * すでに運用している場合はこれを一度実行してください。
 */
const fs = require("fs-extra");
const path = require("path");
const mime = require("mime-types");

const FILES_BASE_PATH = path.join(__dirname, "lib/pages/files");

async function createManifests() {
  console.log("Migration script started...");
  console.log(`Scanning directory: ${FILES_BASE_PATH}`);
  try {
    const articleDirs = await fs.readdir(FILES_BASE_PATH);
    for (const articleId of articleDirs) {
      const articleDirPath = path.join(FILES_BASE_PATH, articleId);
      const stat = await fs.stat(articleDirPath);

      if (stat.isDirectory()) {
        const files = await fs.readdir(articleDirPath);
        const manifestData = [];
        for (const filename of files) {
          if (filename === "manifest.json") continue;
          const fileMimeType =
            mime.lookup(filename) || "application/octet-stream";
          manifestData.push({ name: filename, type: fileMimeType });
        }
        if (manifestData.length > 0) {
          const manifestPath = path.join(articleDirPath, "manifest.json");
          await fs.writeJson(manifestPath, manifestData, { spaces: 2 });
          console.log(`✅ Generated manifest for article: ${articleId}`);
        } else {
          console.log(`⚪️ No files to migrate for article: ${articleId}`);
        }
      }
    }
    console.log("Migration script finished successfully!");
  } catch (err) {
    console.error("An error occurred during migration:", err);
  }
}

createManifests();
