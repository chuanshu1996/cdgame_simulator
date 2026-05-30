/**
 * 选手管理模块
 * 负责管理游戏中的所有选手，包括选手的创建、技能配置等
 */
import {map, forEach} from 'lodash';
import HeroData from '../fixtures/hero-data';
import {BattleProperties, Entity, Battle, Skill} from '../';
import NormalAttack from './common/normal-attack';
import {normalAI} from './ai';
import {oakaharahajime_skill1, oakaharahajime_skill2, oakaharahajime_skill3} from './d/oakaharahajime';
import {uegashi_megumi_skill1, uegashi_megumi_skill2, uegashi_megumi_skill3} from './d/uegashimegumi';
import {ikeda_sisters_skill1, ikeda_sisters_skill2, ikeda_sisters_skill3} from './d/ikeda-sisters';
import {bundo_seika_skill1, bundo_seika_skill2, bundo_seika_skill3} from './d/bundo-seika';
import {ishi_to_meisei_skill1, ishi_to_meisei_skill2, ishi_to_meisei_skill3, ishiToMeiseiAI} from './d/ishi-to-meisei';
import {tsuyama_mutsuki_skill1, tsuyama_mutsuki_skill2, tsuyama_mutsuki_skill3} from './d/tsuyama-mutsuki';
import {murohashi_hiroko_skill1, murohashi_hiroko_skill2, murohashi_hiroko_skill3} from './d/murohashi-hiroko';
import {sugi_no_ayumu_skill1, sugi_no_ayumu_skill2, sugi_no_ayumu_skill3} from './d/sugi-no-ayumu';
import {yoshizume_sakurako_skill1, yoshizume_sakurako_skill2, yoshizume_sakurako_skill3} from './d/yoshizume-sakurako';
import {kadomatsu_yoko_skill1, kadomatsu_yoko_skill2, kadomatsu_yoko_skill3} from './d/kadomatsu-yoko';
import {suga_kyotaro_skill1, suga_kyotaro_skill2, suga_kyotaro_skill3} from './d/suga-kyotaro';
import {shogakusei_rei_skill1, shogakusei_rei_skill2, shogakusei_rei_skill3} from './d/shogakusei-rei';
import {nozu_shizuku_skill1, nozu_shizuku_skill2, nozu_shizuku_skill3} from './d/nozu-shizuku';
import {shinshi_ayumu_skill1, shinshi_ayumu_skill2, shinshi_ayumu_skill3} from './d/shinshi-ayumu';
import {noganoue_yoko_skill1, noganoue_yoko_skill2, noganoue_yoko_skill3} from './d/noganoue-yoko';
import {yorukuchi_yayoi_skill1, yorukuchi_yayoi_skill2, yorukuchi_yayoi_skill3, yorukuchi_yayoi_skill4} from './d/yorukuchi-yayoi';
import {duojiu_lixiu_skill1, duojiu_lixiu_skill2, duojiu_lixiu_skill3} from './d/duojiu-lixiu';
import {honnai_naruka_skill1, honnai_naruka_skill2, honnai_naruka_skill3} from './c/honnai-naruka';
import {fukabori_sumiyo_skill1, fukabori_sumiyo_skill2, fukabori_sumiyo_skill3} from './c/fukabori-sumiyo';
import {bonkohara_mio_skill1, bonkohara_mio_skill2, bonkohara_mio_skill3} from './c/bonkohara-mio';
import {AI} from "../entity";

// SSR角色技能
import {ootengu_skill1, ootengu_skill2, ootengu_skill3} from "./ssr/ootengu";
import {shutendoji_skill1, shutendoji_skill2, shutendoji_skill3, shutendojiAI} from "./ssr/shutendoji";
import {miketsu_skill1, miketsu_skill2, miketsu_skill3, miketsu_skill4} from "./ssr/miketsu";

// N卡角色技能
import {akajita_skill1, akajita_skill2, akajita_skill3} from './n/akajita';
import {amonojakuaka_skill1, amonojakuaka_skill2} from './n/amanojakuaka';
import {amonojakuao_skill1, amonojakuao_skill2} from './n/amanojakuao';
import {amanojakuki_skill1, amanojakuki_skill2} from './n/amanojakuki';
import {amanojakumidori_skill1, amanojakumidori_skill2} from './n/amanojakumidori';
import {chouchinkozou_skill1, chouchinkozou_skill2} from './n/chouchinkozou';
import {hakuarashinorei_skill1} from './n/hakaarashinorei';
import {houkikami_skill1, houkikami_skill2} from './n/houkikami';
import {karakasakozou_skill1, karakasakozou_skill2} from './n/karakasakozou';
import {kiseirei_skill1} from './n/kiseirei';
import {nurikabes_skill1, nurikabes_skill2} from './n/nurikabe';

export const HeroTable = new Map<number, any>(map(HeroData, (data) => [Number(data.id), data]));
export const HeroTableByName = new Map<string, any>(map(HeroData, (data) => [data.name, data]));
export const HeroBuilders = new Map<number, () => Entity>();
export {HeroData};

function build(no: number, tags: string[], ai: AI, ...skills: Skill[]) {
    const data = HeroTable.get(no);
    HeroBuilders.set(no, function (): Entity {
        const entity = new Entity();
        if (data) {
            entity.setProperty(BattleProperties.MAX_HP, data.hp);
            entity.setProperty(BattleProperties.ATK, data.atk);
            entity.setProperty(BattleProperties.DEF, data.def);
            entity.setProperty(BattleProperties.SPD, data.spd);
            entity.setProperty(BattleProperties.CRI, data.cri);
            entity.setProperty(BattleProperties.CRI_DMG, data.cri_dmg);
            entity.setProperty(BattleProperties.EFT_HIT, data.eft_hit);
            entity.setProperty(BattleProperties.EFT_RES, data.eft_res);
            entity.rank = data.rank;
            entity.hp = data.hp;
            entity.name = data.name;
            entity.no = data.id;
            entity.ai = ai;
            // 设置最佳位置
            const positionStr = data.position || data.default_position;
            if (positionStr) {
                // 将位置字符串映射为数字坐标
                // 位置编号规则：教练0, 先锋1, 次锋2, 中坚3, 副将4, 大将5, 替补6, 应援7
                const positionMap: {[key: string]: number} = {
                    '教练': 0,
                    '先锋': 1,
                    '次锋': 2,
                    '中坚': 3,
                    '副将': 4,
                    '大将': 5,
                    '主将': 5,
                    '替补': 6,
                    '应援': 7,
                    '后卫': 2
                };
                entity.position = positionMap[positionStr] || -1;
            }
            forEach(tags, t => {
                entity.addTags(t);
            });
            forEach(skills, s => {
                entity.addSkill(s);
            });
        }
        return entity;
    });
}

HeroTable.forEach((data: any, no: number) => {
    if (data.show === 1) {
        build(no, ['simple'], normalAI, new NormalAttack('普通攻击'));
    }
});

function HERO(name: string, skills: Skill[], ai: AI = normalAI) {
    const dd = HeroData.find(d => d.name === name.trim());
    if (!dd) throw new Error('找不到[' + name + ']');
    if (dd.show === 1) {
        build(Number(dd.id), [], ai, ...skills);
    }
}

// D阶选手

HERO('冈桥初濑', [
    oakaharahajime_skill1,
    oakaharahajime_skill2,
    oakaharahajime_skill3,
]);

HERO('上柿惠', [
    uegashi_megumi_skill1,
    uegashi_megumi_skill2,
    uegashi_megumi_skill3,
]);

HERO('池田三姐妹', [
    ikeda_sisters_skill1,
    ikeda_sisters_skill2,
    ikeda_sisters_skill3,
]);

HERO('文堂星夏', [
    bundo_seika_skill1,
    bundo_seika_skill2,
    bundo_seika_skill3,
]);

HERO('石户明星', [
    ishi_to_meisei_skill1,
    ishi_to_meisei_skill2,
    ishi_to_meisei_skill3,
], ishiToMeiseiAI);

HERO('津山睦月', [
    tsuyama_mutsuki_skill1,
    tsuyama_mutsuki_skill2,
    tsuyama_mutsuki_skill3,
]);

HERO('室桥裕子', [
    murohashi_hiroko_skill1,
    murohashi_hiroko_skill2,
    murohashi_hiroko_skill3,
]);

HERO('杉乃步', [
    sugi_no_ayumu_skill1,
    sugi_no_ayumu_skill2,
    sugi_no_ayumu_skill3,
]);

HERO('义鸠樱子', [
    yoshizume_sakurako_skill1,
    yoshizume_sakurako_skill2,
    yoshizume_sakurako_skill3,
]);

HERO('门松叶子', [
    kadomatsu_yoko_skill1,
    kadomatsu_yoko_skill2,
    kadomatsu_yoko_skill3,
]);

HERO('须贺京太郎', [
    suga_kyotaro_skill1,
    suga_kyotaro_skill2,
    suga_kyotaro_skill3,
]);

HERO('小学生怜', [
    shogakusei_rei_skill1,
    shogakusei_rei_skill2,
    shogakusei_rei_skill3,
]);

HERO('野津雫', [
    nozu_shizuku_skill1,
    nozu_shizuku_skill2,
    nozu_shizuku_skill3,
]);

HERO('进士步', [
    shinshi_ayumu_skill1,
    shinshi_ayumu_skill2,
    shinshi_ayumu_skill3,
]);

HERO('野上叶子', [
    noganoue_yoko_skill1,
    noganoue_yoko_skill2,
    noganoue_yoko_skill3,
]);

HERO('除之口弥生', [
    yorukuchi_yayoi_skill1,
    yorukuchi_yayoi_skill2,
    yorukuchi_yayoi_skill3,
    yorukuchi_yayoi_skill4,
]);

HERO('多久和李绪', [
    duojiu_lixiu_skill1,
    duojiu_lixiu_skill2,
    duojiu_lixiu_skill3,
]);

HERO('本内成香', [
    honnai_naruka_skill1,
    honnai_naruka_skill2,
    honnai_naruka_skill3,
]);

HERO('深堀纯代', [
    fukabori_sumiyo_skill1,
    fukabori_sumiyo_skill2,
    fukabori_sumiyo_skill3,
]);

HERO('盆子原美绪', [
    bonkohara_mio_skill1,
    bonkohara_mio_skill2,
    bonkohara_mio_skill3,
]);

// SSR阶选手

HERO('大天狗', [
    ootengu_skill1,
    ootengu_skill2,
    ootengu_skill3,
]);

HERO('酒吞童子', [
    shutendoji_skill1,
    shutendoji_skill2,
    shutendoji_skill3,
], shutendojiAI);

HERO('御馔津', [
    miketsu_skill1,
    miketsu_skill2,
    miketsu_skill3,
    miketsu_skill4,
]);

// N阶选手

HERO('赤舌', [
    akajita_skill1,
    akajita_skill2,
    akajita_skill3,
]);

HERO('天邪鬼赤', [
    amonojakuaka_skill1,
    amonojakuaka_skill2,
]);

HERO('天邪鬼青', [
    amonojakuao_skill1,
    amonojakuao_skill2,
]);

HERO('天邪鬼黄', [
    amanojakuki_skill1,
    amanojakuki_skill2,
]);

HERO('天邪鬼绿', [
    amanojakumidori_skill1,
    amanojakumidori_skill2,
]);

HERO('提灯小僧', [
    chouchinkozou_skill1,
    chouchinkozou_skill2,
]);

HERO('盗墓小鬼', [
    hakuarashinorei_skill1,
]);

HERO('帚神', [
    houkikami_skill1,
    houkikami_skill2,
]);

HERO('唐纸伞妖', [
    karakasakozou_skill1,
    karakasakozou_skill2,
]);

HERO('寄生魂', [
    kiseirei_skill1,
]);

HERO('涂壁', [
    nurikabes_skill1,
    nurikabes_skill2,
]);
