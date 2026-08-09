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
import {HeroTable} from '../index';

const KAMBARA_TOMOMI_NO = 1110;
const HANADA_AKIRA_NO = 1308; // 花田煌的编号
const FIRST_ACTION_KEY = 'kambara_first_action_done';
const NAGANO_CAR_GOD_BUFF = '长野车神';

// 检查角色标签是否包含"声音"
function hasVoiceLabel(entity: any): boolean {
    const heroData = HeroTable.get(entity.no);
    if (!heroData || !heroData.label) return false;
    return heroData.label.includes('声音');
}

// 检查角色地区是否是"长野"
function isNaganoRegion(entity: any): boolean {
    const heroData = HeroTable.get(entity.no);
    if (!heroData || !heroData.region) return false;
    return heroData.region === '长野';
}

// 检查队伍中是否有花田煌
function hasHanadaAkira(battle: Battle, teamId: number): boolean {
    const teamEntities = battle.getTeamEntities(teamId);
    return teamEntities.some(entity => entity.no === HANADA_AKIRA_NO && !entity.dead);
}

// 获取队伍中长野地区成员数量
function getNaganoMemberCount(battle: Battle, teamId: number): number {
    const teamEntities = battle.getTeamEntities(teamId);
    return teamEntities.filter(entity => !entity.dead && isNaganoRegion(entity)).length;
}

// 构建全属性下降debuff
function buildAllStatsDownDebuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('全属性下降', 1)
        .countDown(1)
        .debuff()
        .debuffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, -0.1)
        .debuffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, -0.1)
        .debuffAP(BattleProperties.SPD, EffectTypes.ADD_RATE, -0.1)
        .debuffAP(BattleProperties.EFT_HIT, EffectTypes.ADD_RATE, -0.1)
        .debuffAP(BattleProperties.EFT_RES, EffectTypes.ADD_RATE, -0.1)
        .debuffAP(BattleProperties.CRI, EffectTypes.ADD_RATE, -0.1)
        .debuffAP(BattleProperties.CRI_DMG, EffectTypes.ADD_RATE, -0.1)
        .end();
}

// 构建沉默debuff
function buildSilenceDebuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('沉默', 1)
        .countDown(1)
        .control(Control.SILENT)
        .debuff()
        .end();
}

// 构建长野车神buff
function buildNaganoCarGodBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(NAGANO_CAR_GOD_BUFF, 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, 20)
        .end();
}

/**
 * 蒲原智美技能1：开车
 * 主动技能，消耗0点能量
 * 对单体对手造成百分之100攻击的伤害
 */
export const kambara_tomomi_skill1: Skill = {
    no: 1,
    name: '开车',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对单体目标造成攻击力100%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.0)
                .shouldComputeCri()
                .single()
                .skill('开车')
                .end()
        );
    },
};

/**
 * 蒲原智美技能2：哇哈哈
 * 被动技能
 * 所有标签内有声音的角色，效果命中增加30%
 * 与花田煌同时出场时，效果命中增加50%
 */
export const kambara_tomomi_skill2: Skill = {
    no: 2,
    name: '哇哈哈',
    passive: true,
    cost: 0,
    target: SkillTarget.TEAM,
    text: '被动技能。所有标签含【声音】的角色，效果命中提升30%（与花田煌同时出场时提升至50%）。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return -1;
                
                // 检查是否有花田煌
                const withHanadaAkira = hasHanadaAkira(battle, entity.teamId);
                const eftHitBonus = withHanadaAkira ? 0.5 : 0.3;
                
                // 为所有标签包含"声音"的角色添加效果命中buff
                const teamEntities = battle.getTeamEntities(entity.teamId);
                teamEntities.forEach(teamEntity => {
                    if (hasVoiceLabel(teamEntity)) {
                        const buff = Buff.build(data.skillOwnerId, teamEntity.entityId)
                            .name('哇哈哈', 1)
                            .countDown(-1)
                            .noRemove()
                            .buff()
                            .buffAP(BattleProperties.EFT_HIT, EffectTypes.ADD_RATE, eftHitBonus)
                            .end();
                        battle.actionAddBuff(buff, Reasons.SKILL);
                        battle.log(`【${teamEntity.name}】获得【哇哈哈】buff，效果命中+${eftHitBonus * 100}%${withHanadaAkira ? '（与花田煌同时出场）' : ''}`);
                    }
                });
                
                return -1;
            },
            code: EventCodes.SENKI,
            range: EventRange.TEAM,
            priority: 0,
            passive: true,
            name: '【先机】哇哈哈',
        },
    ],
};

/**
 * 蒲原智美技能3：创世车神
 * 主动技能，消耗3点能量
 * 对敌方全体造成攻击111%的伤害
 * 自身第一次行动时造成双倍伤害，并施加沉默效果
 * 主目标有90%+效果命中的概率全属性下降10%并沉默1回合
 * 其他单位有25%+效果命中的概率沉默1回合
 */
export const kambara_tomomi_skill3: Skill = {
    no: 3,
    name: '创世车神',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '对敌方全体造成攻击力111%的伤害；自身首次行动时伤害提升至攻击力222%，并对主目标以90%+效果命中的概率施加全属性下降10%与沉默1回合，对其余敌人以25%+效果命中的概率施加沉默1回合。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 检查是否是第一次行动
        const isFirstAction = source.getBattleData(FIRST_ACTION_KEY) !== 'true';
        if (isFirstAction) {
            source.setData(FIRST_ACTION_KEY, 'true');
        }
        
        // 伤害倍率：第一次行动时双倍
        const damageRate = isFirstAction ? 2.22 : 1.11;
        
        // 获取所有敌方目标
        const enemies = battle.getEnemies(sourceId);
        
        // 对全体敌方造成伤害
        const attacks = enemies.map(enemy => {
            return Attack.build(enemy.entityId, sourceId)
                .rate(damageRate)
                .shouldComputeCri()
                .group()
                .skill('创世车神')
                .end();
        });
        
        battle.actionAttack(attacks);
        
        // 只有第一次行动时才施加沉默效果
        if (isFirstAction) {
            // 获取效果命中
            const eftHit = battle.getComputedProperty(sourceId, BattleProperties.EFT_HIT) || 0;
            
            // 主目标概率：90% + 效果命中
            const mainTargetProbability = 0.9 + eftHit;
            // 其他目标概率：25% + 效果命中
            const otherTargetProbability = 0.25 + eftHit;
            
            // 施加debuff
            enemies.forEach(enemy => {
                const isMainTarget = enemy.entityId === selectedId;
                const probability = isMainTarget ? mainTargetProbability : otherTargetProbability;
                
                if (battle.testHit(probability)) {
                    if (isMainTarget) {
                        // 主目标：全属性下降 + 沉默
                        battle.actionAddBuff(buildAllStatsDownDebuff(sourceId, enemy.entityId), Reasons.SKILL);
                        battle.actionAddBuff(buildSilenceDebuff(sourceId, enemy.entityId), Reasons.SKILL);
                        battle.log(`【${enemy.name}】被施加全属性下降和沉默，持续1回合`);
                    } else {
                        // 其他目标：沉默
                        battle.actionAddBuff(buildSilenceDebuff(sourceId, enemy.entityId), Reasons.SKILL);
                        battle.log(`【${enemy.name}】被沉默，持续1回合`);
                    }
                }
            });
        }
        
        battle.log(`【${source.name}】使用【创世车神】，对全体敌方造成${(damageRate * 100).toFixed(0)}%攻击伤害${isFirstAction ? '（第一次行动，双倍伤害并施加沉默）' : ''}`);
    },
};

/**
 * 蒲原智美技能4：长野车神
 * 部长技
 * 当队伍中有3位及以上长野地区的成员时先机发动
 * 所有长野的选手获得【长野车神】buff，速度提升20
 */
export const kambara_tomomi_skill4: Skill = {
    no: 4,
    name: '长野车神',
    passive: true,
    cost: 0,
    target: SkillTarget.TEAM,
    text: '【部长技】当队伍（包括队伍设置中8个位置）中有3位及以上长野地区的成员时先机发动，所有长野地区的选手获得【长野车神】buff，速度提升20点。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return -1;
                
                // 获取长野地区成员数量
                const naganoCount = getNaganoMemberCount(battle, entity.teamId);
                
                if (naganoCount >= 3) {
                    // 为所有长野地区成员添加buff
                    const teamEntities = battle.getTeamEntities(entity.teamId);
                    teamEntities.forEach(teamEntity => {
                        if (isNaganoRegion(teamEntity)) {
                            const buff = buildNaganoCarGodBuff(data.skillOwnerId, teamEntity.entityId);
                            battle.actionAddBuff(buff, Reasons.SKILL);
                            battle.log(`【${teamEntity.name}】获得【长野车神】buff，速度+20`);
                        }
                    });
                    
                    battle.log(`【${entity.name}】发动部长技【长野车神】，检测到${naganoCount}位长野地区成员，全队长野成员获得速度+20`);
                }
                
                return -1;
            },
            code: EventCodes.SENKI,
            range: EventRange.TEAM,
            priority: 0,
            passive: true,
            name: '【先机】长野车神',
        },
    ],
};
