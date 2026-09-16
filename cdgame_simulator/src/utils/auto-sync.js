// 战绩/选手数据的定时同步（本地 -> D1 快照）。
//
// 策略：本地优先 + 指纹驱动。日常读写仍在 localStorage（AES），本模块不参与日常读写，
// 只负责「本地数据有变化时把快照上传云端」：
//   - 指纹 = localStorage['cdgame_record_data'] 密文的 MD5；与上次成功上传的指纹一致则跳过；
//   - 仅在管理员登录态下运行（/api/sync/records 需要 Bearer 鉴权）；
//   - 只上传、绝不自动下载（避免本地被云端旧快照覆盖）；
//   - 失败只记录到配置里的 lastError，不弹窗（手动同步由调用方提示）。
//
// 与 worker/_worker.js 的契约见 src/utils/sync-api.js 头部注释。
import CryptoJS from 'crypto-js';
import { uploadRecords } from './sync-api';
import {
    AUTO_SYNC_STORAGE_KEY,
    DEFAULT_AUTO_SYNC_INTERVAL_MIN,
    MAX_AUTO_SYNC_INTERVAL_MIN,
    MIN_AUTO_SYNC_INTERVAL_MIN,
    RECORD_STORAGE_KEY,
} from '../config/league';

const DEFAULT_CONFIG = {
    enabled: true,
    intervalMin: DEFAULT_AUTO_SYNC_INTERVAL_MIN,
    lastSyncAt: null,
    lastFingerprint: '',
    lastError: '',
    lastErrorAt: null,
};

// 启动后延迟补跑一次，避免登录瞬间与页面初始化抢网络
const FIRST_RUN_DELAY_MS = 10000;

let timer = null;
let firstRunTimer = null;
let syncing = false;
let adminProvider = () => true;

function readConfig() {
    let saved = {};
    try {
        const raw = localStorage.getItem(AUTO_SYNC_STORAGE_KEY);
        if (raw) saved = JSON.parse(raw) || {};
    } catch (e) {
        saved = {};
    }
    return { ...DEFAULT_CONFIG, ...saved };
}

function writeConfig(patch) {
    const next = { ...readConfig(), ...patch };
    try {
        localStorage.setItem(AUTO_SYNC_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
        console.error('保存自动同步配置失败:', e);
    }
    return next;
}

// 本地记录指纹：直接对 AES 密文取 MD5，避免解密开销
function getLocalFingerprint() {
    const raw = localStorage.getItem(RECORD_STORAGE_KEY);
    if (!raw) return '';
    return CryptoJS.MD5(raw).toString();
}

export async function syncNow(force) {
    if (syncing) return { uploaded: false, reason: 'syncing' };
    const fingerprint = getLocalFingerprint();
    if (!fingerprint) return { uploaded: false, reason: 'no-local-data' };
    const config = readConfig();
    if (!force && fingerprint === config.lastFingerprint) {
        return { uploaded: false, reason: 'no-change' };
    }
    syncing = true;
    try {
        const result = await uploadRecords();
        writeConfig({
            lastFingerprint: fingerprint,
            lastSyncAt: result.updated_at || Date.now(),
            lastError: '',
            lastErrorAt: null,
        });
        return { uploaded: true, updatedAt: result.updated_at };
    } catch (e) {
        writeConfig({ lastError: e.message || String(e), lastErrorAt: Date.now() });
        throw e;
    } finally {
        syncing = false;
    }
}

// 到点触发：未登录 / 未启用 / 无本地数据 / 无变化 均跳过
async function runAutoSync() {
    const config = readConfig();
    if (!config.enabled) return;
    if (adminProvider && !adminProvider()) return;
    const fingerprint = getLocalFingerprint();
    if (!fingerprint) return;
    try {
        await syncNow(false);
    } catch (e) {
        console.error('自动同步失败:', e);
    }
}

export function stopAutoSync() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    if (firstRunTimer) {
        clearTimeout(firstRunTimer);
        firstRunTimer = null;
    }
}

export function startAutoSync(isAdminFn) {
    if (isAdminFn) adminProvider = isAdminFn;
    stopAutoSync();
    const config = readConfig();
    const intervalMin = Math.min(
        MAX_AUTO_SYNC_INTERVAL_MIN,
        Math.max(MIN_AUTO_SYNC_INTERVAL_MIN, Number(config.intervalMin) || DEFAULT_AUTO_SYNC_INTERVAL_MIN),
    );
    timer = setInterval(runAutoSync, intervalMin * 60 * 1000);
    firstRunTimer = setTimeout(runAutoSync, FIRST_RUN_DELAY_MS);
}

export function getAutoSyncConfig() {
    const config = readConfig();
    return { enabled: config.enabled, intervalMin: config.intervalMin };
}

export function setAutoSyncConfig(patch) {
    const next = {};
    if (patch.enabled !== undefined) next.enabled = !!patch.enabled;
    if (patch.intervalMin !== undefined) {
        next.intervalMin = Math.min(
            MAX_AUTO_SYNC_INTERVAL_MIN,
            Math.max(MIN_AUTO_SYNC_INTERVAL_MIN, Math.round(Number(patch.intervalMin) || DEFAULT_AUTO_SYNC_INTERVAL_MIN)),
        );
    }
    writeConfig(next);
    if (timer) {
        startAutoSync(adminProvider);
    }
    return getAutoSyncConfig();
}

export function getAutoSyncStatus() {
    const config = readConfig();
    return {
        syncing,
        running: !!timer,
        lastSyncAt: config.lastSyncAt,
        lastError: config.lastError,
        lastErrorAt: config.lastErrorAt,
        pending: getLocalFingerprint() !== config.lastFingerprint,
    };
}
