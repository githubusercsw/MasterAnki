# MasterAnki 项目状态索引（上下文压缩恢复入口）

> **恢复方法**：读本文件即可秒级恢复关键指针；需要细节时按「文档指针」跳转对应 docs/*.md。
> 最近更新：2026-08-31（Phase 3.5 完成 + 3 BUG 修复 + 深度差距分析/口头汇报完成 + v0.2.4 验证通过，Phase 3.6 待实施）

## 一、项目定位
MasterAnki = 从零搭建的 Anki 闪卡生成 Android 应用（Capacitor 8 + React 19 + Ionic 8 + Room）。
四类插件机制（LLMProvider / InputSource / CardTemplate / AnkiBackend），功能思路迁移自 MasterFlasher（不复制代码，规避 CC BY-NC 4.0）。

## 二、关键路径指针
| 内容 | 路径 |
|------|------|
| 项目根目录 | `/home/lingxi/workspace/MasterAnki` |
| **Phase 3.6 差距分析与规划（必读）** | `docs/phase36-gap-analysis.md` |
| 原生层打通决策护栏 | `docs/phase35-native-deepthink.md` |
| 原生层踩坑记录（Room/API/CI） | `docs/phase35-pitfalls.md` |
| AnkiDroid 官方 API 文档 | `docs/ankidroid-api.md` |
| 阶段复盘（P0/P2/P3） | `docs/phase{0,2,3}-review.md` |
| 方案文件（计划书 v2，勿改） | `/home/lingxi/workspace/.lingxi/plans/masteranki重构赋能计划书.md` |
| 四类插件统一类型 | `src/lib/plugins/types.ts` |
| LLM 服务单例 | `src/lib/llm/service.ts` |
| AnkiDroid 后端 + 模型映射 | `src/lib/anki/ankidroid.ts` + `src/plugins/AnkiDroid.ts` |
| **模型（模板）选择状态** | `src/lib/anki/modelSelection.ts` + `resolveModel.ts` |
| 日志服务单例 | `src/lib/log/logger.ts` + `src/plugins/Log.ts` |
| 原生插件（5 个） | `android/.../plugins/{Inbox,AnkiDroid,Settings,Log,ShareReceiver}Plugin.java` |
| Node22（持久） | `/home/lingxi/workspace/_tools/node-v22.12.0-linux-x64` |
| SSH 密钥（持久，/root 会被重置） | `/home/lingxi/workspace/_tools/ssh/id_ed25519` |

## 三、构建与校验状态（2026-08-31）
| 检查 | 结果 |
|------|------|
| `npm run typecheck` | ✅ 通过 |
| `npm run lint` | ✅ 0 error |
| `npm run test` | ✅ 52/52（validateJson 8 + providers 11 + dedup 10 + batch 5 + export 7 + i18n 4 + webFallbacks 7） |
| 原生 gradle 编译 | ✅ GitHub Actions 验证通过（v0.2.4 APK，debug 签名，含 getModels/ShareReceiver 新增） |
| 依赖 | ✅ node_modules 完整（npmmirror 镜像） |

## 四、三根源性问题治理
| 根源问题 | 落地机制 | 状态 |
|---------|---------|------|
| 环境假设耦合业务逻辑 | ConfigSource 统一收敛 + 插件 capabilities | ✅ |
| 自动化缺把关 | CI 质量门禁 + release 冒烟验证 + 显式生命周期 | ✅ |
| 状态依赖不可靠 | 显式生命周期 + 离线队列持久化设计 | ✅ |

## 五、阶段进度
- [x] Phase 0 Web 骨架 / 1 多 Provider / 2 数据管理 / 3 UI-UX（详见 docs/phase*-review.md）
- [x] Phase 3.5 原生层打通（native-1~9 完成）：Room 数据层 + 5 原生插件 + Web 降级 + 日志系统 + 模型映射
- [x] 真机冒烟 3 BUG 修复（commit 596ab87，已推送）：
  - a. 模板读取 → `getModels()` 真实模板 + 模板/建卡页读真实模型 + 持久化 + 入库用所选模型
  - b. 存储权限 → Manifest 补 READ/WRITE_EXTERNAL_STORAGE + READ_MEDIA_*；日志导出写缓存文件 + 系统分享
  - c. 系统分享 → MainActivity 加 ACTION_SEND intent-filter + 原生 ShareReceiverPlugin + web 降级
- [x] 深度差距分析 + 口头汇报（2026-08-31，对照计划书 F1-F20 逐项核查，结论：完成 9.5/20，4 大核心差距，见 docs/phase36-gap-analysis.md）
- [ ] **Phase 3.6 原生能力补齐（进行中，已获用户确认规划，见 docs/phase36-gap-analysis.md）**：
  - [x] 3.6-1 牌组 API（commit 032b4dc）：原生 `getDecks()` + `deckSelection.ts` + ManualCreate/EntryDetail 牌组选择器（读真实列表/可新建）
  - [x] 3.6-2 模板↔牌组联动（commit d790d44）：TemplateSelectScreen 同屏选牌组，选模板时一并持久化
  - [x] 3.6-3 编辑同步（commit 0cb4a2f）：`noteBuilder.ts` 公共构建 + CardEditorScreen noteId 存在时 `updateNote` 同步，失败置 error
  - [ ] 3.6-4 StatsEvent 采集埋点（生成/入库/分享）
  - [ ] 3.6-5 补单测（deckSelection/modelSelection/resolveModel）
  - [ ] 3.6-6 真机冒烟回归（含 push tag 触发原生编译验证）
- [ ] Phase 4 学习统计仪表盘（StatsEvent 表已预埋，采集层待 3.6-4 埋点）

## 六、关键约定 / 教训
- **模型策略**：优先用户所选真实模型（`getSelectedAnkiModel()`），未选则回退内置映射（Basic/Cloze/IO）。
- **Capacitor 8 API**：PluginCall 无 has/isNull（用 getData().has）；JSArray 用 getJSONObject(i)；详见 docs/phase35-pitfalls.md。
- **推送**：main 含 workflow 文件，push 用 SSH（PAT 无 workflow scope）；deploy key 在 GitHub 已注册。
- **环境重置**：/root、/tmp 会重置，SSH 密钥/Node22 放 `_tools/`；重置后 `apt-get install openssh-client` + 重建 `~/.ssh`（`_tools/ssh/` 副本仅供备份，文件系统不响应 chmod，勿直接用于连接）。
- **SSH 教训**：若 `.git/config` 残留 `core.sshCommand` 指向易失路径（如 `/tmp/sshkeys/...`），`git config --unset core.sshCommand` 改用 `~/.ssh/config`（IdentityFile=~/.ssh/id_ed25519）。
- **CI 触发**：push main → 质量门禁；push tag v* → 构建并发布 APK。
- **git 锁**：commit 被中断时清 `.git/index.lock` 后重试。
- **vitest 本地环境坑**：此沙箱 vitest 默认 threads 池卡死（无输出挂起）；本地跑测试须 `node node_modules/vitest/dist/cli.js run --pool=forks --poolOptions.forks.singleFork=true --no-file-parallelism`（单 fork 全量 52/52 正常）。CI 用 `npm run test:coverage` 不受影响，勿改项目配置。
