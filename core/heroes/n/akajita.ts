import {
    Attack,
    AttackParams,
    BattleProperties,
    Buff,
    Battle,
    EffectTypes,
    Reasons,
    Skill
} from '../../';
import NormalAttack from '../common/normal-attack';
import BuffSkill from '../common/buff-skill';
import {AttackProcessing} from "../../tasks";
import {SkillTarget} from "../../skill";

/**
 * 赤舌技能1：海扁
 * 普通攻击技能
 */
export const akajita_skill1 = new NormalAttack('海扁');
akajita_skill1.text = '用舌头猛击敌方目标，造成攻击125%的伤害。';
akajita_skill1.target = SkillTarget.ENEMY;

/**
 * 赤舌技能2：鼓舞
 * 为己方队伍成员添加速度和暴击增益
 */
export const akajita_skill2 = new BuffSkill(2, '鼓舞', 2, (_, sourceId, targetId) => [
    // 速度增益buff
    Buff.build(sourceId, targetId)
        .name('鼓舞[速]')
        .countDown(2) // 持续2回合
        .buffAP(BattleProperties.SPD, EffectTypes.FIXED, 15) // 固定增加15点速度
        .end(),
    // 暴击增益buff
    Buff.build(sourceId, targetId)
        .name('鼓舞[暴]')
        .countDown(2) // 持续2回合
        .buffAP(BattleProperties.CRI, EffectTypes.FIXED, 0.11) // 固定增加11%暴击
        .end()
]);
akajita_skill2.text = '鼓舞一名友方目标，使其速度增加15点，暴击率增加11%，持续2回合。消耗2点鬼火。';

/**
 * 赤舌技能3：风鼓雷
 * 群体攻击技能，有概率降低敌方行动条
 */
export const akajita_skill3: Skill = {
    no: 3, // 技能编号
    cost: 3, // 技能消耗
    name: '风鼓雷', // 技能名称
    target: SkillTarget.ENEMY, // 目标类型为敌方
    text: '召唤风雷攻击敌方全体2次，每次造成攻击72%的伤害，并有30%概率降低目标行动条。消耗3点鬼火。',
    use(battle: Battle, sourceId: number, selectedId: number): number {
        // 获取目标实体
        const selected = battle.getEntity(selectedId);
        // 获取目标所在队伍的所有实体
        const entities = battle.getTeamEntities(selected.teamId);
        
        /**
         * 攻击完成回调函数
         * @param battle 战斗实例
         * @param data 攻击处理数据
         * @returns 处理结果
         * @description 每次攻击后有30%概率降低目标1点行动条
         */
        function computed(battle: Battle, data: AttackProcessing): number {
            const attack = data.attacks[data.index];
            if (!attack) return 0;
            // 30%概率触发
            if (battle.testHit(0.3) && attack.targetId) {
                // 降低目标1点行动条
                battle.actionUpdateRunwayPercent(sourceId, attack.targetId, -1, Reasons.SKILL);
            }
            return -1;
        }
        
        // 执行2次群体攻击
        for (let i = 0; i < 2; i++) {
            // 为每个敌方单位创建攻击实例
            const attacks: Attack[] = entities.map(e => Attack.build(e.entityId, sourceId)
                .rate(0.72) // 伤害倍率0.72
                .shouldComputeCri() // 启用暴击计算
                .group() // 群体攻击
                .completed(computed) // 设置攻击完成回调
                .end()
            );
            // 执行攻击，失败则返回0
            if (!battle.actionAttack(attacks)) return 0;
        }
        return -1;
    },
};

