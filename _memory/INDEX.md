# MasterAnki 项目状态索引（上下文压缩恢复入口）

> **恢复方法**：读本文件即可秒级恢复关键指针；需要细节时按「文档指针」跳转对应 docs/*.md。
> 最近更新：2026-08-31（Phase 3.5 完成，3 个真机 BUG 待修）

## 一、项目定位
MasterAnki = 从零搭建的 Anki 闪卡生成 Android 应用（Capacitor 8 + React 19 + Ionic 8 + Room）。
四类插件机制（LLMProvider / InputSource / CardTemplate / AnkiBackend），功能思路迁移自 MasterFlasher（不复制代码，规避 CC BY-NC 4.0）。

## 二、关键路径指针
| 内容 | 路径 |
|------|------|
| 项目根目录 | `/home/lingxi/workspace/MasterAnki` |
| 原生层打通决策护栏（必读） | `docs/phase35-native-deepthink.md` |
| 原生层踩坑记录（Room/API/CI） | `docs/phase35-pitfalls.md` |
| AnkiDroid 官方 API 文档 | `docs/ankidroid-api.md` |
| 阶段复盘（P0/P2/P3） | `docs/phase{0,2,3}-review.md` |
| 方案文件（计划书 v2，勿改） | `/home/lingxi/workspace/.lingxi/plans/masteranki重构赋能计划书.md` |
| 四类插件统一类型 | `src/lib/plugins/types.ts` |
| LLM 服务单例 | `src/lib/llm/service.ts` |
| AnkiDroid 后端 + 模型映射 | `src/lib/anki/ankidroid.ts` + `src/plugins/AnkiDroid.ts` |
| 日志服务单例 | `src/lib/log/logger.ts` + `src/plugins/Log.ts` |
| 原生插件（Room/API/日志） | `android/.../plugins/{Inbox,AnkiDroid,Settings,Log}Plugin.java` |
| Node22（持久） | `/home/lingxi/workspace/_tools/node-v22.12.0-linux-x64` |
| SSH 密钥（持久，/root 会被重置） | `/home/lingxi/workspace/_tools/ssh/id_ed25519` |

## 三、构建与校验状态（2026-08-31）
| 检查 | 结果 |
|------|------|
| `npm run typecheck` | ✅ 通过 |
| `npm run lint` | ✅ 0 error |
| `npm run test` | ✅ 52/52（validateJson 8 + providers 11 + dedup 10 + batch 5 + export 7 + i18n 4 + webFallbacks 7） |
| 原生 gradle 编译 | ✅ GitHub Actions 验证通过（v0.2.3 APK，debug 签名，6.2MB） |
| 依赖 | ✅ node_modules 完整（npmmirror 镜像） |

## 四、三根源性问题治理
| 根源问题 | 落地机制 | 状态 |
|---------|---------|------|
| 环境假设耦合业务逻辑 | ConfigSource 统一收敛 + 插件 capabilities | ✅ |
| 自动化缺把关 | CI 质量门禁 + release 冒烟验证 + 显式生命周期 | ✅ |
| 状态依赖不可靠 | 显式生命周期 + 离线队列持久化设计 | ✅ |

## 五、阶段进度
- [x] Phase 0 Web 骨架 / 1 多 Provider / 2 数据管理 / 3 UI-UX（详见 docs/phase*-review.md）
- [x] Phase 3.5 原生层打通：Room 数据层 + 4 原生插件 + Web 降级 + 日志系统 + 内置模型映射（native-1~9 全部完成）
- [ ] **真机冒烟 3 BUG 修复（下一动作）**：
  - a. 模板读取：模板选择页显示内置模型名（Basic/Cloze/IO）而非通过 API 读取用户 AnkiDroid 实际模板 → 需 `getModelList()` 返回真实模型供前端展示
  - b. 存储权限：AndroidManifest 缺读写存储权限 → 导出日志（写文件）受限
  - c. 系统分享：系统分享面板找不到 App 图标 → MainActivity 缺 `ACTION_SEND` intent-filter（text/plain）
- [ ] Phase 4 学习统计仪表盘（stats_events 已预埋：`android/.../db/StatsEvent.java`）

## 六、关键约定 / 教训
- **模型策略**：MODEL_KEYS 用 AnkiDroid 内置模型名（basic→Basic / cloze→Cloze / image_occlusion→Image Occlusion）；原生 resolveModelName 映射 + 幂等建模型。
- **Capacitor 8 API**：PluginCall 无 has/isNull（用 getData().has）；JSArray 用 getJSONObject(i)；详见 docs/phase35-pitfalls.md。
- **推送**：main 含 workflow 文件，push 用 SSH（PAT 无 workflow scope）；deploy key 在 GitHub 已注册。
- **环境重置**：/root、/tmp 会重置，SSH 密钥/Node22 放 `_tools/`；重置后 `apt-get install openssh-client` + 重建 `~/.ssh`。
- **CI 触发**：push main → 质量门禁；push tag v* → 构建并发布 APK。
