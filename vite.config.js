import { defineConfig, loadEnv } from "vite";
import { createMultiHtmlPlugin } from "vite-plugin-multi-html"
import prismjsPlugin from "vite-plugin-prismjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    root: "routes",
    server: {
      port: Number(env.PORT) || 5173,
    },
    plugins: [
      createMultiHtmlPlugin({
        variables: {
          serviceName: env?.VITE_SERVICE_NAME,
          serviceDescription: env?.VITE_SERVICE_DESCRIPTION,
          serviceHeaderImage: env?.VITE_SERVICE_HEADER_IMAGE,
          serviceIconImage: env?.VITE_SERVICE_ICON_IMAGE,
          serviceThumbnailImage: env?.VITE_SERVICE_THUMBNAIL_IMAGE,
          serviceAuthor: env.VITE_SERVICE_AUTHOR,
          serviceStartYear: env.VITE_SERVICE_START_YEAR,
        }
      }),
      prismjsPlugin({
        languages: "all",
      })
    ],
    build: {
      chunkSizeWarningLimit: 1000,
      outDir: "../lib/components",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: "assets/[hash].js",
          chunkFileNames: "assets/[hash].js",
          assetFileNames: (i) => {
            if (/\.(a?png|jpe?g|gif|webp|mp3|m4a|mp4|mov|webm)$/.test(i.name)) {
              return "assets/img/[name][extname]";
            }
            return "assets/[hash][extname]"
          },
          manualChunks(id) {
            if (id.includes("node_modules/katex")) {
              return "katex";
            }
            if (id.includes("node_modules/prismjs")) {
              return "prism";
            }
          }
        }
      }
    },
  };
});
