import Entity from '../entity';
import {BattleProperties} from '../constant';

export function createMakeupMirror(ownerId: number, hpPercent: number): Entity {
    const summon = new Entity();
    summon.name = '化妆镜';
    summon.summonToken = true;
    summon.no = -1;
    summon.rank = 'N';
    summon.lv = 1;
    
    summon.setProperty(BattleProperties.MAX_HP, hpPercent);
    summon.setProperty(BattleProperties.ATK, 0);
    summon.setProperty(BattleProperties.DEF, 0);
    summon.setProperty(BattleProperties.SPD, 0);
    summon.setProperty(BattleProperties.CRI, 0);
    summon.setProperty(BattleProperties.CRI_DMG, 1.5);
    summon.setProperty(BattleProperties.EFT_HIT, 0);
    summon.setProperty(BattleProperties.EFT_RES, 0);
    
    summon.hp = hpPercent;
    summon.setData('ownerId', String(ownerId));
    summon.setData('summonType', 'makeupMirror');
    
    summon.skills = [];
    
    return summon;
}

export function isMakeupMirror(entity: Entity): boolean {
    return entity.summonToken && entity.getBattleData('summonType') === 'makeupMirror';
}
