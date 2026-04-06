import NormalAttack from '../common/normal-attack';
import GroupAttack from '../common/group-attack';

export const karakasakozou_skill1 = (new NormalAttack('我顶！'));
karakasakozou_skill1.text = '用伞顶撞敌方目标，造成攻击125%的伤害。';
export const karakasakozou_skill2 = (new GroupAttack(2, '天旋地转', 1.29, 2, 2));
karakasakozou_skill2.text = '快速旋转伞对敌方全体造成攻击129%的伤害2次。消耗2点鬼火。';
