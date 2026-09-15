export interface MenuItem {
    key: string;
    icon: string;
    title: string;
    hidden?: boolean;
    adminOnly?: boolean;
}

export const menuItems: MenuItem[] = [
    { key: '/', icon: 'home', title: '首页' },
    { key: '/rules', icon: 'book', title: '规则说明' },
    { key: '/team', icon: 'profile', title: '队伍设置' },
    { key: '/record', icon: 'trophy', title: '队伍战绩' },
    { key: '/match-records', icon: 'history', title: '比赛记录' },
    { key: '/battle', icon: 'fire', title: '卡牌模拟' },
    { key: '/battle-setup', icon: 'setting', title: '战场配置' },
    { key: '/predict', icon: 'crown', title: '胜率估算', adminOnly: true },
    { key: '/hero', icon: 'table', title: '选手列表' },
    { key: '/hero-data', icon: 'database', title: '卡牌属性', adminOnly: true },
    { key: '/hero-win-rate', icon: 'trophy', title: '选手胜率', adminOnly: true },
    { key: '/card-win-rate', icon: 'experiment', title: '卡牌胜率测试', adminOnly: true },
    { key: '/data-sync', icon: 'cloud', title: '数据同步', adminOnly: true },
    { key: '/soul', icon: 'star', title: '宝物图鉴' },
    { key: '/debug', icon: 'build', title: '对战调试(程序员)', hidden: true },
];
