/**
 * 攻击任务处理器
 * 负责处理攻击逻辑，包括伤害计算、暴击判定、死亡处理等
 */
import {Attack, AttackParams, Battle, BattleProperties, eps, EventCodes, Reasons} from "../";
import {SoulManager, SoulEffectType} from "../soul";
import {applyJudgeFlagDamageMultiplier} from "../judge-flag";

/**
 * 攻击处理数据类
 * 存储攻击过程中的相关数据
 */
export class AttackProcessing {
    index: number = 0; // 当前处理的攻击索引
    attackInfos: AttackInfo[] = []; // 攻击信息数组
    attacks: Attack[] = []; // 攻击对象数组
}

/**
 * 攻击信息类
 * 存储单个攻击的详细信息
 */
export class AttackInfo {
    FR: number = 0; // 波动值

    // 处理攻击的中间信息，修改影响结果
    critical: number = 0; // 暴击率
    criticalDamage: number = 0; // 暴击伤害

    damageDealtBuff: number = 1; // 造成伤害增加
    damageDealtDebuff: number = 1; // 造成伤害减少
    targetDamageTakenBuff: number = 1; // 目标承受伤害增加
    targetDamageTakenDebuff: number = 1; // 目标承受伤害减少

    targetDefence: number = 0; // 目标防御分子
    damage: number = 0; // 基础伤害

    finalDamage: number = 0; // 最终伤害
    isCri: boolean = false; // 是否暴击

    remainHp: number = 0; // 剩余生命值
    isDead: boolean = false; // 是否死亡
    originHp: number = 0; // 原始生命值
}

/**
 * 攻击处理器函数
 * @param battle 战斗对象
 * @param data 攻击处理数据
 * @param step 处理步骤
 * @returns 下一步骤或结束标志
 */
export default function attackProcessor(battle: Battle, data: AttackProcessing, step: number): number {
    const attack = data.attacks[data.index];
    if (!attack) return 0; // 没有攻击对象，出错

    const source = battle.getEntity(attack.sourceId); // 攻击来源
    const target = battle.getEntity(attack.targetId); // 攻击目标

    switch (step) {
        case 1: {
            return 2; // 直接进入数据准备步骤
        }
        // 数据准备
        case 2: {
            const attackInfo = data.attackInfos[data.index] = new AttackInfo();
            // 获取攻击相关属性
            attackInfo.critical = battle.getComputedProperty(source.entityId, BattleProperties.CRI);
            attackInfo.criticalDamage = battle.getComputedProperty(source.entityId, BattleProperties.CRI_DMG);
            attackInfo.damageDealtBuff = battle.getComputedProperty(source.entityId, BattleProperties.DMG_DEALT_B) + 1;
            attackInfo.damageDealtDebuff = battle.getComputedProperty(source.entityId, BattleProperties.DMG_DEALT_D) + 1;

            // 获取目标相关属性
            attackInfo.targetDamageTakenBuff = battle.getComputedProperty(target.entityId, BattleProperties.DMG_TAKEN_B) + 1;
            attackInfo.targetDamageTakenDebuff = battle.getComputedProperty(target.entityId, BattleProperties.DMG_TAKEN_D) + 1;
            attackInfo.targetDefence = battle.getComputedProperty(target.entityId, BattleProperties.DEF);
            // 计算基础伤害
            attackInfo.damage = typeof attack.base === 'string' ?
                battle.getComputedProperty(source.entityId, attack.base) :
                attack.base(battle, attack.sourceId, attack.targetId);
            
            // 应用limit限制（伤害上限）
            if (attack.limit !== undefined) {
                const limitValue = typeof attack.limit === 'function' ?
                    attack.limit(battle, attack.sourceId, attack.targetId) :
                    attack.limit;
                attackInfo.damage = Math.min(attackInfo.damage, limitValue);
            }

            battle.log(`【${source.name}(${source.teamId})】攻击【${target.name}(${target.teamId})】`);
            // 添加攻击开始日志
            battle.addEventLog('skill', `【${source.name}】攻击【${target.name}】`);
            // 触发攻击前事件
            battle.addEventProcessor(EventCodes.BEFORE_ATTACK, attack.sourceId, data);

            return 3; // 进入受到攻击处理步骤
        }
        // 受到攻击处理
        case 3: {
            if (!attack.hasParam(AttackParams.IGNORE_SOURCE)) {
                // 触发攻击时事件
                battle.addEventProcessor(EventCodes.WILL_ATTACK, attack.sourceId, data);
            }
            // 触发被攻击时事件
            battle.addEventProcessor(EventCodes.WILL_BE_ATTACKED, attack.targetId, data);
            return 4; // 进入暴击判定步骤
        }
        case 4:{
            const attackInfo = data.attackInfos[data.index];
            if (!attackInfo) return 0; // 没有攻击信息，出错
            
            if (attack.hasParam(AttackParams.SHOULD_COMPUTE_CRI)) {
                if (attack.hasParam(AttackParams.INDIRECT) && battle.getComputedProperty(target.entityId, BattleProperties.DEF) <= eps) {
                    // 间接伤害 防御为0时必然暴击
                    attackInfo.isCri = true;
                } else {
                    // 测试是否暴击 - 使用暴击率(critical)而非暴击伤害(criticalDamage)
                    attackInfo.isCri = attackInfo.isCri || battle.testHit(attackInfo.critical);
                }
                if (attackInfo.isCri) {
                    // 添加暴击参数
                    attack.addParam(AttackParams.CRITICAL);
                    // 触发暴击事件
                    battle.addEventProcessor(EventCodes.CRI, attack.sourceId, data);
                }
            }
            return 5; // 进入伤害处理步骤
        }
        // 伤害处理步骤
        case 5: {
            const attackInfo = data.attackInfos[data.index];
            if (!attackInfo) return 0; // 没有攻击信息，出错
            
            // 计算伤害浮动系数
            const FR = battle.random.real(1 - attackInfo.FR, 1 + attackInfo.FR);
            // 计算伤害公式攻击部
            const atk = attackInfo.damage * attack.rate * (attackInfo.isCri ? attackInfo.criticalDamage : 1) * 300;
            // 计算伤害公式防御部
            const def = attackInfo.targetDefence + 300;
            // 计算伤害倍率（减伤增伤易伤等）
            const rate = (attackInfo.damageDealtBuff / attackInfo.damageDealtDebuff) *
                (attackInfo.targetDamageTakenBuff / attackInfo.targetDamageTakenDebuff);

            // 计算御魂修正
            const soulEnhancement = SoulManager.getDamageEnhancement(source);
            const soulReduction = SoulManager.getDamageReduction(target);
            const soulCorrection = soulEnhancement * soulReduction;

            // 如果有御魂减伤效果，添加日志
            if (soulReduction < 1) {
                const reductionPercent = Math.round((1 - soulReduction) * 100);
                const soulNames = SoulManager.getEntitySouls(target)
                    .filter(s => s.effects.some(e => e.type === SoulEffectType.DAMAGE_REDUCTION))
                    .map(s => s.name)
                    .join('、');
                if (soulNames) {
                    battle.log(`【${target.name}】的${soulNames}触发，减少${reductionPercent}%伤害`);
                    battle.addEventLog('info', `【${target.name}】的${soulNames}触发，减少${reductionPercent}%伤害`, {
                        targetId: target.entityId,
                        reductionPercent,
                        soulNames
                    });
                }
            }

            // 计算最终伤害
            attackInfo.finalDamage = atk / def * rate * soulCorrection * FR;
            // 应用裁判旗伤害倍率
            attackInfo.finalDamage = applyJudgeFlagDamageMultiplier(battle, attackInfo.finalDamage);
            //TODO: 计算盾的抵消伤害

            // 保存原始生命值和剩余生命值
            attackInfo.originHp = attackInfo.remainHp = target.hp;

            if (attackInfo.finalDamage > eps) {
                // 计算剩余生命值
                attackInfo.remainHp = Math.max(target.hp - attackInfo.finalDamage, 0);
                // 判断是否死亡
                attackInfo.isDead = attackInfo.remainHp <= eps;
                
                if (!attack.hasParam(AttackParams.IGNORE_SOURCE)) {
                    // 触发造成伤害前事件
                    battle.addEventProcessor(EventCodes.WILL_DAMAGE, attack.sourceId, data);
                }
                // 触发收到伤害前事件
                battle.addEventProcessor(EventCodes.WILL_BE_DAMAGE, attack.targetId, data);
                return 6; // 进入伤害结算步骤
            }
            return 7; // 跳过伤害结算，直接进入伤害后步骤
        }
        case 6: {
            const attackInfo = data.attackInfos[data.index];
            if (!attackInfo) return 0; // 没有攻击信息，出错
            
            // 更新目标生命值和死亡状态
            target.hp = attackInfo.remainHp;
            target.dead = attackInfo.isDead;
            
            // 记录伤害数据
            if (source && attackInfo.finalDamage > 0) {
                const currentDamage = Number(source.battleData.get('totalDamage')) || 0;
                source.battleData.set('totalDamage', String(currentDamage + attackInfo.finalDamage));
                
                const currentMaxHit = Number(source.battleData.get('maxHit')) || 0;
                if (attackInfo.finalDamage > currentMaxHit) {
                    source.battleData.set('maxHit', String(attackInfo.finalDamage));
                }
            }
            
            // 输出伤害日志
            battle.log(`${source ? `【${source.name}(${source.teamId})】` : ''}对【${target.name}(${target.teamId})】造成${attackInfo.finalDamage}点血， 剩余${attackInfo.remainHp}`, attackInfo.isDead ? '【死亡】' : '');
            
            // 添加伤害到待合并日志
            const skillName = attack.skillName || battle.currentSkillName || '普通攻击';
            battle.addPendingDamage(source.entityId, source.name, target.entityId, target.name, attackInfo.finalDamage, attackInfo.isCri, skillName);
       
            if (attackInfo.isDead) {
                battle.flushPendingDamageLogs();
                battle.addEventLog('death', `${target.name}被击败了！`, {
                    targetId: target.entityId
                });
                // 处理死亡逻辑
                const field = battle.fields[target.teamId];
                if (field) {
                    const index = field.indexOf(target.entityId);
                    if (index !== -1) {
                        field[index] = 0; // 从场地中移除
                    }
                }
                // 冻结行动条
                battle.runway.freeze(target.entityId);
                // TODO: 杀生丸禁止复活buff
                // 移除所有buff
                battle.buffs.forEach(b => {
                    if (b.ownerId === target.entityId) {
                        battle.actionRemoveBuff(b, Reasons.RULE);
                    }
                });
                
                // 检查并触发击杀增加鬼火效果（阴摩罗）
                if (source && !attack.hasParam(AttackParams.IGNORE_SOURCE)) {
                    SoulManager.checkAndTriggerKillAddMana(source, battle);
                }
            }
            
            if (!attack.hasParam(AttackParams.IGNORE_SOURCE)) {
                // 触发造成伤害后事件
                battle.addEventProcessor(EventCodes.HAS_DAMAGED, attack.sourceId, data);
            }
            // 触发收到伤害后事件
            battle.addEventProcessor(EventCodes.HAS_BEEN_DAMAGED, attack.targetId, data);
            // 触发更新hp事件
            battle.addEventProcessor(EventCodes.UPDATE_HP, attack.targetId, data);



            if (attackInfo.isDead) {
                // 触发死亡事件
                battle.addEventProcessor(EventCodes.DEAD, attack.targetId, data);
            }
            return 7; // 进入伤害后步骤
        }
        // 伤害后步骤
        case 7: {
            if (attack.completedProcessor) {
                // 添加攻击完成处理器
                battle.addProcessor(attack.completedProcessor, data, `AttackCompletedProcessor`);
            } // 伤害后处理，一般处理伤害时的控制
            
            if (!attack.hasParam(AttackParams.IGNORE_SOURCE)) {
                // 触发攻击后事件
                battle.addEventProcessor(EventCodes.HAS_ATTACKED, attack.sourceId, data);
            }
            // 只有目标未死亡时才触发被攻击后事件
            if (!target.dead) {
                battle.addEventProcessor(EventCodes.HAS_BEEN_ATTACKED, attack.targetId, data);
            }
            return 8; // 进入下一个攻击处理步骤
        }
        case 8: {
            if (data.index + 1 >= data.attacks.length) {
                return -1; // 所有攻击处理完成
            }
            data.index ++; // 处理下一个攻击
            return 2; // 重新进入数据准备步骤
        }
    }
    return 0; // 出错，结束处理
}
