package com.masteranki.app.plugins;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.masteranki.app.db.AppDatabase;
import com.masteranki.app.db.LogDao;
import com.masteranki.app.db.LogEntry;

import java.util.List;

/**
 * Log Capacitor 插件（Room 实现）。
 *
 * 提供运行日志的写入/查询/清空，供前端 LogService 与设置页使用。
 * 对应前端 src/plugins/Log.ts 接口。
 */
@CapacitorPlugin(name = "Log")
public class LogPlugin extends Plugin {

    private LogDao logDao() {
        return AppDatabase.getInstance(getContext()).logDao();
    }

    /** 追加一条日志：{ level, tag, message, stack? } */
    @PluginMethod
    public void append(PluginCall call) {
        String level = call.getString("level");
        String tag = call.getString("tag");
        String message = call.getString("message");
        if (level == null || tag == null || message == null) {
            call.reject("Missing required parameters: level, tag, message");
            return;
        }
        String stack = call.has("stack") && !call.isNull("stack") ? call.getString("stack") : null;
        try {
            logDao().insert(new LogEntry(level, tag, message, stack, System.currentTimeMillis()));
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to append log: " + e.getMessage(), e);
        }
    }

    /** 取最近 N 条日志：{ limit? } → { logs: [...] } */
    @PluginMethod
    public void getRecent(PluginCall call) {
        int limit = call.has("limit") && !call.isNull("limit") ? call.getInt("limit") : 100;
        try {
            List<LogEntry> logs = logDao().getRecent(Math.max(1, limit));
            JSArray arr = new JSArray();
            for (LogEntry l : logs) {
                JSObject o = new JSObject();
                o.put("id", l.id);
                o.put("level", l.level);
                o.put("tag", l.tag);
                o.put("message", l.message);
                o.put("stack", l.stack != null ? l.stack : JSObject.NULL);
                o.put("createdAt", l.createdAt);
                arr.put(o);
            }
            JSObject ret = new JSObject();
            ret.put("logs", arr);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to get logs: " + e.getMessage(), e);
        }
    }

    /** 清空日志 */
    @PluginMethod
    public void clear(PluginCall call) {
        try {
            logDao().clear();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to clear logs: " + e.getMessage(), e);
        }
    }
}
