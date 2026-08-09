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

function hasBundoSeika(battle: Battle, teamId: number): boolean {
    const entities = battle.getTeamEntities(teamId);
    return entities.some(e => e.name === '文堂星夏' && !e.dead);
}

export const tsuyama_mutsuki_skill1: Skill = {
    no: 1,
    name: '谨慎进攻',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '使用谨慎的打法，对单体目标造成攻击力125%的伤害；若造成的伤害低于1250点，则改为造成1250点真实伤害（队伍中有文堂星夏时提升至1500点真实伤害）。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.25)
                .shouldComputeCri()
                .single()
                .skill('谨慎进攻')
                .completed((battle: Battle, data: any) => {
                    const attackInfo = data.attackInfos[0];
                    if (attackInfo) {
                        const damageDealt = attackInfo.finalDamage || 0;
                        
                        if (damageDealt < 1250) {
                            const hasAlly = hasBundoSeika(battle, source.teamId);
                            const targetDamage = hasAlly ? 1500 : 1250;
                            // 补足差额，使总伤害达到目标值
                            const diff = targetDamage - damageDealt;
                            
                            battle.actionAttack(
                                Attack.build(selectedId, sourceId)
                                    .base(() => diff)
                                    .rate(1)
                                    .real()
                                    .single()
                                    .skill('谨慎进攻')
                                    .end()
                            );
                            
                            battle.log(`【${source.name}】伤害不足1250，改为给予目标${targetDamage}点真实伤害${hasAlly ? '（文堂星夏加成）' : ''}`);
                        }
                    }
                })
                .end()
        );
    },
};

function getDeathCount(entity: any): number {
    const data = entity.getBattleData('tsuyama_death_count');
    return data !== null ? parseInt(data, 10) : 0;
}

function setDeathCount(entity: any, count: number): void {
    entity.setData('tsuyama_death_count', String(count));
}

function buildSpeedBuff(sourceId: number, targetId: number, count: number): Buff {
    const speedBonus = Math.min(count * 0.2, 0.4);
    return Buff.build(sourceId, targetId)
        .name('下任部长·速度', 1)
        .buffAP(BattleProperties.SPD, EffectTypes.ADD_RATE, speedBonus)
        .end();
}

export const tsuyama_mutsuki_skill2: Skill = {
    no: 2,
    name: '下任部长',
    passive: true,
    cost: 0,
    text: '被动技能。队伍中每阵亡1名队友，获得1层【下任部长·速度】buff，最多叠加2层，持续至战斗结束。【下任部长·速度】：每层使速度提升10%。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return -1;
                
                // eventId 是死亡目标的ID
                const deadEntityId = data.eventId;
                const deadEntity = battle.getEntity(deadEntityId);
                if (!deadEntity || deadEntity.teamId !== entity.teamId) return -1;
                
                // 不能触发自己的死亡事件
                if (deadEntityId === entity.entityId) return -1;
                
                const currentCount = getDeathCount(entity);
                if (currentCount >= 2) return -1; // 已达上限（最多2层，速度+20%）
                
                const newCount = currentCount + 1;
                setDeathCount(entity, newCount);
                
                battle.actionAddBuff(buildSpeedBuff(data.skillOwnerId, data.skillOwnerId, newCount), Reasons.SKILL);
                battle.log(`【${entity.name}】因队友阵亡，速度提升${newCount * 20}%`);
                battle.addEventLog('skill', `【${entity.name}】触发【下任部长】`, {
                    entityId: entity.entityId,
                    deathCount: newCount,
                    speedBonus: newCount * 10
                });
                
                return -1;
            },
            code: EventCodes.DEAD,
            range: EventRange.TEAM,
            priority: 20,
            passive: true,
            name: '下任部长',
        },
    ],
};

function buildCardAvoidDebuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('投牌回避', 1)
        .countDown(3)
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, -0.1)
        .debuff()
        .end();
}

function selectTarget(battle: Battle, sourceId: number): number[] {
    const source = battle.getEntity(sourceId);
    if (!source) return [];
    
    const enemies = battle.getTeamEntities(1 - source.teamId);
    if (enemies.length === 0) return [];
    
    // 按是否有投牌回避debuff和攻击力排序
    const sortedEnemies = enemies
        .filter(e => !e.dead)
        .sort((a, b) => {
            const aHasDebuff = battle.filterBuffByName(a.entityId, '投牌回避').length > 0;
            const bHasDebuff = battle.filterBuffByName(b.entityId, '投牌回避').length > 0;
            
            if (aHasDebuff !== bHasDebuff) {
                return aHasDebuff ? 1 : -1; // 没有debuff的排前面
            }
            
            const aAtk = battle.getComputedProperty(a.entityId, BattleProperties.ATK);
            const bAtk = battle.getComputedProperty(b.entityId, BattleProperties.ATK);
            return bAtk - aAtk; // 攻击力高的排前面
        });
    
    return sortedEnemies.length > 0 ? [sortedEnemies[0].entityId] : [];
}

export const tsuyama_mutsuki_skill3: Skill = {
    no: 3,
    name: '投牌回避',
    passive: false,
    cost: 2,
    target: (battle: Battle, sourceId: number) => selectTarget(battle, sourceId),
    text: '对单体目标造成攻击力200%的伤害，并对其施加【投牌回避】debuff，持续3回合。【投牌回避】：攻击力降低10%。优先攻击不具有【投牌回避】debuff的目标，其次优先攻击攻击力最高的目标。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(2.0)
                .shouldComputeCri()
                .single()
                .skill('投牌回避')
                .end()
        );
        
        battle.actionAddBuff(buildCardAvoidDebuff(sourceId, selectedId), Reasons.SKILL);
        battle.log(`【${source.name}】对【${battle.getEntity(selectedId)?.name}】附加【投牌回避】debuff`);
    },
};
