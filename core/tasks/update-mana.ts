/**
 * 鬼火更新处理器
 * 负责处理游戏中鬼火数量的更新
 */
import {EventCodes, Reasons} from "../constant";
import {Battle} from "../index";

/**
 * 鬼火更新处理数据类
 * 存储鬼火更新的相关信息
 */
export class UpdateNanaProcessing {
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
 * 鬼火更新处理器函数
 * @param battle 战斗对象
 * @param data 鬼火更新处理数据
 * @param _ 步骤（未使用）
 * @returns 结束标志
 */
export default function updateManaProcessor(battle: Battle, data: UpdateNanaProcessing, _: number) {
    const mana = battle.manas[data.teamId];
    if (!mana) return 0; // 没有鬼火对象，出错
    
    // 更新鬼火数量
    mana.num = mana.num + data.num;
    
    // 检查鬼火数量是否合法
    if (mana.num < 0) return 0; // 鬼火数量不能为负，出错
    
    // 检查鬼火是否溢出
    if (mana.num > 8) {
        mana.num = 8; // 鬼火上限为8
        // 触发鬼火溢出事件
        battle.addEventProcessor(EventCodes.MANA_OVERFLOW, 0, data);
    }
    
    return -1; // 结束处理
}