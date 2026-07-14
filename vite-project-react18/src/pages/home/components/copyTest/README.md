# CopyTest 组件说明

## 1. 组件定位

`copyTest` 是一套面向 Confluence Copy Deck 的前端文案验收工具，不是通用的剪贴板复制组件。它负责：

1. 通过现有 API 读取 Confluence 页面的 Storage HTML 和已使用的附件。
2. 解析页面中的顶层表格，并将 `rowspan` / `colspan` 展开为二维逻辑网格。
3. 让用户选择 Comparison Column 和不可拆分的来源行组。
4. 使用截图对选中文案执行 AI 校验。
5. 为当前来源列生成并维护两列受控数据：
   - `Test Result - {Comparison Column}`
   - `Test Evidence - {Comparison Column}`
6. 导出前重新读取最新 Storage，只回写当前来源列拥有的 Test 双列。

当前实现只修改 `copyTest` 前端目录，不更改后端契约。设计目标是正确处理复杂合并单元格、隔离不同来源列的 Test 双列、最小化 Confluence Storage 改动，并控制大表格预览的内存与渲染开销。

## 2. 核心保证

- 空 header 不会出现在 Comparison Column 下拉框中。
- 来源单元格覆盖的全部物理行构成一个原子行组，选择、Result、Evidence 和删除操作都不会切开该组。
- A 来源列和 B 来源列通过严格 schema 2 ownership 隔离；A 的校验、合并、删除和导出不会认领 B 的 Test 双列。
- 生成列必须同时通过 `schema + owner + source + type` 验证才是 managed 数据；标题相似不代表 ownership。
- Evidence 跨行只由 `evidenceRowSpan` 和 `hideEvidenceCell` 组成的显式分组决定。
- Evidence 附件只识别 `ac:image` 直接包含 `ri:attachment[ri:filename]` 的规范结构。
- 导出从最新 Storage 开始做 raw range patch。除当前目标 Pair 外，来源表格、其他 Test Pair、人工列和表格外内容保持原始字节。
- 图片内容不写入 working table，也不复制进 iframe `srcDoc`；预览使用去重后的 Object URL。

## 3. 用户流程与输入错误

```text
输入 Confluence URL
  -> Import 最新 Storage/附件
  -> 选择 Table
  -> 选择 Comparison Column
  -> 选择原子来源行组
  -> 上传截图并 Validate
  -> 复核 Result/Evidence
  -> Export 前重新读取最新 Storage
  -> 冲突检查、当前 Pair raw patch、图片整理
  -> 调用现有上传 API
```

URL 只接受可由浏览器 `URL` 解析的 `http:` 或 `https:` 地址。错误显示在 URL 输入框底部，文案是 UI 契约的一部分：

| 场景 | 输入框底部文案 |
| --- | --- |
| URL 格式无效 | `In valid URL format, Please enter a valid Http:// or https:// URL` |
| Storage 中没有有效表格 | `No valid table found` |
| Storage 或附件导入失败 | `Failed to load Confluence tables` |

所有 Import 错误统一显示在 URL 输入框底部，不使用全局 message。成功导入也不显示 `Loaded N table(s)` 提示。有效表格至少包含一行 header、一行数据、一个逻辑列，并且存在一个非空 header。输入框存在 URL/表格错误时，表格选择器和预览区整体隐藏。用户修改输入并清除错误后，已加载的工作状态可重新显示。导出只使用最后一次成功导入的 URL；输入已变更但尚未重新导入时，导出按钮不可用。

## 4. 架构与职责

| 模块 | 主要职责 |
| --- | --- |
| `CopyTest.tsx` | 组合主弹窗、选择器、预览、上传和确认弹窗 |
| `hooks/useCopyTestController.ts` | 编排导入、校验、删除、二次读取和导出请求 |
| `hooks/useCopyTestSession.ts` | 提供表格会话领域操作和每个 Pair 的图片快照 |
| `hooks/copyTestSessionReducer.ts` | 以纯 reducer 管理 Storage、表格、选择和 revision |
| `api/copyTestApi.ts` | 调用现有接口、切换 AI/mock，并严格校验 AI 结果 |
| `prompt/copyTestValidationPrompt.ts` | 定义唯一 AI 输出形状和 prompt |
| `mock/validationMock.ts` | 按同一契约生成真实随机的校验结果 |
| `table/tableModel.ts` | 把 Storage/table DOM 转为基础行、列和 slot 模型 |
| `table/copyTestGridModel.ts` | 构建纯 TypeScript 的二维 span grid，并投影来源列原子行组 |
| `table/copyTestTableParser.ts` | 解析有效表格、Comparison Column 上下文和校验输入 |
| `table/copyTestTableEditor.ts` | 创建受控双列、写入校验结果、应用显式 Evidence 分组和删除证据 |
| `table/copyTestStoragePatch.ts` | 扫描顶层 table/tr/th/td 的 raw range，执行最小字符串 patch |
| `table/copyTestExportScope.ts` | 生成并校验单次导出的 128-bit 临时 scope token |
| `table/copyTestTableExporter.ts` | 在最新 Storage 中定位表格、检查冲突并构建当前 Pair patch |
| `table/copyTestTableImages.ts` | 解析规范附件节点、整理当前 Pair 图片并构建上传 payload |
| `components/TablePreview.tsx` | 安全 iframe 预览、增量选择同步、图片事件和固定横向滚动条 |

状态分为三层：

- Session：完整工作 Storage、各表 `originalHtml` / `workingHtml` / model、当前表/列/行选择，以及与 HTML 分离的附件预览 registry。
- Upload：本次待校验图片、MD5、大小和准备状态。
- Controller：URL、请求状态、导入错误、弹窗、图片预览和删除目标。

Validate 和 Evidence 删除只修改浏览器内的 `workingHtml`。只有用户确认 Export 后才会调用现有上传 API。

## 5. 表格与合并单元格模型

### 5.1 顶层表格和纯几何 Grid

系统只把 Storage 中的顶层 `<table>` 作为独立 CopyTest 表格，嵌套表格仍属于其外层单元格内容。第一行用于构建 header，后续行是数据行。

`copyTestGridModel.ts` 中的核心结构与当前代码一致：

```ts
interface CellRegion {
  cellId: string;
  colEnd: number;
  colStart: number;
  rowEnd: number;
  rowSpan: number;
  rowStart: number;
}

interface CopyTestGridSlot {
  cell: CellRegion;
}

interface CopyTestSpanGrid {
  columnCount: number;
  rowCount: number;
  slots: readonly (readonly CopyTestGridSlot[])[];
}

interface RowGroup {
  anchorRowIndex: number;
  coveredRowIndexes: readonly number[];
  rowSpan: number;
}

interface SourceProjection {
  groups: readonly RowGroup[];
}
```

Grid 只负责单元格的几何落位和覆盖关系。每个 slot 直接指向覆盖它的 `CellRegion`；来源列投影依靠 `rowStart` / `rowEnd` 构建不可拆分行组。单元格即使从更左侧列开始，只要横向覆盖当前 Comparison Column，也能被投影为该列的来源行组。

投影到表格业务层后，`CopyTestRowGroup` 只包含：

```ts
interface CopyTestRowGroup {
  anchorRowIndex: number;
  dataRowIndexes: number[];
  rowSpan: number;
}
```

来源文案在构建校验输入时从 `tableModel` 读取；空文案来源行组在生成可选行下标时动态排除。UI 和 API 使用去掉 header 后的零基数据行下标，所有写入都先映射回行组的 `anchorRowIndex`。

Grid 要求 span 为正整数、单元格不重叠且逻辑行无空洞。导出时如果 raw range、DOM 模型或几何拓扑无法唯一对齐，流程会拒绝写入，而不会猜测修改位置。

### 5.2 Header 规则

- header 保留从 Storage 读取的真实文本；空 header 不会被伪造成 `Column N`。
- 空 header 不进入 Comparison Column 下拉框。
- 标题以 `Test Result -` 或 `Test Evidence -` 开头的列不作为 Comparison Column 候选项。
- 标题前缀只用于 UI 候选列过滤，不用于认领生成列。

## 6. Result 与 Evidence 的行组规则

### 6.1 Result 始终镜像来源行组

如果所选来源列中第 1～3 行是一个 `rowspan="3"` 单元格，那么这三行是一个原子行组：

- 只能整体选择或取消选择。
- 只产生一个 Result 单元格，`rowspan="3"`。
- 未跨组合并时，该组对应一个 Evidence 单元格，`rowspan="3"`。
- Validate、清空和 Evidence 删除都以这三行为整体计算影响范围。

来源单元格的左上角不必落在当前列。例如，一个从更左侧开始、同时横向覆盖 Target 列且 `rowspan="4"` 的单元格，会投影为 Target 的一个四行原子组；其 Result 和基础 Evidence 都覆盖完整四行。

### 6.2 Evidence 只使用显式分组

AI 结果中，Evidence 分组必须由一个锚点和若干续行完整表达：

- 锚点：`hideEvidenceCell=false`，必须包含正整数 `evidenceRowSpan`。
- 续行：`hideEvidenceCell=true`，必须省略 `evidenceRowSpan`。
- 续行数量必须精确等于 `evidenceRowSpan - 1`。
- 同一组的图片文件名列表必须完全相同且顺序一致。

`evidenceRowSpan` 计数单位是连续选中的来源行组，不是物理 `<tr>` 数量。Evidence 最终写入 HTML 的 `rowspan` 是这些完整来源行组 `rowSpan` 的总和。

例如，两个连续来源组的物理跨度分别为 3 和 2：

```text
Result group 1 rowspan = 3
Result group 2 rowspan = 2
Evidence evidenceRowSpan = 2 groups
Evidence physical rowspan = 3 + 2 = 5
```

因此 Evidence 不会停在某个来源合并单元格的中间。除上述明确分组外，编辑器不根据相邻内容、图片集合或标题自动合并 Evidence。

## 7. 严格 schema 2 Ownership 与 A/B 双列隔离

来源列 key 的格式为：

```text
{逻辑列下标}:{去除首尾空白并折叠连续空白后的完整 header}
```

新生成的 header 和数据单元格都带有四个 ownership 属性：

```html
data-copy-test-schema="2"
data-copy-test-owner-id="{sourceColumnKey}"
data-copy-test-source-column-key="{sourceColumnKey}"
data-copy-test-column-type="result|evidence"
```

只有在以下条件同时成立时，解析器才会将单元格识别为 managed Result/Evidence：

1. `data-copy-test-schema` 精确等于 `2`。
2. `data-copy-test-source-column-key` 非空。
3. `data-copy-test-owner-id` 与 source key 完全一致。
4. `data-copy-test-column-type` 精确为 `result` 或 `evidence`。

这些规则保证：

- A 列只查找、创建、合并、清空和删除 A key 对应的 Result/Evidence。
- B 列使用独立 key；A 的 `rowspan` 变化不会删除或重排 B 的 managed cells。
- Evidence 删除只扫描当前 source key，并把受影响范围对齐到当前来源行组边界。
- 导出只生成当前 source key 的 header/data cell patch。
- 只有标题、不具备完整 ownership 的人工 Test 列始终属于 non-managed 数据；CopyTest 不会复用、覆盖、合并或删除其内容。

每次导出会生成独立的 128-bit 安全 token，并只给当前表、当前 Pair 临时添加 `data-copy-test-export-scope="copytest-{token}"`。图片流水线只接受本次调用传入的完全相同 token。scope 属性会在最终 payload 中移除，不持久化到 Confluence。

## 8. 严格 AI 数组契约与随机 Mock

### 8.1 请求与唯一返回形状

`copyTestValidationApi` 向 `aiChat` 发送：

- 模型名：`gpt5.4`。
- 上传截图：必须是 `data:image/...;base64,...` 形式的 data URL。
- prompt 行：只包含 `rowIndex` 和 `expectedText`。
- 图片标识：使用本次上传的 `fileName`。

AI 内容必须是一个可直接 `JSON.parse` 的顶层数组，不能带 Markdown 代码围栏，也不能包装在其他对象中。结果数量、顺序和每个 `rowIndex` 必须与请求行完全一致。

唯一允许的字段是：

| 字段 | 约束 |
| --- | --- |
| `rowIndex` | 必填的非负整数，且必须保持请求顺序 |
| `passed` | 必填布尔值 |
| `evidenceImageFileNames` | 可选的非空、无重复字符串数组；每个文件名必须来自本次上传截图 |
| `evidenceRowSpan` | Evidence 锚点必填的正整数；续行必须省略 |
| `hideEvidenceCell` | 必填布尔值；锚点为 `false`，续行为 `true` |
| `languageIssues` | 可选的非空、无重复问题数组；`passed=false` 时必填，`passed=true` 时禁止 |

任何未声明字段、类型错误、空数组、重复数组项、未上传的 Evidence 文件名、行数/顺序不一致或非法 Evidence 分组都会使整批结果失败。

### 8.2 当前 Mock 开关

```ts
export const COPY_TEST_AI_CHAT_MOCK_ENABLED = true;
```

当前开关为 `true`。除 Vitest 的 `test` 模式外，`copyTestValidationApi` 会先保留 300 ms 可感知 loading，然后返回符合同一严格契约的随机结果，不调用 `aiChat`。

随机 Mock 的行为包括：

- 每行以 65% 概率通过。
- 只按 `selected_rows` 中连续的来源原子组构建 Evidence 分组，每组最多覆盖 3 个请求行；物理 `rowIndex` 因 rowspan 跳号不会中断逻辑分组。
- 有上传图片时，每组随机选择 1～2 张不重复图片；无图片时省略图片字段。
- 失败行会从真实测试问题文案中随机选择一条。
- 锚点/续行、图片列表和 `evidenceRowSpan` 始终符合严格分组规则。

将该开关设为 `false` 后，校验流程使用真实 `aiChat`，并对返回文本执行相同的严格解析。

## 9. 最新 Storage Raw Patch 与 Rebase

### 9.1 为什么不回传整张 working table 的序列化结果

DOM `outerHTML` 序列化会改变属性顺序、namespace 写法、空标签和未编辑单元格格式。直接替换整张表也会覆盖用户在导入后对 Confluence 做的其他修改。因此导出在最新 raw Storage 上只替换当前 Pair 的单元格 range。

### 9.2 导出流程

1. 第一次 GET 最新 Confluence Storage，作为候选 patch 基线。
2. 扫描所有顶层 table/tr/th/td raw range；扫描器会跳过注释、CDATA、引号内的 `>` 和嵌套 table 的内部行列。
3. 使用 non-managed header、物理行数和 non-managed span 拓扑构造表格定位签名。导入时的 table index 只用于调整候选检查顺序。
4. 要求定位签名在最新 Storage 中唯一匹配；找不到或存在多个候选时拒绝导出。
5. 按“规范化 header + 同名列 occurrence”重新定位 Comparison Column，避免 managed 列位置变化导致绝对列号漂移。
6. 比较导入快照、latest 和 working 中来源行组的锚点、文本和 `rowspan` 签名。来源列已变化时拒绝导出。
7. 对当前 Pair 的每个 header/data cell 生成替换、删除或零宽插入 patch，并从 raw 字符串尾部向前应用。
8. 校验目标表外 raw 字节完全不变；当前 Pair 之外的表内内容不会进入 replacement。
9. POST 前第二次 GET Storage，并做完整 raw 字符串比较：
   - 未变化：使用第一次构建的 patch。
   - 已变化：只在第二份最新 Storage 上重放一次当前 Pair patch。
   - 重放失败：提示 `Confluence table changed. Please import the page again.`，不上传。
10. 同一次双读/rebase 复用同一个随机 scope token；图片流水线只处理与 token 完全匹配的 managed cells，然后调用现有上传 API。

### 9.3 可保证的隔离

- 当前 Pair 之外的 Storage raw 片段不会因 DOM 全量序列化被改写。
- Confluence 上对其他普通单元格、其他来源 Pair、人工 Test 列或其他表格的并发内容修改，只要不破坏表格定位和当前来源组，都会保留在 latest Storage 中。
- 当前来源文本、`rowspan`、表格 non-managed span 拓扑或唯一定位条件发生变化时，导出安全失败。
- 同一个 patch 重放不会无条件重复追加 managed cell。

## 10. 图片 Storage 格式与 iframe 性能

### 10.1 唯一 Evidence 图片格式

working table 和导出 Storage 中的 Evidence 图片使用以下结构：

```html
<ac:image
  ac:width="100"
  ac:height="200"
  data-copy-test-evidence-image-id="screen.png"
  data-copy-test-evidence-image-instance-id="screen.png:1:0"
  data-copy-test-evidence-image-alt="screen.png"
>
  <ri:attachment ri:filename="screen.png" />
</ac:image>
```

规则如下：

- 只有 `ac:image` 的直接子元素 `ri:attachment` 上的非空 `ri:filename` 会被读取。
- 附件文件名同时是稳定 image id；instance id 用于区分同一图片在不同 Evidence 位置的出现。
- 删除操作必须同时匹配 image id 和 instance id，只删除目标实例及其对应 Result 项。
- 删除后剩余 Evidence 与 Result Screen 按当前顺序重新从 `Screen01` 编号，稳定 image id 和 instance id 不变。
- Evidence 合并组删除全部图片后，单元格恢复为来源列原子行组的 rowspan；例如来源行为 `1 / (2+3) / 4` 时恢复为 `1 / 2 / 1`，不会拆开第 2、3 行。
- 最后一个 Screen 删除后移除整个 Result 受控内容，包括原有 `Passed/Failed` 状态。
- 导入附件扫描只进入严格 schema 2 Evidence cell，并且不跨越嵌套单元格。
- 导出只收集当前 Pair 的 Evidence 实际使用文件，并将图片尺寸规范为 `100 x 200`。

### 10.2 图片内存与预览

- 附件图片内容与 `storageHtml` 分离，只保存在 Session 内存 registry 和本次校验快照中。
- working table 仅保存附件文件名、image id、instance id、alt 和规范 Confluence 图片节点。
- 每个 table/source Pair 的最近校验图片保存在独立内存快照中；导入附件用于预览，校验快照用于当前 Pair 导出。
- 导出会合并当前 Pair 校验快照和尚未校验的临时上传列表并去重，最终只上传 working Evidence 实际使用的文件。
- iframe 预览按 image id 去重创建 Object URL；同一图片多次出现时通过 instance id 映射到同一 URL。
- 组件更新或卸载时会统一调用 `URL.revokeObjectURL`。
- `srcDoc` 只放置 Object URL，不嵌入图片数据。

### 10.3 iframe 增量更新与横向拖拽

`TablePreview` 只在表格结构、当前 Comparison Column 或图片集合变化时重建 `srcDoc`。以下高频状态通过父页面到 iframe 的 `postMessage` 增量同步：

- `selectedRowIndexes`
- `disabled`
- checkbox 的 checked/indeterminate 状态
- Evidence 删除按钮禁用状态

iframe 回传 selection、preview 和 delete 事件时，父页面校验 `event.source === iframe.contentWindow` 以及消息字段类型。delete 消息的 image id 和 instance id 都必须是字符串。预览文档还会移除 `<script>`、内联事件和 `javascript:` URL。

滚动尺寸使用 `ResizeObserver` 和实际 scroll 事件同步。固定横向滚动条在按下时一次性测量滚动范围和滑块行程；连续 `mousemove` 只保留最新坐标并合并到一个动画帧。动画帧直接更新 iframe 滚动位置、滑块位置和 ARIA 值，拖拽期间不触发 React state 更新；松手时补齐最后一个坐标并只同步一次 state。

## 11. 压力 Fixture 基线

当前脱敏压力 fixture 保留了用户页面的四张表格和 span 拓扑，不包含真实页面内容、URL 或 token。

| 指标 | Table 1 | Table 2 | Table 3 | Table 4 | 合计 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 数据行 | 33 | 23 | 25 | 30 | 111 |
| 来源行组 | 9 | 8 | 8 | 10 | 35 |
| 非空来源行组 | 8 | 8 | 7 | 9 | 32 |

fixture 覆盖的关键结构包括：

- `rowspan="2"`、`rowspan="3"`、`rowspan="4"` 混合出现。
- 单元格从更左侧逻辑列开始，同时横向覆盖所选 Target 列并纵向覆盖四行。
- 人工标题相似的 Test 双列没有严格 ownership，必须保持 non-managed 且原样保留。
- 多张表可能出现相同 source key，图片整理必须同时受 table export scope 约束。

## 12. 测试重点与验证命令

当前测试按职责覆盖：

- 纯 span grid、跨列覆盖、来源列投影和非法网格。
- 4 表/111 行 fixture 的行组数、非空组数和空 header 行为。
- 跨列四行合并单元格的整体 Result/Evidence。
- `evidenceRowSpan` / `hideEvidenceCell` 显式分组、完整来源组求和以及无相邻隐式合并。
- A/B Pair 编辑、删除、ownership 和图片实例隔离。
- 人工 Test 双列不被认领。
- 严格 AI raw JSON 数组的字段、顺序、图片文件名和 Evidence 分组校验。
- `COPY_TEST_AI_CHAT_MOCK_ENABLED=true` 时的随机通过/失败、图片选择与显式分组。
- raw scanner、倒序 replacement、non-target raw 字节保持和幂等插入。
- latest table 唯一定位、来源冲突拒绝、并发内容保留和当前 Pair scoped patch。
- 相同 source key 跨表时的图片 scope 隔离，以及非法 token 的 fail-closed 行为。
- 严格 managed Evidence 附件筛选、规范 `ac:image > ri:attachment[ri:filename]` 识别和图片内容与 working storage 分离。
- iframe Object URL、无图片数据 `srcDoc`、增量 state message、消息来源校验和合并行 checkbox。
- URL/表格错误期间隐藏旧工作区，以及错误清除后不破坏已加载状态。
- 横向拖拽的动画帧合并、最新坐标应用、拖拽期 scroll 去重、松手 flush 和卸载清理。
- 精确 URL/无表格错误文案以及 reducer 状态转换。

在项目目录执行：

```bash
npm test -- --run src/pages/home/components/copyTest
npx vitest run --coverage src/pages/home/components/copyTest
npx eslint src/pages/home/components/copyTest
npm run build
```

## 13. 已知边界

- 本轮没有更改后端，因此第二次 GET 与最终 POST 之间仍没有服务端 CAS/version 条件写入；极小时间窗内的第三方更新无法由前端彻底原子化防护。
- URL 校验只检查 `http/https` 格式，不验证地址是否一定是 Confluence 页面，也不替代权限和网络错误处理。
- 表格定位必须唯一。两张表的 non-managed header、行数和 span 拓扑完全相同且无法唯一确定时，会要求重新导入或整理表格。
- 当前来源 header、同名列 occurrence、来源文本或 merge 结构在导入后发生变化时，需要重新 Import。
- raw patch 要求 Confluence Storage 的 table/tr/th/td 标签完整且可与 DOM 模型对齐；严重损坏或歧义 HTML 会安全拒绝导出。
- 只有标题、未通过严格 schema 2 ownership 的 Test 列不会被 CopyTest 管理。
- 只处理顶层表格；嵌套表格作为所属普通单元格的原始内容保留，不作为独立 CopyTest 工作表。
