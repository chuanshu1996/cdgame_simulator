// 快照同步服务（D1 方案，见 .codebuddy/plans/d1-snapshot-sync-refactor_*.md）。
//
// 架构：本地优先。日常读写全在 localStorage（本文件不做任何日常读写），
// 仅管理员在「数据同步」页手动触发 上传(本地→D1) / 下载(D1→本地)。
// 后端契约见 worker/_worker.js 头部注释：
//   GET  /api/sync/records  -> { data: {teams, matchRecords} | null, updated_at }
//   POST /api/sync/records  <- {teams, matchRecords}        （全量 REPLACE）
//   GET  /api/sync/stats    -> { data: {heroWinRateStats, cardWinRateResults} | null, updated_at }
//   POST /api/sync/stats    <- 同上                          （全量 REPLACE）
//
// 注意：
// - `cdgame_record_data` 本地始终以 AES 密文存储（隐私层保留）；上传前解密成
//   明文 JSON 传给 D1（D1 侧由 Bearer 鉴权保护），下载后再加密写回本地。
// - 下载只在请求成功且 JSON 解析通过后才写 localStorage，失败绝不覆盖本地。
import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';

const API_BASE = process.env.VUE_APP_API_BASE || '';

// 与 HeroData.vue / store/index.ts 保持一致的管理员凭据与加密密钥
const ADMIN_PASSWORD_HASH = '4f323fde03b2d593d6988bb02ab0b7b7';

const RECORD_STORAGE_KEY = 'cdgame_record_data';
const RECORD_ENCRYPTION_KEY = 'cdgame-record-secret-key-2024';

const HERO_WIN_RATE_KEY = 'hero-win-rate-stats';
const CARD_WIN_RATE_KEY = 'card-win-rate-results';

// 请求超时：避免后端不可达时长时间挂起（与 HeroData 的 SAVE_TIMEOUT 同思路）
const SYNC_TIMEOUT_MS = 30000;

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_PASSWORD_HASH}`,
    };
}

// 统一请求：非 2xx 抛出带服务端错误信息的 Error；带超时
async function apiRequest(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
    let response;
    try {
        response = await fetch(API_BASE + path, { ...options, headers: authHeaders(), signal: controller.signal });
    } catch (e) {
        throw new Error(e.name === 'AbortError' ? '请求超时，后端无响应' : '无法连接后端（网络或部署问题），参见 readme.md「后端部署」');
    } finally {
        clearTimeout(timer);
    }
    if (!response.ok) {
        let raw = '';
        try { raw = await response.text(); } catch (e) { /* ignore */ }
        let msg = `HTTP ${response.status}`;
        try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.error) msg = parsed.error;
        } catch (e) {
            if (raw) msg += `：${raw.replace(/<[^>]+>/g, '').trim().slice(0, 80)}`;
        }
        throw new Error(msg);
    }
    return response.json();
}

// ===== 本地记录层（AES）=====

function readLocalRecordData() {
    const encrypted = localStorage.getItem(RECORD_STORAGE_KEY);
    if (!encrypted) return { teams: [], matchRecords: [] };
    try {
        const bytes = AES.decrypt(encrypted, RECORD_ENCRYPTION_KEY);
        const parsed = JSON.parse(bytes.toString(Utf8));
        if (!parsed || typeof parsed !== 'object') throw new Error('结构异常');
        return { teams: parsed.teams || [], matchRecords: parsed.matchRecords || [] };
    } catch (e) {
        throw new Error('本地比赛记录解析失败（密文损坏或密钥不匹配），已中止同步');
    }
}

function writeLocalRecordData(data) {
    const encrypted = AES.encrypt(JSON.stringify(data), RECORD_ENCRYPTION_KEY).toString();
    localStorage.setItem(RECORD_STORAGE_KEY, encrypted);
}

// ===== 本地胜率层（明文 JSON）=====

function readLocalJson(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
}

function writeLocalJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// ===== 对外 API =====

// 上传：本地比赛记录 + 队伍战绩 -> D1 快照
export async function uploadRecords() {
    const payload = readLocalRecordData();
    const result = await apiRequest('/api/sync/records', { method: 'POST', body: JSON.stringify(payload) });
    return { count: (payload.teams.length + payload.matchRecords.length), updated_at: result.updated_at };
}

// 下载：D1 快照 -> 本地（覆盖本地比赛记录 + 队伍战绩，AES 层保留）
export async function downloadRecords() {
    const { data, updated_at } = await apiRequest('/api/sync/records');
    if (!data) throw new Error('云端暂无比赛记录快照，请先在其他设备上传');
    if (!Array.isArray(data.teams) || !Array.isArray(data.matchRecords)) {
        throw new Error('云端快照结构异常，已保留本地数据');
    }
    writeLocalRecordData({ teams: data.teams, matchRecords: data.matchRecords });
    return {
        count: data.teams.length + data.matchRecords.length,
        updated_at,
    };
}

// 上传：本地两类胜率统计 -> D1 快照（聚合成一个对象）
export async function uploadStats() {
    const payload = {
        heroWinRateStats: readLocalJson(HERO_WIN_RATE_KEY, {}),
        cardWinRateResults: readLocalJson(CARD_WIN_RATE_KEY, []),
    };
    const result = await apiRequest('/api/sync/stats', { method: 'POST', body: JSON.stringify(payload) });
    return { updated_at: result.updated_at };
}

// 下载：D1 快照 -> 本地（仅覆盖快照中存在的键，避免旧快照清空新数据）
export async function downloadStats() {
    const { data, updated_at } = await apiRequest('/api/sync/stats');
    if (!data) throw new Error('云端暂无胜率统计快照，请先在其他设备上传');
    const restored = [];
    if (data.heroWinRateStats !== undefined) {
        writeLocalJson(HERO_WIN_RATE_KEY, data.heroWinRateStats);
        restored.push('选手胜率');
    }
    if (data.cardWinRateResults !== undefined) {
        writeLocalJson(CARD_WIN_RATE_KEY, data.cardWinRateResults);
        restored.push('卡牌胜率');
    }
    if (!restored.length) throw new Error('云端快照不含任何胜率数据，已保留本地数据');
    return { restored, updated_at };
}

// 查询两份快照的最近同步时间（用于页面展示「上次同步」）
export async function getSyncTimestamps() {
    const [records, stats] = await Promise.all([
        apiRequest('/api/sync/records'),
        apiRequest('/api/sync/stats'),
    ]);
    return {
        recordsUpdatedAt: records.updated_at || null,
        statsUpdatedAt: stats.updated_at || null,
    };
}
