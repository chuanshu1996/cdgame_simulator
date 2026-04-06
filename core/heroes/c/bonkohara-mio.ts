import {
    Battle,
    Skill,
} from '../../';
import {SkillTarget} from '../../skill';
import NormalAttack from '../common/normal-attack';

export const bonkohara_mio_skill1: Skill = new NormalAttack('普通攻击');
bonkohara_mio_skill1.text = '对单体对手造成100%攻击伤害。';
bonkohara_mio_skill1.cost = 0;
bonkohara_mio_skill1.target = SkillTarget.ENEMY;

export const bonkohara_mio_skill2: Skill = {
    no: 2,
    name: '待定技能',
    passive: true,
    cost: 0,
    target: SkillTarget.SELF,
    text: '被动技能。效果待定。',
    handlers: [],
};

export const bonkohara_mio_skill3: Skill = {
    no: 3,
    name: '待定技能',
    passive: false,
    cost: 2,
    target: SkillTarget.ENEMY,
    text: '主动技能。效果待定。',
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    use(battle: Battle, sourceId: number, selectedId: number) {
    },
};
