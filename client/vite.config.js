import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// In development, every request that starts with /api is passed to the backend.
// That way the browser talks to ONE address, and login cookies just work.
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:6000',
        changeOrigin: true,
      },
    },
  },
});
