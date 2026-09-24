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
    JudgeFlagManager,
} from '../../';
import {SkillTarget} from '../../skill';

const SEED_BUFF_NAME = '种子';
const SEED_STACKS_KEY = 'shibuya_seed_stacks';
const SEED_MAX_STACKS = 13;

// 获取种子层数
function getSeedStacks(entity: any): number {
    return parseInt(entity.getBattleData(SEED_STACKS_KEY) || '0', 10);
}
function setSeedStacks(entity: any, stacks: number) {
    entity.setData(SEED_STACKS_KEY, String(stacks));
}

// 判断当前裁判旗回合是否处于技能1可触发的区间（1~3 或 5~7）
function isSeedPhase(battle: Battle): boolean {
    const judgeFlag = JudgeFlagManager.getInstance().getJudgeFlag(battle);
    const n = judgeFlag.getStatus().judgeKingActionCount;
    return (n >= 1 && n <= 3) || (n >= 5 && n <= 7);
}

// 根据种子层数返回属性加成档位（速度点数 / 攻击加成比例）
function seedTier(stacks: number): { spdPoint: number; atkRate: number } {
    if (stacks >= 9) return { spdPoint: 50, atkRate: 0.5 };
    if (stacks >= 6) return { spdPoint: 30, atkRate: 0.3 };
    if (stacks >= 3) return { spdPoint: 10, atkRate: 0.1 };
    return { spdPoint: 0, atkRate: 0 };
}

// 刷新种子属性 buff（按当前层数阶梯）
function refreshSeedBuff(battle: Battle, sourceId: number) {
    const source = battle.getEntity(sourceId);
    if (!source) return;

    const stacks = getSeedStacks(source);
    const tier = seedTier(stacks);

    // 移除旧种子 buff
    const oldBuffs = battle.filterBuffByName(sourceId, SEED_BUFF_NAME);
    for (const b of oldBuffs) battle.actionRemoveBuff(b, Reasons.SKILL);

    if (tier.spdPoint > 0 || tier.atkRate > 0) {
        const builder = Buff.build(sourceId, sourceId)
            .name(SEED_BUFF_NAME, stacks)
            .countDown(-1)
            .noDispel()
            .noRemove()
            .buff();
        if (tier.spdPoint > 0) builder.buffAP(BattleProperties.SPD, EffectTypes.FIXED, tier.spdPoint);
        if (tier.atkRate > 0) builder.buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, tier.atkRate);
        battle.actionAddBuff(builder.end(), Reasons.SKILL);
    }
}

// 增加1层种子并刷新属性
function addSeed(battle: Battle, sourceId: number) {
    const source = battle.getEntity(sourceId);
    if (!source) return;
    let stacks = getSeedStacks(source);
    if (stacks >= SEED_MAX_STACKS) {
        battle.log(`【${source.name}】的【种子】已达上限${SEED_MAX_STACKS}层`);
        return;
    }
    stacks += 1;
    setSeedStacks(source, stacks);
    refreshSeedBuff(battle, sourceId);
    battle.log(`【${source.name}】获得1层【种子】（第${stacks}层）`);
}

/**
 * 技能1：连庄倾向
 * 0火，主动技能
 * 裁判旗第1~3回合或第5~7回合时使用，可减少10%体力（体力系统预留中，暂以种子层数体现）并获得1层【种子】。
 */
export const shibuya_akemi_skill1: Skill = {
    no: 1,
    name: '连庄倾向',
    passive: false,
    cost: 0,
    target: SkillTarget.SELF,
    text: '裁判旗第1~3回合或第5~7回合时使用，减少自身10%当前生命，并获得1层【种子】。其他回合使用无效。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        if (!isSeedPhase(battle)) {
            battle.log(`【${source.name}】使用【连庄倾向】，但当前不在裁判旗1~3/5~7回合，未获得种子`);
            return;
        }
        // 减少自身10%当前生命（真实伤害，无视防御）
        const curHp = source.hp || 0;
        const loss = Math.floor(curHp * 0.1);
        if (loss > 0) {
            battle.actionAttack(
                Attack.build(sourceId, sourceId)
                    .base(() => loss)
                    .rate(1)
                    .real()
                    .single()
                    .skill('连庄倾向')
                    .noShare()
                    .end()
            );
        }
        addSeed(battle, sourceId);
    },
};

/**
 * 技能2：播种种子
 * 被动技能
 * 每次自身行动造成伤害后，获得1层【种子】。
 * 种子：持续到结束，上限13层，不可被驱散/清除；
 * 3~5层速度+10点、攻击+10%；6~8层速度+30点、攻击+30%；9层及以上速度+50点、攻击+50%。
 */
export const shibuya_akemi_skill2: Skill = {
    no: 2,
    name: '播种种子',
    passive: true,
    cost: 0,
    reserveValid: true,
    text: '被动技能。每次自身行动造成伤害后，获得1层【种子】。种子持续到结束、上限13层、不可驱散清除：3~5层速度+10点攻击+10%，6~8层速度+30点攻击+30%，9层及以上速度+50点攻击+50%。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const self = battle.getEntity(data.skillOwnerId);
                if (!self || self.dead) return -1;
                // 仅自身造成伤害时触发
                addSeed(battle, self.entityId);
                return -1;
            },
            code: EventCodes.HAS_DAMAGED,
            range: EventRange.SELF,
            priority: 0,
            passive: true,
            name: '播种种子',
        },
    ],
};

/**
 * 技能3：丰收之时
 * 2火，主动技能
 * 对敌方单体造成攻击力100%的伤害；裁判旗第4回合或第8回合内，改为对敌方全体造成攻击力100%的伤害。
 */
export const shibuya_akemi_skill3: Skill = {
    no: 3,
    name: '丰收之时',
    passive: false,
    cost: 2,
    target: SkillTarget.ENEMY,
    text: '对敌方单体造成攻击力100%的伤害；裁判旗第4回合或第8回合内，改为对敌方全体造成攻击力100%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        const judgeFlag = JudgeFlagManager.getInstance().getJudgeFlag(battle);
        const n = judgeFlag.getStatus().judgeKingActionCount;
        const isGroup = n === 4 || n === 8;

        if (isGroup) {
            const enemies = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
            const attackInfos = enemies.map(enemy =>
                Attack.build(enemy.entityId, sourceId)
                    .rate(1.0)
                    .shouldComputeCri()
                    .group()
                    .skill('丰收之时')
                    .end()
            );
            battle.actionAttack(attackInfos);
            battle.log(`【${source.name}】使用【丰收之时】，裁判旗第${n}回合，对敌方全体造成100%伤害`);
        } else {
            battle.actionAttack(
                Attack.build(selectedId, sourceId)
                    .rate(1.0)
                    .shouldComputeCri()
                    .single()
                    .skill('丰收之时')
                    .end()
            );
            battle.log(`【${source.name}】使用【丰收之时】，对单体造成100%伤害`);
        }
    },
};
