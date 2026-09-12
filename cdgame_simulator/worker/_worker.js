// Cloudflare Pages Function（advanced mode, _worker.js）后端，替代本地 server.js。
//
// 为什么是 *.pages.dev 而不是 *.workers.dev：
//   *.workers.dev 在中国大陆被 SNI 阻断——TCP 能连上 Cloudflare 边缘，但 TLS
//   ClientHello 里带上 *.workers.dev 的 SNI 后握手即被 RST，浏览器表现为
//   "Failed to fetch"。*.pages.dev 解析到同一批 Cloudflare 边缘 IP，未被阻断。
//   实测（同一台机器、同一时刻）：
//     SNI=cdgame-api.chenruofei1996.workers.dev + 真实 CF IP  -> 连接重置
//     SNI=<任意>.pages.dev                   + 同一 CF IP     -> 200
//   部署方式见本目录 ../readme.md「后端部署」。
//
// 接口契约与 server.js 完全一致：
//   GET    /api/hero-data            取全部卡牌
//   PUT    /api/hero-data            全量替换（批量保存）
//   POST   /api/hero-data            新增一张
//   PUT    /api/hero-data/:index     按 index 更新
//   DELETE /api/hero-data/:index     按 index 删除
//   GET    /api/hero-data/export     导出 hero-data.ts 文本（供同步回仓库）
// 鉴权：Authorization: Bearer <管理密码MD5>，与前端 HeroData.vue 一致。
//
// 本文件是唯一后端实现：advanced mode 下 worker 接管全部路由，因此不再需要
// 静态占位页，非 /api/hero-data 的请求统一返回 JSON 404。

const NUMERIC_FIELDS = ['index', 'atk', 'hp', 'def', 'spd', 'cri', 'cri_dmg', 'eft_hit', 'eft_res', 'show'];

// 管理密码 MD5（与前端 HeroData.vue 的 ADMIN_PASSWORD_HASH 一致）
const ADMIN_PASSWORD_HASH = '4f323fde03b2d593d6988bb02ab0b7b7';

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    };
}

function json(data, status = 200, origin) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
    });
}

function err(message, status = 400, origin) {
    return json({ error: message }, status, origin);
}

function verifyAuth(request) {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    return token === ADMIN_PASSWORD_HASH;
}

function validateRows(rows) {
    const seen = new Set();
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== 'object') return `第 ${i + 1} 行数据格式错误`;
        if (!row.name || String(row.name).trim() === '') return `第 ${i + 1} 行：名称不能为空`;
        for (const f of NUMERIC_FIELDS) {
            if (row[f] === undefined || row[f] === null || row[f] === '') continue;
            const n = Number(row[f]);
            if (Number.isNaN(n)) return `第 ${i + 1} 行字段 "${f}" 不是有效数字`;
            row[f] = n;
        }
        if (typeof row.index !== 'undefined') {
            if (seen.has(row.index)) return `索引 ${row.index} 重复`;
            seen.add(row.index);
        }
    }
    return null;
}

async function ensureSchema(env) {
    await env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS hero_data (idx INTEGER PRIMARY KEY, data TEXT NOT NULL)'
    ).run();
}

async function getAll(env) {
    const { results } = await env.DB.prepare('SELECT data FROM hero_data ORDER BY idx').all();
    return results.map(r => JSON.parse(r.data));
}

function exportTs(rows) {
    return `export default ${JSON.stringify(rows, null, 4)}\n`;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = env.CORS_ORIGIN || request.headers.get('Origin') || '*';
        const path = url.pathname;

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        if (!path.startsWith('/api/hero-data')) {
            return err('Not Found', 404, origin);
        }

        if (!verifyAuth(request)) {
            return err('未授权访问', 401, origin);
        }

        await ensureSchema(env);

        try {
            if (request.method === 'GET') {
                if (path === '/api/hero-data/export') {
                    const rows = await getAll(env);
                    return new Response(exportTs(rows), {
                        status: 200,
                        headers: { 'Content-Type': 'text/plain; charset=utf-8', ...corsHeaders(origin) },
                    });
                }
                return json(await getAll(env), 200, origin);
            }

            if (request.method === 'PUT') {
                if (path === '/api/hero-data') {
                    const data = await request.json().catch(() => null);
                    if (!Array.isArray(data)) return err('数据格式错误：期望一个数组', 400, origin);
                    const v = validateRows(data);
                    if (v) return err(v, 400, origin);
                    await env.DB.prepare('DELETE FROM hero_data').run();
                    await env.DB.batch(
                        data.map(r =>
                            env.DB.prepare('INSERT INTO hero_data (idx, data) VALUES (?, ?)')
                                .bind(r.index, JSON.stringify(r))
                        )
                    );
                    return json({ success: true, count: data.length }, 200, origin);
                }
                const index = parseInt(path.split('/').pop(), 10);
                const updated = await request.json().catch(() => null);
                if (!updated) return err('请求体无效', 400, origin);
                const existing = await env.DB.prepare('SELECT idx FROM hero_data WHERE idx = ?').bind(index).first();
                if (!existing) return err('未找到该卡牌', 404, origin);
                await env.DB.prepare('UPDATE hero_data SET data = ? WHERE idx = ?').bind(JSON.stringify(updated), index).run();
                return json({ success: true, data: updated }, 200, origin);
            }

            if (request.method === 'POST') {
                const newHero = await request.json().catch(() => null);
                if (!newHero) return err('请求体无效', 400, origin);
                const v = validateRows([newHero]);
                if (v) return err(v, 400, origin);
                await env.DB.prepare('INSERT OR REPLACE INTO hero_data (idx, data) VALUES (?, ?)')
                    .bind(newHero.index, JSON.stringify(newHero)).run();
                return json({ success: true, data: newHero }, 200, origin);
            }

            if (request.method === 'DELETE') {
                const index = parseInt(path.split('/').pop(), 10);
                const existing = await env.DB.prepare('SELECT idx FROM hero_data WHERE idx = ?').bind(index).first();
                if (!existing) return err('未找到该卡牌', 404, origin);
                await env.DB.prepare('DELETE FROM hero_data WHERE idx = ?').bind(index).run();
                return json({ success: true }, 200, origin);
            }

            return err('Method Not Allowed', 405, origin);
        } catch (e) {
            return err('服务器内部错误：' + (e && e.message ? e.message : e), 500, origin);
        }
    },
};
