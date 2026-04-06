/**
 * 行动条更新处理器
 * 负责处理游戏中行动条位置的更新，如拉条、推条等
 */
import {Battle} from "../index";

/**
 * 行动条更新处理数据类
 * 存储行动条更新的相关信息
 */
export class UpdateRunWayProcessing{
    /**
     * 构造函数
     * @param sourceId 来源ID
     * @param targetId 目标ID
     * @param percent 更新百分比
     * @param reason 更新原因
     */
    constructor(
        public sourceId: number, // 来源ID
        public targetId: number, // 目标ID
        public percent: number, // 更新百分比
        public reason: number // 更新原因
    ) {}
}

/**
 * 行动条更新处理器函数
 * @param battle 战斗对象
 * @param data 行动条更新处理数据
 * @param _ 步骤（未使用）
 * @returns 结束标志或错误标志
 */
export default function updateRunWayProcessor(battle: Battle, data: UpdateRunWayProcessing, _: number) {
    // 调用行动条的updatePercent方法更新位置
    // 即使目标实体被冻结，也返回成功，避免因实体死亡导致的错误
    battle.runway.updatePercent(data.targetId, data.percent);
    return -1;
}