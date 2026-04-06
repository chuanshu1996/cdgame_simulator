/**
 * AI模块
 * 负责处理游戏中选手的AI行为，包括技能选择和目标选择
 */
import {Battle, Mana} from '../../index';
import {TurnProcessing} from '../../tasks';
import {SelectableSkill, SkillSelection} from "../../skill";

/**
 * 普通AI
 * 智能AI逻辑，优先使用高伤害/高价值技能
 * @param battle 战斗对象
 * @param turnData 回合数据
 * @param mana 鬼火对象
 * @param selections 可选技能列表
 * @returns 技能选择对象，如果选择成功，否则返回null
 */
export function normalAI(battle: Battle, turnData: TurnProcessing, mana: Mana | null, selections: SelectableSkill[]): SkillSelection | null {
    if (!selections.length) return null;
    
    const currentMana = mana ? mana.num : 0;
    
    // 按照优先级排序技能：
    // 1. 消耗鬼火越多优先级越高（通常高消耗技能伤害更高）
    // 2. 技能编号越大优先级越高（3技能 > 2技能 > 1技能）
    const sortedSkills = [...selections]
        .filter(s => s.targets.length)
        .sort((a, b) => {
            // 首先按鬼火消耗排序（降序）
            if (b.cost !== a.cost) return b.cost - a.cost;
            // 然后按技能编号排序（降序）
            return b.no - a.no;
        });
    
    // 优先选择鬼火充足的高伤害技能
    for (const skill of sortedSkills) {
        if (currentMana >= skill.cost && skill.targets.length) {
            return {
                no: skill.no,
                targetId: battle.getRandomOne(skill.targets),
            };
        }
    }
    
    // 鬼火不足时，使用普通攻击（技能编号1，消耗0鬼火）
    const normalAttack = selections.find(s => s.no === 1 && s.targets.length);
    if (normalAttack) {
        return {
            no: normalAttack.no,
            targetId: battle.getRandomOne(normalAttack.targets),
        };
    }
    
    return null;
}

// 以下是一些选手的AI实现示例，目前已注释掉

// export default class AkaJita extends Entity {
//     ai(battle: Battle, turn: any): boolean {
//         /**
//          赤舌
//          --技能选择
//          当敌方单位数大于等于2时：
//          鬼火大于等于3时：使用3技能[风鼓雷]。
//          鬼火小于3时：使用1技能[海扁]。
//          当敌方单位数小于2时：
//          鬼火大于5时：使用3技能[风鼓雷]。
//          鬼火小于等于5时：使用1技能[海扁]。
//          上述鬼火判定中的“3”在非通常情况下受其他因素影响(如真大蛇、苍风一目连)，“5”不受影响。
//          --目标选择
//          1技能[海扁]：当敌方有生命比例在20%以下的单位时，优先选择其中生命比例最低的单位为目标。
//          */
//         const enemies = battle.getEnemies(this.entityId);
//         if (enemies.length === 0) return false;
//
//         const line = enemies.length >= 2 ? 5 : 3;
//
//         const mana = battle.getMana(this.teamId);
//         if (!mana) return false;
//         if (mana.num > line) {
//             if (battle.actionCheckAndUseSkill(2, this.entityId, enemies[0].entityId)) return true;
//         }
//
//         const enemy = battle.getRandomEnemy(this.entityId);
//         if (!enemy) return false;
//         battle.actionUseSkill(1, this.entityId, enemy.entityId);
//         return true;
//     }
// }
// export default class AmoNoJakuAka extends Entity {
//     ai(battle: Battle, turn: any): boolean {
//         /**
//          天邪鬼赤
//          --技能选择
//          使用2技能[挑衅]。
//          --目标选择
//          1技能[肉弹战车]：随机。
//          2技能[挑衅]：随机。
//          */
//         const enemy = battle.getRandomEnemy(this.entityId);
//         if (!enemy) return false;
//
//         if (battle.actionCheckAndUseSkill(2, this.entityId, enemy.entityId)) {
//             return true;
//         }
//
//         battle.actionUseSkill(1, this.entityId, enemy.entityId);
//
//         return true;
//     }
// }
