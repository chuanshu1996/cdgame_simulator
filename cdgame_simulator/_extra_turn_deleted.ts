import {Battle, BuffParams, Control, EventCodes, Reasons, WaitInputProcessing} from '../';
import {TurnType} from '../constant';
import {SelectableSkill, SkillSelection, SkillTarget} from "../skill";
import waitInputProcessor from "./wait-input";
import {Processor} from '../task';
import {BaseTurnData} from './turn';

export class ExtraTurnProcessing implements BaseTurnData {
    cannotAction: boolean = false;
    cannotAttack: boolean = false;
    onlyAttack: number = 0;
    confusion: boolean = false;
    waitInput?: WaitInputProcessing;
    skills: SelectableSkill[] = [];
    turnType: TurnType = TurnType.EXTRA;
    turn: number = 0;

    constructor(public currentId: number) {}

    static create(currentId: number): ExtraTurnProcessing {
        return new ExtraTurnProcessing(currentId);
    }
}

export default function extraTurnProcessor(battle: Battle, data: ExtraTurnProcessing, step: number): number {
    const currentEntity = battle.getEntity(data.currentId);

    switch (step) {
        case 1: {
            if (currentEntity.dead) return -1;

            data.cannotAction = battle.hasBuffByControl(currentEntity.entityId,
                Control.DIZZY,
                Control.SLEEP,
                Control.FROZEN,
                Control.POLYMORPH,
            );
            
            data.confusion = battle.hasBuffByControl(currentEntity.entityId, Control.CONFUSION);
            
            battle.filterBuffByControl(currentEntity.entityId, Control.PROVOKE, Control.SNEER).forEach(buff => {
                data.onlyAttack = buff.sourceId;
            });

            battle.log(`额外回合 ${currentEntity.name}(${currentEntity.teamId})`);
            battle.addEventLog('turn', `额外回合 ${currentEntity.name}的回合开始`);

            battle.addEventProcessor(EventCodes.TURN_START, currentEntity.entityId, data);
            
            const hasCharmed = battle.buffs.some(buff => 
                buff.name === '着迷' && buff.ownerId === currentEntity.entityId
            );
            if (hasCharmed) {
                const charmedCannotAttack = currentEntity.getBattleData('charmed_cannot_attack') === 'true';
                if (charmedCannotAttack) {
                    data.cannotAttack = true;
                }
            }
            
            battle.addEventProcessor(EventCodes.ACTION_START, currentEntity.entityId, data);
            return 2;
        }
        case 2: {
            battle.buffs.forEach(buff => {
                if (!(buff.hasParam(BuffParams.COUNT_DOWN) || buff.hasParam(BuffParams.COUNT_DOWN_BY_SOURCE))) return;
                
                if (buff.hasParam(BuffParams.COUNT_DOWN)){
                    if (buff.ownerId !== currentEntity.entityId) return;
                }
                
                if (buff.hasParam(BuffParams.COUNT_DOWN_BY_SOURCE)) {
                    if (buff.sourceId !== currentEntity.entityId) return;
                }
                
                if (buff.countDown === undefined || buff.countDown === null) {
                    battle.actionRemoveBuff(buff, Reasons.TIME_OUT);
                } else if (buff.countDown < 0) {
                    // 永久buff，不处理
                } else if (buff.countDown <= 1) {
                    buff.countDown = 0;
                    battle.actionRemoveBuff(buff, Reasons.TIME_OUT);
                } else {
                    buff.countDown = buff.countDown - 1;
                }
            });

            return 3;
        }
        case 3: {
            battle.actionUpdateManaProgress(0, currentEntity.teamId, 1, Reasons.RULE);
            return 4;
        }
        case 4: {
            if (!data.cannotAction) {
                if (data.onlyAttack) {
                    battle.actionUseSkill(1, currentEntity.entityId, data.onlyAttack, 0);
                } else if (data.confusion) {
                    const target = battle.getRandomEnemy(currentEntity.entityId);
                    if (target) {
                        battle.actionUseSkill(1, currentEntity.entityId, target.entityId, 0);
                    }
                } else {
                    const mana = battle.getMana(currentEntity.teamId);
                    const skills: SelectableSkill[] = currentEntity.skills
                        .filter(s => {
                            if (s.passive) return false;
                            if (s.use === undefined) return false;
                            if (s.limited && currentEntity.getBattleData(`limited_skill_${s.no}_used`) === 'true') return false;
                            if (s.hide) {
                                if (s.no === 3 && currentEntity.getBattleData('final_prayer_available') !== 'true') {
                                    return false;
                                }
                                if (s.no !== 3) return false;
                            }
                            if (data.cannotAttack) {
                                const target = typeof s.target === 'number' ? s.target : (typeof s.target === 'function' ? -1 : -1);
                                if (target === SkillTarget.ENEMY) return false;
                            }
                            const cost: number = typeof s.cost === 'number' ? s.cost : s.cost(battle, currentEntity.entityId);
                            if (cost > 0) {
                                if (!mana || mana.num < cost) return false;
                            }
                            return true;
                        })
                        .map(s => {
                            let targets: number[] = [];
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
                        .filter(s => s.targets.length);
                    
                    data.skills = skills;
                    if (skills.length) {
                        if (currentEntity.waitInput) {
                            data.waitInput = new WaitInputProcessing(skills);
                            battle.addProcessor(waitInputProcessor, data.waitInput, 'WaitInput');
                        }
                    }
                    return 5;
                }
            }
            return 6;
        }
        case 5: {
            const mana = battle.getMana(currentEntity.teamId);

            const selection = (data.waitInput && data.waitInput.selection) || currentEntity.ai(battle, data, mana || null, data.skills);

            if (selection && selection.no && selection.targetId) {
                const skill = data.skills.find(s => s.no === selection.no && s.targets.includes(selection.targetId));
                if (skill) {
                    battle.actionUseSkill(selection.no, currentEntity.entityId, selection.targetId, skill.cost);
                }
            }
            return 6;
        }
        case 6: {
            battle.flushPendingDamageLogs();
            battle.flushPendingBuffLogs();
            
            battle.addEventProcessor(EventCodes.ACTION_END, currentEntity.entityId, data);
            battle.addEventProcessor(EventCodes.TURN_END, currentEntity.entityId, data);
            return 7;
        }
        case 7: {
            const mana = battle.manas[currentEntity.teamId];
            if (!mana) return 0;
            
            if (mana.progress >= 5) {
                mana.progress = 0;
                mana.preProgress = Math.min(5, mana.preProgress + 1);
                battle.actionUpdateMana(0, currentEntity.teamId, mana.preProgress, Reasons.RULE);
            }
            return -1;
        }
    }

    return 0;
}
