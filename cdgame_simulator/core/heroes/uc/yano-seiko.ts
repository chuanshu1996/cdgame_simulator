import {
    Attack,
    BattleProperties,
    Buff,
    BuffParams,
    Battle,
    EffectTypes,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
} from '../../';
import {SkillTarget} from '../../skill';

// 副露状态：非 buff / 非 debuff，用自定义数据存储层数
const FURUO_STACKS_KEY = 'furuo_stacks';
const FURUO_BUFF_NAME = '副露';
const FURUO_IMMUNE_BUFF_NAME = '副露·免控';
const FURUO_MAX_STACKS = 4;
const FURUO_IMMUNE_STACKS = 3;

// 副露属性：每层防御下降20%、速度上升10%
const FURUO_DEF_RATE_PER_STACK = -0.2;
const FURUO_SPD_RATE_PER_STACK = 0.1;

// 获取副露层数
function getFuruoStacks(entity: any): number {
    return parseInt(entity.getBattleData(FURUO_STACKS_KEY) || '0', 10);
}

// 设置副露层数
function setFuruoStacks(entity: any, stacks: number) {
    entity.setData(FURUO_STACKS_KEY, String(stacks));
}

// 构建副露属性buff：随层数刷新防御/速度（中性，不标记 buff/debuff）
function buildFuruoBuff(sourceId: number, targetId: number, stacks: number): Buff {
    const buff = Buff.build(sourceId, targetId)
        .name(FURUO_BUFF_NAME, stacks)
        .countDown(-1)
        .noRemove()
        .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, FURUO_DEF_RATE_PER_STACK * stacks)
        .buffAP(BattleProperties.SPD, EffectTypes.ADD_RATE, FURUO_SPD_RATE_PER_STACK * stacks)
        .end();
    // 副露不视为buff也不视为debuff：移除buff/debuff标记，仅保留属性影响
    buff.params = buff.params.filter(
        (p: string) => p !== BuffParams.BUFF && p !== BuffParams.DEBUFF
    );
    return buff;
}

// 刷新自身的副露状态（层数变化后重建属性buff，并在达到免控层数时附加免控buff）
function refreshFuruo(battle: Battle, sourceId: number, stacks: number) {
    const source = battle.getEntity(sourceId);
    if (!source) return;

    setFuruoStacks(source, stacks);

    // 移除旧副露属性buff并重建
    const oldBuffs = battle.filterBuffByName(sourceId, FURUO_BUFF_NAME);
    for (const oldBuff of oldBuffs) {
        battle.actionRemoveBuff(oldBuff, Reasons.SKILL);
    }
    const buff = buildFuruoBuff(sourceId, sourceId, stacks);
    battle.actionAddBuff(buff, Reasons.SKILL);

    // 达到3层附加免控buff（免疫控制）
    const immuneBuffs = battle.filterBuffByName(sourceId, FURUO_IMMUNE_BUFF_NAME);
    if (stacks >= FURUO_IMMUNE_STACKS) {
        if (immuneBuffs.length === 0) {
            const immuneBuff = Buff.build(sourceId, sourceId)
                .name(FURUO_IMMUNE_BUFF_NAME, 1)
                .countDown(-1)
                .noRemove()
                .ruleControlImmune()
                .end();
            battle.actionAddBuff(immuneBuff, Reasons.SKILL);
        }
    } else {
        // 层数不足时移除免控buff
        for (const immuneBuff of immuneBuffs) {
            battle.actionRemoveBuff(immuneBuff, Reasons.SKILL);
        }
    }
}

// 清除所有副露（层数归零、移除属性buff与免控buff）
function clearFuruo(battle: Battle, sourceId: number) {
    const source = battle.getEntity(sourceId);
    if (!source) return;

    setFuruoStacks(source, 0);
    const furuoBuffs = battle.filterBuffByName(sourceId, FURUO_BUFF_NAME);
    for (const b of furuoBuffs) {
        battle.actionRemoveBuff(b, Reasons.SKILL);
    }
    const immuneBuffs = battle.filterBuffByName(sourceId, FURUO_IMMUNE_BUFF_NAME);
    for (const b of immuneBuffs) {
        battle.actionRemoveBuff(b, Reasons.SKILL);
    }
}

// 获取敌方随机两位目标（排除指定目标）
function getRandomOtherEnemies(battle: Battle, sourceTeamId: number, excludeId: number): number[] {
    const enemyTeamId = 1 - sourceTeamId;
    const enemies = battle.getTeamEntities(enemyTeamId).filter(e => !e.dead && e.entityId !== excludeId);
    // 简单洗牌取前两位
    for (let i = enemies.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [enemies[i], enemies[j]] = [enemies[j], enemies[i]];
    }
    return enemies.slice(0, 2).map(e => e.entityId);
}

// 技能1核心逻辑：碰碰碰
function usePengPengPeng(battle: Battle, sourceId: number, selectedId: number) {
    const source = battle.getEntity(sourceId);
    if (!source) return;

    // 3次攻击
    const attacks = [];
    for (let i = 0; i < 3; i++) {
        attacks.push(
            Attack.build(selectedId, sourceId)
                .rate(0.33)
                .shouldComputeCri()
                .single()
                .skill('碰碰碰')
                .end()
        );
    }
    battle.actionAttack(attacks);

    // 自身行动条增加50%
    battle.actionUpdateRunwayPercent(sourceId, sourceId, 0.5, Reasons.SKILL);

    // 增加1层副露（最多4层）
    let stacks = getFuruoStacks(source);
    if (stacks < FURUO_MAX_STACKS) {
        stacks += 1;
        refreshFuruo(battle, sourceId, stacks);
        battle.log(`【${source.name}】获得1层【副露】（第${stacks}层，防御-20%、速度+10%）`);
    } else {
        battle.log(`【${source.name}】的【副露】已达到最大叠加层数（${FURUO_MAX_STACKS}层）`);
    }
}

/**
 * 技能1：碰碰碰
 * 0火，主动技能
 * 对单体目标造成3次攻击力33%的伤害，自身行动条增加50%，并增加1层【副露】状态。
 * 副露：不视为buff或者debuff，防御力下降20%、速度上升10%，最多可叠加四层，持续到结束。
 */
export const yano_seiko_skill1: Skill = {
    no: 1,
    name: '碰碰碰',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对单体目标造成3次攻击力33%的伤害，自身行动条增加50%，并获得1层【副露】。副露：不视为buff或debuff，防御力下降20%、速度上升10%，最多叠加4层，持续到战斗结束。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        usePengPengPeng(battle, sourceId, selectedId);
    },
};

/**
 * 技能2：溅射水滴
 * 被动技能
 * 当双方有选手行动完毕后，20%几率（每有1层副露降低5%）立刻对其使用一次1技能碰碰碰，
 * 并对随机其他两位敌方目标造成100点溅射伤害。
 * 拥有3层【副露】状态后免疫控制。
 */
export const yano_seiko_skill2: Skill = {
    no: 2,
    name: '溅射水滴',
    passive: true,
    cost: 0,
    reserveValid: true,
    text: '被动技能。每当有选手行动完毕后，有20%基础概率（每有1层【副露】降低5%）立刻对其使用一次【碰碰碰】，并对随机其他两位敌方目标造成100点溅射伤害。拥有3层及以上【副露】时免疫控制。',
    handlers: [
        {
            // 每当有选手行动完毕，尝试触发追击
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const owner = battle.getEntity(data.skillOwnerId);
                if (!owner || owner.dead) return -1;

                // 行动完毕的选手
                const actorId = data.eventId;
                if (!actorId) return -1;
                const actor = battle.getEntity(actorId);
                if (!actor || actor.dead) return -1;

                // 触发概率：20% - 副露层数×5%，下限0
                const stacks = getFuruoStacks(owner);
                const chance = Math.max(0, 0.2 - stacks * 0.05);
                if (Math.random() > chance) return -1;

                battle.log(`【${owner.name}】触发【溅射水滴】，对【${actor.name}】使用【碰碰碰】`);
                // 对行动完毕的选手使用1技能碰碰碰
                usePengPengPeng(battle, data.skillOwnerId, actorId);

                // 对随机其他两位敌方目标造成100点溅射伤害
                const splashTargets = getRandomOtherEnemies(battle, owner.teamId, actorId);
                const splashAttacks = splashTargets.map(tId =>
                    Attack.build(tId, data.skillOwnerId)
                        .base(() => 100)
                        .rate(1)
                        .real()
                        .single()
                        .skill('溅射水滴')
                        .end()
                );
                if (splashAttacks.length > 0) {
                    battle.actionAttack(splashAttacks);
                    battle.log(`【${owner.name}】的【溅射水滴】对${splashAttacks.length}位敌方目标造成100点溅射伤害`);
                }

                return -1;
            },
            code: EventCodes.ACTION_END,
            range: EventRange.TEAM,
            priority: 50,
            passive: true,
            name: '溅射水滴',
        },
    ],
};

/**
 * 技能3：钓鱼自摸
 * 3火，主动技能
 * 对敌方全体目标造成一次攻击力133%的伤害，每有1层副露额外增加33%伤害，伤害完成后清除所有副露。
 */
export const yano_seiko_skill3: Skill = {
    no: 3,
    name: '钓鱼自摸',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '对敌方全体造成攻击力133%的伤害，每有1层【副露】额外增加33%伤害，伤害完成后清除所有【副露】。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        const stacks = getFuruoStacks(source);
        const rate = 1.33 + stacks * 0.33;

        const enemies = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
        const attackInfos = enemies.map(enemy =>
            Attack.build(enemy.entityId, sourceId)
                .rate(rate)
                .shouldComputeCri()
                .group()
                .skill('钓鱼自摸')
                .end()
        );
        battle.actionAttack(attackInfos);

        battle.log(`【${source.name}】使用【钓鱼自摸】，造成攻击力${(rate * 100).toFixed(0)}%伤害（副露${stacks}层），随后清除所有【副露】`);

        // 清除所有副露
        clearFuruo(battle, sourceId);
    },
};
