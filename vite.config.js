import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "robots.txt", "apple-touch-icon.png"],
      manifest: {
        name: "PDF Aloud",
        short_name: "pdfaloud",
        description: "A portable PDF Text-to-Speech Reader",
        theme_color: "#172478",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/pdfaloud-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pdfaloud-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pdfaloud-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
