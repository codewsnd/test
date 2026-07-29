h1. CopyTest 用户手册

h2. 1. CopyTest 是什么

CopyTest 用于将 Confluence 表格中的文案与 UI 截图进行比较，并在表格中生成：

* *Test Result*：显示 Passed、Failed、对应 Screen 和失败原因。
* *Test Evidence*：显示用于支持校验结果的截图。

完成检查后，可以将结果回写到 Confluence，或将完整表格导出为 PDF、Word、Excel。

{info:title=当前环境提示}
当前版本的 Validate 使用随机 Mock 数据，不会根据截图内容进行真实识别。Mock 仅用于测试页面操作、表格合并、图片删除和导出流程，结果不能作为正式验收结论。
{info}

h2. 2. 快速开始

h3. 第一步：导入 Confluence 页面

# 在 *Confluence URL* 输入框中粘贴页面地址。
# 点击 *Import*。
# 导入成功后，页面会显示 Table、Comparison Column 和表格预览。

_{在此插入截图}_

URL 必须以 {{http://}} 或 {{https://}} 开头。

如果输入或导入失败，错误会显示在输入框下方，旧表格不会继续显示。

h3. 第二步：选择 Table

在 *Table* 下拉框中选择需要处理的表格。

* 有效表格会连续显示为 {{Table1}}、{{Table2}}……{{TableN}}。
* 切换 Table 后，需要重新选择 Comparison Column。
* 切换 Table 会清空尚未 Validate 的上传截图。

h3. 第三步：选择 Comparison Column

在 *Comparison Column* 中选择需要与截图比较的文案列。

* 空表头会显示为 {{Column N}}。
* 同名表头会附加 {{Column N}}，方便区分。
* 已生成的 Test Result 和 Test Evidence 不会出现在可选列表中。

选择后，预览只显示：

* 行选择框
* 来源列
* Test Result
* Test Evidence

清空 Comparison Column 后，会恢复完整表格预览。

h3. 第四步：选择需要校验的行

选择 Comparison Column 后，文案非空的行会默认勾选。可以取消不需要校验的行。

如果来源列中存在合并单元格，合并范围始终作为一个整体处理。

例如第 2、3 行属于同一个合并单元格：

{code:language=text}
第 1 行：独立处理
第 2、3 行：作为一个整体处理
第 4 行：独立处理
{code}

第 2、3 行不能被拆分校验，Test Result 和 Test Evidence 也不会从中间拆开。

h3. 第五步：上传截图

# 点击 *Upload Screenshot*。
# 点击 *Select screenshots* 选择一张或多张截图。
# 确认截图列表后点击 *Validate*。

上传限制：

|| 项目 || 限制 ||
| 文件类型 | 图片文件 |
| 最大数量 | 50 张 |
| 最大总容量 | 10 MB |
| 重复图片 | 自动按图片内容去重 |

Validate 完成后，上传窗口会自动关闭，本次上传列表会被清空。

h3. 第六步：检查结果

Test Result 会显示：

* *Passed*：截图中存在支持当前文案的内容。
* *Failed*：截图中的文案缺失、不完整、不一致或无法确认。
* *Screen01、Screen02……*：当前行对应的 Evidence 图片。

Test Evidence 会显示实际截图。点击图片可以放大查看。

h2. 3. Evidence 合并和 Screen 编号

一张截图可以支持多行，一行也可以对应多张截图。

如果相邻行共享截图，Test Evidence 可以合并显示，但每行的 Test Result 仍只显示自己实际使用的 Screen。

示例：

|| 行 || 文案 || 命中的截图 ||
| 1 | 你好 | 图片 A |
| 2 | 我在 | 图片 A |
| 3 | 吃饭 | 图片 A、图片 B |

如果图片 A 的内容是“你好我在吃饭”，图片 B 的内容是“吃饭”，结果应为：

* 第 1、2、3 行的 Test Evidence 合并，并显示图片 A、B。
* 第 1 行：Passed + Screen01。
* 第 2 行：Passed + Screen01。
* 第 3 行：Passed + Screen01、Screen02。
* 与这些文案无关的图片不会显示。

Screen 编号只表示当前 Evidence 组中的显示顺序。

h2. 4. 删除 Evidence 图片

只有选择了 Comparison Column，Evidence 图片才会显示删除按钮。

删除图片后，系统会自动：

* 从 Test Evidence 中移除该图片。
* 更新所有相关 Test Result 中的 Screen。
* 将剩余图片重新编号。
* 重新计算 Evidence 的合并范围。
* 在某行没有任何图片后，移除该行的 Passed 或 Failed。

例如删除 Screen01 后，原来的 Screen02 会自动变为 Screen01。

如果第 2、3 行原本是一个合并单元格，删除图片后仍会保持第 2、3 行为一个整体。

h2. 5. 导出

将鼠标移动到 *Export* 按钮上，可以选择：

|| 选项 || 导出内容 ||
| Confluence | 将当前 Comparison Column 对应的 Test Result 和 Test Evidence 回写到 Confluence |
| PDF | 下载当前选中的完整 Table |
| Word | 下载当前选中的完整 Table |
| Excel | 下载当前选中的完整 Table |

h3. 导出到 Confluence

# 完成 Validate 或图片删除。
# 将鼠标移动到 *Export*。
# 点击 *Confluence*。
# 在确认窗口中点击 *Confirm*。

回写只更新当前 Comparison Column 对应的 Test 双列，不会修改其他普通列或其他 Comparison Column 已生成的 Test 双列。

如果 Confluence 表格在导入后发生了无法安全处理的变化，系统会要求重新 Import，不会强制覆盖。

建议回写成功后再次 Import，确认 Confluence 与页面预览中的数据、图片和合并单元格一致。

h3. 导出为本地文件

* PDF、Word、Excel 都包含当前选中的完整 Table。
* Passed 显示为绿色，Failed 显示为红色。
* Test Evidence 会包含图片。
* PDF 会将整个表格放在一页中；表格过大时可能无法导出。
* 文件名格式为当前时间，例如 {{20260723153045.pdf}}。

h2. 6. 常见错误

|| 场景 || 页面提示或处理方式 ||
| URL 格式不正确 | {{In valid URL format, Please enter a valid Http:// or https:// URL}} |
| 页面没有有效表格 | {{No valid table found}} |
| URL、权限或 Token 有问题 | 检查 Confluence URL、登录状态或 Token 后重新 Import |
| 文件不是图片 | 重新选择图片文件 |
| 图片超过 50 张 | 删除部分图片后重试 |
| 图片总容量超过 10 MB | 压缩或减少图片后重试 |
| Confluence 表格已发生变化 | 重新 Import 后再次操作 |
| 本地文件导出失败 | 确认 Evidence 图片能够正常显示后重试 |

h2. 7. 使用提示

* 修改 URL 会立即清空当前导入结果和未保存操作。
* 文案为空的行不能参与 Validate。
* 未选择 Comparison Column 时，可以查看和导出完整表格，但不能上传截图或删除 Evidence。
* 同一张图片重复上传时只保留一份。
* Confluence 回写前请确认当前选择的 Table 和 Comparison Column 正确。
* 当前 Validate 为随机 Mock，正式使用真实识别结果前需要切换到真实 AI 服务。
