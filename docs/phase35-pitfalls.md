# Phase 3.5 踩坑记录（原生层打通 + CI）

> 2026-08-31。记录原生层打通与 GitHub Actions 构建过程中踩到的坑与修复，供后续 Phase 复用。
> 同主题已沉淀至记忆系统 wiki/lessons/Capacitor原生层编译与API适配。

## 一、原生编译类（compileDebugJavaWithJavac）

### 1. Room 2.6.1 annotationProcessor 崩溃（kotlinx-metadata 不兼容）
- **现象**：`:app:compileDebugJavaWithJavac FAILED`
  `java.lang.IllegalArgumentException: Provided Metadata instance has version 2.1.0, while maximum supported version is 2.0.0`
- **根因**：Capacitor 8 插件（如 speech-recognition/filesystem）由 Kotlin 2.1 编译，class 元数据版本 2.1.0；Room 2.6.1 的 annotationProcessor 内嵌 kotlinx-metadata-jvm 仅支持到 2.0.0，读取依赖元数据时崩溃。
- **修复**：Room 升级 `2.6.1 → 2.8.4`（Google Maven 稳定版，见 dl.google.com maven-metadata.xml）。
- **启示**：Room 低版本与新 Kotlin 编译的依赖共存时会炸；原生依赖升级优先查 Google Maven 官方版本列表。

### 2. Room 2.8 要求 String 主键显式 @NonNull
- **现象**：`error: You must annotate primary keys with @NonNull. "id" is nullable.`
- **根因**：SQLite 视 nullable 主键为 bug，Room 2.8 编译期强制检查（2.6 不查）。
- **修复**：`InboxEntry.java` / `Flashcard.java` 的 `@PrimaryKey public String id` 上加 `@NonNull`（`androidx.annotation.NonNull`）。
- **启示**：实体主键是 String 时直接养成加 @NonNull 的习惯；long 原始类型主键不受影响。

### 3. Capacitor 8 的 PluginCall API 变更（has/isNull 移除）
- **现象**：`cannot find symbol: method has(String)` / `isNull(String)`（在 PluginCall 上）
- **根因**：Capacitor 8 的 `PluginCall` 不再暴露 `has()` / `isNull()`（`hasOption` 已废弃）。
- **修复**：统一改为 `call.getData().has("x")` / `call.getData().isNull("x")`（getData() 返回 JSObject，JSObject 继承 JSONObject，有 has/isNull）。
- **启示**：跨大版本升级依赖时，先读 `node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/PluginCall.java` 确认方法集，别凭旧版记忆写。

### 4. JSArray 无 getJSObject(int) 方法
- **现象**：`cannot find symbol: method getJSObject(int)`
- **根因**：`JSArray extends JSONArray`，只继承 `getJSONObject(int)`；`getJSObject` 只在 JSObject（按 key）上存在。
- **修复**：遍历 JSArray 取元素用 `arr.getJSONObject(i)`（返回 org.json.JSONObject）。
- **启示**：JSArray/JSObject 是 org.json 的薄包装，读元素/字段用 JSONObject/JSONArray 原生方法即可。

### 5. toTagSet 入参类型不匹配
- **现象**：`incompatible types: JSONArray cannot be converted to JSArray`
- **根因**：`note.getJSONArray("tags")` 返回 `org.json.JSONArray`，但自定义 `toTagSet(JSArray arr)` 期望 JSArray。
- **修复**：`toTagSet(JSONArray arr)`，内部用 `arr.getString(i)`。
- **启示**：Capacitor `JSObject.getJSONArray(key)` 返回原生 JSONArray，自定义解析函数按 JSONArray 写即可。

## 二、GitHub Actions / 仓库类

### 6. PAT 无 workflow scope 推送失败（SSH deploy key 绕过）
- 见记忆 wiki/lessons/workflow-scope与CI推送。SSH 推送不受 PAT scope 检查，密钥放工作区 `_tools/ssh/` 持久保存（/root 会被重置）。
- 环境重置后 `ssh` 可能丢失 → 重新 `apt-get install -y openssh-client`，`~/.ssh` 重建并从工作区复制密钥。

### 7. Create GitHub Release 403（GITHUB_TOKEN 默认只读）
- 根因：默认 `GITHUB_TOKEN` 权限 read，release 上传 403。
- 修复：GitHub API `PUT /repos/{owner}/{repo}/actions/permissions/workflow` 设 `default_workflow_permissions: write`。
- 后续 release.yml 已改用 `softprops/action-gh-release` 简化。

### 8. npm run format:check 假绿
- 根因：npm script 静默失败（无输出退出 0）。直接 `node ./node_modules/prettier/bin/prettier.cjs --check` 复现 24 文件问题。
- 修复：prettier 用 node 直调，不要依赖 npm run。

### 9. gradlew Permission denied
- 根因：gradlew 以 100644 提交到 git。
- 修复：`git update-index --chmod=+x android/gradlew`。

## 三、真机冒烟发现（待修复，见 INDEX.md 六.9）

- **a. 模板读取**：模板选择页显示内置模型名（Basic/Cloze/Image Occlusion）而非通过 API 读取用户 AnkiDroid 实际模板 → 需 `getModelList()` 返回真实模型供前端展示。
- **b. 存储权限**：AndroidManifest 缺读写存储权限，导出日志（写文件）受限 → 需加 READ/WRITE_EXTERNAL_STORAGE 声明。
- **c. 系统分享**：系统分享面板找不到 App 图标 → MainActivity 缺 `ACTION_SEND` intent-filter（text/plain），且分享接收未走原生。
