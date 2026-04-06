import {
    Attack,
    BattleProperties,
    Battle,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
    EffectTypes,
    JudgeFlagManager,
} from '../../';
import {SkillTarget} from '../../skill';
import Buff from '../../buff';
import Healing from '../../healing';
import NormalAttack from '../common/normal-attack';

export const fukabori_sumiyo_skill1: Skill = {
    no: 1,
    name: '老实立直',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '老老实实立直，对单体对手造成125%攻击伤害，造成伤害时给对手附加【缓速】debuff，持续到游戏结束。【缓速】：速度下降10点。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        battle.actionAttack(
            Attack.build(selectedId, sourceId)
                .rate(1.25)
                .shouldComputeCri()
                .single()
                .skill('老实立直')
                .completed((battle: Battle, data: any) => {
                    const attackInfo = data.attackInfos?.[0];
                    if (attackInfo && attackInfo.finalDamage > 0) {
                        const slowBuff = Buff.build(sourceId, selectedId)
                            .name('缓速', 1)
                            .buffAP(BattleProperties.SPD, EffectTypes.FIXED, -10)
                            .noDispel()
                            .noRemove()
                            .debuff()
                            .end();
                        battle.actionAddBuff(slowBuff, Reasons.SKILL);
                        battle.log(`【${source.name}】对【${battle.getEntity(selectedId)?.name}】附加【缓速】debuff`);
                    }
                })
                .end()
        );
    },
};

function buildShareDamageBuff(sourceId: number, targetId: number): Buff {
    return Buff.build(sourceId, targetId)
        .name('务实分担', 1)
        .noDispel()
        .noRemove()
        .buff()
        .end();
}

export const fukabori_sumiyo_skill2: Skill = {
    no: 2,
    name: '务实分担',
    passive: true,
    cost: 0,
    target: SkillTarget.SELF,
    text: '被动技能。当队友受到一次单体攻击时，自身分担本次伤害的50%。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const selfEntity = battle.getEntity(data.skillOwnerId);
                if (!selfEntity || selfEntity.dead) return -1;
                
                const attackData = data.data as any;
                if (!attackData || !attackData.attackInfos) return -1;
                
                const attackInfos = attackData.attackInfos;
                if (!attackInfos || attackInfos.length !== 1) return -1;
                
                const attackInfo = attackInfos[0];
                const targetId = attackInfo.targetId;
                const target = battle.getEntity(targetId);
                
                if (!target || target.teamId !== selfEntity.teamId || target.entityId === selfEntity.entityId) return -1;
                
                const damage = attackInfo.finalDamage || 0;
                if (damage <= 0) return -1;
                
                const shareDamage = Math.floor(damage * 0.5);
                if (shareDamage <= 0) return -1;
                
                battle.actionAttack(
                    Attack.build(selfEntity.entityId, data.skillOwnerId)
                        .base(() => shareDamage)
                        .rate(1)
                        .real()
                        .single()
                        .skill('务实分担')
                        .noShare()
                        .end()
                );
                
                battle.log(`【${selfEntity.name}】发动【务实分担】，为【${target.name}】分担${shareDamage}点伤害`);
                battle.addEventLog('skill', `【${selfEntity.name}】发动【务实分担】，为【${target.name}】分担${shareDamage}点伤害`, {
                    sourceId: selfEntity.entityId,
                    targetId: targetId,
                    shareDamage: shareDamage
                });
                
                return -1;
            },
            code: EventCodes.HAS_BEEN_ATTACKED,
            range: EventRange.TEAM,
            priority: 100,
            passive: true,
            name: '务实分担',
        },
    ],
};

function hasUsedUltimateSkill(entity: any): boolean {
    return entity.getBattleData('fukabori_ultimate_used') === 'true';
}

function setUltimateSkillUsed(entity: any): void {
    entity.setData('fukabori_ultimate_used', 'true');
}

export const fukabori_sumiyo_skill3: Skill = {
    no: 3,
    name: '终局底力',
    passive: false,
    cost: 0,
    hide: true,
    target: SkillTarget.ENEMY,
    text: '限定技。当裁判旗来到第5回合后可使用，仅限一次。对全体敌方造成150%攻击力的真实伤害，造成的伤害回复自身血量。',
    use(battle: Battle, sourceId: number, _: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        if (hasUsedUltimateSkill(source)) {
            battle.log(`【${source.name}】已使用过【终局底力】，无法再次使用`);
            return;
        }
        
        const judgeFlag = JudgeFlagManager.getInstance().getJudgeFlag(battle);
        const status = judgeFlag.getStatus();
        
        if (status.judgeKingActionCount < 5) {
            battle.log(`【${source.name}】裁判旗尚未到达第5回合，无法使用【终局底力】`);
            return;
        }
        
        setUltimateSkillUsed(source);
        
        const enemies = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
        let totalDamage = 0;
        
        enemies.forEach(enemy => {
            const atk = battle.getComputedProperty(sourceId, BattleProperties.ATK);
            const damage = Math.floor(atk * 1.5);
            totalDamage += damage;
            
            battle.actionAttack(
                Attack.build(enemy.entityId, sourceId)
                    .base(() => damage)
                    .rate(1)
                    .real()
                    .single()
                    .skill('终局底力')
                    .noShare()
                    .end()
            );
        });
        
        if (totalDamage > 0) {
            const healing = Healing.build(sourceId, sourceId)
                .base(() => totalDamage)
                .rate(1)
                .skillName('终局底力')
                .end();
            battle.actionHeal(healing);
            battle.log(`【${source.name}】使用【终局底力】，对全体敌方造成${totalDamage}点真实伤害，回复自身${totalDamage}点生命`);
            battle.addEventLog('skill', `【${source.name}】使用【终局底力】，对全体敌方造成${totalDamage}点真实伤害，回复自身${totalDamage}点生命`, {
                sourceId: sourceId,
                totalDamage: totalDamage,
                healAmount: totalDamage
            });
        }
    },
};

export const fukabori_sumiyo_skill1_normal = new NormalAttack('老实立直');
fukabori_sumiyo_skill1_normal.text = '老老实实立直，对单体对手造成125%攻击伤害。';
fukabori_sumiyo_skill1_normal.cost = 0;
fukabori_sumiyo_skill1_normal.target = SkillTarget.ENEMY;
