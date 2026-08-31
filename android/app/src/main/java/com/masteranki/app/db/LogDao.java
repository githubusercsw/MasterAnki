package com.masteranki.app.db;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.Query;

import java.util.List;

/** 运行日志数据访问接口。 */
@Dao
public interface LogDao {

    @Insert
    void insert(LogEntry entry);

    /** 按时间倒序取最近 N 条 */
    @Query("SELECT * FROM logs ORDER BY createdAt DESC LIMIT :limit")
    List<LogEntry> getRecent(int limit);

    @Query("DELETE FROM logs")
    void clear();
}
