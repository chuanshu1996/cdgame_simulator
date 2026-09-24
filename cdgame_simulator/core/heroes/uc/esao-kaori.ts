import {
    Attack,
    AttackParams,
    Battle,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
    BuffParams,
    AddBuffProcessing,
    HeroData,
} from '../../';
import {SkillTarget} from '../../skill';

// 两次独立概率判定取较优（至少一次成功）——“新手强运”核心逻辑
function doubleTestHit(p: number): boolean {
    return Math.random() <= p || Math.random() <= p;
}

// 判断选手是否带指定标签
function hasLabel(entity: any, label: string): boolean {
    const heroInfo = HeroData.find((d: any) => Number(d.index) === entity.no);
    if (!heroInfo || !heroInfo.label) return false;
    return heroInfo.label.split('，').includes(label);
}

// 妹尾佳织“役满打击”当前发动概率（持久化：初始 10%，发动成功后降为 1%）
function getYakumanProb(entity: any): number {
    const v = entity.getBattleData('senna_yakuman_prob');
    return v === '0.01' ? 0.01 : (v ? parseFloat(v) : 0.1);
}
function setYakumanProb(entity: any, p: number) {
    entity.setData('senna_yakuman_prob', String(p));
}

/**
 * 技能1：乱打
 * 0火，主动技能
 * 对单体目标造成1次攻击力125%的伤害；若目标带有【数据流】标签，则无视其防御。
 */
export const esao_kaori_skill1: Skill = {
    no: 1,
    name: '乱打',
    passive: false,
    cost: 0,
    target: SkillTarget.ENEMY,
    text: '对单体目标造成攻击力125%的伤害；若目标带有【数据流】标签，则无视其防御。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        const target = battle.getEntity(selectedId);
        if (!target) return;

        const ignoreDef = hasLabel(target, '数据流');

        const builder = Attack.build(selectedId, sourceId)
            .rate(1.25)
            .shouldComputeCri()
            .single()
            .skill('乱打');
        // 目标带【数据流】标签时无视防御（真实伤害天然无视防御）
        if (ignoreDef) builder.param(AttackParams.REAL);

        battle.actionAttack(builder.end());

        if (ignoreDef) {
            battle.log(`【${source.name}】的【乱打】无视【${target.name}】（数据流）的防御`);
        }
    },
};

/**
 * 技能2：新手强运
 * 被动技能
 * 自身与概率相关的判定均进行两次独立判定，取较优的一次执行：
 *  - 自身受到控制效果时，按效果抵抗进行两次判定取好决定是否免疫；
 *  - 自身主动技能的概率发动（如役满打击）同样两次判定取好。
 */
export const esao_kaori_skill2: Skill = {
    no: 2,
    name: '新手强运',
    passive: true,
    cost: 0,
    reserveValid: true,
    text: '被动技能。自身与概率相关的判定均进行两次独立判定，取较优的一次执行：受到控制效果时按效果抵抗两次判定取好决定是否免疫；自身主动技能的概率发动（如役满打击）同样两次判定取好。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const self = battle.getEntity(data.skillOwnerId);
                if (!self || self.dead) return -1;

                const proc = data.data as AddBuffProcessing;
                const buff = proc && proc.buff;
                if (!buff || !buff.hasParam(BuffParams.CONTROL)) return -1;

                // 受控概率事件：以效果抵抗为基准，两次判定取好
                const res = battle.getComputedProperty(self.entityId, 'eft_res') as number;
                const resisted = doubleTestHit(res);
                if (resisted) {
                    proc.cancel = true;
                    battle.log(`【${self.name}】触发【新手强运】，两次判定取好，免疫控制效果`);
                }
                return -1;
            },
            code: EventCodes.BEFORE_BUFF_GET,
            range: EventRange.SELF,
            priority: 0,
            passive: true,
            name: '新手强运·受控抵抗',
        },
    ],
};

/**
 * 技能3：役满打击
 * 3火，主动技能
 * 10%概率对敌方全体造成总计32000点真实伤害（按敌方人数平分）；
 * 未发动则不消耗鬼火，发动成功后发动概率降为1%。
 */
export const esao_kaori_skill3: Skill = {
    no: 3,
    name: '役满打击',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '3点能量。10%概率对敌方全体造成总计32000点真实伤害（按敌方人数平分）；未发动则不消耗能量，发动成功后发动概率降为1%。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        const prob = getYakumanProb(source);
        // 两次判定取好（新手强运）
        const trigger = doubleTestHit(prob);

        if (!trigger) {
            // 未发动：返还已扣除的3点能量
            battle.actionUpdateEnergy(sourceId, source.teamId, 3, Reasons.SKILL);
            battle.log(`【${source.name}】的【役满打击】未发动（概率${Math.round(prob * 100)}%），不消耗能量`);
            return;
        }

        const enemies = battle.getTeamEntities(1 - source.teamId).filter(e => !e.dead);
        if (enemies.length === 0) {
            battle.actionUpdateEnergy(sourceId, source.teamId, 3, Reasons.SKILL);
            battle.log(`【${source.name}】的【役满打击】无敌方可打击，不消耗能量`);
            return;
        }

        const perTarget = Math.floor(32000 / enemies.length);
        const attackInfos = enemies.map(enemy =>
            Attack.build(enemy.entityId, sourceId)
                .base(() => perTarget)
                .rate(1)
                .real()
                .single()
                .skill('役满打击')
                .noShare()
                .end()
        );
        battle.actionAttack(attackInfos);

        // 发动成功：概率降为1%
        setYakumanProb(source, 0.01);
        battle.log(`【${source.name}】发动【役满打击】，对${enemies.length}名敌人各造成${perTarget}点真实伤害，后续发动概率降为1%`);
    },
};
