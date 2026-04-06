/**
 * 技能系统核心文件
 * 定义技能相关的接口和枚举
 */
import Handler from './handler';
import Battle from './battle';

/**
 * 技能目标类型枚举
 */
export enum SkillTarget {
    ENEMY, // 敌方
    TEAM, // 友方
    SELF, // 自身
}

/**
 * 技能接口
 * 定义技能的基本属性和方法
 */
export default interface Skill {
    no: number; // 技能编号
    name: string; // 技能名称
    cost: ((battle: Battle, entityId: number) => number) | number;  // 支付代价，可以是固定值或函数
    hide?: boolean; // 是否隐藏
    handlers?: Handler[]; // 其他handler，用于处理各种事件
    passive?: boolean; // 是否是被动技能
    text?: string; // 技能描述
    target?: ((battle: Battle, entityId: number) => number[]) | SkillTarget; // 目标选择，可以是函数或枚举
    use?: (battle: Battle, sourceId: number, selectedId: number) => number | void; // 实际效果，使用技能时触发
    reserveValid?: boolean; // 是否在替补/应援位置也生效
    limited?: boolean; // 是否为限定技（整场战斗只能使用一次）
}

/**
 * 可选技能接口
 * 用于AI选择技能时的选项
 */
export interface SelectableSkill {
    no: number; // 技能编号
    targets: number[]; // 可选目标ID数组
    cost: number; // 消耗鬼火
    name: string; // 技能名称
}

/**
 * 技能选择接口
 * 用于表示AI或玩家的技能选择
 */
export interface SkillSelection {
    no: number; // 技能编号
    targetId: number; // 目标ID
}
