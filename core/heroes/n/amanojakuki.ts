import {
    Buff,
    EffectTypes,
    BattleProperties,
} from '../../';
import {SkillTarget} from '../../skill';
import NormalAttack from '../common/normal-attack';
import BuffSkill from '../common/buff-skill';

export const amanojakuki_skill1 = new NormalAttack('咚咚');
amanojakuki_skill1.text = '敲击鼓面攻击敌方目标，造成攻击125%的伤害。';
amanojakuki_skill1.target = SkillTarget.ENEMY;
export const amanojakuki_skill2 = new BuffSkill(2,'锵锵锵', 2 , (_, sourceId, targetId) => Buff.build(sourceId, targetId)
    .countDown(1)
    .buffAP(BattleProperties.CRI, EffectTypes.FIXED, 0.15)
    .end()
);
amanojakuki_skill2.text = '敲响铜锣，使友方目标暴击率增加15%，持续1回合。消耗2点鬼火。';
