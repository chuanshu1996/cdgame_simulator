import Vue from 'vue';
import VueRouter from 'vue-router';
// 使用路由懒加载，减少初始加载时间
const Home = () => import('../views/Home.vue');
const Team = () => import('../views/Team.vue');
const Debug = () => import('../views/Debug.vue');
const Predict = () => import('../views/Predict.vue');
const Hero = () => import('../views/Hero.vue');
const Soul = () => import('../views/Soul.vue');
const Visual = () => import('../views/Visual.vue');
const Visual1v1 = () => import('../views/Visual1v1.vue');
const Visual6v6 = () => import('../views/Visual6v6.vue');
const Rules = () => import('../views/Rules.vue');

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
    },
    {
        path: '/visual6v6',
        name: 'Visual6v6',
        component: Visual6v6,
    },
];

const router = new VueRouter({
    mode: 'hash',
    base: process.env.BASE_URL,
    routes,
});

export default router;
