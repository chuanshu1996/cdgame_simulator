/**
 * 使用技能处理器
 * 负责处理游戏中技能的使用逻辑，包括消耗鬼火、执行技能效果等
 */
import {Reasons, Battle, EventCodes} from "../";

/**
 * 使用技能处理数据类
 * 存储技能使用的相关信息
 */
export class UseSkillProcessing {
    /**
     * 构造函数
     * @param no 技能编号
     * @param sourceId 来源ID
     * @param selectedId 选中目标ID
     * @param cost 消耗鬼火
     * @param reason 使用原因
     */
    constructor(
        public no: number, // 技能编号
        public sourceId: number, // 来源ID
        public selectedId: number, // 选中目标ID
        public cost: number, // 消耗鬼火
        public reason: Reasons = Reasons.NOTHING // 使用原因
    ) {

    }
}

/**
 * 使用技能处理器函数
 * @param battle 战斗对象
 * @param data 使用技能处理数据
 * @param step 处理步骤
 * @returns 下一步骤或结束标志
 */
export default function useSkillProcessor(battle: Battle, data: UseSkillProcessing, step: number) {
    if (!(data instanceof UseSkillProcessing)) return 0; // 数据类型错误，出错

    const source = battle.getEntity(data.sourceId); // 技能使用者
    const selected = battle.getEntity(data.selectedId); // 技能目标
    const skill = source.getSkill(data.no); // 技能对象
    
    switch (step) {
        case 1: {
            // 设置当前技能名称
            battle.setCurrentSkill(skill.name);

            // 输出技能使用日志
            battle.log(`【${source.name}(${source.teamId})】对【${selected.name}(${selected.teamId})】使用技能【${skill.name}】`);
            // 添加技能使用日志
            battle.addEventLog('skill', `【${source.name}】对【${selected.name}】使用技能【${skill.name}】`);

            // 消耗鬼火
            if (data.cost > 0) {
                battle.actionUpdateMana(source.entityId, source.teamId, -data.cost, Reasons.COST);
                
                // 记录鬼火消耗数据
                const currentManaUsed = Number(source.battleData.get('manaUsed')) || 0;
                source.battleData.set('manaUsed', String(currentManaUsed + data.cost));
            }
            return 2; // 进入执行技能效果步骤
        }
        case 2: {
            // 执行技能效果
            if (skill.use) {
                try {
                    skill.use(battle, data.sourceId, data.selectedId);
                } catch (error) {
                    console.warn(`Error executing skill ${skill.name}:`, error);
                }
            }
            return 3; // 进入触发技能事件步骤
        }
        case 3: {
            // 触发使用技能后事件
            battle.addEventProcessor(EventCodes.SKILL, source.entityId, data);
            return -1; // 结束处理
        }
    }
    return 0; // 出错，结束处理
}