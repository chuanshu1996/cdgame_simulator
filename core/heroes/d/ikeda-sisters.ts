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
} from '../../';
import NormalAttack from '../common/normal-attack';
import {SkillTarget} from '../../skill';

export const ikeda_sisters_skill1: Skill = {
    no: 1,
    name: '元气进攻',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '池田三姐妹发动吵闹攻势，对单个敌方目标连续进行3次攻击，每次攻击造成攻击力33%的伤害。每次攻击单独计算暴击与效果命中，可触发基于单次伤害的御魂效果。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        for (let i = 0; i < 3; i++) {
            battle.actionAttack(
                Attack.build(selectedId, sourceId)
                    .rate(0.33)
                    .shouldComputeCri()
                    .single()
                    .skill('元气进攻')
                    .end()
            );
        }
    },
};

function getRemainingLives(entity: any): number {
    const data = entity.getBattleData('ikeda_sisters_lives');
    return data !== null ? parseInt(data, 10) : 2;
}

function setRemainingLives(entity: any, count: number): void {
    entity.setData('ikeda_sisters_lives', String(count));
}

export const ikeda_sisters_skill2: Skill = {
    no: 2,
    name: '三重替身',
    passive: true,
    cost: 0,
    text: '被动技能。当池田三姐妹受到致命伤害时，将保留1点生命值免于死亡，该效果每场战斗最多可触发2次。触发后不会解除控制状态。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return -1;
                
                const remainingLives = getRemainingLives(entity);
                if (remainingLives <= 0) return -1;
                
                const attackData = data.data as any;
                if (!attackData || !attackData.attackInfos) return -1;
                
                const attackInfo = attackData.attackInfos[attackData.index];
                if (!attackInfo) return -1;
                
                if (attackInfo.isDead && attackInfo.remainHp <= 0) {
                    attackInfo.isDead = false;
                    attackInfo.remainHp = 1;
                    
                    setRemainingLives(entity, remainingLives - 1);
                    
                    battle.log(`【${entity.name}】触发【三重替身】，免于死亡！剩余次数：${remainingLives - 1}`);
                    battle.addEventLog('skill', `【${entity.name}】触发【三重替身】，免于死亡！剩余次数：${remainingLives - 1}`, {
                        entityId: entity.entityId,
                        remainingLives: remainingLives - 1
                    });
                }
                
                return -1;
            },
            code: EventCodes.WILL_BE_DAMAGE,
            range: EventRange.SELF,
            priority: 100,
            passive: true,
            name: '三重替身',
        },
    ],
};

function findHighestStatEntity(battle: Battle, teamId: number, property: string): any {
    const entities = battle.getTeamEntities(teamId);
    let highest = null;
    let highestValue = -Infinity;
    
    for (const entity of entities) {
        if (entity.dead) continue;
        const value = entity.getProperty(property);
        if (value > highestValue) {
            highestValue = value;
            highest = entity;
        }
    }
    
    return highest;
}

function buildAtkBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('三重声援·攻击', 1)
        .countDown(1)
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.3)
        .end();
}

function buildDefBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('三重声援·防御', 1)
        .countDown(1)
        .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.3)
        .end();
}

function buildSpdBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('三重声援·速度', 1)
        .countDown(1)
        .buffAP(BattleProperties.SPD, EffectTypes.ADD_RATE, 0.3)
        .end();
}

function applyTripleCheer(battle: Battle, sourceId: number) {
    const source = battle.getEntity(sourceId);
    if (!source) return;
    
    const highestAtk = findHighestStatEntity(battle, source.teamId, BattleProperties.ATK);
    const highestDef = findHighestStatEntity(battle, source.teamId, BattleProperties.DEF);
    const highestSpd = findHighestStatEntity(battle, source.teamId, BattleProperties.SPD);
    
    if (highestAtk) {
        battle.actionAddBuff(buildAtkBuff(sourceId, highestAtk.entityId), Reasons.SKILL);
        battle.log(`【${source.name}】为【${highestAtk.name}】提升30%基础攻击`);
    }
    if (highestDef) {
        battle.actionAddBuff(buildDefBuff(sourceId, highestDef.entityId), Reasons.SKILL);
        battle.log(`【${source.name}】为【${highestDef.name}】提升30%基础防御`);
    }
    if (highestSpd) {
        battle.actionAddBuff(buildSpdBuff(sourceId, highestSpd.entityId), Reasons.SKILL);
        battle.log(`【${source.name}】为【${highestSpd.name}】提升30%速度`);
    }
}

export const ikeda_sisters_skill3: Skill = {
    no: 3,
    name: '三重声援',
    passive: false,
    cost: 3,
    target: SkillTarget.SELF,
    text: '为己方攻击最高的单位施加【三重声援·攻击】buff，基础攻击提升30%，持续1回合；为己方防御最高的单位施加【三重声援·防御】buff，基础防御提升30%，持续1回合；为己方速度最高的单位施加【三重声援·速度】buff，速度提升30%，持续1回合。增益效果基于目标单位基础属性计算。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return -1;
                
                if (entity.position === 7) {
                    const used = entity.getBattleData('ikeda_sisters_cheer_used');
                    if (used === 'true') return -1;
                    
                    applyTripleCheer(battle, data.skillOwnerId);
                    entity.setData('ikeda_sisters_cheer_used', 'true');
                    
                    battle.log(`【${entity.name}】在应援位触发【三重声援】`);
                    return -1;
                }
                
                return -1;
            },
            code: EventCodes.SENKI,
            range: EventRange.NONE,
            priority: 50,
            passive: false,
            name: '【先机】三重声援（应援位）',
        },
    ],
    use(battle: Battle, sourceId: number, _: number) {
        applyTripleCheer(battle, sourceId);
    },
};
