/**
 * 实体系统核心类
 * 负责管理游戏中的实体，包括选手、召唤物等
 */
import Battle from './battle';
import {forEach, isNil, values} from 'lodash';
import Skill, {SelectableSkill, SkillSelection} from './skill';
import {BattleProperties} from './constant';
import {TurnProcessing} from "./tasks";
import {Mana} from "./index";

// 实体计数器，用于生成唯一的实体ID
let entityCounter = 0;

/**
 * AI 函数类型
 * @param battle 战斗对象
 * @param turnData 回合数据
 * @param mana 鬼火对象
 * @param selections 可选技能列表
 * @returns 技能选择或null
 */
export type AI = (battle: Battle, turnData: TurnProcessing, mana: Mana | null, selections: SelectableSkill[]) =>  SkillSelection| null

/**
 * 实体类
 * 游戏中所有可交互对象的基类，包括选手、召唤物等
 */
export default class Entity {
    static no: number = 0; // 静态属性，用于记录实体编号
    no: number; // 实体编号
    entityId: number; // 实体唯一ID
    teamId: number; // 队伍ID
    tags: string[]; // 实体标志，用于识别实体
    properties: Map<string, number>; // 基础属性，最大生命、攻击等
    hp: number; // 当前生命值
    name: string; // 实体名称
    dead: boolean; // 是否死亡
    lv: number; // 等级
    skills: Skill[]; // 技能列表
    rank: string; // 稀有度
    battleData: Map<string, string>; // 战斗数据，用于记录战斗中的临时数据
    turnData: Map<string, string>; // 回合数据，每个回合开始时会被清空
    summonToken: boolean; // 是否是召唤物
    waitInput: boolean; // 是否需要手动输入
    soulId: string | null; // 御魂ID（兼容旧版本）
    soulIds: string[]; // 御魂ID数组（支持多个御魂）
    buffs: any[]; // buff列表
    position: number; // 最佳位置坐标

    /**
     * 构造函数
     */
    constructor() {
        this.entityId = ++entityCounter; // 生成唯一ID
        this.properties = new Map(); // 初始化属性映射
        this.teamId = -1; // 初始队伍ID为-1（无队伍）
        this.tags = []; // 初始化标签数组
        this.hp = 1; // 初始生命值
        this.no = 0; // 初始编号
        this.name = '<Unknown>'; // 初始名称
        this.dead = false; // 初始状态为存活
        this.lv = 0; // 初始等级
        this.skills = []; // 初始化技能列表
        this.rank = ''; // 初始稀有度
        this.battleData = new Map(); // 初始化战斗数据
        this.turnData = new Map(); // 初始化回合数据
        this.summonToken = false; // 初始不是召唤物
        this.waitInput = false; // 初始不需要手动输入
        this.soulId = null; // 初始无御魂
        this.soulIds = []; // 初始无御魂数组
        this.buffs = []; // 初始化buff列表
        this.position = -1; // 初始最佳位置为-1
        // 初始化所有属性为0
        forEach(values(BattleProperties), (key: string) => {
            this.setProperty(key, 0);
        });
        // 设置默认属性值
        this.setProperty(BattleProperties.MAX_HP, 1);
    }

    /**
     * 添加buff
     * @param buff buff对象
     */
    addBuff(buff: any) {
        this.buffs.push(buff);
    }

    /**
     * 移除buff
     * @param buff buff对象
     */
    removeBuff(buff: any) {
        const index = this.buffs.indexOf(buff);
        if (index !== -1) {
            this.buffs.splice(index, 1);
        }
    }

    /**
     * 获得实体存储的附加数据
     * @param key 键名
     * @returns 返回数据，对应key不存在返回null
     */
    getBattleData(key: string): string | null {
        return this.battleData.get(key) || null;
    }

    /**
     * 设置实体存储的附加数据
     * 主要用于选手记录一些临时数据
     * @param key 键名
     * @param value 值，为null时删除该键
     * @returns 是否操作成功
     */
    setData(key: string, value: string | null): boolean {
        if (value === null) {
            return this.battleData.delete(key);
        }
        this.battleData.set(key, value);
        return true;
    }

    /**
     * 获得实体存储的回合数据
     * 该数据表会在每次正式回合开始时被清空
     * @param key 键名
     * @returns 返回数据，对应key不存在返回null
     */
    getTurnData(key: string): string | null {
        return this.turnData.get(key) || null;
    }

    /**
     * 设置实体存储的回合数据
     * 该数据表会在每次正式回合开始时被清空，主要用于选手记录一些临时数据
     * 比如记录本回合内是否有人死亡，比如犬神记录本回合有没有人砍了队友
     * @param key 键名
     * @param value 值，为null时删除该键
     * @returns 是否操作成功
     */
    setTurnData(key: string, value: string | null): boolean {
        if (value === null) {
            return this.turnData.delete(key);
        }
        this.turnData.set(key, value);
        return true;
    }

    /**
     * 添加技能
     * @param skill 技能对象
     */
    addSkill(skill: Skill) {
        this.skills.push(skill);
    }

    /**
     * 添加标签
     * @param tag 标签名称
     */
    addTags(tag: string) {
        if (!this.hasTag(tag)) {
            this.tags.push(tag);
        }
    }

    /**
     * 移除标签
     * @param tag 标签名称
     */
    removeTags(tag: string) {
        const index = this.tags.indexOf(tag);

        if (index !== -1) {
            this.tags.splice(index, 1);
        }
    }

    /**
     * 检查是否有指定标签
     * @param tag 标签名称
     * @returns 是否有该标签
     */
    hasTag(tag: string): boolean {
        return this.tags.includes(tag);
    }

    /**
     * 获取属性值
     * @param name 属性名称
     * @returns 属性值，不存在返回0
     */
    getProperty(name: string): number {
        const origin = this.properties.get(name);

        if (isNil(origin)) return 0;
        return origin;
    }

    /**
     * 检查是否有指定属性
     * @param name 属性名称
     * @returns 是否有该属性
     */
    hasProperty(name: string): boolean {
        return this.properties.has(name);
    }

    /**
     * 设置属性值
     * @param name 属性名称
     * @param value 属性值，默认为0
     */
    setProperty(name: string, value = 0) {
        this.properties.set(name, value);
    }

    /**
     * 设置队伍ID
     * @param teamId 队伍ID
     */
    setTeam(teamId: number) {
        this.teamId = teamId;
    }

    /**
     * 设置名称
     * @param name 名称
     */
    setName(name: string) {
        this.name = name;
    }

    /**
     * 同步hp到原始最大生命值
     */
    syncHp() {
        this.hp = this.getProperty(BattleProperties.MAX_HP);
    }

    /**
     * AI函数，用于自动选择技能
     * 默认为选择第一个技能，目标为第一个目标
     */
    ai: AI = () =>({ no: 0, targetId: 0});

    /**
     * 根据编号获取技能
     * @param no 技能编号
     * @returns 技能对象
     * @throws 技能不存在时抛出错误
     */
    getSkill(no: number): Skill {
        const ret = this.skills.find(s => s.no === no);
        if(!ret) throw Error('Cannot found skill, no = ' + no);
        return ret;
    }

}
