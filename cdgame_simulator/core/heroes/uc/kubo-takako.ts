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
    HeroData,
} from '../../';
import {SkillTarget} from '../../skill';

const FINANCE_LABEL = '理财';
const FINANCE_TEAM_KEY = 'kubo_finance_count';

// 是否带【理财】标签
function hasFinanceLabel(entity: any): boolean {
    const heroInfo = HeroData.find((d: any) => Number(d.index) === entity.no);
    if (!heroInfo || !heroInfo.label) return false;
    return heroInfo.label.split('，').includes(FINANCE_LABEL);
}

// 取己方指定位置的存活实体
function getAllyByPosition(battle: Battle, teamId: number, position: number) {
    const field = battle.fields[teamId] || [];
    const id = position >= 0 && position <= 5 && field[position] > 0 ? field[position] : 0;
    return id > 0 ? battle.getEntity(id) : null;
}

/**
 * 技能1：职业布局
 * 0火，主动技能（仅教练位可用）
 * 先锋攻防提升20%，中坚与大将攻击提升10%，持续2回合。
 */
export const kubo_takako_skill1: Skill = {
    no: 1,
    name: '职业布局',
    passive: false,
    cost: 0,
    target: SkillTarget.SELF,
    text: '仅教练位可用。使先锋攻防提升20%，中坚与大将攻击提升10%，持续2回合。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        if (source.position !== 0) {
            battle.log(`【${source.name}】不在教练位置，无法使用【职业布局】`);
            return;
        }

        const teamId = source.teamId;

        // 先锋（位置1）：攻防 +20%
        const vanguard = getAllyByPosition(battle, teamId, 1);
        if (vanguard) {
            const buff = Buff.build(sourceId, vanguard.entityId)
                .name('职业布局·先锋', 1)
                .countDown(2)
                .buff()
                .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.2)
                .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.2)
                .end();
            battle.actionAddBuff(buff, Reasons.SKILL);
        }

        // 中坚（位置3）、大将（位置5）：攻击 +10%
        [3, 5].forEach(pos => {
            const ally = getAllyByPosition(battle, teamId, pos);
            if (!ally) return;
            const buff = Buff.build(sourceId, ally.entityId)
                .name('职业布局·攻击', 1)
                .countDown(2)
                .buff()
                .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.1)
                .end();
            battle.actionAddBuff(buff, Reasons.SKILL);
        });

        battle.log(`【${source.name}】发动【职业布局】：先锋攻防+20%，中坚/大将攻击+10%（持续2回合）`);
    },
};

/**
 * 技能2：投注理财
 * 被动技能
 * 统计本方带【理财】标签的选手数量；比赛结算勾玉时，每有1名理财选手本方勾玉增加10%。
 * （注：勾玉结算位于赛后经济层 src/，战斗核心无对应事件；此处统计人数并写入战斗标记，
 *   若需真正影响勾玉，需在 src/utils/schedule.ts 的赛后结算中读取该标记。）
 */
export const kubo_takako_skill2: Skill = {
    no: 2,
    name: '投注理财',
    passive: true,
    cost: 0,
    reserveValid: true,
    text: '被动技能。统计本方带【理财】标签的选手数量；比赛结算勾玉时，每有1名理财选手，本方勾玉增加10%。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return -1;
                const self = battle.getEntity(data.skillOwnerId);
                if (!self || self.dead) return -1;

                const teamEntities = battle.getTeamEntities(self.teamId);
                let count = 0;
                teamEntities.forEach(e => {
                    if (!e.dead && hasFinanceLabel(e)) count++;
                });

                self.setData(FINANCE_TEAM_KEY, String(count));
                battle.log(`【${self.name}】的【投注理财】：本方理财选手 ${count} 名，赛后勾玉+${count * 10}%`);
                return -1;
            },
            code: EventCodes.BATTLE_START,
            range: EventRange.TEAM,
            priority: 0,
            passive: true,
            name: '投注理财',
        },
    ],
};

/**
 * 技能3：巴掌激励
 * 2火，主动技能
 * 对己方大将选手造成1000点真实伤害，并使其行动条立刻提升100%。
 */
export const kubo_takako_skill3: Skill = {
    no: 3,
    name: '巴掌激励',
    passive: false,
    cost: 2,
    target: SkillTarget.TEAM,
    text: '对己方大将选手造成1000点真实伤害，并使其行动条立刻提升100%。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;

        const general = getAllyByPosition(battle, source.teamId, 5);
        if (!general || general.dead) {
            battle.log(`【${source.name}】的【巴掌激励】未找到己方大将选手`);
            return;
        }

        // 1000点真实伤害（不暴击、无视防御）
        battle.actionAttack(
            Attack.build(general.entityId, sourceId)
                .base(() => 1000)
                .rate(1)
                .real()
                .single()
                .skill('巴掌激励')
                .noShare()
                .end()
        );

        // 行动条立刻 +100%
        battle.actionUpdateRunwayPercent(sourceId, general.entityId, 1.0, Reasons.SKILL);

        battle.log(`【${source.name}】对【${general.name}】使用【巴掌激励】，造成1000点真实伤害并使其行动条+100%`);
    },
};
