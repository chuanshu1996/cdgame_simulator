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
    Control,
} from '../../';
import {SkillTarget, SelectableSkill, SkillSelection} from '../../skill';
import NormalAttack from '../common/normal-attack';
import {TurnProcessing} from '../../tasks';
import {Mana} from '../../';
import {normalAI} from '../ai';
import {createMakeupMirror, isMakeupMirror} from '../../summons/makeup-mirror';

const CHARMED_BUFF_NAME = '着迷';

// 检查己方是否有化妆镜
function hasMakeupMirror(battle: Battle, teamId: number): boolean {
    const summon = battle.getSummon(teamId);
    return summon !== undefined && isMakeupMirror(summon);
}

// 构建着迷debuff
// 【着迷】：持续到永久，每回合有50%概率无法进行攻击（但可以释放非攻击型技能）
// 这是一种控制效果，限制目标行动
function buildCharmedDebuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(CHARMED_BUFF_NAME, 1)
        .countDown(-1) // 持续到永久
        .noRemove() // 不可清除
        .control(Control.DIZZY) // 设置为控制效果（限制行动）
        .debuff()
        .end();
}

// 技能1：镜面射线
export const mizumura_shiori_skill1: Skill = {
    no: 1,
    name: '镜面射线',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '使用镜子折射光线，对单体对手造成攻击力50%的真实伤害。（己方阵营存在化妆镜时会额外对另一位随机对手造成相同伤害，伤害来源视为化妆镜）',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 对单体对手造成50%真实伤害
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(0.5)
                .param(AttackParams.REAL)
                .shouldComputeCri()
                .single()
                .skill('镜面射线')
                .end()
        );
        
        // 检查己方是否有化妆镜
        if (hasMakeupMirror(battle, source.teamId)) {
            const summon = battle.getSummon(source.teamId);
            if (summon) {
                // 获取敌方所有目标（排除已攻击的目标）
                const enemies = battle.getEnemies(sourceId).filter(e => e.entityId !== selectedId && !e.dead);
                if (enemies.length > 0) {
                    // 随机选择另一个敌人
                    const randomEnemy = battle.getRandomOne(enemies);
                    
                    // 额外造成相同伤害，伤害来源视为化妆镜
                    battle.actionAttack(
                        Attack.build(randomEnemy.entityId, summon.entityId)
                            .rate(0.5)
                            .param(AttackParams.REAL)
                            .shouldComputeCri()
                            .single()
                            .skill('镜面射线·反射')
                            .end()
                    );
                    
                    battle.log(`【${source.name}】的化妆镜反射光线，对【${randomEnemy.name}】造成额外伤害`);
                }
            }
        }
        
        battle.log(`【${source.name}】使用【镜面射线】，对【${battle.getEntity(selectedId)?.name}】造成50%真实伤害`);
    },
};

// 技能2：迷人妆容
export const mizumura_shiori_skill2: Skill = {
    no: 2,
    name: '迷人妆容',
    passive: true,
    cost: 0,
    text: '被动技能。当受到一次伤害时，有10%概率（+效果命中）使伤害来源获得【着迷】debuff。（己方阵营存在化妆镜时概率增加至15%）。【着迷】：持续到永久，每回合有50%概率无法进行攻击（但可以释放非攻击型技能）。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 获取伤害数据
                const attackData = data.data as any;
                if (!attackData || !attackData.attackInfos) return -1;
                
                // 遍历所有攻击信息
                for (const attackInfo of attackData.attackInfos) {
                    if (attackInfo.finalDamage > 0) {
                        const attackerId = attackInfo.sourceId;
                        const attacker = battle.getEntity(attackerId);
                        if (!attacker || attacker.teamId === source.teamId) continue; // 同队不触发
                        
                        // 计算着迷概率
                        let baseProbability = 0.1;
                        if (hasMakeupMirror(battle, source.teamId)) {
                            baseProbability = 0.15;
                        }
                        
                        // 加上效果命中
                        const effectHit = battle.getComputedProperty(data.skillOwnerId, BattleProperties.EFT_HIT);
                        const finalProbability = baseProbability * (1 + effectHit);
                        
                        // 检查是否命中
                        if (battle.testHit(finalProbability)) {
                            // 施加着迷debuff
                            battle.actionAddBuff(buildCharmedDebuff(data.skillOwnerId, attackerId), Reasons.SKILL);
                            battle.log(`【${source.name}】的【迷人妆容】触发，【${attacker.name}】获得【着迷】debuff（概率${Math.floor(finalProbability * 100)}%）`);
                            
                            battle.addEventLog('skill', `【${source.name}】触发【迷人妆容】，【${attacker.name}】获得【着迷】`, {
                                sourceId: data.skillOwnerId,
                                targetId: attackerId,
                                probability: Math.floor(finalProbability * 100)
                            });
                        }
                    }
                }
                
                return -1;
            },
            code: EventCodes.HAS_BEEN_DAMAGED,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '迷人妆容',
        },
        // 回合开始时处理着迷效果
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 检查是否有着迷debuff
                const charmedBuffs = battle.filterBuffByName(data.skillOwnerId, CHARMED_BUFF_NAME);
                if (charmedBuffs.length === 0) return -1;
                
                // 50%概率判定是否无法攻击
                const cannotAttack = battle.testHit(0.5);
                source.setData('charmed_cannot_attack', cannotAttack ? 'true' : 'false');
                
                if (cannotAttack) {
                    battle.log(`【${source.name}】因【着迷】效果，本回合无法进行攻击`);
                } else {
                    battle.log(`【${source.name}】的【着迷】效果未触发，本回合可以正常行动`);
                }
                
                return -1;
            },
            code: EventCodes.TURN_START,
            range: EventRange.SELF,
            priority: 100,
            passive: true,
            name: '着迷判定',
        },
    ],
};

// 技能3：美美补妆
export const mizumura_shiori_skill3: Skill = {
    no: 3,
    name: '美美补妆',
    passive: false,
    cost: 3,
    target: SkillTarget.SELF,
    text: '己方没有召唤物时，可以召唤出一个化妆镜，继承自身30%的生命值。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 检查己方是否已有召唤物
        const existingSummon = battle.getSummon(source.teamId);
        if (existingSummon) {
            battle.log(`【${source.name}】己方已有召唤物，无法召唤化妆镜`);
            return;
        }
        
        // 计算化妆镜的生命值（继承自身30%生命值）
        const mirrorHp = Math.floor(source.hp * 0.3);
        
        // 创建化妆镜召唤物
        const mirror = createMakeupMirror(sourceId, mirrorHp);
        
        // 设置化妆镜的队伍ID
        mirror.setTeam(source.teamId);
        
        // 召唤化妆镜
        battle.summonEntity(mirror, source.teamId);
        
        battle.log(`【${source.name}】使用【美美补妆】，召唤化妆镜（生命值${mirrorHp}）`);
        battle.addEventLog('skill', `【${source.name}】召唤化妆镜`, {
            sourceId: sourceId,
            mirrorHp: mirrorHp
        });
    },
};

/**
 * 水村史织自定义AI
 * 己方没有召唤物且鬼火足够时，优先使用技能3召唤化妆镜
 * @param battle 战斗对象
 * @param turnData 回合数据
 * @param mana 鬼火对象
 * @param selections 可选技能列表
 * @returns 技能选择对象
 */
export function mizumuraShioriAI(battle: Battle, turnData: TurnProcessing, mana: Mana | null, selections: SelectableSkill[]): SkillSelection | null {
    const currentEntity = battle.getEntity(turnData.currentId);
    if (!currentEntity) return normalAI(battle, turnData, mana, selections);
    
    const currentMana = mana ? mana.num : 0;
    
    // 检查己方是否有召唤物
    const hasSummon = battle.getSummon(currentEntity.teamId) !== undefined;
    
    // 没有召唤物且鬼火足够时，优先使用技能3召唤化妆镜
    if (!hasSummon && currentMana >= 3) {
        const skill3 = selections.find(s => s.no === 3 && s.targets.length);
        if (skill3) {
            return {
                no: skill3.no,
                targetId: currentEntity.entityId, // 技能3目标是自身
            };
        }
    }
    
    // 其他情况使用默认AI
    return normalAI(battle, turnData, mana, selections);
}