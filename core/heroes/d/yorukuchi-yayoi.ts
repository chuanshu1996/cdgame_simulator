import {
    Battle,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
    EffectTypes,
    Control,
    BattleProperties
} from '../../';
import NormalAttack from '../common/normal-attack';
import {SkillTarget} from '../../skill';
import Buff from '../../buff';
import Attack from '../../attack';

const SEKIRENJI_SCHOOL = '石莲寺小学';
const SEKIRENJI_MEMBERS = [1009, 1011, 1015, 1016];

export const yorukuchi_yayoi_skill1 = new NormalAttack('认真打牌');
yorukuchi_yayoi_skill1.text = '认真打牌，对单体对手造成攻击125%的伤害。';
yorukuchi_yayoi_skill1.cost = 0;
yorukuchi_yayoi_skill1.target = SkillTarget.ENEMY;

export const yorukuchi_yayoi_skill2: Skill = {
    no: 2,
    name: '憧憬凶星',
    passive: true,
    cost: 0,
    target: SkillTarget.TEAM,
    text: '先机使全队获得【憧憬凶星】buff，效果命中提升20%，持续2回合。应援位也可发动。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return 0;
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return 0;
                
                const teamEntities = battle.getTeamEntities(entity.teamId);
                teamEntities.forEach(teamEntity => {
                    const buff = Buff.build(data.skillOwnerId, teamEntity.entityId)
                        .name('憧憬凶星', 1)
                        .buffAP('eft_hit', EffectTypes.ADD_RATE, 0.2)
                        .countDown(2)
                        .buff()
                        .end();
                    battle.actionAddBuff(buff, Reasons.SKILL);
                });
                
                battle.log(`【${entity.name}】发动憧憬凶星，全队效果命中提升20%，持续2回合`);
                return -1;
            },
            code: EventCodes.SENKI,
            range: EventRange.TEAM,
            priority: 0,
            passive: true,
            name: '【先机】憧憬凶星',
        }
    ],
};

export const yorukuchi_yayoi_skill3: Skill = {
    no: 3,
    name: '巧思',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '对全体敌方造成攻击力50%的伤害，造成伤害时有25%基础概率（受效果命中加成）施加【混乱】debuff，持续1回合。【混乱】：只能使用普通攻击，攻击随机选择目标（包括自身队友）。',
    use(battle: Battle, sourceId: number, _: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const enemies = battle.getEnemies(sourceId);
        const attacks: Attack[] = [];
        
        enemies.forEach(enemy => {
            const attack = Attack.build(enemy.entityId, sourceId)
                .rate(0.5)
                .skill('巧思')
                .group()
                .end();
            attacks.push(attack);
            
            const sourceEntity = battle.getEntity(sourceId);
            if (sourceEntity) {
                const eftHit = battle.getComputedProperty(sourceId, BattleProperties.EFT_HIT) || 0;
                const confusionProbability = 0.25 + eftHit;
                
                if (battle.testHit(confusionProbability)) {
                    const confusionBuff = Buff.build(sourceId, enemy.entityId)
                        .name('混乱', 1)
                        .control(Control.CONFUSION)
                        .countDown(1)
                        .debuff()
                        .end();
                    battle.actionAddBuff(confusionBuff, Reasons.SKILL);
                    battle.log(`【${enemy.name}】被混乱，持续1回合`);
                }
            }
        });
        
        battle.actionAttack(attacks);
        battle.log(`【${source.name}】使用巧思，对全体敌人造成伤害并尝试混乱`);
    },
};

function countSekirenjiMembers(battle: Battle, teamId: number): number {
    const teamEntities = battle.getTeamEntities(teamId);
    let count = 0;
    teamEntities.forEach(entity => {
        if (SEKIRENJI_MEMBERS.includes(entity.no)) {
            count++;
        }
    });
    return count;
}

function buildSekirenjiBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('石莲寺', 1)
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.1)
        .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.1)
        .noRemove()
        .buff()
        .end();
}

export const yorukuchi_yayoi_skill4: Skill = {
    no: 4,
    name: '部长技',
    passive: true,
    cost: 0,
    target: SkillTarget.TEAM,
    text: '当队伍（包括队伍设置中8个位置）中有3位及以上石莲寺小学的成员时先机发动，所有石莲寺小学的选手获得【石莲寺】buff，攻击以及防御增加10%。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return 0;
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return 0;
                
                const sekirenjiCount = countSekirenjiMembers(battle, entity.teamId);
                
                if (sekirenjiCount >= 3) {
                    const teamEntities = battle.getTeamEntities(entity.teamId);
                    teamEntities.forEach(teamEntity => {
                        if (SEKIRENJI_MEMBERS.includes(teamEntity.no)) {
                            const buff = buildSekirenjiBuff(data.skillOwnerId, teamEntity.entityId);
                            battle.actionAddBuff(buff, Reasons.SKILL);
                            battle.log(`【${teamEntity.name}】获得【石莲寺】buff，攻击和防御增加10%`);
                        }
                    });
                    
                    battle.log(`【${entity.name}】发动部长技，检测到${sekirenjiCount}位石莲寺小学成员，全队石莲寺成员获得【石莲寺】buff`);
                }
                
                return -1;
            },
            code: EventCodes.SENKI,
            range: EventRange.TEAM,
            priority: 0,
            passive: true,
            name: '【先机】部长技',
        }
    ],
};
