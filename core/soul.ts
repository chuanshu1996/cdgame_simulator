/**
 * 御魂系统核心文件
 * 定义御魂相关的数据结构和逻辑
 */

import {BattleProperties} from "./constant";
import Buff, {EffectTypes} from "./buff";
import Entity from "./entity";

/**
 * 御魂类型枚举
 */
export enum SoulType {
    BEI_FU = "bei_fu", // 被服
    NIE_PAN_ZHI_HUO = "nie_pan_zhi_huo", // 涅槃之火
    YIN_MO_LUO = "yin_mo_luo", // 阴摩罗
}

/**
 * 御魂效果类型
 */
export enum SoulEffectType {
    PROPERTY_BUFF = "property_buff", // 属性加成
    DAMAGE_REDUCTION = "damage_reduction", // 伤害减免
    DAMAGE_ENHANCEMENT = "damage_enhancement", // 伤害增强
    SPECIAL_EFFECT = "special_effect", // 特殊效果
    LOW_HP_HEAL = "low_hp_heal", // 低生命值触发治疗
    KILL_ADD_MANA = "kill_add_mana", // 击杀增加鬼火
}

/**
 * 御魂属性加成接口
 */
export interface SoulPropertyBuff {
    propertyName: string; // 属性名称
    value: number; // 加成值
    effectType: EffectTypes; // 效果类型
}

/**
 * 御魂效果接口
 */
export interface SoulEffect {
    type: SoulEffectType; // 效果类型
    value?: number; // 效果值
    propertyBuff?: SoulPropertyBuff; // 属性加成
    lowHpThreshold?: number; // 低生命值阈值（百分比）
    healPercent?: number; // 治疗百分比
    killManaAdd?: number; // 击杀增加鬼火数量
    description: string; // 效果描述
}

/**
 * 御魂接口
 */
export interface Soul {
    id: string; // 御魂ID
    name: string; // 御魂名称
    description: string; // 御魂描述
    effects: SoulEffect[]; // 御魂效果
}

/**
 * 御魂数据
 */
export const SoulData: Soul[] = [
    {
        id: SoulType.BEI_FU,
        name: "被服",
        description: "受到伤害时减少30%伤害，同时增加15%生命值上限",
        effects: [
            {
                type: SoulEffectType.PROPERTY_BUFF,
                propertyBuff: {
                    propertyName: BattleProperties.MAX_HP,
                    value: 0.15,
                    effectType: EffectTypes.ADD_RATE
                },
                description: "增加15%生命值上限"
            },
            {
                type: SoulEffectType.DAMAGE_REDUCTION,
                value: 0.3,
                description: "减少30%受到的伤害"
            }
        ]
    },
    {
            id: SoulType.NIE_PAN_ZHI_HUO,
            name: "涅槃之火",
            description: "增加15%生命值上限，在自身回合开始时，若当前生命值低于最大生命值的30%，则立即恢复自身15%的最大生命值",
            effects: [
                {
                    type: SoulEffectType.PROPERTY_BUFF,
                    propertyBuff: {
                        propertyName: BattleProperties.MAX_HP,
                        value: 0.15,
                        effectType: EffectTypes.ADD_RATE
                    },
                    description: "增加15%生命值上限"
                },
                {
                    type: SoulEffectType.LOW_HP_HEAL,
                    lowHpThreshold: 0.3,
                    healPercent: 0.15,
                    description: "生命值低于30%时，恢复15%最大生命值"
                }
            ]
        },
    {
        id: SoulType.YIN_MO_LUO,
        name: "阴摩罗",
        description: "增加15%攻击力，击杀目标时增加3点鬼火",
        effects: [
            {
                type: SoulEffectType.PROPERTY_BUFF,
                propertyBuff: {
                    propertyName: BattleProperties.ATK,
                    value: 0.15,
                    effectType: EffectTypes.ADD_RATE
                },
                description: "增加15%攻击力"
            },
            {
                type: SoulEffectType.KILL_ADD_MANA,
                killManaAdd: 3,
                description: "击杀目标时增加3点鬼火"
            }
        ]
    }
];

/**
 * 御魂管理类
 */
export class SoulManager {
    /**
     * 根据ID获取御魂
     * @param soulId 御魂ID
     * @returns 御魂对象或null
     */
    static getSoulById(soulId: string): Soul | null {
        return SoulData.find(soul => soul.id === soulId) || null;
    }

    /**
     * 应用多个御魂效果到实体
     * @param entity 实体对象
     * @param soulIds 御魂ID数组
     */
    static applySoulsToEntity(entity: Entity, soulIds: string[]) {
        // 清除之前的御魂效果
        this.clearSoulEffects(entity);

        if (!soulIds || soulIds.length === 0) return;

        // 应用每个御魂效果
        soulIds.forEach(soulId => {
            if (!soulId) return;
            
            const soul = this.getSoulById(soulId);
            if (!soul) return;

            // 应用御魂效果
            soul.effects.forEach(effect => {
                if (effect.type === SoulEffectType.PROPERTY_BUFF && effect.propertyBuff) {
                    // 创建属性加成buff
                    const buff = Buff.build(entity.entityId, entity.entityId)
                        .name(`${soul.name}属性加成`)
                        .noDispel()
                        .noRemove()
                        .buffAP(
                            effect.propertyBuff.propertyName,
                            effect.propertyBuff.effectType,
                            effect.propertyBuff.value
                        )
                        .end();
                    
                    // 添加buff到实体
                    entity.addBuff(buff);
                }
            });
        });

        // 保存御魂ID数组到实体
        entity.soulIds = soulIds.filter(id => id);
    }

    /**
     * 应用单个御魂效果到实体（兼容旧接口）
     * @param entity 实体对象
     * @param soulId 御魂ID
     */
    static applySoulToEntity(entity: Entity, soulId: string | null) {
        if (soulId) {
            this.applySoulsToEntity(entity, [soulId]);
        } else {
            this.clearSoulEffects(entity);
        }
    }

    /**
     * 清除实体的御魂效果
     * @param entity 实体对象
     */
    static clearSoulEffects(entity: Entity) {
        // 移除御魂相关的buff
        const soulBuffs = entity.buffs.filter((buff: any) => buff.name.includes("属性加成"));
        soulBuffs.forEach((buff: any) => {
            entity.removeBuff(buff);
        });

        // 清除御魂ID
        entity.soulIds = [];
        entity.soulId = null;
    }

    /**
     * 获取实体的御魂列表
     * @param entity 实体对象
     * @returns 御魂对象数组
     */
    static getEntitySouls(entity: Entity): Soul[] {
        const souls: Soul[] = [];
        
        // 支持新的 soulIds 数组
        if (entity.soulIds && entity.soulIds.length > 0) {
            entity.soulIds.forEach((soulId: string) => {
                const soul = this.getSoulById(soulId);
                if (soul) souls.push(soul);
            });
        }
        // 兼容旧的 soulId 单个值
        else if (entity.soulId) {
            const soul = this.getSoulById(entity.soulId);
            if (soul) souls.push(soul);
        }
        
        return souls;
    }

    /**
     * 获取实体的御魂（兼容旧接口，返回第一个御魂）
     * @param entity 实体对象
     * @returns 御魂对象或null
     */
    static getEntitySoul(entity: Entity): Soul | null {
        const souls = this.getEntitySouls(entity);
        return souls.length > 0 ? souls[0] : null;
    }

    /**
     * 计算御魂的伤害减免效果（支持多个御魂叠加）
     * @param entity 实体对象
     * @returns 伤害减免系数
     */
    static getDamageReduction(entity: Entity): number {
        const souls = this.getEntitySouls(entity);
        if (souls.length === 0) return 1;

        let reduction = 1;
        souls.forEach(soul => {
            soul.effects.forEach(effect => {
                if (effect.type === SoulEffectType.DAMAGE_REDUCTION && effect.value) {
                    reduction -= effect.value;
                }
            });
        });

        return Math.max(reduction, 0);
    }

    /**
     * 计算御魂的伤害增强效果（支持多个御魂叠加）
     * @param entity 实体对象
     * @returns 伤害增强系数
     */
    static getDamageEnhancement(entity: Entity): number {
        const souls = this.getEntitySouls(entity);
        if (souls.length === 0) return 1;

        let enhancement = 1;
        souls.forEach(soul => {
            soul.effects.forEach(effect => {
                if (effect.type === SoulEffectType.DAMAGE_ENHANCEMENT && effect.value) {
                    enhancement += effect.value;
                }
            });
        });

        return enhancement;
    }

    /**
     * 检查并触发低生命值治疗效果
     * @param entity 实体对象
     * @param battle 战斗对象
     * @returns 是否触发了治疗
     */
    static checkAndTriggerLowHpHeal(entity: Entity, battle: any): boolean {
        const souls = this.getEntitySouls(entity);
        if (souls.length === 0) return false;

        const maxHp = battle.getComputedProperty(entity.entityId, BattleProperties.MAX_HP);
        const hpPercent = entity.hp / maxHp;

        let totalHealPercent = 0;
        const triggeredSoulNames: string[] = [];

        souls.forEach(soul => {
            soul.effects.forEach(effect => {
                if (effect.type === SoulEffectType.LOW_HP_HEAL && 
                    effect.lowHpThreshold && 
                    effect.healPercent) {
                    
                    // 检查生命值是否低于阈值
                    if (hpPercent < effect.lowHpThreshold) {
                        totalHealPercent += effect.healPercent;
                        triggeredSoulNames.push(soul.name);
                    }
                }
            });
        });

        if (totalHealPercent > 0) {
            // 执行治疗
            const healAmount = Math.floor(maxHp * totalHealPercent);
            entity.hp = Math.min(entity.hp + healAmount, maxHp);
            
            // 添加治疗日志
            const soulNames = triggeredSoulNames.join('、');
            battle.addEventLog('heal', `【${entity.name}】的${soulNames}触发，恢复${healAmount}点生命值`, {
                entityId: entity.entityId,
                healAmount,
                soulNames: triggeredSoulNames
            });
            
            battle.log(`【${entity.name}】的${soulNames}触发，恢复${healAmount}点生命值`);
            
            return true;
        }

        return false;
    }

    /**
     * 检查并触发击杀增加鬼火效果
     * @param killer 击杀者实体
     * @param battle 战斗对象
     * @returns 是否触发了增加鬼火
     */
    static checkAndTriggerKillAddMana(killer: Entity, battle: any): boolean {
        const souls = this.getEntitySouls(killer);
        if (souls.length === 0) return false;

        let totalManaAdd = 0;
        const triggeredSoulNames: string[] = [];

        souls.forEach(soul => {
            soul.effects.forEach(effect => {
                if (effect.type === SoulEffectType.KILL_ADD_MANA && effect.killManaAdd) {
                    totalManaAdd += effect.killManaAdd;
                    triggeredSoulNames.push(soul.name);
                }
            });
        });

        if (totalManaAdd > 0) {
            // 增加鬼火
            const teamId = killer.teamId;
            const mana = battle.getMana(teamId);
            mana.num = Math.min(mana.num + totalManaAdd, 8); // 鬼火上限为8
            
            // 添加日志
            const soulNames = triggeredSoulNames.join('、');
            battle.addEventLog('info', `【${killer.name}】的${soulNames}触发，获得${totalManaAdd}点鬼火`, {
                entityId: killer.entityId,
                manaAdd: totalManaAdd,
                soulNames: triggeredSoulNames
            });
            
            battle.log(`【${killer.name}】的${soulNames}触发，获得${totalManaAdd}点鬼火`);
            
            return true;
        }

        return false;
    }
}
