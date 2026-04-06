/**
 * 伪回合处理器
 * 负责处理游戏中的伪回合，如某些技能触发的额外行动
 */
import {Processor} from '../task';
import {Battle, Control, EventCodes} from '../index';

/**
 * 伪回合处理数据类
 * 存储伪回合的相关信息
 */
export class FakeTurnProcessing {
    cannotAction: boolean = false; // 是否无法行动
    onlyAttack: number = 0; // 只能攻击的目标ID
    confusion: boolean = false; // 是否混乱

    /**
     * 构造函数
     * @param processor 处理器函数
     * @param data 数据
     * @param currentId 当前实体ID
     */
    constructor(
        public processor: Processor, // 处理器函数
        public data: any, // 数据
        public currentId: number // 当前实体ID
    ) {}
}

/**
 * 伪回合处理器函数
 * @param battle 战斗对象
 * @param data 伪回合处理数据
 * @param step 处理步骤
 * @returns 下一步骤或结束标志
 */
export default function fakeTurnProcessor(battle: Battle, data: FakeTurnProcessing, step: number): number {
    const currentEntity = battle.getEntity(data.currentId);

    switch (step) {
        // 开始阶段
        case 1: {
            // 检查是否有控制效果导致无法行动
            data.cannotAction = battle.hasBuffByControl(
                currentEntity.entityId,
                Control.DIZZY, // 眩晕
                Control.SLEEP, // 睡眠
                Control.FROZEN, // 冰冻
                Control.POLYMORPH, // 变形
            );
            
            // 检查是否混乱
            data.confusion = battle.hasBuffByControl(currentEntity.entityId, Control.CONFUSION);
            
            // 检查是否被嘲讽
            battle.filterBuffByControl(currentEntity.entityId, Control.PROVOKE, Control.SNEER).forEach(buff => {
                data.onlyAttack = buff.sourceId;
            });
            
            // 如果实体已死亡，结束伪回合
            if (currentEntity.dead) return -1;

            // 输出伪回合开始日志
            battle.log(`伪回合 ${currentEntity.name}(${currentEntity.teamId})`);
            
            // 触发行动开始事件
            battle.addEventProcessor(EventCodes.ACTION_START, currentEntity.entityId, data);
            return 2; // 进入回合内处理
        }
        // 回合内
        case 2: {
            // 如果无法行动，直接进入回合结束
            if (data.cannotAction) return 3;
            
            // 添加处理器
            battle.addProcessor(data.processor, data, `伪回合${currentEntity.name}`);
            return 3; // 进入回合结束
        }
        // 回合结束
        case 3: {
            // 触发行动结束事件
            battle.addEventProcessor(EventCodes.ACTION_END, currentEntity.entityId, data);
            return -1; // 结束伪回合
        }
    }
    return 0; // 出错，结束处理
}
