export interface MenuItem {
    key: string;
    icon: string;
    title: string;
    hidden?: boolean;
}

export const menuItems: MenuItem[] = [
    { key: '/', icon: 'home', title: '首页' },
    { key: '/rules', icon: 'book', title: '规则说明' },
    { key: '/team', icon: 'profile', title: '队伍设置' },
    { key: '/visual', icon: 'fire', title: '5v5模拟', hidden: true },
    { key: '/visual6v6', icon: 'fire', title: '6V6 模拟' },
    { key: '/visual1v1', icon: 'thunderbolt', title: '1v1模拟' },
    { key: '/predict', icon: 'crown', title: '胜率估算', hidden: true },
    { key: '/hero', icon: 'table', title: '选手列表' },
    { key: '/soul', icon: 'star', title: '御魂图鉴' },
    { key: '/debug', icon: 'build', title: '对战调试(程序员)', hidden: true },
];
