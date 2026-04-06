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
} from '../../';
import NormalAttack from '../common/normal-attack';
import {SkillTarget} from '../../skill';

export const oakaharahajime_skill1: Skill = {
    no: 1,
    name: '基础速攻',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '快速攻击敌方目标，造成攻击力125%的伤害，并降低目标10%行动条进度。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.25)
                .shouldComputeCri()
                .single()
                .skill('基础速攻')
                .end()
        );
        battle.actionUpdateRunwayPercent(sourceId, selectedId, -0.1, Reasons.SKILL);
    },
};

export const oakaharahajime_skill2: Skill = {
    no: 2,
    name: '模仿应援',
    passive: true,
    cost: 0,
    target: SkillTarget.SELF,
    reserveValid: true, // 在替补/应援位置也可以生效
    text: '【先机】战斗开始时，使除自己外的其他友方单位的被动技能效果额外触发一次。（应援和替补位置也可以生效）',
    handlers: [{
        handle(battle: Battle, data: RealEventData) {
            if (!data.skillOwnerId) return 0;
            const source = battle.getEntity(data.skillOwnerId);
            if (!source) return 0;
            
            const allies = battle.getTeamEntities(source.teamId);
            
            for (const ally of allies) {
                if (ally.entityId === source.entityId) continue;
                for (const skill of ally.skills) {
                    if (skill.passive && skill.handlers) {
                        for (const handler of skill.handlers) {
                            if (handler.code === EventCodes.SENKI) {
                                if (skill.name === '模仿应援') continue;
                                handler.handle(battle, {
                                    skillOwnerId: ally.entityId,
                                    skillNo: skill.no,
                                    eventId: EventCodes.SENKI,
                                    handler: handler,
                                    data: null,
                                }, 0);
                            }
                        }
                    }
                }
            }
            
            battle.log(`【${source.name}】使用模仿应援，触发友方被动技能`);
            return -1;
        },
        code: EventCodes.SENKI,
        range: EventRange.NONE,
        priority: 100,
        passive: true,
        name: '【先机】模仿应援',
    }],
};

function buildGufuBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('鼓舞', 1)
        .countDown(2)
        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, 15)
        .buffAP(BattleProperties.CRI, EffectTypes.FIXED, 0.15)
        .end();
}

export const oakaharahajime_skill3: Skill = {
    no: 3,
    name: '扩音喇叭',
    passive: false,
    cost: 2,
    target: SkillTarget.TEAM,
    text: '为友方全体施加【鼓舞】buff，速度提升15点，暴击率提升15%，持续2回合。消耗2点鬼火。',
    use(battle: Battle, sourceId: number, _: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const allies = battle.getTeamEntities(source.teamId);
        
        for (const ally of allies) {
            battle.actionAddBuff(buildGufuBuff(sourceId, ally.entityId), Reasons.SKILL);
        }
        
        battle.log(`【${source.name}】使用扩音喇叭，为友方全体施加鼓舞状态`);
    },
};
