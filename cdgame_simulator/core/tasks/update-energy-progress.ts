/**
 * 能量进度更新处理器
 * 负责处理游戏中能量条进度的更新
 */
import {Battle, Reasons} from "../index";

/**
 * 能量进度更新处理数据类
 * 存储能量进度更新的相关信息
 */
export class UpdateEnergyProgressProcessing {
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
        reason: Reasons = Reasons.NOTHING // 更新原因
    ) {}
}

/**
 * 能量进度更新处理器函数
 * @param battle 战斗对象
 * @param data 能量进度更新处理数据
 * @param _ 步骤（未使用）
 * @returns 结束标志
 */
export default function updateEnergyProgressProcessor(battle: Battle, data: UpdateEnergyProgressProcessing, _: number): number {
    // TODO: 追月神用的事件
    const energy = battle.energys[data.teamId];
    if (!energy) return 0; // 没有能量对象，出错

    // 更新能量进度
    energy.progress = energy.progress + data.num;
    // 确保进度在合理范围内
    if (energy.progress < 0) energy.progress = 0;
    if (energy.progress > 5) energy.progress = 5;

    return -1; // 结束处理
}
