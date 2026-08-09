import {
    Attack,
    AttackParams,
    BattleProperties,
    Buff,
    Battle,
    EffectTypes,
    EventCodes,
    EventRange,
    JudgeFlagManager,
    RealEventData,
    Reasons,
    Skill,
} from '../../';
import {SkillTarget} from '../../skill';
import {HeroTable} from '../index';

const KUOWU_BUFF_NAME = '哭弱';
const CRYING_SLOW_DEBUFF_NAME = '哭泣减速';
const CRYING_SLOW_STACKS_KEY = 'crying_slow_stacks';
const JUDGE_FLAG_COUNT_KEY = 'abuku_judge_flag_count';
// 哭弱反噬：触发时施法者自身攻击/防御各-20%，可叠加，最高80%（即最多4层）
const SELF_WEAKEN_BUFF_NAME = '哭弱反噬';
const SELF_WEAKEN_STACKS_KEY = 'kuowu_self_weaken_stacks';
const SELF_WEAKEN_MAX_STACKS = 4; // 20% * 4 = 80%

// 等级排序映射
const RANK_ORDER: { [key: string]: number } = {
    'N': 0, 'D': 1, 'C': 2, 'UC': 3, 'B': 4, 'A': 5,
    'EX': 6, 'S': 7, 'S+': 8, 'SS': 9, 'SSR': 10,
};

// 构建哭弱buff：攻击+20%，防御+20%，效果抵抗归0（SET 0），持续到战斗结束
function buildKuowuBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(KUOWU_BUFF_NAME, 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.2)
        .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.2)
        .buffAP(BattleProperties.EFT_RES, EffectTypes.SET, 0)
        .end();
}

// 构建哭弱反噬debuff：施法者自身攻击/防御各-20%，可叠加，持续到战斗结束
function buildSelfWeakenBuff(sourceId: number, targetId: number, stacks: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(SELF_WEAKEN_BUFF_NAME, stacks)
        .countDown(-1)
        .noRemove()
        .debuff()
        .debuffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, -0.2)
        .debuffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, -0.2)
        .end();
}

// 构建哭泣减速debuff：速度降低5，可叠加
function buildCryingSlowDebuff(sourceId: number, targetId: number, stacks: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(CRYING_SLOW_DEBUFF_NAME, stacks)
        .countDown(-1)
        .noRemove()
        .debuff()
        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, -5 * stacks)
        .end();
}

// 获取哭泣减速层数
function getCryingSlowStacks(entity: any): number {
    return parseInt(entity.getBattleData(CRYING_SLOW_STACKS_KEY) || '0', 10);
}

// 设置哭泣减速层数
function setCryingSlowStacks(entity: any, stacks: number) {
    entity.setData(CRYING_SLOW_STACKS_KEY, String(stacks));
}

// 技能1：谨慎进攻
export const abuku_riko_skill1: Skill = {
    no: 1,
    name: '谨慎进攻',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对单体目标造成攻击力120%的伤害；若目标等级高于自身，则该伤害转换为真实伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const target = battle.getEntity(selectedId);
        if (!target) return;
        
        // 比较等级：对方等级高于自己时使用真实伤害
        const sourceRank = RANK_ORDER[source.rank] || 0;
        const targetRank = RANK_ORDER[target.rank] || 0;
        const isRealDamage = targetRank > sourceRank;
        
        const attackInfo = Attack.build(selectedId, sourceId)
            .rate(1.2)
            .shouldComputeCri()
            .single()
            .skill('谨慎进攻');
        
        if (isRealDamage) {
            attackInfo.param(AttackParams.REAL);
        }
        
        battle.actionAttack(attackInfo.end());
        
        if (isRealDamage) {
            battle.log(`【${source.name}】使用【谨慎进攻】，对方等级高于自己，造成真实伤害`);
        } else {
            battle.log(`【${source.name}】使用【谨慎进攻】，对【${target.name}】造成120%攻击伤害`);
        }
    },
};

// 技能2：哭弱
export const abuku_riko_skill2: Skill = {
    no: 2,
    name: '哭弱',
    passive: true,
    cost: 0,
    text: '被动技能。裁判旗每行动1回合后，若己方队伍总生命值低于对手，则按先锋至大将的顺序，为1名尚未拥有【哭弱】buff的队友（不含自身）施加【哭弱】buff。【哭弱】：攻击力和防御力提升20%，效果抵抗归0，持续至战斗结束。每次触发时，自身攻击力和防御力各降低20%（反噬，可叠加，最多降低80%）。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 检查裁判旗是否行动了
                const judgeFlag = JudgeFlagManager.getInstance().getJudgeFlag(battle);
                const status = judgeFlag.getStatus();
                const currentCount = status.judgeKingActionCount;
                
                const lastCount = parseInt(source.getBattleData(JUDGE_FLAG_COUNT_KEY) || '0', 10);
                
                // 更新记录的裁判旗行动次数
                source.setData(JUDGE_FLAG_COUNT_KEY, String(currentCount));
                
                // 如果裁判旗没有新的行动，不触发
                if (currentCount <= lastCount) return -1;
                
                // 计算双方队伍总血量
                let myTeamHp = 0;
                let enemyTeamHp = 0;
                
                const myTeam = battle.getTeamEntities(source.teamId).filter(e => !e.dead);
                const enemyTeam = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
                
                for (const ally of myTeam) {
                    myTeamHp += ally.hp;
                }
                for (const enemy of enemyTeam) {
                    enemyTeamHp += enemy.hp;
                }
                
                // 如果队伍总血量不低于对手，不触发
                if (myTeamHp >= enemyTeamHp) {
                    battle.log(`【${source.name}】的【哭弱】未触发：队伍总血量不低于对手`);
                    return -1;
                }
                
                // 按先锋-大将顺序（fields位置1-5）找到第一个没有哭弱buff的角色
                // 注意：哭弱效果不包含施法者自身（排除 source 自己）
                const fields = battle.fields[source.teamId];
                let targetEntity = null;
                
                for (let pos = 1; pos <= 5; pos++) {
                    const entityId = fields[pos];
                    if (entityId <= 0) continue;
                    const entity = battle.getEntity(entityId);
                    if (!entity || entity.dead) continue;
                    if (entity.entityId === source.entityId) continue; // 不包含自身
                    
                    // 检查是否已有哭弱buff
                    const hasKuowu = battle.filterBuffByName(entity.entityId, KUOWU_BUFF_NAME).length > 0;
                    if (!hasKuowu) {
                        targetEntity = entity;
                        break;
                    }
                }
                
                if (targetEntity) {
                    const buff = buildKuowuBuff(data.skillOwnerId, targetEntity.entityId);
                    battle.actionAddBuff(buff, Reasons.SKILL);
                    battle.log(`【${source.name}】触发【哭弱】，为【${targetEntity.name}】添加哭弱buff（攻击+20%，防御+20%，效果抵抗归0）`);
                    battle.addEventLog('skill', `【${source.name}】触发【哭弱】，为【${targetEntity.name}】添加哭弱buff`, {
                        sourceId: data.skillOwnerId,
                        targetId: targetEntity.entityId,
                        myTeamHp: Math.round(myTeamHp),
                        enemyTeamHp: Math.round(enemyTeamHp),
                    });

                    // 自身受到反噬：攻击/防御各-20%，可叠加，最高80%（4层）
                    let selfStacks = parseInt(source.getBattleData(SELF_WEAKEN_STACKS_KEY) || '0', 10);
                    if (selfStacks < SELF_WEAKEN_MAX_STACKS) {
                        // 移除旧的自身反噬debuff
                        const oldDebuffs = battle.filterBuffByName(source.entityId, SELF_WEAKEN_BUFF_NAME);
                        for (const oldDebuff of oldDebuffs) {
                            battle.actionRemoveBuff(oldDebuff, Reasons.SKILL);
                        }
                        selfStacks += 1;
                        source.setData(SELF_WEAKEN_STACKS_KEY, String(selfStacks));
                        const selfDebuff = buildSelfWeakenBuff(data.skillOwnerId, source.entityId, selfStacks);
                        battle.actionAddBuff(selfDebuff, Reasons.SKILL);
                        battle.log(`【${source.name}】触发【哭弱】反噬，自身攻击/防御-${20 * selfStacks}%（第${selfStacks}层，最高80%）`);
                    }
                }
                
                return -1;
            },
            code: EventCodes.TURN_START,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '哭弱',
        },
    ],
};

// 技能3：哭泣
export const abuku_riko_skill3: Skill = {
    no: 3,
    name: '哭泣',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '对敌方全体造成攻击力55%的伤害（自身拥有【哭弱】buff时提升至攻击力100%），并有55%基础概率（受效果命中加成）对敌方全体施加【哭泣减速】debuff。【哭泣减速】：速度降低5点，最多叠加5层，持续至战斗结束。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const selected = battle.getEntity(selectedId);
        if (!selected) return;
        
        // 检查自身是否有哭弱buff
        const hasKuowu = battle.filterBuffByName(sourceId, KUOWU_BUFF_NAME).length > 0;
        const damageRate = hasKuowu ? 1.0 : 0.55;
        
        const enemies = battle.getTeamEntities(selected.teamId).filter(e => !e.dead);
        
        // 对敌方全体造成伤害
        const attackInfos = enemies.map(enemy => {
            return Attack.build(enemy.entityId, sourceId)
                .rate(damageRate)
                .shouldComputeCri()
                .group()
                .skill('哭泣')
                .end();
        });
        battle.actionAttack(attackInfos);
        
        // 计算减速概率：55% + 效果命中
        const baseProbability = 0.55;
        const effectHit = battle.getComputedProperty(sourceId, BattleProperties.EFT_HIT);
        const finalProbability = baseProbability * (1 + effectHit);
        
        // 对敌方全体施加哭泣减速debuff
        for (const enemy of enemies) {
            if (Math.random() < finalProbability) {
                let currentStacks = getCryingSlowStacks(enemy);
                
                if (currentStacks < 5) {
                    // 移除旧的哭泣减速debuff
                    const oldDebuffs = battle.filterBuffByName(enemy.entityId, CRYING_SLOW_DEBUFF_NAME);
                    for (const oldDebuff of oldDebuffs) {
                        battle.actionRemoveBuff(oldDebuff, Reasons.SKILL);
                    }
                    
                    currentStacks += 1;
                    setCryingSlowStacks(enemy, currentStacks);
                    
                    // 添加新的叠加debuff
                    const newDebuff = buildCryingSlowDebuff(sourceId, enemy.entityId, currentStacks);
                    battle.actionAddBuff(newDebuff, Reasons.SKILL);
                    
                    battle.log(`【${enemy.name}】获得【哭泣减速】（第${currentStacks}层），速度-${5 * currentStacks}`);
                } else {
                    battle.log(`【${enemy.name}】的【哭泣减速】已达到最大层数（5层）`);
                }
            }
        }
        
        const rateDesc = hasKuowu ? '100%（哭弱加成）' : '55%';
        battle.log(`【${source.name}】使用【哭泣】，对敌方全体造成${rateDesc}伤害`);
    },
};
