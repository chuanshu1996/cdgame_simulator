# 卡牌游戏对战模拟器

这是一个卡牌游戏对战模拟器，用于模拟和预测对战结果。

## 功能特性

- 队伍设置
- 可视化模拟
- 6V6 模拟
- 1v1 模拟
- 胜率估算
- 选手列表
- 宝物图鉴

## 如何使用

1. 在队伍设置中配置双方队伍
2. 选择模拟类型
3. 查看模拟结果和分析

## 后端部署（卡牌属性管理）

「卡牌属性」页面的读写依赖后端 API。前端通过构建变量 `VUE_APP_API_BASE` 指向后端地址：

- **本地开发**：`npm run dev` 同时起 `server.js`(3001) 与 Vue CLI(8080)，Vue CLI 把 `/api` 代理到 3001，
  因此 `VUE_APP_API_BASE` 留空即可，访问 http://localhost:8080/cdgame_simulator/ 。
- **线上**：后端部署为 Cloudflare Pages Function + D1，站点构建时把 `VUE_APP_API_BASE`
  烤入静态产物（`.github/workflows/deploy.yml` 读取仓库 Actions Variable）。

### 为什么 API 部署在 `*.pages.dev` 而不是 `*.workers.dev`

`*.workers.dev` 在中国大陆被 SNI 阻断：TCP 能连上 Cloudflare 边缘，但 TLS ClientHello
携带 `*.workers.dev` 的 SNI 后握手立即被 RST，浏览器只看到 `Failed to fetch`。
`*.pages.dev` 解析到同一批 Cloudflare 边缘 IP，未被阻断。实测（同一机器、同一时刻）：

| 目标（同一 Cloudflare 边缘 IP） | 结果 |
|---|---|
| SNI = `cdgame-api.chenruofei1996.workers.dev` | 连接重置 |
| SNI = `<任意>.pages.dev` | 200 |

因此后端实现为 Pages Function（advanced mode，`worker/_worker.js` 接管全部路由）。
该文件是唯一后端实现，接口契约与 `server.js` 完全一致，鉴权同为
`Authorization: Bearer <管理密码MD5>`。

### 部署后端

```bash
cd cdgame_simulator/worker
npx wrangler pages project create cdgame-api --production-branch main   # 首次
npx wrangler pages deploy . --project-name cdgame-api --branch main
```

D1 首次灌数据：

```bash
cd cdgame_simulator/worker
node seed.mjs                        # 由 core/fixtures/hero-data.ts 生成 seed.sql
npx wrangler d1 execute cdgame --file=seed.sql --remote
```

`wrangler.toml` 中 `[[d1_databases]]` 的 binding 必须是 `DB`（`_worker.js` 用 `env.DB`）。

### 站点侧配置（GitHub 仓库 Settings）

- Actions → Variables：`VUE_APP_API_BASE = https://cdgame-api.pages.dev`
- Actions → Secrets：`ADMIN_TOKEN = <管理密码MD5>`（供 `.github/workflows/sync-herodata.yml` 调用导出接口）
- Pages → Build source 设为 GitHub Actions（`deploy.yml` 已如此配置）

管理员在线上编辑后存于 D1；`sync-herodata.yml` 每日/手动从 D1 导出写回
`core/fixtures/hero-data.ts` 并推送，触发 `deploy.yml` 重建 Pages。

### ⚠️ 数据安全：hero-data.ts 禁止手改

`cdgame_simulator/core/fixtures/hero-data.ts` 是 **D1 的同步快照**，**不是手工编辑的数据源**：

- **线上选手数据以 D1（`cdgame_api` 库）为准**；`hero-data.ts` 只是构建期快照，本地 `server.js` 也只把它当初始文件。
- 任何人**在线上「卡牌属性」页编辑后，数据落在 D1**；`sync-herodata.yml`（每天 UTC 03:17 自动 + 手动 `workflow_dispatch`）会把 D1 全量导回 `hero-data.ts` 并推库。
- 因此**不要直接在 `hero-data.ts` 里手改选手字段**（如 `region` 代表地、`label` 标签、属性等）：
  - 手改会被下一次 D1 同步**静默覆盖**；
  - 手改又推库时，会**反向覆盖 D1 里管理员的线上编辑**，造成数据丢失。
- 正确做法：在**线上「卡牌属性」页**编辑（写 D1），或本地改完走「手动同步」把本地快照上传到 D1。
- 当前记录规模（同步后）：176 条 / `region` 34 / `label` 33 / `school` 48。这两列是「选手列表」筛选与新增列的数据来源，手改错位会直接让页面新列读空。

> 调试/校准用：本地临时跑 `curl -fsS -H 'Authorization: Bearer <管理密码MD5>' 'https://cdgame-api.pages.dev/api/hero-data/export' -o cdgame_simulator/core/fixtures/hero-data.ts` 拉最新快照即可（注意 PowerShell 用单引号包裹 `-H` 参数，cmd.exe 双引号会截断 401）。

## 致谢

### 夜雀届
- [夜雀届攻略1](https://tieba.baidu.com/p/3169322653?pn=1)
- [夜雀届攻略2](https://tieba.baidu.com/p/3339887681?pid=58610690326&cid=0#58610690326)
- [夜雀届攻略3](https://tieba.baidu.com/p/3940308392?pn=1)
- [夜雀届攻略4](https://tieba.baidu.com/p/4005880831?pn=1)

### 勇士届
- [勇士届攻略1](https://tieba.baidu.com/p/5775245470?pid=120585915209&cid=#120585915209)
- [勇士届攻略2](https://tieba.baidu.com/p/5910786063?pn=1)
- [勇士届攻略3](https://tieba.baidu.com/p/7327735597?pid=139074423088&cid=#139074423088)

### 新月届
- [新月届攻略1](https://www.bilibili.com/read/cv3100620/?spm_id_from=333.1387.0.0&opus_fallback=1)
- [新月届攻略2](https://www.bilibili.com/read/cv9807142/?spm_id_from=333.1387.0.0&opus_fallback=1)

### 苍叶届
- [苍叶届攻略1](https://www.bilibili.com/read/cv10606881/?spm_id_from=333.1387.0.0&opus_fallback=1)

### 宅炮届
- [宅炮届攻略](https://www.kdocs.cn/l/celyUg3GFIY4)
# Test
