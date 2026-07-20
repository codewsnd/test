# ChatGPT-like Application with Spring Boot 3 and React 18

This application implements a ChatGPT-like interface with Spring Boot 3 as the backend and React 18 as the frontend, using Server-Sent Events (SSE) for real-time communication.

## Features
- Chat interface with conversation history
- Real-time message streaming using SSE
- Conversation management (create new, switch between conversations)
- Local storage of conversation history
- Ant Design 5 for UI components

## Technologies Used
- **Backend**: Spring Boot 3
- **Frontend**: React 18, Ant Design 5, Vite
- **Communication**: Server-Sent Events (SSE)
- **Storage**: Browser localStorage

## Getting Started

### Prerequisites
- Java 21 or higher
- Node.js 18 or higher
- Maven
- npm

### Running the Backend (Spring Boot 3)
1. Navigate to the springboot3 directory:
   ```
   cd springboot3
   ```
2. Run the Spring Boot application:
   ```
   mvn spring-boot:run
   ```
   The backend server will start on http://localhost:8080

### Running the Frontend (React 18)
1. Navigate to the vite-project-react18 directory:
   ```
   cd vite-project-react18
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Run the development server:
   ```
   npm run dev
   ```
   The frontend server will start on http://localhost:5173

### Accessing the Application
Open your browser and navigate to http://localhost:5173/chat to access the chat interface.

## How It Works
1. **Frontend**: The React application provides a chat interface with conversation history on the left and the chat area on the right.
2. **Backend**: The Spring Boot application handles SSE connections and simulates AI responses.
3. **Communication**: When a user sends a message, the frontend establishes an SSE connection with the backend. The backend sends responses chunk by chunk, simulating a real-time typing effect.
4. **Storage**: Conversation history is stored in the browser's localStorage.

## Notes
- This is a demo application with simulated AI responses.
- In a production environment, you would replace the simulated responses with actual AI model integration.
- The application uses CORS configuration to allow cross-origin requests between frontend and backend.

## CopyTest 前端组件

### 组件定位

`CopyTest` 位于 `vite-project-react18/src/pages/home/components/copyTest`，是一个“Confluence 文案与 UI 截图核对”工作台。它读取 Confluence 页面中的表格，让用户选择需要核对的文案列和逻辑行，结合截图生成 `Test Result`、`Test Evidence` 两列，并将当前列的结果和 Evidence 附件回写到 Confluence。

组件以接近全屏的 Modal 展示，支持两种入口：

- 聊天回复中的 `copytest` 代码块会渲染 Copy Test 入口卡片；带有 `copyTestResultUpdater` 工具调用的 `copydeck` 回复也会切换到该入口，没有代码块时聊天卡片会提供兜底入口。
- `/copyTest` 可直接打开组件，关闭后返回 `/chat`。聊天中存在多个入口卡片时，作用域标记会确保只打开被点击的那一个实例。

### 主要使用流程

1. **导入 Confluence 页面**：输入 `http` 或 `https` URL 后，组件读取页面 Storage HTML，解析其中有效的顶层表格，并按需加载已有 CopyTest Evidence 附件作为预览图。有效表格至少要包含表头、一行数据和一个非空表头。
2. **选择表格和文案列**：导入成功后默认选中第一张表。`Comparison Column` 会过滤空表头和 CopyTest 已生成列；同名表头会附带实际列号以便区分。
3. **选择待校验行**：选择文案列后，组件在浏览器内的工作副本中确保存在 `Test Result - <列名>` 和 `Test Evidence - <列名>`。文案非空的行默认全选，空行不可选；带 `rowspan` 的来源单元格会作为不可拆分的逻辑行组处理。
4. **准备截图**：上传弹窗支持多选、缩略图、大小统计和移除操作。截图只先读入浏览器内存，转换为 Base64，按 MD5 内容去重，并使用 UUID 生成不会冲突的附件名。单次最多 50 张、总大小最多 10 MB，只接受图片文件。
5. **执行校验**：`Validate` 会把选中行的期望文案和全部截图交给校验接口。返回值必须严格逐行对应请求，且只能包含 `rowIndex`、`passed`、`evidenceImageFileNames`、`languageIssues`；Evidence 文件名也必须来自本次截图。
6. **预览和调整结果**：选择文案列后，预览区只显示“勾选列 + 来源列 + Result + Evidence”。Result 使用绿色 `Passed:` 或红色 `Failed:`，失败项会列出问题说明；Evidence 按 `Screen01`、`Screen02` 编号。图片可放大预览，也可在确认后删除，删除会同步清理相关 Result 引用并重新规划受影响的 Evidence 分组。
7. **回写 Confluence**：存在本地校验或删除变更后，用户可确认导出。组件只回写当前 Comparison Column 所属的 Result/Evidence 列及其实际引用图片，其他表格、来源列和人工内容保持不变。

### 表格与 Evidence 处理规则

- 未选择 Comparison Column 时预览完整原表；选择后聚焦来源列及其 Result/Evidence 双列，并提供全选、逐行选择和固定底部横向滚动条。
- 每个来源列通过 schema、列类型、source key 和 owner metadata 独立认领自己的生成双列，不会仅凭相似标题接管人工列。
- 更新结果时只替换 CopyTest 标记的受管内容，生成列单元格中的人工内容会保留。
- Evidence 按上传顺序去重。物理连续且共享至少一张截图的逻辑行组会合并为一个 Evidence 单元格，但每行 Result 只引用该行实际命中的 Screen。
- 预览会将附件 Base64 转为临时 Blob URL，并清理导入 HTML 中的脚本、内联事件和 `javascript:` URL；这些 Blob URL 会在更新或卸载时释放。

### 导出保护

- 导出只使用最近一次成功导入的 URL；如果输入框中的 URL 已改变，导出按钮会被禁用。
- POST 前会连续读取两次最新 Confluence Storage。两次内容发生变化时，会在第二份内容上重新应用一次当前 Result/Evidence pair；若表格、来源文案或合并结构已无法安全匹配，则停止导出并要求重新导入。
- 导出补丁通过一次性 scope 及严格 ownership metadata 限定目标，只收集当前 pair 实际引用且内存中有内容的附件。
- 导出成功后仅清除当前 pair 的待导出状态，其他表格或来源列尚未导出的本地变更仍保留。

### 当前实现注意事项

- `COPY_TEST_AI_CHAT_MOCK_ENABLED` 当前硬编码为 `true`，所以校验结果由随机 Mock 生成，并不会真正识别截图内容。Mock 等待约 300 ms 后为每行随机选择 0～2 张 Evidence；关闭该开关后才会调用配置为 `gpt-5.4` 的真实 `aiChat` 流程。
- URL 校验目前只检查是否为合法的 `http`/`https` URL，不校验 Confluence 域名。
- 会话、工作表和图片都只保存在组件内存中，没有写入 `localStorage`。组件仍挂载时关闭再打开会保留已导入表格和本地结果，但会清空未校验截图和图片预览；组件卸载后状态丢失。
- 没有有效 Evidence 图片的结果不会留下可见的 Result/Evidence 内容。
- 双读和单次 rebase 可以降低误覆盖风险，但第二次读取与 POST 之间仍存在并发窗口；当前没有使用 ETag、页面版本号或条件更新实现原子写入。

### 后端接口

接口基础地址由 `VITE_API_SPRINGBOOT3_BACKEND_URL` 配置，每个请求都会携带当前 `staffId`：

- `GET /api/chatbycard/copydeck/storage`：读取 Confluence Storage HTML。
- `POST /api/chatbycard/copydeck/getAttachments`：读取已有 CopyTest Evidence 附件。
- `POST /api/chatbycard/copydeck/upload`：回写完整 Storage HTML 和当前结果实际引用的附件。

核心实现由 `CopyTest.tsx`、`hooks/useCopyTestController.ts`、`hooks/useCopyTestSession.ts`、`components/TablePreview.tsx` 以及 `table/` 下的解析、编辑和导出模块共同组成。
