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
    { key: '/visual', icon: 'fire', title: '5v5模拟', adminOnly: true },
    { key: '/visual6v6', icon: 'fire', title: '6V6 模拟' },
    { key: '/visual1v1', icon: 'thunderbolt', title: '1v1模拟', adminOnly: true },
    { key: '/predict', icon: 'crown', title: '胜率估算', adminOnly: true },
    { key: '/hero', icon: 'table', title: '选手列表' },
    { key: '/hero-win-rate', icon: 'trophy', title: '选手胜率', adminOnly: true },
    { key: '/soul', icon: 'star', title: '御魂图鉴' },
    { key: '/debug', icon: 'build', title: '对战调试(程序员)', hidden: true },
];
