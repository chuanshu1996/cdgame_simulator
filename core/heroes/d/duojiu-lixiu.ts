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
import {SkillTarget} from '../../skill';

const MORNING_POWER_BUFF_NAME = '早晨的力量';

function buildMorningPowerBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(MORNING_POWER_BUFF_NAME, 3)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.1)
        .end();
}

export const duojiu_lixiu_skill1: Skill = {
    no: 1,
    name: '清醒进攻',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '早晨打牌思路清晰，对单体目标造成攻击力125%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.25)
                .shouldComputeCri()
                .single()
                .skill('清醒进攻')
                .end()
        );
    },
};

export const duojiu_lixiu_skill2: Skill = {
    no: 2,
    name: '早晨的力量',
    passive: true,
    cost: 0,
    text: '【先机】战斗开始时，获得3层【早晨的力量】buff，持续至战斗结束。【早晨的力量】：每层提升自身10%攻击力，最多叠加3层。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                for (let i = 0; i < 3; i++) {
                    const buff = buildMorningPowerBuff(data.skillOwnerId, data.skillOwnerId);
                    battle.actionAddBuff(buff, Reasons.SKILL);
                }
                
                battle.log(`【${source.name}】获得3层【早晨的力量】`);
                battle.addEventLog('skill', `【${source.name}】先机获得3层【早晨的力量】`, {
                    entityId: data.skillOwnerId,
                    stackCount: 3
                });
                
                return -1;
            },
            code: EventCodes.SENKI,
            range: EventRange.NONE,
            priority: 50,
            passive: true,
            name: '【先机】早晨的力量',
        },
    ],
};

export const duojiu_lixiu_skill3: Skill = {
    no: 3,
    name: '享受爆米花',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '消耗3点鬼火，对全体敌方造成攻击力120%的伤害。若自身拥有【早晨的力量】buff，则消耗1层，并使此次攻击变为间接伤害（无视部分防御）。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const selected = battle.getEntity(selectedId);
        if (!selected) return;
        
        const hasMorningPower = battle.hasBuffByName(sourceId, MORNING_POWER_BUFF_NAME);
        
        if (hasMorningPower) {
            const morningPowerBuffs = battle.filterBuffBySource(sourceId, sourceId)
                .filter(b => b.name === MORNING_POWER_BUFF_NAME);
            
            if (morningPowerBuffs.length > 0) {
                battle.actionRemoveBuff(morningPowerBuffs[0], Reasons.COST);
                battle.log(`【${source.name}】消耗1层【早晨的力量】，此次攻击变为间接伤害`);
            }
        }
        
        const entities = battle.getTeamEntities(selected.teamId);
        
        const infos = entities.map(e => {
            const attackBuilder = Attack.build(e.entityId, sourceId)
                .rate(1.2)
                .shouldComputeCri()
                .group()
                .skill('享受爆米花');
            
            if (hasMorningPower) {
                attackBuilder.indirect();
            }
            
            return attackBuilder.end();
        });
        
        battle.actionAttack(infos);
    },
};
