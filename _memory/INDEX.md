# MasterAnki 项目状态索引（上下文压缩恢复入口）

> 目的：上下文被压缩后，读本文件即可秒级恢复全部关键指针。
> 最近更新：2026-08-31

## 一、项目定位（一句话）

MasterAnki = 从零搭建的 Anki 闪卡生成 Android 应用（Capacitor + React + Ionic + Room），
四类插件机制架构（LLMProvider / InputSource / CardTemplate / AnkiBackend），
功能思路迁移自 MasterFlasher（不复制代码，规避 CC BY-NC 4.0）。

## 二、关键路径指针

| 内容 | 路径 |
|------|------|
| 项目根目录 | `/home/lingxi/workspace/MasterAnki` |
| 完整复检报告（问题/更改/校验/架构） | `docs/phase0-review.md` |
| 方案文件（计划书 v2，勿改） | `/home/lingxi/workspace/.lingxi/plans/masteranki重构赋能计划书.md` |
| 用户原始计划书（完整版） | `/home/lingxi/workspace/MasterAnki-重构赋能计划书.md` |
| 四类插件统一类型 | `src/lib/plugins/types.ts` |
| 插件注册表（懒加载） | `src/lib/plugins/registry.ts` |
| LLM 抽象接口 | `src/lib/llm/provider.ts` |
| 三步生成管线 | `src/lib/llm/pipeline.ts` |
| 数据模型（全类型） | `src/lib/anki/types.ts` |
| AnkiDroid 后端 | `src/lib/anki/ankidroid.ts` + `src/plugins/AnkiDroid.ts` |
| 统一配置源（环境解耦） | `src/lib/config/configSource.ts` |
| 多 Provider 安全存储 | `src/lib/settings/secureStorage.ts` |
| 去重逻辑 | `src/lib/anki/dedup.ts` |
| 显式生命周期 | `src/lib/anki/lifecycle.ts` |

## 三、构建与校验状态（2026-08-31，Phase 1 完成）

| 检查 | 结果 |
|------|------|
| `npm run typecheck` | ✅ 通过 |
| `npm run build` | ✅ 通过（1 个 chunk>500kB 提示，非错误） |
| `npm run lint` | ✅ 0 error / 8 warning（已把 React Compiler 新规则降为 warn） |
| `npm run test` | ✅ 41/41 通过（validateJson 8 + providers 11 + dedupService 10 + batch 5 + export 7） |
| 依赖安装 | ✅ node_modules 完整；曾因 sharp 超时移除 `@capacitor/assets` |

## 四、Phase 0 进度

- [x] 0.1 项目骨架（Capacitor+React+Ionic+Vite+TS，appId com.masteranki.app）
- [x] 0.2 插件体系基建（types/registry/context）+ ConfigSource
- [x] 0.3 数据层模型 + Inbox 插件接口 + 显式生命周期（Room 原生层待 Android 环境）
- [x] 0.4 三步生成管线 + GeminiProvider
- [x] 0.5 AnkiBackend 接口 + AnkiDroidBackend（原生插件待 Android 环境）
- [x] 0.6 设置页 Provider 选择器 + 多 Key 存储 + prompt 配置
- [~] 0.7 测试骨架（validateJson 测试通过；更多测试待 Phase 1+）+ CI 门禁（ci.yml/release.yml 已建）
- [x] 0.8 MIT LICENSE + README
- [ ] 原生 Android 层（Room DB、Capacitor 插件 Java）—— 需 Android SDK 环境
- [ ] git init + 首次提交

## 五、三根源性问题治理现状（自查结论）

| 根源问题 | 落地机制 | 状态 |
|---------|---------|------|
| 环境假设耦合业务逻辑 | ConfigSource 统一收敛 + 插件 capabilities 能力声明 | ✅ 已落地 |
| 自动化缺把关 | CI 质量门禁 + release 冒烟验证 + 显式生命周期（不做隐式自动删除） | ✅ 已落地（原生层待补） |
| 状态依赖不可靠 | 显式生命周期替代隐式判断 + 离线队列持久化设计（Phase 6） | ✅ Web 层已落地 |

## 六、Phase 1 完成（2026-08-31）

已实现多 Provider 插件化：
- OpenAI 兼容基类（openaiCompatible.ts）+ OpenAI/通义/DeepSeek/Kimi 四家复用
- ClaudeProvider（tool_use 结构化输出，独立实现，已修 tool_use 块提取 bug）
- OllamaProvider（本地、无 Key、offline）
- providers/index.ts 统一注册 + PROVIDER_META 元数据
- LLMService 单例（init/注册/活跃 Provider 动态选择/管线构建），App.tsx 启动时初始化
- EntryDetailScreen 改用 LLMService 活跃 Provider；入库按卡片类型映射 Anki 模型
- IO 插件检测（ioDependency.ts）：未安装则 UI 禁用 Image Occlusion 模板
- 测试 19/19 通过

## 六.5、Phase 2 完成（2026-08-31）

数据管理已落地（详见 docs/phase2-review.md）：
- 增量去重：dedupService.ts（哈希级/文本级查重 + 变更摘要 buildChangeSummary）；EntryDetailScreen 生成流程先查重→摘要→ConfirmGate 确认→落库
- 人工确认门：components/ConfirmGate.tsx（批量/删除/增量更新均先确认，无静默操作）
- 批量操作：lib/anki/batch.ts 串行执行器 + 失败清单；InboxScreen 选择模式（全选/JSON/CSV 导出/批量删除）；EntryDetailScreen 卡片全选/全部入库/删除所选
- 批量导出：lib/anki/export.ts（JSON/CSV 序列化 + 下载）
- 拖拽排序：IonReorderGroup + updateCardOrder 持久化 sortOrder
- 测试 41/41 全绿（新增 dedupService 10 + batch 5 + export 7）；typecheck/lint(0err)/build 通过
- 测试期踩坑：jsdom 缺 crypto.subtle 致 sha256 卡死 → setup.ts 注入 Node webcrypto（须用 ESM import 非 require）

## 六.6、Phase 3 完成（2026-08-31）

UI/UX 体验提升已落地（详见 docs/phase3-review.md）：
- 深色模式：ThemeContext（浅/深/跟随系统 + 持久化 masteranki:theme）；改用 dark.class.css 类驱动 + color-scheme 同步；设置页外观区
- Markdown 渲染：MarkdownRenderer（remark-gfm 表格 + KaTeX 公式 + rehype-highlight 代码高亮）；EntryDetail 卡片列表 + CardEditor 实时预览接入
- 多语言：i18next + en/zh/ja 三语言包（10 命名空间）；6 页面 + ConfirmGate 全文案 t() 化；设置页语言切换 + 持久化（masteranki:language）
- 快捷操作：Inbox 长按/右键 ActionSheet（重新生成/删除/分享）；ShareReceiver 新增 shareText 接口
- 上下文单例：getDefaultContext() 统一存储（Theme/i18n/LLMService 共享）
- 测试 45/45 全绿（新增 i18n 一致性 4：三语言键一致 + 页面 t() 键全覆盖扫描）

## 六.7、Phase 3.5 进行中（2026-08-31，原生层打通）

根因：android 原生层是空壳（MainActivity 无插件注册），前端 registerPlugin 接口无原生实现 → "not implemented on Android"。
决策护栏（必读）：docs/phase35-native-deepthink.md
已确认决策：① Inbox=原生 Room + Web 降级 ② 模板=AnkiDroid 内置模型（Basic/Cloze）③ 新增日志系统。
契约（前端为契约方）：Inbox 14 方法 / AnkiDroid 5+3 / Settings 3，以 src/plugins/*.ts 为准。
已完成：
- native-1 依赖与清单：jitpack/Room/AnkiDroid API + READ_WRITE_DATABASE 权限 + queries 声明
- native-2 Room 数据层：InboxEntry/Flashcard/LogEntry/StatsEvent 实体 + InboxDao/LogDao/StatsDao + AppDatabase（fallbackToDestructiveMigration）
- native-3 InboxPlugin.java（Room 实现前端全部 14 接口，含原项目缺的 updateCardOrder/getStats/deleteCards/deleteEntries）
- native-4 AnkiDroidPlugin.java（AddContentApi 接入；已确认 api-v1.1.0 提供 updateNoteFields/updateNoteTags/getFieldList；内置模型映射 Basic/Cloze/Image Occlusion + 幂等建 deck/model + 权限）
- native-5 SettingsPlugin.java（SharedPreferences）+ MainActivity 注册三插件
- native-6 前端 Web 降级：src/plugins/web/{inboxWeb,ankidroidWeb,settingsWeb}.ts 已挂接 registerPlugin
- native-7 模型策略：MODELS/MODEL_KEYS 改为 AnkiDroid 内置模型名（Basic/Cloze/Image Occlusion）
- native-8 日志系统：原生 LogPlugin.java（Room 落库 append/getRecent/clear）+ MainActivity 注册 + 前端 src/plugins/Log.ts + web/logWeb.ts + src/lib/log/logger.ts（LogService 单例，捕获 window error/unhandledrejection + 拦截 console info/warn/error + 显式写日志 + exportText 导出）+ SettingsScreen 日志区（查看/导出复制剪贴板/清空）+ 三语翻译键 + 单测 webFallbacks.test.ts（7 项：Log Web 降级 / AnkiDroid Web 降级 / MODEL_KEYS 映射）
- native-9 验证：本地 typecheck/lint/test 全绿；原生编译经 GitHub Actions release 验证通过（v0.2.3 APK 构建成功）。

## 六.8、Phase 3.5 原生编译踩坑（GitHub Actions 已全通）

| 错误 | 根因 | 修复 |
|------|------|------|
| compileDebugJavaWithJavac 崩溃（Metadata 2.1.0 > 2.0.0） | Room 2.6.1 annotationProcessor 内嵌 kotlinx-metadata-jvm 仅支持到 2.0.0，Capacitor 8 插件由 Kotlin 2.1 编译（metadata 2.1.0） | Room 升级 2.6.1→2.8.4 |
| 主键字段需 @NonNull | Room 2.8 要求 String 主键显式 @NonNull（SQLite 视 nullable 主键为 bug） | InboxEntry/Flashcard 的 id 加 @NonNull |
| PluginCall 无 has()/isNull() | Capacitor 8 的 PluginCall 无这两个方法（hasOption 已废弃） | 改用 call.getData().has()/.isNull() |
| JSArray 无 getJSObject(int) | JSArray extends JSONArray，无 getJSObject | 改用 getJSONObject(i)（返回 JSONObject） |
| toTagSet 类型不匹配 | note.getJSONArray 返回 org.json.JSONArray，入参却是 JSArray | 入参改 JSONArray |

真机冒烟清单（待用户执行）：①收件箱读写 ②保存卡片不再报 not implemented ③模板显示内置模型名（Basic/Cloze/Image Occlusion）④入库 Anki 成功（需 AnkiDroid 已授权插件 API）⑤设置页日志可查看/导出/清空。
验证限制：本地无 Android SDK，原生编译只能走 GitHub Actions release（push tag）或真机；本地至少 typecheck/lint/test 全绿。

## 七、下一阶段（Phase 4）入口

学习统计仪表盘（源自需求 F11，方案 v2）：
- stats_events 采集（类型/来源/数量/时间）接入 Inbox.saveCards / 入库 / 分享路径
- 统计页：总卡片数、按来源分布、按 Provider 分布、近 N 天趋势
- 只读展示层（不改数据）；图表可选轻量自绘（少依赖防安装慢）

## 七、依赖安装教训（已沉淀记忆）

npmmirror 镜像 + 遇 sharp 类二进制下载超时 → 移除非必需引入依赖（@capacitor/assets）。
详见记忆 wiki/lessons。
