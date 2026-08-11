# CopyTest 用户指南

[English User Guide](./README.en.md)

## CopyTest 可以做什么

CopyTest 用于比较 Confluence 表格中的文案与页面截图，并生成两列结果：

- **Test Result**：显示 Passed、Failed、对应的 Screen 和问题说明。
- **Test Evidence**：显示本次结果使用的截图。

检查完成后，可以将结果回写到 Confluence，或导出为 PDF、Word、Excel。

## 使用步骤

### 1. 导入 Confluence 页面

1. 将页面地址粘贴到 **Confluence URL**。
2. 点击 **Import**。
3. 等待表格预览显示。

页面地址需要以 `http://` 或 `https://` 开头，并且当前账号需要有访问权限。

[截图]

### 2. 选择表格和文案列

1. 在 **Table** 中选择需要检查的表格。
2. 在 **Comparison Column** 中选择需要与截图比较的文案列。
3. 确认预览中显示了对应的 **Test Result** 和 **Test Evidence**。

文案非空的行会默认选中。可以取消不需要检查的行；合并单元格会作为一个整体处理。

[截图]

### 3. 上传截图并校验

1. 点击 **Upload Screenshot**。
2. 点击 **Select screenshots**，选择一张或多张图片。
3. 确认图片列表后，点击 **Validate**。

每次最多选择 50 张图片，总容量不能超过 10 MB。重复图片会自动去重。

[截图]

### 4. 查看结果

- **Passed**：截图支持当前文案。
- **Failed**：文案缺失、不完整、不一致，或无法确认。
- **Screen01、Screen02……**：当前结果对应的 Evidence 图片。

点击 Evidence 图片可以放大查看。

[截图]

## 调整结果

### 修改状态

可以在 Test Result 中调整某个 Screen 的 Passed 或 Failed 状态。后续继续上传图片时，已调整的结果会保留。

### 删除图片

点击 Test Evidence 图片下方的删除按钮并确认后，系统会：

- 删除该 Evidence 图片。
- 移除对应的 Test Result 记录。
- 重新排列剩余的 Screen 编号。

删除后继续上传新图片，被删除的结果不会自动恢复。

[截图]

## 导出结果

将鼠标移动到 **Export**，可以选择以下方式：

| 选项 | 用途 |
|---|---|
| Confluence | 将当前 Test Result 和 Test Evidence 回写到原页面 |
| PDF | 下载 PDF 文件 |
| Word | 下载 Word 文件 |
| Excel | 下载 Excel 文件 |

### 回写到 Confluence

1. 确认当前选择的 Table 和 Comparison Column 正确。
2. 选择 **Export > Confluence**。
3. 在确认窗口中点击 **Confirm**。
4. 等待成功提示。

回写成功后，建议重新 Import 一次，确认 Confluence 页面与当前预览一致。

[截图]

### 下载本地文件

选择 PDF、Word 或 Excel 后，浏览器会下载当前表格及测试结果。Test Evidence 中的图片也会包含在文件中。

## 常见问题

| 问题 | 处理方式 |
|---|---|
| 无法导入页面 | 检查页面地址和访问权限，然后重新 Import |
| 找不到可用表格 | 确认 Confluence 页面中包含表格 |
| Validate 按钮不可用 | 选择文案列和至少一行，并上传图片 |
| 图片无法上传 | 确认文件为图片，并检查数量和总容量 |
| 回写失败 | 重新 Import 页面，确认内容后再次导出 |
| 图片无法显示 | 重新 Import，确认当前账号可以访问页面附件 |
