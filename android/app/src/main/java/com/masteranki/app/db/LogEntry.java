package com.masteranki.app.db;

import androidx.room.Entity;
import androidx.room.Index;
import androidx.room.PrimaryKey;

/** 运行日志条目（错误/警告/信息），供设置页查看与导出。 */
@Entity(
    tableName = "logs",
    indices = {@Index(value = {"createdAt"})}
)
public class LogEntry {
    @PrimaryKey(autoGenerate = true)
    public long id;

    /** debug | info | warn | error */
    public String level;

    /** 来源标签，如 Inbox / AnkiDroid / LLM / Settings */
    public String tag;

    public String message;

    /** 堆栈（错误时） */
    public String stack;

    public long createdAt;

    public LogEntry() {}

    public LogEntry(String level, String tag, String message, String stack, long createdAt) {
        this.level = level;
        this.tag = tag;
        this.message = message;
        this.stack = stack;
        this.createdAt = createdAt;
    }
}
