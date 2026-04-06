/**
 * 战斗主处理器
 * 负责处理整个战斗流程，包括战斗开始、行动顺序计算、回合处理等
 */
import turnProcessor, {TurnProcessing} from './turn';
import {Battle, EventCodes, createJudgeFlagEntity} from "../";
import fakeTurnProcessor from './fake-turn';

/**
 * 战斗处理器函数
 * @param battle 战斗对象
 * @param _ 数据（未使用）
 * @param step 处理步骤
 * @returns 下一步骤或结束标志
 */
export default function battleProcessor(battle: Battle, _: any, step: number): number {
    switch (step) {
        case 1: {
            // 触发战斗开始事件
            battle.addEventProcessor(EventCodes.BATTLE_START, 0, _);
            // 添加战斗开始日志
            battle.addEventLog('info', '战斗开始！');
            
            // 创建裁判旗实体
            createJudgeFlagEntity(battle);
            
            // 战斗开始时检查所有角色的最佳位置Buff
            battle.entities.forEach(entity => {
                if (entity.dead) return;
                
                const teamId = entity.teamId;
                // 跳过非正常队伍的实体（如裁判旗）
                if (teamId < 0 || teamId > 1) return;
                
                const field = battle.fields[teamId];
                if (!field) return;
                
                const currentPosition = field.indexOf(entity.entityId);
                
                // 检查当前位置是否与最佳位置一致
                if (entity.position !== -1 && currentPosition === entity.position) {
                    // 检查是否已经有最佳位置Buff
                    const hasBestPositionBuff = battle.buffs.some(buff => 
                        buff.ownerId === entity.entityId && buff.name === '最佳位置'
                    );
                    
                    if (!hasBestPositionBuff) {
                        // 添加最佳位置Buff
                        const buff = require('../buff').default.build(entity.entityId, entity.entityId)
                            .name('最佳位置', 1)
                            .noDispel()
                            .noRemove()
                            .buffAP('atk', 2, 0.1) // ADD_RATE
                            .buffAP('def', 2, 0.1) // ADD_RATE
                            .end();
                        battle.buffs.push(buff);
                        
                        // 添加Buff日志
                        battle.addPendingBuff(
                            entity.entityId,
                            entity.name,
                            entity.entityId,
                            entity.name,
                            '最佳位置',
                            1,
                            buff.effects[0]
                        );
                    }
                } else {
                    // 移除最佳位置Buff
                    const bestPositionBuff = battle.buffs.find(buff => 
                        buff.ownerId === entity.entityId && buff.name === '最佳位置'
                    );
                    
                    if (bestPositionBuff) {
                        battle.buffs.splice(battle.buffs.indexOf(bestPositionBuff), 1);
                    }
                }
            });
            
            // 刷新Buff日志
            battle.flushPendingBuffLogs();
            
            return 2; // 进入行动顺序计算步骤
        }
        case 2: {
            // 计算行动条
            battle.runway.compute();
            // 触发先机事件
            battle.addEventProcessor(EventCodes.SENKI, 0, _);
            return 3; // 进入回合处理步骤
        }
        case 3: {
            // 判断胜负
            battle.judgeWin();
            if (battle.isEnd) return -1; // 战斗结束
            
            // 清理回合临时数据
            battle.entities.forEach(e => e.turnData.clear());
            
            // 计算下一个行动的实体
            const nextId = battle.runway.computeNext();
            if (!nextId) {
                // 没有可行动的实体，根据存活实体数量判断胜负
                battle.judgeWin();
                return -1; // 战斗结束
            }

            const next = battle.getEntity(nextId);
            if (battle.turn >= 1000) {
                // 战斗超时，根据存活实体数量判断胜负
                battle.judgeWin();
                return -1; // 战斗结束
            }

            // 创建回合数据
            const turnData = new TurnProcessing(++battle.turn, next.entityId);

            // 添加回合处理器
            battle.addProcessor(turnProcessor, turnData, 'Turn');
            return 4; // 进入伪回合处理步骤
        }
        case 4: {
            // 处理伪回合
            if (battle.fakeTurns.length) {
                battle.fakeTurns.forEach(ft => battle.addProcessor(fakeTurnProcessor, ft, '伪回合处理'));
                battle.fakeTurns = [];
            }
            return 3; // 回到回合处理步骤
        }
        default:
            return 0; // 出错，结束处理
    }
}
