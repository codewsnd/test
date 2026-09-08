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
2. 点击 **Select screenshots** 选择图片，或直接将图片拖入图片区域。也可以先点击图片区域（或用 Tab 聚焦），再按 **Ctrl+V / ⌘V** 粘贴剪贴板中的图片。
3. 确认图片列表后，点击 **Validate**。

粘贴支持一张或多张图片，沿用上传的去重、数量和大小限制；纯文本不会加入图片列表。读取图片和 Validate 期间暂停接收粘贴。

**Select screenshots** 下方的 **Display Configuration** 提供两组配置，默认 **Add + Single-image**：

| 配置 | 行为 |
|---|---|
| Test Evidence：Add | 保留历史 Evidence，追加本批匹配的新图片；重复图片不重复追加，对应历史图片的人工状态保留 |
| Test Evidence：Replace | 仅替换本批有匹配图片的行的 Evidence，未匹配行保持原样 |
| Test Evidence：Single-image | 本批每个 Evidence 组最多匹配一张图片；Add 仍保留历史图片 |
| Test Evidence：Multi-images | 本批允许每组匹配多张相关图片 |

两组配置都只应用于已匹配的 Test Evidence；先确定保留、追加或替换后的 Evidence，再生成对应图片的 Test Result。未匹配的图片不参与追加或替换，也不会产生 Test Result。
匹配表示截图与待检查文案相关，不等于文案校验通过；相关但文案不同的截图会作为 Failed 结果保留。
Validate 完成后提示匹配的图片数量，同一图片被多行引用只计一次。无匹配时保留原表格和上传列表，方便调整或重试。

当前 AI 使用 mock，不读取真实截图文字。每次成功 Import 后轮次重置，依次模拟全部匹配、部分匹配、无匹配，再循环，并继续轮换图片数量、匹配分组和通过状态；对有效非空输入，工厂会避免连续两次返回相同的校验内容。部分匹配轮还会在多行 Evidence 组内保留一个未匹配行，并在后续周期轮换该行，用于检查共享图片不会误更新未匹配行。单行、单图场景下部分匹配数量可能与全部匹配相同。Single-image 和 Multi-images 都遵循当前配置。

配置模式的 Mock 失败说明带有 `Mock round N`，方便识别本次结果；无匹配场景即使经过多个循环，也可通过轮次区分返回内容。该轮次在成功 Import 后重新计数。

每次最多选择 50 张图片，总容量不能超过 10 MB。重复图片会自动去重。

[截图]

### 4. 查看结果

- **Passed**：截图支持当前文案。
- **Failed**：文案缺失、不完整、不一致，或无法确认。
- **Screen01 (文件名)、Screen02 (文件名)……**：当前结果对应的 Evidence 图片，文件名不包含扩展名。

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

1. 确认当前选择的 Table 和 Comparison Column 正确。导出范围以勾选行为起点，自动包含相关 Test Evidence 合并单元格覆盖的全部行，即使部分行未勾选；这些行的当前 Test Result 也一起导出。
2. 选择 **Export > Confluence**。
3. 在确认窗口中点击 **Confirm**。
4. 等待成功提示。

回写成功后，建议重新 Import 一次，确认 Confluence 页面与当前预览一致。

导出失败时会按实际原因提示，不再统一显示“Confluence table changed”：

| 原因 | 处理方式 |
|---|---|
| 未选择表格、比较列或数据行 | 完成选择后重试 |
| 无法读取最新页面 | 检查连接和访问权限后重试 |
| 原表格无法定位，或有多张相同结构的候选表 | 检查表格结构；歧义时使用不同表头，再重新 Import |
| 比较列文案或合并结构发生变化 | 重新 Import 并校验最新内容 |
| 重复 Result / Evidence 单元格或单元格映射失败 | 检查重复列及合并布局，再重新 Import |
| 本地表格无法解析、结构变化或导出超出目标范围 | 按提示重新 Import 或重试 |

失败不会清除本地校验结果；需要重新 Import 时，本地修改需重新进行。

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
