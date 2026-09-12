-- 快照同步表（D1 快照同步方案，见 .codebuddy/plans/d1-snapshot-sync-refactor_*.md）
-- 每表只存固定 key 的单行全量 JSON 快照：
--   sync_records.key = 'record_data'  -> {teams:[], matchRecords:[]}
--   sync_stats.key   = 'win_rate'     -> {heroWinRateStats:{}, cardWinRateResults:{}}
-- 前端日常读写全在 localStorage（本地优先），仅管理员手动同步时全量 REPLACE 此处。
-- _worker.js 的 ensureSchema 也会惰性建表；本文件用于显式迁移（wrangler d1 execute）。

CREATE TABLE IF NOT EXISTS sync_records (
    key        TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_stats (
    key        TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
