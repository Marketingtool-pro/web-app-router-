import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import jsconfigPaths from "vite-jsconfig-paths";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const APP_BASE_URL = env.VITE_APP_BASE_URL || "/";
  const PORT = 3000;

  return {
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
    plugins: [react(), jsconfigPaths()],
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/setupTests.js",
      css: true,
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "website/**",
        "vcpkg/**",
      ],
      coverage: {
        provider: "v8",
        reporter: ["cobertura"],
        reportsDirectory: "./coverage",
        include: ["src/**/*.{js,jsx,ts,tsx}"],
        exclude: [
          "src/setupTests.js",
          "**/*.test.{js,jsx,ts,tsx}",
        ],
      },
    },
  };
});
