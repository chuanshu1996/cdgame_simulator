#!/usr/bin/env node
/**
 * 技能效果标签回归工具
 *
 * 用途：校验 `src/utils/skill-tags.ts` 里的标签关键词，在真实英雄技能描述上的命中情况。
 *
 * 为什么需要它：
 *   「选手列表」的技能组效果筛选是**自动推导**的——扫描技能 text 描述命中关键词即打标。
 *   因此标签关键词必须与项目里技能描述的**真实措辞**严格一致。若有人修改了技能描述
 *   （例如把「防御力降低20点」改成「防御下降20点」），对应标签会**静默失效**——页面上
 *   不报错，只是筛不到人，很难发现。
 *
 * 何时运行：
 *   - 修改任何英雄技能 `text` 描述之后
 *   - 修改 `src/utils/skill-tags.ts` 的关键词之后
 *   - 与「技能是否符合描述」的测试协同时的回归检查
 *
 * 用法：
 *   node scripts/verify-skill-tags.cjs
 *   npm run verify:tags
 *
 * 输出说明：
 *   - 有效：有英雄命中的标签（会显示在筛选框）
 *   - 隐藏：零命中标签（页面自动隐藏，属正常，等后续技能实现后会自动出现）
 *   - 若某个原本有效的标签突然变成零命中，说明描述或关键词被改坏了。
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const TAGS_FILE = path.join(PROJECT_ROOT, 'src', 'utils', 'skill-tags.ts');
const HEROES_DIR = path.join(PROJECT_ROOT, 'core', 'heroes');

/** 大类展示顺序，需与 skill-tags.ts 的 CATEGORY_ORDER 一致 */
const CATEGORY_ORDER = ['伤害', '控制', '生存', '增益', '减益', '行动条', '能量', '机制', '无视'];

/** 递归收集目录下所有 .ts 文件 */
function walk(dir) {
    let out = [];
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) out = out.concat(walk(p));
        else if (f.endsWith('.ts')) out.push(p);
    }
    return out;
}

/**
 * 从 skill-tags.ts 解析标签定义
 *
 * 匹配形如：
 *   {
 *       name: '单体',
 *       category: '伤害',
 *       keywords: ['单体'],
 *       ...
 *   }
 */
function parseTagDefs(src) {
    const defs = [];
    const re = /name:\s*'([^']+)',\s*category:\s*'([^']+)',\s*keywords:\s*\[([^\]]*)\]/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        defs.push({
            name: m[1],
            category: m[2],
            keywords: m[3]
                .split(',')
                .map(s => s.trim().replace(/^'|'$/g, ''))
                .filter(Boolean),
        });
    }
    return defs;
}

/**
 * 收集每个英雄文件的技能描述
 *
 * 说明：passive 的判定是**文件级**近似（文件里出现 passive: true 即认为该英雄含被动技能）。
 * 运行时 deriveSkillTags 是**技能级**精确判定的，两者在极少数情况下会有细微差异，
 * 但对「关键词命中率回归」这个目的足够。
 */
function collectHeroes() {
    const heroes = [];
    for (const file of walk(HEROES_DIR)) {
        const src = fs.readFileSync(file, 'utf8');
        const texts = [];
        const re = /text\s*:\s*(['"`])([\s\S]*?)\1/g;
        let m;
        while ((m = re.exec(src)) !== null) texts.push(m[2]);
        if (!texts.length) continue;
        heroes.push({
            file: path.relative(HEROES_DIR, file),
            texts,
            hasPassive: /passive\s*:\s*true/.test(src),
        });
    }
    return heroes;
}

function main() {
    if (!fs.existsSync(TAGS_FILE)) {
        console.error('找不到标签定义文件: ' + TAGS_FILE);
        process.exit(1);
    }

    const tagDefs = parseTagDefs(fs.readFileSync(TAGS_FILE, 'utf8'));
    const heroes = collectHeroes();

    if (!tagDefs.length) {
        console.error('未解析到任何标签定义，请检查 skill-tags.ts 格式是否变化（脚本依赖 name/category/keywords 的书写顺序）');
        process.exit(1);
    }

    // 统计每个标签命中多少名英雄
    const counter = {};
    for (const hero of heroes) {
        const hit = new Set();
        if (hero.hasPassive) hit.add('被动');
        for (const def of tagDefs) {
            if (def.keywords.some(k => hero.texts.some(t => t.includes(k)))) hit.add(def.name);
        }
        for (const t of hit) counter[t] = (counter[t] || 0) + 1;
    }

    console.log('技能效果标签回归检查');
    console.log('='.repeat(60));
    console.log('英雄文件数 : ' + heroes.length);
    console.log('技能描述数 : ' + heroes.reduce((s, h) => s + h.texts.length, 0));
    console.log('标签定义数 : ' + tagDefs.length);
    console.log('');

    let aliveCount = 0;
    const zeroHit = [];

    for (const cat of CATEGORY_ORDER) {
        const items = tagDefs.filter(d => d.category === cat);
        if (!items.length) continue;

        const alive = items.filter(d => counter[d.name]);
        const dead = items.filter(d => !counter[d.name]);
        aliveCount += alive.length;
        dead.forEach(d => zeroHit.push(d));

        console.log('[' + cat + ']  有效 ' + alive.length + '/' + items.length);
        if (alive.length) {
            console.log('   显示 : ' + alive.map(d => d.name + '(' + counter[d.name] + ')').join('  '));
        }
        if (dead.length) {
            console.log('   隐藏 : ' + dead.map(d => d.name).join('  '));
        }
        console.log('');
    }

    // 处理未归入已知大类的标签（防御性：避免新增大类后漏统计）
    const known = new Set(CATEGORY_ORDER);
    const unknown = tagDefs.filter(d => !known.has(d.category));
    if (unknown.length) {
        console.log('[未归类] ' + unknown.map(d => d.category + '.' + d.name).join('  '));
        console.log('');
    }

    console.log('='.repeat(60));
    console.log('有效标签 : ' + aliveCount + ' / ' + tagDefs.length);
    console.log('零命中   : ' + zeroHit.length + ' 个（页面自动隐藏）');

    if (zeroHit.length) {
        console.log('');
        console.log('零命中清单（等后续技能实现后会自动出现，属正常）：');
        console.log('  ' + zeroHit.map(d => d.category + '.' + d.name).join(', '));
    }

    console.log('');
    console.log('提示：若某个原本「显示」的标签变为零命中，说明技能描述或关键词被改坏了。');
}

main();
