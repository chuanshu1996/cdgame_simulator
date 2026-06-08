/**
 * 阴阳师裁判旗机制
 * 实现百鬼弈中的裁决鬼王效果
 */

import {BattleProperties} from './constant';
import Battle, {BattleLogType} from './battle';
import Entity from './entity';

/**
 * 裁判旗状态类
 */
export class JudgeFlag {
    private judgeKingActionCount: number = 0; // 裁决鬼王行动次数
    private normalLayers: number = 0; // 常规阶段层数
    private ultimateLayers: number = 0; // 究极阶段层数
    
    /**
     * 裁决鬼王行动
     */
    onJudgeKingAction(): void {
        this.judgeKingActionCount += 1;
        
        if (this.judgeKingActionCount <= 10) {
            this.normalLayers += 1;
        } else {
            this.ultimateLayers += 1;
        }
    }
    
    /**
     * 获取状态
     */
    getStatus(): {
        judgeKingActionCount: number;
        normalLayers: number;
        ultimateLayers: number;
        totalLayers: number;
        damageMultiplier: number;
        healMultiplier: number;
    } {
        const totalDamageBonus = this.normalLayers * 0.15 + this.ultimateLayers * 0.30;
        const totalHealReduction = Math.min((this.normalLayers + this.ultimateLayers) * 0.20, 0.8);
        const damageMultiplier = 1 + totalDamageBonus;
        const healMultiplier = Math.max(0.2, 1 - totalHealReduction);
        
        return {
            judgeKingActionCount: this.judgeKingActionCount,
            normalLayers: this.normalLayers,
            ultimateLayers: this.ultimateLayers,
            totalLayers: this.normalLayers + this.ultimateLayers,
            damageMultiplier: damageMultiplier,
            healMultiplier: healMultiplier
        };
    }
    
    /**
     * 获取伤害倍率
     */
    getDamageMultiplier(): number {
        const totalDamageBonus = this.normalLayers * 0.15 + this.ultimateLayers * 0.30;
        return 1 + totalDamageBonus;
    }
    
    /**
     * 获取治疗倍率
     */
    getHealMultiplier(): number {
        const totalHealReduction = Math.min((this.normalLayers + this.ultimateLayers) * 0.20, 0.8);
        return Math.max(0.2, 1 - totalHealReduction);
    }
}

/**
 * 裁判旗管理器（单例模式）
 */
export class JudgeFlagManager {
    private static instance: JudgeFlagManager;
    private judgeFlags: Map<number, JudgeFlag> = new Map(); // 战斗ID -> 裁判旗
    
    private constructor() {
        // 私有构造函数
    }
    
    /**
     * 获取单例实例
     */
    static getInstance(): JudgeFlagManager {
        if (!JudgeFlagManager.instance) {
            JudgeFlagManager.instance = new JudgeFlagManager();
        }
        return JudgeFlagManager.instance;
    }
    
    /**
     * 获取指定战斗的裁判旗
     */
    getJudgeFlag(battle: Battle): JudgeFlag {
        const battleId = battle.battleId; // 直接访问battleId属性
        if (!this.judgeFlags.has(battleId)) {
            this.judgeFlags.set(battleId, new JudgeFlag());
        }
        return this.judgeFlags.get(battleId) || new JudgeFlag();
    }
    
    /**
     * 为战斗生成唯一ID（已废弃，battle构造函数已设置battleId）
     */
    private generateBattleId(battle: Battle): number {
        return battle.battleId || Date.now() + Math.random();
    }
    
    /**
     * 清理指定战斗的裁判旗
     */
    clearJudgeFlag(battle: Battle): void {
        const battleId = battle.battleId; // 直接访问battleId属性
        this.judgeFlags.delete(battleId);
    }
}

/**
 * 应用裁判旗伤害倍率
 * @param battle 战斗对象
 * @param damage 原始伤害
 * @returns 应用倍率后的伤害
 */
export function applyJudgeFlagDamageMultiplier(battle: Battle, damage: number): number {
    const judgeFlag = JudgeFlagManager.getInstance().getJudgeFlag(battle);
    return damage * judgeFlag.getDamageMultiplier();
}

/**
 * 应用裁判旗治疗倍率
 * @param battle 战斗对象
 * @param heal 原始治疗
 * @returns 应用倍率后的治疗
 */
export function applyJudgeFlagHealMultiplier(battle: Battle, heal: number): number {
    const judgeFlag = JudgeFlagManager.getInstance().getJudgeFlag(battle);
    return heal * judgeFlag.getHealMultiplier();
}

/**
 * 触发裁决鬼王行动
 * 当裁决鬼王完成一次行动时调用
 * @param battle 战斗对象
 */
export function triggerJudgeKingAction(battle: Battle): void {
    const judgeFlag = JudgeFlagManager.getInstance().getJudgeFlag(battle);
    
    judgeFlag.onJudgeKingAction();
    
    const newStatus = judgeFlag.getStatus();
    const damageMultiplier = judgeFlag.getDamageMultiplier();
    const healMultiplier = judgeFlag.getHealMultiplier();
    
    // 记录裁判旗状态变化
    battle.log(`【裁判旗】裁决鬼王行动第${newStatus.judgeKingActionCount}次`);
    battle.log(`【裁判旗】常规层数: ${newStatus.normalLayers}, 究极层数: ${newStatus.ultimateLayers}`);
    battle.log(`【裁判旗】伤害倍率: ${damageMultiplier.toFixed(2)}x, 治疗倍率: ${healMultiplier.toFixed(2)}x`);
    
    // 添加事件日志
    battle.addEventLog('info' as BattleLogType, `裁决鬼王行动第${newStatus.judgeKingActionCount}次`, {
        normalLayers: newStatus.normalLayers,
        ultimateLayers: newStatus.ultimateLayers,
        damageMultiplier: damageMultiplier,
        healMultiplier: healMultiplier
    });
}

/**
 * 创建裁判旗实体
 * @param battle 战斗对象
 */
export function createJudgeFlagEntity(battle: Battle): void {
    // 创建裁判旗实体
    const judgeFlagEntity = new Entity();
    judgeFlagEntity.entityId = -999; // 特殊ID
    judgeFlagEntity.name = '裁判旗';
    judgeFlagEntity.teamId = 2; // 第三方队伍
    judgeFlagEntity.no = -1; // 特殊no值，不会被judgeWin计数
    
    // 设置属性
    judgeFlagEntity.setProperty(BattleProperties.SPD, 80); // 速度为80
    judgeFlagEntity.setProperty(BattleProperties.MAX_HP, 999999);
    judgeFlagEntity.setProperty(BattleProperties.ATK, 1);
    judgeFlagEntity.setProperty(BattleProperties.DEF, 1);
    judgeFlagEntity.setProperty(BattleProperties.CRI, 0);
    judgeFlagEntity.setProperty(BattleProperties.CRI_DMG, 1.5);
    judgeFlagEntity.setProperty(BattleProperties.EFT_RES, 0);
    judgeFlagEntity.setProperty(BattleProperties.EFT_HIT, 0);
    
    judgeFlagEntity.hp = 999999; // 设置当前生命值
    judgeFlagEntity.dead = false; // 确保不是死亡状态
    
    // 添加到战斗实体中
    battle.entities.set(judgeFlagEntity.entityId, judgeFlagEntity);
    
    // 添加到行动条
    battle.runway.addEntity(judgeFlagEntity.entityId, () => 80);
    
    // 记录日志
    battle.log('【裁判旗】裁决鬼王加入战场，速度为80');
    battle.addEventLog('info' as BattleLogType, '裁决鬼王加入战场，速度为80');
}

/**
 * 处理裁判旗行动
 * @param battle 战斗对象
 * @param entityId 裁判旗实体ID
 */
export function processJudgeFlagAction(battle: Battle, entityId: number): void {
    // 检查是否是裁判旗
    const entity = battle.getEntity(entityId);
    if (entity.name !== '裁判旗') return;
    
    // 触发裁决鬼王行动
    triggerJudgeKingAction(battle);
    
    // 计算裁判旗的当前层数
    const judgeFlag = JudgeFlagManager.getInstance().getJudgeFlag(battle);
    const status = judgeFlag.getStatus();
    const totalLayers = status.normalLayers + status.ultimateLayers;
    
    // 记录裁判旗行动
    battle.log(`【裁判旗】行动，当前层数: ${totalLayers}`);
    
    // 重置裁判旗的行动条位置，使其可以再次行动
    battle.runway.set(entityId, 0);
}

/**
 * 测试用例
 */
export function runJudgeFlagTests() {
    console.log('=== 裁判旗机制测试 ===');
    
    const judgeFlag = new JudgeFlag();
    
    // 测试1：裁决鬼王行动3次
    console.log('\n测试1：裁决鬼王行动3次');
    for (let i = 0; i < 3; i++) {
        judgeFlag.onJudgeKingAction();
    }
    console.log('状态:', judgeFlag.getStatus());
    
    // 测试2：裁决鬼王行动4次（验证减疗是否达到80%上限）
    console.log('\n测试2：裁决鬼王行动4次');
    judgeFlag.onJudgeKingAction();
    console.log('状态:', judgeFlag.getStatus());
    
    // 测试3：裁决鬼王行动10次（验证减疗是否保持80%不再增长）
    console.log('\n测试3：裁决鬼王行动10次');
    for (let i = 0; i < 6; i++) {
        judgeFlag.onJudgeKingAction();
    }
    console.log('状态:', judgeFlag.getStatus());
    
    // 测试4：裁决鬼王行动16次（验证究极阶段的增伤计算、减疗保持上限）
    console.log('\n测试4：裁决鬼王行动16次');
    for (let i = 0; i < 6; i++) {
        judgeFlag.onJudgeKingAction();
    }
    console.log('状态:', judgeFlag.getStatus());
    
    console.log('\n=== 测试完成 ===');
}
