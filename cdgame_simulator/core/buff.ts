/**
 * Buff系统核心文件
 * 定义Buff相关的类和接口
 */
import {BuffParams, Control} from './constant';

/**
 * 效果类型枚举
 */
export const enum EffectTypes {
    FIXED, // 增加固定数值value
    SET,  // 设置为value
    ADD_RATE, // 增加倍率
    MAX, // 取最大
    MIN, // 取最小
}

/**
 * 效果接口
 * 定义属性影响效果
 */
export interface Effect {
    propertyName: string; // 属性名
    value: number; // 值   | ((battle: Battle, ownerId: number)=> number)
    effectType: EffectTypes; // 效果类型
}

// Buff计数器，用于生成唯一的Buff ID
let buffCounter = 0;

/**
 * Buff构建器类
 * 用于链式创建Buff对象
 */
export class BuffBuilder {
    public _buff: Buff; // 内部Buff对象

    /**
     * 构造函数
     * @param sourceId 来源实体ID
     * @param owner 所有者实体ID
     */
    constructor(sourceId: number, owner: number) {
        this._buff = new Buff(sourceId, owner);
    }

    /**
     * 添加护盾效果
     * @param num 护盾值
     * @returns 构建器实例
     */
    shield(num: number) {
        this._buff.shield = num;
        this._buff.params.push(BuffParams.SHIELD);
        return this;
    }

    /**
     * 添加图标
     * @param uri 图标URI
     * @returns 构建器实例
     */
    icon(uri: string) {
        this._buff.icon = uri;
        this._buff.params.push(BuffParams.VISIBLE);
        return this;
    }

    /**
     * 添加概率效果
     * @param probability 概率值
     * @returns 构建器实例
     */
    probability(probability: number) {
        this._buff.probability = probability;
        this._buff.params.push(BuffParams.SHOULD_COMPUTE_PROBABILITY);
        return this;
    }

    /**
     * 添加不可驱散属性
     * @returns 构建器实例
     */
    noDispel() {
        this._buff.params.push(BuffParams.NO_DISPEL);
        return this;
    }

    /**
     * 添加不可移除属性
     * @returns 构建器实例
     */
    noRemove() {
        this._buff.params.push(BuffParams.NO_REMOVE);
        return this;
    }

    /**
     * 添加印记属性（不可驱散、不可移除）
     * @returns 构建器实例
     */
    stamp() {
        this._buff.params.push(BuffParams.STAMP);
        this._buff.params.push(BuffParams.NO_DISPEL);
        this._buff.params.push(BuffParams.NO_REMOVE);
        return this;
    }

    /**
     * 添加结界属性（不可驱散、不可移除）
     * @returns 构建器实例
     */
    enchantment() {
        this._buff.params.push(BuffParams.ENCHANTMENT);
        this._buff.params.push(BuffParams.NO_DISPEL);
        this._buff.params.push(BuffParams.NO_REMOVE);
        return this;
    }

    /**
     * 添加幻境属性（不可驱散、不可移除）
     * @returns 构建器实例
     */
    fairyland() {
        this._buff.params.push(BuffParams.FAIRYLAND);
        this._buff.params.push(BuffParams.NO_DISPEL);
        this._buff.params.push(BuffParams.NO_REMOVE);
        return this;
    }

    /**
     * 添加倒计时效果
     * @param num 倒计时回合数
     * @returns 构建器实例
     */
    countDown(num: number) {
        this._buff.countDown = num;
        this._buff.params.push(BuffParams.COUNT_DOWN);
        return this;
    }

    /**
     * 添加基于来源的倒计时效果
     * @param num 倒计时回合数
     * @returns 构建器实例
     */
    countDownBySource(num: number) {
        this._buff.countDown = num;
        this._buff.params.push(BuffParams.COUNT_DOWN_BY_SOURCE);
        return this;
    }

    /**
     * 设置Buff名称和最大数量
     * @param name Buff名称
     * @param maxCount 同名最大持有数量，0表示无限制
     * @returns 构建器实例
     */
    name(name: string, maxCount?: number) {
        this._buff.name = name;
        if (typeof maxCount === 'number') this._buff.maxCount = maxCount;
        return this;
    }

    /**
     * 添加控制效果
     * @param control 控制类型
     * @returns 构建器实例
     */
    control(control: Control) {
        this._buff.control = control;
        this._buff.params.push(BuffParams.CONTROL);
        return this;
    }
    
    /**
     * 添加Buff属性
     * @returns 构建器实例
     */
    buff() {
        this._buff.params.push(BuffParams.BUFF);
        return this;
    }

    /**
     * 添加Debuff属性
     * @returns 构建器实例
     */
    debuff() {
        this._buff.params.push(BuffParams.DEBUFF);
        return this;
    }

    /**
     * 添加属性增益效果
     * @param propertyName 属性名称
     * @param effectType 效果类型
     * @param value 效果值
     * @returns 构建器实例
     */
    buffAP(propertyName: string, effectType: EffectTypes, value: number) {
        this._buff.effects.push({
            value,
            propertyName,
            effectType
        });
        if (!this._buff.params.includes(BuffParams.AFFECT_PROPERTY)) {
            this._buff.params.push(BuffParams.AFFECT_PROPERTY, BuffParams.BUFF);
        }
        return this;
    }

    /**
     * 添加属性减益效果
     * @param propertyName 属性名称
     * @param effectType 效果类型
     * @param value 效果值
     * @returns 构建器实例
     */
    debuffAP(propertyName: string, effectType: EffectTypes, value: number) {
        this._buff.effects.push({
            value,
            propertyName,
            effectType
        });
        if (!this._buff.params.includes(BuffParams.AFFECT_PROPERTY)) {
            this._buff.params.push(BuffParams.AFFECT_PROPERTY, BuffParams.DEBUFF);
        }
        return this;
    }

    /**
     * 添加属性效果
     * @param propertyName 属性名称
     * @param effectType 效果类型
     * @param value 效果值
     * @returns 构建器实例
     */
    effect(propertyName: string, effectType: EffectTypes, value: number) {
        this._buff.effects.push({
            value,
            propertyName,
            effectType
        });
        if (!this._buff.params.includes(BuffParams.AFFECT_PROPERTY)) {
            this._buff.params.push(BuffParams.AFFECT_PROPERTY);
        }
        return this;
    }

    /**
     * 添加依赖效果
     * @param buffIdOrEntityId Buff ID或实体ID
     * @param dependBuffName 依赖的Buff名称（可选）
     * @returns 构建器实例
     */
    dependOn(buffIdOrEntityId: number, dependBuffName?: string) {
        if (typeof dependBuffName === 'string') {
            this._buff.dependEntityId = buffIdOrEntityId;
            this._buff.dependBuffName = dependBuffName;
            this._buff.params.push(BuffParams.DEPEND_ON);
        } else {
            this._buff.dependBuffId = buffIdOrEntityId;
            this._buff.params.push(BuffParams.DEPEND_ON);
        }

        return this;
    }

    /**
     * 添加旱魃规则
     * @returns 构建器实例
     */
    ruleHighAndDry() {
        this._buff.params.push(BuffParams.RULE_HIGH_AND_DRY);
        return this;
    }

    /**
     * 添加控制免疫规则
     * @returns 构建器实例
     */
    ruleControlImmune() {
        this._buff.params.push(BuffParams.RULE_CONTROL_IMMUNE);
        return this;
    }

    /**
     * 添加减益免疫规则
     * @returns 构建器实例
     */
    ruleDebuffImmune() {
        this._buff.params.push(BuffParams.RULE_DEBUFF_IMMUNE);
        return this;
    }

    /**
     * 结束构建，返回Buff对象
     * @returns Buff对象
     */
    end(): Buff {
        return this._buff;
    }
}

/**
 * Buff类
 * 定义Buff的基本属性和方法
 */
export default class Buff {
    name: string = ''; // buff名称 用于表示相同buff
    sourceId: number = 0; // 来源实体
    ownerId: number = 0; // 所有者实体
    buffId: number; // Buff唯一ID
    params: BuffParams[] = []; // Buff参数
    maxCount?: number; // 同名最大持有数量, 0表示无限制
    control?: Control; // 控制效果 flag:CONTROL
    countDown?: number; // 倒计时剩余回合 flag: COUNT_DOWN/COUNT_DOWN_BY_SOURCE
    shield?: number; // 护盾剩余吸收量 flag: SHIELD
    icon?: string; // 对应图标, 有效时显示 flag: VISIBLE
    effects: Effect[] = []; // 对属性的影响 flag: AFFECT_PROPERTY
    dependBuffId?: number; // 依赖于别的buff的id，别的buff存在时有效，计算属性时有效
    dependEntityId?: number; // 依赖于别的buff，与dependBuffName组合生效，别的buff存在时有效，计算属性时有效
    dependBuffName?: string; // 依赖于别的buff，与dependBuffName组合生效，别的buff存在时有效，计算属性时有效
    probability?: number; // 概率, 大于0时有效 flag: SHOULD_COMPUTE_PROBABILITY

    /**
     * 构造函数
     * @param sourceId 来源实体ID
     * @param ownerId 所有者实体ID
     */
    constructor(sourceId: number, ownerId: number) {
        this.sourceId = sourceId;
        this.ownerId = ownerId;
        this.buffId = ++buffCounter; // 生成唯一ID
    }

    /**
     * 检查是否有指定参数
     * @param p Buff参数
     * @returns 是否有该参数
     */
    hasParam(p: BuffParams){
        return this.params.includes(p);
    }

    /**
     * 静态构建方法
     * @param sourceId 来源实体ID
     * @param ownerId 所有者实体ID
     * @returns Buff构建器实例
     */
    static build(sourceId: number, ownerId: number): BuffBuilder {
        return new BuffBuilder(sourceId, ownerId);
    }
}

