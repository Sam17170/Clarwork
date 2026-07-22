import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // En local, redirige les appels /api vers `vercel dev` (voir README)
      '/api': 'http://localhost:3000',
    },
  },
});
