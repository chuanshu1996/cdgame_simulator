import {Buff, Skill, Handler, Battle, Reasons} from '../../';
import { forEach, isArray } from 'lodash';
import {SkillTarget} from "../../skill";

/**
 * Buff构建函数类型
 * @param battle 战斗实例
 * @param sourceId 技能释放者ID
 * @param targetId 目标ID
 * @returns Buff实例或Buff实例数组
 */
type BuffBuilder = (battle: Battle, sourceId: number, targetId: number) => Buff[] | Buff;

/**
 * Buff技能类
 * 实现Skill接口，用于为队友添加buff效果
 */
export default class BuffSkill implements Skill {
    /** 技能编号 */
    no: number;
    /** 技能名称 */
    name: string;
    /** 技能描述 */
    text?: string;
    /** 技能消耗，可接受固定数值或函数 */
    cost: number | ((battle: Battle, entityId: number) => number);
    /** 技能处理器数组 */
    handlers: Handler[] = [];
    /** 是否为被动技能 */
    passive: boolean = false;
    /** Buff构建函数 */
    buffBuilder: BuffBuilder;
    /** 技能目标类型，默认为己方队伍 */
    target: SkillTarget = SkillTarget.TEAM;

    /**
     * 构造函数
     * @param no 技能编号
     * @param name 技能名称
     * @param cost 技能消耗
     * @param buffBuilder Buff构建函数
     */
    constructor(no: number, name: string, cost: number, buffBuilder: BuffBuilder) {
        this.no = no;
        this.name = name;
        this.cost = cost;
        this.buffBuilder = buffBuilder;
    }

    /**
     * 使用技能
     * @param battle 战斗实例
     * @param sourceId 技能释放者ID
     * @param _ 目标ID（在团队目标技能中未使用）
     * @description 为己方队伍所有成员添加buff效果
     */
    use(battle: Battle, sourceId: number, _: number) {
        // 获取技能释放者实体
        const source = battle.getEntity(sourceId);
        // 获取释放者所在队伍的所有实体
        const entities = battle.getTeamEntities(source.teamId);
        
        // 为每个队伍成员添加buff
        entities.forEach(e => {
            // 调用buff构建函数生成buff
            let buffs = this.buffBuilder(battle, sourceId, e.entityId);
            // 确保buffs是数组格式
            if (!isArray(buffs)) buffs = [buffs];
            
            // 为每个buff执行添加操作
            forEach(buffs, b => battle.actionAddBuff(b, Reasons.SKILL));
        });
    }
}
