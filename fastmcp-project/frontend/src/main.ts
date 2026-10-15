import './style.css';

interface InspectorSession {
  url: string;
  token: string;
}

const frame = document.querySelector<HTMLIFrameElement>('#inspector')!;
const errorMessage = document.querySelector<HTMLParagraphElement>('#error')!;

async function loadInspector(): Promise<void> {
  errorMessage.hidden = true;
  try {
    const response = await fetch('/__inspector/session', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Inspector 启动失败，请查看前端终端日志。');
    }
    const session: InspectorSession = await response.json();
    const url = new URL(session.url);
    url.search = new URLSearchParams({
      MCP_INSPECTOR_API_TOKEN: session.token,
      serverUrl: 'http://127.0.0.1:8000/mcp',
      transport: 'http',
      autoConnect: session.token,
    }).toString();
    // 默认连接本地天气服务，所有可见交互由官方 Inspector 提供。
    frame.src = url.href;
  } catch (error) {
    errorMessage.textContent = error instanceof Error ? error.message : '无法打开 Inspector。';
    errorMessage.hidden = false;
  }
}

void loadInspector();
