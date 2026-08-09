/**
 * 伪回合处理器
 * 严格对应《回合结算过程3.0》"伪回合"流程：
 *   - 核心特征：触发时行动条位置【不动】。
 *   - 三类来源：
 *       A类：反击（如御馔津〔一矢·封魔〕在敌方行动结束后触发）
 *       B类：开场（如某些式神开场立即行动一次）
 *       C类：追击（如普攻后追加一次伤害）
 *   - 伪回合优先于额外回合与普通回合。
 *   - 伪回合【跳过】资源（能量）进度推进段（文档步骤7）。
 */
import {Processor} from '../task';
import {Battle, Control, EventCodes} from '../index';

/** 伪回合来源分类 */
export type FakeTurnType = 'A' | 'B' | 'C' | 'NORMAL';

/**
 * 伪回合处理数据类
 * 存储伪回合的相关信息
 */
export class FakeTurnProcessing {
    cannotAction: boolean = false; // 是否无法行动
    onlyAttack: number = 0; // 只能攻击的目标ID
    confusion: boolean = false; // 是否混乱
    fakeType: FakeTurnType; // 伪回合来源分类（A/B/C/NORMAL）

    /**
     * 构造函数
     * @param processor 处理器函数
     * @param data 数据
     * @param currentId 当前实体ID
     * @param fakeType 伪回合来源分类，默认 NORMAL（兼容旧调用）
     */
    constructor(
        public processor: Processor, // 处理器函数
        public data: any, // 数据
        public currentId: number, // 当前实体ID
        fakeType: FakeTurnType = 'NORMAL'
    ) {
        this.fakeType = fakeType;
    }
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
            // 检查是否有控制效果导致无法行动（变形/眩晕/冻结/睡眠 不可行动）
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

            // 输出伪回合开始日志（区分 A/B/C 类型）
            const fakeTypeText = ({
                'A': '反击',
                'B': '开场',
                'C': '追击',
                'NORMAL': '伪',
            } as Record<FakeTurnType, string>)[data.fakeType];
            battle.log(`伪回合(${fakeTypeText}) ${currentEntity.name}(${currentEntity.teamId})`);
            battle.addEventLog('turn', `队伍${currentEntity.teamId}·${currentEntity.name}的伪回合(${fakeTypeText})开始`, {
                judgeRound: battle.judgeRound,
                actionSeq: battle.actionSeq,
                teamId: currentEntity.teamId,
                entityId: currentEntity.entityId,
                turnType: 'pseudo',
                fakeType: data.fakeType,
            });

            // B类（开场）伪回合不触发常规 ACTION_START 伤害前置段，仅触发基础事件
            if (data.fakeType !== 'B') {
                battle.addEventProcessor(EventCodes.ACTION_START, currentEntity.entityId, data);
            }
            return 2; // 进入回合内处理
        }
        // 回合内
        case 2: {
            // 伪回合【跳过】资源（能量）进度推进段（对应文档步骤7），直接执行实际技能
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
            // 伪回合不改变行动条位置（文档：触发时行动条位置不动），无需重置
            return -1; // 结束伪回合
        }
    }
    return 0; // 出错，结束处理
}
