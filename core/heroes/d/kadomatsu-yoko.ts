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
import {SkillTarget} from '../../skill';

/**
 * 构建最快出牌传说buff
 */
function buildFastestCardBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('最快出牌传说', 1)
        .countDown(1)
        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, 50)
        .buff()
        .end();
}

/**
 * 门松叶子技能1：先锋攻击
 * 主动技能，消耗0点鬼火
 * 吃我进攻女子一击，造成攻击125%的伤害
 */
export const kadomatsu_yoko_skill1: Skill = {
    no: 1,
    name: '先锋攻击',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '吃我进攻女子一击，造成攻击力125%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.25)
                .shouldComputeCri()
                .single()
                .skill('先锋攻击')
                .end()
        );
    },
};

/**
 * 门松叶子技能2：最快出牌传说
 * 被动技能
 * 先机获得一个buff【最快出牌传说】，速度+50，持续1回合
 */
export const kadomatsu_yoko_skill2: Skill = {
    no: 2,
    name: '最快出牌传说',
    passive: true,
    cost: 0,
    text: '被动技能。先机获得【最快出牌传说】buff，速度提升50点，持续1回合。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const buff = buildFastestCardBuff(data.skillOwnerId, data.skillOwnerId);
                battle.actionAddBuff(buff, Reasons.SKILL);
                battle.log(`【${battle.getEntity(data.skillOwnerId)?.name}】获得【最快出牌传说】buff，速度+50`);
                
                return -1;
            },
            code: EventCodes.SENKI, // 先机事件
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '最快出牌传说',
        },
    ],
};

/**
 * 门松叶子技能3：联动队友
 * 主动技能，消耗2点鬼火
 * 对单体敌人造成200%攻击的伤害，并且使当前行动条最后的队友立刻增加其50%的行动条
 */
export const kadomatsu_yoko_skill3: Skill = {
    no: 3,
    name: '联动队友',
    passive: false,
    cost: 2,
    target: SkillTarget.ENEMY,
    text: '对单体敌人造成攻击力200%的伤害，并使当前行动条最后的队友立刻增加50%行动条进度。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 造成伤害
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(2.0)
                .shouldComputeCri()
                .single()
                .skill('联动队友')
                .end()
        );
        
        // 找到行动条最后的队友
        const teamEntities = battle.getTeamEntities(source.teamId).filter(e => !e.dead);
        if (teamEntities.length > 0) {
            // 模拟行动条位置，假设runway有computeNext方法
            // 这里简化处理，找到速度最慢的队友
            let slowestEntity = teamEntities[0];
            let lowestSpd = battle.getComputedProperty(slowestEntity.entityId, BattleProperties.SPD);
            
            teamEntities.forEach(entity => {
                const spd = battle.getComputedProperty(entity.entityId, BattleProperties.SPD);
                if (spd < lowestSpd) {
                    lowestSpd = spd;
                    slowestEntity = entity;
                }
            });
            
            // 增加50%行动条
            battle.actionUpdateRunwayPercent(sourceId, slowestEntity.entityId, 0.5, Reasons.SKILL);
            battle.log(`【${source.name}】的【联动队友】使【${slowestEntity.name}】增加50%行动条`);
        }
    },
};
