import {
    Attack,
    AttackParams,
    BattleProperties,
    BuffParams,
    Battle,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
    AddBuffProcessing,
    JudgeFlagManager,
} from '../../';
import {SkillTarget} from '../../skill';
import Healing from '../../healing';

// 前位/后位队友索引（同队 fields 数组，索引即主力位置 0~5）
function getFrontAndBackAllyIds(battle: Battle, entityId: number): number[] {
    const entity = battle.getEntity(entityId);
    if (!entity || entity.position < 0) return [];
    const teamId = entity.teamId;
    const field = battle.fields[teamId] || [];
    const ids: number[] = [];
    const frontPos = entity.position - 1;
    const backPos = entity.position + 1;
    if (frontPos >= 0 && field[frontPos] > 0) ids.push(field[frontPos]);
    if (backPos <= 5 && field[backPos] > 0) ids.push(field[backPos]);
    return ids;
}

/**
 * 技能1：饮料补充
 * 0火，主动技能
 * 对单体目标造成1次攻击力125%的伤害，并回复等同于造成伤害量的生命值。
 */
export const esaki_hitomi_skill1: Skill = {
    no: 1,
    name: '饮料补充',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对单体目标造成攻击力125%的伤害，并回复等同于本次造成伤害量的生命值。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.25)
                .shouldComputeCri()
                .single()
                .skill('饮料补充')
                .completed((b: Battle, d: any) => {
                    const attackInfo = d.attackInfos?.[0];
                    if (attackInfo && attackInfo.finalDamage > 0) {
                        const healAmount = attackInfo.finalDamage;
                        const healing = Healing.build(sourceId, sourceId)
                            .base(() => healAmount)
                            .rate(1)
                            .skillName('饮料补充')
                            .end();
                        battle.actionHeal(healing);
                        battle.log(`【${source.name}】使用【饮料补充】，回复${healAmount}点生命`);
                    }
                })
                .end()
        );
    },
};

/**
 * 技能2：甩锅背锅
 * 被动技能
 * 自身前位置和后位置队友受到的真实伤害，全部由自身承担；
 * 自身获得的攻击力提升效果翻倍。
 */
export const esaki_hitomi_skill2: Skill = {
    no: 2,
    name: '甩锅背锅',
    passive: true,
    cost: 0,
    reserveValid: true,
    text: '被动技能。自身前位置与后位置队友受到的真实伤害，全部由自身承担；自身获得的攻击力提升效果翻倍。',
    handlers: [
        // 承当前/后位队友受到的真实伤害
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const self = battle.getEntity(data.skillOwnerId);
                if (!self || self.dead) return -1;

                const attackData = data.data as any;
                if (!attackData || !attackData.attackInfos || !attackData.attacks) return -1;

                const attackInfo = attackData.attackInfos[attackData.index];
                const attack = attackData.attacks[attackData.index];
                if (!attackInfo || !attack) return -1;

                // 仅处理单体真实伤害
                if (!attack.hasParam(AttackParams.REAL)) return -1;

                const targetId = attackInfo.targetId;
                const target = battle.getEntity(targetId);
                if (!target || target.teamId !== self.teamId || target.entityId === self.entityId) return -1;

                // 目标必须是自身前位或后位队友
                const allyIds = getFrontAndBackAllyIds(battle, self.entityId);
                if (!allyIds.includes(target.entityId)) return -1;

                const damage = attackInfo.finalDamage || 0;
                if (damage <= 0) return -1;

                // 由自身承担全部真实伤害
                battle.actionAttack(
                    Attack.build(self.entityId, data.skillOwnerId)
                        .base(() => damage)
                        .rate(1)
                        .real()
                        .single()
                        .skill('甩锅背锅')
                        .noShare()
                        .end()
                );

                battle.log(`【${self.name}】发动【甩锅背锅】，为【${target.name}】承担${damage}点真实伤害`);
                return -1;
            },
            code: EventCodes.HAS_BEEN_ATTACKED,
            range: EventRange.TEAM,
            priority: 100,
            passive: true,
            name: '甩锅背锅·承伤',
        },
        // 自身攻击力提升效果翻倍
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const self = battle.getEntity(data.skillOwnerId);
                if (!self || self.dead) return -1;

                const proc = data.data as AddBuffProcessing;
                const buff = proc && proc.buff;
                if (!buff) return -1;

                // 仅处理影响属性的 buff
                if (!buff.hasParam(BuffParams.AFFECT_PROPERTY)) return -1;

                let doubled = false;
                for (const effect of buff.effects) {
                    if (effect.propertyName === BattleProperties.ATK) {
                        effect.value *= 2;
                        doubled = true;
                    }
                }
                if (doubled) {
                    battle.log(`【${self.name}】触发【甩锅背锅】，攻击力提升效果翻倍`);
                }
                return -1;
            },
            code: EventCodes.BEFORE_BUFF_GET,
            range: EventRange.SELF,
            priority: 0,
            passive: true,
            name: '甩锅背锅·攻击翻倍',
        },
    ],
};

/**
 * 技能3：大牌对日
 * 3火，主动技能
 * 对敌方单体目标造成一次攻击力200%的伤害；
 * 裁判旗行动至第8回合及以内时，改为对敌方全体目标造成伤害。
 */
export const esaki_hitomi_skill3: Skill = {
    no: 3,
    name: '大牌对日',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '对敌方单体目标造成攻击力200%的伤害；当裁判旗行动至第8回合及以内时，改为对敌方全体目标造成攻击力200%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        const judgeFlag = JudgeFlagManager.getInstance().getJudgeFlag(battle);
        const judgeKingActionCount = judgeFlag.getStatus().judgeKingActionCount;
        const isGroup = judgeKingActionCount <= 8;

        if (isGroup) {
            const enemies = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
            const attackInfos = enemies.map(enemy =>
                Attack.build(enemy.entityId, sourceId)
                    .rate(2.0)
                    .shouldComputeCri()
                    .group()
                    .skill('大牌对日')
                    .end()
            );
            battle.actionAttack(attackInfos);
            battle.log(`【${source.name}】使用【大牌对日】，裁判旗第${judgeKingActionCount}回合（≤8），对敌方全体造成200%伤害`);
        } else {
            battle.actionAttack(
                Attack.build(selectedId, sourceId)
                    .rate(2.0)
                    .shouldComputeCri()
                    .single()
                    .skill('大牌对日')
                    .end()
            );
            battle.log(`【${source.name}】使用【大牌对日】，对单体目标造成200%伤害`);
        }
    },
};
