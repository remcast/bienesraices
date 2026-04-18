// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  // Reemplazar con dominio real
  site: 'https://bienesraices-demo.com',

  output: 'server',

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx']
    }
  },

  integrations: [
    react(),
    sitemap()

  ],


  adapter: netlify(),
});