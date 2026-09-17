import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // HMR can be disabled in hosted sandboxes via DISABLE_HMR.
      // Do not modify; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // 允许受限内嵌环境（origin 为 null 的沙箱 iframe / 内置浏览器容器）加载模块脚本，
      // 否则浏览器会因缺少 Access-Control-Allow-Origin 直接白屏。
      cors: true,
    },
  };
});
