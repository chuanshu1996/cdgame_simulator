import {
    Attack,
    BattleProperties,
    Buff,
    BuffParams,
    Battle,
    EffectTypes,
    EventCodes,
    EventRange,
    Healing,
    RealEventData,
    Reasons,
    Skill,
} from '../../';
import {SkillTarget} from '../../skill';
import {HeroTable} from '../index';

const QIYUAN_LABEL_BUFF_NAME = '祈愿标签';

// 检查角色是否有【车】标签
function hasCarLabel(entity: any): boolean {
    const heroData = HeroTable.get(entity.no);
    if (!heroData || !heroData.label) return false;
    return heroData.label.split('，').includes('车');
}

// 构建祈愿标签buff：持续3回合，作为标签标记
function buildQiyuanLabelBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(QIYUAN_LABEL_BUFF_NAME, 1)
        .countDown(3)
        .buff()
        .end();
}

/**
 * 技能1：八强进攻
 * 0火，主动技能
 * 对单体对手造成攻击力88%的伤害，如果自身攻击力在敌我双方选手中低于第8位，则改为造成攻击188%的伤害。
 */
export const shinshi_nozomu_skill1: Skill = {
    no: 1,
    name: '八强进攻',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对单体目标造成攻击力88%的伤害；若自身攻击力在敌我双方全部选手中低于第8位，则改为造成攻击力188%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 收集敌我双方所有存活选手的攻击力
        const allEntities: { entityId: number; atk: number }[] = [];
        
        for (let teamId = 0; teamId <= 1; teamId++) {
            const team = battle.getTeamEntities(teamId);
            for (const entity of team) {
                if (entity.dead) continue;
                // 排除裁判旗等非选手实体
                if (entity.teamId < 0 || entity.teamId > 1) continue;
                const atk = battle.getComputedProperty(entity.entityId, BattleProperties.ATK);
                allEntities.push({ entityId: entity.entityId, atk });
            }
        }
        
        // 按攻击力降序排列
        allEntities.sort((a, b) => b.atk - a.atk);
        
        // 查找自身排名（从0开始）
        const myRank = allEntities.findIndex(e => e.entityId === sourceId);
        
        // 如果自身攻击力低于第8位（排名 >= 7，即第8名及之后），使用188%伤害
        const isLowAtk = myRank >= 7;
        const damageRate = isLowAtk ? 1.88 : 0.88;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(damageRate)
                .shouldComputeCri()
                .single()
                .skill('八强进攻')
                .end()
        );
        
        if (isLowAtk) {
            battle.log(`【${source.name}】攻击力排名第${myRank + 1}，触发【八强进攻】加成，造成188%伤害`);
        } else {
            battle.log(`【${source.name}】攻击力排名第${myRank + 1}，造成88%伤害`);
        }
    },
};

/**
 * 技能2：上车
 * 被动技能
 * 所有标签有【车】的角色，在行动后提升自身20%的行动条。（替补位和应援位也可以触发）
 */
export const shinshi_nozomu_skill2: Skill = {
    no: 2,
    name: '上车',
    passive: true,
    cost: 0,
    text: '被动技能。所有标签含【车】的角色，在行动结束后增加自身20%行动条进度。（替补位和应援位也可以触发）',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.eventId) return -1;
                
                const entity = battle.getEntity(data.eventId);
                if (!entity) return -1;
                
                // 检查行动的角色是否有【车】标签
                if (!hasCarLabel(entity)) return -1;
                
                // 提升20%行动条
                battle.actionUpdateRunwayPercent(data.skillOwnerId, data.eventId, 0.2, Reasons.SKILL);
                battle.log(`【${entity.name}】触发【上车】，提升20%行动条`);
                
                return -1;
            },
            code: EventCodes.ACTION_END,
            range: EventRange.TEAM,
            priority: 50,
            passive: true,
            name: '上车',
        },
    ],
};

/**
 * 技能3：巫女之舞
 * 2火，主动技能
 * 为友方目标驱散3个减益状态或控制效果，并治疗生命上限30%的生命，
 * 若治疗溢出，则获得1个能够吸收自身生命上限5%的护盾，持续2回合，
 * 之后为其施加【祈愿】标签，持续3回合。
 */
export const shinshi_nozomu_skill3: Skill = {
    no: 3,
    name: '巫女之舞',
    passive: false,
    cost: 2,
    target: SkillTarget.TEAM,
    text: '为单体友方目标驱散3个减益效果或控制效果，并回复其30%最大生命值；若治疗量溢出，则为其提供相当于自身5%最大生命值的护盾，持续2回合；最后为其施加【祈愿】标签，持续3回合。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const target = battle.getEntity(selectedId);
        if (!target) return;
        
        // 驱散3个减益状态或控制效果
        const debuffsAndControls = battle.buffs.filter(buff =>
            buff.ownerId === selectedId &&
            (buff.hasParam(BuffParams.DEBUFF) || buff.hasParam(BuffParams.CONTROL)) &&
            !buff.hasParam(BuffParams.NO_DISPEL)
        );
        
        const dispelCount = Math.min(3, debuffsAndControls.length);
        for (let i = 0; i < dispelCount; i++) {
            battle.actionRemoveBuff(debuffsAndControls[i], Reasons.SKILL);
        }
        
        if (dispelCount > 0) {
            battle.log(`【${source.name}】为【${target.name}】驱散了${dispelCount}个减益/控制效果`);
        }
        
        // 检测治疗是否会溢出
        const maxHp = battle.getComputedProperty(selectedId, BattleProperties.MAX_HP);
        const healAmount = maxHp * 0.3;
        const missingHp = maxHp - target.hp;
        const isOverflow = healAmount > missingHp;
        
        // 治疗30%生命上限
        battle.actionHeal(
            Healing.build(sourceId, selectedId)
                .base((battle, sourceId, targetId) => battle.getComputedProperty(targetId, BattleProperties.MAX_HP))
                .rate(0.3)
                .skillName('巫女之舞')
                .end()
        );
        
        // 若治疗溢出，获得护盾
        if (isOverflow) {
            const shieldAmount = maxHp * 0.05;
            const shieldBuff = Buff.build(sourceId, selectedId)
                .name('巫女之舞·护盾', 1)
                .countDown(2)
                .shield(shieldAmount)
                .buff()
                .end();
            battle.actionAddBuff(shieldBuff, Reasons.SKILL);
            battle.log(`【${target.name}】治疗溢出，获得${Math.round(shieldAmount)}点护盾（持续2回合）`);
        }
        
        // 施加【祈愿】标签，持续3回合
        const qiyuanBuff = buildQiyuanLabelBuff(sourceId, selectedId);
        battle.actionAddBuff(qiyuanBuff, Reasons.SKILL);
        battle.log(`【${target.name}】获得【祈愿】标签（持续3回合）`);
    },
};
