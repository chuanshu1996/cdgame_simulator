/**
 * 移除Buff处理器
 * 负责处理Buff的移除逻辑，包括触发相关事件等
 */
import {Battle, BuffParams, EventCodes, Reasons} from "../index";
import Buff from "../buff";

/**
 * 移除Buff处理数据类
 * 存储移除Buff过程中的相关数据
 */
export class RemoveBuffProcessing {
    /**
     * 构造函数
     * @param buff 要移除的Buff
     * @param reason 移除Buff的原因
     */
    constructor(public buff: Buff, public reason: Reasons) {

    }
}

/**
 * 移除Buff处理器函数
 * @param battle 战斗对象
 * @param data 移除Buff处理数据
 * @param step 处理步骤
 * @returns 下一步骤或结束标志
 */
export default function removeBuffProcessor(battle: Battle, data: RemoveBuffProcessing, step: number) {

    const buff = data.buff;

    // 查找Buff在数组中的索引
    const index = battle.buffs.indexOf(buff);
    if (index === -1) return -1; // Buff不存在，结束处理
    
    switch (step) {
        case 1: {
            // 触发Buff移除前事件
            battle.addEventProcessor(EventCodes.BEFORE_BUFF_REMOVE, buff.ownerId, data);
            return 2; // 进入移除Buff步骤
        }
        case 2: {
            // 获取Buff所有者
            const target = buff.ownerId  == -1? battle.getEntity(buff.ownerId) : null;
            // 输出Buff移除日志
            battle.log(
                target ? `【${target.name}(${target.teamId})】` : '全局',
                `失去 【${buff.name}】 Buff`);
            // 从Buff数组中移除
            battle.buffs.splice(index, 1);

            // 触发Buff移除事件
            battle.addEventProcessor(EventCodes.BUFF_REMOVE, buff.ownerId, data);
            return -1; // 结束处理
        }
    }
    return 0; // 出错，结束处理
}