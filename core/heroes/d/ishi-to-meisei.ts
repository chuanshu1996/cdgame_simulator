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
    Mana,
} from '../../';
import {SkillTarget, SelectableSkill, SkillSelection} from '../../skill';
import {TurnProcessing} from '../../index';
import {normalAI} from '../ai';

export const ishi_to_meisei_skill1: Skill = {
    no: 1,
    name: '欧派威慑',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '巫女服下也这么有实力，对单体目标造成防御300%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const def = battle.getComputedProperty(sourceId, BattleProperties.DEF);
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .base(() => def)
                .rate(3.0)
                .shouldComputeCri()
                .single()
                .end()
        );
    },
};

function buildHomeworkDebuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('没做作业', 1)
        .countDown(3)
        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, -50)
        .end();
}

export const ishi_to_meisei_skill2: Skill = {
    no: 2,
    name: '没做作业',
    passive: true,
    cost: 0,
    text: '被动技能。先机获得一个debuff【没做作业】，速度降低50点，持续3回合。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                battle.actionAddBuff(buildHomeworkDebuff(data.skillOwnerId, data.skillOwnerId), Reasons.SKILL);
                battle.log(`【${battle.getEntity(data.skillOwnerId)?.name}】获得【没做作业】debuff，速度-50`);
                
                return -1;
            },
            code: EventCodes.SENKI,
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '【先机】没做作业',
        },
    ],
};

function findHighestDefEntity(battle: Battle, teamId: number): any {
    const entities = battle.getTeamEntities(teamId);
    let highest = null;
    let highestValue = -Infinity;
    
    for (const entity of entities) {
        if (entity.dead) continue;
        const def = entity.getProperty(BattleProperties.DEF);
        if (def > highestValue) {
            highestValue = def;
            highest = entity;
        }
    }
    
    return highest;
}

function buildDefBuff(sourceId: number, targetId: number, defValue: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('重量级候补', 1)
        .countDown(2)
        .buffAP(BattleProperties.DEF, EffectTypes.FIXED, 400)
        .icon('') // 添加空图标，确保buff在界面上显示
        .buff() // 添加BUFF属性，确保在界面上显示为增益效果
        .end();
}

function applyHeavyBackup(battle: Battle, sourceId: number) {
    const source = battle.getEntity(sourceId);
    if (!source) return;
    
    // 处理自身
    const sourceDef = source.getProperty(BattleProperties.DEF);
    const sourceBuff = buildDefBuff(sourceId, sourceId, sourceDef);
    battle.actionAddBuff(sourceBuff, Reasons.SKILL);
    battle.log(`【${source.name}】获得【重量级候补】防御提升`);
    
    // 处理防御最高的队友
    const highestDefEntity = findHighestDefEntity(battle, source.teamId);
    if (highestDefEntity) {
        // 即使是自身也需要处理，因为可能自身是防御最高的
        const highestDef = highestDefEntity.getProperty(BattleProperties.DEF);
        const teammateBuff = buildDefBuff(sourceId, highestDefEntity.entityId, highestDef);
        battle.actionAddBuff(teammateBuff, Reasons.SKILL);
        if (highestDefEntity.entityId === sourceId) {
            battle.log(`【${source.name}】作为防御最高的单位获得【重量级候补】防御提升`);
        } else {
            battle.log(`【${source.name}】为【${highestDefEntity.name}】提供【重量级候补】防御提升`);
        }
    }
}

export const ishi_to_meisei_skill3: Skill = {
    no: 3,
    name: '重量级候补',
    passive: false,
    cost: 3,
    target: SkillTarget.SELF,
    text: '自身和防御最高的队友获得【重量级候补】buff，防御力提升400点，持续2回合。应援位也可发动，仅限开场一次。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return -1;
                
                if (entity.position === 7) {
                    const used = entity.getBattleData('ishi_heavy_backup_used');
                    if (used === 'true') return -1;
                    
                    applyHeavyBackup(battle, data.skillOwnerId);
                    entity.setData('ishi_heavy_backup_used', 'true');
                    
                    battle.log(`【${entity.name}】在应援位触发【重量级候补】`);
                }
                
                return -1;
            },
            code: EventCodes.SENKI,
            range: EventRange.NONE,
            priority: 50,
            passive: false,
            name: '【先机】重量级候补（应援位）',
        },
    ],
    use(battle: Battle, sourceId: number, _: number) {
        applyHeavyBackup(battle, sourceId);
    },
};

/**
 * 石户明星自定义AI
 * 当拥有"重量级候补"buff时，优先使用1技能
 * @param battle 战斗对象
 * @param turnData 回合数据
 * @param mana 鬼火对象
 * @param selections 可选技能列表
 * @returns 技能选择对象
 */
export function ishiToMeiseiAI(battle: Battle, turnData: TurnProcessing, mana: Mana | null, selections: SelectableSkill[]): SkillSelection | null {
    const currentEntity = battle.getEntity(turnData.currentId);
    if (!currentEntity) return normalAI(battle, turnData, mana, selections);
    
    // 检查是否拥有"重量级候补"buff
    const hasHeavyBackupBuff = battle.buffs.some(buff => 
        buff.ownerId === currentEntity.entityId && 
        buff.name === '重量级候补'
    );
    
    // 如果拥有"重量级候补"buff，优先使用1技能
    if (hasHeavyBackupBuff) {
        const skill1 = selections.find(s => s.no === 1 && s.targets.length);
        if (skill1) {
            return {
                no: skill1.no,
                targetId: battle.getRandomOne(skill1.targets),
            };
        }
    }
    
    // 其他情况使用默认AI
    return normalAI(battle, turnData, mana, selections);
}
