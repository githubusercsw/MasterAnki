# MasterAnki 逻辑与界面交互优化方案（Phase 3.7）

> 2026-09-01。本文件对应任务链：
>
> - 任务 3（先行）：从根源审视"逻辑和界面交互优化"命题是否科学 → 定位真正紧要问题 → 产出本方案
> - 任务 2（后行）：按本方案小步执行，逐项验证，避免触发根源性问题

## 一、命题审视：问题是否规范、科学？

**原始命题**："进行逻辑和界面交互的优化"（大工程，谨慎修改）。

**评估结论**：该命题**不规范**——它是一个"方向"而非"问题"：

1. 无验收标准（改到什么程度算"优化完成"？）
2. 无优先级（十几处可改的点，哪个最紧要？）
3. 未定位根因（是界面丑？交互乱？还是逻辑有坑？）

**规范化改造**：把方向拆解为**可验证的具体问题清单**（见下），每项含验收标准，按风险与价值排序，小步迭代。

## 二、真正紧要的问题（按风险排序，均基于代码实证）

### P0-1 牌组选择逻辑三处重复（连锁反应高危）

**实证**：`deckSelection` 相关状态机（realDecks / decksLoading / useCustomDeck / showDeckSelector / pickRealDeck / pickCustomDeck）在
`src/pages/EntryDetailScreen.tsx`、`src/pages/ManualCreateScreen.tsx`、`src/pages/TemplateSelectScreen.tsx`
**三处各自实现一份**。将来任何牌组交互改动需同步三处，漏改即行为不一致。

- 根因：跨页面共享的 UI 状态机未抽离。
- 验收：三处共用一个 `useDeckSelector` hook，行为与现状一致（选择器/自由输入/新建切换逻辑不变）。

### P0-2 批量入库失败不置 error 状态（状态依赖不可靠）

**实证**：`EntryDetailScreen.addCardToAnki`（单卡）失败会 `updateCardStatus(status:'error')`；
但 `confirmBatchAdd` 走 `runBatch`，`buildAddTask` 抛错后 **card 状态保持原样（pending）**，两条路径状态行为不一致。
用户看到批量失败清单后，无法区分"失败待重试"与"从未尝试"。

- 根因：批量执行器（batch.ts）与业务状态（card.status）之间缺错误回写钩子。
- 验收：批量路径失败时，对应卡片 status 置 `error`，与单卡路径一致；UI 上"失败"可辨识、可重试。

### P1-3 异步反馈单一（交互体验缺陷）

**实证**：所有操作结果（成功/失败/提示）堆在一个 `message` 字符串 + `IonCard` 展示（EntryDetail/Inbox 均如此），
无 toast 分级、无批量进度、无失败卡片跳转。

- 根因：缺统一异步反馈层。
- 验收：引入轻量 `IonToast` 反馈（成功/错误分级）；批量入库展示进度（`runBatch` 已有 `onProgress` 回调但未用）；失败清单可点击定位到卡片。

### P1-4 EntryDetailScreen 上帝组件（结构性风险温床）

**实证**：单文件 645 行、17 个 useState，职责混杂（生成/增量/牌组/模板跳转/批量入库/批量删除/拖拽排序/多个确认门）。

- 根因：页面级状态与操作未分层。
- 验收：在不改变交互行为的前提下，按"卡列表/确认门/批量工具栏"抽 2-3 个纯展示子组件，主组件仅保留编排逻辑。
- **风险提示**：这是改动面最大的一项，须最后做、小步做、每步跑全量门禁。

## 三、可执行方案（小步、稳健、兼容）

> 兼容性护栏：① 前端插件接口（Inbox/AnkiDroid/Settings/ShareReceiver）一律不动；② web 降级同步；③ 每次提交前 typecheck + lint + test（本地 forks 模式）全绿；④ 每步独立提交，可单独回滚。

### 步骤 3.7-1：抽取 `useDeckSelector` hook

- 新建 `src/lib/anki/useDeckSelector.ts`：封装真实牌组加载 + 选择器/自由输入/新建切换 + 派生 `showDeckSelector`。
- 三页替换为 hook 调用，删除各自重复状态机。
- 验收：三页交互与现状一致；`src/lib/anki/selection.test.ts` 增补 hook 测试。

### 步骤 3.7-2：批量失败置 error（统一状态机）

- `batch.ts` 的 `BatchTask.run` 语义不变；在 `EntryDetailScreen.confirmBatchAdd` 的任务包装里，
  捕获失败并 `updateCardStatus(cardId, 'error')`（与单卡路径一致）。
- 验收：批量失败后卡片显示 error 标识；补单测。

### 步骤 3.7-3：统一异步反馈（toast + 进度 + 失败定位）

- 引入 `useAsyncFeedback`（轻量封装 `IonToast`，成功/错误分级，自动消失）。
- EntryDetail 批量入库接 `runBatch.onProgress` 显示进度；失败清单项点击跳转对应卡片。
- 验收：成功/失败 toast 出现且自动消失；批量过程有进度反馈。

### 步骤 3.7-4：EntryDetailScreen 拆分（最后做，谨慎）

- 抽 `CardListSection` / `BatchToolbar` / `EntryHeader` 三个纯展示组件（props 驱动，无自有逻辑）。
- 验收：交互行为零变化；全量门禁绿；视觉回归人工冒烟。

## 四、不做（边界收敛，避免过度工程）

- 不改插件接口与 Room 结构；不做视觉主题重构；不动导航结构；不新增依赖库。
- 若 3.7-4 风险过高（大量改动且难验证），可降级为仅抽 1 个最稳妥的子组件，其余留 Phase 4。

## 五、执行顺序与质量门禁

1. 3.7-1（低风险高收益，先做）→ 2. 3.7-2（状态一致性）→ 3. 3.7-3（反馈层）→ 4. 3.7-4（拆分，谨慎）
2. 每步：`typecheck` + `lint` + `test`（本地 forks 单进程）全绿后独立提交。
3. 全部完成后 `push main` 触发 CI 质量门禁；如需验证原生则打 tag。

## 六、结论

本轮优化的**真正紧要**之处不在"好看"，而在**重复逻辑（P0-1）+ 状态不一致（P0-2）+ 反馈缺失（P1-3）**三个根源性问题。
按"先抽 hook → 再统一状态 → 再补反馈 → 最后谨慎拆分"的顺序小步推进，即可在不触发连锁反应的前提下显著提升稳健性与可维护性。
