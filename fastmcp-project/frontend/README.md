# MCP Inspector 本地界面

Vite 固定提供 `http://127.0.0.1:9090` 入口，全屏加载本地安装的 MCP Inspector `2.11.0` 官方页面。没有额外地址栏；Inspector 的布局、样式、Tools、Apps 和 Network 均使用官方实现。

## 启动

首次安装或锁文件更新后，在本目录执行：

```powershell
mise.exe exec node@24.18.0 -- npm.cmd ci
```

先在上一级 `fastmcp-project` 目录启动 MCP 服务，并保持终端运行：

```powershell
.\.venv\Scripts\fastmcp.exe run server.py:mcp --transport http --host 127.0.0.1 --port 8000
```

另开终端，在本目录启动界面：

```powershell
mise.exe exec node@24.18.0 -- npm.cmd run dev
```

打开 `http://127.0.0.1:9090`。配置好 Node 24.18.0 的终端也可以直接执行 `npm run dev`。启动只使用本地依赖，不执行 npx 或 npm install。

## 测试工具

1. 页面默认连接 `http://127.0.0.1:8000/mcp`。管理其他 MCP 服务可使用官方 **Servers** 页。
2. 在官方 **Tools** 页选择 `get_weather_text`，填写 `city` 后执行，查看文本结果。
3. 在官方 **Apps** 页选择 `get_weather_app`，填写 `city`，点击 **Open App** 查看天气卡片。卡片内也可切换城市查询。

连接与工具错误由 Inspector 原界面显示，工具需要手动执行。

## 构建和预览

```powershell
mise.exe exec node@24.18.0 -- npm.cmd run build
mise.exe exec node@24.18.0 -- npm.cmd run preview
```

开发与预览入口均为 `9090`，不能同时运行。按 Ctrl+C 停止前端时，会关闭它启动的 Inspector。后端 FastMCP 在自己的终端停止。

## 实现说明

- `index.html`、`src/main.ts`、`src/style.css` 只负责全屏承载官方页面的 iframe，不注入或覆盖 Inspector 样式。
- `server/inspector.ts` 通过 Vite 插件启动本地 Inspector；内部服务及官方 Apps 沙箱使用独立的本机端口，浏览器访问入口保持 `9090`。认证 token 每次启动随机生成。
- `server/inspector-runner.mjs` 在 Vite 退出或重新加载配置时关闭 Inspector。
- Inspector 的服务器目录与状态保存在 `.inspector-local/`，已忽略提交。
- `@modelcontextprotocol/ext-apps` `0.4.0`、`@modelcontextprotocol/sdk` `1.32.1` 保持原版本；Inspector 自己的内部依赖由 npm 独立解析。
- `scripts/build-weather-sdk.mjs` 将本地固定版本 SDK 打包到 `../tools/weather/vendor/weather-app-sdk.js`，包含许可证。Python 将产物内联到 MCP HTML 资源，天气卡片无需 CDN 或独立 SDK 静态服务。
- `npm run dev` 和 `npm run build` 会自动生成本地 SDK；也可单独执行 `npm run build:sdk`。这些命令不安装或更新依赖。
- 官方 Inspector 的字体仍沿用原有加载方式；天气卡片本身不请求外网。

`dist/` 包含官方页面的全屏入口。运行需要本地 Inspector 后台，请使用 `npm run preview`，不能只把 `dist/` 放到纯静态服务器上。
