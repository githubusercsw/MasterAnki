package com.masteranki.app.db;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.Query;

import java.util.List;

/** 学习统计数据访问接口（Phase 4 预埋）。 */
@Dao
public interface StatsDao {

    @Insert
    void insert(StatsEvent event);

    @Query("SELECT * FROM stats_events WHERE createdAt >= :from AND createdAt <= :to ORDER BY createdAt ASC")
    List<StatsEvent> getRange(long from, long to);

    @Query("SELECT type, COUNT(*) as cnt, SUM(count) as total FROM stats_events GROUP BY type")
    List<StatsGroupRow> groupByType();

    @Query("SELECT sourceType, COUNT(*) as cnt, SUM(count) as total FROM stats_events WHERE sourceType IS NOT NULL GROUP BY sourceType")
    List<StatsGroupRow> groupBySourceType();

    /** 聚合结果行（type 或 sourceType + 计数） */
    class StatsGroupRow {
        public String type;
        public int cnt;
        public long total;
    }
}
