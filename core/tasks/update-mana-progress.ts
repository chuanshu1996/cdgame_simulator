/**
 * 鬼火进度更新处理器
 * 负责处理游戏中鬼火条进度的更新
 */
import {Battle, Reasons} from "../index";

/**
 * 鬼火进度更新处理数据类
 * 存储鬼火进度更新的相关信息
 */
export class UpdateManaProgressProcessing {
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
 * 鬼火进度更新处理器函数
 * @param battle 战斗对象
 * @param data 鬼火进度更新处理数据
 * @param _ 步骤（未使用）
 * @returns 结束标志
 */
export default function updateManaProgreassProcessor(battle: Battle, data: UpdateManaProgressProcessing, _: number): number {
    // TODO: 追月神用的事件
    const mana = battle.manas[data.teamId];
    if (!mana) return 0; // 没有鬼火对象，出错
    
    // 更新鬼火进度
    mana.progress = mana.progress + data.num;
    // 确保进度在合理范围内
    if (mana.progress < 0) mana.progress = 0;
    if (mana.progress > 5) mana.progress = 5;
    
    return -1; // 结束处理
}