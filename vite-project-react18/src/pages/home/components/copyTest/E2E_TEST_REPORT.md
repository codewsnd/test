# CopyTest Chrome E2E 测试报告

## 结论

- 测试日期：2026-07-14
- 被测页面：`/copyTest`
- Confluence fixture：`CopyTest QA 20260714-174344 1 Table - Rowspan Fixture`
- 执行结果：30 / 30 通过
- 每个用例都完成了 `本地操作 -> Export Confirm -> 刷新 Confluence 检查 Test 双列 -> 再次 Import -> 比较语义签名` 的闭环。
- 再次 Import 后 Export 按钮均恢复为禁用，说明成功回写后待提交状态已清理。
- 测试使用 `COPY_TEST_AI_CHAT_MOCK_ENABLED=true`。本报告验证的是随机 mock 结果的结构、合并、删除、隔离与持久化，不代表真实 GPT-5.4 OCR/语义准确率。

语义签名只比较稳定业务信息：Pair ownership、物理行、rowspan、Passed/Failed、失败原因、Screen 顺序、图片 ID/instance ID 和文件名；不比较 Blob URL 或 iframe 注入节点。

## 30 个测试用例

| ID | 场景 | Confluence 回写与再次导入断言 |
| --- | --- | --- |
| CT-01 | 有效 URL、Target 全选、单图 Validate | Target Test 双列唯一；28 行语义签名前后一致 |
| CT-02 | 非法 URL 后恢复 | 精确行内错误、表格隐藏、无全局错误 toast；恢复有效 URL 后完成回写往返 |
| CT-03 | 导入后修改 URL | URL 与已导入值不同时 Export 禁用；恢复后回写，28 行签名一致 |
| CT-04 | 重复 Import | 无 `Loaded 1 table`；生成 Test 列不进入 Comparison Column；回写后无重复 Target 表头 |
| CT-05 | 全选、空值组与禁用态 | 9 个非空原子组可选，最后一个空值组禁用；回写后选择拓扑与数据正确 |
| CT-06 | rowspan=2 且 mock 返回空结果 | 空结果仍允许 Export；Confluence 清空旧内容并保留 Test 双列表头；再次导入仅有 3 行表头签名 |
| CT-07 | 单个 rowspan=3 原子组 | 只产生一个选择锚点，回写及再次导入保持原子组结构 |
| CT-08 | 单个 rowspan=4 原子组 | Result/Evidence 不切开四行组；10 行签名前后一致 |
| CT-09 | 相邻 rowspan=2 + rowspan=3 | 两个原子组完整处理；Confluence 与再次导入签名一致 |
| CT-10 | 非相邻 rowspan=2 + rowspan=4 | 两端独立处理，不跨越未选组；多 Screen 结构持久化 |
| CT-11 | 同时选择前三组 | 选择锚点为 3 个，来源 rowspan 精确为 `[2,3,4]`，不会把组内物理行拆开 |
| CT-12 | 相同图片重复上传 | MD5 去重后上传列表只有 1 张；Confluence 不出现重复 Screen |
| CT-13 | Validate 前删除上传图片 | 删除按钮唯一且有效，2 张变 1 张；被删除图片不进入回写结果 |
| CT-14 | 上传非图片后恢复 | 非图片被拒绝并显示 `Please upload image files only`；合法图片可继续 Validate 和回写 |
| CT-15 | 单组多图 Validate | 一次命中 2 个 Evidence card；Screen01/02 回写并再次导入一致 |
| CT-16 | 上传图片未被 AI 使用 | 上传 3 张、实际引用 1 张、排除 2 张；再次导入只恢复实际 Evidence 子集 |
| CT-17 | 同时存在 Passed 与 Failed | Passed/Failed 均出现，Failed 包含问题说明；32 行签名前后一致 |
| CT-18 | 三组共享一张 Evidence | Evidence 合并为一个 `rowspan=9` 单元格；Result 仍分别保持 `[2,3,4]` |
| CT-19 | 多 Screen 与不同 Result 子集 | Evidence 并集含 2 个实例，两个 Result 使用不同图片子集；顺序和引用持久化 |
| CT-20 | Evidence 大图预览 | 预览图 alt 与缩略图一致，关闭后遮罩移除；随后回写并再次导入 |
| CT-21 | 取消删除 Evidence | 删除确认框可见；Cancel 前后语义签名完全不变；图片仍可回写与恢复 |
| CT-22 | 删除 Screen01 后重编号 | 原 Screen02 的 instance ID 保持不变但标签变 Screen01；Result 引用同步更新 |
| CT-23 | 删除相邻组共享的最后图片 | 删除前 Evidence `rowspan=5`；删除后两个 Result/Evidence 清空并恢复 `[2,3]` rowspan |
| CT-24 | Import 后删除最后一张图 | Passed/Failed、问题和 Screen 全部移除；Result/Evidence 均恢复来源 `rowspan=4` |
| CT-25 | 上传弹窗关闭/重开与重复 Validate | 2 张图片在关闭重开后保留；连续 Validate 后 Result/Evidence 表头始终各 1 个 |
| CT-26 | 创建 Platform Pair | Confluence 同时存在 Target 和 Platform 双列；Target 签名完全不变 |
| CT-27 | 反向 Pair 隔离与取消 Export | Cancel 后 Export 仍可用；修改 Target 后 Platform 签名不变 |
| CT-28 | 第一个重名 Module | UI 显示 `Module (Column 2)`；ownership 为 `1:Module`，Result/Evidence 表头各 1 个 |
| CT-29 | 第二个重名 Module | UI 显示 `Module (Column 4)`；ownership 为 `3:Module`；两个 Module Pair 均可恢复且互不覆盖 |
| CT-30 | 横向滑块跨 iframe 拖拽 | 86 ms 从 0 拖到 2122.5；`aria-valuenow === iframe.scrollLeft`；拖拽状态恢复后完成最终回写往返 |

## 测试中发现并修复的问题

1. Validate 返回全空结果时 Export 被错误禁用，导致无法把“清空 Test 双列”回写到 Confluence。
2. Import/附件请求失败可能同时出现全局 `message.error`，没有全部收敛到 URL 输入框下方。
3. 两个同名来源 header 在 Comparison Column 中无法区分。
4. Export -> Import 后删除一个 Evidence 连通块的图片，会全量重排不相关块的 Screen 顺序。
5. 附件接口只返回部分图片时，删除一张图会丢失未加载图片身份；空 base64 占位还可能进入附件 payload。
6. 横向滑块拖入 iframe 后父窗口收不到后续 mouse 事件，可能卡顿或停留在拖拽状态。
7. 仓库内旧测试说明文件包含明文 token，已删除；该 token 仍可能存在于 Git 历史，必须旋转。

横向拖拽修复保持原 mouse + requestAnimationFrame 方案：拖拽期间让 iframe 暂时不参与 hit-test，并在 mouseup、window blur、预览切换和组件卸载时恢复。

## 自动化验证

```text
Vitest: 36 files passed, 98 tests passed
CopyTest overall line coverage: 96.22%
copyTestTableEditor.ts: 97.23%
useCopyTestSession.ts: 99.12%
copyTestTableImages.ts: 97.90%
TablePreview.tsx: 96.88%
ESLint: passed
git diff --check: passed
npm run build: blocked by existing TypeScript errors outside copyTest; no reported error points to copyTest
```

## Fixture 覆盖限制

当前 Confluence 页面只有一张表，所有原始 header 都非空，Target 的 rowspan 序列为 `[2,3,4,2,3,4,2,3,4,2]`。因此以下边界不能宣称已由本页 Chrome E2E 覆盖：

- storage 完全不含表格时的 `No valid table found`；
- 空 header 不进入 Comparison Column；
- 多表切换、外部表格重排与并发写冲突；
- 精确的 `[1,2,1]`，即四行中只有第 2、3 行合并；
- 真实 GPT-5.4 OCR 与语义判断准确率。

这些结构性边界继续由同步 Vitest 覆盖。测试过程中为验证虚拟化选项状态生成过一个空 Viewport Pair，它保留在测试 fixture 中，不影响原始 12 列和其他 Pair 的 ownership。
