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
    Control,
} from '../../';
import {SkillTarget} from '../../skill';
import {HeroTable} from '../index';

// 存储立直威慑的层数
const tachikoshiIntimidationStacks = new Map<number, number>();

/**
 * 构建立直威慑debuff
 */
function buildTachikoshiIntimidationDebuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('立直威慑', 1)
        .countDown(-1) // 持续至战斗结束
        .debuff()
        .end();
}

/**
 * 构建预知梦buff
 * 造成伤害时，回复自身造成伤害量20%的生命值，持续2回合
 */
function buildPropheticDreamBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('预知梦', 1)
        .countDown(2) // 持续2回合
        .buff()
        .end();
}

/**
 * 构建【害怕】debuff
 * 【害怕】：1/2的几率当回合无法进攻、伤害
 */
function buildFearDebuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('害怕', 1)
        .countDown(1) // 持续1回合
        .control(Control.DIZZY) // 使用眩晕控制类型，使目标可能无法行动
        .debuff()
        .end();
}

/**
 * 小学生怜技能1：立直威慑
 * 主动技能，消耗0点鬼火
 * 对单个目标造成攻击力150%的伤害，并为目标施加【立直威慑】debuff，持续至战斗结束
 * 【立直威慑】：目标受到所有名称中包含"立直"二字的技能攻击后，防御降低20点，该效果可叠加，最多叠加10层，持续至战斗结束
 */
export const shogakusei_rei_skill1: Skill = {
    no: 1,
    name: '立直威慑',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '投掷立直棒对单个目标造成攻击力150%的伤害，并为目标施加【立直威慑】debuff，持续至战斗结束。【立直威慑】：目标受到名称中包含"立直"二字的技能攻击后，防御力降低20点，该效果可叠加，最多叠加10层，持续至战斗结束。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const target = battle.getEntity(selectedId);
        if (!target) return;
        
        // 造成伤害
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.5)
                .shouldComputeCri()
                .single()
                .skill('立直威慑')
                .end()
        );
        
        // 施加立直威慑debuff
        const debuff = buildTachikoshiIntimidationDebuff(sourceId, selectedId);
        battle.actionAddBuff(debuff, Reasons.SKILL);
        battle.log(`【${source.name}】对【${target.name}】使用【立直威慑】，施加了【立直威慑】debuff`);
    },
};

/**
 * 小学生怜技能2：预知梦
 * 被动技能
 * 当角色受到致命伤害时自动触发
 * 效果：免除本次致命伤害，立即回复自身最大生命值的20%，获得【预知梦】buff，每局战斗最多触发1次
 * 【预知梦】：角色造成伤害时，回复自身造成伤害量20%的生命值，持续2回合
 */
export const shogakusei_rei_skill2: Skill = {
    no: 2,
    name: '预知梦',
    passive: true,
    cost: 0,
    text: '被动技能。当角色受到致命伤害时自动触发，免除本次致命伤害，立即回复自身20%最大生命值，获得【预知梦】buff，每局战斗最多触发1次。【预知梦】：造成伤害时，回复自身造成伤害量20%的生命值，持续2回合。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 检查是否已经触发过预知梦
                const hasPropheticDream = battle.buffs.some(buff => 
                    buff.name === '预知梦' && buff.ownerId === data.skillOwnerId
                );
                
                if (hasPropheticDream) return -1;
                
                // 检查是否受到致命伤害
                const damageData = data.data as any;
                if (damageData && damageData.damage && damageData.damage >= source.hp) {
                    // 免除致命伤害
                    damageData.damage = source.hp - 1;
                    
                    // 回复最大生命值的20%
                    const maxHp = battle.getComputedProperty(data.skillOwnerId, BattleProperties.MAX_HP);
                    const healAmount = maxHp * 0.2;
                    const newHp = Math.min(source.hp + healAmount, maxHp);
                    source.hp = newHp;
                    
                    // 获得预知梦buff
                    const buff = buildPropheticDreamBuff(data.skillOwnerId, data.skillOwnerId);
                    battle.actionAddBuff(buff, Reasons.SKILL);
                    
                    battle.log(`【${source.name}】触发【预知梦】，免除致命伤害并回复${Math.round(healAmount)}点生命`);
                }
                
                return -1;
            },
            code: EventCodes.WILL_BE_DAMAGE, // 受到伤害前
            range: EventRange.SELF,
            priority: 100, // 高优先级，确保先于伤害处理
            passive: true,
            name: '预知梦',
        },
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                // 检查是否有预知梦buff
                const hasPropheticDream = battle.buffs.some(buff => 
                    buff.name === '预知梦' && buff.ownerId === data.skillOwnerId
                );
                
                if (hasPropheticDream) {
                    // 回复造成伤害量的20%
                    const damageData = data.data as any;
                    if (damageData && damageData.damage) {
                        const damage = damageData.damage;
                        const healAmount = damage * 0.2;
                        
                        const source = battle.getEntity(data.skillOwnerId);
                        if (source) {
                            const maxHp = battle.getComputedProperty(data.skillOwnerId, BattleProperties.MAX_HP);
                            const newHp = Math.min(source.hp + healAmount, maxHp);
                            source.hp = newHp;
                            
                            battle.log(`【${source.name}】的【预知梦】回复${Math.round(healAmount)}点生命`);
                        }
                    }
                }
                
                return -1;
            },
            code: EventCodes.HAS_DAMAGED, // 造成伤害后
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '预知梦效果',
        },
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.eventId) return -1;
                
                // 从事件数据中获取攻击信息
                const attackData = data.data as any;
                if (!attackData || !attackData.attacks || !attackData.attacks.length) return -1;
                
                // 获取当前攻击
                const currentIndex = attackData.index || 0;
                const currentAttack = attackData.attacks[currentIndex];
                if (!currentAttack) return -1;
                
                // 检查攻击是否来自名称中包含"立直"二字的技能
                const skillName = currentAttack.skillName || battle.currentSkillName || '普通攻击';
                if (!skillName.includes('立直')) return -1;
                
                // 检查目标是否有立直威慑debuff (data.eventId是被攻击的敌方目标)
                const hasIntimidation = battle.buffs.some(buff => 
                    buff.name === '立直威慑' && buff.ownerId === data.eventId
                );
                
                if (hasIntimidation) {
                    // 计算当前层数
                    let currentStacks = tachikoshiIntimidationStacks.get(data.eventId) || 0;
                    
                    // 最多叠加10层
                    if (currentStacks < 10) {
                        currentStacks += 1;
                        
                        // 更新层数
                        tachikoshiIntimidationStacks.set(data.eventId, currentStacks);
                        
                        // 每次被攻击增加一个防御降低20点的debuff (施加给被攻击的目标)
                        const defDebuff = Buff.build(0, data.eventId)
                            .name('立直威慑防御降低', currentStacks)
                            .countDown(-1)
                            .buffAP(BattleProperties.DEF, EffectTypes.FIXED, -20)
                            .debuff()
                            .end();
                        
                        battle.actionAddBuff(defDebuff, Reasons.SKILL);
                        
                        const entity = battle.getEntity(data.eventId);
                        if (entity) {
                            const totalDefReduction = currentStacks * 20;
                            battle.log(`【${entity.name}】的【立直威慑】叠加至${currentStacks}层，累计防御降低${totalDefReduction}点`);
                        }
                    }
                }
                
                return -1;
            },
            code: EventCodes.HAS_BEEN_ATTACKED, // 被攻击后
            range: EventRange.ENEMY,
            priority: 50,
            passive: true,
            name: '立直威慑效果',
        },
    ],
};

/**
 * 小学生怜技能3：立直一发自摸
 * 主动技能，消耗3点鬼火
 * 对全体敌方目标造成攻击力130%的伤害；若目标身上存在【立直威慑】debuff，则给目标追加【害怕】debuff，持续一回合
 * 【害怕】：1/2的几率当回合无法进攻、伤害
 */
export const shogakusei_rei_skill3: Skill = {
    no: 3,
    name: '立直一发自摸',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '对全体敌方目标造成攻击力130%的伤害；若目标身上存在【立直威慑】debuff，则给目标追加【害怕】debuff，持续1回合。【害怕】：50%的几率当回合无法进攻、伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 对所有敌方目标造成伤害
        const enemies = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
        
        const attackInfos = enemies.map(enemy => {
            return Attack.build(enemy.entityId, sourceId)
                .rate(1.3)
                .shouldComputeCri()
                .group()
                .skill('立直一发自摸')
                .end();
        });
        
        battle.actionAttack(attackInfos);
        
        // 检查并施加【害怕】debuff
        enemies.forEach(enemy => {
            const hasIntimidation = battle.buffs.some(buff => 
                buff.name === '立直威慑' && buff.ownerId === enemy.entityId
            );
            
            if (hasIntimidation) {
                const fearDebuff = buildFearDebuff(sourceId, enemy.entityId);
                battle.actionAddBuff(fearDebuff, Reasons.SKILL);
                battle.log(`【${source.name}】对【${enemy.name}】施加了【害怕】debuff`);
            }
        });
    },
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.eventId) return -1;
                
                const entity = battle.getEntity(data.eventId);
                if (!entity) return -1;
                
                // 检查是否有【害怕】debuff
                const hasFear = battle.buffs.some(buff => 
                    buff.name === '害怕' && buff.ownerId === data.eventId
                );
                
                if (hasFear) {
                    // 50%几率无法行动
                    if (Math.random() < 0.5) {
                        // 标记本回合无法行动
                        entity.setData('fear_cannot_action', 'true');
                        battle.log(`【${entity.name}】因【害怕】无法行动！`);
                    } else {
                        entity.setData('fear_cannot_action', 'false');
                        battle.log(`【${entity.name}】克服了【害怕】，可以正常行动`);
                    }
                }
                
                return -1;
            },
            code: EventCodes.TURN_START,
            range: EventRange.ENEMY,
            priority: 100,
            passive: true,
            name: '害怕判定',
        },
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return -1;
                
                // 检查是否有【害怕】导致的无法行动
                const cannotAction = entity.getBattleData('fear_cannot_action') === 'true';
                
                if (cannotAction) {
                    // 设置无法行动标记
                    if (data.data && typeof data.data === 'object') {
                        (data.data as any).cannotAction = true;
                    }
                }
                
                return -1;
            },
            code: EventCodes.ACTION_START,
            range: EventRange.SELF,
            priority: 100,
            passive: true,
            name: '害怕无法行动',
        },
    ],
};
