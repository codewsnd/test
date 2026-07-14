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
- Evidence 跨行由前端 Planner 根据来源原子行组、物理连续性和逐行共享图片关系确定；AI 不参与表格合并决策。
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
| `hooks/useCopyTestSession.ts` | 提供表格会话领域操作，以及每个 Pair 的图片顺序和逐行校验快照 |
| `hooks/copyTestSessionReducer.ts` | 以纯 reducer 管理 Storage、表格、选择和 revision |
| `api/copyTestApi.ts` | 调用现有接口、切换 AI/Mock，并用同一 parser 严格校验响应外层和 AI 内容 |
| `prompt/copyTestValidationPrompt.ts` | 定义 GPT-5.4 稳定 system prompt，并构建纯运行时 user JSON |
| `mock/validationMock.ts` | 提供与 `aiChat` 同签名、同响应外层结构的可注入随机 Mock |
| `table/tableModel.ts` | 把 Storage/table DOM 转为基础行、列和 slot 模型 |
| `table/copyTestGridModel.ts` | 构建纯 TypeScript 的二维 span grid，并投影来源列原子行组 |
| `table/copyTestTableParser.ts` | 解析有效表格、Comparison Column 上下文和校验输入 |
| `table/copyTestEvidencePlanner.ts` | 根据逐行图片命中关系纯计算 Evidence 合并组、组内 Screen 注册表和 Result 图片子集 |
| `table/copyTestTableEditor.ts` | 创建受控双列、应用 Planner 投影，并基于逐行快照删除和全量重投影 Evidence |
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

同理，用户勾选物理行 1/2/3/4，但来源列第 2、3 行由同一个 `rowspan="2"` 单元格覆盖时，选择会先规范为三个原子组 `[第1行] / [第2+3行] / [第4行]`。AI 只收到三个输入项，其业务行下标分别为 `0 / 1 / 3`；Result 的物理跨度始终为 `[1,2,1]`。如果三组因共享图片被合并为一个 Evidence，其 `rowspan` 为 `1+2+1=4`，删除图片并重新规划时也不会把第 2、3 行拆开。

来源单元格的左上角不必落在当前列。例如，一个从更左侧开始、同时横向覆盖 Target 列且 `rowspan="4"` 的单元格，会投影为 Target 的一个四行原子组；其 Result 和基础 Evidence 都覆盖完整四行。

### 6.2 Evidence 由前端 Planner 确定性规划

AI 只返回每个选中来源原子行组命中的图片文件名，不返回任何合并信息。`copyTestEvidencePlanner.ts` 按来源列物理顺序执行以下规则：

1. 来源 `rowspan` 投影出的每个 `CopyTestRowGroup` 都是不可拆分原子组。
2. 只有“已选中、已有校验结果且至少命中一张有效上传图片”的原子组可以生成 Evidence。
3. 下一原子组必须与当前组物理连续，并且其图片集合与当前组已收集的图片并集至少有一个交集，才会加入当前 Evidence 组。
4. 未选中、无结果、无有效图片、物理不连续或图片不相交都会结束当前组，禁止跨边界合并。
5. Evidence 物理 `rowspan` 是组内全部来源原子组 `rowSpan` 的总和，因此不会停在来源合并单元格中间。
6. 组内图片按上传顺序去重，生成统一的 `Screen01`、`Screen02` Screen 注册表。

这种规则支持传递合并。例如 `[S1] / [S1,S2] / [S2]` 会形成一个连续 Evidence 组；`[S1] / 空 / [S1]` 不会跨越空行合并。

### 6.3 Evidence 图片并集与逐行 Result 子集

Evidence 和 Result 使用同一组 Screen 注册表，但展示集合不同：

- Evidence 单元格展示组内所有逐行命中图片的有序去重并集。
- 每个 Result 单元格只展示当前来源原子组真正命中的 Screen 子集。
- 没有被任何逐行结果引用的上传图片不进入 Evidence，也不进入任何 Result。
- `Passed/Failed` 和问题说明属于逐行结果，不能从 Evidence 组的其他行复制。

目标示例：第 1～3 行分别是“你好”“我在”“吃饭”，上传图片 S1 内容为“你好我在吃饭”、S2 内容为“吃饭”、S3 内容为“Helloworld”。AI 的逐行关系应为：

| 来源行 | 命中图片 | Test Result |
| --- | --- | --- |
| 1：你好 | S1 | `Passed Screen01` |
| 2：我在 | S1 | `Passed Screen01` |
| 3：吃饭 | S1、S2 | `Passed Screen01 Screen02` |

Planner 将三个连续原子组规划为一个 Evidence 单元格，展示 S1、S2 两张图片。S3 与任何行都无关，因此被完全排除。如果其中某个来源单元格原本通过 `rowspan` 覆盖多行，该完整物理跨度仍作为一个原子组参与上述计算。

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

## 8. GPT-5.4 逐行契约与同形随机 Mock

### 8.1 system 与 user 消息分离

`copyTestValidationApi` 固定使用模型 `gpt-5.4`，并向 `aiChat` 发送两条职责明确的消息：

- `role=system`：只包含稳定的模型角色、逐行图片判断规则、提示注入边界和严格输出契约。
- `role=user`：只包含可序列化的运行时 JSON，包括 `targetColumnName`、`uploadedScreenshots` 和 `selectedRows`。

每个 `selectedRows` 项只包含 `rowIndex` 和 `expectedText`；截图使用本次上传的稳定 `fileName`，图片内容通过 `documents` 以 `data:image/...;base64,...` data URL 发送。模型只判断逐行文案与截图关系，不决定 Evidence 合并、物理跨度、DOM 或 Screen 编号。

### 8.2 唯一 AI 内容形状

AI 内容必须是可直接 `JSON.parse` 的原始根对象，不能带 Markdown 代码围栏或解释文字：

```json
{
  "results": [
    {
      "rowIndex": 0,
      "passed": true,
      "evidenceImageFileNames": ["screen-1.png"],
      "languageIssues": []
    }
  ]
}
```

根对象必须且只能包含 `results`。每个逐行结果必须且只能包含以下四个必填字段：

| 字段 | 约束 |
| --- | --- |
| `rowIndex` | 非负整数；结果数量、唯一性、顺序和值必须与请求行完全一致 |
| `passed` | 布尔值；只有至少一张 Evidence 可靠支持当前文案时才能为 `true` |
| `evidenceImageFileNames` | 必填无重复字符串数组；无相关图片时为 `[]`，其他值必须来自本次上传截图 |
| `languageIssues` | 必填无重复字符串数组；`passed=true` 时必须为 `[]`，`passed=false` 时必须非空 |

失败结果可以引用包含相关但错误文案的截图，也可以在完全没有相关截图时使用空 Evidence 数组。任何额外/缺失字段、类型错误、空白或重复数组项、未知图片、重复/缺失/乱序行都会使整批结果失败。

旧的 AI 合并字段 `evidenceRowSpan` 和 `hideEvidenceCell` 已删除且不兼容；parser 会把它们作为 unsupported field 明确拒绝。合并逻辑全部由前端 Evidence Planner 负责。

### 8.3 与 `aiChat` 同形的随机 Mock

```ts
export const COPY_TEST_AI_CHAT_MOCK_ENABLED = true;
```

当前开关为 `true`。除 Vitest 的 `test` 模式外，`copyTestValidationApi` 会保留 300 ms 可感知 loading，并调用 `mockCopyTestAiChat`。该 Mock 与 `aiChat` 具有完全相同的函数签名，并返回同一个 `ApiResponse<AiChatResponse>` 外层结构：JSON 结果写入 `data.content`，同时提供固定的 `modelName=gpt-5.4`、时间戳和字符数。

随机 Mock 的行为包括：

- 每个来源行独立选择 0～2 张不重复的已上传图片。
- 只有存在图片证据时才可能按 65% 概率生成通过结果。
- 失败行始终生成非空问题说明；没有截图时使用空 Evidence 数组。
- 随机数和当前时间均可注入，单元测试可以获得确定性结果。

Mock 和真实 `aiChat` 都先得到相同的响应外层对象，再由 `parseCopyTestValidationResponse` 解包 `data.content`，最终进入同一个 `parseCopyTestValidationResults` 严格 parser。Mock 不允许绕过真实解析路径。将开关设为 `false` 后只替换响应提供者，不改变后续解析和 Planner 流程。

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
data-copy-test-evidence-image-instance-id="0:Target:1:screen.png"
  data-copy-test-evidence-image-alt="screen.png"
>
  <ri:attachment ri:filename="screen.png" />
</ac:image>
```

规则如下：

- 只有 `ac:image` 的直接子元素 `ri:attachment` 上的非空 `ri:filename` 会被读取。
- 附件文件名同时是稳定 image id；instance id 由 `sourceColumnKey + Evidence 组锚点 + imageId` 组成，用于隔离同一图片在不同 Pair 或 Evidence 组中的实例。
- 删除操作必须同时匹配 image id 和 instance id，并使用当前 Pair 最近一次逐行校验快照定位目标 Evidence 组。
- 页面重新导入导致内存快照缺失时，会从新契约 managed Result 的逐行 Screen 引用和 Evidence DOM 顺序恢复轻量快照，再与已加载附件重新绑定。
- 快照同时保存上传图片顺序和逐来源原子行结果。删除图片时，从目标组内所有相关逐行结果移除该文件名，再用剩余关系全量执行一次 `applyCopyTestValidationResults`。
- 全量重投影会先恢复当前 Pair 的生成列结构，再重新运行 Evidence Planner；删除连接图片后，原合并组可以按剩余共享关系自动拆分或重新合并。
- 重投影后每个 Evidence 组按剩余图片上传顺序重新从 `Screen01` 编号；组内 Result 继续使用同一注册表中的逐行子集，稳定 image id 和 instance id 不依赖展示序号。
- Evidence 合并组删除全部图片后，单元格恢复为来源列原子行组的 rowspan；例如来源行为 `1 / (2+3) / 4` 时恢复为 `1 / 2 / 1`，不会拆开第 2、3 行。
- 某来源原子组最后一张 Evidence 删除后，清除该组整个 Result 受控内容，包括原有 `Passed/Failed`、问题说明和 Screen 引用。
- Session 在重投影后保存更新后的逐行结果，并从图片快照中移除当前 Pair 已不再引用的文件。
- 导入附件扫描只进入严格 schema 2 Evidence cell，并且不跨越嵌套单元格。
- 导出只收集当前 Pair 的 Evidence 实际使用文件，并将图片尺寸规范为 `100 x 200`。

### 10.2 图片内存与预览

- 附件图片内容与 `storageHtml` 分离，只保存在 Session 内存 registry 和当前 Pair 校验快照中。
- working table 仅保存附件文件名、image id、instance id、alt 和规范 Confluence 图片节点。
- 每个 table/source Pair 独立保存最近校验的上传顺序和逐行结果；导入附件用于预览，图片快照用于当前 Pair 导出，逐行快照用于删除后的完整重投影。
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
- 跨列四行合并单元格作为不可拆分来源原子组参与 Result/Evidence。
- Evidence Planner 的物理连续性、共享图片传递合并、空行/未选中/图片不相交边界和原子组 `rowSpan` 求和。
- Evidence 图片并集、逐行 Result 图片子集、上传顺序 Screen 注册表，以及无关图片完全排除。
- “你好 / 我在 / 吃饭”三行与“S1 全句 / S2 吃饭 / S3 Helloworld”三图的完整目标结果。
- A/B Pair 编辑、删除、ownership 和图片实例隔离。
- 人工 Test 双列不被认领。
- GPT-5.4 system/user 消息分离，以及严格 AI 根对象、逐行四字段、顺序、唯一性和图片文件名校验。
- 已移除 AI 合并字段和其他额外字段的明确拒绝行为。
- `COPY_TEST_AI_CHAT_MOCK_ENABLED=true` 时 Mock/真实 `aiChat` 同签名、同响应外层、同 parser，以及可注入随机通过/失败和图片选择。
- 基于逐行快照删除图片后的全量重投影、Evidence 自动拆分、Screen 重编号和空 Result 清除。
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
