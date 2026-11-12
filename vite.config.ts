import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "version-service-worker",
      closeBundle() {
        const hash = createHash("sha256")
          .update(readFileSync("dist/index.html"))
          .digest("hex")
          .slice(0, 12);
        const assets = readdirSync("dist/assets").map(
          (file) => `/assets/${file}`,
        );
        const sw = readFileSync("dist/sw.js", "utf8");
        writeFileSync(
          "dist/sw.js",
          sw
            .replace("plastico-shell-v1", `plastico-shell-${hash}`)
            .replace("/* BUILD_ASSETS */ []", JSON.stringify(assets)),
        );
      },
    },
  ],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@supabase/")) return "supabase";
          if (
            /node_modules\/(react|react-dom|scheduler)\//.test(
              id.replaceAll("\\", "/"),
            )
          )
            return "react";
        },
      },
    },
  },
});
