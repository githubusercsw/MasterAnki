# MasterAnki 深度差距分析 & Phase 3.6 规划

> 2026-08-31。对照原始计划书（F1-F20 + 架构设计）逐项核查当前实现，定位遗漏与隐患，
> 并为 Phase 3.6「原生能力补齐」做迭代规划。基于真机冒烟反馈（模板/牌组应读真实数据、分享、权限）。

## 一、总体结论

**架构骨架正确，原生层链路已打通，但"前端 ↔ AnkiDroid 真实数据"的读写在多个点仍是"写死/自由文本"而非"经 API 读写"，导致：**
1. 卡片写入用的是**写死的内置模型名**（已部分修复：模板选择接入 `getModels()` 真实模板）。
2. **牌组完全未接 API**：用户输自由文本，不读 AnkiDroid 真实牌组，也无法在 UI 新建牌组后同步。
3. **编辑已有卡片不真正同步 AnkiDroid**（只改本地副本，需手动"重新加入"），计划书 F2 验收项未达标。
4. **学习统计的采集层为零**：StatsEvent 表/接口都有，但无任何写入点，Phase 4 无法启动。
5. 若干计划书 P1/P2 项（通知栏快捷、E2E、备份同步、离线队列）未启动。

## 二、对照计划书逐项核查（F1-F20）

| 编号 | 功能 | 计划书 Phase | 当前状态 | 差距说明 |
|------|------|-------------|---------|---------|
| F1 | 多 LLM 后端支持 | P1 | ✅ 完成 | 7 Provider + LLMService 单例 + 统一注册 |
| F2 | 卡片编辑与手动创建 | P1 | ⚠️ 部分 | 手动建卡/编辑 UI 有；**编辑后不同步 AnkiDroid note** |
| F3 | 卡片模板选择 | P1 | ⚠️ 部分 | UI 三模板+内置名；已修接入 `getModels()` 真实模板，**但还需牌组联动** |
| F4 | 增量更新/智能去重 | P2 | ✅ 完成 | dedupService + ConfirmGate + 变更摘要 |
| F5 | 批量操作 | P2 | ✅ 完成 | 批量入库/删除/导出 |
| F6 | 拖拽/排序 | P2 | ✅ 完成 | updateCardOrder 持久化 |
| F7 | 深色模式 | P3 | ✅ 完成 | ThemeContext 浅/深/系统 |
| F8 | 卡片预览（Markdown） | P3 | ✅ 完成 | Markdown+KaTeX+highlight+表格 |
| F9 | 多语言 | P3 | ✅ 完成 | en/zh/ja 三语言 |
| F10 | 快捷操作 | P3 | ⚠️ 部分 | 长按 ActionSheet 有；**通知栏快捷入口未做** |
| F11 | 学习统计仪表盘 | P4 | ❌ 未启动 | StatsEvent 表/接口有，**采集写入为零** |
| F12 | 图片直接输入 | P5 | ❌ 未启动 | — |
| F13 | YouTube 字幕 | P5 | ❌ 未启动 | — |
| F14 | EPUB/MOBI | P5 | ❌ 未启动 | — |
| F15 | 剪贴板监听 | P5 | ❌ 未启动 | — |
| F16 | 浏览器扩展 | P5 | ❌ 未启动 | — |
| F17 | 单元测试 & E2E | P6 | ⚠️ 部分 | 单测 52/52 ✅；**E2E 未做** |
| F18 | CI/CD | P6 | ✅ 完成 | 质量门禁 + release APK 自动发布 |
| F19 | 数据备份与同步 | P6 | ❌ 未启动 | — |
| F20 | 离线队列 | P6 | ❌ 未启动 | — |

**已完成 9.5/20，部分完成 3，未启动 7.5。**

## 三、原生层已打通的能力（Phase 3.5 成果）

| 能力 | 状态 | 说明 |
|------|------|------|
| Room 数据层 | ✅ | InboxEntry/Flashcard/LogEntry/StatsEvent + DAO + AppDatabase |
| Inbox 原生插件 | ✅ | 14 方法全实现（含 order/stats/delete 增强） |
| AnkiDroid 原生插件 | ✅ | AddContentApi 接入：createDeck/ensureModel/getModels/addNote/updateNote/checkDependency + isAvailable/hasPermission/requestPermission |
| Settings 原生插件 | ✅ | SharedPreferences |
| Log 原生插件 | ✅ | Room 落库 + LogService 单例 + 设置页日志区 |
| ShareReceiver 原生插件 | ✅ | 本轮新增：ACTION_SEND 接收 + shareText 调起分享 |
| Web 降级 | ✅ | 全部插件 web 实现（localStorage 镜像） |
| 存储权限 | ✅ | 本轮新增：READ/WRITE_EXTERNAL_STORAGE + READ_MEDIA_* |
| 日志导出 | ✅ | 本轮改：写缓存文件 + 系统分享（剪贴板回退） |

## 四、核心差距（Phase 3.6 重点）

### 4.1 牌组（Deck）—— 用户点名的最大缺口
- **现状**：`deckName` 是自由文本输入（EntryDetail / ManualCreate 各一个 IonInput），入库时原生 `ensureDeck` 找不到就自动新建。
- **问题**：
  1. 不读 AnkiDroid 真实牌组列表 → 用户不知道有哪些牌组可选，容易打错名字产生一堆碎片牌组。
  2. 无"选择已有牌组 / 新建牌组"的 UI 与确认。
  3. `getDeckList()` 原生已可用，但**未暴露为 @PluginMethod**（只在 ensureDeck 内部用）。
- **修复方向**（Phase 3.6）：
  - 原生：新增 `getDecks()` 返回 `[{id, name}]`（含层级）；新增 `createDeck` 已存在但补返回 `{id}`。
  - 前端：新建 `src/lib/anki/deckSelection.ts`（仿 modelSelection，持久化所选牌组名）；EntryDetail/ManualCreate 的牌组输入改为"选择器 + 可新建"。
  - 入库：addNote 前用所选牌组名，原生 ensureDeck 幂等建/取。

### 4.2 模板（模型）—— 已修一半，需与牌组联动
- 本轮已把模板选择页/手动建卡页改为读 `getModels()` 真实模型，并把所选模型持久化（modelSelection.ts）用于入库。
- **遗留**：模板选择页与牌组选择应同屏联动（选完模板再选牌组），当前牌组还是自由文本；模板的字段映射 `mapFieldsToModel` 需真机验证。

### 4.3 编辑同步 AnkiDroid —— 计划书 F2 验收未达标
- **现状**：CardEditorScreen 保存只调 `Inbox.updateCardContent`（本地），文案也明说"重新加入 AnkiDroid 以同步远端笔记"。
- **问题**：编辑后 AnkiDroid 里是旧内容，与计划书"编辑后 AnkiDroid 卡片同步更新"不符。
- **修复方向**：卡片 `noteId` 存在时，保存后调 `AnkiDroid.updateNote({noteId, note})` 同步远端；失败置 status=error 并在 UI 提示。

### 4.4 统计采集为零 —— Phase 4 前置
- **现状**：`StatsEvent` Room 表 + `Inbox.getStats` + 原生 `getStats` 都有，但**没有 insert 任何事件**。
- **修复方向**（Phase 3.6 顺手埋点）：`Inbox.saveCards` 时写 `card_generated`；`AnkiDroid.addNote` 成功后写 `card_added`；`ShareReceiver` 接收时写 `source_shared`；`getStats` 查询供未来仪表盘。

### 4.5 快捷操作（F10）通知栏入口未做
- 长按菜单已做；通知栏快捷"添加文本到 inbox"未做（需原生 Notification 快捷 + 接收文本）。

### 4.6 测试与工程质量
- 单测 52/52 全绿；**E2E 未做**（计划书 F17）；原生 Java 无单测（依赖 GitHub Actions 编译冒烟）。
- 建议：Phase 3.6 至少补 webFallbacks/modelSelection/resolveModel 单测 + 前端关键流程单测。

## 五、其他待排查隐患

1. **模版字段映射 `mapFieldsToModel`**：自定义模型字段名启发式映射需真机验证（用户 AnkiDroid 真实模型未必叫 Front/Back）。
2. **批量入库的模型名**：InboxScreen 批量入库走 buildAddTask？需确认批量路径也读 `getSelectedAnkiModel()`。
3. **日志导出写缓存文件**：缓存目录在系统清理时可能丢失，导出即分享可接受，但要确认 Share.files 的 file:// URI 在 FileProvider 下可达（file_paths.xml 已有 cache-path）。
4. **ShareReceiverPlugin 冷启动**：`getBridge()` 在 onCreate 中可能为 null（插件注册后 bridge 是否就绪），需真机验证；必要时改从 `handleOnCreate` 钩子消费。
5. **图片/YouTube/EPUB 输入源**（F12-14）依赖多模态与外部 API，排期靠后，不影响 Phase 3.6。
6. **Web 降级一致性**：新增 getModels/getDecks 后，web 实现需同步（getDecks 返回内置默认或空）。

## 六、Phase 3.6 迭代规划（原生能力补齐）

> 目标：让"前端 ↔ AnkiDroid"在模板/牌组/编辑/统计四个维度全部走真实 API 读写，消除自由文本与写死模型。

### 6.1 范围（建议顺序）
| 序号 | 任务 | 验收 |
|------|------|------|
| 3.6-1 | 原生 `getDecks()` + 前端 `deckSelection.ts` + 两页牌组选择器（可选已有/新建） | 牌组选择读 AnkiDroid 真实列表，可新建同步 |
| 3.6-2 | 模板选择页与牌组选择联动（选模型→选牌组→入库） | 入库用所选真实模型+牌组 |
| 3.6-3 | CardEditor 保存后同步 AnkiDroid（noteId 存在时 updateNote） | 编辑后 AnkiDroid 内容更新 |
| 3.6-4 | StatsEvent 采集埋点（生成/入库/分享） | getStats 有数据返回 |
| 3.6-5 | 补单测：deckSelection/modelSelection/resolveModel/webFallbacks 扩展 | 单测全绿 |
| 3.6-6 | 真机冒烟回归（含冷启动分享、批量入库模型） | 冒烟清单全过 |

### 6.2 不做（边界收敛）
- F12-F16 输入源扩展（Phase 5 专属）、F11 仪表盘 UI（Phase 4）、F19/F20（Phase 6）不在 Phase 3.6 做，只埋统计点。

### 6.3 风险与护栏
- 牌组/模型操作全部走幂等（先查后建），不引入破坏性行为。
- 前端接口改动同步更新 web 降级，保持 Web 开发环境可用。
- 每个子任务小步提交 + 本地 typecheck/lint/test 全绿 + push tag 触发原生编译验证。

## 七、结论

MasterAnki 主体架构与多数功能已达标，**当前瓶颈不在"能不能写入"，而在"写入时是否用的是 AnkiDroid 真实资源（模板/牌组）"以及"编辑/统计是否回写 AnkiDroid"**。Phase 3.6 用 6 个小任务补齐这四个维度的真实 API 读写闭环，即可为 Phase 4（统计仪表盘）与后续输入源扩展打稳地基。
