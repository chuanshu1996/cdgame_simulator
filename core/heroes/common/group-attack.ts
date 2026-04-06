import {Attack, AttackParams, Battle, Handler, Skill} from '../../';
import {SkillTarget} from "../../skill";

/**
 * 群体多段攻击技能类
 * 实现Skill接口，用于创建可以触发暴击的群体伤害技能
 */
export default class GroupAttack implements Skill {
    /** 技能编号 */
    no: number;
    /** 技能处理器数组 */
    handlers: Handler[] = [];
    /** 是否为被动技能 */
    passive: boolean = false;
    /** 技能名称 */
    name: string;
    /** 技能描述 */
    text?: string;
    /** 伤害倍率 */
    rate: number;
    /** 攻击次数 */
    times: number;
    /** 技能消耗 */
    cost: number;
    /** 技能目标类型，默认为敌方 */
    target: SkillTarget = SkillTarget.ENEMY;

    /**
     * 构造函数
     * @param no 技能编号
     * @param name 技能名称
     * @param rate 伤害倍率
     * @param cost 技能消耗
     * @param times 攻击次数，默认为1
     */
    constructor(no: number, name: string, rate: number, cost: number, times: number = 1) {
        this.no = no;
        this.name = name;
        this.cost = cost;
        this.rate = rate;
        this.times = times;
    }

    /**
     * 使用技能
     * @param battle 战斗实例
     * @param sourceId 技能释放者ID
     * @param selectedId 目标ID
     * @description 根据攻击次数创建多个群体攻击，每次攻击都会计算暴击
     */
    use(battle: Battle, sourceId: number, selectedId: number) {
        // 获取目标实体
        const selected = battle.getEntity(selectedId);
        // 获取目标所在队伍的所有实体
        const entities = battle.getTeamEntities(selected.teamId);

        // 循环创建指定次数的群体攻击
        for (let i = 0; i < this.times; i++) {
            // 为每个目标创建攻击实例
            const infos = entities.map(e => Attack.build(e.entityId, sourceId)
                .rate(this.rate) // 设置伤害倍率
                .shouldComputeCri() // 启用暴击计算
                .group() // 群体攻击
                .skill(this.name) // 设置技能名称
                .end() // 完成构建
            );
            // 执行攻击
            battle.actionAttack(infos);
        }
    }
}
