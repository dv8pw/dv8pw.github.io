import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  build: {
    target: "esnext",
    outDir: "docs",
    emptyOutDir: true,
    assetsDir: "assets",
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        passes: 2
      },
      format: {
        comments: false
      }
    },
    rollupOptions: {
      input: {
        index: resolve(rootDirectory, "index.html"),
        aether: resolve(rootDirectory, "aether/index.html"),
        nullGarden: resolve(rootDirectory, "null-garden/index.html"),
        eidolon: resolve(rootDirectory, "eidolon/index.html"),
        eventide: resolve(rootDirectory, "eventide/index.html")
      }
    }
  }
});
