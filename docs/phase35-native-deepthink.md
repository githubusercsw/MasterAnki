# MasterAnki 原生层打通 · 深度思索与决策护栏（Phase 3.5）

> 目的：牵一发而动全身的改动前，把根源性风险、连锁反应、边界收敛显式固化，避免实施中偏离。
> 状态：已核实 / 已决策。写于 2026-08-31。

## 一、根源性问题预防（三根源治理）

### 1. 环境假设与业务逻辑耦合
- **单一事实来源**：前端 `src/lib/anki/types.ts` 是数据结构的唯一权威（InboxEntry/Flashcard/StatsEvent）。Web 降级实现与原生 Room 实体字段**必须**与之一致，禁止各自漂移。
- **存储链路不迁移**：现有 `context.ts` 的 `getDefaultContext()` 在原生 WebView 下也走 `window.localStorage`（WebView 持久化真实可用）。本轮**不动** context/App/LLMService 的存储链路，避免连锁；Settings 原生插件仅作基础实现与未来扩展，不强切前端。
- **模型策略**：basic→AnkiDroid 内置 Basic、cloze→内置 Cloze；image_occlusion 依赖 IO Enhanced，保留 `checkDependency` 门禁。

### 2. 自动化缺把关（原生代码不可被 vitest 覆盖）
- 前端 Web 降级实现**可单测**（补 `webInbox.test.ts` 等），用测试守护 Web 层与类型契约。
- 原生 Java 正确性依赖：① 接口与前端 `src/plugins/*.ts` 逐一对齐 ② CI/release 的 gradle 编译 ③ 真机冒烟 ④ 日志系统落库可查。
- 说明：本地沙箱无 Android SDK，原生编译验证只能走 GitHub Actions（push tag → release）或用户真机。提交前本地至少保证 `typecheck/lint/test` 全绿。

### 3. 状态依赖不可靠
- **事务**：`saveCards` 等批量写用 Room `@Transaction` 保证原子性。
- **幂等**：建 deck / ensureModel 先查后建（`getDeckList`/`getModelList` 匹配）。
- **noteId 状态机**：`status=pending→added/error`，与前端一致。

## 二、连锁反应清单（已逐一核实）

### 契约对齐（前端为契约方）
| 插件 | 前端方法 | 原生实现要求 |
|------|---------|-------------|
| Inbox | 14 方法：getAllEntries/getEntry/saveEntry/deleteEntry/saveCards/updateCardContent/updateCardStatus/updateCardOrder/updateExtractedContent/updateDeckName/lockEntry/deleteCards/deleteEntries/getStats | 全部实现；**原项目缺 4 个**（updateCardOrder/getStats/deleteCards/deleteEntries），必须补齐 |
| AnkiDroid | createDeck/ensureModel/addNote/updateNote/checkDependency | 全实现；`isAvailable/hasPermission/requestPermission` 一并提供（原项目有，前端按需扩展） |
| Settings | getSetting/setSetting/deleteSetting | 基础实现（SharedPreferences） |

### 已核实的非风险点
- 现有测试均为纯函数（batch/dedup/export），**不依赖插件 mock**，加 Web 实现不破坏现有测试。
- 第三方插件（@capacitor-community/speech-recognition、capacitor-secure-storage-plugin）自带原生实现，`cap sync` 已并入，不受影响。
- `release.yml` 用 gradle 自动拉依赖，Room/AnkiDroid API 经 jitpack 可达（已加仓库声明）。

### 待验证开放项
- `AddContentApi` 的 `updateNote` 在 api-v1.1.0 是否可用：不可用则 `canUpdateNote=false`（前端已有关卡），降级为先删后建。
- AnkiDroid 内置模型名（Basic/Cloze）以运行时 `getModelList()` 为准，写兜底（匹配不上则 `addNewBasicModel`）。

## 三、边界收敛（避免偏离）
1. 只做方案内事项：Room + Inbox + AnkiDroid + Settings + Web 降级 + 模型映射 + 日志。
2. **不改**：context.ts 存储链路、App.tsx 启动、LLMService、现有纯函数逻辑、i18n/主题。
3. Room schema v1 含 4 表（inbox_entries/flashcards/logs/stats_events），stats 为 Phase 4 预埋；迁移策略 `fallbackToDestructiveMigration`（初测阶段可接受，注释说明，正式发布前加 migration）。
4. 日志系统：原生 LogDao 落 Room + 前端 LogService（捕获 console/异常/插件失败）+ 设置页查看/导出。

## 四、验证顺序（把关）
1. 本地：`npm run typecheck / lint / test`（含新增 Web 降级单测）。
2. 原生：`./gradlew assembleDebug` 无法本地跑 → 走 GitHub Actions release（push tag）。
3. 真机冒烟：收件箱读写 / 保存卡片不再报 not implemented / 模板显示内置模型名 / 入库成功 / 日志可查。

## 五、更新历史
- 2026-08-31：初始建立（Inbox 14 方法、AnkiDroid 5+3 方法、Settings 3 方法契约已锁定）。
