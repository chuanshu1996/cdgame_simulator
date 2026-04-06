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
    Control,
} from '../../';
import {SkillTarget} from '../../skill';

/**
 * 构建眩晕buff
 */
function buildStunBuff(sourceId: number, targetId: number, probability: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('眩晕', 1)
        .countDown(1)
        .control(Control.DIZZY)
        .noDispel()
        .probability(probability)
        .end();
}

/**
 * 义鸠樱子技能1：熊孩子头槌
 * 主动技能，消耗0点鬼火
 * 造成攻击125%的伤害，并有5%基础概率（+效果命中）眩晕对手1回合
 */
export const yoshizume_sakurako_skill1: Skill = {
    no: 1,
    name: '熊孩子头槌',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '熊孩子发起头槌，造成攻击力125%的伤害，并有5%基础概率（受效果命中加成）施加【眩晕】控制效果，持续1回合。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 计算眩晕概率
        const baseProbability = 0.05;
        const effectHit = battle.getComputedProperty(sourceId, BattleProperties.EFT_HIT);
        const finalProbability = baseProbability * (1 + effectHit);
        
        // 造成伤害
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.25)
                .shouldComputeCri()
                .single()
                .skill('熊孩子头槌')
                .end()
        );
        
        // 尝试添加眩晕buff
        const stunBuff = buildStunBuff(sourceId, selectedId, finalProbability);
        battle.actionAddBuff(stunBuff, Reasons.SKILL);
    },
};

/**
 * 义鸠樱子技能2：熊孩子看破
 * 被动技能
 * 受到伤害时有15%（+效果命中）的概率眩晕目标1回合（多段伤害不会重复触发）
 */
export const yoshizume_sakurako_skill2: Skill = {
    no: 2,
    name: '熊孩子看破',
    passive: true,
    cost: 0,
    text: '被动技能。受到伤害时有15%基础概率（受效果命中加成）施加【眩晕】控制效果给攻击者，持续1回合（多段伤害不会重复触发）。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return -1;
                
                // 检查是否已经在本回合触发过
                const hasTriggered = entity.getBattleData('yosh_triggered_in_turn') === 'true';
                if (hasTriggered) return -1;
                
                const attackData = data.data as any;
                if (!attackData || !attackData.attackInfos) return -1;
                
                // 遍历所有攻击信息
                attackData.attackInfos.forEach((attackInfo: any) => {
                    if (attackInfo.finalDamage > 0) {
                        const sourceId = attackInfo.sourceId;
                        const source = battle.getEntity(sourceId);
                        if (source && source.teamId !== entity.teamId) {
                            // 计算眩晕概率
                            const baseProbability = 0.15;
                            const effectHit = battle.getComputedProperty(data.skillOwnerId, BattleProperties.EFT_HIT);
                            const finalProbability = baseProbability * (1 + effectHit);
                            
                            // 尝试添加眩晕buff
                            const stunBuff = buildStunBuff(data.skillOwnerId, sourceId, finalProbability);
                            battle.actionAddBuff(stunBuff, Reasons.SKILL);
                            
                            // 标记本回合已触发
                            entity.setData('yosh_triggered_in_turn', 'true');
                        }
                    }
                });
                
                return -1;
            },
            code: EventCodes.HAS_BEEN_ATTACKED, // 被攻击后事件
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '熊孩子看破',
        },
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return -1;
                
                // 重置触发标记
                entity.setData('yosh_triggered_in_turn', 'false');
                
                return -1;
            },
            code: EventCodes.TURN_START, // 回合开始事件
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '重置触发标记',
        },
    ],
};

/**
 * 义鸠樱子技能3：白眼
 * 主动技能，消耗3点鬼火
 * 攻击敌方单体目标3次，每次造成攻击22%伤害，每段有8%的基础概率（+效果命中）眩晕对手1回合（优先攻击敌方攻击高的选手）
 */
export const yoshizume_sakurako_skill3: Skill = {
    no: 3,
    name: '白眼',
    passive: false,
    cost: 3,
    target: (battle: Battle, sourceId: number): number[] => {
        const source = battle.getEntity(sourceId);
        if (!source) return [];
        
        const enemies = battle.getTeamEntities(1 - source.teamId);
        if (enemies.length === 0) return [];
        
        // 按攻击力排序，优先攻击攻击高的选手
        const sortedEnemies = enemies
            .filter(e => !e.dead)
            .sort((a, b) => {
                const aAtk = battle.getComputedProperty(a.entityId, BattleProperties.ATK);
                const bAtk = battle.getComputedProperty(b.entityId, BattleProperties.ATK);
                return bAtk - aAtk;
            });
        
        return sortedEnemies.length > 0 ? [sortedEnemies[0].entityId] : [];
    },
    text: '攻击敌方单体目标3次，每次造成攻击力22%的伤害，每段有8%基础概率（受效果命中加成）施加【眩晕】控制效果，持续1回合。优先攻击攻击力高的目标。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 计算眩晕概率
        const baseProbability = 0.08;
        const effectHit = battle.getComputedProperty(sourceId, BattleProperties.EFT_HIT);
        const finalProbability = baseProbability * (1 + effectHit);
        
        // 攻击3次
        for (let i = 0; i < 3; i++) {
            battle.actionAttack(
                Attack.build(selectedId, sourceId)
                    .rate(0.22)
                    .shouldComputeCri()
                    .single()
                    .skill('白眼')
                    .end()
            );
            
            // 每次攻击后尝试添加眩晕buff
            const stunBuff = buildStunBuff(sourceId, selectedId, finalProbability);
            battle.actionAddBuff(stunBuff, Reasons.SKILL);
        }
    },
};
