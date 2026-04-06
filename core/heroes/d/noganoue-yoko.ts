import {
    Battle,
    EventCodes,
    EventRange,
    RealEventData,
    Reasons,
    Skill,
    BuffParams,
    EffectTypes,
    Control,
    BattleProperties
} from '../../';
import NormalAttack from '../common/normal-attack';
import {SkillTarget} from '../../skill';
import Buff from '../../buff';
import Attack from '../../attack';

export const noganoue_yoko_skill1 = new NormalAttack('开心麻将');
noganoue_yoko_skill1.text = '开心地打麻将，对单体对手造成125%攻击伤害。';
noganoue_yoko_skill1.cost = 0;
noganoue_yoko_skill1.target = SkillTarget.ENEMY;

// 专注进攻被动技能
export const noganoue_yoko_skill2: Skill = {
    no: 2,
    name: '专注进攻',
    passive: true,
    cost: 0,
    target: SkillTarget.SELF,
    text: '造成伤害后获得1层【专注进攻】，最高获得3层，持续至战斗结束。【专注进攻】：防御力降低90点，攻击力提升300点，速度提升10点。',
    handlers: [
        {
            handle(battle: Battle, data: RealEventData) {
                if (!data.skillOwnerId) return 0;
                const entity = battle.getEntity(data.skillOwnerId);
                if (!entity) return 0;
                
                // 造成伤害后获得1层专注进攻
                const buffCount = battle.filterBuffByName(data.skillOwnerId, '专注进攻').length;
                if (buffCount < 3) {
                    const buff = Buff.build(data.skillOwnerId, data.skillOwnerId)
                        .name('专注进攻', 3)
                        .buffAP('def', EffectTypes.FIXED, -90)
                        .buffAP('atk', EffectTypes.FIXED, 300)
                        .buffAP('spd', EffectTypes.FIXED, 10)
                        .noRemove()
                        .end();
                    battle.actionAddBuff(buff, Reasons.SKILL);
                    
                    const newBuffCount = buffCount + 1;
                    battle.log(`【${entity.name}】获得1层专注进攻，当前层数：${newBuffCount}`);
                }
                return -1;
            },
            code: EventCodes.HAS_DAMAGED,
            range: EventRange.SELF,
            priority: 0,
            passive: true,
            name: '【伤害】专注进攻',
        }
    ],
};

// 早巡立直技能
export const noganoue_yoko_skill3: Skill = {
    no: 3,
    name: '早巡立直',
    passive: false,
    cost: 3,
    target: SkillTarget.ENEMY,
    text: '对全体敌方造成攻击力100%的伤害，第一回合可以根据敌人所处行动条的位置额外追加伤害（行动条为0时最高追加50%伤害，行动条99时追加0.5%伤害）',
    use(battle: Battle, sourceId: number, _: number) {
        const source = battle.getEntity(sourceId);
        if (!source) return;
        
        const enemies = battle.getEnemies(sourceId);
        const attacks: Attack[] = [];
        
        enemies.forEach(enemy => {
            // 基础伤害
            let damageRate = 1.0;
            
            // 第一回合根据行动条位置追加伤害
            if (battle.turn === 1) {
                // 获取行动条位置（0-10000）
                const position = battle.runway.get(enemy.entityId) || 0;
                // 转换为0-99的范围
                const progress = Math.min(99, Math.floor((position / 10000) * 100));
                // 行动条为0时追加50%伤害，99时追加0.5%伤害
                const extraDamage = 0.5 - (progress / 99) * 0.495;
                damageRate += extraDamage;
            }
            
            const attack = Attack.build(enemy.entityId, sourceId)
                .rate(damageRate)
                .skill('早巡立直')
                .group()
                .end();
            attacks.push(attack);
        });
        
        battle.actionAttack(attacks);
        battle.log(`【${source.name}】使用早巡立直，对全体敌人造成伤害`);
    },
};