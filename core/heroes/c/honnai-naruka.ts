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
const QIYUAN_ATTACK_BUFF_NAME = '祈愿攻击';
const FINAL_PRAYER_USED_KEY = 'final_prayer_used';
const QIYUAN_DEFENSE_STACKS_KEY = 'qiyuan_defense_stacks';
const QIYUAN_ATTACK_STACKS_KEY = 'qiyuan_attack_stacks';

/**
 * 构建【祈愿防御】buff
 * 每层增加2防御力，持续到战斗结束
 */
function buildQiyuanDefenseBuff(sourceId: number, targetId: number, stacks: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(QIYUAN_DEFENSE_BUFF_NAME, 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.DEF, EffectTypes.FIXED, 2 * stacks)
        .end();
}

/**
 * 构建【祈愿攻击】buff
 * 每层增加2攻击力，持续到战斗结束
 */
function buildQiyuanAttackBuff(sourceId: number, targetId: number, stacks: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(QIYUAN_ATTACK_BUFF_NAME, 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.ATK, EffectTypes.FIXED, 2 * stacks)
        .end();
}

/**
 * 本内成香技能1：骨笛表演
 * 主动技能，消耗0点鬼火
 * 对全体对手造成1%攻击力的真实伤害
 */
export const honnai_naruka_skill1: Skill = {
    no: 1,
    name: '骨笛表演',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '稳扎稳打，对全体敌方目标造成攻击力1%的真实伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const selected = battle.getEntity(selectedId);
        if (!selected) return;
        
        // 获取敌方全体目标
        const enemies = battle.getTeamEntities(selected.teamId).filter(e => !e.dead);
        
        const attackInfos = enemies.map(enemy => {
            return Attack.build(enemy.entityId, sourceId)
                .rate(0.01) // 1%攻击力
                .param(AttackParams.REAL) // 真实伤害
                .shouldComputeCri()
                .group()
                .skill('骨笛表演')
                .end();
        });
        
        battle.actionAttack(attackInfos);
    },
};

/**
 * 本内成香技能2：策略变化
 * 被动技能
 * 当自身受到一次攻击时，获得1层【祈愿防御】
 * 当自身造成一次伤害时，获得1层【祈愿攻击】
 * 【祈愿防御】：每层增加2防御力，持续到战斗结束
 * 【祈愿攻击】：每层增加2攻击力，持续到战斗结束
 */
export const honnai_naruka_skill2: Skill = {
    no: 2,
    name: '策略变化',
    passive: true,
    cost: 0,
    text: '被动技能。当自身受到一次攻击时，获得1层【祈愿防御】；当自身造成一次伤害时，获得1层【祈愿攻击】。【祈愿防御】：每层增加2防御力，持续到战斗结束。【祈愿攻击】：每层增加2攻击力，持续到战斗结束。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 获取当前【祈愿防御】层数
                let currentDefenseStacks = parseInt(source.getBattleData(QIYUAN_DEFENSE_STACKS_KEY) || '0', 10);
                
                // 移除旧的buff
                const defenseBuff = battle.buffs.find(buff => 
                    buff.name === QIYUAN_DEFENSE_BUFF_NAME && buff.ownerId === data.skillOwnerId
                );
                if (defenseBuff) {
                    battle.actionRemoveBuff(defenseBuff, Reasons.SKILL);
                }
                
                // 增加层数
                currentDefenseStacks += 1;
                source.setData(QIYUAN_DEFENSE_STACKS_KEY, String(currentDefenseStacks));
                
                // 添加新的【祈愿防御】buff
                const newBuff = buildQiyuanDefenseBuff(data.skillOwnerId, data.skillOwnerId, currentDefenseStacks);
                battle.actionAddBuff(newBuff, Reasons.SKILL);
                
                battle.log(`【${source.name}】受到攻击，获得1层【祈愿防御】，当前${currentDefenseStacks}层，防御力+${2 * currentDefenseStacks}`);
                
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
                
                // 获取当前【祈愿攻击】层数
                let currentAttackStacks = parseInt(source.getBattleData(QIYUAN_ATTACK_STACKS_KEY) || '0', 10);
                
                // 移除旧的buff
                const attackBuff = battle.buffs.find(buff => 
                    buff.name === QIYUAN_ATTACK_BUFF_NAME && buff.ownerId === data.skillOwnerId
                );
                if (attackBuff) {
                    battle.actionRemoveBuff(attackBuff, Reasons.SKILL);
                }
                
                // 增加层数
                currentAttackStacks += 1;
                source.setData(QIYUAN_ATTACK_STACKS_KEY, String(currentAttackStacks));
                
                // 添加新的【祈愿攻击】buff
                const newBuff = buildQiyuanAttackBuff(data.skillOwnerId, data.skillOwnerId, currentAttackStacks);
                battle.actionAddBuff(newBuff, Reasons.SKILL);
                
                battle.log(`【${source.name}】造成伤害，获得1层【祈愿攻击】，当前${currentAttackStacks}层，攻击力+${2 * currentAttackStacks}`);
                
                return -1;
            },
            code: EventCodes.HAS_DAMAGED,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '策略变化-祈愿攻击',
        },
    ],
};

/**
 * 本内成香技能3：最终祈愿
 * 限定技，消耗0点鬼火
 * 当生命值低于20%时可使用，整场战斗仅限一次
 * 对全体敌方造成150%攻击力的真实伤害
 */
export const honnai_naruka_skill3: Skill = {
    no: 3,
    name: '最终祈愿',
    passive: false,
    cost: 0,
    hide: true, // 隐藏技能，需要满足条件才显示
    limited: true, // 限定技，整场战斗只能使用一次
    target: SkillTarget.ENEMY,
    text: '【限定技】当自身生命值低于20%时可使用，整场战斗仅限一次。对全体敌方目标造成攻击力150%的真实伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const selected = battle.getEntity(selectedId);
        if (!selected) return;
        
        // 标记限定技已使用
        source.setData(`limited_skill_3_used`, 'true');
        source.setData(FINAL_PRAYER_USED_KEY, 'true');
        
        // 获取敌方全体目标
        const enemies = battle.getTeamEntities(selected.teamId).filter(e => !e.dead);
        
        const attackInfos = enemies.map(enemy => {
            return Attack.build(enemy.entityId, sourceId)
                .rate(1.5) // 150%攻击力
                .param(AttackParams.REAL) // 真实伤害
                .shouldComputeCri()
                .group()
                .skill('最终祈愿')
                .end();
        });
        
        battle.actionAttack(attackInfos);
        battle.log(`【${source.name}】使用【最终祈愿】，对全体敌方造成150%攻击力的真实伤害！`);
        battle.addEventLog('skill', `【${source.name}】使用限定技【最终祈愿】，对全体敌方造成150%攻击力的真实伤害！`, {
            sourceId: sourceId
        });
    },
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 检查是否已经使用过最终祈愿
                const hasUsed = source.getBattleData(FINAL_PRAYER_USED_KEY) === 'true';
                if (hasUsed) return -1;
                
                // 检查生命值是否低于20%
                const maxHp = battle.getComputedProperty(data.skillOwnerId, BattleProperties.MAX_HP);
                const hpPercent = source.hp / maxHp;
                
                if (hpPercent < 0.2) {
                    // 标记技能可用，取消隐藏
                    source.setData('final_prayer_available', 'true');
                } else {
                    // 生命值不足，隐藏技能
                    source.setData('final_prayer_available', 'false');
                }
                
                return -1;
            },
            code: EventCodes.TURN_START, // 回合开始时检查
            range: EventRange.SELF,
            priority: 100,
            passive: true,
            name: '最终祈愿-可用性检查',
        },
    ],
};
