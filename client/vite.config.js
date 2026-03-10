import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // load .env files based on current mode (development, production, etc.)
  const env = loadEnv(mode, process.cwd(), '');

  // expose to client via VITE_ prefix
  const apiUrl = env.VITE_API_URL || 'http://localhost:5000';

  return {
    plugins: [
      react(),
      basicSsl(), // Enable HTTPS for camera/mic access via IP address
      nodePolyfills({
        // Whether to polyfill `node:` protocol imports.
        protocolImports: true,
      }),
    ],
    server: {
      host: true,
      https: true, // Enable HTTPS
      proxy: {
        '/socket.io': {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
    define: {
      // you can use this elsewhere if needed
      'process.env': {},
    },
    resolve: {
      alias: {
        // util is needed by simple-peer
        util: 'util',
      },
    },
  };
});
