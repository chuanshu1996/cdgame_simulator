import { RemoveBuffProcessing } from './../../tasks/remove-buff';
import {
    Skill,
    Buff,
    EventCodes,
    EventRange,
    Battle,
    RealEventData,
    Reasons,
    EffectTypes,
    BattleProperties,
    Attack,
    Healing,
} from '../../';
import {SkillTarget, SelectableSkill, SkillSelection} from "../../skill";
import {TurnProcessing} from "../../tasks";
import {normalAI} from "../ai";
import Mana from '../../mana';

/**
 * 构建狂气buff
 * @param s 源ID
 * @param t 目标ID
 * @returns 狂气buff实例
 */
function buildKyoki(s: number, t: number): Buff {
    return Buff.build(s, t)
        .name('狂气', 4) // 同名最多4个
        .buff() // 增益
        .end()
}

/**
 * 酒吞童子技能1：鬼葫芦
 * 普通攻击技能，根据狂气层数增加攻击次数
 */
export const shutendoji_skill1: Skill = {
    no: 1, // 技能编号
    name: '鬼葫芦', // 技能名称
    cost: 0, // 技能消耗
    target: SkillTarget.ENEMY, // 目标类型为敌方
    text: '挥舞鬼葫芦攻击敌方目标，造成攻击125%的伤害。每层【狂气】增加1次攻击次数，最多攻击5次。',
    use: (battle: Battle, sourceId: number, selectedId: number) => {
        // 获取狂气buff数量
        const buffs = battle.filterBuffByName(sourceId, '狂气');
        
        // 攻击次数 = 1 + 狂气层数
        for (let i = 0; i < (1 + buffs.length); i++) {
            battle.actionAttack(
                Attack.build(selectedId, sourceId)
                    .rate(1.25) // 伤害倍率125%
                    .shouldComputeCri() // 启用暴击计算
                    .normalAttack() // 普通攻击
                    .end()
            );
        }
    }
};

/**
 * 酒吞童子技能2：狂气
 * 被动技能，获得狂气层数
 */
export const shutendoji_skill2: Skill = {
    no: 2, // 技能编号
    name: '狂气', // 技能名称
    cost: 0, // 技能消耗
    passive: true, // 被动技能
    text: '被动技能。回合结束时50%概率获得1层【狂气】，受到攻击时25%概率获得1层【狂气】。最多叠加4层。',
    handlers: [
        {
            /**
             * 处理回合结束事件
             * @param battle 战斗实例
             * @param data 事件数据
             * @param step 步骤
             * @description 回合结束时50%概率获得狂气
             */
            handle: (battle: Battle, data: any, step: number) => {
                if (data.skillOwnerId) {
                    const buffs = battle.filterBuffByName(data.skillOwnerId, '狂气');
                    if (buffs.length >= 4) return; // 最多4层狂气
                    const isHit = battle.testHit(0.5); // 50%概率
                    if (isHit) {
                        battle.actionAddBuff(buildKyoki(data.skillOwnerId, data.skillOwnerId), Reasons.SKILL);
                    }
                }
            },
            code: EventCodes.TURN_END, // 监听回合结束事件
            range: EventRange.SELF, // 事件范围
            priority: 0, // 优先级
            passive: true, // 是否是写在被动里的
            name: '回合结束获得狂气',
        },
        {
            /**
             * 处理受到攻击事件
             * @param battle 战斗实例
             * @param data 事件数据
             * @param step 步骤
             * @description 受到攻击时25%概率获得狂气
             */
            handle: (battle: Battle, data: RealEventData, step: number) =>{
                if (data.skillOwnerId) {
                    const buffs = battle.filterBuffByName(data.skillOwnerId, '狂气');
                    if (buffs.length >= 4) return; // 最多4层狂气
                    const isHit = battle.testHit(0.25); // 25%概率
                    if (isHit) {
                        battle.actionAddBuff(buildKyoki(data.skillOwnerId, data.skillOwnerId), Reasons.SKILL);
                    }
                }
            },
            code: EventCodes.HAS_BEEN_ATTACKED, // 监听受到攻击事件
            range: EventRange.SELF, // 事件范围
            priority: 0, // 优先级
            passive: true, // 是否是写在被动里的
            name: '受到攻击获得狂气',
        },
    ]
};

/**
 * 酒吞童子技能3：狂啸
 * 消耗狂气层数，获得鬼王降临形态
 */
export const shutendoji_skill3: Skill = {
    no: 3, // 技能编号
    name: '狂啸', // 技能名称
    cost: 3, // 技能消耗
    text: '消耗所有【狂气】，恢复30%生命值，增加50%行动条，获得【鬼王降临】形态。形态期间免疫控制，附带10%吸血效果。持续时间等于消耗的【狂气】层数。消耗3点鬼火。',
    handlers: [
        {
            /**
             * 处理buff移除事件
             * @param battle 战斗实例
             * @param data 事件数据
             * @param step 步骤
             * @description 鬼王降临形态结束时失去所有狂气
             */
            handle: (battle: Battle, data: RealEventData, step: number) =>{
               const processing = data.data as RemoveBuffProcessing;
               const buff = processing.buff;
               if (buff.name === '鬼王降临') { // 形态结束时失去所有狂气
                const buffs = battle.filterBuffByName(buff.ownerId, '狂气');
                buffs.forEach(b => {
                    battle.actionRemoveBuff(b, Reasons.COST);
                });
               }
               return -1;
            },
            code: EventCodes.BUFF_REMOVE, // 监听buff移除事件
            range: EventRange.SELF, // 事件范围
            priority: 0, // 优先级
            passive: false, // 是否是写在被动里的
            name: '鬼王降临形态结束处理',
        }
    ],
    
    /**
     * 获取技能目标
     * @param battle 战斗实例
     * @param entityId 技能释放者ID
     * @returns 目标ID数组
     * @description 只有拥有狂气时才能使用此技能，目标为自身
     */
    target: (battle: Battle, entityId: number): number[] =>{
        const buffs = battle.filterBuffByName(entityId, '狂气');
        if (!buffs.length) return []; // 没有狂气时无法使用
        return [entityId]; // 目标为自身
    },
    
    /**
     * 使用技能
     * @param battle 战斗实例
     * @param sourceId 技能释放者ID
     * @param selectedId 目标ID
     * @description 消耗所有狂气，获得鬼王降临形态，同时恢复生命值和增加行动条
     */
    use: (battle: Battle, sourceId: number, selectedId: number) => {
        const buffs = battle.filterBuffByName(sourceId, '狂气');
        if (!buffs.length) return; // 没有狂气时无法使用
        
        // 恢复30%生命值
        battle.actionHeal(Healing.build(sourceId, sourceId).rate(0.3).shouldComputeCri().end());
        
        // 增加50%行动条
        battle.actionUpdateRunwayPercent(sourceId, sourceId, 0.5, Reasons.SKILL);
        
        // 获得鬼王降临形态
        battle.actionAddBuff(
            Buff.build(sourceId, selectedId)
                .name('鬼王降临', 1) // 同名最多1个
                .stamp() // 标记buff
                .ruleControlImmune() // 免疫控制
                .effect(BattleProperties.HP_STEAL, EffectTypes.FIXED, 0.1) // 附带10%吸血
                .countDownBySource(buffs.length) // 持续时间等于狂气层数
                .end()
        );
    }
};

/**
 * 酒吞童子自定义AI
 * 当生命值>=70%时，优先使用普通攻击
 * @param battle 战斗对象
 * @param turnData 回合数据
 * @param mana 鬼火对象
 * @param selections 可选技能列表
 * @returns 技能选择对象
 */
export function shutendojiAI(battle: Battle, turnData: TurnProcessing, mana: Mana | null, selections: SelectableSkill[]): SkillSelection | null {
    const currentEntity = battle.getEntity(turnData.currentId);
    if (!currentEntity) return normalAI(battle, turnData, mana, selections);
    
    const maxHp = battle.getComputedProperty(currentEntity.entityId, BattleProperties.MAX_HP);
    const hpPercent = currentEntity.hp / maxHp;
    
    // 当生命值>=70%时，优先使用普通攻击
    if (hpPercent >= 0.7) {
        const normalAttack = selections.find(s => s.no === 1 && s.targets.length);
        if (normalAttack) {
            return {
                no: normalAttack.no,
                targetId: battle.getRandomOne(normalAttack.targets),
            };
        }
    }
    
    // 其他情况使用默认AI
    return normalAI(battle, turnData, mana, selections);
}
