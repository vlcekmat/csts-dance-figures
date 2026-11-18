import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { figureEditor } from "./scripts/editorServer.js";

// `base: "./"` keeps asset paths relative so the build works from any
// sub-path (e.g. GitHub Pages project sites) and from file:// previews.
export default defineConfig({
  // figureEditor: the owner's chart editor, dev server only (see scripts/editorServer.js).
  plugins: [react(), figureEditor()],
  base: "./",
  // The figure database is bundled as JSON (~120 kB gzipped); that is expected.
  build: { chunkSizeWarningLimit: 1200 },
});
