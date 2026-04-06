import {
    Battle,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
} from '../../';
import NormalAttack from '../common/normal-attack';
import {SkillTarget} from '../../skill';

export const uegashi_megumi_skill1 = new NormalAttack('平常心打');
uegashi_megumi_skill1.text = '快速攻击敌方目标，造成攻击力125%的伤害。';
uegashi_megumi_skill1.target = SkillTarget.ENEMY;

export const uegashi_megumi_skill2: Skill = {
    no: 2,
    name: '最美笑容',
    passive: true,
    cost: 0,
    target: SkillTarget.SELF,
    text: '【先机】战斗开始时，立即获得2点鬼火。',
    handlers: [{
        handle(battle: Battle, data: RealEventData) {
            if (!data.skillOwnerId) return 0;
            const entity = battle.getEntity(data.skillOwnerId);
            if (!entity) return 0;
            battle.actionUpdateMana(data.skillOwnerId, entity.teamId, 2, Reasons.SKILL);
            return -1;
        },
        code: EventCodes.SENKI,
        range: EventRange.NONE,
        priority: 0,
        passive: true,
        name: '【先机】最美笑容',
    }],
};

export const uegashi_megumi_skill3: Skill = {
    no: 3,
    name: '寄托给大将',
    passive: false,
    cost: 0,
    target: SkillTarget.SELF,
    text: '牺牲自身当前生命值的30%，获得2点鬼火。牺牲后至少保留1点生命值。',
    use(battle: Battle, sourceId: number, _: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const currentHp = source.hp;
        const sacrificeRatio = 0.3;
        
        const sacrificeHp = Math.floor(currentHp * sacrificeRatio);
        const newHp = Math.max(1, currentHp - sacrificeHp);
        source.hp = newHp;
        
        battle.actionUpdateMana(sourceId, source.teamId, 2, Reasons.SKILL);
        
        battle.log(`【${source.name}】使用寄托给大将，牺牲${sacrificeHp}点生命值，获得2点鬼火`);
    },
};
