/**
 * 战斗系统核心类
 * 负责管理整个战斗流程，包括实体管理、回合制战斗、技能释放、 buff 处理等
 */
import {filter, forEach, isArray, some} from 'lodash';
import Entity from './entity';
import Mana from './mana';
import Runway from './runway';
import {BuffParams, Control, EventCodes, EventRange, Reasons, BattleProperties} from './constant';
import {SoulManager} from './soul';
import {HeroBuilders} from './heroes';
import Skill, {SelectableSkill} from './skill';
import {MersenneTwister19937, Random} from 'random-js';
import Buff, {Effect, EffectTypes} from './buff';
import Task, {Processor} from './task';
import {
    AddBuffProcessing,
    addBuffProcessor,
    AttackProcessing,
    attackProcessor,
    battleProcessor,
    EventProcessing,
    eventProcessor, RealEventData,
    RemoveBuffProcessing,
    removeBuffProcessor,
    // UpdateHpProcessing,
    // updateHpProcessor,
    updateManaProcessor,
    UpdateManaProgressProcessing,
    updateManaProcessProcessor,
    UpdateRunWayProcessing,
    UseSkillProcessing,
    useSkillProcessor,
    UpdateNanaProcessing,
    FakeTurnProcessing,
    updateRunwayProcessor,
} from "./tasks";
import Attack from "./attack";
import healingProcessor, {HealingProcessing} from './tasks/healing';
import {Healing} from './index';
import {JudgeFlagManager, triggerJudgeKingAction} from './judge-flag';

/**
 * 初始化数据接口
 * 用于创建战斗实体时的配置信息
 */
interface InititalData {
    no: number; // 选手编号
    teamId: number; // 队伍ID（0或1）
    lv?: number; // 等级
    equipments?: number[]; // 装备
    max_hp?: number; // 最大生命值
    atk?: number; // 攻击力
    def?: number; // 防御力
    spd?: number; // 速度
    cri?: number; // 暴击率
    cri_dmg?: number; // 暴击伤害
    eft_hit?: number; // 效果命中
    eft_res?: number; // 效果抵抗
    waitInput?: boolean; // 是否需要手动输入
    soulId?: string | null; // 御魂ID（兼容旧版本）
    soulIds?: string[]; // 御魂ID数组（支持多个御魂）
    index?: number; // 在队伍中的位置索引（0-7）
    isReserve?: boolean; // 是否为替补/应援位置（不上场但可触发被动技能）
}

export type BattleLogType = 'damage' | 'heal' | 'skill' | 'buff' | 'death' | 'turn' | 'info';

export interface BattleLog {
    type: BattleLogType;
    message: string;
    time: string;
    data?: any;
}

export interface PendingDamageLog {
    sourceId: number;
    sourceName: string;
    skillName: string;
    targetId: number;
    targetName: string;
    totalDamage: number;
    hitCount: number;
    criticalCount: number;
}

export interface PendingBuffLog {
    sourceId: number;
    sourceName: string;
    targetId: number;
    targetName: string;
    buffName: string;
    stackCount: number;
    maxCount?: number;
    effect?: any;
}

/**
 * 战斗类
 * 管理整个战斗流程，包括实体、技能、buff、回合等
 */
export default class Battle {
    output: object[]; // 游戏记录
    seed: number; // 随机种子
    manas: Mana[]; // 鬼火信息数组，每个队伍一个
    runway: Runway; // 行动条位置管理
    currentId: number; // 当前回合实体ID
    fields: number[][]; // 场上位置，二维数组，每个队伍一个数组
    fieldSize: number; // 场地大小
    turn: number; // 当前回合数
    entities: Map<number, Entity>; // 实体列表，键为实体ID
    isEnd: boolean; // 是否游戏结束
    winner: number; // 获胜者ID
    random: Random; // 随机数生成器
    rootTask: Task; // 根任务节点
    currentTask: Task; // 当前处理的任务节点
    taskCounter: number; // 分配任务ID用的计数器
    buffs: Buff[]; // 所有buff列表
    fakeTurns: FakeTurnProcessing[]; // 伪回合处理列表
    eventLogs: BattleLog[]; // 战斗事件日志
    pendingDamageLogs: Map<string, PendingDamageLog>; // 待合并的伤害日志
    pendingBuffLogs: Map<string, PendingBuffLog>; // 待合并的Buff日志
    currentSkillName: string; // 当前技能名称
    battleId: number; // 战斗ID，用于裁判旗管理

    /**
     * 构造函数
     * @param datas 初始化数据数组
     * @param seed 随机种子，默认为当前时间戳
     */
    constructor(datas: InititalData[], seed = Date.now()) {
        this.isEnd = false;
        this.winner = -1;
        this.turn = 0;
        this.entities = new Map<number, Entity>();
        this.fields = [[], []];

        this.currentId = 0;
        this.output = [];

        this.seed = seed;
        this.random = new Random(MersenneTwister19937.seed(seed));
        this.runway = new Runway(() => this.random.real(0, 1));
        this.manas = [new Mana(4), new Mana(4)]; // 初始每个队伍4点鬼火
        this.buffs = [];
        this.fakeTurns = [];
        this.eventLogs = [];
        this.pendingDamageLogs = new Map();
        this.pendingBuffLogs = new Map();
        this.currentSkillName = '';
        this.fieldSize = 0;
        this.battleId = Date.now() + Math.floor(Math.random() * 10000); // 生成唯一的战斗ID

        // 初始化fields数组，预填充0（位置0-8：主力0-5，替补6，应援7，召唤位8）
        this.fields[0] = new Array(9).fill(0);
        this.fields[1] = new Array(9).fill(0);

        // 计算每个队伍的数据起始索引
        let team0Count = 0;
        let team1Count = 0;
        datas.forEach(d => {
            if (d.teamId === 0) team0Count++;
            else if (d.teamId === 1) team1Count++;
        });
        const team1StartIndex = team0Count;

        // 初始化实体
        forEach(datas, (data, arrayIndex) => {
            if (data.teamId < 0 || data.teamId > 1) {
                console.warn('存在无效实体数据，队伍id无效', data);
                return;
            }
            const builder = HeroBuilders.get(data.no);
            if (!builder) {
                console.warn('存在无效实体数据，实体no无效', data);
                return;
            }
            const entity = builder();

            entity.setTeam(data.teamId);
            entity.waitInput = !!data.waitInput;
            // 设置实体属性
            if (data.max_hp && data.max_hp >= 1 && data.max_hp <= 1e10) entity.setProperty(BattleProperties.MAX_HP, data.max_hp);
            if (data.atk && data.atk >= 0 && data.atk <= 100000) entity.setProperty(BattleProperties.ATK, data.atk);
            if (data.def && data.def >= 0 && data.def <= 100000) entity.setProperty(BattleProperties.DEF, data.def);
            if (data.spd && data.spd >= 0 && data.spd <= 1000) entity.setProperty(BattleProperties.SPD, data.spd);
            if (data.eft_hit && data.eft_hit >= 0 && data.eft_hit <= 10000) entity.setProperty(BattleProperties.EFT_HIT, data.eft_hit / 100);
            if (data.eft_res && data.eft_res >= 0 && data.eft_res <= 10000) entity.setProperty(BattleProperties.EFT_RES, data.eft_res / 100);
            if (data.cri && data.cri >= 0 && data.cri <= 10) entity.setProperty(BattleProperties.CRI, data.cri);
            if (data.cri_dmg && data.cri_dmg >= 0 && data.cri_dmg <= 10) entity.setProperty(BattleProperties.CRI_DMG, data.cri_dmg);
            
            // 先将实体添加到entities Map中，这样getComputedProperty才能找到实体
            this.entities.set(entity.entityId, entity);
            
            // 替补/应援位置的角色不加入行动条，但可以触发被动技能
            if (!data.isReserve) {
                this.runway.addEntity(entity.entityId, () => (this.getComputedProperty(entity.entityId, BattleProperties.SPD) || 0));
            } else {
                // 标记为"不上场"状态，通过设置一个特殊标记
                entity.setData('isReserve', 'true');
            }
            
            // 根据数据在数组中的位置确定fields索引
            // team0的数据在索引0到team1StartIndex-1，team1的数据在team1StartIndex之后
            const positionIndex = data.teamId === 0 
                ? arrayIndex 
                : arrayIndex - team1StartIndex;
            this.fields[entity.teamId][positionIndex] = entity.entityId;
            
            // 应用御魂效果（支持多个御魂）
            if (data.soulIds && data.soulIds.length > 0) {
                SoulManager.applySoulsToEntity(entity, data.soulIds);
            } else if (data.soulId) {
                // 兼容旧版本的单个御魂
                SoulManager.applySoulToEntity(entity, data.soulId);
            }
            
            // 同步生命值到最大（使用getComputedProperty来获取包括御魂加成在内的最大生命值）
            entity.hp = this.getComputedProperty(entity.entityId, BattleProperties.MAX_HP);
        });
        this.fieldSize = 8;
        this.taskCounter = 0;
        // 初始化根任务
        this.currentTask = this.rootTask = {
            step: 1,
            children: [],
            processor: battleProcessor,
            type: 'Battle',
            parent: null,
            data: {},
            depth: 0,
            taskId: ++this.taskCounter,
        };
    }

    /**
     * 处理战斗逻辑
     * @returns 是否继续处理
     */
    process(): boolean {
        if (this.seed === null) return false;
        if (this.isEnd) return false;

        // step === 0 出错
        // step < 0 任务结束 目前只有-1
        // step > 0 任务进行到step阶段
        if (this.currentTask.step === 0) return false;

        // 先处理子任务
        if (this.currentTask.children.length) {
            if (this.currentTask.children[0].step < 0) { // 该子任务已结束
                this.currentTask.children.shift();
                return this.process();
            }
            this.currentTask = this.currentTask.children[0]; // 切换到处理子任务
            return this.process();
        }

        if (this.currentTask.step > 0) {
            // 如果当前任务进行中
            if (this.currentTask.step === 1) this.log();
            const step = this.currentTask.processor(this, this.currentTask.data, this.currentTask.step);
            this.currentTask.step = step === void 0 ? -1 : step;
            return true;
        } else {
            // 如果当前任务已完成
            // 尝试退回到父亲任务节点
            if (!this.currentTask.parent) {
                this.isEnd = true;
                 // 确保战斗结束时正确判断胜负
                this.judgeWin();
                return false;
            }
            this.currentTask = this.currentTask.parent;
            return this.process();
        }
    }

    /**
     * 添加伪回合处理
     * @param currentId 当前实体ID
     * @param processor 处理器
     * @param data 数据
     * @returns 伪回合索引
     */
    addFakeTurn(currentId: number, processor: Processor, data: any = {}) {
        const ft = new FakeTurnProcessing(processor, data, currentId);
        const index = this.fakeTurns.findIndex(ft => ft.currentId === currentId);
        if (index !== -1) { // 同名覆盖
            this.fakeTurns.splice(index, 1);
        }

        return this.fakeTurns.push(ft);
    }

    /**
     * 添加处理器任务
     * @param processor 处理器
     * @param data 数据
     * @param type 类型
     * @returns 任务ID
     */
    addProcessor(processor: Processor, data: any = {}, type = ''): number {
        const task = {
            step: 1,
            children: [],
            processor,
            type,
            parent: this.currentTask,
            data,
            depth: this.currentTask.depth + 1,
            taskId: ++this.taskCounter,
        };
        this.currentTask.children.push(task);
        return task.taskId;
    }

    /**
     * 添加事件处理器
     * @param code 事件代码
     * @param eventId 事件实体ID
     * @param data 数据
     * @returns 任务ID
     */
    addEventProcessor(code: EventCodes, eventId: number, data?: any): number {
        const eventEntity = eventId <= 0 ? null : this.getEntity(eventId);
        const processing: EventProcessing = new EventProcessing(code);
        // 收集所有符合条件的技能处理器
        this.entities.forEach(entity => {
            const isReserve = entity.getBattleData('isReserve') === 'true';
            
            forEach(entity.skills, (skill: Skill) => {
                // 替补/应援位置的角色，只有标记了reserveValid的被动技能才参与事件处理
                if (isReserve && !(skill.reserveValid && skill.passive)) return;
                
                forEach(skill.handlers, handler => {
                    if (handler.code !== code) return;
                    if (eventId > 0 && eventEntity) {
                        if (handler.range === EventRange.SELF) {
                            if (eventId !== entity.entityId) return;
                        }
                        if (handler.range === EventRange.TEAM) {
                            if (eventEntity.teamId !== entity.teamId) return;
                        }
                        if (handler.range === EventRange.ENEMY) {
                            if (eventEntity.teamId == entity.teamId) return;
                        }
                    }
                    processing.units.push(new RealEventData(entity.entityId, skill.no, eventId, handler, data));
                });
            });
        });

        // 按优先级排序
        processing.units.sort((a, b) => {
            return a.handler.priority - b.handler.priority;
        });

        return this.addProcessor(eventProcessor, processing, `Event(${EventCodes[code]})`);
    }

    /**
     * 判断胜负
     * 只判断上场的前6个位置（不包括替补和应援）
     */
    judgeWin() {
        const entityCounter: [number, number] = [0, 0];
        
        // 只检查前6个位置（上场角色），不包括替补(位置6)和应援(位置7)
        for (let teamId = 0; teamId < 2; teamId++) {
            const field = this.fields[teamId];
            for (let pos = 0; pos < 6; pos++) {
                const entityId = field[pos];
                if (entityId) {
                    const entity = this.getEntity(entityId);
                    if (entity && !entity.dead) {
                        entityCounter[teamId]++;
                    }
                }
            }
        }
        
        if (entityCounter[0] === 0 && entityCounter[1] > 0) {
            // 战斗结束前刷新所有待合并的日志
            this.flushPendingDamageLogs();
            this.flushPendingBuffLogs();
            // 添加战斗结束日志
            this.addEventLog('info', `战斗结束！队伍2获胜！`);
            this.isEnd = true;
            this.winner = 1;
        } else if (entityCounter[0] > 0 && entityCounter[1] === 0) {
            // 战斗结束前刷新所有待合并的日志
            this.flushPendingDamageLogs();
            this.flushPendingBuffLogs();
            // 添加战斗结束日志
            this.addEventLog('info', `战斗结束！队伍1获胜！`);
            this.isEnd = true;
            this.winner = 0;
        } else if (entityCounter[0] === 0 && entityCounter[1] === 0) {
            // 战斗结束前刷新所有待合并的日志
            this.flushPendingDamageLogs();
            this.flushPendingBuffLogs();
            // 添加战斗结束日志
            this.addEventLog('info', `战斗结束！双方平局！`);
            this.isEnd = true;
            this.winner = 0; // 平局时默认队伍1获胜
        }
        
        // 清理裁判旗
        if (this.isEnd) {
            JudgeFlagManager.getInstance().clearJudgeFlag(this);
        }
    }

    /**
     * 清理裁判旗
     */
    clearJudgeFlag() {
        JudgeFlagManager.getInstance().clearJudgeFlag(this);
    }
    
    /**
     * 触发裁决鬼王行动
     * 用于模拟裁判旗机制
     */
    triggerJudgeKingAction() {
        triggerJudgeKingAction(this);
    }
    
    /**
     * 获取实体
     * @param entityId 实体ID
     * @returns 实体对象
     */
    getEntity(entityId: number): Entity {
        const ret = this.entities.get(entityId);
        if (!ret) {
            // 实体不存在，返回一个默认实体
            console.warn(`Cannot found entity, id = ${entityId}`);
            // 创建一个默认实体
            const defaultEntity = new Entity();
            defaultEntity.setTeam(-1);
            defaultEntity.dead = true;
            return defaultEntity;
        }
        return ret;
    }

    /**
     * 获取队伍实体列表
     * @param teamId 队伍ID
     * @returns 实体数组
     */
    getTeamEntities(teamId: number): Entity[] {
        const ret: Entity[] = [];
        forEach(this.fields[teamId], entity_id => {
            if (entity_id) {
                ret.push(this.getEntity(entity_id));
            }
        });
        return ret;
    }

    /**
     * 获取敌人列表
     * @param entityId 实体ID
     * @returns 敌人实体数组
     */
    getEnemies(entityId: number): Entity[] {
        const entity = this.getEntity(entityId);
        const teamId = entity.teamId;
        const isConfusion = this.hasBuffByControl(entity.entityId, Control.CONFUSION);

        const ret: Entity[] = [];

        this.entities.forEach((e: Entity) => {
            if (e.entityId === entityId) return; // 自己不是自己的敌人
            if (e.dead) return; // 跳过死亡单位
            if (e.teamId < 0 || e.teamId > 1) return; // 过滤非玩家单位
            if (!isConfusion && e.teamId === teamId) return; // 不是混乱状态下不能打自己人
            // 使用角色在fields数组中的实际位置索引，而不是默认最佳位置属性
            const actualPosition = this.fields[e.teamId].indexOf(e.entityId);
            if (actualPosition < 0 || actualPosition > 5) return; // 只攻击教练0和主力角色（先锋1-大将5），过滤替补6和应援7
            ret.push(e);
        });

        return ret;
    }

    /**
     * 测试命中概率
     * @param p 概率值（0-1）
     * @returns 是否命中
     */
    testHit(p: number): boolean {
        return this.random.real(0, 1) <= p;
    }

    /**
     * 从数组中随机选择一个元素
     * @param arr 数组
     * @returns 随机选中的元素
     */
    getRandomOne<T>(arr: T[]): T {
        return arr[this.random.integer(0, arr.length - 1)];
    }

    /**
     * 获取随机敌人
     * @param entityId 实体ID
     * @returns 随机敌人实体或null
     */
    getRandomEnemy(entityId: number): Entity | null {
        const list: Entity[] = this.getEnemies(entityId);
        if (!list.length) return null;

        return list[this.random.integer(0, list.length - 1)] || null;
    }

    /**
     * 获取计算后的属性值
     * @param entityId 实体ID
     * @param name 属性名称
     * @returns 计算后的属性值
     */
    getComputedProperty(entityId: number, name: string): number {
        const entity = this.getEntity(entityId);
        const origin = entity.properties.get(name);
        if (origin === undefined) throw new Error(`Cannot found property in entity which id=${entityId} named by ${name}`);
        // 过滤出影响该属性的effect
        const effects: Effect[] = [];
        
        // 1. 从战斗的buffs数组中获取buff效果
        this.buffs.forEach((buff: Buff) => {
            if (buff.ownerId !== entityId && !(buff.ownerId === entity.teamId - 2 || buff.ownerId === -3)) return; // 不是全局buff或者是持有的buff，忽略    -2 表示队伍0   -1 表示队伍1   -3表示双方队伍
            if (!buff.hasParam(BuffParams.AFFECT_PROPERTY)) return; // 不影响属性的buff跳过
            if (!buff.effects || buff.effects.length === 0) return; // 未提供effects属性跳过
            
            // 检查依赖条件
            if (buff.hasParam(BuffParams.DEPEND_ON)) {
                if (this.buffs.every(b =>
                    b.buffId !== buff.dependBuffId && !(b.ownerId === buff.dependEntityId && b.name === buff.dependBuffName)  // 依赖 不存在
                )) {
                    return;
                }
            }
            
            // 遍历所有效果，将影响该属性的效果添加到列表中
            buff.effects.forEach(effect => {
                if (effect.propertyName === name) {
                    effects.push(effect);
                }
            });
        });
        
        // 2. 从实体自己的buffs数组中获取buff效果（例如御魂的属性加成）
        entity.buffs.forEach((buff: any) => {
            if (!buff.hasParam || !buff.hasParam(BuffParams.AFFECT_PROPERTY)) return; // 不影响属性的buff跳过
            if (!buff.effects || buff.effects.length === 0) return; // 未提供effects属性跳过
            
            // 遍历所有效果，将影响该属性的效果添加到列表中
            buff.effects.forEach((effect: any) => {
                if (effect.propertyName === name) {
                    effects.push(effect);
                }
            });
        });

        // 按效果类型分组，确保计算顺序：SET > FIXED > ADD_RATE > MAX/MIN
        const setEffects = effects.filter(e => e.effectType === EffectTypes.SET);
        const fixedEffects = effects.filter(e => e.effectType === EffectTypes.FIXED);
        const rateEffects = effects.filter(e => e.effectType === EffectTypes.ADD_RATE);
        const maxEffects = effects.filter(e => e.effectType === EffectTypes.MAX);
        const minEffects = effects.filter(e => e.effectType === EffectTypes.MIN);

        // 1. SET类型：直接设置值（取最后一个SET效果）
        let result = origin;
        if (setEffects.length > 0) {
            result = setEffects[setEffects.length - 1].value;
        }

        // 2. FIXED类型：固定值增减
        fixedEffects.forEach(e => {
            result += e.value;
        });

        // 3. ADD_RATE类型：百分比增减（基于原始值计算）
        rateEffects.forEach(e => {
            result += origin * e.value;
        });

        // 4. MAX类型：取最大值
        maxEffects.forEach(e => {
            result = Math.max(result, e.value);
        });

        // 5. MIN类型：取最小值
        minEffects.forEach(e => {
            result = Math.min(result, e.value);
        });

        return result;
    }

    /**
     * 检查是否可以消耗鬼火
     * @param teamId 队伍ID
     * @param count 消耗数量
     * @returns 是否可以消耗
     */
    canCost(teamId: number, count: number): boolean {
        if (teamId < 0 || teamId > 1) return false;

        return this.manas[teamId].num >= count;
    }

    /**
     * 获取队伍鬼火
     * @param teamId 队伍ID
     * @returns 鬼火对象
     */
    getMana(teamId: number): Mana {
        if (!this.manas[teamId]) throw new Error('Cannot get mana by teamId = ' + teamId);

        return this.manas[teamId];
    }

    /**
     * 根据名称过滤buff
     * @param ownerId 所有者ID
     * @param name buff名称
     * @returns buff数组
     */
    filterBuffByName(ownerId: number, name: string): Buff[] {
        return filter(this.buffs, buff => buff.ownerId === ownerId && buff.name === name);
    }

    /**
     * 根据参数过滤buff
     * @param ownerId 所有者ID
     * @param params buff参数
     * @returns buff数组
     */
    filterBuffByParam(ownerId: number, ...params: BuffParams[]): Buff[] {
        return filter(this.buffs, buff => buff.ownerId === ownerId && params.some(p => buff.params.includes(p)));
    }

    /**
     * 根据控制类型过滤buff
     * @param ownerId 所有者ID
     * @param controls 控制类型
     * @returns buff数组
     */
    filterBuffByControl(ownerId: number, ...controls: Control[]): Buff[] {
        return filter(this.buffs, buff => {
            return buff.ownerId === ownerId && buff.params.includes(BuffParams.CONTROL) && !!buff.control && controls.includes(buff.control)
        });
    }

    /**
     * 根据来源过滤buff
     * @param ownerId 所有者ID
     * @param sourceId 来源ID
     * @returns buff数组
     */
    filterBuffBySource(ownerId: number, sourceId: number): Buff[] {
        return filter(this.buffs, buff => {
            return buff.ownerId === ownerId && buff.sourceId === sourceId;
        });
    }

    /**
     * 检查是否有指定名称的buff
     * @param ownerId 所有者ID
     * @param name buff名称
     * @returns 是否存在
     */
    hasBuffByName(ownerId: number, name: string): boolean {
        return some(this.buffs, buff => buff.ownerId === ownerId && buff.name === name);
    }

    /**
     * 检查是否有指定参数的buff
     * @param ownerId 所有者ID
     * @param params buff参数
     * @returns 是否存在
     */
    hasBuffByParam(ownerId: number, ...params: BuffParams[]): boolean {
        return some(this.buffs, buff => buff.ownerId === ownerId && params.some(p => buff.params.includes(p)));
    }

    /**
     * 检查是否有指定控制类型的buff
     * @param ownerId 所有者ID
     * @param controls 控制类型
     * @returns 是否存在
     */
    hasBuffByControl(ownerId: number, ...controls: Control[]): boolean {
        return some(this.buffs, buff => {
            return buff.ownerId === ownerId && buff.params.includes(BuffParams.CONTROL) && !!buff.control && controls.includes(buff.control)
        });
    }

    /**
     * 执行攻击动作
     * @param attacks 攻击对象或数组
     * @returns 是否成功
     */
    actionAttack(attacks: Attack[] | Attack) {
        const ap = new AttackProcessing();
        if (!isArray(attacks)) ap.attacks = [attacks];
        else ap.attacks = attacks;
        this.addProcessor(attackProcessor, ap, 'Attack');
        return true;
    }

    /**
     * 执行治疗动作
     * @param healings 治疗对象或数组
     * @returns 是否成功
     */
    actionHeal(healings: Healing[] | Healing) {
        const hp = new HealingProcessing();
        if (!isArray(healings)) hp.healings = [healings];
        else hp.healings = healings;
        this.addProcessor(healingProcessor, hp, 'Heal');
        return true;
    }

    // actionUpdateHp(sourceId: number, targetId: number, num: number, reason: Reasons = Reasons.NOTHING) {
    //     return this.addProcessor(updateHpProcessor, new UpdateHpProcessing(sourceId, targetId, num, reason) , 'UpdateHp');
    // }

    /**
     * 执行使用技能动作
     * @param no 技能编号
     * @param sourceId 来源ID
     * @param selectedId 选中目标ID
     * @param cost 消耗鬼火
     * @param reason 原因
     */
    actionUseSkill(no: number, sourceId: number, selectedId: number, cost: number, reason: Reasons = Reasons.NOTHING) {
        this.addProcessor(useSkillProcessor, new UseSkillProcessing(no, sourceId, selectedId, cost, reason), 'UseSkill');
    }

    /**
     * 执行添加buff动作
     * @param buff buff对象
     * @param reason 原因
     */
    actionAddBuff(buff: Buff, reason: Reasons = Reasons.NOTHING) {
        this.addProcessor(addBuffProcessor, new AddBuffProcessing(buff, reason), 'AddBuff');
    }

    /**
     * 执行移除buff动作
     * @param buff buff对象
     * @param reason 原因
     */
    actionRemoveBuff(buff: Buff, reason: Reasons = Reasons.NOTHING) {
        this.addProcessor(removeBuffProcessor, new RemoveBuffProcessing(buff, reason), 'RemoveBuff');
    }

    /**
     * 执行更新鬼火动作
     * @param sourceId 来源ID
     * @param teamId 队伍ID
     * @param num 数量
     * @param reason 原因
     */
    actionUpdateMana(sourceId: number, teamId: number, num: number, reason: Reasons = Reasons.NOTHING) {
        this.addProcessor(updateManaProcessor, new UpdateNanaProcessing(sourceId, teamId, num, reason), 'UpdateMana');
    }

    /**
     * 执行更新鬼火进度动作
     * @param sourceId 来源ID
     * @param teamId 队伍ID
     * @param num 数量
     * @param reason 原因
     * @returns 任务ID
     */
    actionUpdateManaProgress(sourceId: number, teamId: number, num: number, reason: Reasons = Reasons.NOTHING) {
        return this.addProcessor(updateManaProcessProcessor, new UpdateManaProgressProcessing(sourceId, teamId, num, reason), 'ProcessManaProgress');
    }

    /**
     * 执行拉条动作
     * @param sourceId 来源ID
     * @param targetId 目标ID
     * @param percent 拉条百分比
     * @param reason 原因
     * @returns 任务ID
     */
    actionUpdateRunwayPercent(sourceId: number, targetId: number, percent: number, reason: Reasons = Reasons.NOTHING) {
        return this.addProcessor(updateRunwayProcessor, new UpdateRunWayProcessing(sourceId, targetId, percent, reason), 'UpdateRunwayPercent');
    }

    /**
     * 日志输出
     * @param args 日志参数
     */
    log = (...args: any[]) => {
        console.log(' '.repeat(this.currentTask.depth) + `[${this.currentTask.type || '<Unknown>'}][step${this.currentTask.step}]`, ...args);
    };

    /**
     * 添加战斗事件日志
     * @param type 日志类型
     * @param message 日志消息
     * @param data 额外数据
     */
    addEventLog(type: BattleLogType, message: string, data?: any) {
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        this.eventLogs.push({
            type,
            message,
            time,
            data
        });
    }

    /**
     * 设置当前技能名称
     * @param skillName 技能名称
     */
    setCurrentSkill(skillName: string) {
        this.currentSkillName = skillName;
    }

    /**
     * 添加伤害到待合并日志
     * @param sourceId 来源ID
     * @param sourceName 来源名称
     * @param targetId 目标ID
     * @param targetName 目标名称
     * @param damage 伤害值
     * @param isCritical 是否暴击
     * @param skillName 技能名称
     */
    addPendingDamage(sourceId: number, sourceName: string, targetId: number, targetName: string, damage: number, isCritical: boolean, skillName?: string) {
        const skill = skillName || this.currentSkillName || '普通攻击';
        const key = `${sourceId}_${targetId}_${skill}`;
        
        if (this.pendingDamageLogs.has(key)) {
            const existing = this.pendingDamageLogs.get(key)!;
            existing.totalDamage += damage;
            existing.hitCount += 1;
            if (isCritical) existing.criticalCount += 1;
        } else {
            this.pendingDamageLogs.set(key, {
                sourceId,
                sourceName,
                skillName: skill,
                targetId,
                targetName,
                totalDamage: damage,
                hitCount: 1,
                criticalCount: isCritical ? 1 : 0
            });
        }
    }

    /**
     * 刷新待合并的伤害日志到事件日志
     */
    flushPendingDamageLogs() {
        this.pendingDamageLogs.forEach((log) => {
            const critText = log.criticalCount > 0 ? `(含${log.criticalCount}次暴击)` : '';
            const hitText = log.hitCount > 1 ? `${log.hitCount}段` : '';
            const message = `${log.sourceName}使用[${log.skillName}]${hitText}对${log.targetName}造成了${Math.round(log.totalDamage)}点伤害${critText}`;
            this.addEventLog('damage', message, {
                sourceId: log.sourceId,
                targetId: log.targetId,
                damage: log.totalDamage,
                hitCount: log.hitCount,
                criticalCount: log.criticalCount
            });
        });
        this.pendingDamageLogs.clear();
    }

    /**
     * 清空待合并的伤害日志（不输出）
     */
    clearPendingDamageLogs() {
        this.pendingDamageLogs.clear();
    }

    /**
     * 添加Buff到待合并日志
     * @param sourceId 来源ID
     * @param sourceName 来源名称
     * @param targetId 目标ID
     * @param targetName 目标名称
     * @param buffName Buff名称
     * @param maxCount 最大层数
     * @param effect 效果
     */
    addPendingBuff(sourceId: number, sourceName: string, targetId: number, targetName: string, buffName: string, maxCount?: number, effect?: any) {
        const key = `${targetId}_${buffName}`;
        
        if (this.pendingBuffLogs.has(key)) {
            const existing = this.pendingBuffLogs.get(key)!;
            existing.stackCount += 1;
        } else {
            this.pendingBuffLogs.set(key, {
                sourceId,
                sourceName,
                targetId,
                targetName,
                buffName,
                stackCount: 1,
                maxCount,
                effect
            });
        }
    }

    /**
     * 刷新待合并的Buff日志到事件日志
     */
    flushPendingBuffLogs() {
        this.pendingBuffLogs.forEach((log) => {
            const stackText = log.stackCount > 1 ? `+${log.stackCount}层` : '';
            const maxText = log.maxCount && log.maxCount > 1 ? `(最大${log.maxCount}层)` : '';
            const effectText = log.effect ? 
                `效果:${log.effect.propertyName}${log.effect.value > 0 ? '+' : ''}${Math.round(log.effect.value * 100)}%` : '';
            
            const message = `${log.targetName}获得了[${log.buffName}]${stackText}${maxText}${effectText ? '，' + effectText : ''}`;
            this.addEventLog('buff', message, {
                buffName: log.buffName,
                sourceId: log.sourceId,
                targetId: log.targetId,
                stackCount: log.stackCount,
                effect: log.effect
            });
        });
        this.pendingBuffLogs.clear();
    }

    /**
     * 清空待合并的Buff日志（不输出）
     */
    clearPendingBuffLogs() {
        this.pendingBuffLogs.clear();
    }

    /**
     * 导出任务树
     * @param task 任务节点，默认为根任务
     * @returns 任务树对象
     */
    dump(task: Task | undefined): any {
        if (task === undefined) task = this.rootTask;
        return {
            step: task.step,
            children: task.children.map(c => this.dump(c)),
            type: task.type,
            data: task.data,
            depth: task.depth,
        };
    }

    /**
     * 召唤实体到指定队伍
     * @param entity 要召唤的实体
     * @param teamId 队伍ID
     */
    summonEntity(entity: Entity, teamId: number): void {
        // 检查队伍是否存在
        if (teamId < 0 || teamId >= this.fields.length) {
            return;
        }

        // 将召唤物添加到队伍的召唤位（索引8）
        const summonPosition = 8;
        if (this.fields[teamId].length <= summonPosition) {
            // 扩展数组以容纳召唤物
            while (this.fields[teamId].length <= summonPosition) {
                this.fields[teamId].push(0);
            }
        }

        // 移除该位置已有的召唤物
        const existingEntityId = this.fields[teamId][summonPosition];
        if (existingEntityId > 0) {
            const existingEntity = this.entities.get(existingEntityId);
            if (existingEntity) {
                existingEntity.dead = true;
            }
        }

        // 设置召唤物的队伍ID
        entity.setTeam(teamId);
        
        // 放置新的召唤物
        this.fields[teamId][summonPosition] = entity.entityId;
        this.entities.set(entity.entityId, entity);
        
        this.log(`召唤物【${entity.name}】已添加到队伍${teamId}的召唤位（位置8）`);
    }

    /**
     * 获取指定队伍的召唤物
     * @param teamId 队伍ID
     * @returns 召唤物实体，如果不存在则返回undefined
     */
    getSummon(teamId: number): Entity | undefined {
        // 检查队伍是否存在
        if (teamId < 0 || teamId >= this.fields.length) {
            return undefined;
        }

        // 召唤物位置是召唤位（索引8）
        const summonPosition = 8;
        if (this.fields[teamId].length <= summonPosition) {
            return undefined;
        }

        const entityId = this.fields[teamId][summonPosition];
        if (entityId <= 0) {
            return undefined;
        }

        const entity = this.entities.get(entityId);
        // 检查是否是真正的召唤物（有summonToken属性）
        if (entity && entity.summonToken) {
            return entity;
        }
        return undefined;
    }

    /**
     * 移除召唤物
     * @param teamId 队伍ID
     */
    removeSummon(teamId: number): void {
        // 检查队伍是否存在
        if (teamId < 0 || teamId >= this.fields.length) {
            return;
        }

        // 召唤物位置是召唤位（索引8）
        const summonPosition = 8;
        if (this.fields[teamId].length > summonPosition) {
            const entityId = this.fields[teamId][summonPosition];
            if (entityId > 0) {
                const entity = this.entities.get(entityId);
                if (entity && entity.summonToken) {
                    entity.dead = true;
                    this.log(`召唤物【${entity.name}】已从队伍${teamId}移除`);
                }
            }
            this.fields[teamId][summonPosition] = 0;
        }
    }

    /**
     * 获取队伍实体（包括召唤物）
     * @param teamId 队伍ID
     * @returns 队伍实体数组
     */
    getTeamEntitiesWithSummon(teamId: number): Entity[] {
        const entities: Entity[] = [];
        if (teamId < 0 || teamId >= this.fields.length) {
            return entities;
        }

        // 添加场上所有实体（包括召唤物）
        for (const entityId of this.fields[teamId]) {
            if (entityId > 0) {
                const entity = this.entities.get(entityId);
                if (entity && !entity.dead) {
                    entities.push(entity);
                }
            }
        }

        return entities;
    }

    /**
     * 获取敌人实体（包括召唤物）
     * @param entityId 实体ID
     * @returns 敌人实体数组
     */
    getEnemiesWithSummon(entityId: number): Entity[] {
        const entity = this.entities.get(entityId);
        if (!entity) {
            return [];
        }

        const enemyTeamId = entity.teamId === 0 ? 1 : 0;
        return this.getTeamEntitiesWithSummon(enemyTeamId);
    }

}
