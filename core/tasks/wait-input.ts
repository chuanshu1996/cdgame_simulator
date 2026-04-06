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
     * 构造函数
     * @param skills 可选技能列表
     */
    constructor(public skills: SelectableSkill[]) {

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