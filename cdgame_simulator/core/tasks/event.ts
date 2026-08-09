/**
 * 事件处理器
 * 负责处理游戏中的各种事件，如技能触发、状态变化等
 */
import {Battle, Control, EventCodes, Handler} from "../";

/**
 * 真实事件数据类
 * 存储事件触发的详细信息
 */
export class RealEventData {
    /**
     * 构造函数
     * @param skillOwnerId 技能拥有者ID
     * @param skillNo 技能编号
     * @param eventId 事件ID
     * @param handler 事件处理器
     * @param data 事件数据
     */
    constructor(
        public skillOwnerId: number, // 技能拥有者ID
        public skillNo: number, // 技能编号
        public eventId: number, // 事件ID
        public handler: Handler, // 事件处理器
        public data: any // 事件数据
    ) {}

}

/**
 * 事件处理数据类
 * 存储事件处理的相关信息
 */
export class EventProcessing {
    units: RealEventData[] = []; // 事件单元数组

    /**
     * 构造函数
     * @param code 事件代码
     */
    constructor(public code: EventCodes) {}
}

/**
 * 事件处理器函数
 * @param battle 战斗对象
 * @param data 事件处理数据
 * @param step 处理步骤
 * @returns 下一步骤或结束标志
 */
export default function eventProcessing(battle: Battle, data: EventProcessing, step: number): number {
    if (step <= 0) return 0; // 步骤无效，出错

    const units = data.units;
    if (step > units.length) return -1; // 所有事件处理完成
    
    const eventData = units[step - 1];
    if (!eventData) return 0; // 没有事件数据，出错
    if (!eventData.handler) return 0; // 没有事件处理器，出错

    const entity = battle.getEntity(eventData.skillOwnerId);
    
    // 被封印被动跳过处理
    if (eventData.handler.passive && battle.hasBuffByControl(eventData.skillOwnerId, Control.PASSIVE_FORBID)) {
        return step + 1; // 跳过当前事件，处理下一个
    }

    // 输出事件触发日志
    battle.log(`${entity.name}(${entity.entityId})的${eventData.skillNo}技能事件触发`);
    
    // 添加事件处理器
    battle.addProcessor(eventData.handler.handle, eventData, `EventProcess`);

    return step + 1; // 处理下一个事件
}