/**
 * 等待输入处理器
 * 负责处理游戏中需要手动输入的情况，如玩家选择技能和目标
 */
import Battle from "../battle";
import {SelectableSkill, SkillSelection} from "../skill";

/**
 * 等待输入处理数据类
 * 存储等待输入的相关信息
 */
export class WaitInputProcessing{
    selection: SkillSelection | null = null; // 技能选择
    /**
     * 当前需要做出选择的实体ID。
     * 驱动方（AI/玩家输入）依赖它来判断"现在轮到谁行动"。
     * 缺失时驱动方会退回 battle.currentId（该字段恒为0），
     * 导致用错误的实体去查询AI与技能。
     */
    currentId: number;

    /**
     * 构造函数
     * @param skills 可选技能列表
     * @param currentId 当前行动的实体ID
     */
    constructor(public skills: SelectableSkill[], currentId: number) {
        this.currentId = currentId;
    }
}

/**
 * 等待输入处理器函数
 * @param battle 战斗对象
 * @param data 等待输入处理数据
 * @param step 处理步骤
 * @returns 结束标志或继续等待
 */
export default function waitInputProcessor(battle: Battle, data: WaitInputProcessing, step: number) {
    switch (step) {
        case 1: {
            // 如果已经有选择，结束处理
            if (data.selection) return -1;
            // 否则继续等待输入
            return 1;
        }
    }
    return; // 结束处理
}