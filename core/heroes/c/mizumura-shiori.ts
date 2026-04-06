import {
    Attack,
    Battle,
    BattleProperties,
    Buff,
    BuffParams,
    EffectTypes,
    Entity,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
} from '../..';
import {SkillTarget} from '../../skill';
import {createMakeupMirror, isMakeupMirror} from '../../summons/makeup-mirror';

export const mizumura_shiori_skill1: Skill = {
    no: 1,
    name: '镜面射线',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '使用镜子折射光线，对单体对手造成125%攻击伤害。有化妆镜时额外对另一位随机对手造成相同伤害，伤害来源视为化妆镜。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.25)
                .shouldComputeCri()
                .single()
                .skill('镜面射线')
                .end()
        );
        
        const mirror = battle.getSummon(source.teamId);
        if (mirror && isMakeupMirror(mirror) && !mirror.dead) {
            const enemies = battle.getEnemies(sourceId).filter(e => e.entityId !== selectedId);
            if (enemies.length > 0) {
                const randomEnemy = battle.getRandomOne(enemies.map(e => e.entityId));
                if (randomEnemy) {
                    battle.actionAttack(
                        Attack.build(randomEnemy, mirror.entityId)
                            .rate(1.25)
                            .shouldComputeCri()
                            .single()
                            .skill('镜面射线')
                            .end()
                    );
                    battle.log(`【化妆镜】折射光线，对【${battle.getEntity(randomEnemy)?.name}】造成伤害`);
                }
            }
        }
    },
};

export const mizumura_shiori_skill2: Skill = {
    no: 2,
    name: '迷人妆容',
    passive: true,
    cost: 0,
    target: SkillTarget.SELF,
    text: '被动技能。当受到一次单体伤害时，10%的概率（+效果命中）使伤害来源获得着迷【debuff】（有化妆镜时概率增加至15%）。着迷：下回合强制使用普通攻击攻击debuff给予者。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const selfEntity = battle.getEntity(data.skillOwnerId);
                if (!selfEntity || selfEntity.dead) return -1;
                
                const attackData = data.data as any;
                if (!attackData || !attackData.attackInfos) return -1;
                
                const attackInfos = attackData.attackInfos;
                if (!attackInfos || attackInfos.length !== 1) return -1;
                
                const attackInfo = attackInfos[0];
                const attackerId = attackData.attacks?.[0]?.sourceId;
                if (!attackerId) return -1;
                
                const attacker = battle.getEntity(attackerId);
                if (!attacker || attacker.teamId === selfEntity.teamId) return -1;
                
                const baseProbability = 0.10;
                const eftHit = battle.getComputedProperty(selfEntity.entityId, BattleProperties.EFT_HIT);
                let probability = baseProbability + eftHit;
                
                const mirror = battle.getSummon(selfEntity.teamId);
                if (mirror && isMakeupMirror(mirror) && !mirror.dead) {
                    probability += 0.05;
                }
                
                if (!battle.testHit(probability)) return -1;
                
                const charmedBuff = Buff.build(selfEntity.entityId, attacker.entityId)
                    .name('着迷', 1)
                    .debuff()
                    .countDown(2)
                    .end();
                battle.actionAddBuff(charmedBuff, Reasons.SKILL);
                
                battle.log(`【${selfEntity.name}】发动【迷人妆容】，使【${attacker.name}】着迷`);
                battle.addEventLog('skill', `【${selfEntity.name}】发动【迷人妆容】，使【${attacker.name}】着迷`, {
                    sourceId: selfEntity.entityId,
                    targetId: attacker.entityId
                });
                
                return -1;
            },
            code: EventCodes.HAS_BEEN_DAMAGED,
            range: EventRange.SELF,
            priority: 100,
            passive: true,
            name: '迷人妆容',
        },
    ],
};

export const mizumura_shiori_skill3: Skill = {
    no: 3,
    name: '美美补妆',
    passive: false,
    cost: 3,
    target: SkillTarget.SELF,
    text: '己方没有召唤物时，召唤出一个化妆镜，继承自身30%的生命值。',
    use(battle: Battle, sourceId: number, _: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const existingSummon = battle.getSummon(source.teamId);
        if (existingSummon) {
            battle.log(`【${source.name}】己方已有召唤物，无法召唤化妆镜`);
            return;
        }
        
        const maxHp = battle.getComputedProperty(sourceId, BattleProperties.MAX_HP);
        const mirrorHp = Math.floor(maxHp * 0.3);
        
        const mirror = createMakeupMirror(sourceId, mirrorHp);
        battle.summonEntity(mirror, source.teamId);
        
        battle.log(`【${source.name}】使用【美美补妆】，召唤化妆镜（生命值：${mirrorHp}）`);
        battle.addEventLog('skill', `【${source.name}】使用【美美补妆】，召唤化妆镜`, {
            sourceId: sourceId,
            mirrorId: mirror.entityId,
            mirrorHp: mirrorHp
        });
    },
};

function charmedAI(battle: Battle, turnData: any, mana: any, selections: any[]): any {
    const entity = battle.getEntity(turnData.currentId);
    if (!entity) return null;
    
    const charmedBuff = battle.buffs.find(b => 
        b.ownerId === entity.entityId && 
        b.name === '着迷' &&
        !b.hasParam(BuffParams.NO_DISPEL)
    );
    
    if (!charmedBuff) return null;
    
    const charmerId = charmedBuff.sourceId;
    const charmer = battle.getEntity(charmerId);
    if (!charmer || charmer.dead) return null;
    
    const normalAttack = selections.find(s => s.no === 1 && s.targets.includes(charmerId));
    if (normalAttack) {
        return {
            no: 1,
            targetId: charmerId
        };
    }
    
    return null;
}

export const mizumura_shiori_skill1_normal = {
    no: 1,
    name: '镜面射线',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '使用镜子折射光线，对单体对手造成125%攻击伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.25)
                .shouldComputeCri()
                .single()
                .skill('镜面射线')
                .end()
        );
    },
};
