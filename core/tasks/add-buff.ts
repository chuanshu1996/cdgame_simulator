/**
 * 添加Buff任务处理器
 * 负责处理Buff的添加逻辑，包括命中计算、抵抗判定等
 */
import {Battle, BattleProperties, BuffParams, EventCodes, Reasons} from "../index";
import Buff from "../buff";

/**
 * 添加Buff处理数据类
 * 存储添加Buff过程中的相关数据
 */
export class AddBuffProcessing {
    isHit: boolean = false; // 是否命中
    isRes: boolean = false; // 是否抵抗
    cancel: boolean = false; // 是否取消

    /**
     * 构造函数
     * @param buff 要添加的Buff
     * @param reason 添加Buff的原因
     */
    constructor(public buff: Buff, public reason: Reasons) {

    }
}

/**
 * 添加Buff处理器函数
 * @param battle 战斗对象
 * @param data 添加Buff处理数据
 * @param step 处理步骤
 * @returns 下一步骤或结束标志
 */
export default function addBuffProcessor(battle: Battle, data: AddBuffProcessing, step: number) {
    const buff = data.buff;
    const target = buff.ownerId < 0 ? null: battle.getEntity(buff.ownerId); // 目标实体，全局Buff为null
    const source = battle.getEntity(buff.sourceId); // 来源实体

    switch (step) {
        // 数据准备
        case 1: {
            battle.log(`${source ? `【${source.name}(${source.teamId})】` : ''} 准备对`,
                target ? `【${target.name}(${target.teamId})】` : '全局',
                `添加 【${buff.name}】 Buff`,
                buff.countDown  ? (buff.hasParam(BuffParams.COUNT_DOWN_BY_SOURCE) ? '维持' : '持续') + buff.countDown + '回合'  : '');
            // 触发添加Buff事件
            battle.addEventProcessor(EventCodes.ADD_BUFF, buff.ownerId, data);
            return 2;
        }
        case 2: {
            if (data.cancel) { // buff被抵消了  庇护 花鸟卷
                return -1; // 结束处理
            }

            // 检查免疫效果
            if (target) {
                // 检查减益免疫
                if (buff.hasParam(BuffParams.DEBUFF) && battle.hasBuffByParam(target.entityId, BuffParams.RULE_DEBUFF_IMMUNE)) {
                    battle.log(`【${target.name}】免疫减益效果，【${buff.name}】无效`);
                    return -1; // 免疫减益，结束处理
                }
                
                // 检查控制免疫
                if (buff.hasParam(BuffParams.CONTROL) && battle.hasBuffByParam(target.entityId, BuffParams.RULE_CONTROL_IMMUNE)) {
                    battle.log(`【${target.name}】免疫控制效果，【${buff.name}】无效`);
                    return -1; // 免疫控制，结束处理
                }
            }

            if (buff.hasParam(BuffParams.SHOULD_COMPUTE_PROBABILITY)) { // 需要计算概率
                return 3; // 进入命中计算步骤
            }
            return 4; // 跳过命中计算，直接进入下一步
        }
        // 命中计算
        case 3: {
            if (!target) return 0; // 全局Buff不需要命中计算
            if (typeof buff.probability !== 'number') return 0; // 没有概率值，出错

            // 计算命中概率：基础命中×（1+效果命中）
            const p = buff.probability * (1 + battle.getComputedProperty(source.entityId, BattleProperties.EFT_HIT) / 100);
            const isHit = data.isHit = battle.testHit(p);
            if (!isHit) return -1; // 未命中，结束处理
            
            // 计算抵抗概率：(1 + 效果抵抗)
            const res = 1 + battle.getComputedProperty(target.entityId, BattleProperties.EFT_RES) / 100;
            const isRes = data.isRes = battle.testHit(p / res);
            if (isRes) { // 抵抗了
                battle.addEventProcessor(EventCodes.BUFF_RES, target.entityId, data);
            }
            return 4; // 进入下一步
        }
        case 4: {
            // 触发获得Buff前事件
            battle.addEventProcessor(EventCodes.BEFORE_BUFF_GET, buff.ownerId, data);
            return 5; // 进入添加Buff步骤
        }
        case 5: {
            // 替换同名buff
            if (buff.maxCount && buff.maxCount > 0 && buff.name) {
                const sameBuffs = battle.buffs.filter(b => b.ownerId === buff.ownerId && b.name === buff.name);
                if (sameBuffs.length >= buff.maxCount) {
                    const index = battle.buffs.indexOf(sameBuffs[0]);
                    if (index === -1) return -1; // 找不到Buff，结束处理
                    battle.buffs.splice(index, 1); // 移除最早的同名Buff
                }
            }
            
            // 添加Buff到战斗中
            battle.buffs.push(buff);
            
            // 添加Buff到待合并日志（而不是直接输出）
            const targetName = target ? target.name : '全局';
            const sourceName = source ? source.name : '系统';
            battle.addPendingBuff(
                buff.sourceId,
                sourceName,
                buff.ownerId,
                targetName,
                buff.name,
                buff.maxCount,
                buff.effects && buff.effects.length > 0 ? buff.effects[0] : undefined
            );
            
            // 触发获得Buff事件
            battle.addEventProcessor(EventCodes.BUFF_GET, buff.ownerId, data);
            return -1; // 结束处理
        }
    }
    return 0; // 出错，结束处理
}