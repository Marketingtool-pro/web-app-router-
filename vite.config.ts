import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import tsconfigPaths from "vite-tsconfig-paths";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Custom local resolver plugin to handle JSR imports over network at test-time
const jsrNetworkResolver = () => ({
  name: "jsr-network-resolver",
  enforce: "pre" as const,
  resolveId(source: string) {
    if (source === "jsr:@std/assert") {
      return { id: "https://esm.sh", external: true };
    }
    if (source === "jsr:@std/path") {
      return { id: "https://esm.sh", external: true };
    }
    return null;
  },
});

const config = defineConfig({
  plugins: [
    jsrNetworkResolver(), // 👈 Intercepts and maps "jsr:" prefixes dynamically
    devtools(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  test: {
    // Falls back safely if Vitest reads alias arrays directly
    alias: [
      { find: /^jsr:@std\/assert$/, replacement: "https://esm.sh" },
      { find: /^jsr:@std\/path$/, replacement: "https://esm.sh" },
    ],
  },
});

export default config;
