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
import NormalAttack from '../common/normal-attack';

const CONFIDENCE_BUFF_NAME = '信心';
const DISCOURAGEMENT_BUFF_NAME = '灰心';
const CONFIDENCE_STACKS_KEY = 'confidence_stacks';

// 构建信心buff
function buildConfidenceBuff(sourceId: number, targetId: number, stacks: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(CONFIDENCE_BUFF_NAME, 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.2 * stacks)
        .end();
}

// 构建灰心debuff
function buildDiscouragementDebuff(sourceId: number, targetId: number, stacks: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(DISCOURAGEMENT_BUFF_NAME, 1)
        .countDown(-1)
        .noRemove()
        .debuff()
        .buffAP(BattleProperties.EFT_RES, EffectTypes.ADD_RATE, -0.2 * stacks)
        .end();
}

// 技能1：破坏一发
export const utsuki_tamako_skill1: Skill = {
    no: 1,
    name: '破坏一发',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '别想一发，对单体对手造成攻击力50%的伤害，并击退对手10%行动条。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(0.5)
                .shouldComputeCri()
                .single()
                .skill('破坏一发')
                .end()
        );
        
        // 击退10%行动条
        battle.actionUpdateRunwayPercent(sourceId, selectedId, -0.1, Reasons.SKILL);
        battle.log(`【${source.name}】使用【破坏一发】，击退【${battle.getEntity(selectedId)?.name}】10%行动条`);
    },
};

// 技能2：信心感染
export const utsuki_tamako_skill2: Skill = {
    no: 2,
    name: '信心感染',
    passive: true,
    cost: 0,
    text: '被动技能。当自身成功造成一次超过4000点的伤害时，全队获得【信心】buff。当自身死亡时，全队【信心】buff将会转变成【灰心】。【信心】：攻击力提升20%，上限5层，持续到游戏结束。【灰心】：效果抵抗下降20%，上限5层，持续到游戏结束。',
    handlers: [
        // 造成伤害后检查是否超过4000点
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 获取伤害数据
                const attackData = data.data as any;
                if (!attackData || !attackData.attackInfos) return -1;
                
                // 检查是否有超过4000点的伤害
                let hasHighDamage = false;
                for (const attackInfo of attackData.attackInfos) {
                    if (attackInfo.finalDamage >= 4000) {
                        hasHighDamage = true;
                        break;
                    }
                }
                
                if (!hasHighDamage) return -1;
                
                // 获取当前信心层数
                const currentStacks = parseInt(source.getBattleData(CONFIDENCE_STACKS_KEY) || '0', 10);
                if (currentStacks >= 5) return -1; // 已达上限
                
                const newStacks = currentStacks + 1;
                source.setData(CONFIDENCE_STACKS_KEY, String(newStacks));
                
                // 为全队添加信心buff
                const allies = battle.getTeamEntities(source.teamId).filter(e => !e.dead);
                
                for (const ally of allies) {
                    // 移除旧的信心buff
                    const oldBuffs = battle.filterBuffByName(ally.entityId, CONFIDENCE_BUFF_NAME);
                    for (const oldBuff of oldBuffs) {
                        battle.actionRemoveBuff(oldBuff, Reasons.SKILL);
                    }
                    
                    // 添加新的信心buff
                    battle.actionAddBuff(buildConfidenceBuff(data.skillOwnerId, ally.entityId, newStacks), Reasons.SKILL);
                }
                
                battle.log(`【${source.name}】造成超过4000点伤害，全队获得【信心】buff（${newStacks}/5层），攻击力提升${newStacks * 20}%`);
                battle.addEventLog('skill', `【${source.name}】触发【信心感染】，全队攻击力提升${newStacks * 20}%`, {
                    sourceId: data.skillOwnerId,
                    stacks: newStacks,
                    atkBonus: newStacks * 20
                });
                
                return -1;
            },
            code: EventCodes.HAS_DAMAGED,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '信心感染-造成伤害',
        },
        // 死亡时将信心转变为灰心
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // eventId是死亡目标的ID，检查是否是自己
                const deadEntityId = data.eventId;
                if (deadEntityId !== data.skillOwnerId) return -1;
                
                // 获取当前信心层数
                const confidenceStacks = parseInt(source.getBattleData(CONFIDENCE_STACKS_KEY) || '0', 10);
                if (confidenceStacks <= 0) return -1; // 没有信心buff则不触发
                
                // 为全队将信心转变为灰心
                const allies = battle.getTeamEntities(source.teamId);
                
                for (const ally of allies) {
                    // 移除信心buff
                    const confidenceBuffs = battle.filterBuffByName(ally.entityId, CONFIDENCE_BUFF_NAME);
                    for (const buff of confidenceBuffs) {
                        battle.actionRemoveBuff(buff, Reasons.SKILL);
                    }
                    
                    // 移除旧的灰心debuff
                    const oldDiscouragementBuffs = battle.filterBuffByName(ally.entityId, DISCOURAGEMENT_BUFF_NAME);
                    for (const oldBuff of oldDiscouragementBuffs) {
                        battle.actionRemoveBuff(oldBuff, Reasons.SKILL);
                    }
                    
                    // 添加灰心debuff
                    battle.actionAddBuff(buildDiscouragementDebuff(data.skillOwnerId, ally.entityId, confidenceStacks), Reasons.SKILL);
                }
                
                battle.log(`【${source.name}】死亡，全队【信心】转变为【灰心】，效果抵抗下降${confidenceStacks * 20}%`);
                battle.addEventLog('skill', `【${source.name}】死亡触发【信心感染】，全队效果抵抗下降${confidenceStacks * 20}%`, {
                    sourceId: data.skillOwnerId,
                    stacks: confidenceStacks,
                    eftResDown: confidenceStacks * 20
                });
                
                return -1;
            },
            code: EventCodes.DEAD,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '信心感染-死亡',
        },
    ],
};

// 技能3：勇猛立直
export const utsuki_tamako_skill3: Skill = {
    no: 3,
    name: '勇猛立直',
    passive: false,
    cost: 2,
    target: SkillTarget.ENEMY,
    text: '牺牲自身10%最大生命值，对敌方单体目标造成攻击力300%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 计算牺牲的生命值（10%最大生命值）
        const maxHp = battle.getComputedProperty(sourceId, BattleProperties.MAX_HP);
        const sacrifice = Math.floor(maxHp * 0.1);
        
        // 执行牺牲（至少保留1点生命）
        const actualSacrifice = Math.min(sacrifice, source.hp - 1);
        if (actualSacrifice > 0) {
            source.hp = Math.max(1, source.hp - actualSacrifice);
            battle.log(`【${source.name}】牺牲${actualSacrifice}点生命发动【勇猛立直】`);
        }
        
        // 对敌方单体造成300%伤害
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(3.0)
                .shouldComputeCri()
                .single()
                .skill('勇猛立直')
                .end()
        );
        
        battle.addEventLog('skill', `【${source.name}】使用【勇猛立直】，牺牲${actualSacrifice}点生命，造成300%攻击力伤害`, {
            sourceId: sourceId,
            targetId: selectedId,
            sacrificeHp: actualSacrifice
        });
    },
};