import {
    Battle,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
    EffectTypes,
    BattleProperties
} from '../../';
import NormalAttack from '../common/normal-attack';
import {SkillTarget} from '../../skill';
import Buff from '../../buff';
import Healing from '../../healing';

export const shinshi_ayumu_skill1 = new NormalAttack('稳重进攻');
shinshi_ayumu_skill1.text = '稳扎稳打，对单体对手造成125%攻击伤害。';
shinshi_ayumu_skill1.cost = 0;
shinshi_ayumu_skill1.target = SkillTarget.ENEMY;

// 缜密心理被动技能
export const shinshi_ayumu_skill2: Skill = {
    no: 2,
    name: '缜密心理',
    passive: true,
    cost: 0,
    target: SkillTarget.SELF,
    text: '每次受到攻击时，获得1层【缜密心理】，最高叠加10层，战斗开始时先机获得3层，持续至战斗结束。【缜密心理】：防御力提升10%，效果抵抗提升10%。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return 0;
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return 0;
                
                // 战斗开始时先机获得3层
                for (let i = 0; i < 3; i++) {
                    const buff = Buff.build(data.skillOwnerId, data.skillOwnerId)
                        .name('缜密心理', 10)
                        .buffAP('def', EffectTypes.ADD_RATE, 0.1)
                        .buffAP('eft_res', EffectTypes.ADD_RATE, 0.1)
                        .noRemove()
                        .end();
                    battle.actionAddBuff(buff, Reasons.SKILL);
                }
                
                battle.log(`【${entity.name}】获得3层缜密心理`);
                battle.addEventLog('skill', `【${entity.name}】先机获得3层【缜密心理】`, {
                    entityId: entity.entityId,
                    stackCount: 3
                });
                return -1;
            },
            code: EventCodes.SENKI,
            range: EventRange.NONE,
            priority: 0,
            passive: true,
            name: '【先机】缜密心理',
        },
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.eventId) {
                    return -1;
                }
                
                const entity = battle.getEntity(data.eventId);
                if (!entity || entity.dead) {
                    return -1;
                }
                
                // 每次收到攻击时获得一层
                const buff = Buff.build(data.eventId, data.eventId)
                    .name('缜密心理', 10)
                    .buffAP('def', EffectTypes.ADD_RATE, 0.1)
                    .buffAP('eft_res', EffectTypes.ADD_RATE, 0.1)
                    .noRemove()
                    .end();
                
                battle.actionAddBuff(buff, Reasons.SKILL);
                
                const buffCount = battle.filterBuffByName(data.eventId, '缜密心理').length;
                battle.log(`【${entity.name}】获得1层缜密心理，当前层数：${buffCount}`);
                battle.addEventLog('skill', `【${entity.name}】受击获得1层【缜密心理】，当前${buffCount}层`, {
                    entityId: data.eventId,
                    stackCount: buffCount
                });
                
                return -1;
            },
            code: EventCodes.HAS_BEEN_ATTACKED,
            range: EventRange.SELF,
            priority: 0,
            passive: true,
            name: '【受击】缜密心理',
        }
    ],
};

// 陪伴好友技能
export const shinshi_ayumu_skill3: Skill = {
    no: 3,
    name: '陪伴好友',
    passive: false,
    cost: (battle: Battle, entityId: number) => {
        const entity = battle.getEntity(entityId);
        if (!entity) return 3;
        
        // 计算可用的缜密心理层数
        const buffCount = battle.filterBuffByName(entityId, '缜密心理').length;
        return Math.max(0, 3 - buffCount);
    },
    target: SkillTarget.TEAM,
    text: '为全体队友提供1层【陪伴】buff。（可使用1层【缜密心理】代替1点鬼火，最多3点，如果队友为野上叶子则额外提供1层）。【陪伴】：可抵挡1次控制效果，持续1回合。若自然消失时未抵消控制效果，回复自身5%最大生命值。',
    use(battle: Battle, sourceId: number, _: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 消耗缜密心理
        const buffs = battle.filterBuffByName(sourceId, '缜密心理');
        const consumeCount = Math.min(buffs.length, 3);
        if (consumeCount > 0) {
            for (let i = 0; i < consumeCount; i++) {
                if (buffs[i]) {
                    battle.actionRemoveBuff(buffs[i], Reasons.SKILL);
                }
            }
        }
        
        // 为全体队友添加陪伴buff
        const teamEntities = battle.getTeamEntities(source.teamId);
        teamEntities.forEach(entity => {
            // 基础1层
            const buff = Buff.build(sourceId, entity.entityId)
                .name('陪伴', 1)
                .countDown(1)
                .ruleControlImmune()
                .buff()
                .end();
            battle.actionAddBuff(buff, Reasons.SKILL);
            
            // 如果是野上叶子，额外提供1层
            if (entity.name === '野上叶子') {
                const extraBuff = Buff.build(sourceId, entity.entityId)
                    .name('陪伴', 1)
                    .countDown(1)
                    .ruleControlImmune()
                    .buff()
                    .end();
                battle.actionAddBuff(extraBuff, Reasons.SKILL);
                battle.log(`【${entity.name}】获得2层陪伴`);
            } else {
                battle.log(`【${entity.name}】获得1层陪伴`);
            }
            battle.addEventLog('skill', `【${source.name}】为【${entity.name}】施加【陪伴】buff`, {
                sourceId: sourceId,
                targetId: entity.entityId,
                buffName: '陪伴',
                stackCount: entity.name === '野上叶子' ? 2 : 1
            });
        });
        
        battle.log(`【${source.name}】使用陪伴好友，消耗${consumeCount}层缜密心理`);
        battle.addEventLog('skill', `【${source.name}】使用【陪伴好友】，消耗${consumeCount}层【缜密心理】`, {
            entityId: sourceId,
            consumedStacks: consumeCount
        });
    },
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                // data.eventId 是buff所有者的ID
                // data.data 是 RemoveBuffProcessing 对象
                if (!data.eventId) return -1;
                
                const entity = battle.getEntity(data.eventId);
                if (!entity || entity.dead) return -1;
                
                // 获取移除的buff信息
                const removeData = data.data as any;
                if (!removeData || !removeData.buff) return -1;
                
                const removedBuff = removeData.buff;
                
                // 只处理陪伴buff的移除
                if (removedBuff.name !== '陪伴') return -1;
                
                // 只处理自己施加的陪伴buff（避免双方都有进士步时重复触发）
                if (removedBuff.sourceId !== data.skillOwnerId) return -1;
                
                // 检查是否是因为时间到了自然消失（reason === Reasons.TIME_OUT）
                // 或者是因为抵消控制效果后消失
                // 如果是因为抵消控制效果，则不回复生命
                const reason = removeData.reason;
                if (reason === Reasons.TIME_OUT) {
                    // 时间到了自然消失，回复5%生命
                    const maxHp = battle.getComputedProperty(data.eventId, BattleProperties.MAX_HP);
                    const healAmount = Math.floor(maxHp * 0.05);
                    const healing = Healing.build(data.eventId, data.eventId)
                        .base(BattleProperties.MAX_HP)
                        .rate(0.05)
                        .skillName('陪伴')
                        .end();
                    battle.actionHeal(healing);
                    battle.log(`【${entity.name}】陪伴buff自然消失，回复${healAmount}点生命`);
                    battle.addEventLog('skill', `【${entity.name}】的【陪伴】buff自然消失，回复${healAmount}点生命`, {
                        entityId: data.eventId,
                        healAmount: healAmount
                    });
                }
                
                return -1;
            },
            code: EventCodes.BUFF_REMOVE,
            range: EventRange.NONE,  // 监听所有人的buff移除事件，通过buff名称和来源过滤
            priority: 0,
            passive: true,
            name: '【陪伴】生命回复',
        }
    ],
};