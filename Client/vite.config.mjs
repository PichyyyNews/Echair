import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['REACT_APP_', 'VITE_', 'PUBLIC_URL', 'CLIENT_PUBLIC_URL']);

  const apiBaseUrl = env.REACT_APP_API_BASE_URL || env.VITE_API_BASE_URL || '';
  const apiUrl = env.REACT_APP_API_URL || env.VITE_API_URL || '';
  const publicUrl = env.PUBLIC_URL || env.CLIENT_PUBLIC_URL || '';
  const basePath = env.REACT_APP_BASE_PATH || publicUrl || '';

  return {
    plugins: [react()],
    base: publicUrl ? (publicUrl.endsWith('/') ? publicUrl : `${publicUrl}/`) : '/',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
      'process.env.REACT_APP_API_BASE_URL': JSON.stringify(apiBaseUrl),
      'process.env.REACT_APP_API_URL': JSON.stringify(apiUrl),
      'process.env.PUBLIC_URL': JSON.stringify(publicUrl),
      'process.env.REACT_APP_BASE_PATH': JSON.stringify(basePath),
      'process.env': JSON.stringify({
        NODE_ENV: mode === 'production' ? 'production' : 'development',
        REACT_APP_API_BASE_URL: apiBaseUrl,
        REACT_APP_API_URL: apiUrl,
        PUBLIC_URL: publicUrl,
        REACT_APP_BASE_PATH: basePath,
      }),
      global: 'window',
    },
    server: {
      port: 3000,
      open: false,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1600,
    },
  };
});
