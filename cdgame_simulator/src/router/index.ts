import Vue from 'vue';
import VueRouter, { Route } from 'vue-router';
import store from '../store';

const Home = () => import('../views/Home.vue');
const Team = () => import('../views/Team.vue');
const Debug = () => import('../views/Debug.vue');
const Predict = () => import('../views/Predict.vue');
const Hero = () => import('../views/Hero.vue');
const HeroWinRate = () => import('../views/HeroWinRate.vue');
const CardWinRate = () => import('../views/CardWinRate.vue');
const Soul = () => import('../views/Soul.vue');
const BattleSimulator = () => import('../views/BattleSimulator.vue');
const BattleSetup = () => import('../views/BattleSetup.vue');
const Rules = () => import('../views/Rules.vue');
const Record = () => import('../views/Record.vue');
const MatchRecords = () => import('../views/MatchRecords.vue');
const HeroData = () => import('../views/HeroData.vue');
const DataSync = () => import('../views/DataSync.vue');

Vue.use(VueRouter);

// 旧模拟入口 → 统一模拟页 /battle。
// size 表示两侧同为 N；s0/s1 可分别指定左右人数（非对称对局）。
// 注意：必须用函数式 redirect 保留原 query（MatchRecords 的 ?seed= 回放依赖它）。
function redirectToBattle(size: number, s0?: number, s1?: number) {
    return (to: Route) => ({
        path: '/battle',
        query: Object.assign({}, to.query, (s0 || s1) ? { s0: s0 || size, s1: s1 || size } : { size }),
    });
}

const routes = [
    {
        path: '/',
        name: 'Home',
        component: Home,
    },
    {
        path: '/team',
        name: 'Team',
        component: Team,
    },
    {
        path: '/rules',
        name: 'Rules',
        component: Rules,
    },
    {
        path: '/debug',
        name: 'Debug',
        component: Debug,
    },
    {
        path: '/predict',
        name: 'Predict',
        component: Predict,
    },
    {
        path: '/hero',
        name: 'Hero',
        component: Hero,
    },
    {
        path: '/hero-win-rate',
        name: 'HeroWinRate',
        component: HeroWinRate,
        meta: { adminOnly: true },
    },
    {
        path: '/soul',
        name: 'Soul',
        component: Soul,
    },
    {
        path: '/battle',
        name: 'BattleSimulator',
        component: BattleSimulator,
    },
    {
        path: '/battle-setup',
        name: 'BattleSetup',
        component: BattleSetup,
    },
    // 旧入口合并到统一模拟页（带预设人数，并保留原有 query，如 ?seed= 回放）
    // 必须用函数式 redirect，字符串形式会丢弃 query 导致回放失效
    // ?size=N 表示两侧同为 N；如需非对称对局可用 ?s0=A&s1=B
    {
        path: '/visual',
        redirect: redirectToBattle(5),
    },
    {
        path: '/visual6v6',
        redirect: redirectToBattle(6),
    },
    {
        path: '/visual1v1',
        redirect: redirectToBattle(1),
    },
        {
            path: '/record',
            name: 'Record',
            component: Record,
        },
        {
            path: '/match-records',
            name: 'MatchRecords',
            component: MatchRecords,
        },
        {
            path: '/hero-data',
            name: 'HeroData',
            component: HeroData,
            meta: { adminOnly: true },
        },
        {
            path: '/data-sync',
            name: 'DataSync',
            component: DataSync,
            meta: { adminOnly: true },
        },
    ]
const router = new VueRouter({
    base: process.env.BASE_URL,
    routes,
});

router.beforeEach((to, from, next) => {
    if (to.meta && to.meta.adminOnly && !store.state.isAdminLoggedIn) {
        next({ path: '/', replace: true });
    } else {
        next();
    }
});

export default router;
