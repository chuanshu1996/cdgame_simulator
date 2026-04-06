import NormalAttack from '../common/normal-attack';
import SingleAttack from '../common/single-attack';

export const amanojakumidori_skill1 = new NormalAttack('我打');
amanojakumidori_skill1.text = '用竹子攻击敌方目标，造成攻击125%的伤害。';
export const amanojakumidori_skill2 = new SingleAttack(2, '我打打打', 0.88, 2, 3);
amanojakumidori_skill2.text = '连续攻击敌方目标3次，每次造成攻击88%的伤害。消耗2点鬼火。';
