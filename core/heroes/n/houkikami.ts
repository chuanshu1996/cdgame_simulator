import {Attack, AttackParams, BattleProperties, Battle, Skill} from '../../';
import GroupAttack from '../common/group-attack';
import {SkillTarget} from "../../skill";

export const houkikami_skill1: Skill = {
    no: 1,
    handlers: [],
    passive: false,
    cost: 0,
    name: '蓄力一攻',
    target: SkillTarget.ENEMY,
    text: '用扫帚攻击敌方目标，造成攻击100%的伤害。伤害基于目标攻击力计算，但不超过自身攻击力的150%。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const at = Attack.build(selectedId, sourceId)
            .rate(1)
            .base((battle: Battle, sourceId: number, targetId: number): number => {
                const target = battle.getEntity(targetId);
                return battle.getComputedProperty(target.entityId, BattleProperties.ATK);
            })
            .limit((battle: Battle, sourceId: number, _: number): number => {
                const source = battle.getEntity(sourceId);
                return battle.getComputedProperty(source.entityId, BattleProperties.ATK) * 1.5;}
            )
            .single()
            .normalAttack()
            .end();
        battle.actionAttack(at);
    },
};
export const houkikami_skill2 = new GroupAttack(2, '大扫除', 1.31, 2);
houkikami_skill2.text = '挥舞扫帚对敌方全体进行大扫除，造成攻击131%的伤害。消耗2点鬼火。';
