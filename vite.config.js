import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// `npm run demo` (mode "demo") swaps the Firebase backend for an offline
// mock so the whole site can be previewed without touching production data.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const demo = env.VITE_DEMO === "true";
  const backend = demo ? "src/services/demo" : "src/services/firebase";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@backend": fileURLToPath(new URL(`./${backend}`, import.meta.url)),
      },
    },
    build: {
      target: "es2022",
      chunkSizeWarningLimit: 1200,
    },
    server: { port: 5173, host: true },
    preview: { port: 4173, host: true },
  };
});
