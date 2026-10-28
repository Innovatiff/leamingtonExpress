import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Three installable apps from one codebase, each with its own page:
//   index.html  → website / client app (store, rides, trips, live status)
//   admin.html  → /admin   (owner and office)
//   equipo.html → /equipo  (employees: drivers, couriers, trip guides)
const page = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));

/** Serve /admin/* and /equipo/* from their own page while developing/previewing (Netlify does it in production). */
function appPages() {
  const rewrite = (req, _res, next) => {
    const path = (req.url || "").split("?")[0];
    if (/^\/admin(\/|$)/.test(path)) req.url = "/admin.html";
    else if (/^\/equipo(\/|$)/.test(path)) req.url = "/equipo.html";
    next();
  };
  return {
    name: "lx-app-pages",
    // (block bodies: returning something here would make Vite treat it as a post-hook)
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

// `npm run demo` (mode "demo") swaps the Firebase backend for an offline
// mock so the whole site can be previewed without touching production data.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const demo = env.VITE_DEMO === "true";
  const backend = demo ? "src/services/demo" : "src/services/firebase";

  return {
    plugins: [react(), appPages()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
        "@backend": fileURLToPath(new URL(`./${backend}`, import.meta.url)),
      },
    },
    build: {
      target: "es2022",
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        input: { main: page("index.html"), admin: page("admin.html"), equipo: page("equipo.html") },
      },
    },
    server: { port: 5173, host: true },
    preview: { port: 4173, host: true },
  };
});
