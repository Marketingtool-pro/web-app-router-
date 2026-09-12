import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import jsconfigPaths from "vite-jsconfig-paths";
// import tailwindcss from '@tailwindcss/vite'; // enable only if actually used

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const APP_BASE_URL = env.VITE_APP_BASE_URL || "/";
  const PORT = 3000;

  return {
    create: {
      templates: [
        {
          name: "@marketingtool-pro/here-immediately",
          description: "Generate new components for our monorepo",
          template: "./marketingtool/here-immediately",
        },
      ],
    },
    staged: { "*": "vp check --fix" },
    server: {
      open: true,
      port: PORT,
      host: true,
    },
    preview: {
      open: true,
      host: true,
    },
    define: {
      global: "window",
    },
    base: APP_BASE_URL,
    // The repo has ~210 stray .html files from unrelated tooling dumped into
    // it (buck2, direnv, pcre2, a vite playground). Vite treats every .html as
    // an entry, so the dependency scan failed on them and pre-bundling was
    // skipped entirely, making dev slow. Pin both the scan and the build to
    // this app's single entry.
    optimizeDeps: {
      entries: ["index.html"],
    },
    build: {
      rollupOptions: {
        input: "index.html",
      },
    },
    plugins: [react(), jsconfigPaths()],
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/setupTests.js",
      css: true,
      exclude: ["**/node_modules/**", "**/dist/**", "website/**", "vcpkg/**"],
    },
  };
});
