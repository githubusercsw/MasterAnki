# MasterAnki Phase 2 复检报告（数据管理）

> 阶段范围：增量去重 + 变更摘要/人工确认门 + 批量操作（入库/删除/导出）+ 拖拽排序
> 完成日期：2026-08-31
> 关联索引：`_memory/INDEX.md`

## 一、进入前的连锁反应排查结论

Phase 2 三块功能对现有代码的触点已预判，实现时逐一落实，**无未预期的连锁反应**：

| 预判触点 | 实际落地 | 状态 |
|---------|---------|------|
| `CardDraft` 缺 `sourceHash` | `plugins/Inbox.ts` 为 `CardDraft`/`SaveEntryInput` 补可选 `sourceHash` | ✅ |
| 生成流程需插入"查重→摘要→确认" | `EntryDetailScreen.generate()` 重构：已有卡片时先 `buildChangeSummary`，有变更则弹 ConfirmGate，确认后 `persistCards`（先删替换旧卡再写新卡） | ✅ |
| 批量入库需复用单卡逻辑 | 单卡逻辑提取为 `buildAddTask(card)`，单卡与批量共用 | ✅ |
| 拖拽后需持久化 sortOrder | `handleReorder` 重排本地 + 逐个 `updateCardOrder` 持久化 | ✅ |
| 批量删除/全选 | `InboxScreen` 选择模式 + `deleteEntries`；`EntryDetailScreen` 卡片多选 + `deleteCards` | ✅ |

## 二、新增文件清单

| 文件 | 职责 |
|------|------|
| `src/lib/anki/dedupService.ts` | 同源查重（哈希级 `checkDuplicateSource` / 文本级 `checkDuplicateText`）+ 变更摘要 `buildChangeSummary`/`hasChanges`（纯函数、依赖注入） |
| `src/lib/anki/batch.ts` | 通用批量执行器 `runBatch`（串行 + 失败清单 + 进度回调） |
| `src/lib/anki/export.ts` | JSON/CSV 序列化 + 浏览器下载（`downloadJson`/`downloadCsv`） |
| `src/components/ConfirmGate.tsx` | 人工确认门（受控 modal，支持变更摘要/自定义描述/失败清单） |
| `src/lib/anki/dedupService.test.ts` | 10 用例：查重（哈希/文本/无哈希跳过）+ 摘要（新增/无变化/变更/移除/键匹配） |
| `src/lib/anki/batch.test.ts` | 5 用例：全成/部分失败/不中断/进度/空任务 |
| `src/lib/anki/export.test.ts` | 7 用例：JSON 结构/字段/CSV 头/行数/转义/标签 |

## 三、修改文件清单

| 文件 | 改动 |
|------|------|
| `src/plugins/Inbox.ts` | `CardDraft`/`SaveEntryInput` 补可选 `sourceHash`（向后兼容） |
| `src/pages/EntryDetailScreen.tsx` | ① 卡片按 sortOrder 排序展示 ② 生成流程接入增量更新 + ConfirmGate ③ 批量工具栏（全选/反选、全部入库、删除所选） ④ 拖拽排序（IonReorderGroup + updateCardOrder 持久化） |
| `src/pages/InboxScreen.tsx` | 批量管理模式：全选/反选、批量导出 JSON/CSV、批量删除（二次确认门） |
| `src/test/setup.ts` | 补 `crypto.subtle`（Node webcrypto）——jsdom 缺失导致 sha256 卡死 |

## 四、三根源性问题治理核对

| 根源问题 | Phase 2 落地 | 说明 |
|---------|-------------|------|
| 自动化缺把关 | **变更摘要 + 人工确认门**（增量更新、批量入库、批量删除均先确认）；批量入库**失败清单**展示；导出无破坏性直接执行 | 强化把关，无静默操作 |
| 状态依赖不可靠 | sortOrder 显式持久化；卡片状态显式流转（pending→added/error）；删除必须显式确认 | 无隐式状态推断 |
| 环境假设耦合业务 | dedupService/batch/export 均为纯逻辑 + 依赖注入，不触碰 Capacitor 插件，可在 jsdom 单元测试 | 保持解耦 |

## 五、校验结果（2026-08-31）

| 检查 | 结果 |
|------|------|
| `npm run typecheck` | ✅ 通过 |
| `npm run lint` | ✅ 0 error / 7 warning（既有 React Compiler 规则降级 warn） |
| `npm run build` | ✅ 通过（chunk>500kB 提示，非错误） |
| `npm run test` | ✅ 41/41 通过（validateJson 8 + providers 11 + dedupService 10 + batch 5 + export 7） |

## 六、测试期问题与修复

| 问题 | 根因 | 修复 |
|------|------|------|
| 全量测试卡死无输出 | jsdom 不提供 `crypto.subtle`，`sha256` 的 `digest` Promise 永不 resolve | `setup.ts` 注入 Node `webcrypto.subtle`（用 ESM `import` 而非 `require`——ESM 项目下 `require` 不可用，曾导致二次卡死） |
| export JSON 测试断言失败 | `sourceHash` 为 `undefined` 时被 `JSON.stringify` 丢弃，属性缺失 | `serializeJson` 可空字段显式 `?? null`，保证结构稳定 |
| `tsc` 报 `front` 重复指定 | 测试辅助函数 base 对象与 spread 重复定义 `front` | 重构 `makeCard` 为 base+spread 单次定义 |

## 七、遗留与边界

- **拖拽排序的"分组显示"**：F 需求原文为"分组显示 + 拖拽排序"，当前实现按 sortOrder 全量排序；"分组显示"（按状态/类型分组）归入 Phase 3 UI/UX 进一步打磨。
- **语义去重降级**：`checkDuplicateText` 使用字符二元组 Jaccard 相似度（轻量、无网络）；embedding 级语义去重保留接口，后续可替换实现。
- **导出在原生环境的落盘**：当前 `downloadText` 走浏览器下载；原生 Capacitor 环境可切换 `Filesystem` 写入（接口已预留位置，Phase 6 工程质量补）。
