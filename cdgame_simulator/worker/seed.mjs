// 从仓库现有 hero-data.ts 生成 seed.sql，再用 wrangler 导入 D1。
//   node seed.mjs            -> 生成 seed.sql
//   wrangler d1 execute cdgame --file=seed.sql --local   (本地)
//   wrangler d1 execute cdgame --file=seed.sql           (远程)
import fs from 'node:fs';
import path from 'node:path';

const tsPath = path.join(process.cwd(), '..', 'core', 'fixtures', 'hero-data.ts');
const content = fs.readFileSync(tsPath, 'utf8');

// 解析 export default [...] 的 JSON 部分
const m = content.match(/export\s+default\s+(\[[\s\S]*\]);?\s*$/);
if (!m) {
    console.error('无法解析 hero-data.ts');
    process.exit(1);
}
const data = JSON.parse(m[1]);

let sql = 'CREATE TABLE IF NOT EXISTS hero_data (idx INTEGER PRIMARY KEY, data TEXT NOT NULL);\n'
    + 'DELETE FROM hero_data;\n';
for (const r of data) {
    const json = JSON.stringify(r).replace(/'/g, "''");
    sql += `INSERT INTO hero_data (idx, data) VALUES (${r.index}, '${json}');\n`;
}
fs.writeFileSync(path.join(process.cwd(), 'seed.sql'), sql);
console.log(`已生成 seed.sql，共 ${data.length} 条卡牌数据`);
