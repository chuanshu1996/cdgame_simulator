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
import {JudgeFlagManager} from '../../judge-flag';

const TEA_BUFF_NAME = '茶道传承';
const KENYA_BUFF_NAME = '名门剑谷';
const KENYA_SCHOOL = '剑谷高中';

// 检查角色年级是否小于高中一年级（初中生、小学生、熊孩子等）
function isBelowSeniorHighOne(entity: any): boolean {
    const heroData = HeroTable.get(entity.no);
    if (!heroData || !heroData.grade) return false;
    const grade = String(heroData.grade);
    // 排除高中（高一、高二、高三）与成年
    if (grade.startsWith('高')) return false;
    if (grade === '成年') return false;
    // 初三、初二、初一、小六、小五、小三、小孩等均符合条件
    return true;
}

// 检查角色是否属于剑谷高中
function isKenyaMember(entity: any): boolean {
    const heroData = HeroTable.get(entity.no);
    if (!heroData || !heroData.school) return false;
    return heroData.school === KENYA_SCHOOL;
}

// 获取队伍中剑谷高中成员数量（包括替补位和应援位）
function getKenyaMemberCount(battle: Battle, teamId: number): number {
    const teamEntities = battle.getTeamEntities(teamId);
    return teamEntities.filter(entity => !entity.dead && isKenyaMember(entity)).length;
}

// 构建茶道传承buff：攻击和防御增加10%，速度增加10
function buildTeaBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(TEA_BUFF_NAME, 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.1)
        .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.1)
        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, 10)
        .end();
}

// 构建名门剑谷buff：攻击和效果抵抗增加10%
function buildKenyaBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(KENYA_BUFF_NAME, 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.1)
        .buffAP(BattleProperties.EFT_RES, EffectTypes.ADD_RATE, 0.1)
        .end();
}

/**
 * 古冢梢技能1：喝茶静心
 * 主动技能，消耗0点能量
 * 对单体目标造成攻击力100%的伤害。
 */
export const furutsuka_kozue_skill1: Skill = {
    no: 1,
    name: '喝茶静心',
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
                .skill('喝茶静心')
                .end()
        );
    },
};

/**
 * 古冢梢技能2：茶道传承
 * 被动技能
 * 所有年级小于高中一年级的（包括初中生、小学生、熊孩子），攻击和防御增加10%，速度增加10。
 * 替补位和应援位也可以触发。
 */
export const furutsuka_kozue_skill2: Skill = {
    no: 2,
    name: '茶道传承',
    passive: true,
    cost: 0,
    reserveValid: true,
    text: '被动技能。所有年级低于高中一年级（含初中生、小学生、熊孩子）的队友，攻击力和防御力提升10%，速度提升10点。（替补位和应援位也可以触发）',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;

                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;

                // 为队伍中所有符合条件的队友添加茶道传承buff
                const teamEntities = battle.getTeamEntities(source.teamId);
                teamEntities.forEach(teamEntity => {
                    if (teamEntity.dead) return;
                    if (!isBelowSeniorHighOne(teamEntity)) return;

                    // 避免重复叠加
                    const existingBuff = battle.filterBuffByName(teamEntity.entityId, TEA_BUFF_NAME);
                    if (existingBuff.length > 0) return;

                    const buff = buildTeaBuff(data.skillOwnerId, teamEntity.entityId);
                    battle.actionAddBuff(buff, Reasons.SKILL);
                    battle.log(`【${teamEntity.name}】触发【茶道传承】，攻击和防御+10%，速度+10`);
                });

                return -1;
            },
            code: EventCodes.BATTLE_START,
            range: EventRange.TEAM,
            priority: 0,
            passive: true,
            name: '茶道传承',
        },
    ],
};

/**
 * 古冢梢技能3：后半发力
 * 主动技能，消耗3点能量
 * 对敌方全体目标造成攻击力110%的伤害。
 * 裁判旗进行到第五回合时，改为对敌方全体目标造成攻击力220%的伤害，并额外返还1点能量。
 */
export const furutsuka_kozue_skill3: Skill = {
    no: 3,
    name: '后半发力',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '对敌方全体造成攻击力110%的伤害；当裁判旗行动至第5回合时，改为造成攻击力220%的伤害，并额外返还1点能量。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        // 获取裁判旗行动次数
        const judgeFlag = JudgeFlagManager.getInstance().getJudgeFlag(battle);
        const judgeKingActionCount = judgeFlag.getStatus().judgeKingActionCount;
        // 裁判旗进行到第五回合时强化
        const isEnhanced = judgeKingActionCount >= 5;
        const damageRate = isEnhanced ? 2.2 : 1.1;

        // 对敌方全体造成伤害
        const enemies = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
        const attackInfos = enemies.map(enemy => {
            return Attack.build(enemy.entityId, sourceId)
                .rate(damageRate)
                .shouldComputeCri()
                .group()
                .skill('后半发力')
                .end();
        });
        battle.actionAttack(attackInfos);

        if (isEnhanced) {
            // 返还1点能量
            battle.actionUpdateEnergy(sourceId, source.teamId, 1, Reasons.SKILL);
            battle.log(`【${source.name}】使用【后半发力】，裁判旗已行动${judgeKingActionCount}回合，对敌方全体造成220%伤害并返还1点能量`);
        } else {
            battle.log(`【${source.name}】使用【后半发力】，对敌方全体造成110%攻击伤害`);
        }
    },
};

/**
 * 古冢梢技能4：名门剑谷
 * 部长技
 * 当队伍（包括队伍设置中8个位置）中有3位及以上剑谷高中的成员时先机发动，
 * 所有剑谷高中的角色获得【名门剑谷】buff，攻击和效果抵抗增加10%。
 * 替补位和应援位也可以触发。
 */
export const furutsuka_kozue_skill4: Skill = {
    no: 4,
    name: '名门剑谷',
    passive: true,
    cost: 0,
    target: SkillTarget.TEAM,
    reserveValid: true,
    text: '【部长技】当队伍（包括队伍设置中8个位置）中有3位及以上剑谷高中的成员时先机发动，所有剑谷高中的角色获得【名门剑谷】buff，攻击和效果抵抗增加10%。（替补位和应援位也可以触发）',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;

                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;

                // 检查队伍中剑谷高中成员数量（含替补位和应援位）
                const kenyaCount = getKenyaMemberCount(battle, source.teamId);

                if (kenyaCount >= 3) {
                    // 为所有剑谷高中成员添加名门剑谷buff
                    const teamEntities = battle.getTeamEntities(source.teamId);
                    teamEntities.forEach(teamEntity => {
                        if (teamEntity.dead) return;
                        if (!isKenyaMember(teamEntity)) return;

                        const existingBuff = battle.filterBuffByName(teamEntity.entityId, KENYA_BUFF_NAME);
                        if (existingBuff.length > 0) return;

                        const buff = buildKenyaBuff(data.skillOwnerId, teamEntity.entityId);
                        battle.actionAddBuff(buff, Reasons.SKILL);
                        battle.log(`【${teamEntity.name}】获得【名门剑谷】buff，攻击和效果抵抗+10%`);
                    });

                    battle.log(`【${source.name}】发动部长技【名门剑谷】，检测到${kenyaCount}位剑谷高中成员`);
                }

                return -1;
            },
            code: EventCodes.SENKI,
            range: EventRange.TEAM,
            priority: 0,
            passive: true,
            name: '【先机】名门剑谷',
        },
    ],
};
