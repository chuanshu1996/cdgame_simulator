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

const MAIGO_EFT_RES_BUFF_NAME = '迷途的真帆·效果抵抗';
const USED_SKILLS_KEY = 'maho_used_skill_nos';
const SKILL_QUEUE_KEY = 'maho_skill_queue';

// 检查角色是否有【迷子】标签
function hasMaigoLabel(entity: any): boolean {
    const heroData = HeroTable.get(entity.no);
    if (!heroData || !heroData.label) return false;
    return heroData.label.split('，').includes('迷子');
}

// 构建效果抵抗buff
function buildMaigoEftResBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(MAIGO_EFT_RES_BUFF_NAME, 1)
        .countDown(-1)
        .noRemove()
        .buff()
        .buffAP(BattleProperties.EFT_RES, EffectTypes.ADD_RATE, 0.3)
        .end();
}

// 获取已使用的技能编号列表
function getUsedSkillNos(entity: any): number[] {
    const data = entity.getBattleData(USED_SKILLS_KEY);
    if (!data) return [];
    return data.split(',').map((n: string) => Number(n)).filter((n: number) => !isNaN(n));
}

// 添加已使用的技能编号
function addUsedSkillNo(entity: any, no: number) {
    const used = getUsedSkillNos(entity);
    used.push(no);
    entity.setData(USED_SKILLS_KEY, used.join(','));
}

// 获取技能队列（按攻击力排序的队友entityId列表）
function getSkillQueue(entity: any): number[] {
    const data = entity.getBattleData(SKILL_QUEUE_KEY);
    if (!data) return [];
    return data.split(',').map((n: string) => Number(n)).filter((n: number) => !isNaN(n));
}

// 设置技能队列
function setSkillQueue(entity: any, queue: number[]) {
    entity.setData(SKILL_QUEUE_KEY, queue.join(','));
}

/**
 * 技能1：依旧初心
 * 0火，主动技能
 * 对单体目标造成攻击力100%的伤害。
 */
export const yumeno_maho_skill1: Skill = {
    no: 1,
    name: '依旧初心',
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
                .skill('依旧初心')
                .end()
        );
    },
};

/**
 * 技能2：迷途的真帆
 * 被动技能
 * 角色标签有【迷子】的角色，效果抵抗增加30%。（替补位和应援位也可以触发）
 */
export const yumeno_maho_skill2: Skill = {
    no: 2,
    name: '迷途的真帆',
    passive: true,
    cost: 0,
    text: '被动技能。所有标签含【迷子】的角色，效果抵抗提升30%。（替补位和应援位也可以触发）',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 为队伍中所有有【迷子】标签的角色添加效果抵抗buff
                const teamEntities = battle.getTeamEntities(source.teamId);
                for (const entity of teamEntities) {
                    if (entity.dead) continue;
                    // 检查是否已有buff
                    const existingBuff = battle.filterBuffByName(entity.entityId, MAIGO_EFT_RES_BUFF_NAME);
                    if (existingBuff.length > 0) continue;
                    
                    if (hasMaigoLabel(entity)) {
                        const buff = buildMaigoEftResBuff(data.skillOwnerId, entity.entityId);
                        battle.actionAddBuff(buff, Reasons.SKILL);
                        battle.log(`【${entity.name}】因【迷子】标签，效果抵抗增加30%`);
                    }
                }
                
                return -1;
            },
            code: EventCodes.BATTLE_START,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '迷途的真帆',
        },
    ],
};

/**
 * 技能3：模仿前辈
 * 主动技能
 * 按己方队伍的攻击力从高到低排序，每回合使用一个队友的3技能，每个技能只能使用1次，使用完后该技能无法再次使用。
 */
export const yumeno_maho_skill3: Skill = {
    no: 3,
    name: '模仿前辈',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '按己方队伍攻击力从高到低的顺序，每回合施放一名队友的3技能，每名队友的3技能整场战斗仅可被施放1次，用尽后不再重复施放。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 获取技能队列
        let queue = getSkillQueue(source);
        
        // 如果队列为空，初始化：按攻击力排序
        if (queue.length === 0) {
            const teamEntities = battle.getTeamEntities(source.teamId)
                .filter(e => !e.dead && e.entityId !== sourceId);
            
            // 按攻击力降序排列
            teamEntities.sort((a, b) => {
                const atkA = battle.getComputedProperty(a.entityId, BattleProperties.ATK);
                const atkB = battle.getComputedProperty(b.entityId, BattleProperties.ATK);
                return atkB - atkA;
            });
            
            // 只保留有3技能的队友
            queue = teamEntities
                .filter(e => e.skills && e.skills.some(s => s.no === 3 && !s.passive))
                .map(e => e.entityId);
            
            setSkillQueue(source, queue);
        }
        
        // 获取已使用的技能编号
        const usedNos = getUsedSkillNos(source);
        
        // 从队列中找到下一个未使用的队友
        let targetEntityId: number | null = null;
        let targetSkill: Skill | null = null;
        
        for (const entityId of queue) {
            const entity = battle.getEntity(entityId);
            if (!entity || entity.dead) continue;
            
            // 跳过已使用的
            if (usedNos.includes(entity.no)) continue;
            
            // 获取3技能
            const skill3 = entity.skills.find(s => s.no === 3 && !s.passive);
            if (skill3 && skill3.use) {
                targetEntityId = entityId;
                targetSkill = skill3;
                break;
            }
        }
        
        if (targetSkill && targetEntityId !== null) {
            const targetEntity = battle.getEntity(targetEntityId);
            
            // 记录已使用
            addUsedSkillNo(source, targetEntity.no);
            
            // 使用队友的3技能
            battle.log(`【${source.name}】使用【模仿前辈】，模仿【${targetEntity.name}】的【${targetSkill.name}】`);
            targetSkill.use?.(battle, sourceId, selectedId);
        } else {
            // 所有技能已使用完，使用默认攻击
            battle.actionAttack(
                Attack.build(selectedId, sourceId)
                    .rate(1.0)
                    .shouldComputeCri()
                    .single()
                    .skill('模仿前辈')
                    .end()
            );
            battle.log(`【${source.name}】的【模仿前辈】已无技能可模仿，使用默认攻击`);
        }
    },
};
