import { Attack, AttackParams, Battle, Handler, Skill} from '../../';
import {SkillTarget} from "../../skill";

/**
 * 单体多段攻击技能类
 * 实现Skill接口，用于创建可以触发暴击的普通伤害技能
 */
export default class SingleAttack implements Skill {
    /** 技能编号 */
    no: number;
    /** 技能处理器数组 */
    handlers: Handler[] = [];
    /** 是否为被动技能 */
    passive: boolean = false;
    /** 技能名称 */
    name: string;
    /** 技能描述 */
    text?: string;
    /** 技能消耗 */
    cost: number;
    /** 伤害倍率 */
    rate: number;
    /** 攻击次数 */
    times: number;
    /** 是否为普通攻击 */
    isNormalAttack: boolean;
    /** 基础命中值 */
    FR: number;
    /** 技能目标类型，默认为敌方 */
    target: SkillTarget = SkillTarget.ENEMY;

    /**
     * 构造函数
     * @param no 技能编号
     * @param name 技能名称
     * @param rate 伤害倍率
     * @param cost 技能消耗
     * @param times 攻击次数，默认为1
     * @param isNormalAttack 是否为普通攻击，默认为false
     * @param FR 基础命中值，默认为0.01
     */
    constructor(no: number, name: string, rate: number, cost: number, times: number = 1, isNormalAttack: boolean = false, FR: number = 0.01) {
        this.no = no;
        this.name = name;
        this.cost = cost;
        this.rate = rate;
        this.times = times;
        this.isNormalAttack = isNormalAttack;
        this.FR = FR;
    }

    /**
     * 使用技能
     * @param battle 战斗实例
     * @param sourceId 技能释放者ID
     * @param selectedId 目标ID
     * @description 根据攻击次数创建多个单体攻击，每次攻击都会计算暴击
     */
    use(battle: Battle, sourceId: number, selectedId: number) {
        // 循环创建指定次数的攻击
        for (let i = 0; i < this.times; i++) {
            // 构建攻击实例并执行
            battle.actionAttack(
                Attack.build(selectedId, sourceId)
                    .rate(this.rate) // 设置伤害倍率
                    .FR(this.FR) // 设置基础命中
                    .shouldComputeCri() // 启用暴击计算
                    .single() // 单体攻击
                    .normalAttack(this.isNormalAttack) // 设置是否为普通攻击
                    .skill(this.name) // 设置技能名称
                    .end() // 完成构建
            );
        }
    }
}
