import {
    AddBuffProcessing,
    Battle,
    BattleProperties,
    Buff,
    BuffParams,
    EffectTypes,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill
} from '../../index';
import NormalAttack from '../common/normal-attack';
import GroupAttack from '../common/group-attack';

/**
 * 大天狗技能1：风袭
 * 普通攻击技能
 */
export const ootengu_skill1: Skill = new NormalAttack('风袭');
ootengu_skill1.text = '以妖力凝聚成风刃攻击敌方目标，造成攻击125%的伤害。';

/**
 * 构建庇护buff
 * @param s 源ID
 * @param t 目标ID
 * @returns 庇护buff实例
 */
function buildBuff1(s: number, t: number): Buff {
    return Buff.build(s, t)
        .name('庇护', 1) // 同名最多1个
        .stamp() // 标记buff
        .end()
}

/**
 * 构建雄姿英发buff
 * @param s 源ID
 * @param t 目标ID
 * @returns 雄姿英发buff实例
 */
function buildBuff2(s: number, t: number): Buff {
    return Buff.build(s, t)
        .name('雄姿英发', 80) // 同名最多80个
        .stamp() // 标记buff
        .effect(BattleProperties.DMG_DEALT_B, EffectTypes.FIXED, 0.01) // 增加1%伤害
        .end()
}

/**
 * 大天狗技能2：钢铁之羽
 * 被动技能，提供庇护效果和伤害增益
 */
export const ootengu_skill2: Skill = {
    no: 2, // 技能编号
    name: '钢铁之羽', // 技能名称
    passive: true, // 被动技能
    cost: 0, // 技能消耗
    text: '被动技能。战斗开始及回合结束时获得【庇护】效果，可抵挡控制技能。回合开始时移除所有【庇护】。造成伤害时50%概率获得【雄姿英发】，每层增加1%伤害，最多叠加80层。',
    handlers: [
        {
            /**
             * 处理战斗开始事件
             * @param battle 战斗实例
             * @param data 事件数据
             * @description 战斗开始时获得庇护效果
             */
            handle(battle: Battle, data: RealEventData) {
                if (data.skillOwnerId) {
                    battle.actionAddBuff(buildBuff1(data.skillOwnerId, data.skillOwnerId), Reasons.SKILL);
                }
            },
            code: EventCodes.BATTLE_START, // 监听战斗开始事件
            range: EventRange.NONE,
            priority: 0,
            passive: true,
            name: '战斗开始获得【庇护】',
        }, 
        {
            /**
             * 处理回合结束事件
             * @param battle 战斗实例
             * @param data 事件数据
             * @description 回合结束时获得庇护效果
             */
            handle(battle: Battle, data: RealEventData) {
                if (data.skillOwnerId) {
                    battle.actionAddBuff(buildBuff1(data.skillOwnerId, data.skillOwnerId), Reasons.SKILL);
                }
            },
            code: EventCodes.TURN_END, // 监听回合结束事件
            range: EventRange.SELF,
            priority: 0,
            passive: true,
            name: '回合结束获得【庇护】',
        }, 
        {
            /**
             * 处理回合开始事件
             * @param battle 战斗实例
             * @param data 事件数据
             * @description 回合开始时失去所有庇护效果
             */
            handle(battle: Battle, data: RealEventData) {
                if (data.skillOwnerId) {
                    const buffs = battle.filterBuffByName(data.skillOwnerId, '庇护');
                    buffs.forEach(b => {
                        battle.actionRemoveBuff(b, Reasons.SKILL);
                    });
                }
            },
            code: EventCodes.TURN_START, // 监听回合开始事件
            range: EventRange.SELF,
            priority: 0,
            passive: false,
            name: '回合开始失去【庇护】'
        }, 
        {
            /**
             * 处理获得buff前事件
             * @param battle 战斗实例
             * @param data 事件数据
             * @description 庇护效果可以抵消控制效果
             */
            handle(battle: Battle, data: RealEventData) {
                if (data.skillOwnerId && data.data && (data.data as AddBuffProcessing).buff.hasParam(BuffParams.CONTROL)) {
                    const buffs = battle.filterBuffByName(data.skillOwnerId, '庇护');
                    if (buffs.length) {
                        (data.data as AddBuffProcessing).cancel = true; // 抵消控制效果
                        buffs.forEach(b => {
                            battle.actionRemoveBuff(b, Reasons.SKILL);
                        });
                    }
                }
            },
            code: EventCodes.BEFORE_BUFF_GET, // 监听获得buff前事件
            range: EventRange.SELF,
            priority: 0,
            passive: false,
            name: '庇护判定'
        },
        {
            /**
             * 处理造成伤害事件
             * @param battle 战斗实例
             * @param data 事件数据
             * @description 造成伤害时50%概率获得雄姿英发效果
             */
            handle(battle: Battle, data: RealEventData) {
                if(battle.testHit(0.5) && data.skillOwnerId) {
                    battle.actionAddBuff(buildBuff2(data.skillOwnerId, data.skillOwnerId), Reasons.SKILL);
                }
            },
            code: EventCodes.HAS_DAMAGED, // 监听造成伤害事件
            range: EventRange.SELF,
            priority: 0,
            passive: true,
            name: '造成伤害时: 获得雄姿英发'
        }
    ]
};

/**
 * 大天狗技能3：羽刃暴风
 * 群体攻击技能，造成4次群体伤害
 */
export const ootengu_skill3: Skill = new GroupAttack(3, '羽刃暴风', 0.45, 3, 4); // 技能编号3，名称羽刃暴风，伤害倍率0.45，消耗3火，攻击4次
ootengu_skill3.text = '以妖力召唤飓风，对敌方全体造成攻击45%的伤害4次。消耗3点鬼火。';
