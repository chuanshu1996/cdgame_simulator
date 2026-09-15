/**
 * 技能效果标签体系
 *
 * 用于「选手列表」页面的技能组效果筛选。
 *
 * 设计原则（方案丙）：以阴阳师完整机制体系为骨架分类，但页面上**只渲染有关键词命中的标签**，
 * 因为本项目的技能尚未全部实现，若照搬整套体系会出现大量永远筛不到人的死标签。
 *
 * 打标方式：自动推导 —— 扫描英雄所有技能的 text 描述，按 KEYWORD_RULES 命中关键词即打标。
 * 推导结果在构建期算好（Hero.vue data() 中执行一次），不进入战斗热路径。
 */

/** 标签大类 */
export type TagCategory =
    | '伤害'
    | '控制'
    | '生存'
    | '增益'
    | '减益'
    | '行动条'
    | '能量'
    | '机制'
    | '无视';

export interface SkillTagDef {
    /** 筛选框上显示的名字，唯一键 */
    name: string;
    /** 所属大类（筛选框按大类分组） */
    category: TagCategory;
    /** 自动推导关键词；命中任意一个即打标 */
    keywords: string[];
    /** 悬停解释 */
    description: string;
}

/** 大类展示顺序与配色 */
export const CATEGORY_ORDER: TagCategory[] = [
    '伤害',
    '控制',
    '生存',
    '增益',
    '减益',
    '行动条',
    '能量',
    '机制',
    '无视',
];

export const CATEGORY_COLORS: Record<TagCategory, string> = {
    伤害: 'red',
    控制: 'purple',
    生存: 'green',
    增益: 'blue',
    减益: 'orange',
    行动条: 'cyan',
    能量: 'gold',
    机制: 'geekblue',
    无视: 'magenta',
};

/**
 * 标签定义表
 *
 * keywords 均为在 `core/heroes/**` 技能描述中实测出现过的用词，
 * 避免出现「永远筛不到人」的死标签。
 */
export const SKILL_TAGS: SkillTagDef[] = [
    // ==================== 伤害 ====================
    {
        name: '单体',
        category: '伤害',
        keywords: ['单体'],
        description: '除普攻以外，具有造成单体伤害的技能',
    },
    {
        name: '全体',
        category: '伤害',
        keywords: ['全体', '群体'],
        description: '除普攻以外，具有造成全体伤害的技能',
    },
    {
        name: '真实伤害',
        category: '伤害',
        keywords: ['真实伤害'],
        description: '不暴击、无视防御的伤害类型',
    },
    {
        name: '间接伤害',
        category: '伤害',
        keywords: ['间接伤害'],
        description: '正常计算防御（防御越高伤害越低），0 防必暴击（无视自身暴击率），不触发攻击方与受击方宝物，且无法被分摊的伤害',
    },
    {
        name: '溢出伤害',
        category: '伤害',
        keywords: ['溢出伤害'],
        description: '击杀目标后，超出目标剩余生命的伤害会作用于其他目标',
    },
    {
        name: '多段伤害',
        category: '伤害',
        keywords: ['多段', '段伤害'],
        description: '对同一目标或多次造成多段伤害',
    },
    {
        name: '随机目标',
        category: '伤害',
        keywords: ['随机'],
        description: '伪群攻：虽为单体伤害，但能够随机打多个目标',
    },
    {
        name: '吸血',
        category: '伤害',
        keywords: ['吸血'],
        description: '攻击时根据造成的伤害量恢复自身生命',
    },
    {
        name: '无视防御',
        category: '伤害',
        keywords: ['无视防御', '忽略防御', '无视部分防御', '无视目标100点防御力', '无视目标防御'],
        description: '技能描述中明确该伤害忽略/无视一定数值或百分比的防御',
    },
    {
        name: '穿透',
        category: '伤害',
        keywords: ['穿透', '无视护盾', '穿盾'],
        description: '具有穿盾能力，可无视目标的护盾',
    },

    // ==================== 控制 ====================
    {
        name: '眩晕',
        category: '控制',
        keywords: ['眩晕'],
        description: '无法行动',
    },
    {
        name: '睡眠',
        category: '控制',
        keywords: ['睡眠'],
        description: '无法行动，受击后解除',
    },
    {
        name: '冰冻',
        category: '控制',
        keywords: ['冰冻'],
        description: '无法行动',
    },
    {
        name: '变形',
        category: '控制',
        keywords: ['变形'],
        description: '无法行动',
    },
    {
        name: '混乱',
        category: '控制',
        keywords: ['混乱'],
        description: '随机攻击任意目标（包括队友）',
    },
    {
        name: '沉默',
        category: '控制',
        keywords: ['沉默'],
        description: '无法使用技能',
    },
    {
        name: '嘲讽',
        category: '控制',
        keywords: ['嘲讽'],
        description: '强制攻击嘲讽来源',
    },
    {
        name: '挑衅',
        category: '控制',
        keywords: ['挑衅', '挑衅'],
        description: '强制目标攻击挑衅来源',
    },
    {
        name: '禁锢',
        category: '控制',
        keywords: ['禁锢'],
        description: '无法被位移',
    },
    {
        name: '害怕',
        category: '控制',
        keywords: ['害怕'],
        description: '每回合有概率因恐惧而无法进行攻击与造成伤害',
    },
    {
        name: '封印宝物',
        category: '控制',
        keywords: ['宝物压制', '封印宝物', '装备封印'],
        description: '目标宝物效果失效',
    },
    {
        name: '封印被动',
        category: '控制',
        keywords: ['被动封印', '封印被动'],
        description: '目标被动技能失效',
    },

    // ==================== 生存 ====================
    {
        name: '治疗',
        category: '生存',
        keywords: ['治疗', '恢复生命', '回复生命'],
        description: '能够进行主动治疗、恢复生命的技能',
    },
    {
        name: '护盾',
        category: '生存',
        keywords: ['护盾', '屏障'],
        description: '能够吸收伤害的护盾/屏障',
    },
    {
        name: '复活',
        category: '生存',
        keywords: ['复活'],
        description: '能够使阵亡单位复活',
    },
    {
        name: '减伤',
        category: '生存',
        keywords: ['减伤', '免伤', '降低受到的伤害'],
        description: '受到伤害/攻击时能够减免、降低伤害',
    },
    {
        name: '免疫',
        category: '生存',
        keywords: ['免疫'],
        description: '免疫控制或减益效果',
    },

    // ==================== 增益 ====================
    {
        name: '增伤',
        category: '增益',
        keywords: ['增伤', '提高伤害', '伤害提升'],
        description: '造成的伤害增加',
    },
    {
        name: '加攻',
        category: '增益',
        keywords: ['增加攻击', '攻击力提升', '提升攻击', '攻击提升'],
        description: '提升攻击力属性',
    },
    {
        name: '加防',
        category: '增益',
        keywords: ['增加防御', '防御提升', '提升防御', '防御增加'],
        description: '提升防御属性',
    },
    {
        name: '加速',
        category: '增益',
        keywords: ['加速', '速度提升', '提升速度', '增加速度'],
        description: '提升速度属性',
    },
    {
        name: '暴击提升',
        category: '增益',
        keywords: ['暴击提升', '提升暴击', '增加暴击'],
        description: '提升暴击或暴击伤害属性',
    },
    {
        name: '命中提升',
        category: '增益',
        keywords: ['效果命中提升', '提升效果命中', '命中提升'],
        description: '提升效果命中属性',
    },

    // ==================== 减益 ====================
    {
        name: '减疗',
        category: '减益',
        keywords: ['降低70%治疗', '降低治疗效果', '降低治疗', '减疗', '治疗效果降低'],
        description: '降低目标受到的治疗效果',
    },
    {
        name: '减速',
        category: '减益',
        keywords: ['减速', '缓速', '速度降低', '降低速度'],
        description: '降低目标速度属性',
    },
    {
        name: '减攻',
        category: '减益',
        keywords: ['攻击力降低', '降低攻击力', '降低攻击', '攻击降低', '削弱攻击'],
        description: '降低目标攻击力属性',
    },
    {
        name: '减防',
        category: '减益',
        keywords: ['防御力降低', '降低防御力', '降低防御', '防御降低', '破防'],
        description: '降低目标防御属性',
    },
    {
        name: '易伤',
        category: '减益',
        keywords: ['易伤', '承受伤害提升', '受到伤害提升', '承伤增加'],
        description: '目标承受的伤害提升',
    },
    {
        name: '降抵抗',
        category: '减益',
        keywords: ['效果抵抗降低', '降低抵抗', '抵抗降低', '抵抗降低'],
        description: '降低目标效果抵抗属性',
    },

    // ==================== 行动条 ====================
    {
        name: '拉条',
        category: '行动条',
        keywords: ['%行动条进度', '行动条进度', '增加行动条', '提升行动条', '拉条'],
        description: '提升友方行动条进度',
    },
    {
        name: '推条',
        category: '行动条',
        keywords: ['降低目标10%行动条', '降低目标20%行动条', '降低目标行动条', '击退行动条', '推条'],
        description: '降低敌方行动条进度',
    },

    // ==================== 能量 ====================
    {
        name: '能量回复',
        category: '能量',
        keywords: ['获得能量', '回复能量', '返还能量', '增加能量', '恢复能量', '不消耗能量', '获得1点能量', '获得2点能量'],
        description: '获得、恢复能量，或使技能不消耗能量',
    },
    {
        name: '能量干扰',
        category: '能量',
        keywords: ['减少能量', '扣除能量', '降低能量', '消耗能量增加', '抵扣能量'],
        description: '削减敌方能量、影响能量消耗',
    },

    // ==================== 机制 ====================
    {
        name: '先机',
        category: '机制',
        keywords: ['先机'],
        description: '【先机】战斗开始时立即生效的被动效果',
    },
    {
        name: '被动',
        category: '机制',
        keywords: ['被动'],
        description: '存在被动技能',
    },
    {
        name: '召唤',
        category: '机制',
        keywords: ['召唤'],
        description: '驻场召唤物，视为友方单位；召唤物之间的存在是互斥的',
    },
    {
        name: '结界',
        category: '机制',
        keywords: ['结界'],
        description: '开启的一种场地效果，通常有持续/维持回合',
    },
    {
        name: '幻境',
        category: '机制',
        keywords: ['幻境'],
        description: '幻境类场地效果，效果持续时间内可维持独有的增益效果',
    },
    {
        name: '形态',
        category: '机制',
        keywords: ['形态', '变身'],
        description: '具有多个阶段或形态，满足条件后进入或自行切换',
    },
    {
        name: '驱散',
        category: '机制',
        keywords: ['驱散'],
        description: '驱散目标身上的增益或减益效果',
    },
    {
        name: '解除',
        category: '机制',
        keywords: ['解除'],
        description: '解除目标身上的控制或负面状态',
    },
    {
        name: '反击',
        category: '机制',
        keywords: ['反击'],
        description: '满足一定条件后进行反击',
    },
    {
        name: '限定技',
        category: '机制',
        keywords: ['限定技'],
        description: '【限定技】整场战斗仅限使用一次',
    },
    {
        name: '部长技',
        category: '机制',
        keywords: ['部长技'],
        description: '【部长技】具有特殊条件的技能',
    },
    {
        name: '孤立',
        category: '机制',
        keywords: ['孤立'],
        description: '具有孤立能力，或造成形同孤立的伤害',
    },
    {
        name: '分摊',
        category: '机制',
        keywords: ['分摊'],
        description: '能够为友方分摊伤害',
    },

    // ==================== 无视 ====================
    {
        name: '无视宝物',
        category: '无视',
        keywords: ['无视宝物'],
        description: '技能描述中明确该伤害无视宝物效果',
    },
    {
        name: '无视被动',
        category: '无视',
        keywords: ['无视被动'],
        description: '技能描述中明确该伤害无视被动效果',
    },
];

/** 标签名 -> 定义，便于查询 */
export const SKILL_TAG_MAP: Record<string, SkillTagDef> = SKILL_TAGS.reduce((acc, t) => {
    acc[t.name] = t;
    return acc;
}, {} as Record<string, SkillTagDef>);

/** 供筛选框使用的「大类 -> 标签」结构 */
export function groupTagsByCategory(tags: SkillTagDef[]): { category: TagCategory; tags: SkillTagDef[] }[] {
    return CATEGORY_ORDER
        .map(category => ({
            category,
            tags: tags.filter(t => t.category === category),
        }))
        .filter(g => g.tags.length > 0);
}

interface SkillLike {
    text?: string;
    passive?: boolean;
}

/**
 * 从一个英雄的全部技能推导命中的效果标签
 *
 * @param skills 英雄技能数组（只需 text / passive 字段）
 * @returns 去重后的标签名数组
 */
export function deriveSkillTags(skills: SkillLike[]): string[] {
    if (!skills || skills.length === 0) return [];

    const hit = new Set<string>();

    for (const skill of skills) {
        // 被动技能本身也算「被动」机制标签
        if (skill.passive) hit.add('被动');

        const text = skill.text || '';
        if (!text) continue;

        for (const def of SKILL_TAGS) {
            if (hit.has(def.name)) continue;
            if (def.keywords.some(k => text.includes(k))) {
                hit.add(def.name);
            }
        }
    }

    return Array.from(hit);
}

/**
 * 提取技能描述中的【专有名词】
 *
 * 这些是本项目自定义的 buff / 技能效果名（如【狂气】【害怕】【狐狩界】），
 * 共 60 余种，是最可靠的效果信号源。
 */
export function extractProperNouns(text: string): string[] {
    if (!text) return [];
    const out: string[] = [];
    const re = /【([^】]+)】/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const name = m[1].trim();
        if (name && !out.includes(name)) out.push(name);
    }
    return out;
}

/**
 * 将技能描述切分为可渲染片段：普通文本 / 专有名词 / 关键词
 *
 * 用于技能弹窗中把【专有名词】与命中关键词高亮显示（hover 出解释）。
 */
export interface TextSegment {
    text: string;
    /** proper = 【专有名词】，highlight = 命中的效果关键词，plain = 普通文本 */
    kind: 'plain' | 'proper' | 'highlight';
    /** hover 提示内容（词条解释），可能为空 */
    tip?: string;
}

/**
 * 判断某个标签关键词是否值得高亮
 * 排除过短或过于通用的词，避免满屏高亮
 */
const HIGHLIGHT_STOPWORDS = new Set([
    '被动', '先机', '形态', '随机', '眩晕', '治疗', '护盾', '免疫', '驱散', '解除',
    '分摊', '孤立', '召唤', '结界', '幻境', '反击', '吸血',
]);

/** 收集所有可用于高亮的关键词（去重、按长度倒序以便最长匹配优先） */
const ALL_TAG_KEYWORDS: { keyword: string; tag: string }[] = (() => {
    const list: { keyword: string; tag: string }[] = [];
    for (const def of SKILL_TAGS) {
        if (HIGHLIGHT_STOPWORDS.has(def.name)) continue;
        for (const k of def.keywords) {
            if (k.length >= 2) list.push({ keyword: k, tag: def.name });
        }
    }
    return list.sort((a, b) => b.keyword.length - a.keyword.length);
})();

/**
 * 按标签关键词切分普通文本
 *
 * 采用「最长匹配优先 + 从左到右」策略：每轮在所有关键词中找出现位置最靠前的一个，
 * 位置相同时取更长的关键词，避免短词把长词切断（如「行动条进度」被「行动条」截断）。
 */
function splitPlainByKeywords(
    text: string,
    lookup?: (name: string) => { description: string } | undefined
): TextSegment[] {
    const out: TextSegment[] = [];
    let rest = text;

    while (rest.length > 0) {
        let best: { index: number; keyword: string; tag: string } | null = null;

        for (const item of ALL_TAG_KEYWORDS) {
            const idx = rest.indexOf(item.keyword);
            if (idx === -1) continue;
            if (best === null || idx < best.index || (idx === best.index && item.keyword.length > best.keyword.length)) {
                best = { index: idx, keyword: item.keyword, tag: item.tag };
            }
        }

        if (best === null) {
            out.push({ text: rest, kind: 'plain' });
            break;
        }

        if (best.index > 0) {
            out.push({ text: rest.slice(0, best.index), kind: 'plain' });
        }

        const def = SKILL_TAG_MAP[best.tag];
        out.push({
            text: best.keyword,
            kind: 'highlight',
            tip: def ? def.description : undefined,
        });
        rest = rest.slice(best.index + best.keyword.length);
    }

    // 合并相邻的 plain 片段，减少 DOM 节点
    const merged: TextSegment[] = [];
    for (const seg of out) {
        const last = merged[merged.length - 1];
        if (last && last.kind === 'plain' && seg.kind === 'plain') {
            last.text += seg.text;
        } else {
            merged.push(seg);
        }
    }
    return merged;
}

/**
 * 将技能描述切分成可渲染片段
 *
 * 先用【】切分，保证专有名词整体优先；普通文本再按标签关键词切分。
 *
 * @param text 技能描述原文
 * @param lookup 词条解释查找函数（可传入 getBuffDescription 包装）
 */
export function splitSkillText(
    text: string,
    lookup?: (name: string) => { description: string } | undefined
): TextSegment[] {
    if (!text) return [];

    const segments: TextSegment[] = [];
    // 先用【】切分，保证专有名词整体优先
    const parts = text.split(/(【[^】]+】)/g).filter(p => p !== '');

    for (const part of parts) {
        const properMatch = /^【([^】]+)】$/.exec(part);
        if (properMatch) {
            const name = properMatch[1].trim();
            const info = lookup ? lookup(name) : undefined;
            segments.push({ text: name, kind: 'proper', tip: info ? info.description : undefined });
            continue;
        }

        // 普通文本：继续按标签关键词切分
        segments.push(...splitPlainByKeywords(part, lookup));
    }

    return segments;
}

/**
 * 统计全体英雄中每个标签的命中人数
 *
 * 用于「只渲染有数据的标签」——命中人数为 0 的标签不展示。
 *
 * @param heroes 英雄列表（含 skills 与推导出的 skillTags）
 */
export function countTagHits(heroes: { skillTags?: string[] }[]): Record<string, number> {
    const counter: Record<string, number> = {};
    for (const hero of heroes) {
        for (const tag of hero.skillTags || []) {
            counter[tag] = (counter[tag] || 0) + 1;
        }
    }
    return counter;
}
