/**
 * 治疗处理器
 * 负责处理游戏中的治疗逻辑，包括治疗量计算、暴击判定等
 */
import {Attack, AttackInfo, AttackParams, Battle, BattleProperties, EventCodes, Healing, HealingParams} from '../index';
import healing from '../healing';
import {applyJudgeFlagHealMultiplier} from "../judge-flag";

/**
 * 治疗信息类
 * 存储治疗过程中的相关数据
 */
class HealingInfo {
    originHp: number = 0; // 原hp
    originValue: number = 0; // 基础治疗量
    healingDown: number = 0; // 减疗
    healingUp: number = 0; // 增疗
    finalValue: number = 0; // 最终治疗量
    critical: number = 0; // 暴击率
    criticalDamage: number = 0; // 暴击伤害
    isCri: boolean = false; // 是否暴击
    remainHp: number = 0; // 剩余生命值
}

/**
 * 治疗处理数据类
 * 存储治疗处理的相关信息
 */
export class HealingProcessing {
    index: number = 0; // 当前处理的治疗索引
    healingInfos: HealingInfo[] = []; // 治疗信息数组
    healings: Healing[] = []; // 治疗对象数组
}

/**
 * 治疗处理器函数
 * @param battle 战斗对象
 * @param data 治疗处理数据
 * @param step 处理步骤
 * @returns 下一步骤或结束标志
 */
export default function healingProcessor(battle: Battle, data: HealingProcessing, step: number): number {
    const healing = data.healings[data.index];
    if (!healing) return 0; // 没有治疗对象，出错

    const source = battle.getEntity(healing.sourceId); // 治疗来源
    const target = battle.getEntity(healing.targetId); // 治疗目标
    
    switch (step) {
        // 数据准备
        case 1: {
            const healingInfo = data.healingInfos[data.index] = new HealingInfo();

            // 获取治疗相关属性
            healingInfo.healingDown = battle.getComputedProperty(target.entityId, BattleProperties.HEALING_DOWN);
            healingInfo.healingUp = battle.getComputedProperty(source.entityId, BattleProperties.HEALING_UP);
            healingInfo.critical = battle.getComputedProperty(source.entityId, BattleProperties.CRI);
            healingInfo.criticalDamage = battle.getComputedProperty(source.entityId, BattleProperties.CRI_DMG);

            // 计算基础治疗量
            healingInfo.originValue = typeof healing.base === 'string' ?
                battle.getComputedProperty(target.entityId, BattleProperties.MAX_HP)
                : healing.base(battle, healing.sourceId, healing.targetId);
                
            // 触发治疗前事件
            battle.addEventProcessor(EventCodes.BEFORE_HEALING, healing.sourceId, data);

            return 2; // 进入暴击判定步骤
        }
        case 2: {
            // 检查是否需要计算暴击
            if (healing.hasParam(HealingParams.SHOULD_COMPUTE_CRI)) {
                return 3; // 进入暴击判定步骤
            }
            return 4; // 跳过暴击判定，直接进入治疗量计算步骤
        }
        case 3: {
            const healingInfo = data.healingInfos[data.index];
            if (!healingInfo) return 0; // 没有治疗信息，出错

            // 测试是否暴击
            healingInfo.isCri = healingInfo.isCri || battle.testHit(healingInfo.criticalDamage);
            // 添加暴击参数
            healing.addParam(HealingParams.CRITICAL);
            return 4; // 进入治疗量计算步骤
        }
        case 4: {
            const healingInfo = data.healingInfos[data.index];
            if (!healingInfo) return 0; // 没有治疗信息，出错

            // 计算最终治疗量
            healingInfo.finalValue = healingInfo.originValue * healing.rate * (1 - healingInfo.healingDown) * (1 + healingInfo.healingUp) * (healingInfo.isCri ? healingInfo.criticalDamage : 1);
            // 应用裁判旗治疗倍率
            healingInfo.finalValue = applyJudgeFlagHealMultiplier(battle, healingInfo.finalValue);
            // 保存原始生命值
            healingInfo.originHp = target.hp;
            // 计算剩余生命值，但不超过最大生命值上限
            const maxHp = target.getProperty(BattleProperties.MAX_HP);
            healingInfo.remainHp = Math.min(target.hp + healingInfo.finalValue, maxHp);
            // 实际治疗量可能因上限限制而减少
            healingInfo.finalValue = healingInfo.remainHp - target.hp;
            
            // 触发治疗前事件
            battle.addEventProcessor(EventCodes.WILL_HEAL, healing.sourceId, data);
            // 触发被治疗前事件
            battle.addEventProcessor(EventCodes.WILL_BE_HEALED, healing.targetId, data);
            return 5; // 进入治疗结算步骤
        }
        case  5: {
            const healingInfo = data.healingInfos[data.index];
            if (!healingInfo) return 0; // 没有治疗信息，出错
            
            // 更新目标生命值
            target.hp = healingInfo.remainHp;
            
            // 记录治疗数据
            const healAmount = Math.round(healingInfo.finalValue);
            if (source && healAmount > 0) {
                const currentHeal = Number(source.battleData.get('totalHeal')) || 0;
                source.battleData.set('totalHeal', String(currentHeal + healAmount));
            }
            
            // 记录治疗日志
            const sourceName = source ? source.name : '未知来源';
            const targetName = target ? target.name : '未知目标';
            const healSource = healing.skillName || '治疗技能';
            battle.addEventLog('heal', `${targetName}获得${healAmount}点生命值回复（来源：${healSource}）`, {
                sourceId: healing.sourceId,
                targetId: healing.targetId,
                healAmount: healAmount,
                isCritical: healingInfo.isCri
            });
            
            // 触发治疗后事件
            battle.addEventProcessor(EventCodes.HAS_HEALED, healing.sourceId, data);
            // 触发被治疗后事件
            battle.addEventProcessor(EventCodes.HAS_BEEN_HEALED, healing.targetId, data);
            return 6; // 进入下一个治疗处理步骤
        }
        case 6: {
            // 检查是否所有治疗都已处理完成
            if (data.index + 1 >= data.healingInfos.length) return -1; // 所有治疗处理完成
            data.index++; // 处理下一个治疗
            return 2; // 重新进入暴击判定步骤
        }
    }

    return 0; // 出错，结束处理
}
