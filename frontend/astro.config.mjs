import process from "node:process";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";
import vercel from "@astrojs/vercel";
import { defineConfig, envField } from "astro/config";
import sitemap from "@astrojs/sitemap";

// Vercel secara otomatis menyediakan environment variable VERCEL=1 saat build
const isVercel = Boolean(process.env.VERCEL);

export default defineConfig({
  site: "https://marketplace.tuneboss-landing.dasrams.biz.id",
  output: "server",
  env: {
    schema: {
      PUBLIC_API_URL: envField.string({ context: "client", access: "public", default: "http://localhost:8000/api" }),
    },
  },
  adapter: isVercel ? vercel() : node({ mode: "standalone" }),
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
