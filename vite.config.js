import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  optimizeDeps: {
    // The Emscripten-generated OCCT loader confuses Vite's pre-bundler.
    exclude: ["replicad-opencascadejs"],
  },
});
