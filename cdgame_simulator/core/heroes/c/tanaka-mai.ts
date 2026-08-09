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
import {HeroTable} from '../index';

const SPEED_BUFF_NAME = '鼻子喷气·速度';
const SPEED_STACKS_KEY = 'nose_blow_speed_stacks';

// 检查角色是否有【物理】标签
function hasPhysicalLabel(entity: any): boolean {
    const heroData = HeroTable.get(entity.no);
    if (!heroData || !heroData.label) return false;
    return heroData.label.split('，').includes('物理');
}

// 检查实体是否是敌方召唤物
function isEnemySummon(battle: Battle, targetId: number, sourceTeamId: number): boolean {
    const enemyTeamId = 1 - sourceTeamId;
    const summonPosition = 8;
    if (battle.fields[enemyTeamId].length <= summonPosition) return false;
    const summonEntityId = battle.fields[enemyTeamId][summonPosition];
    if (summonEntityId <= 0) return false;
    return summonEntityId === targetId;
}

// 获取速度叠加层数
function getSpeedStacks(entity: any): number {
    return parseInt(entity.getBattleData(SPEED_STACKS_KEY) || '0', 10);
}

// 设置速度叠加层数
function setSpeedStacks(entity: any, stacks: number) {
    entity.setData(SPEED_STACKS_KEY, String(stacks));
}

// 构建速度buff
function buildSpeedBuff(sourceId: number, targetId: number, stacks: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(SPEED_BUFF_NAME, stacks)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, 10 * stacks)
        .end();
}

/**
 * 技能1：鼻子喷气
 * 0火，主动技能
 * 对单体目标造成攻击力120%的伤害，同时增加自身10点速度，最多叠加2层，持续到游戏结束。
 */
export const tanaka_mai_skill1: Skill = {
    no: 1,
    name: '鼻子喷气',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对单体目标造成攻击力120%的伤害，并使自身速度提升10点，最多叠加2层，持续至战斗结束。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.2)
                .shouldComputeCri()
                .single()
                .skill('鼻子喷气')
                .end()
        );
        
        // 增加自身10点速度，最多叠加2层
        let currentStacks = getSpeedStacks(source);
        if (currentStacks < 2) {
            // 移除旧的速度buff
            const oldBuffs = battle.filterBuffByName(sourceId, SPEED_BUFF_NAME);
            for (const oldBuff of oldBuffs) {
                battle.actionRemoveBuff(oldBuff, Reasons.SKILL);
            }
            
            currentStacks += 1;
            setSpeedStacks(source, currentStacks);
            
            const newBuff = buildSpeedBuff(sourceId, sourceId, currentStacks);
            battle.actionAddBuff(newBuff, Reasons.SKILL);
            battle.log(`【${source.name}】增加10点速度（第${currentStacks}层，共${10 * currentStacks}点）`);
        } else {
            battle.log(`【${source.name}】的速度已达到最大叠加层数`);
        }
    },
};

/**
 * 技能2：场外攻击
 * 被动技能
 * 角色标签有【物理】的角色，对敌方召唤物的伤害增加300%。
 */
export const tanaka_mai_skill2: Skill = {
    no: 2,
    name: '场外攻击',
    passive: true,
    cost: 0,
    text: '被动技能。所有标签含【物理】的角色，对敌方召唤物造成的伤害提升300%。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.eventId) return -1;
                
                const attacker = battle.getEntity(data.eventId);
                if (!attacker) return -1;
                
                // 检查攻击者是否有【物理】标签
                if (!hasPhysicalLabel(attacker)) return -1;
                
                // 获取攻击数据，检查目标是否是敌方召唤物
                const attackData = data.data as any;
                if (!attackData || !attackData.attackInfos) return -1;
                
                const attackInfo = attackData.attackInfos[attackData.index];
                if (!attackInfo) return -1;
                
                // 获取当前攻击的目标
                const attacks = attackData.attacks;
                const currentAttack = attacks ? attacks[attackData.index] : null;
                if (!currentAttack) return -1;
                
                const targetId = currentAttack.targetId;
                
                // 检查目标是否是敌方召唤物
                if (isEnemySummon(battle, targetId, attacker.teamId)) {
                    // 对敌方召唤物伤害增加300%
                    attackInfo.damageDealtBuff += 3.0;
                    battle.log(`【${attacker.name}】触发【场外攻击】，对敌方召唤物伤害增加300%`);
                }
                
                return -1;
            },
            code: EventCodes.WILL_ATTACK,
            range: EventRange.TEAM,
            priority: 50,
            passive: true,
            name: '场外攻击',
        },
    ],
};

/**
 * 技能3：大三元
 * 6火，主动技能
 * 对敌方全体目标造成攻击力133%的伤害（如果自身速度为全场最高，则改为造成攻击333%的伤害）。
 */
export const tanaka_mai_skill3: Skill = {
    no: 3,
    name: '大三元',
    passive: false,
    cost: 6,
    target: SkillTarget.ENEMY,
    text: '对敌方全体造成攻击力133%的伤害；若自身速度为全场最高，则改为造成攻击力333%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const selected = battle.getEntity(selectedId);
        if (!selected) return;
        
        // 检查自身速度是否为全场最高
        const mySpd = battle.getComputedProperty(sourceId, BattleProperties.SPD);
        let isHighestSpd = true;
        
        for (let teamId = 0; teamId <= 1; teamId++) {
            const team = battle.getTeamEntities(teamId);
            for (const entity of team) {
                if (entity.dead || entity.entityId === sourceId) continue;
                if (entity.teamId < 0 || entity.teamId > 1) continue;
                const spd = battle.getComputedProperty(entity.entityId, BattleProperties.SPD);
                if (spd >= mySpd) {
                    isHighestSpd = false;
                    break;
                }
            }
            if (!isHighestSpd) break;
        }
        
        const damageRate = isHighestSpd ? 3.33 : 1.33;
        
        const enemies = battle.getTeamEntities(selected.teamId).filter(e => !e.dead);
        
        const attackInfos = enemies.map(enemy => {
            return Attack.build(enemy.entityId, sourceId)
                .rate(damageRate)
                .shouldComputeCri()
                .group()
                .skill('大三元')
                .end();
        });
        battle.actionAttack(attackInfos);
        
        const rateDesc = isHighestSpd ? '333%（全场速度最高）' : '133%';
        battle.log(`【${source.name}】使用【大三元】，对敌方全体造成${rateDesc}攻击伤害`);
    },
};
