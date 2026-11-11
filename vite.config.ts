import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` keeps asset paths relative so the build works from any
// sub-path (e.g. GitHub Pages project sites) and from file:// previews.
export default defineConfig({
  plugins: [react()],
  base: "./",
  // The figure database is bundled as JSON (~120 kB gzipped); that is expected.
  build: { chunkSizeWarningLimit: 1200 },
});
