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
    Entity,
} from '../../';
import {SkillTarget} from '../../skill';
import {HeroTable} from '../index';

/**
 * 构建女士套餐debuff
 */
function buildLadySetDebuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('女士套餐', 1)
        .countDown(1)
        .debuff()
        .end();
}

/**
 * 构建料理补给buff
 * 持续到游戏结束，触发效果后会被消耗
 */
function buildCookingSupplyBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('料理补给', 1)
        .noRemove() // 持续到游戏结束
        .buff()
        .end();
}

/**
 * 须贺京太郎技能1：男主立直
 * 主动技能，消耗0点鬼火
 * 对单体目标造成100%攻击伤害（对女性角色造成200%攻击伤害）
 */
export const suga_kyotaro_skill1: Skill = {
    no: 1,
    name: '男主立直',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '男主气势汹汹立直，对单体目标造成100%攻击伤害（对女性角色造成200%攻击伤害）。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const target = battle.getEntity(selectedId);
        if (!target) return;
        
        // 判断目标是否为女性角色
        const targetData = HeroTable.get(target.no);
        const isFemale = targetData && targetData.sex === '女';
        const damageRate = isFemale ? 2.0 : 1.0;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(damageRate)
                .shouldComputeCri()
                .single()
                .skill('男主立直')
                .end()
        );
        
        if (isFemale) {
            battle.log(`【${source.name}】对女性角色【${target.name}】造成双倍伤害！`);
        }
    },
};

/**
 * 须贺京太郎技能2：女士套餐
 * 被动技能
 * 先机为所有女性敌方角色增加一个debuff【女士套餐】，持续1回合。【女士套餐】：回合结束时减少10%血量
 */
export const suga_kyotaro_skill2: Skill = {
    no: 2,
    name: '女士套餐',
    passive: true,
    cost: 0,
    text: '被动技能。先机为所有女性敌方角色施加debuff【女士套餐】，持续1回合。【女士套餐】：debuff持续时间结束时，减少目标10%最大生命值。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 为所有女性敌方角色添加女士套餐debuff
                const enemies = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
                enemies.forEach(enemy => {
                    const enemyData = HeroTable.get(enemy.no);
                    if (enemyData && enemyData.sex === '女') {
                        const debuff = buildLadySetDebuff(data.skillOwnerId, enemy.entityId);
                        battle.actionAddBuff(debuff, Reasons.SKILL);
                        battle.log(`【${source.name}】对【${enemy.name}】使用【女士套餐】`);
                        battle.addEventLog('skill', `【${source.name}】对【${enemy.name}】施加【女士套餐】debuff`, {
                            sourceId: data.skillOwnerId,
                            targetId: enemy.entityId,
                            buffName: '女士套餐',
                            duration: 1
                        });
                    }
                });
                
                return -1;
            },
            code: EventCodes.SENKI, // 先机事件
            range: EventRange.ENEMY,
            priority: 50,
            passive: true,
            name: '女士套餐',
        },
        {
            handle(battle: Battle, data: RealEventData) {
                // data.eventId 是buff所有者的ID
                // data.data 是 RemoveBuffProcessing 对象
                if (!data.eventId) return -1;
                
                const entity = battle.getEntity(data.eventId);
                if (!entity || entity.dead) return -1;
                
                // 获取移除的buff信息
                const removeData = data.data as any;
                if (!removeData || !removeData.buff) return -1;
                
                const removedBuff = removeData.buff;
                
                // 只处理女士套餐debuff的移除
                if (removedBuff.name !== '女士套餐') return -1;
                
                // 只有因为时间到了自然消失才触发效果
                if (removeData.reason === Reasons.TIME_OUT) {
                    // 减少10%血量
                    const maxHp = battle.getComputedProperty(data.eventId, BattleProperties.MAX_HP);
                    const damage = maxHp * 0.1;
                    const newHp = Math.max(entity.hp - damage, 0);
                    entity.hp = newHp;
                    
                    battle.log(`【${entity.name}】因【女士套餐】减少${Math.round(damage)}点生命`);
                    battle.addEventLog('skill', `【${entity.name}】的【女士套餐】debuff结算，减少${Math.round(damage)}点生命`, {
                        entityId: data.eventId,
                        damage: damage,
                        remainingHp: entity.hp
                    });
                }
                
                return -1;
            },
            code: EventCodes.BUFF_REMOVE, // buff移除事件
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '女士套餐效果',
        },
    ],
};

/**
 * 须贺京太郎技能3：料理补给
 * 主动技能，消耗1点鬼火
 * 为攻击最高的队友添加一个【料理补给】buff，持续1回合。【料理补给】：使用鬼火技能后返还一半鬼火数量，并回复自身2%乘以使用鬼火数量的生命
 */
export const suga_kyotaro_skill3: Skill = {
    no: 3,
    name: '料理补给',
    passive: false,
    cost: 1,
    target: SkillTarget.TEAM,
    text: '为攻击最高的队友添加【料理补给】buff，持续至战斗结束。【料理补给】：buff拥有者使用消耗鬼火的技能后，消耗掉该buff，返还消耗鬼火数量的一半（向下取整），并回复自身（2%×消耗鬼火数量）的最大生命值。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 找到攻击最高的队友
        let highestAtkEntity: Entity | null = null;
        let highestAtk = 0;
        
        battle.getTeamEntities(source.teamId).forEach(entity => {
            if (entity.dead) return;
            const atk = battle.getComputedProperty(entity.entityId, BattleProperties.ATK);
            if (atk > highestAtk) {
                highestAtk = atk;
                highestAtkEntity = entity;
            }
        });
        
        if (highestAtkEntity) {
            // 添加料理补给buff
            const entity = highestAtkEntity as any;
            const buff = buildCookingSupplyBuff(sourceId, entity.entityId);
            battle.actionAddBuff(buff, Reasons.SKILL);
            battle.log(`【${source.name}】为【${entity.name}】提供【料理补给】（持续至战斗结束）`);
            battle.addEventLog('skill', `【${source.name}】为【${entity.name}】施加【料理补给】buff（持续至战斗结束）`, {
                sourceId: sourceId,
                targetId: entity.entityId,
                buffName: '料理补给',
                duration: -1 // -1表示持续至战斗结束
            });
        }
    },
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) {
                    battle.log(`【料理补给】调试：找不到实体 skillOwnerId=${data.skillOwnerId}`);
                    return -1;
                }
                
                // 检查是否有料理补给buff
                const cookingSupplyBuffs = battle.buffs.filter(buff => 
                    buff.name === '料理补给' && buff.ownerId === data.skillOwnerId
                );
                
                battle.log(`【料理补给】调试：角色=${entity.name}，buff数量=${cookingSupplyBuffs.length}，eventId=${data.eventId}`);
                
                if (cookingSupplyBuffs.length > 0) {
                    const skillData = data.data as any;
                    battle.log(`【料理补给】调试：skillData=${JSON.stringify(skillData)}，cost=${skillData?.cost}`);
                    
                    if (skillData && skillData.cost && skillData.cost > 0) {
                        const cost = skillData.cost;
                        const refund = Math.floor(cost / 2);
                        
                        // 消耗掉料理补给buff
                        const buffToRemove = cookingSupplyBuffs[0];
                        battle.actionRemoveBuff(buffToRemove, Reasons.SKILL);
                        
                        // 返还鬼火
                        battle.actionUpdateMana(data.skillOwnerId, entity.teamId, refund, Reasons.SKILL);
                        
                        // 回复生命
                        const maxHp = battle.getComputedProperty(data.skillOwnerId, BattleProperties.MAX_HP);
                        const healAmount = maxHp * (0.02 * cost);
                        const newHp = Math.min(entity.hp + healAmount, maxHp);
                        const actualHeal = newHp - entity.hp;
                        entity.hp = newHp;
                        
                        battle.log(`【${entity.name}】消耗【料理补给】，返还${refund}点鬼火，并回复${Math.round(actualHeal)}点生命`);
                        battle.addEventLog('skill', `【${entity.name}】消耗【料理补给】：返还${refund}点鬼火，回复${Math.round(actualHeal)}点生命`, {
                            entityId: data.skillOwnerId,
                            manaRefund: refund,
                            healAmount: actualHeal,
                            costUsed: cost,
                            maxHp: maxHp
                        });
                    } else {
                        battle.log(`【料理补给】调试：cost条件不满足，cost=${skillData?.cost}`);
                    }
                }
                
                return -1;
            },
            code: EventCodes.SKILL, // 使用技能后事件
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '料理补给效果',
        },
    ],
};
