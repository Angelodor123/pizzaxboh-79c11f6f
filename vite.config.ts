// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (!id.includes("node_modules")) return;
            if (id.includes("/@supabase/supabase-js/")) return "vendor-supabase";
            if (
              id.includes("/@tanstack/react-router/") ||
              id.includes("/@tanstack/react-start/") ||
              id.includes("/@tanstack/react-query/")
            )
              return "vendor-tanstack";
            if (id.includes("/framer-motion/") || id.includes("/lucide-react/"))
              return "vendor-ui";
            if (id.includes("/ai/") || id.includes("/@ai-sdk/"))
              return "vendor-ai";
          },
            "vendor-tanstack": [
              "@tanstack/react-router",
              "@tanstack/react-start",
              "@tanstack/react-query",
            ],
            "vendor-supabase": ["@supabase/supabase-js"],
            "vendor-ui": ["framer-motion", "lucide-react"],
            "vendor-ai": ["ai", "@ai-sdk/openai-compatible"],
          },
        },
      },
    },
  },
});
