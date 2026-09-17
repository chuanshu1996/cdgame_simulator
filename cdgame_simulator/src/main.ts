import Vue from 'vue';
import {
    Alert, Anchor, Avatar, Button, Calendar, Card, Checkbox, Col, DatePicker,
    Divider, Dropdown, Empty, Form, Icon, Input, Layout, List, Menu, Modal,
    Pagination, Progress, Radio, Row, Select, Spin, Statistic, Steps,
    Switch, Table, Tabs, Tag, Timeline, Tooltip, InputNumber, message,
} from 'ant-design-vue';
import App from './App.vue';
import router from './router';
import store from './store';
import JsonTree from 'vue-json-tree';

Vue.config.productionTip = false;
Vue.config.errorHandler = (err, vm, info) => {
    console.error('[Vue errorHandler]', err, info, vm);
};

// 注册顶层组件即可，子组件（a-menu-item / a-tab-pane / a-table-column / a-checkbox-group 等）会随父组件自动可用
// 注：ant-design-vue 1.4.12 不含 Result / Descriptions 组件，源码中 <a-result>/<a-descriptions> 在旧版全量模式下亦未注册
[
    Alert, Anchor, Avatar, Button, Calendar, Card, Checkbox, Col, DatePicker,
    Divider, Dropdown, Empty, Form, Icon, Input, Layout, List, Menu, Modal,
    Pagination, Progress, Radio, Row, Select, Spin, Statistic, Steps,
    Switch, Table, Tabs, Tag, Timeline, Tooltip, InputNumber,
].forEach(c => Vue.use(c));
Vue.prototype.$message = message;
Vue.component('json-tree', JsonTree);

new Vue({
    router,
    store,
    render: h => h(App),
}).$mount('#app');
