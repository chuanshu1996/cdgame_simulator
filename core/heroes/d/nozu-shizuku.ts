import {
    Attack,
    BattleProperties,
    Buff,
    Battle,
    EffectTypes,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
    Entity,
} from '../../';
import {SkillTarget} from '../../skill';
import {HeroTable} from '../index';

// 存储野津雫获取的技能
const nozuShizukuSkills = new Map<number, {
    normalAttack: Skill | null;
    skill3: Skill | null;
}>();

/**
 * 野津雫技能1：模仿速攻
 * 主动技能，消耗0点鬼火
 * 战斗开始时，先机获得速度最快的队友的普攻招数
 */
export const nozu_shizuku_skill1: Skill = {
    no: 1,
    name: '模仿速攻',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '战斗开始时，先机获得速度最快的队友的普攻招数，并使用该招数攻击敌人。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const skills = nozuShizukuSkills.get(sourceId);
        if (skills && skills.normalAttack) {
            // 使用获取的普攻招数
            skills.normalAttack.use?.(battle, sourceId, selectedId);
        } else {
            // 如果没有获取到技能，使用普通攻击
            battle.actionAttack(
                Attack.build(selectedId, sourceId)
                    .rate(1)
                    .shouldComputeCri()
                    .single()
                    .skill('模仿速攻')
                    .end()
            );
        }
    },
};

/**
 * 野津雫技能2：一惊一乍
 * 被动技能
 * 每当有对手造成伤害时，自身行动条增加5%
 */
export const nozu_shizuku_skill2: Skill = {
    no: 2,
    name: '一惊一乍',
    passive: true,
    cost: 0,
    text: '被动技能。每当有对手造成伤害时，自身行动条增加5%。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const self = battle.getEntity(data.skillOwnerId);
                if (!self) return -1;
                
                // data.eventId 是造成伤害的人（敌方）
                const damageDealer = battle.getEntity(data.eventId);
                if (!damageDealer) return -1;
                
                // 检查是否是对手造成的伤害
                if (damageDealer.teamId !== self.teamId) {
                    // 增加自身行动条5%
                    battle.actionUpdateRunwayPercent(data.skillOwnerId, data.skillOwnerId, 0.05, Reasons.SKILL);
                    battle.log(`【${self.name}】触发【一惊一乍】，行动条增加5%`);
                }
                
                return -1;
            },
            code: EventCodes.HAS_DAMAGED, // 造成伤害后
            range: EventRange.ENEMY, // 监听敌方造成伤害
            priority: 50,
            passive: true,
            name: '一惊一乍',
        },
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 初始化技能存储
                nozuShizukuSkills.set(data.skillOwnerId, {
                    normalAttack: null,
                    skill3: null,
                });
                
                // 获取队友列表
                const teammates = battle.getTeamEntities(source.teamId).filter(e => !e.dead && e.entityId !== data.skillOwnerId);
                
                if (teammates.length > 0) {
                    // 找到速度最快的队友
                    let fastestTeammate = teammates[0];
                    let highestSpeed = battle.getComputedProperty(fastestTeammate.entityId, BattleProperties.SPD);
                    
                    // 找到攻击最高的队友
                    let highestAtkTeammate = teammates[0];
                    let highestAtk = battle.getComputedProperty(highestAtkTeammate.entityId, BattleProperties.ATK);
                    
                    teammates.forEach(teammate => {
                        const speed = battle.getComputedProperty(teammate.entityId, BattleProperties.SPD);
                        if (speed > highestSpeed) {
                            highestSpeed = speed;
                            fastestTeammate = teammate;
                        }
                        
                        const atk = battle.getComputedProperty(teammate.entityId, BattleProperties.ATK);
                        if (atk > highestAtk) {
                            highestAtk = atk;
                            highestAtkTeammate = teammate;
                        }
                    });
                    
                    // 获取速度最快的队友的普攻招数
                    const fastestHeroData = HeroTable.get(fastestTeammate.no);
                    if (fastestHeroData && fastestHeroData.skills && fastestHeroData.skills[0]) {
                        const normalAttack = fastestHeroData.skills[0];
                        const skills = nozuShizukuSkills.get(data.skillOwnerId);
                        if (skills) {
                            skills.normalAttack = normalAttack;
                            nozuShizukuSkills.set(data.skillOwnerId, skills);
                            battle.log(`【${source.name}】通过【模仿速攻】获得了【${fastestTeammate.name}】的普攻招数`);
                        }
                    }
                    
                    // 获取攻击最高的队友的3技能
                    const highestAtkHeroData = HeroTable.get(highestAtkTeammate.no);
                    if (highestAtkHeroData && highestAtkHeroData.skills && highestAtkHeroData.skills[2]) {
                        const skill3 = highestAtkHeroData.skills[2];
                        const skills = nozuShizukuSkills.get(data.skillOwnerId);
                        if (skills) {
                            skills.skill3 = skill3;
                            nozuShizukuSkills.set(data.skillOwnerId, skills);
                            battle.log(`【${source.name}】通过【模仿强攻】获得了【${highestAtkTeammate.name}】的3技能`);
                        }
                    }
                }
                
                return -1;
            },
            code: EventCodes.SENKI, // 先机事件
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '技能获取',
        },
    ],
};

/**
 * 野津雫技能3：模仿强攻
 * 主动技能，消耗3点鬼火
 * 战斗开始时，先机获得攻击最高的队友的3技能
 */
export const nozu_shizuku_skill3: Skill = {
    no: 3,
    name: '模仿强攻',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '战斗开始时，先机获得攻击最高的队友的3技能。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const skills = nozuShizukuSkills.get(sourceId);
        if (skills && skills.skill3) {
            // 使用获取的3技能
            skills.skill3.use?.(battle, sourceId, selectedId);
        } else {
            // 如果没有获取到技能，使用默认攻击
            battle.actionAttack(
                Attack.build(selectedId, sourceId)
                    .rate(1.5)
                    .shouldComputeCri()
                    .single()
                    .skill('模仿强攻')
                    .end()
            );
        }
    },
};
