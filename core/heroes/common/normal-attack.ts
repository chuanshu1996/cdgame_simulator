/**
 * 普通攻击类
 * 所有选手的基础攻击技能
 */
import SingleAttack from './single-attack';

/**
 * 普通攻击类
 * 继承自SingleAttack，实现了所有选手的基础攻击技能
 */
export default class NormalAttack extends SingleAttack {
    /**
     * 构造函数
     * @param name 技能名称，默认为'normal attack'
     * @param rate 伤害倍率，默认为1.25
     * @param FR 伤害浮动范围，默认为0.01
     */
    constructor(name = 'normal attack', rate = 1.25, FR = 0.01) {
        // 调用父类构造函数
        // 参数：技能编号、技能名称、伤害倍率、消耗鬼火、技能顺序、是否计算暴击、伤害浮动范围
        super(1, name, rate, 0, 1, true, FR);
    }
}
