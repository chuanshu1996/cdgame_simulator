// 联赛 / 赛程 / AI 托管相关常量与默认值（单一数据源）
//
// RANK_VALUES 原本是 BattleStats.vue 的内部常量，为避免「赛程引援身价」与
// 「战后勾玉结算」两套数值漂移，统一抽到此处，两边共用。

export const RANK_VALUES: Record<string, number> = {
    'D': 6, 'C': 9, 'UC': 12, 'B': 18, 'A': 24,
    'EX': 30, 'S': 36, 'S+': 42, 'SS': 48,
    'SSR': 48, 'SR': 24, 'R': 12, 'N': 6,
};

// 引援价 = 稀有度价值 × 系数（系数可在赛程页调整）
export const DEFAULT_PRICE_FACTOR = 10;

// 上场门槛：正赛下 exp < 3 且非公开邀请的英雄不可选（与 Team.vue isHeroDisabled 一致）
export const OFFICIAL_EXP_THRESHOLD = 3;
export const MAX_EXP = 6;

// 出战阵容位置（与「队伍设置」8 位一致）
export const POSITION_LABELS = ['教练', '先锋', '次锋', '中坚', '副将', '大将', '替补', '应援'];
export const LINEUP_SIZE = 8;

// 本地存储：赛程/AI 配置为明文 JSON（与 omj_team_state 同策略，不进 D1 快照）
export const SCHEDULE_STORAGE_KEY = 'cdgame_schedule_data';

// 本地存储：队伍战绩与比赛记录（AES）
export const RECORD_STORAGE_KEY = 'cdgame_record_data';
export const RECORD_ENCRYPTION_KEY = 'cdgame-record-secret-key-2024';

// GLM（智谱开放平台）默认接入参数，免费模型 glm-4.7-flash
export const GLM_DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
export const GLM_DEFAULT_MODEL = 'glm-4.7-flash';
export const GLM_TIMEOUT_MS = 60000;

// 自动结算扫描间隔
export const SCAN_INTERVAL_MS = 60000;

// 无头对局保护（与 Predict.vue 同量级）
export const MAX_PROCESS_COUNT = 50000;
export const PROCESSES_PER_FRAME = 500;

export function getRankValue(rank?: string): number {
    return RANK_VALUES[(rank || '').toUpperCase()] || 6;
}

// 引援身价：优先用页面覆盖价，否则 价值 × 系数
export function getRankPrice(rank: string, factor: number, overrides?: Record<string, number>): number {
    const key = (rank || '').toUpperCase();
    if (overrides && overrides[key] !== undefined && overrides[key] !== null) {
        return Number(overrides[key]) || 0;
    }
    return Math.round(getRankValue(key) * (factor || DEFAULT_PRICE_FACTOR));
}

export function getDefaultLeagueConfig() {
    return {
        // regular: single=单循环 / double=双循环
        mode: 'single' as 'single' | 'double',
        playoff: {
            enabled: true,
            slots: 4,
            format: 'single_elim' as 'single_elim' | 'double_elim',
        },
        // 是否按正赛结算（正赛记胜负与双倍勾玉，友谊赛只记小分）
        official: true,
    };
}

export function getDefaultAiConfig() {
    return {
        baseUrl: GLM_DEFAULT_BASE_URL,
        apiKey: '',
        model: GLM_DEFAULT_MODEL,
        // 开启托管的队伍 id
        managedTeamIds: [] as string[],
        priceFactor: DEFAULT_PRICE_FACTOR,
        priceOverrides: {} as Record<string, number>,
    };
}
