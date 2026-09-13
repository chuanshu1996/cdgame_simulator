import Vue from 'vue';
import Antd from 'ant-design-vue';
import App from './App.vue';
import 'ant-design-vue/dist/antd.css';
import router from './router';
import store from './store';
import JsonTree from 'vue-json-tree';

Vue.config.productionTip = false;
Vue.config.errorHandler = (err, vm, info) => {
    console.error('[Vue errorHandler]', err, info, vm);
};

Vue.use(Antd);
Vue.component('json-tree', JsonTree);

new Vue({
    router,
    store,
    render: h => h(App),
}).$mount('#app');
