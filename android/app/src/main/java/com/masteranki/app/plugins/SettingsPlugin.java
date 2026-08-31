package com.masteranki.app.plugins;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Settings Capacitor 插件（SharedPreferences 实现）。
 *
 * 非敏感设置的键值存储（自定义提示词等）。
 * 敏感配置（API Key）走 capacitor-secure-storage-plugin，不在此插件。
 * 实现前端 src/plugins/Settings.ts 的接口。
 */
@CapacitorPlugin(name = "Settings")
public class SettingsPlugin extends Plugin {

    private static final String PREFS_NAME = "masteranki_settings";

    private SharedPreferences prefs() {
        Context ctx = getContext();
        return ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void getSetting(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("Missing required parameter: key");
            return;
        }
        String value = prefs().getString(key, null);
        JSObject ret = new JSObject();
        ret.put("value", value != null ? value : org.json.JSONObject.NULL);
        call.resolve(ret);
    }

    @PluginMethod
    public void setSetting(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null || value == null) {
            call.reject("Missing required parameters: key, value");
            return;
        }
        prefs().edit().putString(key, value).apply();
        call.resolve();
    }

    @PluginMethod
    public void deleteSetting(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("Missing required parameter: key");
            return;
        }
        prefs().edit().remove(key).apply();
        call.resolve();
    }
}
