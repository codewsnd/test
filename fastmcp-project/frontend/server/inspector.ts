import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';

const HOST = '127.0.0.1';

function reservePort(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, HOST, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('无法分配 Inspector 端口。'));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve(address.port);
        }
      });
    });
  });
}

async function unusedPort(excluded: number[]): Promise<number> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    // Windows 的动态端口范围可能包含浏览器禁用端口（如 5060、6000）。
    const port = randomInt(20000, 60000);
    if (excluded.includes(port)) {
      continue;
    }
    try {
      return await reservePort(port);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EADDRINUSE' && code !== 'EACCES') {
        throw error;
      }
    }
  }
  throw new Error('无法为 Inspector 找到空闲端口。');
}

async function isReady(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/healthz`, { signal: AbortSignal.timeout(500) });
    return response.ok;
  } catch {
    // 子进程尚未监听，等待下一轮健康检查。
    return false;
  }
}

async function waitUntilReady(child: ChildProcess, url: string): Promise<void> {
  let startError: Error | undefined;
  const onError = (error: Error): void => { startError = error; };
  child.on('error', onError);
  try {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (startError || child.exitCode !== null) {
        throw startError ?? new Error('Inspector 已退出，请检查终端日志。');
      }
      if (await isReady(url)) {
        return;
      }
      await delay(250);
    }
    throw new Error('等待 Inspector 启动超时。');
  } finally {
    child.off('error', onError);
  }
}

interface InspectorPorts {
  web: number;
  sandbox: number;
  appOrigin: number;
}

async function allocatePorts(): Promise<InspectorPorts> {
  const web = await unusedPort([]);
  const sandbox = await unusedPort([web]);
  const appOrigin = await unusedPort([web, sandbox]);
  return { web, sandbox, appOrigin };
}

function inspectorEnvironment(ports: InspectorPorts, storage: string, token: string): NodeJS.ProcessEnv {
  const port = ports.web;
  const url = `http://${HOST}:${port}`;
  return {
    ...process.env,
    HOST,
    CLIENT_PORT: String(port),
    MCP_SANDBOX_PORT: String(ports.sandbox),
    MCP_APP_ORIGIN_PORT: String(ports.appOrigin),
    MCP_SANDBOX_FULL_ADDRESS: '',
    MCP_APP_ORIGIN_FULL_ADDRESS: '',
    MCP_AUTO_OPEN_ENABLED: 'false',
    MCP_INSPECTOR_API_TOKEN: token,
    DANGEROUSLY_OMIT_AUTH: 'false',
    MCP_STORAGE_DIR: storage,
    ALLOWED_ORIGINS: `${url},http://${HOST}:9090,http://localhost:9090`,
  };
}

export function officialInspector(root: string): Plugin {
  let child: ChildProcess | undefined;

  const stop = (): void => {
    if (child?.connected) {
      child.disconnect();
    }
    process.off('exit', stop);
  };

  const serve = async (server: ViteDevServer | PreviewServer): Promise<void> => {
    const ports = await allocatePorts();
    const url = `http://${HOST}:${ports.web}`;
    const token = randomBytes(32).toString('hex');
    const storage = join(root, '.inspector-local');
    await mkdir(storage, { recursive: true });
    child = spawn(process.execPath, [
      join(root, 'server', 'inspector-runner.mjs'),
      '--catalog', join(storage, 'catalog.json'),
    ], {
      cwd: root,
      env: inspectorEnvironment(ports, storage, token),
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      windowsHide: true,
    });
    process.once('exit', stop);
    server.httpServer?.once('close', stop);
    try {
      await waitUntilReady(child, url);
    } catch (error) {
      stop();
      throw error;
    }
    server.middlewares.use('/__inspector/session', (_request, response) => {
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(JSON.stringify({ url, token }));
    });
  };

  return {
    name: 'official-mcp-inspector',
    configureServer: serve,
    configurePreviewServer: serve,
    closeBundle: stop,
  };
}
