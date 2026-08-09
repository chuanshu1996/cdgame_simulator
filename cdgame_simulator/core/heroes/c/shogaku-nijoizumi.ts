import {
    Attack,
    BattleProperties,
    Buff,
    Battle,
    Control,
    EffectTypes,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
} from '../../';
import {SkillTarget} from '../../skill';

// 构建沉默debuff
function buildSilenceDebuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('沉默', 1)
        .countDown(1)
        .control(Control.SILENT)
        .debuff()
        .end();
}

// 构建吸取攻击力debuff（对攻击最高者）
function buildStealAtkDebuff(sourceId: number, targetId: number, atkValue: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('憧憬凶星·攻击吸取', 1)
        .countDown(-1)
        .noRemove()
        .debuff()
        .debuffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, -atkValue)
        .end();
}

// 构建吸取攻击力buff（给自身）
function buildStealAtkBuff(sourceId: number, targetId: number, atkValue: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('憧憬凶星·攻击获得', 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, atkValue)
        .end();
}

/**
 * 技能1：水枪直击
 * 0火，主动技能
 * 对单体目标造成攻击力120%的伤害，如果造成伤害则额外追加一次200点真实伤害。
 */
export const shogaku_nijoizumi_skill1: Skill = {
    no: 1,
    name: '水枪直击',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对单体目标造成攻击力120%的伤害；若成功造成伤害，则额外追加一次200点真实伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.2)
                .shouldComputeCri()
                .single()
                .skill('水枪直击')
                .completed((battle: Battle, data: any) => {
                    const attackInfo = data.attackInfos[0];
                    if (attackInfo && attackInfo.finalDamage > 0) {
                        // 造成伤害后追加200点真实伤害
                        battle.actionAttack(
                            Attack.build(selectedId, sourceId)
                                .base(() => 200)
                                .rate(1)
                                .real()
                                .single()
                                .skill('水枪直击')
                                .end()
                        );
                        battle.log(`【${source.name}】造成伤害，追加200点真实伤害`);
                    }
                })
                .end()
        );
    },
};

/**
 * 技能2：憧憬凶星
 * 被动技能
 * 若自身不为全场攻击最高者，则吸取攻击最高者10%的攻击力给自身。
 */
export const shogaku_nijoizumi_skill2: Skill = {
    no: 2,
    name: '憧憬凶星',
    passive: true,
    cost: 0,
    text: '被动技能。若自身并非全场攻击力最高者，则吸取全场攻击力最高者10%的攻击力，转移给自身。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 检查是否已经吸取过
                const existingBuff = battle.filterBuffByName(data.skillOwnerId, '憧憬凶星·攻击获得');
                if (existingBuff.length > 0) return -1;
                
                // 收集全场存活选手的攻击力
                let highestAtkEntity: any = null;
                let highestAtk = 0;
                let myAtk = 0;
                
                for (let teamId = 0; teamId <= 1; teamId++) {
                    const team = battle.getTeamEntities(teamId);
                    for (const entity of team) {
                        if (entity.dead) continue;
                        if (entity.teamId < 0 || entity.teamId > 1) continue;
                        const atk = battle.getComputedProperty(entity.entityId, BattleProperties.ATK);
                        if (entity.entityId === data.skillOwnerId) {
                            myAtk = atk;
                        }
                        if (atk > highestAtk) {
                            highestAtk = atk;
                            highestAtkEntity = entity;
                        }
                    }
                }
                
                // 如果自身就是全场攻击最高者，不触发
                if (!highestAtkEntity || highestAtkEntity.entityId === data.skillOwnerId) return -1;
                
                // 吸取攻击最高者10%的攻击力
                const stealRate = 0.1;
                
                // 给攻击最高者添加debuff
                const debuff = buildStealAtkDebuff(data.skillOwnerId, highestAtkEntity.entityId, stealRate);
                battle.actionAddBuff(debuff, Reasons.SKILL);
                
                // 给自身添加buff
                const buff = buildStealAtkBuff(data.skillOwnerId, data.skillOwnerId, stealRate);
                battle.actionAddBuff(buff, Reasons.SKILL);
                
                battle.log(`【${source.name}】触发【憧憬凶星】，吸取【${highestAtkEntity.name}】10%攻击力`);
                battle.addEventLog('skill', `【${source.name}】触发【憧憬凶星】，吸取攻击最高者10%攻击力`, {
                    sourceId: data.skillOwnerId,
                    targetId: highestAtkEntity.entityId,
                    stealRate: stealRate,
                });
                
                return -1;
            },
            code: EventCodes.BATTLE_START,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '憧憬凶星',
        },
    ],
};

/**
 * 技能3：关门打雀
 * 3火，主动技能
 * 对敌方全体目标造成攻击力100%的伤害，如果造成伤害则使得敌方单位有35%+效果命中的概率沉默1回合。
 */
export const shogaku_nijoizumi_skill3: Skill = {
    no: 3,
    name: '关门打雀',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '对敌方全体造成攻击力100%的伤害；若成功造成伤害，则有35%基础概率（受效果命中加成）对目标施加【沉默】控制效果，持续1回合。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const selected = battle.getEntity(selectedId);
        if (!selected) return;
        
        const enemies = battle.getTeamEntities(selected.teamId).filter(e => !e.dead);
        
        // 对敌方全体造成伤害
        const attackInfos = enemies.map(enemy => {
            return Attack.build(enemy.entityId, sourceId)
                .rate(1.0)
                .shouldComputeCri()
                .group()
                .skill('关门打雀')
                .end();
        });
        battle.actionAttack(attackInfos);
        
        // 计算沉默概率：35% + 效果命中
        const baseProbability = 0.35;
        const effectHit = battle.getComputedProperty(sourceId, BattleProperties.EFT_HIT);
        const finalProbability = baseProbability * (1 + effectHit);
        
        // 对造成伤害的敌方单位判定沉默
        for (const enemy of enemies) {
            if (Math.random() < finalProbability) {
                const silenceDebuff = buildSilenceDebuff(sourceId, enemy.entityId);
                battle.actionAddBuff(silenceDebuff, Reasons.SKILL);
                battle.log(`【${enemy.name}】被沉默，持续1回合`);
            }
        }
        
        battle.log(`【${source.name}】使用【关门打雀】，对敌方全体造成100%攻击伤害`);
    },
};
