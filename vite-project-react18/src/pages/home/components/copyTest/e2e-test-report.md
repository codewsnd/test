# CopyTest 回归记录（2026-09-07）

使用 Computer Use 浏览器控制，在 `http://localhost:5173/copyTest` 操作真实前端。图片来自 `/Users/deft/dev /e2e-assets`（`dev` 后含不换行空格）。AI 为轮次 mock，不识别真实图片文字。

测试页：[CopyTest QA — 2 Tables](http://192.168.66.200:11002/spaces/DEV/pages/163939/CopyTest+QA+20260714-174344+2+Tables+-+Existing+Columns+Fixture)。本轮已实际回写测试页，版本从 21 更新至 23。

## 浏览器验证

| 轮次 | 场景 | 实际结果 |
| --- | --- | --- |
| 1 | Table1，11 张 PNG，Add + Single-image，全匹配 | 两个 Evidence 组各新增一张本批图片，原图片保留 |
| 2 | Table1，4 张 PNG，Add + Multi-images，部分匹配 | 仅匹配行追加；同组内未匹配行及另一个未匹配组保持原样 |
| 3 | Table1，4 张 PNG，Replace + Multi-images，无匹配 | 显示无匹配提示；全部 Evidence 和 Result 与上一轮完全一致；上传列表保留 |
| 4 | 保留上一轮上传列表，Replace + Single-image，全匹配 | 显示匹配 2 张；每组替换为一张本批图片 |
| 5 | Table1，Replace + Multi-images，部分匹配 | 显示匹配 2 张；仅第二组替换为两张图片，第一组保持原样 |
| 6 | Table1，Add + Single-image，无匹配 | 显示无匹配提示；全部 Evidence 和 Result 与上一轮完全一致 |
| 7 | 重新 Import 后选择 Table2，Add + Multi-images，全匹配 | 显示匹配 4 张；各组保留旧图并追加本批四张图片 |
| 8 | Table2，Replace + Single-image，部分匹配 | 显示匹配 2 张；交替的匹配组被替换，未匹配行保持上一轮结果 |

同时验证：

- 11 张图片实际坐标为首行 10 张、第二行 1 张。
- 图片可打开预览，缩放和下一张操作可执行。
- 重复图片与非图片文件没有加入上传列表；删除按钮可移除指定图片。
- 空列表显示 `Drag screenshots here`；非空显示 `Drag more screenshots here`。
- 点击拖拽区域未打开文件选择器；上方 `Select screenshots` 可正常选择文件。
- Test Result 后排列 Add / Replace，下一行 Test Evidence 后排列 Single-image / Multi-images。
- AI comparson 边框最初实测为 `#eee`，已修正；修正后计算样式为 `1px solid rgb(204, 204, 204)`，即 `#ccc`。

## 实际导出与重新导入

| 回写 | 选择范围 | 重新导入与原始 storage 对比 |
| --- | --- | --- |
| 21 → 22 | Table1 / Target，仅勾选第一条可选行 | 第一组 Evidence 合并范围内 7 条结果全部保存；范围外 Group 2 保留远端旧内容；Table2 原文完全相同，Table1 非目标列单元格原文完全相同 |
| 22 → 23 | Table2 / Target，仅勾选第一条可选行 | 原 Evidence 合并范围内所有结果、24 个图片显示实例与导出前完全相同；Table1 原文完全相同，Table2 非目标列单元格原文完全相同 |

两次导出未出现 `Confluence table changed` 提示。两张表的物理行数均保持 28。该结论覆盖当前测试页和上述操作，不能代表页面结构被修改后的所有异常情况。

## Mock 与代码验证

- 配置模式失败说明增加 `Mock round N`，使无匹配内容经过多个周期仍可区分；成功 Import 后重新计数。
- 原有全匹配、部分匹配、无匹配轮换及相邻业务响应去重继续保留。
- 增加 36 轮回归，检查无匹配跨周期内容变化及返回行契约。
- CopyTest 全量：48 个测试文件、316 项测试通过。
- 边框修正后补跑 TablePreview：2 个测试文件、19 项测试通过。
- 本次修改的 TypeScript 文件 ESLint 通过；`git diff --check` 通过。
- `tsc -p tsconfig.app.json --noEmit` 未通过，仍有 124 项既有诊断；本次修改文件无诊断。未运行 SonarQube。

## 未完成的真实交互覆盖

Computer Use 不允许原生控制 Codex 窗口，因此未完成 Finder 到内置浏览器的真实跨窗口文件拖拽。空区/非空区 drop 接收、多文件转交、点击不选文件及处理期间锁定由组件测试覆盖；本轮另实测了点击拖拽区域不会打开文件选择器。不能把组件测试等同于真实系统拖拽已通过。

结构变更、表定位歧义、合并冲突等异常分类由现有导出测试覆盖，本轮未故意破坏真实 Confluence 页面逐一触发错误。
