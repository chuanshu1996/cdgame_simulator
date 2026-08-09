import {
    Attack,
    AttackParams,
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
    Healing,
} from '../../';
import {SkillTarget} from '../../skill';
import {JudgeFlagManager} from '../../judge-flag';

const SOUDI_GUIDE_BUFF_NAME = '爽帝指导';   // 攻击/防御翻倍增益
const SOUDI_GUIDE_TRIGGERED_KEY = 'soudi_guide_triggered'; // 防止第二回合重复触发
const SOUDI_GUIDE_CLEARED_KEY = 'soudi_guide_cleared';     // 防止第3回合重复清除

/**
 * 辅助：检测队伍中是否存在指定名字（且存活）的队友
 */
function hasAliveTeammateByName(battle: Battle, teamId: number, name: string): boolean {
    return battle.getTeamEntities(teamId).some(e => e.name === name && !e.dead);
}

/**
 * 技能1：骨笛萦绕
 * 0 火消耗，主动技能。
 * 为我方全体回复 2% 最大生命值；若队伍中存在【本内成香】，回复量提升至 4%。
 */
export const hinomori_seishi_skill1: Skill = {
    no: 1,
    name: '骨笛萦绕',
    passive: false,
    cost: 0,
    target: SkillTarget.SELF,
    text: '主动技能。为我方全体回复2%最大生命值；当队伍中存在【本内成香】时，回复量提升至4%。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        const rate = hasAliveTeammateByName(battle, source.teamId, '本内成香') ? 0.04 : 0.02;
        if (rate > 0.02) {
            battle.log(`【${source.name}】队伍中存在【本内成香】，骨笛萦绕回复量提升至4%`);
        }

        const allies = battle.getTeamEntities(source.teamId).filter(e => !e.dead);
        const healings = allies.map(ally =>
            Healing.build(sourceId, ally.entityId)
                .base((b, sid) => battle.getComputedProperty(sid, BattleProperties.MAX_HP))
                    .rate(rate)
                    .shouldComputeCri()
                    .skillName('骨笛萦绕')
                    .end()
        );
        battle.actionHeal(healings);
        battle.log(`【${source.name}】使用【骨笛萦绕】，为全体队友回复${rate * 100}%最大生命值`);
    },
};

/**
 * 构建【爽帝指导】buff：攻击力与防御力翻倍（ADD_RATE +100%），持续至裁判旗第三回合结束。
 * 同类翻倍 buff 不叠加：再次获得时刷新（清除旧的再添加新的），保持单层。
 */
function buildSoudiGuideBuff(sourceId: number): Buff {
    return Buff.build(sourceId, sourceId)
        .name(SOUDI_GUIDE_BUFF_NAME, 1)
        .countDown(-1)          // 由裁判旗回合事件手动清除，故不设固定回合数
        .noRemove()             // 不被普通驱散/清除移除（仅在第3回合结束时由技能逻辑移除）
        .buff()
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 1.0) // 攻击力翻倍（+100%）
        .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 1.0) // 防御力翻倍（+100%）
        .end();
}

/**
 * 技能2：爽帝指导
 * 被动技能。
 * 裁判旗第二回合开始时自动触发：自身攻击力与防御力翻倍，持续至裁判旗第三回合结束。
 * - 叠加规则：同类翻倍 buff 不叠加，重复触发时刷新为单层（见 buildSoudiGuideBuff 的清除逻辑）。
 * - 若第二回合开始前自身已被控制或已死亡：本次不触发（在 handler 中判 dead / 控制状态）。
 */
export const hinomori_seishi_skill2: Skill = {
    no: 2,
    name: '爽帝指导',
    passive: true,
    cost: 0,
    reserveValid: true,
    text: '被动技能。裁判旗第二回合开始时自动触发，使自身攻击力与防御力翻倍，持续至裁判旗第三回合结束。同类翻倍效果不叠加（重复触发刷新单层）；若第二回合开始前自身被控制或已死亡，则本次不触发。',
    handlers: [
        {
            // 触发：裁判旗第二回合开始
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;

                const judgeFlag = JudgeFlagManager.getInstance().getJudgeFlag(battle);
                const judgeRound = judgeFlag.getStatus().judgeKingActionCount; // 当前裁判旗回合数（1 起）
                if (judgeRound !== 2) return -1;

                // 防重复触发：同一场战斗只在第二回合触发一次
                if (source.getBattleData(SOUDI_GUIDE_TRIGGERED_KEY) === 'true') return -1;

                // 第二回合开始前若已死亡或被控制，则不触发
                if (source.dead) {
                    battle.log(`【${source.name}】已在裁判旗第二回合前阵亡，【爽帝指导】未触发`);
                    return -1;
                }
                if (battle.buffs.some(b => b.ownerId === source.entityId && b.params.includes(BuffParams.CONTROL))) {
                    battle.log(`【${source.name}】在裁判旗第二回合前处于控制状态，【爽帝指导】未触发`);
                    return -1;
                }

                // 标记已触发，避免重复
                source.setData(SOUDI_GUIDE_TRIGGERED_KEY, 'true');

                // 同类翻倍 buff 不叠加：先清除已有的同名 buff 再添加（刷新单层）
                const existing = battle.buffs.find(b => b.name === SOUDI_GUIDE_BUFF_NAME && b.ownerId === source.entityId);
                if (existing) battle.actionRemoveBuff(existing, Reasons.SKILL);

                battle.actionAddBuff(buildSoudiGuideBuff(source.entityId), Reasons.SKILL);
                battle.log(`【${source.name}】裁判旗第二回合触发【爽帝指导】，攻击力与防御力翻倍，持续至裁判旗第三回合结束`);
                return -1;
            },
            code: EventCodes.TURN_START,
            range: EventRange.SELF,
            priority: 0,
            passive: true,
            name: '爽帝指导-触发',
        },
        {
            // 清除：持续至裁判旗第三回合结束（第三回合行动结束时移除）
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;

                const judgeFlag = JudgeFlagManager.getInstance().getJudgeFlag(battle);
                const judgeRound = judgeFlag.getStatus().judgeKingActionCount;
                if (judgeRound < 3) return -1; // 仅第三回合及以后清除
                if (source.getBattleData(SOUDI_GUIDE_CLEARED_KEY) === 'true') return -1;

                const buff = battle.buffs.find(b => b.name === SOUDI_GUIDE_BUFF_NAME && b.ownerId === source.entityId);
                if (!buff) return -1;

                source.setData(SOUDI_GUIDE_CLEARED_KEY, 'true');
                battle.actionRemoveBuff(buff, Reasons.SKILL);
                battle.log(`【${source.name}】裁判旗第三回合结束，【爽帝指导】效果消失`);
                return -1;
            },
            code: EventCodes.TURN_END,
            range: EventRange.SELF,
            priority: 0,
            passive: true,
            name: '爽帝指导-清除',
        },
    ],
};

/**
 * 技能3：世界风采
 * 3 火消耗，主动技能。
 * - 若存在【爽帝指导】buff：对敌方全体造成基于自身攻击力 88% 的真实伤害，
 *   并将实际造成的总伤害量转化为等额护盾附加给自身，护盾持续 1 回合。
 * - 若不存在该 buff：改为我方全体回复 20% 最大生命值。
 */
export const hinomori_seishi_skill3: Skill = {
    no: 3,
    name: '世界风采',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '主动技能，消耗3点能量。若自身存在【爽帝指导】buff，则对敌方全体造成基于自身攻击力88%的真实伤害，并将造成的伤害总量转化为等额护盾附加给自身（持续1回合）；若不存在该buff，则改为为我方全体回复20%最大生命值。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        const hasGuide = battle.buffs.some(b => b.name === SOUDI_GUIDE_BUFF_NAME && b.ownerId === source.entityId);

        if (hasGuide) {
            // 真实伤害分支：伤害计算时机为本次技能结算时，基于当前（含爽帝指导翻倍后）攻击力
            const enemies = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
            const atk = battle.getComputedProperty(sourceId, BattleProperties.ATK); // 已含爽帝指导翻倍
            const totalRate = 0.88;

            let totalDamage = 0;
            const attackInfos = enemies.map(enemy => {
                const dmg = Math.floor(atk * totalRate);
                totalDamage += dmg;
                return Attack.build(enemy.entityId, sourceId)
                    .base(() => dmg)
                    .rate(1)
                    .param(AttackParams.REAL) // 真实伤害：无视防御
                    .shouldComputeCri()
                    .group()
                    .skill('世界风采')
                    .end();
            });
            battle.actionAttack(attackInfos);

            // 护盾：吸收上限 = 实际造成的总伤害量；持续 1 回合（countDown(1)）
            if (totalDamage > 0) {
                const shieldBuff = Buff.build(sourceId, sourceId)
                    .name('世界风采护盾', 1)
                    .countDown(1)
                    .shield(totalDamage)
                    .buff()
                    .end();
                battle.actionAddBuff(shieldBuff, Reasons.SKILL);
                battle.log(`【${source.name}】使用【世界风采】，对敌方全体造成${totalDamage}点真实伤害，并获得等额护盾（持续1回合）`);
            } else {
                battle.log(`【${source.name}】使用【世界风采】，但未能对敌方造成任何伤害`);
            }
        } else {
            // 回复分支：我方全体回复 20% 最大生命值
            const allies = battle.getTeamEntities(source.teamId).filter(e => !e.dead);
            const healings = allies.map(ally =>
                Healing.build(sourceId, ally.entityId)
                    .base((b, sid) => battle.getComputedProperty(sid, BattleProperties.MAX_HP))
                    .rate(0.2)
                    .shouldComputeCri()
                    .skillName('世界风采')
                    .end()
            );
            battle.actionHeal(healings);
            battle.log(`【${source.name}】使用【世界风采】，未持有【爽帝指导】，改为为全体队友回复20%最大生命值`);
        }
    },
};
