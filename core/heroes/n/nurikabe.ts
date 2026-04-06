import {
    Buff,
    EffectTypes,
    Skill,
    Battle,
    BattleProperties,
    Reasons,
} from '../../';
import NormalAttack from '../common/normal-attack';
import {SkillTarget} from "../../skill";


export const nurikabes_skill1 = new NormalAttack('地震');
nurikabes_skill1.text = '引发地震攻击敌方目标，造成攻击125%的伤害。';
nurikabes_skill1.target = SkillTarget.ENEMY;
export const nurikabes_skill2: Skill = {
    no: 2,
    name: '坚壁',
    cost: 2,
    target: SkillTarget.TEAM,
    text: '为全体友方增加防御力，防御增加量为自身防御的20%加上目标防御的40%，持续2回合。消耗2点鬼火。',
    use(battle: Battle, sourceId: number, _: number) {
        const source = battle.getEntity(sourceId);

        const entities = battle.getTeamEntities(source.teamId); // 所有队友
        entities.forEach(e => {
            const buff = Buff.build(sourceId, e.entityId)
                .name('坚壁', 1)
                .countDown(2)
                .buffAP(BattleProperties.DEF, EffectTypes.FIXED, 0.2 * source.getProperty(BattleProperties.DEF) + 0.4 * e.getProperty(BattleProperties.DEF))
                .end();

            battle.actionAddBuff(buff, Reasons.SKILL);
        });

    },
};
