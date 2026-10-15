import { defineConfig } from 'vite';
import { officialInspector } from './server/inspector.ts';

const server = { host: '127.0.0.1', port: 9090, strictPort: true };

export default defineConfig({
  plugins: [officialInspector(import.meta.dirname)],
  server,
  preview: server,
});
