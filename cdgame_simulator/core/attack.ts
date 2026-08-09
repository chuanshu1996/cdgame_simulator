/**
 * 攻击系统核心文件
 * 定义攻击相关的类和方法
 */
import {AttackParams, Battle, BattleProperties} from "./index";
import {Processor} from "./task";

/**
 * 攻击构建器类
 * 用于链式创建攻击对象
 */
export class AttackBuilder {
    attack: Attack; // 内部攻击对象

    /**
     * 构造函数
     * @param attack 攻击对象
     */
    constructor(attack: Attack) {
        this.attack = attack;
    }

    /**
     * 结束构建，返回攻击对象
     * @returns 攻击对象
     */
    end(): Attack {
        return this.attack;
    }

    /**
     * 添加攻击参数
     * @param params 攻击参数
     * @returns 构建器实例
     */
    param(...params: AttackParams[]) {
        this.attack.params.push(...params);
        return this;
    }

    /**
     * 设置伤害浮动范围
     * @param n 浮动范围
     * @returns 构建器实例
     */
    FR(n: number) {
        this.attack.FR = n;
        return this;
    }

    /**
     * 设置伤害上限
     * @param limit 伤害上限，可以是固定值或函数
     * @returns 构建器实例
     */
    limit(limit: ((battle: Battle, sourceId: number, targetId: number) => number) | number) {
        this.attack.limit = limit;
        return this;
    }

    /**
     * 设置基础伤害来源
     * @param base 基础伤害来源，可以是属性名称或函数
     * @returns 构建器实例
     */
    base(base: ((battle: Battle, sourceId: number, targetId: number) => number) | string) {
        this.attack.base = base;
        return this;
    }

    /**
     * 设置伤害倍率
     * @param n 倍率值
     * @returns 构建器实例
     */
    rate(n: number) {
        this.attack.rate = n;
        return this;
    }

    /**
     * 设置攻击完成后的处理器
     * @param p 处理器函数
     * @returns 构建器实例
     */
    completed(p: Processor) {
        this.attack.completedProcessor = p;
        return this;
    }

    /**
     * 设置是否计算暴击
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    shouldComputeCri(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.SHOULD_COMPUTE_CRI);
        return this;
    }

    /**
     * 设置是否传导伤害
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    conduction(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.CONDUCTION);
        return this;
    }

    /**
     * 设置是否间接伤害
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    indirect(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.INDIRECT);
        return this;
    }

    /**
     * 设置是否真实伤害
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    real(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.REAL);
        return this;
    }

    /**
     * 设置是否暴击
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    critical(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.CRITICAL);
        return this;
    }

    /**
     * 设置是否普通攻击
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    normalAttack(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.SINGLE);
        this.attack.params.push(AttackParams.NORMAL_ATTACK);
        return this;
    }

    /**
     * 设置是否单体攻击
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    single(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.SINGLE);
        return this;
    }

    /**
     * 设置是否群体攻击
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    group(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.GROUP);
        return this;
    }

    /**
     * 设置是否忽略来源
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    ignoreSource(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.IGNORE_SOURCE);
        return this;
    }

    /**
     * 设置是否不共享伤害
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    noShare(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.NO_SHARE);
        return this;
    }

    /**
     * 设置是否忽略目标装备
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    noTargetEquipment(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.NO_TARGET_EQUIPMENT);
        return this;
    }

    /**
     * 设置是否忽略目标被动
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    noEargetPassive(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.NO_TARGET_PASSIVE);
        return this;
    }

    /**
     * 设置是否忽略来源装备
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    noSourceEquipment(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.NO_SOURCE_EQUIPMENT);
        return this;
    }

    /**
     * 设置是否忽略来源被动
     * @param isAdd 是否添加该参数
     * @returns 构建器实例
     */
    noSourcePassive(isAdd: boolean = true) {
        if(!isAdd) return this;
        this.attack.params.push(AttackParams.NO_SOURCE_PASSIVE);
        return this;
    }

    /**
     * 设置技能名称
     * @param name 技能名称
     * @returns 构建器实例
     */
    skill(name: string) {
        this.attack.skillName = name;
        return this;
    }

}

/**
 * 攻击类
 * 定义攻击的基本属性和方法
 */
export default class Attack {
    targetId: number; // 目标ID
    sourceId: number; // 来源ID
    base: ((battle: Battle, sourceId: number, targetId: number) => number) | string; // 基础数值来源
    limit?: ((battle: Battle, sourceId: number, targetId: number) => number) | number; // 伤害上限
    rate: number; // 倍率
    completedProcessor?: Processor; // 完成后触发的处理者
    FR: number; // 伤害浮动范围
    params: AttackParams[] = []; // 攻击参数
    skillName?: string; // 技能名称

    /**
     * 检查是否有指定参数
     * @param p 攻击参数
     * @returns 是否有该参数
     */
    hasParam(p: AttackParams) {
        return this.params.includes(p);
    }

    /**
     * 添加攻击参数
     * @param p 攻击参数
     */
    addParam(p: AttackParams) {
        this.params.push(p);
    }

    /**
     * 构造函数
     * @param targetId 目标ID
     * @param sourceId 来源ID
     */
    constructor(targetId: number, sourceId: number) {
        this.targetId = targetId;
        this.sourceId = sourceId;
        this.base = BattleProperties.ATK; // 默认基础伤害来源为攻击力
        this.rate = 1; // 默认倍率为1
        this.FR = 0.01; // 默认浮动范围为0.01
        this.params = []; // 初始化参数数组
    }

    /**
     * 静态构建方法
     * @param targetId 目标ID
     * @param sourceId 来源ID
     * @returns 攻击构建器实例
     */
    static build(targetId: number, sourceId: number): AttackBuilder {
        return new AttackBuilder(new Attack(targetId, sourceId))
    }

}
