import {
    Attack,
    AttackParams,
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

const QIYUAN_DEFENSE_BUFF_NAME = '祈愿防御';
const QIYUAN_ATTACK_BUFF_NAME = '祈愿进攻';
const FINAL_PRAYER_USED_KEY = 'final_prayer_used';
const QIYUAN_DEFENSE_STACKS_KEY = 'qiyuan_defense_stacks';
const QIYUAN_ATTACK_STACKS_KEY = 'qiyuan_attack_stacks';

function buildQiyuanDefenseBuff(sourceId: number, targetId: number, stacks: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(QIYUAN_DEFENSE_BUFF_NAME, 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.DEF, EffectTypes.FIXED, 25 * stacks)
        .end();
}

function buildQiyuanAttackBuff(sourceId: number, targetId: number, stacks: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(QIYUAN_ATTACK_BUFF_NAME, 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.ATK, EffectTypes.FIXED, 20 * stacks)
        .end();
}

function hasTeammateHinomoriSeishi(battle: Battle, teamId: number): boolean {
    const teammates = battle.getTeamEntities(teamId);
    return teammates.some(e => e.name === '桧森誓子' && !e.dead);
}

export const honnai_naruka_skill1: Skill = {
    no: 1,
    name: '骨笛表演',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '稳扎稳打，对全体敌方目标造成攻击力2%的真实伤害（队友为桧森誓子时上升至4%攻击力）。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const selected = battle.getEntity(selectedId);
        if (!selected) return;
        
        const enemies = battle.getTeamEntities(selected.teamId).filter(e => !e.dead);
        
        let rate = 0.02;
        if (hasTeammateHinomoriSeishi(battle, source.teamId)) {
            rate = 0.04;
            battle.log(`【${source.name}】有队友桧森誓子，骨笛表演伤害提升至4%`);
        }
        
        const attackInfos = enemies.map(enemy => {
            return Attack.build(enemy.entityId, sourceId)
                .rate(rate)
                .param(AttackParams.REAL)
                .shouldComputeCri()
                .group()
                .skill('骨笛表演')
                .end();
        });
        
        battle.actionAttack(attackInfos);
    },
};

export const honnai_naruka_skill2: Skill = {
    no: 2,
    name: '策略变化',
    passive: true,
    cost: 0,
    text: '被动技能。当自身受到一次攻击时，获得1层【祈愿防御】；当自身造成一次伤害时，获得1层【祈愿进攻】。【祈愿防御】：每层增加25防御力，持续到战斗结束。【祈愿进攻】：每层增加20攻击力，持续到战斗结束。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                let currentDefenseStacks = parseInt(source.getBattleData(QIYUAN_DEFENSE_STACKS_KEY) || '0', 10);
                
                const defenseBuff = battle.buffs.find(buff => 
                    buff.name === QIYUAN_DEFENSE_BUFF_NAME && buff.ownerId === data.skillOwnerId
                );
                if (defenseBuff) {
                    battle.actionRemoveBuff(defenseBuff, Reasons.SKILL);
                }
                
                currentDefenseStacks += 1;
                source.setData(QIYUAN_DEFENSE_STACKS_KEY, String(currentDefenseStacks));
                
                const newBuff = buildQiyuanDefenseBuff(data.skillOwnerId, data.skillOwnerId, currentDefenseStacks);
                battle.actionAddBuff(newBuff, Reasons.SKILL);
                
                battle.log(`【${source.name}】受到攻击，获得1层【祈愿防御】，当前${currentDefenseStacks}层，防御力+${25 * currentDefenseStacks}`);
                
                return -1;
            },
            code: EventCodes.HAS_BEEN_ATTACKED,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '策略变化-祈愿防御',
        },
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                let currentAttackStacks = parseInt(source.getBattleData(QIYUAN_ATTACK_STACKS_KEY) || '0', 10);
                
                const attackBuff = battle.buffs.find(buff => 
                    buff.name === QIYUAN_ATTACK_BUFF_NAME && buff.ownerId === data.skillOwnerId
                );
                if (attackBuff) {
                    battle.actionRemoveBuff(attackBuff, Reasons.SKILL);
                }
                
                currentAttackStacks += 1;
                source.setData(QIYUAN_ATTACK_STACKS_KEY, String(currentAttackStacks));
                
                const newBuff = buildQiyuanAttackBuff(data.skillOwnerId, data.skillOwnerId, currentAttackStacks);
                battle.actionAddBuff(newBuff, Reasons.SKILL);
                
                battle.log(`【${source.name}】造成伤害，获得1层【祈愿进攻】，当前${currentAttackStacks}层，攻击力+${20 * currentAttackStacks}`);
                
                return -1;
            },
            code: EventCodes.HAS_DAMAGED,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '策略变化-祈愿进攻',
        },
    ],
};

export const honnai_naruka_skill3: Skill = {
    no: 3,
    name: '最终祈愿',
    passive: false,
    cost: 0,
    hide: true,
    limited: true,
    target: SkillTarget.ENEMY,
    text: '【限定技】当自身生命值低于25%时可使用，整场战斗仅限一次。对全体敌方目标造成攻击力150%的真实伤害，造成的伤害转化成护盾给予自身（持续2回合）。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const selected = battle.getEntity(selectedId);
        if (!selected) return;
        
        source.setData(`limited_skill_3_used`, 'true');
        source.setData(FINAL_PRAYER_USED_KEY, 'true');
        
        const enemies = battle.getTeamEntities(selected.teamId).filter(e => !e.dead);
        
        // 固定150%伤害倍率
        const totalRate = 1.5;
        
        battle.log(`【${source.name}】使用【最终祈愿】，伤害倍率150%`);
        
        let totalDamage = 0;
        const atk = battle.getComputedProperty(sourceId, BattleProperties.ATK);
        
        enemies.forEach(enemy => {
            const damage = Math.floor(atk * totalRate);
            totalDamage += damage;
            
            battle.actionAttack(
                Attack.build(enemy.entityId, sourceId)
                    .base(() => damage)
                    .rate(1)
                    .param(AttackParams.REAL)
                    .group()
                    .skill('最终祈愿')
                    .end()
            );
        });
        
        if (totalDamage > 0) {
            const shieldBuff = Buff.build(sourceId, sourceId)
                .name('最终祈愿护盾', 1)
                .countDown(2)
                .shield(totalDamage)
                .buff()
                .end();
            battle.actionAddBuff(shieldBuff, Reasons.SKILL);
            
            battle.log(`【${source.name}】获得护盾，护盾值：${totalDamage}，持续2回合`);
            battle.addEventLog('skill', `【${source.name}】使用限定技【最终祈愿】，对全体敌方造成150%攻击力的真实伤害，获得${totalDamage}点护盾（持续2回合）！`, {
                sourceId: sourceId,
                totalDamage: totalDamage,
                shieldValue: totalDamage
            });
        }
    },
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                const hasUsed = source.getBattleData(FINAL_PRAYER_USED_KEY) === 'true';
                if (hasUsed) return -1;
                
                const maxHp = battle.getComputedProperty(data.skillOwnerId, BattleProperties.MAX_HP);
                const hpPercent = source.hp / maxHp;
                
                // 生命值低于25%时可使用
                if (hpPercent < 0.25) {
                    source.setData('final_prayer_available', 'true');
                } else {
                    source.setData('final_prayer_available', 'false');
                }
                
                return -1;
            },
            code: EventCodes.TURN_START,
            range: EventRange.SELF,
            priority: 100,
            passive: true,
            name: '最终祈愿-可用性检查',
        },
    ],
};
