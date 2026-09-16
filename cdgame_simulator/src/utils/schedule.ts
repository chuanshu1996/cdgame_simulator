// 联赛赛程：编排（轮转法 + 季后赛）、截止时间扫描、无头对局与结算写回
//
// 数据分层：
// - 赛程/AI 配置：明文 JSON 存 localStorage[cdgame_schedule_data]（与 omj_team_state 同策略，不进 D1）
// - 结算结果：写回 AES 的 cdgame_record_data（teams + matchRecords），复用「队伍战绩 / 比赛记录」页

import CryptoJS from 'crypto-js';
import { Battle, BattleProperties, Buff, EffectTypes, Reasons, HeroData, HeroBuilders } from '../../core';
import { updateHeroWinRateStats } from './hero-win-rate';
import { planTeamForRound } from './league-ai';
import {
    SCHEDULE_STORAGE_KEY,
    RECORD_STORAGE_KEY,
    RECORD_ENCRYPTION_KEY,
    LINEUP_SIZE,
    OFFICIAL_EXP_THRESHOLD,
    MAX_EXP,
    MAX_PROCESS_COUNT,
    PROCESSES_PER_FRAME,
    getRankValue,
    getRankPrice,
    getDefaultLeagueConfig,
    getDefaultAiConfig,
} from '../config/league';

export const BYE = 'BYE';

// ===== 类型 =====

export interface MatchRef {
    matchId: string;
    loser?: boolean; // true = 取该场的败方
}

export interface ScheduleMatch {
    id: string;
    homeId?: string | null; // 直接指定队伍（常规赛 & 手动调整）
    awayId?: string | null;
    homeSeed?: number | null; // 种子位（1 起），结算时按即时排名解析
    awaySeed?: number | null;
    homeRef?: MatchRef | null; // 取自另一场的胜/败方（季后赛）
    awayRef?: MatchRef | null;
    label?: string;
    status: 'pending' | 'settled' | 'skipped';
    winnerId?: string | null;
    seed?: string;
    settledAt?: string;
    note?: string;
    result?: {
        jadeHome: number;
        jadeAway: number;
        source: 'auto' | 'manual';
    };
}

export interface ScheduleRound {
    id: string;
    no: number;
    stage: 'regular' | 'playoff';
    name: string;
    deadline: string; // ISO
    matches: ScheduleMatch[];
}

export interface ScheduleState {
    seasonName: string;
    teams: string[]; // 参赛队伍 id
    config: ReturnType<typeof getDefaultLeagueConfig>;
    rounds: ScheduleRound[];
    ai: ReturnType<typeof getDefaultAiConfig>;
    lineups: Record<string, (string | null)[]>;
    updatedAt: string;
}

// cdgame_record_data 里的队伍（字段语义沿用既有代码）
export interface RecordTeam {
    id: string;
    name: string;
    matches?: number;
    jade?: number;
    wins?: number;
    losses?: number;
    score?: number;
    heroExps?: Record<string, number>;
    // 体力：0..MAX_STAMINA，与 heroExps 同构（key 为 HeroData[].index 字符串）。
    // 本轮仅记录/编辑，不参与上场门槛、结算等任何规则，为后续体力系统预留。
    heroStaminas?: Record<string, number>;
    souls?: { id: string; name: string; count: number }[];
    drawnHeroIds?: string[];
    isDrawTarget?: boolean;
}

export interface RecordData {
    teams: RecordTeam[];
    matchRecords: any[];
    [key: string]: any;
}

export interface SettleLog {
    matchId: string;
    roundName: string;
    teamName: string;
    message: string;
    ok: boolean;
}

// ===== 通用工具 =====

export function uid(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 本地存储：赛程 =====

export function createEmptySchedule(): ScheduleState {
    return {
        seasonName: '新赛季',
        teams: [],
        config: getDefaultLeagueConfig(),
        rounds: [],
        ai: getDefaultAiConfig(),
        lineups: {},
        updatedAt: new Date().toISOString(),
    };
}

export function loadSchedule(): ScheduleState {
    const empty = createEmptySchedule();
    try {
        const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
        if (!raw) return empty;
        const parsed = JSON.parse(raw);
        return {
            seasonName: parsed.seasonName || empty.seasonName,
            teams: Array.isArray(parsed.teams) ? parsed.teams : [],
            config: Object.assign(empty.config, parsed.config || {}, {
                playoff: Object.assign(empty.config.playoff, (parsed.config || {}).playoff || {}),
            }),
            rounds: Array.isArray(parsed.rounds) ? parsed.rounds : [],
            ai: Object.assign(empty.ai, parsed.ai || {}),
            lineups: parsed.lineups && typeof parsed.lineups === 'object' ? parsed.lineups : {},
            updatedAt: parsed.updatedAt || empty.updatedAt,
        };
    } catch (e) {
        console.error('加载赛程数据失败:', e);
        return empty;
    }
}

export function saveSchedule(state: ScheduleState): void {
    state.updatedAt = new Date().toISOString();
    try {
        localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('保存赛程数据失败:', e);
    }
}

// ===== 本地存储：战绩（AES）=====

export function readRecordData(): RecordData {
    const fallback: RecordData = { teams: [], matchRecords: [] };
    try {
        const encrypted = localStorage.getItem(RECORD_STORAGE_KEY);
        if (!encrypted) return fallback;
        const bytes = CryptoJS.AES.decrypt(encrypted, RECORD_ENCRYPTION_KEY);
        const parsed = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        if (!parsed || typeof parsed !== 'object') return fallback;
        return Object.assign(fallback, parsed);
    } catch (e) {
        console.error('解析队伍战绩失败:', e);
        return fallback;
    }
}

export function writeRecordData(data: RecordData): void {
    data.savedAt = new Date().toISOString();
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), RECORD_ENCRYPTION_KEY).toString();
    localStorage.setItem(RECORD_STORAGE_KEY, encrypted);
}

// ===== 赛程编排 =====

function defaultDeadline(index: number): string {
    const d = new Date();
    d.setDate(d.getDate() + (index + 1) * 7);
    d.setHours(20, 0, 0, 0);
    return d.toISOString();
}

// 轮转法（circle method）：奇数队自动补 BYE
function roundRobinPairs(teamIds: string[], double: boolean): { home: string; away: string }[][] {
    const list = teamIds.slice();
    if (list.length < 2) return [];
    if (list.length % 2 === 1) list.push(BYE);

    const n = list.length;
    const arr = list.slice();
    const rounds: { home: string; away: string }[][] = [];

    for (let r = 0; r < n - 1; r++) {
        const pairs: { home: string; away: string }[] = [];
        for (let i = 0; i < n / 2; i++) {
            const a = arr[i];
            const b = arr[n - 1 - i];
            if (a === BYE || b === BYE) continue;
            // 逐轮交换主客，避免同一支队伍长期主场
            pairs.push(r % 2 === 1 ? { home: b, away: a } : { home: a, away: b });
        }
        rounds.push(pairs);
        // 固定首位，其余右旋一格
        const fixed = arr[0];
        const rest = arr.slice(1);
        rest.unshift(rest.pop() as string);
        arr.splice(0, arr.length, fixed, ...rest);
    }

    if (!double) return rounds;

    const secondLeg = rounds.map(pairs => pairs.map(p => ({ home: p.away, away: p.home })));
    return rounds.concat(secondLeg);
}

interface DraftMatch {
    id: string;
    homeId?: string | null;
    awayId?: string | null;
    homeSeed?: number | null;
    awaySeed?: number | null;
    homeRef?: MatchRef | null;
    awayRef?: MatchRef | null;
    label?: string;
}

interface DraftRound {
    no: number;
    label: string;
    matches: DraftMatch[];
}

// 季后赛对阵：单败 / 双败（双败仅支持 4/8 队，其余回退单败）
function buildPlayoffDraft(slots: number, format: 'single_elim' | 'double_elim'): DraftRound[] {
    const k = Math.round(Math.log2(slots));
    const rounds: DraftRound[] = [];
    const push = (no: number, m: DraftMatch) => {
        let r = rounds.find(x => x.no === no);
        if (!r) {
            r = { no, label: '', matches: [] };
            rounds.push(r);
        }
        r.matches.push(m);
    };

    // 胜者组
    const wb: string[][] = [];
    const first: string[] = [];
    for (let i = 0; i < slots / 2; i++) {
        const id = `p1-w${i + 1}`;
        push(1, {
            id,
            homeSeed: i + 1,
            awaySeed: slots - i,
            label: `${i + 1} 号种子 vs ${slots - i} 号种子`,
        });
        first.push(id);
    }
    wb[1] = first;

    for (let r = 2; r <= k; r++) {
        const cur: string[] = [];
        const count = slots / Math.pow(2, r);
        for (let j = 0; j < count; j++) {
            const id = `p${r}-w${j + 1}`;
            push(r, {
                id,
                homeRef: { matchId: wb[r - 1][j * 2], loser: false },
                awayRef: { matchId: wb[r - 1][j * 2 + 1], loser: false },
                label: `胜者组第 ${r} 轮 第 ${j + 1} 场`,
            });
            cur.push(id);
        }
        wb[r] = cur;
    }

    if (format === 'double_elim' && slots >= 4) {
        // 败者组：LB1 = 胜者组首轮败者配对；之后「大轮」对胜者组该轮败者，「小轮」败者组内部配对
        let lbPrev: string[] = [];
        for (let j = 0; j < slots / 4; j++) {
            const id = `p2-l${j + 1}`;
            push(2, {
                id,
                homeRef: { matchId: wb[1][j * 2], loser: true },
                awayRef: { matchId: wb[1][j * 2 + 1], loser: true },
                label: `败者组第 1 轮 第 ${j + 1} 场`,
            });
            lbPrev.push(id);
        }
        for (let r = 2; r <= k; r++) {
            const count = slots / Math.pow(2, r);
            const majorIds: string[] = [];
            for (let j = 0; j < count; j++) {
                const id = `p${r + 1}-l${j + 1}`;
                push(r + 1, {
                    id,
                    homeRef: { matchId: lbPrev[j], loser: false },
                    awayRef: { matchId: wb[r][j], loser: true },
                    label: `败者组第 ${2 * r - 2} 轮 第 ${j + 1} 场`,
                });
                majorIds.push(id);
            }
            if (r === k) {
                lbPrev = majorIds;
                break;
            }
            const minorIds: string[] = [];
            for (let j = 0; j < count / 2; j++) {
                const id = `p${r + 2}-l${j + 1}`;
                push(r + 2, {
                    id,
                    homeRef: { matchId: majorIds[j * 2], loser: false },
                    awayRef: { matchId: majorIds[j * 2 + 1], loser: false },
                    label: `败者组第 ${2 * r - 1} 轮 第 ${j + 1} 场`,
                });
                minorIds.push(id);
            }
            lbPrev = minorIds;
        }
        push(k + 2, {
            id: 'gf-1',
            homeRef: { matchId: wb[k][0], loser: false },
            awayRef: { matchId: lbPrev[0], loser: false },
            label: '总决赛',
        });
    }

    return rounds.sort((a, b) => a.no - b.no);
}

function normalizeSlots(slots: number, teamCount: number): number {
    const allowed = [2, 4, 8];
    let n = Number(slots) || 4;
    n = allowed.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), 4);
    return Math.min(n, Math.max(2, teamCount));
}

/**
 * 生成完整赛程（常规赛 + 季后赛）。
 * 已存在的轮次会保留：截止时间（按 stage+no）、已结算状态与结果（按 match.id）。
 */
export function generateSchedule(state: ScheduleState): ScheduleState {
    const oldRounds = new Map<string, ScheduleRound>();
    state.rounds.forEach(r => oldRounds.set(r.id, r));

    const oldMatches = new Map<string, ScheduleMatch>();
    state.rounds.forEach(r => r.matches.forEach(m => oldMatches.set(m.id, m)));

    const rounds: ScheduleRound[] = [];

    const pairsRounds = roundRobinPairs(state.teams, state.config.mode === 'double');
    pairsRounds.forEach((pairs, index) => {
        const no = index + 1;
        const id = `regular-${no}`;
        const old = oldRounds.get(id);
        rounds.push({
            id,
            no,
            stage: 'regular',
            name: `常规赛 第 ${no} 轮`,
            deadline: (old && old.deadline) || defaultDeadline(index),
            matches: pairs.map((p, mi) => {
                const mid = `r${no}-m${mi + 1}`;
                const oldMatch = oldMatches.get(mid);
                return Object.assign(
                    {
                        id: mid,
                        homeId: p.home,
                        awayId: p.away,
                        status: 'pending' as const,
                    },
                    oldMatch
                        ? {
                            status: oldMatch.status,
                            winnerId: oldMatch.winnerId,
                            seed: oldMatch.seed,
                            settledAt: oldMatch.settledAt,
                            result: oldMatch.result,
                            note: oldMatch.note,
                        }
                        : {},
                ) as ScheduleMatch;
            }),
        });
    });

    if (state.config.playoff.enabled && state.teams.length >= 2) {
        const slots = normalizeSlots(state.config.playoff.slots, state.teams.length);
        const format = slots >= 4 ? state.config.playoff.format : 'single_elim';
        const draft = buildPlayoffDraft(slots, format);
        const regularCount = rounds.length;
        draft.forEach(d => {
            const no = d.no;
            const id = `playoff-${no}`;
            const old = oldRounds.get(id);
            rounds.push({
                id,
                no,
                stage: 'playoff',
                name: `季后赛 第 ${no} 轮`,
                deadline: (old && old.deadline) || defaultDeadline(regularCount + no - 1),
                matches: d.matches.map(m => {
                    const oldMatch = oldMatches.get(m.id);
                    return Object.assign(
                        { id: m.id, status: 'pending' as const },
                        m,
                        oldMatch
                            ? {
                                status: oldMatch.status,
                                winnerId: oldMatch.winnerId,
                                seed: oldMatch.seed,
                                settledAt: oldMatch.settledAt,
                                result: oldMatch.result,
                                note: oldMatch.note,
                                // 手动指定优先于自动编排
                                homeId: oldMatch.homeId || null,
                                awayId: oldMatch.awayId || null,
                            }
                            : {},
                    ) as ScheduleMatch;
                }),
            });
        });
    }

    state.rounds = rounds;
    return state;
}

// ===== 排名与对阵解析 =====

/** 与「队伍战绩」一致：胜场 → 小分 → 勾玉 */
export function computeStandings(teams: RecordTeam[]): RecordTeam[] {
    return teams.slice().sort((a, b) => {
        const aw = a.wins || 0;
        const bw = b.wins || 0;
        if (bw !== aw) return bw - aw;
        const as = a.score || 0;
        const bs = b.score || 0;
        if (bs !== as) return bs - as;
        return (b.jade || 0) - (a.jade || 0);
    });
}

function findMatch(state: ScheduleState, matchId: string): ScheduleMatch | null {
    for (const r of state.rounds) {
        const m = r.matches.find(x => x.id === matchId);
        if (m) return m;
    }
    return null;
}

function resolveRef(state: ScheduleState, ref: MatchRef | null | undefined, standings: RecordTeam[]): string | null {
    if (!ref) return null;
    const m = findMatch(state, ref.matchId);
    if (!m || m.status !== 'settled' || !m.winnerId) return null;
    if (!ref.loser) return m.winnerId;
    const loser = m.homeId === m.winnerId ? m.awayId : m.homeId;
    return loser || null;
}

export function resolveMatchTeam(
    state: ScheduleState,
    match: ScheduleMatch,
    side: 'home' | 'away',
    standings: RecordTeam[],
): string | null {
    const direct = side === 'home' ? match.homeId : match.awayId;
    if (direct && direct !== BYE) return direct;

    const ref = side === 'home' ? match.homeRef : match.awayRef;
    const byRef = resolveRef(state, ref, standings);
    if (byRef) return byRef;

    const seed = side === 'home' ? match.homeSeed : match.awaySeed;
    if (seed && seed > 0) {
        const t = standings[seed - 1];
        if (t) return t.id;
    }
    return null;
}

// 种子位是「排名中的绝对位次」：先取第 seed 名，若已被本轮其它场次占用则顺延
function pickSeeded(seed: number, pool: RecordTeam[], used: Set<string>): string | null {
    for (let i = Math.max(0, seed - 1); i < pool.length; i++) {
        if (!used.has(pool[i].id)) return pool[i].id;
    }
    for (let i = 0; i < pool.length; i++) {
        if (!used.has(pool[i].id)) return pool[i].id;
    }
    return null;
}

/**
 * 整轮一次性确定对阵：按种子位依次占用队伍，避免「逐场按即时排名解析」
 * 造成同一支队伍被分到同一轮的两场比赛（并导致后续轮次无法解析）。
 */
export function ensureRoundResolved(state: ScheduleState, round: ScheduleRound, standings: RecordTeam[]): boolean {
    const used = new Set<string>();
    let changed = false;

    round.matches.forEach(m => {
        if (m.homeId && m.homeId !== BYE) used.add(m.homeId);
        if (m.awayId && m.awayId !== BYE) used.add(m.awayId);
    });

    round.matches.forEach(m => {
        const byRef = (side: 'home' | 'away') => resolveRef(state, side === 'home' ? m.homeRef : m.awayRef, standings);
        if (!m.homeId || m.homeId === BYE) {
            const id = byRef('home') || (m.homeSeed ? pickSeeded(m.homeSeed, standings, used) : null);
            if (id) {
                m.homeId = id;
                used.add(id);
                changed = true;
            }
        }
        if (!m.awayId || m.awayId === BYE) {
            const id = byRef('away') || (m.awaySeed ? pickSeeded(m.awaySeed, standings, used) : null);
            if (id && id !== m.homeId) {
                m.awayId = id;
                used.add(id);
                changed = true;
            }
        }
    });

    return changed;
}

// ===== 队伍阵容 / 宝物 =====

export function getHeroById(heroId: string): any | null {
    return HeroData.find(h => String(h.index) === String(heroId)) || null;
}

export function isHeroPlayable(heroId: string): boolean {
    return HeroBuilders.has(Number(heroId));
}

/** 队伍可用选手：exp 达门槛或公开邀请，且已实现技能 */
export function getOwnedHeroIds(team: RecordTeam): string[] {
    const exps = team.heroExps || {};
    const drawn = team.drawnHeroIds || [];
    return Object.keys(exps)
        .filter(id => (Number(exps[id]) || 0) >= OFFICIAL_EXP_THRESHOLD || drawn.indexOf(id) !== -1)
        .filter(isHeroPlayable);
}

export function heroPoint(heroId: string): number {
    const h = getHeroById(heroId);
    const p = h ? Number(h.point) : 0;
    return Number.isFinite(p) ? p : 0;
}

/** 无阵容时的兜底：按战力分（point）从高到低取 8 人 */
export function autoBuildLineup(team: RecordTeam): (string | null)[] {
    const owned = getOwnedHeroIds(team).sort((a, b) => heroPoint(b) - heroPoint(a));
    const lineup: (string | null)[] = [];
    for (let i = 0; i < LINEUP_SIZE; i++) lineup.push(owned[i] || null);
    return lineup;
}

export function getLineup(state: ScheduleState, team: RecordTeam): (string | null)[] {
    const saved = state.lineups[team.id];
    if (Array.isArray(saved) && saved.length === LINEUP_SIZE) return saved;
    return autoBuildLineup(team);
}

/** 队伍宝物 {id,name,count} 展开后依次填入 8 个位置，每人最多 3 个 */
export function buildSoulIds(team: RecordTeam): string[][] {
    const expanded: string[] = [];
    (team.souls || []).forEach(s => {
        if (!s || !s.id) return;
        const c = Math.max(1, Number(s.count) || 1);
        for (let i = 0; i < c; i++) expanded.push(s.id);
    });
    const result: string[][] = [];
    for (let i = 0; i < LINEUP_SIZE; i++) {
        result.push(expanded.slice(i * 3, (i + 1) * 3));
    }
    return result;
}

// ===== 无头对局 =====

function buildTeamBattleData(
    team: RecordTeam,
    lineup: (string | null)[],
    teamId: number,
    soulIds: string[][],
): any[] {
    const exps = team.heroExps || {};
    const data: any[] = [];
    for (let i = 0; i < LINEUP_SIZE; i++) {
        const heroId = lineup[i];
        if (!heroId) continue;
        const hero = getHeroById(heroId);
        if (!hero) continue;
        if (!isHeroPlayable(heroId)) continue;
        data.push({
            no: Number(hero.index),
            name: hero.name,
            teamId,
            index: i,
            max_hp: Number(hero.hp) || 0,
            atk: Number(hero.atk) || 0,
            def: Number(hero.def) || 0,
            spd: Number(hero.spd) || 0,
            cri: Number(hero.cri) || 0,
            cri_dmg: Number(hero.cri_dmg) || 0,
            eft_hit: Number(hero.eft_hit) || 0,
            eft_res: Number(hero.eft_res) || 0,
            waitInput: true,
            soulIds: soulIds[i] || [],
            isReserve: i >= 6,
            __exp: Number(exps[heroId]) || 0,
        });
    }
    return data;
}

function buildMaxExpBuff(sourceId: number, targetId: number) {
    return Buff.build(sourceId, targetId)
        .name('满经验', 1)
        .noDispel()
        .noRemove()
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.15)
        .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.15)
        .end();
}

/** 跑完一整场（分帧执行，避免卡死 UI） */
export async function runHeadlessBattle(data: any[], seed: number, options: any): Promise<any> {
    const battle = new Battle(data, seed, 0, options);

    // 满经验加成（与模拟页一致：exp>=6 的角色加「满经验」buff）
    const expMap = new Map<number, number>();
    data.forEach(d => expMap.set(Number(d.no), Number(d.__exp) || 0));
    for (let teamId = 0; teamId < 2; teamId++) {
        const field = battle.fields[teamId] || [];
        for (let pos = 0; pos < field.length; pos++) {
            const entityId = field[pos];
            if (!entityId) continue;
            const entity: any = battle.entities.get(entityId);
            if (!entity) continue;
            if ((expMap.get(Number(entity.no)) || 0) >= MAX_EXP) {
                battle.actionAddBuff(buildMaxExpBuff(entityId, entityId), Reasons.SKILL);
            }
        }
    }

    let count = 0;
    while (!battle.isEnd && count < MAX_PROCESS_COUNT) {
        const result = battle.process();
        count++;
        if (!result) break;

        const task: any = battle.currentTask;
        if (task && task.type === 'WaitInput') {
            const waitData = task.data;
            if (waitData && waitData.skills && waitData.skills.length > 0) {
                const skill = waitData.skills[0];
                if (skill && skill.targets && skill.targets.length > 0) {
                    waitData.selection = {
                        no: skill.no,
                        targetId: battle.getRandomOne(skill.targets),
                    };
                }
            }
        }

        if (count % PROCESSES_PER_FRAME === 0) await sleep(0);
    }
    return battle;
}

function buildBattleStats(battle: any): any[] {
    const teams: any[] = [
        { units: [], totals: { damage: 0, damageTaken: 0, maxHit: 0, energy: 0, heal: 0, shield: 0, control: 0 } },
        { units: [], totals: { damage: 0, damageTaken: 0, maxHit: 0, energy: 0, heal: 0, shield: 0, control: 0 } },
    ];
    battle.entities.forEach((entity: any, entityId: number) => {
        if (entity.teamId !== 0 && entity.teamId !== 1) return;
        const team = teams[entity.teamId];
        const stats = {
            entityId,
            name: entity.name,
            no: entity.no,
            rank: entity.rank,
            totalDamage: Number(entity.battleData && entity.battleData.get('totalDamage')) || 0,
            damageTaken: Number(entity.battleData && entity.battleData.get('damageTaken')) || 0,
            maxHit: Number(entity.battleData && entity.battleData.get('maxHit')) || 0,
            energyUsed: Number(entity.battleData && entity.battleData.get('energyUsed')) || 0,
            totalHeal: Number(entity.battleData && entity.battleData.get('totalHeal')) || 0,
            totalShield: Number(entity.battleData && entity.battleData.get('totalShield')) || 0,
            totalControl: Number(entity.battleData && entity.battleData.get('totalControl')) || 0,
            damagePercent: '0.0',
            damageTakenPercent: '0.0',
            maxHitPercent: '0.0',
            energyPercent: '0.0',
            healPercent: '0.0',
            shieldPercent: '0.0',
            controlPercent: '0.0',
        };
        team.totals.damage += stats.totalDamage;
        team.totals.damageTaken += stats.damageTaken;
        team.totals.maxHit = Math.max(team.totals.maxHit, stats.maxHit);
        team.totals.energy += stats.energyUsed;
        team.totals.heal += stats.totalHeal;
        team.totals.shield += stats.totalShield;
        team.totals.control += stats.totalControl;
        team.units.push(stats);
    });

    const pct = (v: number, total: number) => (total > 0 ? (v / total * 100).toFixed(1) : '0.0');
    teams.forEach(team => {
        team.units.forEach((u: any) => {
            u.damagePercent = pct(u.totalDamage, team.totals.damage);
            u.damageTakenPercent = pct(u.totalDamageTaken || u.damageTaken, team.totals.damageTaken);
            u.maxHitPercent = pct(u.maxHit, team.totals.maxHit);
            u.energyPercent = pct(u.energyUsed, team.totals.energy);
            u.healPercent = pct(u.totalHeal, team.totals.heal);
            u.shieldPercent = pct(u.totalShield, team.totals.shield);
            u.controlPercent = pct(u.totalControl, team.totals.control);
        });
    });

    return [{ units: teams[0].units }, { units: teams[1].units }];
}

/** 读取战场配置（与 Vuex battleSetup 同源，缺省 6v6 默认规则） */
export function readBattleSetup(): any {
    const def = {
        teamSizes: [6, 6],
        hasReserve: true,
        energy: {
            infinite: false,
            initNum: 4,
            maxNum: 8,
            progressGoal: 5,
            recoverAmount: 5,
            bonusIntervalRounds: 0,
            bonusAmount: 0,
        },
        winCondition: { type: 'annihilation', maxJudgeRounds: 0 },
    };
    try {
        const raw = localStorage.getItem('omj_team_state');
        if (!raw) return def;
        const parsed = JSON.parse(raw);
        const setup = parsed && parsed.battleSetup;
        if (!setup) return def;
        return {
            teamSizes: Array.isArray(setup.teamSizes) ? setup.teamSizes : def.teamSizes,
            hasReserve: setup.hasReserve !== false,
            energy: Object.assign({}, def.energy, setup.energy || {}),
            winCondition: Object.assign({}, def.winCondition, setup.winCondition || {}),
        };
    } catch (e) {
        return def;
    }
}

// ===== 结算 =====

export interface SettleOptions {
    /** 每场开始/结束的回调，用于页面日志 */
    onLog?: (log: SettleLog) => void;
    /** 是否允许 AI 托管队伍先规划引援/阵容 */
    allowAi?: boolean;
    /** 只结算指定比赛（手动触发） */
    onlyMatchIds?: string[];
}

function addLog(opts: SettleOptions, log: SettleLog) {
    if (opts.onLog) opts.onLog(log);
}

/** 引援落地：扣勾玉 + 提升到可上场门槛 */
export function applySigning(team: RecordTeam, heroId: string, price: number): boolean {
    if ((team.jade || 0) < price) return false;
    team.jade = (team.jade || 0) - price;
    if (!team.heroExps) team.heroExps = {};
    const cur = Number(team.heroExps[heroId]) || 0;
    team.heroExps[heroId] = Math.min(MAX_EXP, Math.max(cur, OFFICIAL_EXP_THRESHOLD));
    if (!team.drawnHeroIds) team.drawnHeroIds = [];
    if (team.drawnHeroIds.indexOf(heroId) === -1) team.drawnHeroIds.push(heroId);
    return true;
}

/** 列出可引援候选（尚未达到上场门槛、已实现技能） */
export function listSignableHeroes(team: RecordTeam, priceFactor: number, overrides: Record<string, number>) {
    const exps = team.heroExps || {};
    const drawn = team.drawnHeroIds || [];
    return HeroData.filter((h: any) => h.show === 1 && isHeroPlayable(String(h.index)))
        .filter((h: any) => {
            const id = String(h.index);
            return (Number(exps[id]) || 0) < OFFICIAL_EXP_THRESHOLD && drawn.indexOf(id) === -1;
        })
        .map((h: any) => ({
            id: String(h.index),
            name: h.name,
            rank: h.rank || 'N',
            point: Math.round(Number(h.point) || 0),
            atk: Math.round(Number(h.atk) || 0),
            hp: Math.round(Number(h.hp) || 0),
            def: Math.round(Number(h.def) || 0),
            spd: Math.round(Number(h.spd) || 0),
            price: getRankPrice(h.rank || 'N', priceFactor, overrides),
        }));
}

async function prepareTeam(
    state: ScheduleState,
    team: RecordTeam,
    opponent: RecordTeam,
    record: RecordData,
    opts: SettleOptions,
): Promise<void> {
    const managed = (state.ai.managedTeamIds || []).indexOf(team.id) !== -1;
    if (!managed || opts.allowAi === false) return;

    const heroes = listSignableHeroes(team, state.ai.priceFactor, state.ai.priceOverrides || {});
    const plan = await planTeamForRound({
        ai: state.ai,
        team,
        opponent,
        candidates: heroes,
        owned: getOwnedHeroIds(team).map(id => {
            const h = getHeroById(id);
            return {
                id,
                name: h ? h.name : id,
                rank: h ? h.rank || 'N' : 'N',
                exp: Number((team.heroExps || {})[id]) || 0,
                point: heroPoint(id),
            };
        }),
        currentLineup: getLineup(state, team),
        standings: computeStandings(record.teams).map(t => ({
            name: t.name,
            wins: t.wins || 0,
            losses: t.losses || 0,
            score: t.score || 0,
            jade: t.jade || 0,
        })),
    });

    let spent = 0;
    (plan.signings || []).forEach((s: { heroId: string }) => {
        const hero = getHeroById(s.heroId);
        if (!hero) return;
        const price = getRankPrice(hero.rank || 'N', state.ai.priceFactor, state.ai.priceOverrides || {});
        if (applySigning(team, s.heroId, price)) spent += price;
    });
    // 引援结果必须立即落盘：后面的结算会重新读取存档，否则扣费与新人会被覆盖丢失
    if (spent > 0) writeRecordData(record);

    if (Array.isArray(plan.lineup) && plan.lineup.length) {
        const next: (string | null)[] = [];
        for (let i = 0; i < LINEUP_SIZE; i++) {
            const id = plan.lineup[i] ? String(plan.lineup[i]) : null;
            next.push(id && isHeroPlayable(id) ? id : null);
        }
        if (next.some(x => x)) state.lineups[team.id] = next;
    }

    addLog(opts, {
        matchId: '',
        roundName: '',
        teamName: team.name,
        message: plan.fallback
            ? `AI 不可用，已用本地策略（花费 ${spent} 勾玉）${plan.note ? '：' + plan.note : ''}`
            : `AI 方案已执行（花费 ${spent} 勾玉）${plan.note ? '：' + plan.note : ''}`,
        ok: true,
    });
}

/** 结算单场比赛（含 AI 托管、无头模拟、写回战绩） */
export async function settleMatch(
    state: ScheduleState,
    round: ScheduleRound,
    match: ScheduleMatch,
    opts: SettleOptions = {},
): Promise<boolean> {
    if (match.status === 'settled') return false;

    const record = readRecordData();
    const standings = computeStandings(record.teams.filter(t => state.teams.indexOf(t.id) !== -1));
    // 先按当前排名把整轮对阵固定下来（季后赛依赖种子位），并立即持久化
    if (ensureRoundResolved(state, round, standings)) saveSchedule(state);
    const homeId = resolveMatchTeam(state, match, 'home', standings);
    const awayId = resolveMatchTeam(state, match, 'away', standings);
    if (!homeId || !awayId || homeId === awayId) {
        addLog(opts, {
            matchId: match.id,
            roundName: round.name,
            teamName: '',
            message: '对阵双方尚未确定（等待前序比赛结果），本场跳过',
            ok: false,
        });
        return false;
    }

    const home = record.teams.find(t => t.id === homeId);
    const away = record.teams.find(t => t.id === awayId);
    if (!home || !away) {
        addLog(opts, { matchId: match.id, roundName: round.name, teamName: '', message: '找不到对应队伍', ok: false });
        return false;
    }

    match.homeId = homeId;
    match.awayId = awayId;

    // AI 托管队伍：先规划引援与阵容
    await prepareTeam(state, home, away, record, opts);
    await prepareTeam(state, away, home, record, opts);

    const setup = readBattleSetup();
    const homeData = buildTeamBattleData(home, getLineup(state, home), 0, buildSoulIds(home));
    const awayData = buildTeamBattleData(away, getLineup(state, away), 1, buildSoulIds(away));
    if (!homeData.length || !awayData.length) {
        addLog(opts, {
            matchId: match.id,
            roundName: round.name,
            teamName: `${home.name} vs ${away.name}`,
            message: '可上场选手不足，无法模拟',
            ok: false,
        });
        return false;
    }

    const seed = Math.floor(Math.random() * 1000000000);
    const battle = await runHeadlessBattle(homeData.concat(awayData), seed, {
        energy: setup.energy,
        winCondition: setup.winCondition,
        teamSizes: setup.teamSizes,
    });

    const battleStats = buildBattleStats(battle);
    const winner = battle.winner;
    const winnerTeam = winner === 0 ? home : winner === 1 ? away : null;
    const loserTeam = winner === 0 ? away : winner === 1 ? home : null;

    const official = state.config.official !== false;
    const heroIds0 = battleStats[0].units.map((u: any) => String(u.no));
    const heroIds1 = battleStats[1].units.map((u: any) => String(u.no));

    // 与 BattleStats.calculateRollbackData 同口径
    const totalValue = heroIds0
        .concat(heroIds1)
        .reduce((sum: number, id: string) => {
            const h = getHeroById(id);
            return sum + getRankValue(h ? h.rank : 'N');
        }, 0);
    let winnerJade = Math.round(totalValue / 12);
    let loserJade = Math.round(totalValue / 10);
    if (official) {
        winnerJade *= 2;
        loserJade *= 2;
    }

    const expChanges: { team: RecordTeam; heroId: string; gain: number }[] = [];
    const pushExp = (team: RecordTeam, ids: string[]) => {
        ids.forEach(id => {
            const cur = Number((team.heroExps || {})[id]) || 0;
            const gain = official ? 1 : cur === 0 ? 1 : 0;
            if (gain > 0) expChanges.push({ team, heroId: id, gain });
        });
    };
    pushExp(home, heroIds0);
    pushExp(away, heroIds1);

    // 更新战绩
    const fresh = readRecordData();
    const hTeam = fresh.teams.find(t => t.id === homeId);
    const aTeam = fresh.teams.find(t => t.id === awayId);
    if (hTeam && aTeam && winnerTeam && loserTeam) {
        const w = winnerTeam.id === homeId ? hTeam : aTeam;
        const l = winnerTeam.id === homeId ? aTeam : hTeam;
        if (official) {
            w.wins = (w.wins || 0) + 1;
            l.losses = (l.losses || 0) + 1;
        } else {
            w.score = (w.score || 0) + 1;
        }
        w.jade = (w.jade || 0) + winnerJade;
        l.jade = (l.jade || 0) + loserJade;
        expChanges.forEach(change => {
            const target = change.team.id === homeId ? hTeam : aTeam;
            if (!target.heroExps) target.heroExps = {};
            target.heroExps[change.heroId] = (Number(target.heroExps[change.heroId]) || 0) + change.gain;
        });

        const team0Stats = battleStats[0].units.map((u: any) => ({
            name: u.name,
            damage: u.totalDamage,
            damageTaken: u.damageTaken,
            energyUsed: u.energyUsed,
            healing: u.totalHeal,
        }));
        const team1Stats = battleStats[1].units.map((u: any) => ({
            name: u.name,
            damage: u.totalDamage,
            damageTaken: u.damageTaken,
            energyUsed: u.energyUsed,
            healing: u.totalHeal,
        }));
        const heroStatsChanges = updateHeroWinRateStats(
            battleStats,
            winnerTeam.name,
            loserTeam.name,
            home.name,
            away.name,
            team0Stats,
            team1Stats,
        );

        const matchRecord = {
            id: uid(),
            team0Name: home.name,
            team1Name: away.name,
            isOfficial: official,
            winnerName: winnerTeam.name,
            loserName: loserTeam.name,
            seed: String(seed),
            recordedAt: new Date().toISOString(),
            source: 'league',
            roundName: round.name,
            battleLogs: (battle.eventLogs || []).slice(-200),
            battleStats,
            heroStatsChanges,
            rollbackData: {
                winnerChanges: { wins: official ? 1 : 0, score: official ? 0 : 1, jade: winnerJade },
                loserChanges: { losses: official ? 1 : 0, jade: loserJade },
                heroExpChanges: expChanges.map(c => ({
                    teamName: c.team.id === homeId ? home.name : away.name,
                    heroId: c.heroId,
                    expGain: c.gain,
                })),
            },
        };
        if (!fresh.matchRecords) fresh.matchRecords = [];
        fresh.matchRecords.unshift(matchRecord);
        writeRecordData(fresh);
    }

    match.status = 'settled';
    match.winnerId = winnerTeam ? winnerTeam.id : null;
    match.seed = String(seed);
    match.settledAt = new Date().toISOString();
    match.result = {
        jadeHome: (winner === 0 ? winnerJade : loserJade),
        jadeAway: (winner === 1 ? winnerJade : loserJade),
        source: 'auto',
    };

    addLog(opts, {
        matchId: match.id,
        roundName: round.name,
        teamName: `${home.name} vs ${away.name}`,
        message: winnerTeam
            ? `已结算：${winnerTeam.name} 获胜（+${winnerJade} 勾玉 / 对手 +${loserJade}）`
            : '已结算：未分出胜负（平局）',
        ok: true,
    });
    return true;
}

/** 扫描并结算所有到期的比赛（串行执行，避免同时开多场卡 UI） */
export async function settleDueMatches(state: ScheduleState, opts: SettleOptions = {}): Promise<number> {
    const now = Date.now();
    let settled = 0;
    for (const round of state.rounds) {
        if (!round.deadline) continue;
        if (new Date(round.deadline).getTime() > now) continue;
        for (const match of round.matches) {
            if (match.status !== 'pending') continue;
            if (opts.onlyMatchIds && opts.onlyMatchIds.indexOf(match.id) === -1) continue;
            const ok = await settleMatch(state, round, match, opts);
            if (ok) settled++;
        }
    }
    if (settled > 0) saveSchedule(state);
    return settled;
}

/** 某支队伍的完整赛程 */
export function getTeamSchedule(state: ScheduleState, teamId: string) {
    const list: { round: ScheduleRound; match: ScheduleMatch; opponentId: string | null; isHome: boolean }[] = [];
    state.rounds.forEach(round => {
        round.matches.forEach(match => {
            if (match.homeId === teamId || match.awayId === teamId) {
                const isHome = match.homeId === teamId;
                list.push({
                    round,
                    match,
                    opponentId: isHome ? match.awayId || null : match.homeId || null,
                    isHome,
                });
            }
        });
    });
    return list;
}
