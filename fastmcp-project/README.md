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

页面从 `https://unpkg.com` 加载固定版本的 `@modelcontextprotocol/ext-apps@0.4.0` SDK，该域名已在资源的 CSP 中声明，因此查看卡片需要能访问该 CDN。天气数据全部来自本地 Mock，Python 依赖仍只有 `fastmcp==3.2.4`，无需安装 `fastmcp[apps]`。

文件结构：

```text
server.py                    # 服务入口，调用 register_tools
tools/
  __init__.py                # 统一注册工具
  weather/
    __init__.py              # 两个天气工具和 HTML 资源注册
    mock_weather.py          # 共享 Mock 数据及文本格式化
    templates/weather.html   # 自定义天气卡片
tests/test_weather.py        # MCP 协议集成测试
```

运行天气工具测试：

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## 添加工具

在 `tools` 下新增工具模块，添加参数类型、返回类型和说明文档，通过 `tools/__init__.py` 中的 `register_tools` 统一注册，然后重启服务。天气工具的注册方式见 `tools/weather/__init__.py`。

参考：[FastMCP 快速开始](https://gofastmcp.com/getting-started/quickstart) · [自定义 HTML Apps](https://gofastmcp.com/apps/low-level) · [3.2.4 版本信息](https://pypi.org/project/fastmcp/3.2.4/)
