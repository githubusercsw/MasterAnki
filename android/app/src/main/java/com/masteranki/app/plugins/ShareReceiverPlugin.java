package com.masteranki.app.plugins;

import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.masteranki.app.db.AppDatabase;
import com.masteranki.app.db.StatsEvent;

/**
 * ShareReceiver Capacitor 插件（Android 原生实现）。
 *
 * 处理系统分享：接收其他应用分享的文本/URL（ACTION_SEND），
 * 持久化到 SharedPreferences，供前端 getSharedText / hasPending / clear 读取；
 * shareText 调起系统分享面板（ACTION_SEND）。
 *
 * 对应前端 src/plugins/ShareReceiver.ts 接口。
 * 注意：MainActivity 的 intent-filter 必须声明 ACTION_SEND 才会出现在分享面板。
 */
@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {

    private static final String PREFS = "masteranki_share";
    private static final String KEY_MODE = "pending_mode";
    private static final String KEY_VALUE = "pending_value";
    private static final String KEY_HAS = "pending_has";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
    }

    /** Bridge 分发 onNewIntent（热启动分享进入时自动调用） */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        consumeIntent(intent);
    }

    /** 冷启动分享进入：onCreate 时由 MainActivity 调用；解析分享 intent 并持久化 */
    public void consumeIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action)) return;
        String type = intent.getType();
        if (type == null) return;

        // 优先文件流（PDF/图片等），其次文本/URL
        Uri stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (stream != null) {
            SharedPreferences.Editor e = prefs().edit();
            e.putBoolean(KEY_HAS, true);
            e.putString(KEY_MODE, "file");
            e.putString(KEY_VALUE, stream.toString());
            e.apply();
            recordShared("file");
            return;
        }

        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null || text.isEmpty()) return;
        String mode = "text";
        if (text.startsWith("http://") || text.startsWith("https://")) {
            mode = "url";
        }
        SharedPreferences.Editor e = prefs().edit();
        e.putBoolean(KEY_HAS, true);
        e.putString(KEY_MODE, mode);
        e.putString(KEY_VALUE, text);
        e.apply();
        recordShared(mode);
    }

    /** 统计埋点：source_shared（接收系统分享成功） */
    private void recordShared(String sourceType) {
        try {
            AppDatabase.getInstance(getContext()).statsDao().insert(
                new StatsEvent("source_shared", 1, sourceType, null, System.currentTimeMillis()));
        } catch (Exception ignored) {
            // 统计失败不影响主流程
        }
    }

    // ==================== 前端接口 ====================

    /** 读取最近一次分享的文本/URL */
    @PluginMethod
    public void getSharedText(PluginCall call) {
        SharedPreferences p = prefs();
        JSObject ret = new JSObject();
        if (p.getBoolean(KEY_HAS, false)) {
            ret.put("value", p.getString(KEY_VALUE, null));
            ret.put("mode", p.getString(KEY_MODE, "text"));
        }
        call.resolve(ret);
    }

    /** 读取最近一次分享的文件 Uri */
    @PluginMethod
    public void getSharedFile(PluginCall call) {
        SharedPreferences p = prefs();
        JSObject ret = new JSObject();
        if (p.getBoolean(KEY_HAS, false) && "file".equals(p.getString(KEY_MODE, ""))) {
            JSObject file = new JSObject();
            file.put("path", p.getString(KEY_VALUE, null));
            ret.put("file", file);
        }
        call.resolve(ret);
    }

    /** 清空待处理的分享（入库后调用） */
    @PluginMethod
    public void clear(PluginCall call) {
        prefs().edit().clear().apply();
        call.resolve();
    }

    /** 检测是否有待处理分享 */
    @PluginMethod
    public void hasPending(PluginCall call) {
        JSObject ret = new JSObject();
        SharedPreferences p = prefs();
        ret.put("pending", p.getBoolean(KEY_HAS, false));
        String mode = p.getString(KEY_MODE, "text");
        String ct = "file".equals(mode) ? "file" : ("url".equals(mode) ? "url" : "text");
        ret.put("contentType", ct);
        call.resolve(ret);
    }

    /** 调起系统分享面板（长按菜单"分享"用） */
    @PluginMethod
    public void shareText(PluginCall call) {
        String text = call.getString("text");
        String title = call.getString("title");
        if (text == null) {
            call.reject("Missing required parameter: text");
            return;
        }
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, text);
        if (title != null) {
            send.putExtra(Intent.EXTRA_SUBJECT, title);
        }
        String chooserTitle = title != null ? title : "MasterAnki";
        getActivity().startActivity(Intent.createChooser(send, chooserTitle));
        call.resolve();
    }
}
