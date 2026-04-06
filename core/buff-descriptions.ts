/**
 * Buff描述数据库
 * 包含所有buff的详细信息
 */

export interface BuffDescription {
    name: string;
    type: '增益' | '减益' | '控制' | '特殊';
    description: string;
    source: string;
    duration?: string;
    maxStack?: number;
}

export const BuffDatabase: Record<string, BuffDescription> = {
    // 御魂相关
    '被服属性加成': {
        name: '被服属性加成',
        type: '增益',
        description: '增加15%生命值上限',
        source: '御魂「被服」',
        duration: '永久'
    },
    '涅槃之火属性加成': {
        name: '涅槃之火属性加成',
        type: '增益',
        description: '增加15%生命值上限',
        source: '御魂「涅槃之火」',
        duration: '永久'
    },
    '阴摩罗属性加成': {
        name: '阴摩罗属性加成',
        type: '增益',
        description: '增加15%攻击力',
        source: '御魂「阴摩罗」',
        duration: '永久'
    },
    
    // 酒吞童子
    '狂气': {
        name: '狂气',
        type: '增益',
        description: '每层增加1次攻击次数，最多叠加4层',
        source: '酒吞童子 技能2「狂气」',
        maxStack: 4
    },
    '鬼王降临': {
        name: '鬼王降临',
        type: '增益',
        description: '免疫控制效果，附带10%吸血效果',
        source: '酒吞童子 技能3「狂啸」',
        duration: '等于消耗的狂气层数'
    },
    
    // 御馔津
    '一矢·封魔·沉默': {
        name: '一矢·封魔·沉默',
        type: '控制',
        description: '沉默效果，无法使用技能',
        source: '御馔津 技能4「一矢·封魔」',
        duration: '1回合'
    },
    '一矢·封魔·压制': {
        name: '一矢·封魔·压制',
        type: '控制',
        description: '御魂压制效果，御魂效果失效',
        source: '御馔津 技能4「一矢·封魔」',
        duration: '1回合'
    },
    '一矢·封魔·封印': {
        name: '一矢·封魔·封印',
        type: '控制',
        description: '被动封印效果，被动技能失效',
        source: '御馔津 技能4「一矢·封魔」',
        duration: '1回合'
    },
    '一矢·封魔·减疗': {
        name: '一矢·封魔·减疗',
        type: '减益',
        description: '降低70%治疗效果',
        source: '御馔津 技能4「一矢·封魔」',
        duration: '1回合'
    },
    '狐狩界·防御': {
        name: '狐狩界·防御',
        type: '增益',
        description: '增加12%防御',
        source: '御馔津 技能4「一矢·封魔」（狐狩界开启时）',
        duration: '依赖于狐狩界结界'
    },
    '狐狩界·伤害': {
        name: '狐狩界·伤害',
        type: '增益',
        description: '增加8%伤害',
        source: '御馔津 技能4「一矢·封魔」（狐狩界开启时）',
        duration: '依赖于狐狩界结界'
    },
    '狐狩界·速度': {
        name: '狐狩界·速度',
        type: '增益',
        description: '增加4点速度',
        source: '御馔津 技能4「一矢·封魔」（狐狩界开启时）',
        duration: '依赖于狐狩界结界'
    },
    '狐狩界': {
        name: '狐狩界',
        type: '特殊',
        description: '结界效果，提升一矢触发概率至40%，一矢·封魔会为友方增加护符',
        source: '御馔津 技能2「狐狩界」',
        duration: '1回合'
    },
    
    // 涂壁
    '坚壁': {
        name: '坚壁',
        type: '增益',
        description: '防御增加量 = 自身防御的20% + 目标防御的40%',
        source: '涂壁 技能2「坚壁」',
        duration: '2回合'
    },
    
    // 天邪鬼黄
    '锵锵锵': {
        name: '锵锵锵',
        type: '增益',
        description: '暴击率增加15%',
        source: '天邪鬼黄 技能2「锵锵锵」',
        duration: '1回合'
    },
    
    // 天邪鬼青
    '低吟': {
        name: '低吟',
        type: '增益',
        description: '速度增加40点',
        source: '天邪鬼青 技能2「低吟」',
        duration: '1回合'
    },
    
    // 天邪鬼赤
    '挑衅': {
        name: '挑衅',
        type: '控制',
        description: '挑衅效果，强制目标攻击自己',
        source: '天邪鬼赤 技能2「挑衅」',
        duration: '1回合'
    },
    '挑衅[增]': {
        name: '挑衅[增]',
        type: '增益',
        description: '增加20%造成的伤害',
        source: '天邪鬼赤 技能2「挑衅」',
        duration: '1回合'
    },
    '挑衅[易]': {
        name: '挑衅[易]',
        type: '减益',
        description: '增加40%受到的伤害',
        source: '天邪鬼赤 技能2「挑衅」',
        duration: '1回合'
    },
    
    // 赤舌
    '鼓舞[速]': {
        name: '鼓舞[速]',
        type: '增益',
        description: '固定增加15点速度',
        source: '赤舌 技能2「鼓舞」',
        duration: '2回合'
    },
    '鼓舞[暴]': {
        name: '鼓舞[暴]',
        type: '增益',
        description: '固定增加11%暴击率',
        source: '赤舌 技能2「鼓舞」',
        duration: '2回合'
    },
    
    // 冈原始
    '鼓舞': {
        name: '鼓舞',
        type: '增益',
        description: '提升15点速度 + 15%暴击率',
        source: '冈原始 技能3「扩音喇叭」',
        duration: '2回合'
    },
    
    // 大天狗
    '庇护': {
        name: '庇护',
        type: '特殊',
        description: '可抵挡控制技能，抵消后消失',
        source: '大天狗 技能2「钢铁之羽」',
        duration: '回合开始时移除'
    },
    '雄姿英发': {
        name: '雄姿英发',
        type: '增益',
        description: '每层增加1%伤害，最多叠加80层',
        source: '大天狗 技能2「钢铁之羽」',
        maxStack: 80
    },
    
    // 满经验
    '满经验': {
        name: '满经验',
        type: '增益',
        description: '攻击+15%，防御+15%',
        source: '队伍设置「满」状态',
        duration: '永久'
    }
};

/**
 * 根据buff名称获取buff描述
 */
export function getBuffDescription(buffName: string): BuffDescription | undefined {
    return BuffDatabase[buffName];
}

/**
 * 获取所有buff名称列表
 */
export function getAllBuffNames(): string[] {
    return Object.keys(BuffDatabase);
}
