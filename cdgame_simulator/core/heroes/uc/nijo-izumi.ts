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
    HeroData,
} from '../../';
import {SkillTarget} from '../../skill';

const STRONGEST_BUFF_NAME = '最强二条';
const STRONGEST_KEY = 'nijo_strongest';

// 年级低于高中一年级（初中、小学等，非高中、非成年）
function isBelowSeniorHighOne(entity: any): boolean {
    const heroInfo = HeroData.find((d: any) => Number(d.index) === entity.no);
    if (!heroInfo || !heroInfo.grade) return false;
    const grade = String(heroInfo.grade);
    if (grade.startsWith('高')) return false;
    if (grade === '成年') return false;
    return true;
}

// 是否拥有【最强二条】状态
function hasStrongest(entity: any): boolean {
    return entity.getBattleData(STRONGEST_KEY) === 'true';
}

// 设置/清除【最强二条】状态（攻防速 +10%，持续到结束）
function setStrongest(battle: Battle, sourceId: number, on: boolean) {
    const source = battle.getEntity(sourceId);
    if (!source) return;

    // 移除旧状态buff
    const oldBuffs = battle.filterBuffByName(sourceId, STRONGEST_BUFF_NAME);
    for (const b of oldBuffs) battle.actionRemoveBuff(b, Reasons.SKILL);

    if (on) {
        source.setData(STRONGEST_KEY, 'true');
        const buff = Buff.build(sourceId, sourceId)
            .name(STRONGEST_BUFF_NAME, 1)
            .countDown(-1)
            .noRemove()
            .buff()
            .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.1)
            .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.1)
            .buffAP(BattleProperties.SPD, EffectTypes.ADD_RATE, 0.1)
            .end();
        battle.actionAddBuff(buff, Reasons.SKILL);
    } else {
        source.setData(STRONGEST_KEY, 'false');
    }
}

// 对目标（若其为高一年级以下）减少20%行动条
function slowBelowSeniorHigh(battle: Battle, sourceId: number, targetId: number) {
    const target = battle.getEntity(targetId);
    if (!target || target.dead) return;
    if (!isBelowSeniorHighOne(target)) return;
    battle.actionUpdateRunwayPercent(sourceId, targetId, -0.2, Reasons.SKILL);
    battle.log(`【${battle.getEntity(sourceId)?.name}】使【${target.name}】（高一以下）行动条减少20%`);
}

/**
 * 技能1：水枪冲锋
 * 0火，主动技能
 * 对单体目标造成1次攻击力125%的伤害；
 * 若自身处于【最强二条】状态，则对受到伤害且年级为高一年级以下的目标减少20%行动条。
 */
export const nijo_izumi_skill1: Skill = {
    no: 1,
    name: '水枪冲锋',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对单体目标造成攻击力125%的伤害；若自身处于【最强二条】状态，则对受到伤害且年级为高一年级以下的目标减少20%行动条。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.25)
                .shouldComputeCri()
                .single()
                .skill('水枪冲锋')
                .completed((b: Battle, d: any) => {
                    const attackInfo = d.attackInfos?.[0];
                    if (attackInfo && attackInfo.finalDamage > 0 && hasStrongest(source)) {
                        slowBelowSeniorHigh(b, sourceId, attackInfo.targetId);
                    }
                })
                .end()
        );
    },
};

/**
 * 技能2：最强一年
 * 被动技能
 * 开局判定：若对位对手年级为高一年级以下，则获得【最强二条】状态（自身攻防速+10%，持续到结束）；
 * 反之，自身攻防速下降20%，且本队其他高三年级选手攻防速增加10%。
 */
export const nijo_izumi_skill2: Skill = {
    no: 2,
    name: '最强一年',
    passive: true,
    cost: 0,
    reserveValid: true,
    text: '被动技能。开局判定：若对位对手年级为高一年级以下，则获得【最强二条】状态（自身攻防速+10%，持续到结束）；反之自身攻防速下降20%，且本队其他高三年级选手攻防速增加10%。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const self = battle.getEntity(data.skillOwnerId);
                if (!self || self.dead) return -1;

                // 对位对手：敌方同位置
                const enemyTeamId = 1 - self.teamId;
                const field = battle.fields[enemyTeamId] || [];
                const rivalId = self.position >= 0 && field[self.position] > 0 ? field[self.position] : 0;
                const rival = rivalId > 0 ? battle.getEntity(rivalId) : null;

                const rivalBelow = rival && !rival.dead && isBelowSeniorHighOne(rival);

                if (rivalBelow) {
                    setStrongest(battle, self.entityId, true);
                    battle.log(`【${self.name}】对位对手【${rival!.name}】为高一以下，获得【最强二条】状态`);
                } else {
                    // 反之：自身攻防速-20%
                    const debuff = Buff.build(self.entityId, self.entityId)
                        .name('最强一年·劣势', 1)
                        .countDown(-1)
                        .noRemove()
                        .debuff()
                        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, -0.2)
                        .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, -0.2)
                        .buffAP(BattleProperties.SPD, EffectTypes.ADD_RATE, -0.2)
                        .end();
                    battle.actionAddBuff(debuff, Reasons.SKILL);

                    // 本队其他高三年级选手攻防速+10%
                    const teamEntities = battle.getTeamEntities(self.teamId);
                    teamEntities.forEach(ally => {
                        if (ally.entityId === self.entityId || ally.dead) return;
                        const allyInfo = HeroData.find((d: any) => Number(d.index) === ally.no);
                        if (!allyInfo || allyInfo.grade !== '高三') return;
                        const buff = Buff.build(self.entityId, ally.entityId)
                            .name('最强一年·助力', 1)
                            .countDown(-1)
                            .noRemove()
                            .buff()
                            .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.1)
                            .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.1)
                            .buffAP(BattleProperties.SPD, EffectTypes.ADD_RATE, 0.1)
                            .end();
                        battle.actionAddBuff(buff, Reasons.SKILL);
                    });
                    battle.log(`【${self.name}】对位对手非高一以下，自身攻防速-20%，本队高三选手攻防速+10%`);
                }
                return -1;
            },
            code: EventCodes.BATTLE_START,
            range: EventRange.TEAM,
            priority: 0,
            passive: true,
            name: '最强一年',
        },
    ],
};

/**
 * 技能3：凶星闪耀
 * 2火，主动技能
 * 若自身为全队攻击力最高的选手：对敌方全体造成攻击力130%的伤害，并对其中高一年级以下目标减少20%行动条；
 * 否则：使本方高三年级选手增加20%行动条。
 */
export const nijo_izumi_skill3: Skill = {
    no: 3,
    name: '凶星闪耀',
    passive: false,
    cost: 2,
    target: SkillTarget.ENEMY,
    text: '若自身为全队攻击力最高的选手：对敌方全体造成攻击力130%的伤害，并对其中高一年级以下目标减少20%行动条；否则使本方高三年级选手增加20%行动条。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        const myAtk = battle.getComputedProperty(sourceId, BattleProperties.ATK);
        let isHighest = true;
        const teamEntities = battle.getTeamEntities(source.teamId);
        for (const ally of teamEntities) {
            if (ally.entityId === sourceId || ally.dead) continue;
            const atk = battle.getComputedProperty(ally.entityId, BattleProperties.ATK);
            if (atk > myAtk) {
                isHighest = false;
                break;
            }
        }

        if (isHighest) {
            const enemies = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
            const attackInfos = enemies.map(enemy =>
                Attack.build(enemy.entityId, sourceId)
                    .rate(1.3)
                    .shouldComputeCri()
                    .group()
                    .skill('凶星闪耀')
                    .end()
            );
            battle.actionAttack(attackInfos);
            enemies.forEach(enemy => {
                if (isBelowSeniorHighOne(enemy)) {
                    battle.actionUpdateRunwayPercent(sourceId, enemy.entityId, -0.2, Reasons.SKILL);
                }
            });
            battle.log(`【${source.name}】发动【凶星闪耀】（全队攻击最高），对敌方全体造成130%伤害并减速高一以下目标`);
        } else {
            let count = 0;
            teamEntities.forEach(ally => {
                if (ally.dead) return;
                const allyInfo = HeroData.find((d: any) => Number(d.index) === ally.no);
                if (!allyInfo || allyInfo.grade !== '高三') return;
                battle.actionUpdateRunwayPercent(sourceId, ally.entityId, 0.2, Reasons.SKILL);
                count++;
            });
            battle.log(`【${source.name}】发动【凶星闪耀】（非攻击最高），使本方${count}名高三选手行动条+20%`);
        }
    },
};
