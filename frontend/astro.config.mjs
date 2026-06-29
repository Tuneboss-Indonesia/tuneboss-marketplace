import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import vercel from "@astrojs/vercel";
import { defineConfig, envField } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://dev.fe-marketplace.panjiihsanudinfajri.my.id",
  env: {
    schema: {
      PUBLIC_API_URL: envField.string({ context: "client", access: "public", default: "http://localhost:8000/api" }),
    },
  },
  adapter: vercel(),
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
