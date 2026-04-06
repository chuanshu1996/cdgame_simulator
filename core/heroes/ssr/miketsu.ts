import {
    Attack,
    AttackParams,
    Battle,
    BattleProperties,
    Buff,
    Control,
    EffectTypes,
    EventCodes,
    EventRange, FakeTurnProcessing,
    Reasons,
    Skill
} from '../../';
import {RealEventData} from "../../tasks";
import {SkillTarget} from "../../skill";

/**
 * 虚假回合处理函数
 * @param battle 战斗实例
 * @param data 虚假回合处理数据
 * @description 处理御馔津的虚假回合逻辑，根据状态使用不同的技能
 */
function fakeTurn(battle: Battle, data: FakeTurnProcessing)  {
    const eventData: RealEventData = data.data;
    const sourceId = data.currentId; // 御馔津自己的ID
    
    if (data.confusion) { // 被混乱
        // 随机选择一个敌方目标
        const e = battle.getRandomEnemy(sourceId);
        if (e) {
            // 使用一矢·封魔技能
            battle.actionUseSkill(4, sourceId, e.entityId, 0);
        }
    } else if (data.onlyAttack) {
        // 有指定攻击目标
        battle.actionUseSkill(4, sourceId, data.onlyAttack, 0);
    } else {
        // 正常使用技能，攻击触发事件的敌方目标
        // eventData.eventId 是行动结束的敌方实体ID
        if (eventData.eventId) {
            battle.actionUseSkill(4, sourceId, eventData.eventId, 0);
        }
    }
}

/**
 * 御馔津技能1：一矢
 * 普通攻击技能，有概率触发额外回合
 */
export const miketsu_skill1: Skill = {
    no: 1, // 技能编号
    name: '一矢', // 技能名称
    target: SkillTarget.ENEMY, // 目标类型为敌方
    text: '射出箭矢攻击敌方目标，造成攻击100%的伤害。敌方行动结束后，若【狐狩界】开启则有40%概率（否则5%概率）触发【一矢·封魔】进行反击。',
    handlers: [
        {
            /**
             * 处理行动结束事件
             * @param battle 战斗实例
             * @param data 事件数据
             * @returns 处理结果
             * @description 敌方行动结束后，有概率触发额外回合
             */
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId || !data.eventId) return 0;
                // 结界启动期间提升概率
                const p = battle.hasBuffByName(data.skillOwnerId, '狐狩界') ? 0.4 : 0.05;
                const isHit = battle.testHit(p);
                if (isHit) {
                    // 添加虚假回合
                    battle.addFakeTurn(data.skillOwnerId, fakeTurn, data);
                }
                return -1;
            },
            code: EventCodes.ACTION_END, // 监听行动结束事件
            range: EventRange.ENEMY, // 敌方结束
            priority: 0,
            passive: false,
            name: '一矢判定'
        }
    ],
    cost: 0, // 技能消耗
    
    /**
     * 使用技能
     * @param battle 战斗实例
     * @param sourceId 技能释放者ID
     * @param selectedId 目标ID
     * @description 普通攻击，造成100%伤害
     */
    use(battle: Battle, sourceId: number, selectedId: number) {
        const at = Attack.build(selectedId, sourceId)
            .rate(1) // 伤害倍率100%
            .shouldComputeCri() // 启用暴击计算
            .normalAttack() // 普通攻击
            .end();
        battle.actionAttack(at);
    },
};

/**
 * 御馔津技能4：一矢·封魔
 * 隐藏技能，造成伤害并施加多种控制效果
 */
export const miketsu_skill4: Skill = {
    no: 4, // 技能编号
    name: '一矢·封魔', // 技能名称
    cost: 0, // 技能消耗
    hide: true, // 隐藏技能
    target: SkillTarget.ENEMY, // 目标类型为敌方
    text: '【隐藏技能】射出封魔之箭，对敌方目标造成攻击100%的伤害，并施加沉默、御魂压制、被动封印效果各1回合，同时降低70%治疗效果。若【狐狩界】开启，则为我方全体增加护符（防御+12%、伤害+8%、速度+4），最多叠加3层。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        // 创建攻击实例
        const at = Attack.build(selectedId, sourceId)
            .rate(1) // 伤害倍率100%
            .param(
                AttackParams.SHOULD_COMPUTE_CRI, // 触发暴击
                AttackParams.SINGLE, // 单体
                AttackParams.NORMAL_ATTACK, // 普攻
                AttackParams.NO_TARGET_EQUIPMENT, // 不触发御魂
                AttackParams.NO_TARGET_PASSIVE // 不触发被动
            )
            .end();
        battle.actionAttack(at);

        // 处理附带的四个debuff
        // 沉默效果
        const buff1 = Buff.build(sourceId, selectedId)
            .name('一矢·封魔·沉默', 1) // 同名最多1
            .countDown(1) // 倒计时1
            .control(Control.SILENT) // 沉默
            .probability(1) // 基础概率100%
            .end();
        // 御魂压制
        const buff2 = Buff.build(sourceId, selectedId)
            .name('一矢·封魔·压制', 1)
            .countDown(1)
            .control(Control.EQUIPMENT_FORBID)
            .probability(1)
            .end();
        // 被动封印
        const buff3 = Buff.build(sourceId, selectedId)
            .name('一矢·封魔·封印', 1)
            .countDown(1)
            .control(Control.PASSIVE_FORBID)
            .probability(1)
            .end();
        // 减疗效果
        const buff4 = Buff.build(sourceId, selectedId)
            .name('一矢·封魔·减疗', 1)
            .countDown(1)
            .probability(1)
            .debuffAP(BattleProperties.HEALING_DOWN, EffectTypes.MAX, 0.7) // 降低70%治疗效果
            .end();
        
        // 添加四个debuff
        battle.actionAddBuff(buff1, Reasons.SKILL);
        battle.actionAddBuff(buff2, Reasons.SKILL);
        battle.actionAddBuff(buff3, Reasons.SKILL);
        battle.actionAddBuff(buff4, Reasons.SKILL);

        // 如果结界开启，增加护符
        if (battle.hasBuffByName(sourceId, '狐狩界')) {
            // 防御护符
            const buff5 = Buff.build(sourceId, source.teamId - 2) // 添加全局buff时 -2 表示队伍0
                .name('狐狩界·防御', 3) // 最大持有3个
                .dependOn(sourceId, '狐狩界') // 依赖于结界的存在
                .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.03 * 4) // 增加12%防御
                .end();

            // 伤害护符
            const buff6 = Buff.build(sourceId, source.teamId - 2)
                .name('狐狩界·伤害', 3)
                .dependOn(sourceId, '狐狩界')
                .buffAP(BattleProperties.DMG_DEALT_B, EffectTypes.FIXED, 0.02 * 4) // 增加8%伤害
                .end();
            
            // 速度护符
            const buff7 = Buff.build(sourceId, source.teamId - 2)
                .name('狐狩界·速度', 3)
                .dependOn(sourceId, '狐狩界')
                .buffAP(BattleProperties.SPD, EffectTypes.FIXED, 1 * 4) // 增加4点速度
                .end();

            // 添加护符
            battle.actionAddBuff(buff5, Reasons.SKILL);
            battle.actionAddBuff(buff6, Reasons.SKILL);
            battle.actionAddBuff(buff7, Reasons.SKILL);
        }
    },
};

/**
 * 御馔津技能2：狐狩界
 * 结界技能，提供先机效果
 */
export const miketsu_skill2: Skill = {
    no: 2, // 技能编号
    name: '狐狩界', // 技能名称
    target: SkillTarget.SELF, // 目标类型为自身
    text: '【先机】战斗开始时自动释放。开启狐狩界结界，持续1回合。结界期间，【一矢】触发概率提升至40%，【一矢·封魔】会为友方增加护符。',
    handlers: [{
        /**
         * 处理先机事件
         * @param battle 战斗实例
         * @param data 事件数据
         * @returns 处理结果
         * @description 战斗开始时先机释放狐狩界
         */
        handle(battle: Battle, data: RealEventData) {
            if (!data.skillOwnerId) return 0;
            // 释放狐狩界
            battle.actionUseSkill(2, data.skillOwnerId, data.skillOwnerId, 0);
            return -1;
        },
        code: EventCodes.SENKI, // 监听先机事件
        range: EventRange.NONE,
        priority: 0,
        passive: false,
        name: '【先机】狐狩界'
    }],
    passive: false,
    cost: 3, // 技能消耗
    
    /**
     * 使用技能
     * @param battle 战斗实例
     * @param sourceId 技能释放者ID
     * @param _ 目标ID（未使用）
     * @description 开启狐狩界结界
     */
    use(battle: Battle, sourceId: number, _: number) {
        const buff = Buff.build(sourceId, sourceId)
            .name('狐狩界', 1) // 同名最多1
            .enchantment() // 是结界
            .countDownBySource(1) // 已来源计算回合
            .end();
        battle.actionAddBuff(buff, Reasons.SKILL); // 开启狐狩界
    },
};

/**
 * 御馔津技能3：燃爆·破魔箭
 * 单体攻击技能，根据护符数量增加伤害
 */
export const miketsu_skill3: Skill = {
    no: 3, // 技能编号
    handlers: [],
    passive: false,
    name: '燃爆·破魔箭', // 技能名称
    cost: 3, // 技能消耗
    target: SkillTarget.ENEMY, // 目标类型为敌方
    text: '凝聚护符之力射出破魔箭，对敌方目标造成攻击195%的伤害。每3个护符额外增加25%伤害。施放后消耗所有护符。消耗3点鬼火。',
    use(battle: Battle, sourceId: number, selectedId: number) {
        const source = battle.getEntity(sourceId);
        // 获取所有护符buff
        const buffs = battle.filterBuffBySource(source.teamId - 2, sourceId)
            .filter(b => ['狐狩界·防御', '狐狩界·伤害', '狐狩界·速度'].includes(b.name));
        
        // 创建攻击实例，根据护符数量增加伤害
        const at = Attack.build(selectedId, sourceId)
            .rate(1.95 * (1 + 0.25 * buffs.length / 3)) // 基础伤害195%，每3个护符增加25%
            .shouldComputeCri() // 启用暴击计算
            .single() // 单体攻击
            .end();
        battle.actionAttack(at);

        // 先攻击后消耗所有护符
        buffs.forEach(b => {
            battle.actionRemoveBuff(b, Reasons.COST);
        });
    },
};
