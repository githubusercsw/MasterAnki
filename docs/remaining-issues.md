# MasterAnki 遗留问题与逻辑缺陷盘点（2026-09-01）

> 目的：在压缩上下文前，对与用户核心目的（生成卡片 → 入库 AnkiDroid → 编辑同步 → 统计）相关的全部链路做一次静态审计，记录遗留问题与重大逻辑缺陷，供 Phase 4 及后续规划排期。
> 方法：通读 `src/lib/anki/*`、`src/lib/llm/*`、`src/pages/*` 与 Android 原生插件（AnkiDroid/Inbox），未执行真机冒烟（见 docs/smoke-checklist.md，v0.3.1 已发布待测）。

## 置信度说明
- 本盘点为**静态代码审计**结论，标注 `{claimed}`；真机行为以 docs/smoke-checklist.md 冒烟结果为准。
- 涉及 Java 原生层的结论一律 `{claimed}`（CI 只验证编译，不验证功能）。

---

## 一、P0 — 重大逻辑缺陷（影响核心目的，建议优先修复）

### 1.1 生成链路卡片类型硬编码 `basic`，与用户所选模板脱节 `{auto:ci}`（前端可验证）
- **位置**：`src/pages/EntryDetailScreen.tsx:155` → `pipeline.run(text, entry?.title, 'basic')`；`LLMPipeline.run()` 透传 cardType；`LLMPipeline.generateFlashcards()` 直接消费。
- **现象**：用户在 TemplateSelect 页选了 Cloze/Image Occlusion 模板，但 EntryDetail 生成时永远传 `'basic'`。生成侧 prompt 要求 "Prefer basic cards"（DEFAULT_FLASHCARD_CREATION_PROMPT），`validateFlashcardsResponse` 也按 basic 结构校验（要求 front/back 非空）。
- **影响**：Cloze 模板用户永远得到 basic 卡片；即使选了 Cloze 模型，noteBuilder 会按 `card.type==='basic'` 构建 canonical（Front/Back），再映射到 Cloze 模型字段（Text/Extra），字段错位或为空。
- **根因**：`EntryDetailScreen` 未读取用户已选模型/类型；pipeline 的 `cardType` 参数来源缺失。
- **修复方向**：从 `getSelectedAnkiModel()` + `resolveModel.ts` 推导 cardType（或 TemplateSelect 额外持久化 cardType）；生成侧 prompt/schema 按类型分支。

### 1.2 原生 `ensureModel` 忽略 fields/templates 参数，自建模型字段不完整 `{claimed}`（Java 层）
- **位置**：`AnkiDroidPlugin.ensureModel()` 只取 `modelKey`，前端传入的 `fields`/`templates` 被完全忽略；`ensureModel()` helper 用 `addNewBasicModel(name)` 兜底——无论要建的是 Cloze 还是 IO，都建成 **Basic 模型**。
- **现象**：若 AnkiDroid 中不存在同名模型，前端 `buildAddTask` 先 `ensureModel({modelKey: note.modelKey, fields, templates})`（前端期望建 Cloze/自定义字段），原生实际建出 Basic 壳子。
- **影响**：自定义模型/Cloze/IO 在"目标模型不存在"时入库字段错乱；目前恰好 AnkiDroid 通常自带 Basic/Cloze，故障被掩盖，但**不保证**。
- **修复方向**：`ensureModel` 接收 fields/templates 并用 `addNewModel`（而非 `addNewBasicModel`）按定义建模型；或前端在模型不存在时降级提示。

### 1.3 编辑同步 updateNote：改变 type/模型时字段顺序与模型不匹配 `{claimed}`（Java 层）
- **位置**：`AnkiDroidPlugin.updateNote()`：用 `note.modelKey` 解析 modelId → 按该模型 fieldOrder 拼接数组 → `updateNoteFields(noteId, fields)`。
- **现象**：卡片入库后用户改 type（basic→cloze）或所选模型变化，noteBuilder 按新类型构建 canonical → 映射到新模型字段；而 AnkiDroid 原 note 仍是旧模型，updateNoteFields 按新模型顺序更新旧 note 的字段，字段错位/数据丢失。
- **影响**：编辑已入库卡片时若类型/模型变更，AnkiDroid 侧内容损坏；AnkiDroid API 的 updateNoteFields 无法跨模型迁移。
- **修复方向**：编辑时**锁定 type 与模型**（有 noteId 的卡片不可改类型），或改为"删除旧 note + 重建新 note"（需处理 noteId 变更回写）。

### 1.4 批量删除/替换卡片不同步 AnkiDroid → 孤儿 note `{claimed}`（Java 层）
- **位置**：`EntryDetailScreen.persistCards()` 增量更新时 `Inbox.deleteCards({cardIds: removedIds})` 仅删本地，AnkiDroid 中已入库的 note 残留。
- **现象**：重新生成卡片触发"变更摘要→确认门→删除旧卡"时，旧 note 留在 AnkiDroid 牌组里成为孤儿（内容过时但继续被复习）。
- **影响**：直接违背"增量更新替换语义"；用户会复习到已废弃卡片。
- **修复方向**：`deleteCards` 时对有 noteId 的卡片调用 `AnkiDroid.deleteNote`（需在原生插件补 deleteNote 接口，官方 AddContentApi 无删除 → 需 ContentProvider/直接 DB 或提示手动删）。

### 1.5 统计事件维度不完整：`card_generated` 无 providerId `{auto:ci}`（前端可验证）
- **位置**：`InboxPlugin.saveCards()` 埋 `card_generated` 仅带 sourceType（contentType），providerId 恒为 null；`addNote` 埋 `card_added` 带 providerId。web 降级 `recordStat` 同样。
- **现象**：Phase 4 若按"Provider × 来源"交叉分析，`card_generated` 缺 provider 维度，只能从 `card_added` 拿 provider，两事件无关联键。
- **影响**：生成阶段（尚未入库）的卡片无法按 Provider 归因。
- **修复方向**：`saveCards` 调用处（EntryDetail persistCards / Inbox 分享入口）透传当前 active providerId，或 card_generated 埋点时读 getActiveProviderId()。

---

## 二、P1 — 中等缺陷（体验/一致性，可排入 Phase 4 前后）

### 2.1 更新失败后本地已改但 AnkiDroid 未同步，状态标记 error `{claimed}`
- **位置**：`CardEditorScreen` 保存时先 `Inbox.updateCardContent`（本地成功）→ `AnkiDroid.updateNote` 失败 → `updateCardStatus('error')`。
- **现象**：本地与远端分叉；重试按钮存在（3.7-2 批量一致），但单卡编辑的重试会重新 updateNote——可行但无显式"重试"入口在编辑页。
- **修复方向**：编辑页失败态提供显式重试按钮（复用批量失败交互模式）。

### 2.2 未入库（无 noteId）卡片编辑后不建 note，状态仍 pending `{claimed}`
- **位置**：`CardEditorScreen` 无 noteId 时仅更新本地，返回"已更新"（editor.updated），不触发入库。
- **现象**：用户编辑完一张从未入库的卡，以为已同步，实际仍在收件箱，需再点"加入 Anki"。
- **影响**：状态语义不清（updated ≠ added）；新手困惑。
- **修复方向**：编辑页保存按钮按 noteId 分支——无 noteId 时提示"保存到收件箱，需再执行入库"或直接入库。

### 2.3 `useDeckSelector` 自定义牌组模式下无"切回选择器"入口 `{auto:ci}`
- **位置**：`pickCustomDeck()` 置 `useCustomDeck=true` 后 UI 只剩自由输入；无按钮切回真实牌组选择。
- **影响**：误触"新建牌组"后无法回到下拉选择；可用性缺陷（非数据错误）。
- **修复方向**：自定义模式下提供"选择已有牌组"入口（toggle）。

### 2.4 去重阈值与哈希口径差异 `{auto:ci}`
- **位置**：`dedup.ts` 哈希用 `normalizeContent`（去标点空白小写）；`isNearDuplicate` 阈值 0.9（字符 bigram Jaccard）。
- **现象**：同一 URL 排版微差 → 哈希不命中，近似度可能 < 0.9 漏判；"内容几乎相同但顺序微调"的文本会被判为新来源。
- **影响**：去重是"自动化缺把关"的防线，漏判 → 重复卡片。
- **修复方向**：阈值可配置 + 在冒烟清单中加入去重场景验证；Phase 4 后可换 embedding。

### 2.5 Pipeline 分块并发：单块失败整体失败，无降级 `{auto:ci}`
- **位置**：`generateFacts` 用 `Promise.all(chunks.map(...))`，任一块 LLM 失败 → 整体 reject，已成功的块丢弃。
- **影响**：大文本（>8000 字符多块）时单块失败浪费整轮生成。
- **修复方向**：`Promise.allSettled` + 已成功块合并 + 失败块计数上报。

### 2.6 ScoreFacts 失败静默保留全部 `{auto:ci}`
- **位置**：`scoreFacts` 非 schema 模式直接返回全部（保留全部）；schema 模式单批失败 `continue`（该批全部保留）。
- **现象**：评分步骤失败 → 不评分全保留，行为与"过滤低价值事实"目标背离（可接受降级但应提示）。
- **修复方向**：返回 `{facts, degraded}` 标记，UI 提示"评分降级"。

---

## 三、P2 — 遗留项/已知边界（规划内，勿忘）

| # | 项 | 说明 |
|---|----|------|
| 3.1 | 离线队列持久化 | 三根源问题治理中的设计项，**仅设计未实现** `{claimed}` |
| 3.2 | 输入源 F12-F16（url/pdf/voice/image/youtube/epub 原生解析） | `ensureExtracted()` 对非 text 类型仅提示"需要原生"，Phase 5 规划 `{claimed}` |
| 3.3 | 仪表盘 UI（Phase 4 主体） | StatsEvent 采集已就绪（含 sourceType/providerId 维度），UI 待建 `{claimed}` |
| 3.4 | 通知栏快捷（F19/F20） | 未做 `{claimed}` |
| 3.5 | 自定义提示词 UI | 设置页展开项已移除（上批），PromptService 后端保留，待接 UI `{claimed}` |
| 3.6 | Ollama endpoint 输入 | 已藏掉假输入框；Ollama 短期不上，真需要时补 get/setProviderEndpoint `{claimed}` |
| 3.7 | 日志页（settings 的 logs accordion） | 已有日志查看，导出走系统分享（真机 3 BUG 修复已验） `{human:device}` |
| 3.8 | Image Occlusion 生成 | pipeline 未接 IO 流程；原生 `checkDependency("ioenhanced")` 仅探测模型存在 `{claimed}` |
| 3.9 | CardListItem 拆分降级 | 3.7-4 按风险降级仅抽 1 个子组件，其余拆分留 Phase 4 `{auto:ci}` |

---

## 四、压缩上下文后的恢复指针

- 当前最新：v0.3.1 已发布（run 33468182132 success），**待真机冒烟**（docs/smoke-checklist.md，A-E 全过 → 启动 Phase 4）。
- 本盘点文档：`docs/remaining-issues.md`（本文件）。
- 上一批次提交：`1cec303`（deck selector 解耦）+ `3a64102`（设置页可靠性 + CI Android job）。
- CI 状态：push main 触发 quality-gate + android-build 双 job（android-build 为新增把关）。
- 遗留动作：冒烟 → P0 修复排期 → Phase 4 仪表盘。
