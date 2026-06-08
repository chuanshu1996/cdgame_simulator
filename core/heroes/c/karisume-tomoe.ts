import {
    Attack,
    BattleProperties,
    Buff,
    BuffParams,
    Battle,
    EffectTypes,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
    Entity,
} from '../../';
import {SkillTarget} from '../../skill';
import {HeroTable} from '../index';

// 检查角色是否是巫女（通过label字段）
function isMiko(entity: Entity): boolean {
    const heroData = HeroTable.get(entity.no);
    if (!heroData || !heroData.label) return false;
    return heroData.label.includes('巫女');
}

// 获取队伍中巫女角色的数量（包括替补和应援）
function getMikoCount(battle: Battle, teamId: number): number {
    const teamEntities = battle.getTeamEntities(teamId);
    return teamEntities.filter(entity => !entity.dead && isMiko(entity)).length;
}

// 获取队伍中的大将角色
function getTaisho(battle: Battle, teamId: number): Entity | undefined {
    const teamEntities = battle.getTeamEntities(teamId);
    for (const entity of teamEntities) {
        if (entity.dead) continue;
        const heroData = HeroTable.get(entity.no);
        if (heroData && heroData.position === '大将') {
            return entity;
        }
    }
    return undefined;
}

// 获取队伍中所有巫女角色
function getMikoEntities(battle: Battle, teamId: number): Entity[] {
    const teamEntities = battle.getTeamEntities(teamId);
    return teamEntities.filter(entity => !entity.dead && isMiko(entity));
}

/**
 * 狩宿巴技能1：巫女速攻
 * 主动技能，消耗0点鬼火
 * 对单体对手造成百分之100攻击的间接伤害（队伍中每有一位巫女角色，造成伤害增加百分之20）
 */
export const karisume_tomoe_skill1: Skill = {
    no: 1,
    name: '巫女速攻',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对单体对手造成攻击力100%的间接伤害。队伍中每有一位巫女角色，造成伤害增加20%。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 获取队伍中巫女数量
        const mikoCount = getMikoCount(battle, source.teamId);
        
        // 计算伤害倍率：基础100% + 每位巫女20%
        const damageRate = 1.0 + mikoCount * 0.2;
        
        // 造成间接伤害
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(damageRate)
                .indirect() // 间接伤害
                .single()
                .skill('巫女速攻')
                .end()
        );
        
        battle.log(`【${source.name}】使用【巫女速攻】，队伍中有${mikoCount}位巫女，伤害倍率为${damageRate * 100}%`);
    },
};

/**
 * 狩宿巴技能2：六仙女
 * 被动技能，先机触发
 * 为所有标签中有巫女的角色增加速度、效果抵抗以及护盾
 * 每有1位巫女增加10速度、10效果抵抗和1000护盾，持续一回合
 * 应援和替补位置也可以触发
 */
export const karisume_tomoe_skill2: Skill = {
    no: 2,
    name: '六仙女',
    passive: true,
    cost: 0,
    text: '被动技能。先机为所有巫女角色增加速度、效果抵抗和护盾。每有1位巫女增加10速度、10效果抵抗和1000护盾，持续1回合。应援和替补位置也可以触发。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 获取队伍中所有巫女角色
                const mikoEntities = getMikoEntities(battle, source.teamId);
                const mikoCount = mikoEntities.length;
                
                if (mikoCount === 0) return -1;
                
                // 每位巫女增加的属性值
                const spdBonus = mikoCount * 10;
                const eftResBonus = mikoCount * 10;
                const shieldBonus = mikoCount * 1000;
                
                // 为所有巫女角色添加buff
                mikoEntities.forEach(entity => {
                    // 速度buff
                    const spdBuff = Buff.build(data.skillOwnerId, entity.entityId)
                        .name('六仙女·速度', mikoCount)
                        .countDown(1)
                        .buff()
                        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, spdBonus)
                        .end();
                    battle.actionAddBuff(spdBuff, Reasons.SKILL);
                    
                    // 效果抵抗buff
                    const eftResBuff = Buff.build(data.skillOwnerId, entity.entityId)
                        .name('六仙女·抵抗', mikoCount)
                        .countDown(1)
                        .buff()
                        .buffAP(BattleProperties.EFT_RES, EffectTypes.FIXED, eftResBonus)
                        .end();
                    battle.actionAddBuff(eftResBuff, Reasons.SKILL);
                    
                    // 护盾buff
                    const shieldBuff = Buff.build(data.skillOwnerId, entity.entityId)
                        .name('六仙女·护盾', mikoCount)
                        .countDown(1)
                        .buff()
                        .shield(shieldBonus)
                        .end();
                    battle.actionAddBuff(shieldBuff, Reasons.SKILL);
                    
                    battle.log(`【${entity.name}】获得【六仙女】buff，速度+${spdBonus}，效果抵抗+${eftResBonus}，护盾+${shieldBonus}`);
                });
                
                return -1;
            },
            code: EventCodes.SENKI, // 先机触发
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '六仙女',
        },
    ],
};

/**
 * 狩宿巴技能3：驱魔
 * 主动技能，消耗2点鬼火
 * 为自身以及大将驱散所有负面效果，同时给其他所有队友驱散随机一个负面效果
 */
export const karisume_tomoe_skill3: Skill = {
    no: 3,
    name: '驱魔',
    passive: false,
    cost: 2,
    target: SkillTarget.SELF,
    text: '为自身以及大将驱散所有负面效果，同时给其他所有队友驱散随机一个负面效果。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 获取队伍中所有成员
        const teamEntities = battle.getTeamEntities(source.teamId).filter(e => !e.dead);
        
        // 获取大将角色
        const taisho = getTaisho(battle, source.teamId);
        
        // 驱散自身的所有负面效果
        const selfDebuffs = battle.buffs.filter(buff =>
            buff.ownerId === sourceId &&
            buff.hasParam(BuffParams.DEBUFF) &&
            !buff.hasParam(BuffParams.NO_DISPEL)
        );
        selfDebuffs.forEach(buff => {
            battle.actionRemoveBuff(buff, Reasons.SKILL);
        });
        if (selfDebuffs.length > 0) {
            battle.log(`【${source.name}】驱散了${selfDebuffs.length}个负面效果`);
        }
        
        // 驱散大将的所有负面效果
        if (taisho && taisho.entityId !== sourceId) {
            const taishoDebuffs = battle.buffs.filter(buff =>
                buff.ownerId === taisho.entityId &&
                buff.hasParam(BuffParams.DEBUFF) &&
                !buff.hasParam(BuffParams.NO_DISPEL)
            );
            taishoDebuffs.forEach(buff => {
                battle.actionRemoveBuff(buff, Reasons.SKILL);
            });
            if (taishoDebuffs.length > 0) {
                battle.log(`【${taisho.name}】（大将）驱散了${taishoDebuffs.length}个负面效果`);
            }
        }
        
        // 其他队友驱散随机一个负面效果
        teamEntities.forEach(entity => {
            // 排除自身和大将
            if (entity.entityId === sourceId) return;
            if (taisho && entity.entityId === taisho.entityId) return;
            
            const entityDebuffs = battle.buffs.filter(buff =>
                buff.ownerId === entity.entityId &&
                buff.hasParam(BuffParams.DEBUFF) &&
                !buff.hasParam(BuffParams.NO_DISPEL)
            );
            
            if (entityDebuffs.length > 0) {
                // 随机选择一个负面效果驱散
                const randomIndex = Math.floor(Math.random() * entityDebuffs.length);
                const randomDebuff = entityDebuffs[randomIndex];
                battle.actionRemoveBuff(randomDebuff, Reasons.SKILL);
                battle.log(`【${entity.name}】驱散了1个负面效果【${randomDebuff.name}】`);
            }
        });
        
        battle.log(`【${source.name}】使用【驱魔】，为队伍驱散负面效果`);
    },
};