import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cadStatePlugin from "./vite-plugin-cad-state.js";

export default defineConfig({
  plugins: [react(), cadStatePlugin()],
  base: "/",
  optimizeDeps: {
    exclude: ["replicad-opencascadejs"],
  },
});
