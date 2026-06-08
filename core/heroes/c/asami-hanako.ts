import {
    Attack,
    BattleProperties,
    Buff,
    BuffParams,
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

const ACCELERATION_BUFF_NAME = '加速';
const RELAY_SWAPPED_MARK = 'relay_swapped'; // 标记已经完成接力棒交换
const ACCELERATION_STACKS_KEY = 'acceleration_stacks'; // 存储加速buff层数

// 构建加速buff
// 【加速】：速度增加5点，可叠加10层，持续到战斗结束
function buildAccelerationBuff(sourceId: number, targetId: number, stacks: number = 1): Buff {
    return Buff.build(sourceId, targetId)
        .name(ACCELERATION_BUFF_NAME, stacks)
        .countDown(-1) // 持续到战斗结束
        .buff()
        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, 5 * stacks)
        .end();
}

// 获取角色的加速buff层数（从battleData中获取）
function getAccelerationStacks(entity: Entity): number {
    const stacks = entity.getBattleData(ACCELERATION_STACKS_KEY);
    return stacks ? parseInt(stacks) : 0;
}

// 设置角色的加速buff层数
function setAccelerationStacks(entity: Entity, stacks: number): void {
    entity.setData(ACCELERATION_STACKS_KEY, String(stacks));
}

// 获取替补位置的角色
function getSubstituteEntity(battle: Battle, teamId: number): Entity | undefined {
    // 替补位置是索引6
    const substitutePosition = 6;
    if (battle.fields[teamId].length <= substitutePosition) {
        return undefined;
    }
    const entityId = battle.fields[teamId][substitutePosition];
    if (entityId <= 0) {
        return undefined;
    }
    return battle.getEntity(entityId);
}

// 获取角色在fields中的位置
function getEntityPosition(battle: Battle, entityId: number): number {
    const entity = battle.getEntity(entityId);
    if (!entity) return -1;
    return battle.fields[entity.teamId].indexOf(entityId);
}

// 交换角色位置（浅见花子回归替补，替补上场）
function swapWithSubstitute(battle: Battle, hanakoId: number): boolean {
    const hanako = battle.getEntity(hanakoId);
    if (!hanako) return false;
    
    const teamId = hanako.teamId;
    const substitute = getSubstituteEntity(battle, teamId);
    if (!substitute) {
        battle.log(`【${hanako.name}】尝试接力棒交换，但没有替补角色`);
        return false;
    }
    
    // 获取浅见花子的当前位置（应该是主力位置0-5）
    const hanakoPosition = getEntityPosition(battle, hanakoId);
    if (hanakoPosition < 0 || hanakoPosition > 5) {
        battle.log(`【${hanako.name}】不在主力位置，无法进行接力棒交换`);
        return false;
    }
    
    // 替补位置是6
    const substitutePosition = 6;
    
    // 记录浅见花子的血量和行动条位置
    const hanakoHp = hanako.hp;
    const hanakoRunwayPosition = battle.runway.get(hanakoId) || 0;
    
    // 交换位置
    battle.fields[teamId][hanakoPosition] = substitute.entityId;
    battle.fields[teamId][substitutePosition] = hanakoId;
    
    // 替补角色获得浅见花子的血量
    substitute.hp = Math.min(hanakoHp, battle.getComputedProperty(substitute.entityId, BattleProperties.MAX_HP));
    
    // 替补角色加入行动条（从替补变成主力）
    substitute.setData('isReserve', 'false');
    battle.runway.addEntity(substitute.entityId, () => (battle.getComputedProperty(substitute.entityId, BattleProperties.SPD) || 0));
    
    // 替补角色继承浅见花子的行动条位置
    battle.runway.set(substitute.entityId, hanakoRunwayPosition);
    
    // 浅见花子从行动条移除（变成替补）
    hanako.setData('isReserve', 'true');
    battle.runway.removeEntity(hanakoId);
    
    // 替补角色获得10层加速buff
    setAccelerationStacks(substitute, 10);
    const accelerationBuff = buildAccelerationBuff(hanakoId, substitute.entityId, 10);
    battle.actionAddBuff(accelerationBuff, Reasons.SKILL);
    
    // 标记浅见花子已完成接力棒交换
    hanako.setData(RELAY_SWAPPED_MARK, 'true');
    
    battle.log(`【${hanako.name}】使用【接力棒】，回归替补位置，【${substitute.name}】上场并获得10层【加速】，继承行动条位置${hanakoRunwayPosition}`);
    battle.addEventLog('skill', `【${hanako.name}】使用【接力棒】，回归替补位置，【${substitute.name}】上场`, {
        hanakoId: hanakoId,
        substituteId: substitute.entityId,
        hanakoHp: hanakoHp,
        hanakoRunwayPosition: hanakoRunwayPosition
    });
    
    return true;
}

/**
 * 浅见花子技能1：加速
 * 主动技能，消耗0点鬼火
 * 对单体对手造成百分之100攻击的伤害，并且自身获得【加速】buff
 * 【加速】：速度增加5，可叠加10层，持续到游戏结束
 */
export const asami_hanako_skill1: Skill = {
    no: 1,
    name: '加速',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对单体对手造成攻击力100%的伤害，并且自身获得【加速】buff。【加速】：速度增加5点，可叠加10层，持续到战斗结束。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 造成伤害
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.0)
                .shouldComputeCri()
                .single()
                .skill('加速')
                .end()
        );
        
        // 获取当前加速buff层数
        const currentStacks = getAccelerationStacks(source);
        
        // 如果未达到10层，添加一层加速buff
        if (currentStacks < 10) {
            // 移除旧的加速buff
            const oldBuff = battle.buffs.find(b =>
                b.name === ACCELERATION_BUFF_NAME && b.ownerId === sourceId
            );
            if (oldBuff) {
                battle.actionRemoveBuff(oldBuff, Reasons.SKILL);
            }
            
            // 添加新的加速buff（层数+1）
            const newStacks = currentStacks + 1;
            setAccelerationStacks(source, newStacks);
            const accelerationBuff = buildAccelerationBuff(sourceId, sourceId, newStacks);
            battle.actionAddBuff(accelerationBuff, Reasons.SKILL);
            
            battle.log(`【${source.name}】获得【加速】buff，当前${newStacks}层，速度+${newStacks * 5}`);
        }
    },
};

/**
 * 浅见花子技能2：接力棒
 * 被动技能
 * 当自身加速buff叠满10层后，自身回归替补位置，替补位置选手使用花子当时的血量以及行动条位置，并获得10层【加速】
 */
export const asami_hanako_skill2: Skill = {
    no: 2,
    name: '接力棒',
    passive: true,
    cost: 0,
    reserveValid: true, // 在替补/应援位置也可以生效（虽然实际上替补位置不会触发）
    text: '被动技能。当自身【加速】buff叠满10层后，自身回归替补位置，替补位置选手上场，使用花子当时的血量以及行动条位置，并获得10层【加速】。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 检查是否已经完成接力棒交换
                if (source.getBattleData(RELAY_SWAPPED_MARK) === 'true') return -1;
                
                // 检查是否在主力位置（只有主力位置才能触发接力棒）
                const position = getEntityPosition(battle, source.entityId);
                if (position < 0 || position > 5) return -1;
                
                // 检查加速buff是否叠满10层
                const stacks = getAccelerationStacks(source);
                if (stacks >= 10) {
                    // 执行接力棒交换
                    swapWithSubstitute(battle, source.entityId);
                }
                
                return -1;
            },
            code: EventCodes.HAS_BEEN_ATTACKED, // 使用技能攻击后检查
            range: EventRange.SELF,
            priority: 100,
            passive: true,
            name: '接力棒检查',
        },
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 检查是否已经完成接力棒交换
                if (source.getBattleData(RELAY_SWAPPED_MARK) === 'true') return -1;
                
                // 检查是否在主力位置
                const position = getEntityPosition(battle, source.entityId);
                if (position < 0 || position > 5) return -1;
                
                // 检查加速buff是否叠满10层
                const stacks = getAccelerationStacks(source);
                if (stacks >= 10) {
                    // 执行接力棒交换
                    swapWithSubstitute(battle, source.entityId);
                }
                
                return -1;
            },
            code: EventCodes.TURN_END, // 回合结束时也检查
            range: EventRange.SELF,
            priority: 100,
            passive: true,
            name: '接力棒回合检查',
        },
    ],
};

/**
 * 浅见花子技能3：环路骑行
 * 主动技能，消耗3点鬼火
 * 视为对所有速度不如自己的敌方角色分别依次进行一次【加速】技能攻击
 * 获得2层【加速】buff（如果自身速度最快额外再获得1层）
 * 并且按照双方速度差值追加一次速度差*20的伤害
 */
export const asami_hanako_skill3: Skill = {
    no: 3,
    name: '环路骑行',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '对所有速度不如自己的敌方角色分别进行一次【加速】技能攻击（100%攻击伤害），获得2层【加速】buff（如果自身速度最快额外再获得1层），并追加一次速度差*20的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        // 获取自身速度
        const sourceSpd = battle.getComputedProperty(sourceId, BattleProperties.SPD) || 0;

        // 获取自身攻击力（用于计算额外伤害）
        const sourceAtk = battle.getComputedProperty(sourceId, BattleProperties.ATK) || 0;

        // 获取所有敌方角色（包括队友和敌方）
        const allEntities = Array.from(battle.entities.values());
        const allFighters = allEntities.filter(e => !e.dead && e.name !== '裁判旗');

        // 检查自身是否是全场速度最快的
        let isFastest = true;
        for (const entity of allFighters) {
            if (entity.entityId === sourceId) continue;
            const entitySpd = battle.getComputedProperty(entity.entityId, BattleProperties.SPD) || 0;
            if (entitySpd >= sourceSpd) {
                isFastest = false;
                break;
            }
        }

        // 获取所有速度比自己低的敌方角色
        const enemies = battle.getEnemies(sourceId).filter(enemy => {
            const enemySpd = battle.getComputedProperty(enemy.entityId, BattleProperties.SPD) || 0;
            return enemySpd < sourceSpd;
        });

        if (enemies.length === 0) {
            battle.log(`【${source.name}】使用【环路骑行】，但没有速度比自己低的敌方角色`);
        }

        // 对每个敌人进行攻击
        enemies.forEach(enemy => {
            const enemySpd = battle.getComputedProperty(enemy.entityId, BattleProperties.SPD) || 0;
            const spdDiff = sourceSpd - enemySpd;

            // 第一段伤害：基础100%攻击伤害（视为【加速】技能攻击）
            battle.actionAttack(
                Attack.build(enemy.entityId, sourceId)
                    .rate(1.0)
                    .shouldComputeCri()
                    .single()
                    .skill('环路骑行')
                    .end()
            );

            // 第二段伤害：追加速度差*20的伤害（固定伤害，不计算暴击）
            const extraDamage = spdDiff * 20;
            // 将固定伤害转换为rate：extraDamage / attack
            const extraRate = sourceAtk > 0 ? extraDamage / sourceAtk : 0;

            battle.actionAttack(
                Attack.build(enemy.entityId, sourceId)
                    .rate(extraRate)
                    .single()
                    .skill('环路骑行·追加')
                    .end()
            );

            battle.log(`【${source.name}】对【${enemy.name}】使用【环路骑行】，速度差${spdDiff}，追加伤害${extraDamage}`);
        });

        // 获得加速buff
        const currentStacks = getAccelerationStacks(source);

        // 如果未达到10层，添加加速buff
        if (currentStacks < 10) {
            // 移除旧的加速buff
            const oldBuff = battle.buffs.find(b =>
                b.name === ACCELERATION_BUFF_NAME && b.ownerId === sourceId
            );
            if (oldBuff) {
                battle.actionRemoveBuff(oldBuff, Reasons.SKILL);
            }

            // 基础获得2层，如果速度最快额外获得1层
            let newStacks = currentStacks + 2;
            if (isFastest) {
                newStacks += 1;
            }

            // 不能超过10层
            newStacks = Math.min(newStacks, 10);

            setAccelerationStacks(source, newStacks);
            const accelerationBuff = buildAccelerationBuff(sourceId, sourceId, newStacks);
            battle.actionAddBuff(accelerationBuff, Reasons.SKILL);

            battle.log(`【${source.name}】使用【环路骑行】，获得${isFastest ? 3 : 2}层【加速】buff，当前${newStacks}层，速度+${newStacks * 5}${isFastest ? '（全场速度最快）' : ''}`);
        }

        battle.log(`【${source.name}】使用【环路骑行】，对${enemies.length}个敌方角色进行攻击`);
    },
};