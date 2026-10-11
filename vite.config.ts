import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", port: 5273 },
  preview: { host: "0.0.0.0", port: 4273 },
  build: { target: "es2022", assetsInlineLimit: 0 },
});
