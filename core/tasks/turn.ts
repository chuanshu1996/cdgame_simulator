/**
 * 回合处理器
 * 负责处理游戏中的回合逻辑，包括回合开始、buff处理、鬼火条推进、技能选择和回合结束等
 */
import {Battle, BuffParams, Control, EventCodes, Reasons, WaitInputProcessing, processJudgeFlagAction} from '../';
import {SelectableSkill, SkillSelection, SkillTarget} from "../skill";
import waitInputProcessor from "./wait-input";
import {SoulManager} from '../soul';

/**
 * 回合处理数据类
 * 存储回合处理的相关信息
 */
export interface BaseTurnData {
    cannotAction: boolean;
    cannotAttack: boolean;
    onlyAttack: number;
    confusion: boolean;
    waitInput?: WaitInputProcessing;
    skills: SelectableSkill[];
    turnType?: any;
    turn: number;
    currentId: number;
}

export class TurnProcessing implements BaseTurnData {
    cannotAction: boolean = false; // 是否无法行动
    cannotAttack: boolean = false; // 是否无法攻击（但可以释放非攻击型技能）
    onlyAttack: number = 0; // 只能攻击的目标ID
    confusion: boolean = false; // 是否混乱
    waitInput?: WaitInputProcessing; // 等待输入处理
    skills: SelectableSkill[] = []; // 可选技能列表
    turnType: any = 'normal';

    /**
     * 构造函数
     * @param turn 回合数
     * @param currentId 当前实体ID
     */
    constructor(public turn: number, public currentId: number) {
    }
}

/**
 * 回合处理器函数
 * @param battle 战斗对象
 * @param data 回合处理数据
 * @param step 处理步骤
 * @returns 下一步骤或结束标志
 */
export default function turnProcessor(battle: Battle, data: TurnProcessing, step: number): number {
    const currentEntity = battle.getEntity(data.currentId);

    switch (step) {
        // 开始阶段
        case 1: {
            // 检查是否是裁判旗
            if (currentEntity.name === '裁判旗') {
                processJudgeFlagAction(battle, data.currentId);
                return -1; // 结束裁判旗回合
            }
            
            // 检查是否有控制效果导致无法行动
            data.cannotAction = battle.hasBuffByControl(currentEntity.entityId,
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
            
            // 如果实体已死亡，结束回合
            if (currentEntity.dead) return -1;
            
            // 输出回合开始日志
            battle.log(`回合${data.turn} ${currentEntity.name}(${currentEntity.teamId})`);
            // 添加回合开始日志
            battle.addEventLog('turn', `回合${data.turn} ${currentEntity.name}的回合开始`);
            
            // 检查并触发低生命值治疗效果（如涅槃之火）
            SoulManager.checkAndTriggerLowHpHeal(currentEntity, battle);
            
            // 检查最佳位置Buff
            const teamId = currentEntity.teamId;
            // 跳过非正常队伍的实体（如裁判旗）
            if (teamId >= 0 && teamId <= 1) {
                const field = battle.fields[teamId];
                if (field) {
                    const currentPosition = field.indexOf(currentEntity.entityId);
            
                    // 检查当前位置是否与最佳位置一致
                    if (currentEntity.position !== -1 && currentPosition === currentEntity.position) {
                        // 检查是否已经有最佳位置Buff
                        const hasBestPositionBuff = battle.buffs.some(buff => 
                            buff.ownerId === currentEntity.entityId && buff.name === '最佳位置'
                        );
                        
                        if (!hasBestPositionBuff) {
                            // 添加最佳位置Buff
                            const buff = require('../buff').default.build(currentEntity.entityId, currentEntity.entityId)
                                .name('最佳位置', 1)
                                .noDispel()
                                .noRemove()
                                .buffAP('atk', 2, 0.1) // ADD_RATE
                                .buffAP('def', 2, 0.1) // ADD_RATE
                                .end();
                            battle.buffs.push(buff);
                            
                            // 添加Buff日志
                            battle.addPendingBuff(
                                currentEntity.entityId,
                                currentEntity.name,
                                currentEntity.entityId,
                                currentEntity.name,
                                '最佳位置',
                                1,
                                buff.effects[0]
                            );
                            battle.flushPendingBuffLogs();
                        }
                    } else {
                        // 移除最佳位置Buff
                        const bestPositionBuff = battle.buffs.find(buff => 
                            buff.ownerId === currentEntity.entityId && buff.name === '最佳位置'
                        );
                        
                        if (bestPositionBuff) {
                            battle.buffs.splice(battle.buffs.indexOf(bestPositionBuff), 1);
                            
                            // 添加Buff移除日志
                            battle.log(`【${currentEntity.name}】失去了【最佳位置】Buff`);
                            battle.addEventLog('buff', `【${currentEntity.name}】失去了【最佳位置】Buff`, {
                                buffName: '最佳位置',
                                sourceId: currentEntity.entityId,
                                targetId: currentEntity.entityId
                            });
                        }
                    }
                }
            }
            
            // 触发回合开始事件
            battle.addEventProcessor(EventCodes.TURN_START, currentEntity.entityId, data);
            
            // 检查【害怕】debuff - 在TURN_START事件后检查，因为害怕判定在TURN_START中处理
            const hasFear = battle.buffs.some(buff => 
                buff.name === '害怕' && buff.ownerId === currentEntity.entityId
            );
            if (hasFear) {
                const fearCannotAction = currentEntity.getBattleData('fear_cannot_action') === 'true';
                if (fearCannotAction) {
                    data.cannotAction = true;
                }
            }
            
            // 检查【着迷】debuff - 在TURN_START事件后检查，因为着迷判定在TURN_START中处理
            const hasCharmed = battle.buffs.some(buff => 
                buff.name === '着迷' && buff.ownerId === currentEntity.entityId
            );
            if (hasCharmed) {
                const charmedCannotAttack = currentEntity.getBattleData('charmed_cannot_attack') === 'true';
                if (charmedCannotAttack) {
                    data.cannotAttack = true;
                }
            }
            
            // 触发行动开始事件
            battle.addEventProcessor(EventCodes.ACTION_START, currentEntity.entityId, data);
            return 2; // 进入处理buff步骤
        }
        // 处理buff
        case 2: {
            // 遍历所有buff
            battle.buffs.forEach(buff => {
                // 只处理有倒计时的buff
                if (!(buff.hasParam(BuffParams.COUNT_DOWN) || buff.hasParam(BuffParams.COUNT_DOWN_BY_SOURCE))) return;
                
                // 检查是否是当前实体的回合
                if (buff.hasParam(BuffParams.COUNT_DOWN)){
                    if (buff.ownerId !== currentEntity.entityId) return; // 不是本人的回合
                }
                
                // 检查是否是来源的回合
                if (buff.hasParam(BuffParams.COUNT_DOWN_BY_SOURCE)) {
                    if (buff.sourceId !== currentEntity.entityId) return; // 不是来源的回合
                }
                
                // 处理倒计时
                if (buff.countDown === undefined || buff.countDown === null) {
                    // 未提供倒计时，移除buff
                    battle.actionRemoveBuff(buff, Reasons.TIME_OUT);
                } else if (buff.countDown < 0) {
                    // countDown < 0 表示持续到战斗结束，不移除
                } else if (buff.countDown <= 1) {
                    // 剩余时间少于一个回合，移除buff
                    buff.countDown = 0;
                    battle.actionRemoveBuff(buff, Reasons.TIME_OUT);
                } else {
                    buff.countDown = buff.countDown - 1;
                }
            });

            return 3; // 进入推进鬼火条步骤
        }
        // 推进鬼火条
        case 3: {
            // 推进当前队伍的鬼火条
            battle.actionUpdateManaProgress(0, currentEntity.teamId, 1, Reasons.RULE);
            return 4; // 进入回合内处理步骤
        }
        // 回合内
        case 4: {
            if (!data.cannotAction) {
                if (data.onlyAttack) {
                    // 被嘲讽，只能攻击嘲讽者
                    battle.actionUseSkill(1, currentEntity.entityId, data.onlyAttack, 0); //TODO: 是否需要确认鬼火
                } else if (data.confusion) {
                    // 混乱状态，随机攻击敌人
                    const target = battle.getRandomEnemy(currentEntity.entityId);
                    if (target) {
                        battle.actionUseSkill(1, currentEntity.entityId, target.entityId, 0); //TODO: 是否需要确认鬼火
                    }
                } else {
                    // 正常状态，选择技能
                    const mana = battle.getMana(currentEntity.teamId);
                    // 过滤可使用的技能
                    const skills: SelectableSkill[] = currentEntity.skills
                        .filter(s => {
                            if (s.passive) return false; // 跳过被动技能
                            if (s.use === undefined) return false; // 跳过没有使用方法的技能
                            // 检查限定技是否已使用
                            if (s.limited && currentEntity.getBattleData(`limited_skill_${s.no}_used`) === 'true') return false;
                            // 检查隐藏技能是否满足显示条件
                            if (s.hide) {
                                // 对于最终祈愿，检查是否可用
                                if (s.no === 3 && currentEntity.getBattleData('final_prayer_available') !== 'true') {
                                    return false;
                                }
                                // 其他隐藏技能默认不显示
                                if (s.no !== 3) return false;
                            }
                            // 检查【着迷】状态 - 无法使用攻击型技能
                            if (data.cannotAttack) {
                                const target = typeof s.target === 'number' ? s.target : (typeof s.target === 'function' ? -1 : -1);
                                if (target === SkillTarget.ENEMY) return false; // 过滤掉攻击型技能
                            }
                            const cost: number = typeof s.cost === 'number' ? s.cost : s.cost(battle, currentEntity.entityId);
                            if (cost > 0) {
                                if (!mana || mana.num < cost) return false; // 鬼火不足
                            }
                            return true;
                        })
                        .map(s => {
                            let targets: number[] = [];
                            // 计算技能目标
                            if (typeof s.target === 'function') {
                                targets = s.target(battle, currentEntity.entityId)
                            }

                            if (typeof s.target === 'number') {
                                switch (s.target) {
                                    case SkillTarget.ENEMY:
                                        targets = battle.getEnemies(currentEntity.entityId).map(e => e.entityId);
                                        break;
                                    case SkillTarget.SELF:
                                        targets = [currentEntity.entityId];
                                        break;
                                    case SkillTarget.TEAM: {
                                        targets = battle.getTeamEntities(currentEntity.teamId).map(e => e.entityId);
                                        break;
                                    }
                                }
                            }

                            return {
                                no: s.no,
                                targets,
                                cost: typeof s.cost === 'number' ? s.cost : s.cost(battle, currentEntity.entityId),
                                name: s.name,
                            }
                        })
                        .filter(s => s.targets.length); // 过滤没有目标的技能
                    
                    data.skills = skills;
                    if (skills.length) {
                        if (currentEntity.waitInput) {
                            // 需要手动输入
                            data.waitInput = new WaitInputProcessing(skills);
                            battle.addProcessor(waitInputProcessor, data.waitInput, 'WaitInput');
                        }
                    }
                    return 5; // 进入处理选择步骤
                }
            }
            return 6; // 进入回合结束步骤
        }
        // 处理选择
        case 5: {
            const mana = battle.getMana(currentEntity.teamId);

            // 获取技能选择（手动输入或AI选择）
            const selection = (data.waitInput && data.waitInput.selection) || currentEntity.ai(battle, data, mana || null, data.skills);

            if (selection && selection.no && selection.targetId) {
                // 查找选择的技能
                const skill = data.skills.find(s => s.no === selection.no && s.targets.includes(selection.targetId));
                if (skill) {
                    // 使用技能
                    battle.actionUseSkill(selection.no, currentEntity.entityId, selection.targetId, skill.cost);
                }
            }
            return 6; // 进入回合结束步骤
        }
        // 回合结束
        case 6: {
            // 刷新待合并的伤害日志和Buff日志
            battle.flushPendingDamageLogs();
            battle.flushPendingBuffLogs();
            
            // 触发行动结束事件
            battle.addEventProcessor(EventCodes.ACTION_END, currentEntity.entityId, data);
            // 触发回合结束事件
            battle.addEventProcessor(EventCodes.TURN_END, currentEntity.entityId, data);
            return 7; // 进入结算鬼火进度步骤
        }
        // 结算鬼火进度
        case 7: {
            const mana = battle.manas[currentEntity.teamId];
            if (!mana) return 0; // 没有鬼火对象，出错
            
            // 鬼火进度满，增加鬼火
            if (mana.progress >= 5) {
                mana.progress = 0;
                mana.preProgress = Math.min(5, mana.preProgress + 1);
                battle.actionUpdateMana(0, currentEntity.teamId, mana.preProgress, Reasons.RULE);
            }
            return -1; // 结束回合
        }
    }

    return 0; // 出错，结束处理
}
