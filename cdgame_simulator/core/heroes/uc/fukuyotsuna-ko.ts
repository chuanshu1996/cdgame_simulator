import {
    Attack,
    BattleProperties,
    Buff,
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

const VOICE_LABEL = '声音';

// 是否带【声音】标签
function hasVoiceLabel(entity: any): boolean {
    const heroInfo = HeroData.find((d: any) => Number(d.index) === entity.no);
    if (!heroInfo || !heroInfo.label) return false;
    return heroInfo.label.split('，').includes(VOICE_LABEL);
}

/**
 * 技能1：我也要上么
 * 0火，主动技能
 * 对敌方单体角色造成攻击力100%的伤害。
 */
export const fukuyotsuna_ko_skill1: Skill = {
    no: 1,
    name: '我也要上么',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对敌方单体角色造成攻击力100%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.0)
                .shouldComputeCri()
                .single()
                .skill('我也要上么')
                .end()
        );
    },
};

/**
 * 技能2：主持人
 * 被动技能
 * 所有带【声音】标签的队友，效果命中概率提升50%、速度提升20点；替补位和应援位也可以生效。
 */
export const fukuyotsuna_ko_skill2: Skill = {
    no: 2,
    name: '主持人',
    passive: true,
    cost: 0,
    reserveValid: true,
    text: '被动技能。所有带【声音】标签的队友，效果命中概率提升50%、速度提升20点（替补位和应援位也可以生效）。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const self = battle.getEntity(data.skillOwnerId);
                if (!self || self.dead) return -1;

                const teamEntities = battle.getTeamEntities(self.teamId);
                teamEntities.forEach(ally => {
                    if (ally.dead) return;
                    if (!hasVoiceLabel(ally)) return;
                    // 避免重复叠加
                    const existing = battle.filterBuffByName(ally.entityId, '主持人·声音');
                    if (existing.length > 0) return;

                    const buff = Buff.build(self.entityId, ally.entityId)
                        .name('主持人·声音', 1)
                        .countDown(-1)
                        .noRemove()
                        .buff()
                        .buffAP(BattleProperties.EFT_HIT, EffectTypes.ADD_RATE, 0.5)
                        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, 20)
                        .end();
                    battle.actionAddBuff(buff, Reasons.SKILL);
                    battle.log(`【${ally.name}】获得【主持人】加成：效果命中+50%、速度+20`);
                });
                return -1;
            },
            code: EventCodes.BATTLE_START,
            range: EventRange.TEAM,
            priority: 0,
            passive: true,
            name: '主持人',
        },
    ],
};

/**
 * 技能3：开局一声吼
 * 0火，【限定技】，开场先机发动
 * 对所有敌方角色造成5000点真实伤害；替补位和应援位也可以使用。
 */
export const fukuyotsuna_ko_skill3: Skill = {
    no: 3,
    name: '开局一声吼',
    passive: true,
    cost: 0,
    hide: true,
    limited: true,
    reserveValid: true,
    target: SkillTarget.ENEMY,
    text: '【限定技】开场先机发动：对所有敌方角色造成5000点真实伤害（替补位和应援位也可以使用）。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const self = battle.getEntity(data.skillOwnerId);
                if (!self || self.dead) return -1;

                const enemies = battle.getTeamEntities(1 - self.teamId).filter(e => !e.dead);
                if (enemies.length === 0) return -1;

                const attackInfos = enemies.map(enemy =>
                    Attack.build(enemy.entityId, self.entityId)
                        .base(() => 5000)
                        .rate(1)
                        .real()
                        .single()
                        .skill('开局一声吼')
                        .noShare()
                        .end()
                );
                battle.actionAttack(attackInfos);
                battle.log(`【${self.name}】发动【开局一声吼】，对所有敌方造成5000点真实伤害`);
                return -1;
            },
            code: EventCodes.SENKI,
            range: EventRange.TEAM,
            priority: 0,
            passive: true,
            name: '开局一声吼',
        },
    ],
};
