// IPC 在 Vite 退出或配置重载时断开，避免留下 Inspector 后台进程。
process.once('disconnect', () => {
  if (process.listenerCount('SIGTERM') > 0) {
    process.emit('SIGTERM');
  } else {
    process.exit(0);
  }
});

const { runWeb } = await import('@modelcontextprotocol/inspector/clients/web/build/index.js');
await runWeb([process.execPath, process.argv[1], ...process.argv.slice(2)]);
