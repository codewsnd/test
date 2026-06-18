# CopyTest 前端逻辑说明

`copyTest` 是一个前端侧 Confluence 文案校验工具。它导入 Confluence storage HTML，解析其中的表格，用户选择一个 `Comparison Column` 后上传截图校验文案，并把结果写入该列对应的两列生成列：

- `Test Result - {Comparison Column Name}`
- `Test Evidence - {Comparison Column Name}`

## 架构

当前实现使用以下数据流：

```text
originalStorageHtml
  -> parse tables
  -> selected table workingTableHtml
  -> iframe preview
  -> Validate / delete 只修改当前 Comparison Column 的两列
  -> Export 从 originalStorageHtml 出发，只 patch 当前 Comparison Column 的两列
```

前端不再维护可变的完整 `storageHtml`。导入后保存：

- `originalStorageHtml`：导入时的完整 storage，导出永远以它为基底。
- `tables[].workingHtml`：每张表当前预览和编辑用的 HTML。

## 核心规则

- 当前选中 A 列时，只新增或替换 `Test Result - A` / `Test Evidence - A`。
- 当前选中 B 列时，只新增或替换 `Test Result - B` / `Test Evidence - B`。
- 导出 B 时不能影响原 storage 中已有的 A 的 Test 两列。
- 导出时不会把前端临时创建但非当前 Comparison Column 的 Test 列写回 Confluence。
- 原始业务列不被修改。

## 生成列标记

生成列必须带有稳定 metadata：

```html
data-copy-test-column-type="result|evidence"
data-copy-test-source-column-key="{columnIndex}:{normalizedLabel}"
```

系统生成内容必须包在受控节点内：

```html
data-copy-test-generated-content="result"
data-copy-test-generated-content="evidence"
```

重写 Result/Evidence 时只替换受控节点，受控节点之外的人工内容保留。

## 逻辑行组

逻辑行组只基于当前 `Comparison Column` 计算：

- 选中列存在 `rowspan` 时，被覆盖的物理行属于同一个逻辑行组。
- 选中列没有纵向合并时，每条物理行是独立逻辑行组。
- 已有 Result/Evidence 的 `rowspan` 不参与逻辑行组计算。

## 主要文件

- `CopyTest.tsx`：弹窗骨架。
- `components/TablePreview.tsx`：iframe 表格预览、行选择、Evidence 事件委托。
- `hooks/useCopyTestController.ts`：主流程编排。
- `hooks/useCopyTestSession.ts`：storage、working table、列选择、行选择和校验写入状态。
- `hooks/useCopyTestUpload.ts`：截图上传、MD5 去重和大小限制。
- `table/copyTestTableParser.ts`：表格解析、列识别、逻辑行组。
- `table/copyTestTableEditor.ts`：当前列生成列创建、Validate 写入、Evidence 删除。
- `table/copyTestTableExporter.ts`：从原始 storage 做当前列级安全回写。
- `table/copyTestTableImages.ts`：附件预览、runtime 属性清理、导出图片 payload。
- `mock/validationMock.ts`：本地 mock LLM，当前主流程已停用。
- `prompt/copyTestValidationPrompt.ts`：真实 LLM 使用的 prompt。

## 校验与导出

当前 Validate 调用 `copyTestValidationApi`，mock 入口保留为本地调试备用。

导出时会：

1. 从 `originalStorageHtml` 找到当前 table。
2. 在原始 table 中创建或复用当前 Comparison Column 对应的两列。
3. 只复制当前两列的受控内容和必要 `rowspan`。
4. 清理 runtime 图片属性。
5. 规范 Evidence 图片尺寸为宽 `100`、高 `200`。
6. 调用现有后端 upload API。
