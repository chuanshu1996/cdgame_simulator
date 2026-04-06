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
    BuffParams,
    Entity,
} from '../../';
import {SkillTarget} from '../../skill';

/**
 * 杉乃步技能1：女仆补给
 * 主动技能，消耗0点鬼火
 * 放弃攻击，转而为生命值最低的队友回复自身10%生命值的生命
 */
export const sugi_no_ayumu_skill1: Skill = {
    no: 1,
    name: '女仆补给',
    passive: false,
    cost: 0,
    target: SkillTarget.TEAM,
    text: '放弃攻击，转而为生命值最低的队友回复相当于自身10%最大生命值的生命。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 计算回复量：自身10%生命值
        const healAmount = battle.getComputedProperty(sourceId, BattleProperties.MAX_HP) * 0.1;
        
        // 找到生命值最低的队友
        let lowestHpEntity: Entity | null = null;
        let lowestHpPercent = 1;
        
        battle.getTeamEntities(source.teamId).forEach(entity => {
            if (entity.dead) return;
            const hpPercent = entity.hp / battle.getComputedProperty(entity.entityId, BattleProperties.MAX_HP);
            if (hpPercent < lowestHpPercent) {
                lowestHpPercent = hpPercent;
                lowestHpEntity = entity;
            }
        });
        
        if (lowestHpEntity) {
            // 回复生命值
            const entity = lowestHpEntity as any;
            const newHp = Math.min(entity.hp + healAmount, battle.getComputedProperty(entity.entityId, BattleProperties.MAX_HP));
            const actualHeal = newHp - entity.hp;
            entity.hp = newHp;
            
            battle.log(`【${source.name}】使用【女仆补给】为【${entity.name}】回复${Math.round(actualHeal)}点生命`);
            battle.addEventLog('skill', `【${source.name}】使用【女仆补给】为【${entity.name}】回复${Math.round(actualHeal)}点生命`, {
                sourceId: sourceId,
                targetId: entity.entityId,
                heal: actualHeal
            });
        }
    },
};

/**
 * 构建虚假之衣buff
 */
function buildFakeMoonBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('虚假之衣', 1)
        .noRemove() // 持续到游戏结束
        .ruleControlImmune() // 免疫控制效果
        .ruleDebuffImmune() // 免疫减益效果
        .buffAP(BattleProperties.DEF_NEG, EffectTypes.FIXED, 100) // 忽略敌方100点防御
        .buff()
        .end();
}

/**
 * 杉乃步技能2：虚假之月
 * 被动技能
 * 行动8回合后，获得【虚假之衣】buff
 */
export const sugi_no_ayumu_skill2: Skill = {
    no: 2,
    name: '虚假之月',
    passive: true,
    cost: 0,
    text: '被动技能。行动8回合后，获得【虚假之衣】buff，持续至战斗结束。【虚假之衣】：免疫减益效果和控制效果，攻击时忽略敌方100点防御。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return -1;
                
                // 获取当前行动次数
                const actionCount = entity.getBattleData('sugi_action_count') || '0';
                const count = parseInt(actionCount, 10) + 1;
                entity.setData('sugi_action_count', String(count));
                
                // 每行动8回合触发效果
                if (count % 8 === 0) {
                    // 获得虚假之衣buff
                    const buff = buildFakeMoonBuff(data.skillOwnerId, data.skillOwnerId);
                    battle.actionAddBuff(buff, Reasons.SKILL);
                    battle.log(`【${entity.name}】获得【虚假之衣】buff`);
                }
                
                return -1;
            },
            code: EventCodes.TURN_START, // 回合开始事件
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '虚假之月',
        },
    ],
};

/**
 * 杉乃步技能3：大扫除
 * 主动技能，消耗3点鬼火
 * 对全体敌方造成攻击力130%的伤害，并且有50%概率（可被效果命中加成）清除对方一个增益效果
 */
export const sugi_no_ayumu_skill3: Skill = {
    no: 3,
    name: '大扫除',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '对全体敌方造成攻击力130%的伤害，并有50%基础概率（受效果命中加成）清除目标1个增益效果。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 获取敌方所有目标
        const enemies = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
        
        enemies.forEach(enemy => {
            battle.actionAttack(
                Attack.build(enemy.entityId, sourceId)
                    .rate(1.3)
                    .shouldComputeCri()
                    .single()
                    .skill('大扫除')
                    .end()
            );
            
            // 50%概率清除对方一个增益效果
            const baseProbability = 0.5;
            const effectHit = battle.getComputedProperty(sourceId, BattleProperties.EFT_HIT);
            const finalProbability = baseProbability * (1 + effectHit);
            
            if (battle.testHit(finalProbability)) {
                // 查找敌方的增益buff
                const buffs = battle.buffs.filter(buff => 
                    buff.ownerId === enemy.entityId && 
                    buff.params.includes(BuffParams.BUFF) && 
                    !buff.params.includes(BuffParams.DEBUFF)
                );
                
                if (buffs.length > 0) {
                    // 随机选择一个增益buff并移除
                    const buffToRemove = battle.getRandomOne(buffs);
                    battle.actionRemoveBuff(buffToRemove, Reasons.SKILL);
                    battle.log(`【${source.name}】的【大扫除】清除了【${enemy.name}】的【${buffToRemove.name}】buff`);
                }
            }
        });
    },
};
