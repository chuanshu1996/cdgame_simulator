/**
 * 额外回合处理器
 * 严格对应《回合结算过程3.0》"额外回合"流程：
 *   - 触发来源：妖琴师〔余音〕、神乐〔通灵·疾风〕、镰鼬〔人多势众〕、
 *     鬼使黑〔索命〕、凤凰火〔凤凰业火〕、〈轮入道〉等。
 *   - 核心特征：目标行动条无论在何处"直接跳至100%"（runway.set(GOAL)）。
 *   - 余音/疾风提供的额外回合"优先于普通回合"；其余来源仅移动至100%，
 *     随后按速度决定先后（由 runway.getNext 自然决定）。
 *   - 额外回合结算时机：在普通回合结束阶段（步骤9判定、步骤11结算）触发，
 *     本文档对应实现为「回合结束后、下一个普通回合之前」立即结算，且
 *     额外回合【跳过】资源（能量）进度推进段（文档步骤7）。
 *
 * 注意：本处理器使用当前架构的 energy（能量）系统，而非早期 mana（鬼火）系统。
 */
import {Battle, BuffParams, Control, EventCodes, Reasons, TurnType} from '../index';
import {RUNWAY_GOAL} from '../runway';
import {SkillTarget} from '../skill';
import {TurnProcessing} from './turn';

/**
 * 额外回合处理数据类
 * 与 TurnProcessing 对齐，但 turnType 固定为 EXTRA，且跳过资源进度推进
 */
export class ExtraTurnProcessing extends TurnProcessing {
    cannotAction: boolean = false; // 是否无法行动
    cannotAttack: boolean = false; // 是否无法攻击（但可以释放非攻击型技能）
    onlyAttack: number = 0; // 只能攻击的目标ID
    confusion: boolean = false; // 是否混乱
    currentId: number; // 当前实体ID
    turnType: TurnType = TurnType.EXTRA; // 回合类型：额外回合
    /** 触发来源技能编号（用于日志与去重，可选） */
    sourceSkillNo?: number;
    /** 触发者实体ID（用于日志，可选） */
    sourceId?: number;

    constructor(turn: number, currentId: number, opts: { sourceSkillNo?: number; sourceId?: number } = {}) {
        super(turn, currentId);
        this.currentId = currentId;
        this.sourceSkillNo = opts.sourceSkillNo;
        this.sourceId = opts.sourceId;
    }
}

/**
 * 额外回合处理器函数
 * @param battle 战斗对象
 * @param data 额外回合处理数据
 * @param step 处理步骤
 * @returns 下一步骤或结束标志
 */
export default function extraTurnProcessor(battle: Battle, data: ExtraTurnProcessing, step: number): number {
    const currentEntity = battle.getEntity(data.currentId);

    switch (step) {
        // 步骤1：回合开始 / 行动开始
        case 1: {
            // 检查是否有控制效果导致无法行动（变形/眩晕/冻结/睡眠 不可行动）
            data.cannotAction = battle.hasBuffByControl(currentEntity.entityId,
                Control.DIZZY,
                Control.SLEEP,
                Control.FROZEN,
                Control.POLYMORPH,
            );

            // 检查是否混乱
            data.confusion = battle.hasBuffByControl(currentEntity.entityId, Control.CONFUSION);

            // 检查是否被嘲讽
            battle.filterBuffByControl(currentEntity.entityId, Control.PROVOKE, Control.SNEER).forEach(buff => {
                data.onlyAttack = buff.sourceId;
            });

            // 如果实体已死亡，结束额外回合
            if (currentEntity.dead) return -1;

            // 当前裁判旗回合内行动序号+1
            battle.actionSeq += 1;

            // 输出额外回合开始日志（按裁判旗回合分组）
            const srcName = data.sourceId !== undefined ? battle.getEntity(data.sourceId)?.name || '未知' : '系统';
            battle.log(`[裁判旗回合#${battle.judgeRound}] 行动${battle.actionSeq} 队伍${currentEntity.teamId}·${currentEntity.name}（额外回合·来自${srcName}）`);
            battle.addEventLog('turn', `裁判旗回合#${battle.judgeRound} 行动${battle.actionSeq} 队伍${currentEntity.teamId}·${currentEntity.name}的额外回合开始（来源：${srcName}）`, {
                judgeRound: battle.judgeRound,
                actionSeq: battle.actionSeq,
                teamId: currentEntity.teamId,
                entityId: currentEntity.entityId,
                turnType: 'extra',
            });

            // 触发回合开始事件（额外回合同样触发 TURN_START）
            battle.addEventProcessor(EventCodes.TURN_START, currentEntity.entityId, data);
            // 检查【着迷】debuff
            const hasCharmed = battle.buffs.some(buff =>
                buff.name === '着迷' && buff.ownerId === currentEntity.entityId
            );
            if (hasCharmed) {
                const charmedCannotAttack = currentEntity.getBattleData('charmed_cannot_attack') === 'true';
                if (charmedCannotAttack) data.cannotAttack = true;
            }
            // 触发行动开始事件
            battle.addEventProcessor(EventCodes.ACTION_START, currentEntity.entityId, data);
            return 2; // 进入处理buff步骤
        }
        // 步骤2：处理buff倒计时
        case 2: {
            battle.buffs.forEach(buff => {
                if (!(buff.hasParam(BuffParams.COUNT_DOWN) || buff.hasParam(BuffParams.COUNT_DOWN_BY_SOURCE))) return;

                if (buff.hasParam(BuffParams.COUNT_DOWN)) {
                    if (buff.ownerId !== currentEntity.entityId) return;
                }
                if (buff.hasParam(BuffParams.COUNT_DOWN_BY_SOURCE)) {
                    if (buff.sourceId !== currentEntity.entityId) return;
                }

                if (buff.countDown === undefined || buff.countDown === null) {
                    battle.actionRemoveBuff(buff, Reasons.TIME_OUT);
                } else if (buff.countDown < 0) {
                    // 持续到战斗结束
                } else if (buff.countDown <= 1) {
                    buff.countDown = 0;
                    battle.actionRemoveBuff(buff, Reasons.TIME_OUT);
                } else {
                    buff.countDown = buff.countDown - 1;
                }
            });

            // 注意：额外回合【跳过】资源（能量）进度推进段（文档步骤7），直接进回合内
            return 4; // 进入回合内处理步骤（跳过步骤3）
        }
        // 步骤3：已跳过（资源进度推进）
        // 步骤4：回合内
        case 4: {
            if (!data.cannotAction) {
                if (data.onlyAttack) {
                    battle.actionUseSkill(1, currentEntity.entityId, data.onlyAttack, 0);
                } else if (data.confusion) {
                    const target = battle.getRandomEnemy(currentEntity.entityId);
                    if (target) battle.actionUseSkill(1, currentEntity.entityId, target.entityId, 0);
                } else {
                    const energy = battle.getEnergy(currentEntity.teamId);
                    const skills = currentEntity.skills
                        .filter(s => {
                            if (s.passive) return false;
                            if (s.use === undefined) return false;
                            if (s.limited && currentEntity.getBattleData(`limited_skill_${s.no}_used`) === 'true') return false;
                            if (s.hide) {
                                if (s.no === 3 && currentEntity.getBattleData('final_prayer_available') !== 'true') return false;
                                if (s.no !== 3) return false;
                            }
                            if (data.cannotAttack) {
                                if (s.target === SkillTarget.ENEMY) return false; // 过滤掉攻击型技能
                            }
                            const cost: number = typeof s.cost === 'number' ? s.cost : s.cost(battle, currentEntity.entityId);
                            if (cost > 0) {
                                if (!energy || energy.num < cost) return false;
                            }
                            return true;
                        })
                        .map(s => {
                            let targets: number[] = [];
                            if (typeof s.target === 'function') targets = s.target(battle, currentEntity.entityId);
                            if (typeof s.target === 'number') {
                                switch (s.target) {
                                    case SkillTarget.ENEMY:
                                        targets = battle.getEnemies(currentEntity.entityId).map(e => e.entityId);
                                        if (targets.length > 1) {
                                            targets = targets.filter(tid => {
                                                const t = battle.getEntity(tid);
                                                return t.getBattleData('低存在感') !== 'true';
                                            });
                                            if (targets.length === 0) targets = battle.getEnemies(currentEntity.entityId).map(e => e.entityId);
                                        }
                                        break;
                                    case SkillTarget.SELF:
                                        targets = [currentEntity.entityId];
                                        break;
                                    case SkillTarget.TEAM:
                                        targets = battle.getTeamEntities(currentEntity.teamId).map(e => e.entityId);
                                        break;
                                }
                            }
                            return {
                                no: s.no,
                                targets,
                                cost: typeof s.cost === 'number' ? s.cost : s.cost(battle, currentEntity.entityId),
                                name: s.name,
                            };
                        })
                        .filter(s => s.targets.length);

                    if (skills.length) {
                        const selection = currentEntity.ai(battle, data, energy || null, skills);
                        if (selection && selection.no && selection.targetId) {
                            const skill = skills.find(s => s.no === selection.no && s.targets.includes(selection.targetId));
                            if (skill) battle.actionUseSkill(selection.no, currentEntity.entityId, selection.targetId, skill.cost);
                        }
                    }
                }
            }
            return 6; // 进入回合结束步骤
        }
        // 步骤5/6：回合结束（合并，额外回合不单独处理选择步骤）
        case 6: {
            battle.flushPendingDamageLogs();
            battle.flushPendingBuffLogs();
            battle.addEventProcessor(EventCodes.ACTION_END, currentEntity.entityId, data);
            battle.addEventProcessor(EventCodes.TURN_END, currentEntity.entityId, data);

            // 额外回合结束：将行动条重置（用完额外回合后回到正常位置，而非保持在100%）
            // 文档：额外回合结束后行动条按正常推进，此处回到0重新开始累计
            battle.runway.set(currentEntity.entityId, 0);

            return 7; // 进入结算能量进度步骤（额外回合同样跳过的占位，直接结束）
        }
        // 步骤7：结算能量进度（额外回合跳过，不推进）
        case 7: {
            // 额外回合不推进能量进度（对应文档步骤7伪/额外回合跳过）
            return -1; // 结束额外回合
        }
    }

    return 0; // 出错，结束处理
}

/**
 * 将目标行动条直接跳至100%（额外回合核心特征）
 * @param battle 战斗对象
 * @param targetId 目标实体ID
 */
export function jumpRunwayToFull(battle: Battle, targetId: number): void {
    battle.runway.set(targetId, RUNWAY_GOAL);
}
