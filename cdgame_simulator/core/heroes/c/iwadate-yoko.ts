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
    Control,
} from '../../';
import {SkillTarget} from '../../skill';
import NormalAttack from '../common/normal-attack';

const CHONGPAI_BUFF_NAME = '铳牌收集';

// 构建铳牌收集攻击力buff
function buildChongpaiAtkBuff(sourceId: number, targetId: number, atkBonus: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(CHONGPAI_BUFF_NAME + '-攻击', 1)
        .countDown(1)
        .buff()
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, atkBonus)
        .end();
}

// 构建铳牌收集伤害加成buff
function buildChongpaiDmgBuff(sourceId: number, targetId: number, dmgBonus: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(CHONGPAI_BUFF_NAME + '-伤害', 1)
        .countDown(1)
        .buff()
        .buffAP(BattleProperties.DMG_DEALT_B, EffectTypes.FIXED, dmgBonus)
        .end();
}

// 构建铳牌收集速度buff（固定值加成）
function buildChongpaiSpdBuff(sourceId: number, targetId: number, spdBonus: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(CHONGPAI_BUFF_NAME + '-速度', 1)
        .countDown(1)
        .buff()
        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, spdBonus)
        .end();
}

// 构建嘲讽buff
function buildProvokeBuff(sourceId: number, targetId: number, probability: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('制服改造-嘲讽', 1)
        .control(Control.PROVOKE)
        .countDown(1)
        .probability(probability)
        .debuff()
        .end();
}

// 技能1：立直寄托
export const iwadate_yoko_skill1: Skill = {
    no: 1,
    name: '立直寄托',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '看我立直，对单体目标造成攻击力150%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.5)
                .shouldComputeCri()
                .single()
                .skill('立直寄托')
                .end()
        );
        
        battle.log(`【${source.name}】使用【立直寄托】，对【${battle.getEntity(selectedId)?.name}】造成150%攻击伤害`);
    },
};

// 技能2：铳牌收集
export const iwadate_yoko_skill2: Skill = {
    no: 2,
    name: '铳牌收集',
    passive: true,
    cost: 0,
    text: '被动技能。自身回合开始时，根据当前生命值百分比刷新【铳牌收集】光环效果。【铳牌收集】：自身生命值低于75%时，全队速度提升10点；低于50%时，全队额外提升10%攻击力；低于25%时，全队再额外提升10%伤害。以上效果均持续1回合。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 获取当前血量百分比
                const maxHp = battle.getComputedProperty(data.skillOwnerId, BattleProperties.MAX_HP);
                const hpPercent = source.hp / maxHp;
                
                // 获取全队成员
                const allies = battle.getTeamEntities(source.teamId).filter(e => !e.dead);
                
                // 移除旧的铳牌收集buff
                for (const ally of allies) {
                    const oldAtkBuffs = battle.filterBuffByName(ally.entityId, CHONGPAI_BUFF_NAME + '-攻击');
                    for (const oldBuff of oldAtkBuffs) {
                        battle.actionRemoveBuff(oldBuff, Reasons.SKILL);
                    }
                    const oldDmgBuffs = battle.filterBuffByName(ally.entityId, CHONGPAI_BUFF_NAME + '-伤害');
                    for (const oldBuff of oldDmgBuffs) {
                        battle.actionRemoveBuff(oldBuff, Reasons.SKILL);
                    }
                    const oldSpdBuffs = battle.filterBuffByName(ally.entityId, CHONGPAI_BUFF_NAME + '-速度');
                    for (const oldBuff of oldSpdBuffs) {
                        battle.actionRemoveBuff(oldBuff, Reasons.SKILL);
                    }
                }
                
                // 递进叠加：每个阈值独立触发对应效果
                let atkBonus = 0;
                let dmgBonus = 0;
                let spdBonus = 0;
                
                if (hpPercent < 0.75) {
                    spdBonus = 10;
                }
                if (hpPercent < 0.5) {
                    atkBonus = 0.1;
                }
                if (hpPercent < 0.25) {
                    dmgBonus = 0.1;
                }
                
                // 如果有buff效果，为全队添加buff
                if (atkBonus > 0 || dmgBonus > 0 || spdBonus > 0) {
                    for (const ally of allies) {
                        if (atkBonus > 0) {
                            battle.actionAddBuff(buildChongpaiAtkBuff(data.skillOwnerId, ally.entityId, atkBonus), Reasons.SKILL);
                        }
                        if (dmgBonus > 0) {
                            battle.actionAddBuff(buildChongpaiDmgBuff(data.skillOwnerId, ally.entityId, dmgBonus), Reasons.SKILL);
                        }
                        if (spdBonus > 0) {
                            battle.actionAddBuff(buildChongpaiSpdBuff(data.skillOwnerId, ally.entityId, spdBonus), Reasons.SKILL);
                        }
                    }
                    
                    const parts = [];
                    if (atkBonus > 0) parts.push(`攻击力+${atkBonus * 100}%`);
                    if (dmgBonus > 0) parts.push(`伤害+${dmgBonus * 100}%`);
                    if (spdBonus > 0) parts.push(`速度+${spdBonus}点`);
                    const buffDesc = parts.join('，');
                    
                    battle.log(`【${source.name}】触发【铳牌收集】（血量${Math.floor(hpPercent * 100)}%），全队${buffDesc}`);
                    battle.addEventLog('skill', `【${source.name}】触发【铳牌收集】，全队获得buff效果（${buffDesc}）`, {
                        sourceId: data.skillOwnerId,
                        hpPercent: Math.floor(hpPercent * 100),
                        atkBonus: atkBonus * 100,
                        dmgBonus: dmgBonus * 100,
                        spdBonus: spdBonus,
                        spdBonusIsFixed: true
                    });
                }
                
                return -1;
            },
            code: EventCodes.TURN_START,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '铳牌收集',
        },
    ],
};

// 技能3：制服改造
export const iwadate_yoko_skill3: Skill = {
    no: 3,
    name: '制服改造',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '牺牲自身10%最大生命值，并对敌方全体施加【嘲讽】效果。被嘲讽的敌人有30%基础概率（受效果命中加成）在下次行动时强制对岩馆摇杏使用普通攻击。',
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
            battle.log(`【${source.name}】牺牲${actualSacrifice}点生命发动【制服改造】`);
        }
        
        // 获取敌方全体
        const enemies = battle.getEnemies(sourceId);
        
        // 计算嘲讽概率（30% + 效果命中）
        const baseProbability = 0.3;
        const effectHit = battle.getComputedProperty(sourceId, BattleProperties.EFT_HIT);
        const finalProbability = baseProbability * (1 + effectHit);
        
        // 对敌方全体施加嘲讽
        for (const enemy of enemies) {
            battle.actionAddBuff(buildProvokeBuff(sourceId, enemy.entityId, finalProbability), Reasons.SKILL);
        }
        
        battle.log(`【${source.name}】使用【制服改造】，对敌方全体施加嘲讽（概率${Math.floor(finalProbability * 100)}%）`);
        battle.addEventLog('skill', `【${source.name}】使用【制服改造】，牺牲${actualSacrifice}点生命，嘲讽敌方全体`, {
            sourceId: sourceId,
            sacrificeHp: actualSacrifice,
            provokeProbability: Math.floor(finalProbability * 100)
        });
    },
};