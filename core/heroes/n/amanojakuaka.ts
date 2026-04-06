import {BattleProperties, Buff, Control, EffectTypes, Battle, Reasons, Skill} from '../../';
import NormalAttack from '../common/normal-attack';
import {SkillTarget} from "../../skill";

/**
 * 赤般若技能1：肉弹战车
 * 普通攻击技能
 */
export const amonojakuaka_skill1 = new NormalAttack('肉弹战车');
amonojakuaka_skill1.text = '化身为战车撞击敌方目标，造成攻击125%的伤害。';
amonojakuaka_skill1.target = SkillTarget.ENEMY;

/**
 * 赤般若技能2：挑衅
 * 单体控制技能，附带增伤和易伤效果
 */
export const amonojakuaka_skill2: Skill = {
    no: 2, // 技能编号
    name: '挑衅', // 技能名称
    cost: 2, // 技能消耗
    target: SkillTarget.ENEMY, // 目标类型为敌方
    text: '挑衅敌方目标，使其强制攻击自己，同时增加目标20%造成的伤害和40%受到的伤害，持续1回合。消耗2点鬼火。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        // 挑衅控制buff
        const buff1 = Buff
            .build(sourceId, selectedId)
            .name('挑衅', 1)
            .control(Control.PROVOKE) // 控制效果：挑衅
            .noDispel() // 不可驱散
            .countDown(1) // 持续1回合
            .probability(1) // 基础概率100%
            .end();
        
        // 增加目标造成的伤害
        const buff2 = Buff.build(sourceId, selectedId)
            .name('挑衅[增]')
            .countDown(1) // 持续1回合
            .buffAP(BattleProperties.DMG_DEALT_B, EffectTypes.FIXED, 0.2) // 增加20%伤害
            .end();
        
        // 增加目标受到的伤害
        const buff3 = Buff.build(sourceId, selectedId)
            .name('挑衅[易]')
            .countDown(1) // 持续1回合
            .debuffAP(BattleProperties.DMG_TAKEN_D, EffectTypes.FIXED, 0.4) // 增加40%受到的伤害
            .end();
        
        // 添加三个buff
        battle.actionAddBuff(buff1, Reasons.SKILL);
        battle.actionAddBuff(buff2, Reasons.SKILL);
        battle.actionAddBuff(buff3, Reasons.SKILL);
    },
};
