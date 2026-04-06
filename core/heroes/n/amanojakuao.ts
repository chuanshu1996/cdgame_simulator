import {
    Buff,
    EffectTypes,
    BattleProperties,
} from '../../';
import {SkillTarget} from '../../skill';
import BuffSkill from '../common/buff-skill';
import SingleAttack from '../common/single-attack';

export const amonojakuao_skill1 = new SingleAttack(1, '乱打', 0.33, 0, 3, true);
amonojakuao_skill1.text = '疯狂乱打敌方目标3次，每次造成攻击33%的伤害。';
amonojakuao_skill1.target = SkillTarget.ENEMY;
export const amonojakuao_skill2 = new BuffSkill(2, '低吟', 2, (_, sourceId, targetId) =>
    Buff.build(sourceId, targetId)
        .name('低吟', 1)
        .countDown(1)
        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, 40)
        .end()
);
amonojakuao_skill2.text = '低声吟唱，使友方目标速度增加40点，持续1回合。消耗2点鬼火。';
