import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => ({
  base: './',
  plugins: [react(), tailwindcss(), {
    name: 'theseus-csp',
    transformIndexHtml(html) {
      const scripts = command === 'serve' ? "'self' 'unsafe-inline'" : "'self'";
      const connect = command === 'serve' ? "'self' ws://127.0.0.1:5173 http://127.0.0.1:5173" : "'self'";
      return html.replace('__CSP__', `default-src 'self'; script-src ${scripts}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ${connect}; object-src 'none'; base-uri 'self'; form-action 'none'; frame-src 'none'`);
    },
  }],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
}));
