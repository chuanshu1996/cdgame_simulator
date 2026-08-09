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
import {HeroTable} from '../index';

const GUARD_BUFF_NAME = '点棒守护';
const DEVOUR_BUFF_NAME = '点棒吞噬';
const GUARD_STACKS_KEY = 'tenbo_guard_stacks';
const DEVOUR_STACKS_KEY = 'tenbo_devour_stacks';

// 检查角色是否是小学生（grade含"小"字）
function isElementaryStudent(entity: any): boolean {
    const heroData = HeroTable.get(entity.no);
    if (!heroData || !heroData.grade) return false;
    return heroData.grade.includes('小');
}

// 获取点棒守护层数
function getGuardStacks(entity: any): number {
    return parseInt(entity.getBattleData(GUARD_STACKS_KEY) || '0', 10);
}

// 设置点棒守护层数
function setGuardStacks(entity: any, stacks: number) {
    entity.setData(GUARD_STACKS_KEY, String(stacks));
}

// 获取点棒吞噬层数
function getDevourStacks(entity: any): number {
    return parseInt(entity.getBattleData(DEVOUR_STACKS_KEY) || '0', 10);
}

// 设置点棒吞噬层数
function setDevourStacks(entity: any, stacks: number) {
    entity.setData(DEVOUR_STACKS_KEY, String(stacks));
}

// 构建点棒守护buff
function buildGuardBuff(sourceId: number, targetId: number, stacks: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(GUARD_BUFF_NAME, 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.1 * stacks)
        .end();
}

// 构建点棒吞噬buff
function buildDevourBuff(sourceId: number, targetId: number, stacks: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(DEVOUR_BUFF_NAME, 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.ATK, EffectTypes.FIXED, 50 * stacks)
        .end();
}

/**
 * 盆子原美绪技能1：点棒守护
 * 主动技能，消耗0点能量
 * 对单体对手造成125%攻击伤害
 * 如果受到一次AOE伤害，则获得1层【点棒守护】buff
 * 【点棒守护】：增加自身10%防御（最多叠加5层，持续到游戏结束）
 */
export const bonkohara_mio_skill1: Skill = {
    no: 1,
    name: '点棒守护',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对单体目标造成攻击力125%的伤害。当自身受到一次群体伤害时，获得1层【点棒守护】buff。【点棒守护】：自身防御力提升10%，最多叠加5层，持续至战斗结束。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.25)
                .shouldComputeCri()
                .single()
                .skill('点棒守护')
                .end()
        );
    },
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 获取伤害数据
                const attackData = data.data as any;
                if (!attackData || !attackData.attacks) return -1;
                
                // 检查是否是AOE攻击
                let isAOE = false;
                for (const attack of attackData.attacks) {
                    if (attack.hasParam && attack.hasParam(AttackParams.GROUP)) {
                        isAOE = true;
                        break;
                    }
                }
                
                if (!isAOE) return -1;
                
                // 检查是否有实际伤害
                let hasDamage = false;
                if (attackData.attackInfos) {
                    for (const attackInfo of attackData.attackInfos) {
                        if (attackInfo.finalDamage > 0 && attackInfo.targetId === data.skillOwnerId) {
                            hasDamage = true;
                            break;
                        }
                    }
                }
                
                if (!hasDamage) return -1;
                
                // 获得1层点棒守护buff
                let currentStacks = getGuardStacks(source);
                if (currentStacks >= 5) return -1; // 最多5层
                
                // 移除旧的buff
                const oldBuff = battle.buffs.find(b =>
                    b.name === GUARD_BUFF_NAME && b.ownerId === data.skillOwnerId
                );
                if (oldBuff) {
                    battle.actionRemoveBuff(oldBuff, Reasons.SKILL);
                }
                
                currentStacks += 1;
                setGuardStacks(source, currentStacks);
                
                const newBuff = buildGuardBuff(data.skillOwnerId, data.skillOwnerId, currentStacks);
                battle.actionAddBuff(newBuff, Reasons.SKILL);
                
                battle.log(`【${source.name}】受到AOE伤害，获得1层【点棒守护】，当前${currentStacks}层，防御+${currentStacks * 10}%`);
                
                return -1;
            },
            code: EventCodes.HAS_BEEN_DAMAGED,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '点棒守护-AOE触发',
        },
    ],
};

/**
 * 盆子原美绪技能2：身高压制
 * 被动技能
 * 根据自身持有的【点棒吞噬】buff层数，每层对小学生造成伤害增加5%
 */
export const bonkohara_mio_skill2: Skill = {
    no: 2,
    name: '身高压制',
    passive: true,
    cost: 0,
    target: SkillTarget.SELF,
    text: '被动技能。自身每持有1层【点棒吞噬】buff，对小学生类型目标造成的伤害提升2%。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                const devourStacks = getDevourStacks(source);
                if (devourStacks <= 0) return -1;
                
                // 获取攻击数据
                const attackData = data.data as any;
                if (!attackData || !attackData.attackInfos) return -1;
                
                // 遍历所有攻击信息，对小学生目标增加伤害
                for (const attackInfo of attackData.attackInfos) {
                    if (attackInfo.finalDamage > 0) {
                        const targetId = attackInfo.targetId;
                        const target = battle.getEntity(targetId);
                        if (target && target.teamId !== source.teamId && isElementaryStudent(target)) {
                            // 每层增加2%伤害
                            const damageIncrease = devourStacks * 0.02;
                            attackInfo.damageDealtBuff *= (1 + damageIncrease);
                            battle.log(`【${source.name}】的【身高压制】对小学生【${target.name}】增加${damageIncrease * 100}%伤害（${devourStacks}层点棒吞噬）`);
                        }
                    }
                }
                
                return -1;
            },
            code: EventCodes.WILL_ATTACK,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '身高压制',
        },
    ],
};

/**
 * 盆子原美绪技能3：点棒吞噬
 * 主动技能，消耗3点能量
 * 对单体对手造成3次攻击力80%的伤害
 * 每次造成伤害可以消耗1层【点棒守护】buff转换成【点棒吞噬】buff
 * 【点棒吞噬】：每层增加自身100点伤害（最多叠加10层，持续到游戏结束）
 */
export const bonkohara_mio_skill3: Skill = {
    no: 3,
    name: '点棒吞噬',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '对单体目标连续攻击3次，每次造成攻击力80%的伤害；每次造成伤害可消耗1层【点棒守护】buff转化为1层【点棒吞噬】buff。【点棒吞噬】：每层使自身伤害提升50点，最多叠加10层，持续至战斗结束。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        let guardStacks = getGuardStacks(source);
        let devourStacks = getDevourStacks(source);
        let convertedCount = 0;
        
        function completedProcessor(battle: Battle, data: any): number {
            const attackInfo = data.attackInfos[data.index];
            if (!attackInfo) return -1;
            
            // 每次造成伤害时，消耗1层点棒守护转换成点棒吞噬
            if (attackInfo.finalDamage > 0 && guardStacks > 0 && devourStacks < 10) {
                guardStacks -= 1;
                devourStacks += 1;
                convertedCount += 1;
            }
            
            // 最后一次攻击完成后，更新buff
            if (data.index === data.attackInfos.length - 1) {
                // 更新点棒守护buff
                const oldGuardBuff = battle.buffs.find(b =>
                    b.name === GUARD_BUFF_NAME && b.ownerId === sourceId
                );
                if (oldGuardBuff) {
                    battle.actionRemoveBuff(oldGuardBuff, Reasons.SKILL);
                }
                
                setGuardStacks(source, guardStacks);
                if (guardStacks > 0) {
                    const newGuardBuff = buildGuardBuff(sourceId, sourceId, guardStacks);
                    battle.actionAddBuff(newGuardBuff, Reasons.SKILL);
                }
                
                // 更新点棒吞噬buff
                const oldDevourBuff = battle.buffs.find(b =>
                    b.name === DEVOUR_BUFF_NAME && b.ownerId === sourceId
                );
                if (oldDevourBuff) {
                    battle.actionRemoveBuff(oldDevourBuff, Reasons.SKILL);
                }
                
                setDevourStacks(source, devourStacks);
                if (devourStacks > 0) {
                    const newDevourBuff = buildDevourBuff(sourceId, sourceId, devourStacks);
                    battle.actionAddBuff(newDevourBuff, Reasons.SKILL);
                }
                
                if (convertedCount > 0) {
                    battle.log(`【${source.name}】使用【点棒吞噬】，消耗${convertedCount}层【点棒守护】转化为【点棒吞噬】，当前守护${guardStacks}层，吞噬${devourStacks}层`);
                }
            }
            
            return -1;
        }
        
        // 造成3次80%攻击伤害
        for (let i = 0; i < 3; i++) {
            battle.actionAttack(
                Attack.build(selectedId, sourceId)
                    .rate(0.8)
                    .shouldComputeCri()
                    .single()
                    .skill('点棒吞噬')
                    .completed(completedProcessor)
                    .end()
            );
        }
    },
};
