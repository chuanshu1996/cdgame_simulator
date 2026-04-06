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
import {AttackProcessing} from '../../tasks';

function hasTsuyamaMutsuki(battle: Battle, teamId: number): boolean {
    const entities = battle.getTeamEntities(teamId);
    return entities.some(e => e.name === '津山睦月' && !e.dead);
}

export const bundo_seika_skill1: Skill = {
    no: 1,
    name: '卡牌收集',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '兴奋地收集各种卡牌，对单体目标造成攻击力125%的伤害。如果队伍中有津山睦月，则对单体目标造成攻击力200%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const hasAlly = hasTsuyamaMutsuki(battle, source.teamId);
        const rate = hasAlly ? 2.0 : 1.25;
        
        if (hasAlly) {
            battle.log(`【${source.name}】因津山睦月的存在，卡牌收集威力提升！`);
        }
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(rate)
                .shouldComputeCri()
                .single()
                .skill('卡牌收集')
                .end()
        );
    },
};

function getKenzenCount(entity: any): number {
    const data = entity.getBattleData('bundo_kenzen_count');
    return data !== null ? parseInt(data, 10) : 0;
}

function setKenzenCount(entity: any, count: number): void {
    entity.setData('bundo_kenzen_count', String(count));
}

function buildKenzenBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('稳健', 5)
        .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.1)
        .end();
}

function buildAtkBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('呼唤队长·攻击', 1)
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.1)
        .end();
}

function buildResistBuff(sourceId: number, targetId: number, count: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('呼唤队长·抵抗', 1)
        .buffAP(BattleProperties.EFT_RES, EffectTypes.FIXED, 0.1 * count)
        .end();
}

export const bundo_seika_skill2: Skill = {
    no: 2,
    name: '呼唤队长',
    passive: true,
    cost: 0,
    text: '被动技能。当血量低于50%时触发，获得【呼唤队长·攻击】buff，攻击力提升10%，持续至战斗结束。每层【稳健】额外提供10%效果抵抗（通过【呼唤队长·抵抗】buff实现）。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return -1;
                
                const triggered = entity.getBattleData('bundo_call_captain_triggered');
                if (triggered === 'true') return -1;
                
                const maxHp = battle.getComputedProperty(entity.entityId, BattleProperties.MAX_HP);
                const hpPercent = entity.hp / maxHp;
                
                if (hpPercent < 0.5) {
                    entity.setData('bundo_call_captain_triggered', 'true');
                    
                    battle.actionAddBuff(buildAtkBuff(data.skillOwnerId, data.skillOwnerId), Reasons.SKILL);
                    
                    const kenzenCount = getKenzenCount(entity);
                    if (kenzenCount > 0) {
                        battle.actionAddBuff(buildResistBuff(data.skillOwnerId, data.skillOwnerId, kenzenCount), Reasons.SKILL);
                    }
                    
                    battle.log(`【${entity.name}】触发【呼唤队长】，增加10%攻击${kenzenCount > 0 ? `，${kenzenCount}层【稳健】提供${kenzenCount * 10}%效果抵抗` : ''}`);
                    battle.addEventLog('skill', `【${entity.name}】触发【呼唤队长】`, {
                        entityId: entity.entityId,
                        kenzenCount: kenzenCount
                    });
                }
                
                return -1;
            },
            code: EventCodes.HAS_BEEN_DAMAGED,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '呼唤队长',
        },
    ],
};

export const bundo_seika_skill3: Skill = {
    no: 3,
    name: '冒险立直',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '牺牲1000点生命，对单体目标造成攻击力280%的伤害。如果造成的伤害大于5000，则获得【稳健】buff。【稳健】：防御力提升10%，持续至战斗结束，最多叠加5层。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const sacrifice = Math.min(1000, source.hp - 1);
        if (sacrifice > 0) {
            source.hp = Math.max(1, source.hp - sacrifice);
            battle.log(`【${source.name}】牺牲${sacrifice}点生命发动【冒险立直】`);
        }
        
        function completedProcessor(battle: Battle, data: AttackProcessing): number {
            const attackInfo = data.attackInfos[data.index];
            if (!attackInfo) return -1;
            
            const damage = attackInfo.finalDamage || 0;
            
            if (damage > 5000) {
                const kenzenBuffs = battle.filterBuffByName(sourceId, '稳健');
                if (kenzenBuffs.length < 5) {
                    battle.actionAddBuff(buildKenzenBuff(sourceId, sourceId), Reasons.SKILL);
                    
                    const newCount = kenzenBuffs.length + 1;
                    setKenzenCount(source, newCount);
                    
                    battle.log(`【${source.name}】因伤害超过5000获得【稳健】（${newCount}/5层）`);
                    battle.addEventLog('skill', `【${source.name}】获得【稳健】buff`, {
                        entityId: source.entityId,
                        stackCount: newCount
                    });
                }
            }
            
            return -1;
        }
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(2.8)
                .shouldComputeCri()
                .single()
                .skill('冒险立直')
                .completed(completedProcessor)
                .end()
        );
    },
};
