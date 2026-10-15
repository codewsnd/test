# FastMCP 项目

基于 Python 和 FastMCP `3.2.4` 的 MCP 服务，提供 `add(a, b)` 和两个 Mock 天气查询工具。

## 环境要求

- Python 3.10 或更高版本。
- 使用 Python 自带的 `venv` 创建独立虚拟环境。

## 创建环境并安装依赖

在仓库根目录执行：

```powershell
cd fastmcp-project
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

后续 Windows 命令直接使用虚拟环境中的解释器，无需激活环境。可选激活命令为 `.\.venv\Scripts\Activate.ps1`。

macOS / Linux：

```bash
cd fastmcp-project
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

如果系统只有 `python3` 命令，可用 `python3 -m venv .venv` 创建环境。

## 启动服务

以下命令均在 `fastmcp-project` 目录执行。

### STDIO 模式

```powershell
.\.venv\Scripts\python.exe server.py
```

STDIO 模式由 MCP 客户端通过标准输入输出通信；手动运行时会等待客户端请求，不提供 HTTP 地址。

### HTTP 模式

```powershell
.\.venv\Scripts\fastmcp.exe run server.py:mcp --transport http --host 127.0.0.1 --port 8000
```

MCP 地址：`http://127.0.0.1:8000/mcp`。这是 MCP 协议端点，需要使用 MCP 客户端访问。端口占用时可以修改 `--port`。

macOS / Linux 激活环境后，对应命令为：

```bash
python server.py
# 或使用 HTTP 模式：
fastmcp run server.py:mcp --transport http --host 127.0.0.1 --port 8000
```

## 配置 MCP 客户端

支持 `mcpServers` 配置格式的客户端可参考以下 Windows 示例；路径需要对应本机项目位置：

```json
{
  "mcpServers": {
    "fastmcp-project": {
      "command": "D:/github/test/fastmcp-project/.venv/Scripts/python.exe",
      "args": ["D:/github/test/fastmcp-project/server.py"]
    }
  }
}
```

## 本地 MCP Inspector 官方界面（9090）

前端项目位于 `frontend/`，使用 Vite 全屏加载本地安装的 MCP Inspector `2.11.0` 官方界面。依赖固定在 `package-lock.json`，日常启动不再通过 npx 下载 Inspector。现有 `@modelcontextprotocol/ext-apps` `0.4.0` 和 `@modelcontextprotocol/sdk` `1.32.1` 保持不变。

首次拉取项目时，在前端目录安装依赖：

```powershell
cd frontend
mise.exe exec node@24.18.0 -- npm.cmd ci
cd ..
```

在 `fastmcp-project` 目录启动后端，并保持终端运行：

```powershell
.\.venv\Scripts\fastmcp.exe run server.py:mcp --transport http --host 127.0.0.1 --port 8000
```

另开终端，在前端目录启动界面：

```powershell
cd frontend
mise.exe exec node@24.18.0 -- npm.cmd run dev
```

打开 `http://127.0.0.1:9090`。`npm run dev` 启动本地 Vite 与 Inspector，不安装或下载 npm 依赖。浏览器入口固定为 `9090`，被占用时会报错，不会自动切换。

- 页面默认连接 `http://127.0.0.1:8000/mcp`，只显示官方界面；管理其他服务可使用官方 **Servers** 页。
- 官方 **Tools** 页：选择 `get_weather_text`，填写 `city` 并执行，查看普通文本结果。
- 官方 **Apps** 页：选择 `get_weather_app`，填写 `city` 并点击 **Open App**，查看 HTML 天气卡片。
- Inspector 的布局、样式、Network 面板及交互直接使用官方实现，没有修改依赖包源码。
- 使用完后，分别在前后端终端按 Ctrl+C；前端停止时会一并关闭它启动的 Inspector。

前端构建和独立预览见 [frontend/README.md](frontend/README.md)。天气卡片的 SDK 使用本地打包产物，不请求 CDN；Inspector 官方页面字体仍沿用其原有加载方式。下面的 FastMCP Apps 和 Inspector 是可选的手动调试方式。

## 使用 FastMCP 自带的 Apps 预览界面

在项目目录执行以下 PowerShell 命令，不需要大模型或模型 API Key：

```powershell
# 首次使用时安装开发预览依赖，保持 FastMCP 版本不变
.\.venv\Scripts\python.exe -m pip install "fastmcp[apps]==3.2.4"

# 同时启动 MCP 服务和浏览器预览界面
.\.venv\Scripts\fastmcp.exe dev apps server.py:mcp --mcp-port 8000 --dev-port 8088 --no-reload
```

浏览器会自动打开 `http://localhost:8088`。选择 `get_weather_app`，填写城市并提交即可打开天气卡片；界面还会加载 npm/CDN 上的前端资源，因此需要网络访问。端口已被占用时可以修改 `--mcp-port` 或 `--dev-port`。

该命令关闭自动重载，修改 Python 代码后需要按 `Ctrl+C` 停止并重新启动。

### Windows 启动时报 WinError 2

FastMCP `3.2.4` 默认开启自动重载，其重载子进程通过 `PATH` 查找 `fastmcp` 命令。直接运行 `.\.venv\Scripts\fastmcp.exe` 不会自动把 `.venv\Scripts` 加入 `PATH`，可能导致 `FileNotFoundError: [WinError 2]`。

上面的 `--no-reload` 可以绕过这个问题。需要保留自动重载时，先激活虚拟环境，再运行：

```powershell
.\.venv\Scripts\Activate.ps1
fastmcp dev apps server.py:mcp --mcp-port 8000 --dev-port 8088
```

## 使用 Inspector 测试普通文本工具

保持 FastMCP Apps 预览运行（其 MCP 服务监听 `8000`），另开一个 PowerShell，在本项目目录执行：

```powershell
mise.exe exec node@24.18.0 -- npx.cmd -y "@modelcontextprotocol/inspector@latest" --server-url "http://127.0.0.1:8000/mcp" --transport http
```

打开终端打印的完整浏览器链接，连接服务，进入 `Tools`，选择 `get_weather_text`，填写 `city` 为 `上海` 后调用。`Apps` 页面也可以测试 `get_weather_app` 的 HTML 卡片。

PowerShell 中使用 `mise.exe` 直接调用程序，避免 `mise` 包装函数影响 `--` 参数分隔符。请完整复制代码块内的一行命令，URL 应为普通文本，不要粘贴 Markdown 链接格式，也不要在行尾添加反斜杠 `\`。

本目录的 `mise.toml` 单独指定 Node `24.18.0`，避免继承仓库根目录的 Node `22.9.0`；本次验证的 Inspector 版本为 `2.11.0`，要求 Node 至少为 `22.19.0`。未使用 mise 的环境可以在满足要求的 Node 环境中直接运行上述 `npx` 命令。

### Inspector 提示 Cannot find native binding

这是 Inspector 的 Node 依赖加载问题。排查时应查看完整错误中的 `cause`，确认具体缺少的包，不要据此删除本仓库其他项目的 `package-lock.json` 或 `node_modules`。

本机此次错误来自 npx 缓存缺少 `@rolldown/binding-win32-x64-msvc@1.2.14`，已按缓存内 `rolldown` 的版本补齐。与此独立的 Node 版本问题，通过上面的 `mise.exe exec node@24.18.0` 命令解决。

## 验证安装

```powershell
.\.venv\Scripts\python.exe -c "from importlib.metadata import version; print(version('fastmcp'))"
.\.venv\Scripts\python.exe -m pip check
```

版本输出应为 `3.2.4`。

## Mock 天气工具

| 工具 | 参数 | 返回方式 |
| --- | --- | --- |
| `get_weather_text` | `city`，默认 `北京` | 普通文本，包含天气、温度、体感、温度范围、湿度和风况 |
| `get_weather_app` | `city`，默认 `北京` | MCP Apps 自定义 HTML 天气卡片，同时返回文本摘要和结构化数据 |

支持 `北京`、`上海`、`广州`、`深圳`、`杭州`，也接受 `北京市` 和城市名前后的空格。
空城市或不支持的城市会返回明确的工具错误。所有数据均为固定 Mock 数据，不访问天气 API，不需要 API Key，也不代表实时天气。

调用示例（MCP `tools/call` 的参数）：

```json
{"name": "get_weather_text", "arguments": {"city": "上海"}}
```

```json
{"name": "get_weather_app", "arguments": {"city": "杭州"}}
```

HTML 工具通过 `AppConfig(resource_uri="ui://weather/view.html")` 关联卡片资源，资源 MIME 类型为 `text/html;profile=mcp-app`。宿主读取 HTML 后，通过 MCP Apps SDK 将本次调用的 `structuredContent` 传给页面；不同调用不会共享可变的天气状态。页面还可以通过 `app.callServerTool()` 切换城市。

卡片需要支持 MCP Apps 的客户端。不支持的客户端仍可读取工具返回的普通文本摘要；直接在浏览器打开 HTML 会显示客户端使用提示。

天气卡片使用本地 `tools/weather/vendor/weather-app-sdk.js`，由固定版本的 `@modelcontextprotocol/ext-apps@0.4.0` 打包生成。Python 读取此文件并内联到 MCP HTML 资源，因此卡片不请求 `unpkg.com`，无需额外 SDK 静态服务，也不受 MCP 服务端口变化影响。资源 CSP 的 `resourceDomains`、`connectDomains` 均为空，天气数据仍全部来自 Mock。

本地 SDK 产物随项目保存；Python 运行时无需 Node。需要重新生成时，在 `frontend/` 执行 `npm run build:sdk`，`npm run dev` 和 `npm run build` 也会自动执行该步骤，只使用已安装的本地依赖。

文件结构：

```text
server.py                    # 服务入口，调用 register_tools
tools/
  __init__.py                # 统一注册工具
  weather/
    __init__.py              # 两个天气工具和 HTML 资源注册
    mock_weather.py          # 共享 Mock 数据及文本格式化
    templates/weather.html   # 自定义天气卡片
    vendor/weather-app-sdk.js # 本地 SDK，随 HTML 资源内联返回
tests/test_weather.py        # MCP 协议集成测试
```

运行天气工具测试：

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## 添加工具

在 `tools` 下新增工具模块，添加参数类型、返回类型和说明文档，通过 `tools/__init__.py` 中的 `register_tools` 统一注册，然后重启服务。天气工具的注册方式见 `tools/weather/__init__.py`。

参考：[FastMCP 快速开始](https://gofastmcp.com/getting-started/quickstart) · [自定义 HTML Apps](https://gofastmcp.com/apps/low-level) · [3.2.4 版本信息](https://pypi.org/project/fastmcp/3.2.4/)
