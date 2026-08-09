/**
 * 能量更新处理器
 * 负责处理游戏中能量数量的更新
 */
import {EventCodes, Reasons} from "../constant";
import {Battle} from "../index";

/**
 * 能量更新处理数据类
 * 存储能量更新的相关信息
 */
export class UpdateEnergyProcessing {
    /**
     * 构造函数
     * @param sourceId 来源ID
     * @param teamId 队伍ID
     * @param num 更新数量
     * @param reason 更新原因
     */
    constructor(
        public sourceId: number, // 来源ID
        public teamId: number, // 队伍ID
        public num: number, // 更新数量
        public reason: Reasons = Reasons.NOTHING // 更新原因
    ) {
    }
}

/**
 * 能量更新处理器函数
 * @param battle 战斗对象
 * @param data 能量更新处理数据
 * @param _ 步骤（未使用）
 * @returns 结束标志
 */
export default function updateEnergyProcessor(battle: Battle, data: UpdateEnergyProcessing, _: number) {
    const energy = battle.energys[data.teamId];
    if (!energy) return 0; // 没有能量对象，出错

    // 更新能量数量
    energy.num = energy.num + data.num;

    // 检查能量数量是否合法
    if (energy.num < 0) return 0; // 能量数量不能为负，出错

    // 检查能量是否溢出
    if (energy.num > 8) {
        energy.num = 8; // 能量上限为8
        // 触发能量溢出事件
        battle.addEventProcessor(EventCodes.ENERGY_OVERFLOW, 0, data);
    }

    return -1; // 结束处理
}
