import {
    Attack,
    BattleProperties,
    Battle,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
} from '../../';
import {SkillTarget} from '../../skill';
import {HeroTable} from '../index';

/**
 * 室桥裕子技能1：稳健出牌
 * 主动技能，消耗0点鬼火
 * 对单个敌方目标造成相当于自身攻击力125%的伤害
 */
export const murohashi_hiroko_skill1: Skill = {
    no: 1,
    name: '稳健出牌',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '室桥裕子进行一次精准的普通打牌攻击，对单个敌方目标造成攻击力125%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.25)
                .shouldComputeCri()
                .single()
                .skill('稳健出牌')
                .end()
        );
    },
};

/**
 * 室桥裕子技能2：身高压制
 * 被动技能
 * 当对敌方小学生类型角色造成伤害时，降低目标角色20%当前行动条进度
 */
export const murohashi_hiroko_skill2: Skill = {
    no: 2,
    name: '身高压制',
    passive: true,
    cost: 0,
    text: '被动技能。当室桥裕子对敌方小学生类型角色造成伤害时，降低目标20%当前行动条进度，该效果不受技能等级影响。仅对grade属性含"小"字的敌方角色生效。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                
                const attackData = data.data as any;
                if (!attackData || !attackData.attackInfos) return -1;
                
                // 遍历所有攻击信息
                attackData.attackInfos.forEach((attackInfo: any) => {
                    if (attackInfo.finalDamage > 0) {
                        const targetId = attackInfo.targetId;
                        const target = battle.getEntity(targetId);
                        if (target && target.teamId !== battle.getEntity(data.skillOwnerId)?.teamId) {
                            // 检查目标是否为小学生类型（grade里含"小"字）
                            const targetData = HeroTable.get(target.no);
                            if (targetData && targetData.grade && targetData.grade.includes('小')) {
                                // 降低目标20%行动条进度
                                battle.actionUpdateRunwayPercent(data.skillOwnerId, targetId, -0.2, Reasons.SKILL);
                                battle.log(`【${battle.getEntity(data.skillOwnerId)?.name}】对【${target.name}】发动【身高压制】，降低20%行动条`);
                            }
                        }
                    }
                });
                
                return -1;
            },
            code: EventCodes.HAS_ATTACKED, // 攻击后事件
            range: EventRange.SELF,
            priority: 50,
            passive: true,
            name: '身高压制',
        },
    ],
};

/**
 * 室桥裕子技能3：后排横扫
 * 主动技能，消耗3点鬼火
 * 对敌方全体目标发动范围攻击，对每个目标造成相当于自身攻击力130%的物理伤害
 */
export const murohashi_hiroko_skill3: Skill = {
    no: 3,
    name: '后排横扫',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '室桥裕子对敌方全体目标发动范围攻击，对每个目标造成攻击力130%的伤害。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        // 获取敌方所有目标
        const enemies = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
        
        enemies.forEach(enemy => {
            battle.actionAttack(
                Attack.build(enemy.entityId, sourceId)
                    .rate(1.3)
                    .shouldComputeCri()
                    .single()
                    .skill('后排横扫')
                    .end()
            );
        });
    },
};
