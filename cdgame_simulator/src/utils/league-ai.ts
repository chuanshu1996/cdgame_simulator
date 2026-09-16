// 队伍 AI 托管：调用智谱免费模型 GLM-4.7-Flash 规划「本轮引援 + 出战阵容」
//
// 设计要点：
// - 任何调用/解析失败都回退到本地贪心策略，保证到点自动结算不被阻塞；
// - 模型只允许输出严格 JSON，解析后做白名单校验与预算裁剪；
// - API 地址可改（默认 BigModel 官方，可填本地代理规避 CORS）。

import {
    GLM_TIMEOUT_MS,
    GLM_DEFAULT_BASE_URL,
    GLM_DEFAULT_MODEL,
    LINEUP_SIZE,
    POSITION_LABELS,
    OFFICIAL_EXP_THRESHOLD,
} from '../config/league';

export interface AiConfigLike {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    priceFactor?: number;
    priceOverrides?: Record<string, number>;
}

export interface AiTeamLike {
    id: string;
    name: string;
    jade?: number;
    wins?: number;
    losses?: number;
    score?: number;
    heroExps?: Record<string, number>;
    drawnHeroIds?: string[];
    souls?: { id: string; name: string; count: number }[];
}

export interface AiCandidate {
    id: string;
    name: string;
    rank: string;
    point: number;
    atk: number;
    hp: number;
    def: number;
    spd: number;
    price: number;
}

export interface AiOwnedHero {
    id: string;
    name: string;
    rank: string;
    exp: number;
    point: number;
}

export interface AiPlanPayload {
    ai: AiConfigLike;
    team: AiTeamLike;
    opponent: AiTeamLike;
    candidates: AiCandidate[];
    owned: AiOwnedHero[];
    currentLineup: (string | null)[];
    standings: { name: string; wins: number; losses: number; score: number; jade: number }[];
}

export interface AiPlan {
    signings: { heroId: string; reason?: string }[];
    lineup: string[];
    note?: string;
    fallback?: boolean;
}

const SYSTEM_PROMPT = [
    '你是一款阴阳师题材卡牌对战游戏的战队教练 AI。',
    '目标：在给定勾玉预算内，为本轮比赛决定「引入哪些选手」与「8 个出战位置怎么排」。',
    '规则：',
    '1. 引入选手需支付勾玉（price 字段），总花费不得超过队伍当前勾玉；',
    '2. 出战阵容共 8 个位置，依次为 教练/先锋/次锋/中坚/副将/大将/替补/应援，前 6 位是主力，替补与应援不上场但可触发被动；',
    '3. 只能使用我方已拥有（owned）或本次引入（signings）的选手，不得使用其他选手；',
    '4. 主力优先放战力（point）与速度更高的选手，替补/应援放功能型或战力较低的选手；',
    '5. 结合对手阵容的强弱权衡：对手爆发高则补生存/控制，对手偏慢则可抢速。',
    '只输出一个 JSON 对象，不要输出解释性文字，格式：',
    '{"signings":[{"heroId":"编号","reason":"一句话理由"}],"lineup":["编号",...共8项],"note":"整体思路一句话"}',
].join('\n');

function compactHeroList(list: AiCandidate[], limit: number) {
    return list
        .slice()
        .sort((a, b) => b.point - a.point)
        .slice(0, limit)
        .map(h => ({ id: h.id, name: h.name, rank: h.rank, point: h.point, atk: h.atk, hp: h.hp, spd: h.spd, price: h.price }));
}

function buildUserPrompt(payload: AiPlanPayload): string {
    const { team, opponent, candidates, owned, currentLineup, standings } = payload;
    const ctx = {
        positions: POSITION_LABELS,
        myTeam: {
            name: team.name,
            jade: team.jade || 0,
            record: { wins: team.wins || 0, losses: team.losses || 0, score: team.score || 0 },
            owned: owned.sort((a, b) => b.point - a.point),
            currentLineup,
        },
        opponent: {
            name: opponent.name,
            record: { wins: opponent.wins || 0, losses: opponent.losses || 0, score: opponent.score || 0 },
            lineup: (opponent as any).__lineup || undefined,
            keyHeroes: Object.keys(opponent.heroExps || {})
                .filter(id => (Number((opponent.heroExps || {})[id]) || 0) >= OFFICIAL_EXP_THRESHOLD)
                .slice(0, 24),
        },
        signableCandidates: compactHeroList(candidates, 80),
        standings: standings.slice(0, 12),
    };
    return '下面是本轮决策所需的全部信息（JSON）：\n' + JSON.stringify(ctx);
}

function extractJson(text: string): any | null {
    if (!text) return null;
    let cleaned = text.trim();
    // 去掉 ```json ... ``` 代码块
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) cleaned = fence[1].trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    try {
        return JSON.parse(cleaned.slice(start, end + 1));
    } catch (e) {
        return null;
    }
}

/** 本地贪心回退：按 战力/价格 性价比买入，再按战力排出 8 人 */
export function buildFallbackPlan(payload: AiPlanPayload): AiPlan {
    const { team, candidates, owned } = payload;
    let budget = Number(team.jade) || 0;
    const signings: { heroId: string; reason?: string }[] = [];

    const affordable = candidates
        .slice()
        .filter(c => c.price <= budget)
        .sort((a, b) => b.point / Math.max(1, b.price) - a.point / Math.max(1, a.price));

    const maxSign = 3;
    for (const c of affordable) {
        if (signings.length >= maxSign) break;
        if (c.price > budget) continue;
        budget -= c.price;
        signings.push({ heroId: c.id, reason: `性价比补强（战力 ${c.point} / 身价 ${c.price}）` });
    }

    const pool = owned.slice();
    signings.forEach(s => {
        const c = candidates.find(x => x.id === s.heroId);
        if (c && pool.findIndex(p => p.id === c.id) === -1) {
            pool.push({ id: c.id, name: c.name, rank: c.rank, exp: OFFICIAL_EXP_THRESHOLD, point: c.point });
        }
    });
    pool.sort((a, b) => b.point - a.point);

    const lineup: string[] = [];
    for (let i = 0; i < LINEUP_SIZE; i++) lineup.push(pool[i] ? pool[i].id : '');

    return {
        signings,
        lineup,
        note: budget === (team.jade || 0) ? '预算不足，仅按现有战力排阵' : '按性价比补强后排出主力阵容',
        fallback: true,
    };
}

function sanitizePlan(raw: any, payload: AiPlanPayload): AiPlan {
    const ownedIds = new Set(payload.owned.map(h => h.id));
    const candidateMap = new Map(payload.candidates.map(c => [c.id, c]));
    let budget = Number(payload.team.jade) || 0;

    const signings: { heroId: string; reason?: string }[] = [];
    const rawSignings = Array.isArray(raw.signings) ? raw.signings : [];
    for (const s of rawSignings) {
        const heroId = String((s && (s.heroId || s.id)) || '');
        if (!heroId) continue;
        const c = candidateMap.get(heroId);
        if (!c) continue; // 不在可引援名单内（可能已拥有或不存在）
        if (ownedIds.has(heroId)) continue;
        if (c.price > budget) continue; // 预算不足则跳过
        budget -= c.price;
        ownedIds.add(heroId);
        signings.push({ heroId, reason: s && s.reason ? String(s.reason) : '' });
    }

    const lineup: string[] = [];
    const rawLineup = Array.isArray(raw.lineup) ? raw.lineup : [];
    const used = new Set<string>();
    for (let i = 0; i < LINEUP_SIZE; i++) {
        const id = String(rawLineup[i] || '');
        if (id && ownedIds.has(id) && !used.has(id)) {
            lineup.push(id);
            used.add(id);
        } else {
            lineup.push('');
        }
    }

    // 空缺位置用池里剩余战力最高的补齐
    const pool = payload.owned
        .slice()
        .sort((a, b) => b.point - a.point)
        .map(h => h.id)
        .concat(signings.map(s => s.heroId));
    for (let i = 0; i < LINEUP_SIZE; i++) {
        if (lineup[i]) continue;
        const next = pool.find(id => !used.has(id));
        if (next) {
            lineup[i] = next;
            used.add(next);
        }
    }

    return {
        signings,
        lineup,
        note: raw && raw.note ? String(raw.note) : '',
        fallback: false,
    };
}

async function chat(ai: AiConfigLike, messages: { role: string; content: string }[]): Promise<string> {
    const base = (ai.baseUrl || GLM_DEFAULT_BASE_URL).replace(/\/+$/, '');
    const url = base + '/chat/completions';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GLM_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${ai.apiKey || ''}`,
            },
            body: JSON.stringify({
                model: ai.model || GLM_DEFAULT_MODEL,
                messages,
                temperature: 0.3,
                max_tokens: 2048,
            }),
            signal: controller.signal,
        });
        if (!res.ok) {
            const raw = await res.text();
            throw new Error(`HTTP ${res.status} ${raw.slice(0, 120)}`);
        }
        const json = await res.json();
        const content = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
        if (typeof content !== 'string') throw new Error('返回内容为空');
        return content;
    } finally {
        clearTimeout(timer);
    }
}

/** 生成本轮方案；失败自动回退本地策略 */
export async function planTeamForRound(payload: AiPlanPayload): Promise<AiPlan> {
    const ai = payload.ai || {};
    if (!ai.apiKey) {
        const plan = buildFallbackPlan(payload);
        plan.note = '未配置 API Key，已使用本地策略';
        return plan;
    }
    try {
        const content = await chat(ai, [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(payload) },
        ]);
        const raw = extractJson(content);
        if (!raw) throw new Error('模型未返回可解析的 JSON');
        return sanitizePlan(raw, payload);
    } catch (e) {
        const err: any = e;
        const plan = buildFallbackPlan(payload);
        plan.note = `${plan.note || ''}（AI 调用失败：${err && err.message ? err.message : '未知错误'}）`;
        return plan;
    }
}

/** 设置页连通性测试 */
export async function testAiConnection(ai: AiConfigLike): Promise<string> {
    if (!ai.apiKey) throw new Error('请先填写 API Key');
    const content = await chat(ai, [{ role: 'user', content: '只回复两个字：可用' }]);
    return (content || '').trim().slice(0, 100) || '已连通（无返回内容）';
}
