# CopyTest 组件说明

## 1. 组件定位

`copyTest` 是一套面向 Confluence Copy Deck 的前端文案验收工具，不是通用的剪贴板复制组件。它负责：

1. 从 Confluence 页面读取 Storage HTML 和已引用附件。
2. 解析页面中的顶层表格以及 `rowspan`、`colspan` 形成的二维逻辑网格。
3. 让用户选择 Comparison Column 和不可拆分的逻辑行组。
4. 使用截图进行 AI 文案校验。
5. 为当前来源列生成并维护两列受控数据：
   - `Test Result - {Comparison Column}`
   - `Test Evidence - {Comparison Column}`
6. 导出时重新读取最新 Confluence Storage，只回写当前来源列拥有的 Test 双列。

本轮重构只涉及 `copyTest` 前端目录，没有修改后端。设计目标是：正确处理复杂合并单元格、隔离不同来源列的 Test 双列、最小化 Confluence Storage 改动，并降低大表格预览和编辑时的内存与重渲染开销。

## 2. 核心保证

- Comparison Column 的空 header 不会出现在下拉框中。
- `|values=xxx|` 只是 header 文本的一部分，不再解析为语言标记，也不会据此自动寻找 Reference Column。
- 来源单元格覆盖的全部物理行构成一个原子 RowGroup，选择、Result、Evidence 和删除操作都不会切开该组。
- A 来源列的 Test 双列与 B 来源列的 Test 双列通过显式 ownership 隔离；A 的合并、校验、删除和导出不会修改 B 的双列。
- 只有同时带有合法 `type` 和 `source-column-key` metadata 的单元格才属于 CopyTest。仅标题看起来像 Test 列的人工列不会被接管。
- 导出从最新 Storage 开始做 raw range patch。除当前目标 Pair 外，来源表格、其他 Test Pair、人工列和表格外内容保持原始字节不变。
- 图片 base64 不写入生成后的 working table，也不复制进 iframe `srcDoc`；预览使用去重后的 Object URL。

## 3. 用户流程与输入错误

```text
输入 Confluence URL
  -> Import 最新 Storage/附件
  -> 选择 Table
  -> 选择 Comparison Column
  -> 选择原子 RowGroup
  -> 上传截图并 Validate
  -> 复核 Result/Evidence
  -> Export 前重新读取最新 Storage
  -> 冲突检查、当前 Pair raw patch、图片清理
  -> 调用现有前端 API 回传
```

URL 只接受可由浏览器 `URL` 解析的 `http:` 或 `https:` 地址。错误显示在 URL 输入框底部，文案是接口契约的一部分，必须保持完全一致：

| 场景 | 输入框底部文案 |
| --- | --- |
| URL 格式无效 | `In valid URL format, Please enter a valid Http:// or https:// URL` |
| Storage 中没有有效表格 | `No valid table found` |

“有效表格”要求至少有一行 header、一行数据、至少一个逻辑列，并且至少一个 header 非空。无效 URL、无有效表格、失败或已过期的导入请求都不会用空结果覆盖已经加载的状态。输入框存在 URL/表格错误时，已导入的选择器和预览表格会整体隐藏；用户修改输入清除错误后，原工作状态可以重新显示。导出只允许使用最后一次成功导入的 URL；用户修改输入框但尚未重新导入时，导出按钮不可用。

## 4. 架构与职责

| 模块 | 主要职责 |
| --- | --- |
| `CopyTest.tsx` | 组合主弹窗、选择器、预览、上传和确认弹窗 |
| `hooks/useCopyTestController.ts` | 编排导入、校验、删除、二次读取和导出请求 |
| `hooks/useCopyTestSession.ts` | 提供表格会话领域操作和每个 Pair 的图片快照 |
| `hooks/copyTestSessionReducer.ts` | 以纯 reducer 管理 Storage、表格、选择和 revision |
| `table/tableModel.ts` | 把 Storage/table DOM 转为基础行、列、slot 模型 |
| `table/copyTestGridModel.ts` | 构建纯 TypeScript 的二维 span grid，并投影来源列 RowGroup |
| `table/copyTestTableParser.ts` | 解析有效表格、Comparison Column 上下文和校验输入 |
| `table/copyTestTableEditor.ts` | 创建受控双列、写入校验结果、合并 Evidence、删除证据 |
| `table/copyTestStoragePatch.ts` | 扫描顶层 table/tr/th/td 的 raw range，执行最小字符串 patch |
| `table/copyTestExportScope.ts` | 生成并校验单次导出的 128-bit 临时 scope token |
| `table/copyTestTableExporter.ts` | 在最新 Storage 中定位表格、检查冲突并构建当前 Pair patch |
| `table/copyTestTableImages.ts` | 附件预览注入、当前 Pair 图片清理和上传 payload 构建 |
| `components/TablePreview.tsx` | 安全 iframe 预览、增量选择同步、图片事件和固定横向滚动条 |

状态分为三层：

- Session：完整工作 Storage、各表 `originalHtml`/`workingHtml`/model、当前表/列/行选择，以及与 HTML 分离的导入附件预览 registry。
- Upload：本次待校验图片、MD5、大小和准备状态。
- Controller：URL、请求状态、导入错误、弹窗、图片预览和删除目标。

Validate 和 Evidence 删除只修改浏览器内的 `workingHtml`。只有用户确认 Export 后才产生 Confluence 写入副作用。

## 5. 表格与合并单元格模型

### 5.1 顶层表格和二维网格

系统只把 Storage 中的顶层 `<table>` 作为独立 CopyTest 表格，嵌套表格不会被重复枚举。第一行作为 header，后续行作为数据行。

`copyTestGridModel.ts` 将每个物理单元格转换为 `CellRegion`：

```ts
interface CellRegion {
  cellId: string;
  rowStart: number;
  rowEnd: number;
  rowSpan: number;
  colStart: number;
  colEnd: number;
  colSpan: number;
  text: string;
}
```

一个 `CellRegion` 覆盖二维网格中的若干 slot。每个 slot 都指向同一个来源区域，并记录它是不是单元格 anchor、行 anchor 或列 anchor。这样，来源单元格即使从更左侧列开始并通过 `colspan` 覆盖当前 Comparison Column，也能被识别为当前列的真实来源单元格。

网格要求 span 为正整数、单元格不重叠且逻辑行没有空洞。普通预览解析遇到异常网格时会保留基础模型作为兼容回退；需要安全回写而 raw/DOM 无法对齐时，导出会失败关闭而不是猜测修改位置。

### 5.2 SourceProjection 和 RowGroup

选择 Comparison Column 后，系统对该逻辑列建立 `SourceProjection`。同一个来源 `CellRegion` 覆盖的全部数据行组成一个不可拆分 `RowGroup`，其关键字段包括：

- `anchorRowIndex`：来源单元格所在的物理 anchor 行。
- `coveredRowIndexes`：该单元格覆盖的所有物理数据行。
- `rowSpan`：物理行跨度。
- `groupId`：由 table、source column 和 source cell 身份共同构成。
- `selectable`：来源文本去除首尾空白后是否非空。

UI 和 API 使用去掉 header 后的零基数据行下标，但所有写入先还原到 RowGroup anchor。被 rowspan 覆盖的后续行不会出现独立 checkbox，也不会生成重复 Result/Evidence 单元格。

### 5.3 Header 规则

- header 保留真实文本；空 header 不再伪造为 `Column N`。
- 空 header 不进入 Comparison Column 下拉框。
- 标题以 `Test Result -` 或 `Test Evidence -` 开头的列不会作为 Comparison Column 候选。
- 这种标题匹配只用于 UI 排除，不代表 ownership。
- `Target|values=hk_sc|`、`Target|values=fr|` 等都按完整普通字符串处理。
- 不再根据 `|values=...|` 识别语言或自动选择 Reference Column；当前校验上下文默认没有自动 Reference。

## 6. Test 双列的合并规则

### 6.1 Result 始终镜像来源原子组

如果所选来源列中第 1～3 行是一个 `rowspan="3"` 单元格，那么这三行是一个 RowGroup：

- 只能整体选择或取消选择。
- 只产生一个 Result 单元格，`rowspan="3"`。
- 只产生一个基础 Evidence 单元格，`rowspan="3"`。
- Validate、清空和 Evidence 删除都以三行为整体计算。

来源列的 merge anchor 不要求位于当前列。例如一个从更左侧逻辑列开始、`colspan="4" rowspan="4"` 且覆盖 Target 列的单元格，会投影为 Target 的一个四行 RowGroup；其 Result 和 Evidence 都覆盖完整四行。

### 6.2 Evidence 合并按“组数”解释

AI 返回的 `evidenceRowSpan` 表示连续来源 RowGroup 的数量，不是物理 `<tr>` 数量。Evidence 的实际 HTML rowspan 是这些完整组的物理 `rowSpan` 之和。

例如两个连续来源组的物理跨度分别为 3 和 2：

```text
Result group 1 rowspan = 3
Result group 2 rowspan = 2
Evidence evidenceRowSpan = 2 groups
Evidence physical rowspan = 3 + 2 = 5
```

因此 Evidence 永远不会停在某个来源合并单元格的中间。显式 Evidence 合并和相邻相同证据的合并都只在完整 RowGroup 边界上进行。

## 7. Ownership 与 A/B 双列隔离

来源列 key 的格式为：

```text
{logicalColumnIndex}:{trim 后并折叠连续空白的完整 header}
```

新生成的 header 和数据单元格都带有 schema v2 ownership：

```html
data-copy-test-schema="2"
data-copy-test-column-type="result|evidence"
data-copy-test-source-column-key="{sourceColumnKey}"
data-copy-test-owner-id="{sourceColumnKey}"
```

系统认领已有 Test 列时只看完整且匹配的 `column-type + source-column-key`，不再按标题回退。由此得到以下隔离行为：

- A 列只查找、创建、合并、清空和删除 A key 对应的 Result/Evidence。
- B 列使用独立 key；A 的 rowspan 变化不会删除或重排 B 的 owned cells。
- Evidence 删除只扫描当前 source key，并把受影响范围扩展到当前来源 RowGroup 边界。
- 导出只生成当前 source key 的 header/data cell patch。
- 每次导出会生成独立的 128-bit 安全 token，并只给当前表、当前 Pair 临时添加 `data-copy-test-export-scope="copytest-{token}"`；图片流水线只接受本次调用传入的完全相同 token。即使不同表具有相同 source key，或另一张表残留 `true`/其他 token，也不会清理其图片或 runtime 属性。
- scope 标记在最终 payload 中被移除，不会持久化到 Confluence。

只有标题、没有 metadata 的人工 Test 列属于 foreign data。它们可以继续显示为 Test Result/Test Evidence，但 CopyTest 不会补 metadata、复用、覆盖、合并或删除其内容；需要当前来源 Pair 时会另建一对 owned 列。

## 8. 最新 Storage raw patch 与冲突策略

### 8.1 为什么不回传 working table 整体序列化结果

DOM `outerHTML` 序列化会改变属性顺序、namespace 写法、空标签和未编辑单元格格式。直接替换整张表也会覆盖用户在导入后对 Confluence 做的其他修改。因此导出不再用 working table 覆盖原表，而是在最新 raw Storage 上只替换当前 Pair 的单元格 range。

### 8.2 导出流程

1. 第一次 GET 最新 Confluence Storage，作为候选 patch 基线。
2. 扫描所有顶层 table/tr/th/td raw range；扫描器会忽略注释、CDATA、引号内的 `>` 和嵌套 table 的内部行列。
3. 使用非 managed header、物理行数和非 managed rowspan/colspan 拓扑构造表格定位签名。旧 table index 只用于调整候选检查顺序，不用于消除歧义。
4. 在最新 Storage 中要求该签名唯一匹配；找不到或存在多个相同候选时拒绝导出。
5. 按“规范化 header + 同名列 occurrence”重新定位 Comparison Column，避免 managed 列位置变化导致绝对列号漂移。
6. 比较导入快照、latest 和 working 中来源 RowGroup 的 anchor、文本和 rowspan 签名。来源列已经变化时拒绝导出。
7. 对当前 Pair 的每个 header/data cell 生成替换、删除或零宽插入 patch，并从 raw 字符串尾部向前应用。
8. 校验目标表外 raw 字节完全不变；当前 Pair 之外的表内内容也不会进入 replacement。
9. POST 前第二次 GET Storage，并做完整 raw 字符串比较：
   - 未变化：使用第一次构建的 patch。
   - 已变化：只在第二份最新 Storage 上重放一次当前 Pair patch。
   - 重放失败：提示 `Confluence table changed. Please import the page again.`，不上传。
10. 同一次双读/rebase 始终复用同一个随机 scope token；只清理与该 token 完全匹配的图片 runtime 属性，规范 Evidence 图片尺寸并构建图片 payload，然后调用现有上传 API。

### 8.3 可保证的隔离

- 当前 Pair 之外的 Storage raw 片段不会因为 DOM 全量序列化被改写。
- Confluence 上对其他普通单元格、其他来源 Pair、人工 Test 列或其他表格的并发内容修改，只要不破坏表格定位和当前来源组，都会保留在 latest Storage 中。
- 当前来源文本、rowspan、表格非 managed span 拓扑或唯一定位条件发生变化时，导出失败关闭。
- 同一个 patch 重放不会无条件重复追加 owned cell。

## 9. 图片和 iframe 性能优化

### 9.1 图片内存模型

- 导入只扫描同时带有 `type=evidence + 非空 source-key` 的 managed Evidence；普通 business 图片、title-only foreign 列、Result 列和非法 metadata 不会触发附件请求，也不会被改写。
- 附件 base64 与 `storageHtml` 完全分离，只保存在 Session 的内存 preview registry；working table 仅保存 image id、instance id、alt 和附件文件名等轻量索引。历史 runtime base64 属性会从 managed Evidence 中移除。
- 新校验结果写入 working table 时只保存附件文件名、image id、instance id 和 Confluence 图片节点，不把 base64 写进每个 Evidence cell。
- 每个 table/source Pair 的最近校验图片保存在独立内存快照中；导入附件只用于预览，校验快照只用于当前 Pair 导出，两者不会混用或导致已有 Confluence 附件被重复上传。
- 导出会合并当前 Pair 校验快照和尚未校验的临时上传列表并去重，最终只上传 working Evidence 实际引用的文件；临时选择新图不会挤掉旧结果所需附件。
- iframe 预览按 image id 去重创建 Object URL，同一图片多次引用不会重复解码 base64；组件更新或卸载时统一 `URL.revokeObjectURL`。
- `srcDoc` 中只放 Object URL，不重复嵌入大段 data URL。
- 导出只收集当前 Pair 的 Evidence 实际引用文件，清理 preview/runtime 属性，并将 Confluence 图片尺寸规范为 `100 x 200`。

### 9.2 iframe 增量更新

`TablePreview` 只在表格结构、当前 Comparison Column 或图片集合变化时重建 `srcDoc`。以下高频状态通过父页面到 iframe 的 `postMessage` 增量同步：

- `selectedRowIndexes`
- `disabled`
- checkbox 的 checked/indeterminate 状态
- Evidence 删除按钮禁用状态

iframe 回传 selection、preview 和 delete 事件时，父页面校验 `event.source === iframe.contentWindow` 以及消息字段类型。预览文档还会移除 `<script>`、内联事件和 `javascript:` URL。

滚动尺寸使用 `ResizeObserver` 和实际 scroll 事件同步，不再通过多轮 `requestAnimationFrame`/延时重复测量。固定横向滚动条在按下时一次性测量滚动范围和滑块行程；连续 `mousemove` 只保留最新坐标并合并到一个动画帧。动画帧直接更新 iframe 滚动位置、滑块位置和 ARIA 值，拖拽期间不触发 React state 更新；松手时补齐最后一个坐标并只同步一次 state，未执行的动画帧会在松手、预览变化或卸载时取消。行选择列直接复用已解析的 table model，避免列可见性调整后再次解析复杂 rowspan/colspan 表格。

## 10. 真实 Confluence fixture 观察

对用户提供的 Stress Fixture 做只读检查后，得到以下基线。凭据不写入代码、测试或本文档。

| 指标 | Table 1 | Table 2 | Table 3 | Table 4 | 合计 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 数据行 | 33 | 23 | 25 | 30 | 111 |
| HK 来源 RowGroup | 9 | 8 | 8 | 10 | 35 |
| HK 可选 RowGroup | 8 | 8 | 7 | 9 | 32 |

可选组少于总组数，是因为 Table 1、Table 3 和 Table 4 各有一个空来源组；空组仍参与结构投影，但不会出现在默认可选行中。

fixture 中需要特别覆盖的结构包括：

- `rowspan="2"`、`rowspan="3"`、`rowspan="4"` 混合出现。
- 单元格从另一个逻辑列开始，以 `colspan="4" rowspan="4"` 覆盖所选 Target 列。
- Table 3 存在人工法语 `Test Result - Target|values=fr|` / `Test Evidence - Target|values=fr|` 双列，但没有 CopyTest metadata；它们必须保持 foreign 且原样保留。
- 多张表可能出现相同 header/source key，图片清理必须同时受 table export scope 约束。

测试中的 sanitized fixture 保留了上述 span 拓扑和计数，不包含真实页面内容、URL 或 token。

## 11. 测试重点与验证命令

当前测试按职责覆盖：

- 纯 span grid、跨列覆盖、RowGroup 投影和非法网格。
- 4 表/111 行 fixture 的组数、可选数和空 header 行为。
- `colspan="4" rowspan="4"` 的整体 Result/Evidence。
- `evidenceRowSpan` 按完整来源组求和。
- A/B Pair 编辑、删除和 ownership 隔离。
- 人工法语双列不被接管，`|values=...|` 不触发语言/Reference 逻辑。
- raw scanner、倒序 replacement、non-target raw 字节保持和幂等插入。
- latest table 唯一定位、来源冲突拒绝、并发内容保留和当前 Pair scoped patch。
- 相同 source key 跨表时的图片 scope 隔离。
- 其他表残留布尔 marker/不同 token 时的 exact-token 隔离，以及非法 token fail-closed。
- strict managed Evidence 附件筛选、business/foreign 图片排除，以及 managed Evidence working storage 零 base64 注入。
- iframe 的 Object URL、无 base64 `srcDoc`、增量 state message、来源校验和合并行 checkbox。
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

## 12. 已知边界

- 本轮没有修改后端，因此第二次 GET 与最终 POST 之间仍没有服务端 CAS/version 条件写入；极小时间窗内的第三方更新无法由前端彻底原子化防护。
- URL 校验只检查 `http/https` 格式，不验证地址是否一定是 Confluence 页面，也不替代权限和网络错误处理。
- 表格定位必须唯一。两张表的非 managed header、行数和 span 拓扑完全相同且无法唯一确定时，会要求重新导入/整理表格，而不会按旧 index 猜测。
- 当前来源 header、同名列 occurrence、来源文本或 merge 结构在导入后变化时，需要重新 Import。
- raw patch 假设 Confluence Storage 的 table/tr/th/td 标签完整且可与 DOM 模型对齐；严重损坏或歧义 HTML 会安全拒绝导出。
- 仅标题匹配的旧 Test 列不会自动迁移为 schema v2 owned 列。这是保护人工数据的刻意选择。
- 不兼容也不迁移 `|values=xxx|` 语言语义；该片段永久按普通 header 文本参与显示和 source key 计算。
- 只处理顶层表格；嵌套表格会作为所属普通单元格的原始内容保留，不作为独立 CopyTest 工作表。
