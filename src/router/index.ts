import Vue from 'vue';
import VueRouter from 'vue-router';
import store from '../store';

const Home = () => import('../views/Home.vue');
const Team = () => import('../views/Team.vue');
const Debug = () => import('../views/Debug.vue');
const Predict = () => import('../views/Predict.vue');
const Hero = () => import('../views/Hero.vue');
const HeroWinRate = () => import('../views/HeroWinRate.vue');
const Soul = () => import('../views/Soul.vue');
const Visual = () => import('../views/Visual.vue');
const Visual1v1 = () => import('../views/Visual1v1.vue');
const Visual6v6 = () => import('../views/Visual6v6.vue');
const Rules = () => import('../views/Rules.vue');
const Record = () => import('../views/Record.vue');
const MatchRecords = () => import('../views/MatchRecords.vue');

Vue.use(VueRouter);

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
        path: '/visual',
        name: 'Visual',
        component: Visual,
    },
    {
        path: '/visual1v1',
        name: 'Visual1v1',
        component: Visual1v1,
        meta: { adminOnly: true },
    },
    {
            path: '/visual6v6',
            name: 'Visual6v6',
            component: Visual6v6,
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
];

const router = new VueRouter({
    mode: 'hash',
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
