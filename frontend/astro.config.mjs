import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  env: {
    schema: {
      PUBLIC_API_URL: envField.string({ context: "client", access: "public", default: "http://localhost:8000/api" }),
    },
  },
  adapter: node({
    mode: "standalone"
  }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
