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
import {SkillTarget, SelectableSkill, SkillSelection} from '../../skill';
import NormalAttack from '../common/normal-attack';
import {TurnProcessing} from '../../tasks';
import {Mana} from '../../';
import {normalAI} from '../ai';

const DOUPAI_BUFF_NAME = '兜牌';
const LOW_EXISTENCE_MARK = '低存在感';

// 检查目标是否有立直相关的技能
function hasRichiSkill(entity: any): boolean {
    if (!entity || !entity.skills) return false;
    return entity.skills.some((skill: any) =>
        skill.name && skill.name.includes('立直')
    );
}

// 构建兜牌buff
function buildDoupaiBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name(DOUPAI_BUFF_NAME, 1)
        .countDown(1)
        .buff()
        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, -10)
        .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.3)
        .end();
}

// 选择目标函数：优先选择有立直技能的角色
function selectTarget(battle: Battle, sourceId: number): number[] {
    const source = battle.getEntity(sourceId);
    if (!source) return [];
    
    const enemies = battle.getEnemies(sourceId);
    if (enemies.length === 0) return [];
    
    // 优先选择有立直技能的角色
    const richiEnemies = enemies.filter(e => !e.dead && hasRichiSkill(e));
    if (richiEnemies.length > 0) {
        // 随机选择一个有立直技能的敌人
        const selected = battle.getRandomOne(richiEnemies);
        return [selected.entityId];
    }
    
    // 没有立直技能的敌人，选择任意一个
    const normalEnemies = enemies.filter(e => !e.dead);
    if (normalEnemies.length > 0) {
        const selected = battle.getRandomOne(normalEnemies);
        return [selected.entityId];
    }
    
    return [];
}

// 技能1：兜牌防守
export const ido_sumiko_skill1: Skill = {
    no: 1,
    name: '兜牌防守',
    passive: false,
    cost: 0,
    target: (battle: Battle, sourceId: number) => selectTarget(battle, sourceId),
    text: '优先进攻技能中有立直的角色，对单体对手造成攻击力100%的伤害（对技能中有立直的对手造成攻击力200%的伤害，并获得【兜牌】buff）。【兜牌】：速度下降10点，防御力增加30%，最多叠加1层，持续一回合。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const target = battle.getEntity(selectedId);
        if (!target) return;
        
        // 检查目标是否有立直技能
        const hasRichi = hasRichiSkill(target);
        const damageRate = hasRichi ? 2.0 : 1.0;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(damageRate)
                .shouldComputeCri()
                .single()
                .skill('兜牌防守')
                .end()
        );
        
        // 如果目标有立直技能，获得兜牌buff
        if (hasRichi) {
            // 检查是否已有兜牌buff（最多叠加1层）
            const existingDoupai = battle.filterBuffByName(sourceId, DOUPAI_BUFF_NAME);
            if (existingDoupai.length === 0) {
                battle.actionAddBuff(buildDoupaiBuff(sourceId, sourceId), Reasons.SKILL);
                battle.log(`【${source.name}】对有立直技能的【${target.name}】造成200%伤害，获得【兜牌】buff`);
            } else {
                battle.log(`【${source.name}】对有立直技能的【${target.name}】造成200%伤害（已有兜牌buff，不再叠加）`);
            }
        } else {
            battle.log(`【${source.name}】使用【兜牌防守】，对【${target.name}】造成100%伤害`);
        }
        
        battle.addEventLog('skill', `【${source.name}】使用【兜牌防守】，对【${target.name}】造成${damageRate * 100}%伤害`, {
            sourceId: sourceId,
            targetId: selectedId,
            damageRate: damageRate,
            hasRichi: hasRichi,
            gotDoupai: hasRichi && battle.filterBuffByName(sourceId, DOUPAI_BUFF_NAME).length > 0
        });
    },
};

// 技能2：低存在感
export const ido_sumiko_skill2: Skill = {
    no: 2,
    name: '低存在感',
    passive: true,
    cost: 0,
    reserveValid: true, // 在替补/应援位置也可以生效
    text: '被动技能。单体攻击无法选中自己。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const source = battle.getEntity(data.skillOwnerId);
                if (!source) return -1;
                
                // 在战斗开始时标记自己为不可被单体选中
                source.setData(LOW_EXISTENCE_MARK, 'true');
                battle.log(`【${source.name}】的【低存在感】生效，单体攻击无法选中自己`);
                
                return -1;
            },
            code: EventCodes.SENKI, // 先机事件，战斗开始时触发
            range: EventRange.NONE,
            priority: 100,
            passive: true,
            name: '低存在感',
        },
    ],
};

// 技能3：默默默听
export const ido_sumiko_skill3: Skill = {
    no: 3,
    name: '默默默听',
    passive: false,
    cost: 1,
    target: SkillTarget.ENEMY,
    text: '对单体敌方造成100%攻击力的真实伤害（如果有【兜牌】buff，则返还1点鬼火，并造成攻击力200%的真实伤害）。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 检查是否有兜牌buff
        const hasDoupai = battle.filterBuffByName(sourceId, DOUPAI_BUFF_NAME).length > 0;
        
        // 计算伤害倍率
        const damageRate = hasDoupai ? 2.0 : 1.0;
        
        // 造成真实伤害
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(damageRate)
                .param(AttackParams.REAL)
                .shouldComputeCri()
                .single()
                .skill('默默默听')
                .end()
        );
        
        // 如果有兜牌buff，返还1点鬼火
        if (hasDoupai) {
            battle.actionUpdateMana(sourceId, source.teamId, 1, Reasons.SKILL);
            battle.log(`【${source.name}】使用【默默默听】，有兜牌buff，返还1点鬼火，造成200%真实伤害`);
            
            // 移除兜牌buff（消耗掉）
            const doupaiBuffs = battle.filterBuffByName(sourceId, DOUPAI_BUFF_NAME);
            for (const buff of doupaiBuffs) {
                battle.actionRemoveBuff(buff, Reasons.SKILL);
            }
            battle.log(`【${source.name}】消耗【兜牌】buff`);
        } else {
            battle.log(`【${source.name}】使用【默默默听】，对【${battle.getEntity(selectedId)?.name}】造成100%真实伤害`);
        }
        
        battle.addEventLog('skill', `【${source.name}】使用【默默默听】，造成${damageRate * 100}%真实伤害${hasDoupai ? '，返还1点鬼火' : ''}`, {
            sourceId: sourceId,
            targetId: selectedId,
            damageRate: damageRate,
            hasDoupai: hasDoupai,
            refundedMana: hasDoupai ? 1 : 0
        });
    },
};

/**
 * 依藤澄子自定义AI
 * 没有兜牌buff时，优先使用技能1（兜牌防守）来获取buff
 * 有兜牌buff时，优先使用技能3（默默默听）来消耗buff并返还鬼火
 * @param battle 战斗对象
 * @param turnData 回合数据
 * @param mana 鬼火对象
 * @param selections 可选技能列表
 * @returns 技能选择对象
 */
export function idoSumikoAI(battle: Battle, turnData: TurnProcessing, mana: Mana | null, selections: SelectableSkill[]): SkillSelection | null {
    const currentEntity = battle.getEntity(turnData.currentId);
    if (!currentEntity) return normalAI(battle, turnData, mana, selections);
    
    const currentMana = mana ? mana.num : 0;
    
    // 检查是否有兜牌buff
    const hasDoupai = battle.filterBuffByName(currentEntity.entityId, DOUPAI_BUFF_NAME).length > 0;
    
    // 没有兜牌buff时，优先使用技能1来获取buff
    if (!hasDoupai) {
        const skill1 = selections.find(s => s.no === 1 && s.targets.length);
        if (skill1) {
            // 技能1有自定义目标选择，优先选择有立直技能的敌人
            // 如果目标列表为空，使用默认AI
            if (skill1.targets.length > 0) {
                return {
                    no: skill1.no,
                    targetId: battle.getRandomOne(skill1.targets),
                };
            }
        }
    }
    
    // 有兜牌buff时，优先使用技能3（默默默听）
    // 技能3消耗1鬼火，但会返还1鬼火，所以实际上不消耗鬼火
    if (hasDoupai && currentMana >= 1) {
        const skill3 = selections.find(s => s.no === 3 && s.targets.length);
        if (skill3) {
            return {
                no: skill3.no,
                targetId: battle.getRandomOne(skill3.targets),
            };
        }
    }
    
    // 其他情况使用默认AI
    return normalAI(battle, turnData, mana, selections);
}