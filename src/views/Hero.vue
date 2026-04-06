<template>
    <div class="site-card">
        <a-table
                :columns="columns"
                :rowKey="record => record.name"
                :dataSource="data"
                :customRow="customRow"
                :pagination="pagination"
                :scroll="{ x: 'max-content' }"
        >
            <span slot="name" slot-scope="name, record">
                <img :src="getAvatarPath(name, record.no)" class="square-avatar"/>
                {{name}}
            </span>
        </a-table>

        <a-modal
            v-model="skillModalVisible"
            :footer="null"
            width="750px"
            class="card-detail-modal"
            :bodyStyle="{ padding: 0 }"
        >
            <div v-if="currentHero" class="card-detail">
                <div class="card-header">
                    <div class="card-avatar-section">
                        <img :src="getAvatarPath(currentHero.name, currentHero.no)" class="card-avatar" />
                    </div>
                    <div class="card-info-section">
                        <div class="card-title-row">
                            <span class="card-name">{{ currentHero.name }}</span>
                            <a-tag :color="getRankColor(currentHero.rank)" class="rank-tag">{{ currentHero.rank }}</a-tag>
                        </div>
                        <div class="card-meta">
                            <div class="meta-item" v-if="currentHero.grade">
                                <span class="meta-label">年级</span>
                                <span class="meta-value">{{ currentHero.grade }}</span>
                            </div>
                            <div class="meta-item" v-if="currentHero.school">
                                <span class="meta-label">学校</span>
                                <span class="meta-value">{{ currentHero.school }}</span>
                            </div>
                            <div class="meta-item" v-if="currentHero.position">
                                <span class="meta-label">位置</span>
                                <span class="meta-value">{{ currentHero.position }}</span>
                            </div>
                        </div>
                        <div class="card-labels" v-if="currentHero.labels && currentHero.labels.length > 0">
                            <a-tag v-for="(label, idx) in currentHero.labels" :key="idx" class="label-tag">{{ label }}</a-tag>
                        </div>
                        <div class="card-attrs">
                            <div class="attr-row">
                                <span class="attr-label">生命</span>
                                <span class="attr-value">{{ currentHero.hp }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">攻击</span>
                                <span class="attr-value">{{ currentHero.atk }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">防御</span>
                                <span class="attr-value">{{ currentHero.def }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">速度</span>
                                <span class="attr-value">{{ currentHero.spd }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">暴击</span>
                                <span class="attr-value">{{ currentHero.cri }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">暴伤</span>
                                <span class="attr-value">{{ currentHero.cri_dmg }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">命中</span>
                                <span class="attr-value">{{ currentHero.eft_hit }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">抵抗</span>
                                <span class="attr-value">{{ currentHero.eft_res }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-type" v-if="currentHero.type">
                        <span class="type-label">{{ currentHero.type }}</span>
                    </div>
                </div>
                
                <div class="card-skills">
                    <div class="skills-title">技能列表</div>
                    <div class="skill-list">
                        <div v-for="(skill, index) in currentHeroSkills" :key="index" class="skill-card">
                            <div class="skill-header">
                                <span class="skill-no">技能 {{ skill.no }}</span>
                                <span class="skill-name">{{ skill.name }}</span>
                                <span class="skill-cost" v-if="!skill.passive && typeof skill.cost !== 'function'">
                                    <span v-for="n in skill.cost" :key="n" class="fire-icon">🔥</span>
                                    <span v-if="skill.cost === 0" class="fire-icon zero">0</span>
                                </span>
                                <a-tag v-if="skill.passive" color="purple" size="small">被动</a-tag>
                                <a-tag v-if="skill.hide" color="red" size="small">隐藏</a-tag>
                            </div>
                            <div class="skill-body">
                                <div class="skill-desc" v-if="skill.text">{{ skill.text }}</div>
                                <div class="skill-desc no-desc" v-else-if="!skill.passive">该技能暂无详细描述</div>
                            </div>
                        </div>
                        <div v-if="currentHeroSkills.length === 0" class="no-skill">
                            该选手暂无已实现的技能
                        </div>
                    </div>
                </div>
            </div>
        </a-modal>
    </div>
</template>

<script>
    import {HeroBuilders, BattleProperties, HeroData} from '../../core'
    import {getAvatarPathByName} from '../utils/avatar-utils'

    const columns = [
        {
            title: 'rank',
            dataIndex: 'rank',
            width: 80,
            filters: [
                { text: 'SSR', value: 'SSR' },
                { text: 'SR', value: 'SR' },
                { text: 'R', value: 'R' },
                { text: 'N', value: 'N' },
                { text: 'D', value: 'D' },
            ],
            filterMultiple: true,
            onFilter: (value, record) => record.rank === value,
            sorter: (a, b) => {
                const rankOrder = { 'SSR': 1, 'SR': 2, 'R': 3, 'N': 4, 'D': 5 };
                return (rankOrder[a.rank] || 99) - (rankOrder[b.rank] || 99);
            },
        },
        {
            title: '选手',
            width: '15%',
            key: 'name',
            dataIndex: 'name',
            scopedSlots: {customRender: 'name'},
            sorter: (a, b) => a.name.localeCompare(b.name, 'zh-CN'),
        },
        {
            title: '年级',
            dataIndex: 'grade',
            width: 80,
            filters: [
                { text: '高一', value: '高一' },
                { text: '高二', value: '高二' },
                { text: '高三', value: '高三' },
            ],
            filterMultiple: true,
            onFilter: (value, record) => record.grade === value,
            sorter: (a, b) => {
                const gradeOrder = { '高一': 1, '高二': 2, '高三': 3 };
                return (gradeOrder[a.grade] || 99) - (gradeOrder[b.grade] || 99);
            },
        },
        {
            title: '学校',
            dataIndex: 'school',
            width: 120,
            filters: [],
            filterMultiple: true,
            onFilter: (value, record) => record.school === value,
            sorter: (a, b) => (a.school || '').localeCompare(b.school || '', 'zh-CN'),
        },
        {
            title: '位置',
            dataIndex: 'position',
            width: 80,
            filters: [
                { text: '先锋', value: '先锋' },
                { text: '次锋', value: '次锋' },
                { text: '中坚', value: '中坚' },
                { text: '副将', value: '副将' },
                { text: '大将', value: '大将' },
            ],
            filterMultiple: true,
            onFilter: (value, record) => record.position === value,
            sorter: (a, b) => {
                const posOrder = { '先锋': 1, '次锋': 2, '中坚': 3, '副将': 4, '大将': 5 };
                return (posOrder[a.position] || 99) - (posOrder[b.position] || 99);
            },
        },
        {
            title: '类型',
            dataIndex: 'type',
            width: 100,
            filters: [],
            filterMultiple: true,
            onFilter: (value, record) => record.type === value,
            sorter: (a, b) => (a.type || '').localeCompare(b.type || '', 'zh-CN'),
        },
        {
            title: '技能已实现',
            dataIndex: 'ok',
            width: 100,
            filters: [
                { text: '是', value: '是' },
                { text: '否', value: '否' },
            ],
            filterMultiple: false,
            onFilter: (value, record) => record.ok === value,
            sorter: (a, b) => a.ok.localeCompare(b.ok),
        },
        {
            title: '生命',
            dataIndex: 'hp',
            sorter: (a, b) => a.hp - b.hp,
        },
        {
            title: '攻击',
            dataIndex: 'atk',
            sorter: (a, b) => a.atk - b.atk,
        },
        {
            title: '防御',
            dataIndex: 'def',
            sorter: (a, b) => a.def - b.def,
        },
        {
            title: '速度',
            dataIndex: 'spd',
            sorter: (a, b) => a.spd - b.spd,
        },
        {
            title: '暴击',
            dataIndex: 'cri',
            sorter: (a, b) => parseFloat(a.cri) - parseFloat(b.cri),
        },
        {
            title: '暴击伤害',
            dataIndex: 'cri_dmg',
            sorter: (a, b) => parseFloat(a.cri_dmg) - parseFloat(b.cri_dmg),
        },
        {
            title: '效果命中',
            dataIndex: 'eft_hit',
            sorter: (a, b) => parseFloat(a.eft_hit) - parseFloat(b.eft_hit),
        },
        {
            title: '效果抵抗',
            dataIndex: 'eft_res',
            sorter: (a, b) => parseFloat(a.eft_res) - parseFloat(b.eft_res),
        },
    ];

    const heroEntities = new Map();

    export default {
        data() {
            const heros = [];

            HeroBuilders.forEach(build => {
                const hero = build();
                heros.push(hero);
                heroEntities.set(hero.no, hero);
            });

            const heroList = heros.map(hero => {
                const heroData = HeroData.find(d => d.id === hero.no);
                return {
                    no: hero.no,
                    name: hero.name,
                    rank: hero.rank || 'N',
                    grade: heroData ? heroData.grade : '-',
                    school: heroData ? heroData.school : '-',
                    position: heroData ? heroData.position : '-',
                    type: heroData ? heroData.type : '-',
                    hp: Math.round(hero.getProperty(BattleProperties.MAX_HP)),
                    atk: Math.round(hero.getProperty(BattleProperties.ATK)),
                    def: Math.round(hero.getProperty(BattleProperties.DEF)),
                    spd: Math.round(hero.getProperty(BattleProperties.SPD)),
                    cri: Math.round(hero.getProperty(BattleProperties.CRI) * 100) + '%',
                    cri_dmg: Math.round(hero.getProperty(BattleProperties.CRI_DMG) * 100) + '%',
                    eft_hit: Math.round(hero.getProperty(BattleProperties.EFT_HIT) * 100) + '%',
                    eft_res: Math.round(hero.getProperty(BattleProperties.EFT_RES) * 100) + '%',
                    ok: hero.hasTag('simple') ? '否' : '是',
                    show: heroData ? heroData.show : 1,
                };
            }).filter(item => item.show === 1);

            // 动态生成学校筛选选项
            const schoolSet = new Set(heroList.map(h => h.school).filter(s => s && s !== '-'));
            const schoolFilters = Array.from(schoolSet).sort().map(s => ({ text: s, value: s }));
            const schoolColumn = columns.find(c => c.dataIndex === 'school');
            if (schoolColumn) {
                schoolColumn.filters = schoolFilters;
            }

            // 动态生成类型筛选选项
            const typeSet = new Set(heroList.map(h => h.type).filter(t => t && t !== '-'));
            const typeFilters = Array.from(typeSet).sort().map(t => ({ text: t, value: t }));
            const typeColumn = columns.find(c => c.dataIndex === 'type');
            if (typeColumn) {
                typeColumn.filters = typeFilters;
            }

            return {
                data: heroList,
                columns,
                pagination: {
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条`,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    defaultPageSize: 10,
                },
                skillModalVisible: false,
                currentHero: null,
                currentHeroSkills: [],
            }
        },
        watch: {
            '$route.query.heroNo': {
                handler(newHeroNo) {
                    if (newHeroNo) {
                        this.showSkillModal(parseInt(newHeroNo));
                    }
                },
                immediate: true
            }
        },
        methods: {
            getAvatarPath(name, no) {
                return getAvatarPathByName(name, no);
            },
            getRankColor(rank) {
                const colorMap = {
                    'SSR': 'gold',
                    'SR': 'purple',
                    'R': 'blue',
                    'N': 'default',
                    'D': 'green',
                    'C': 'cyan',
                };
                return colorMap[rank] || 'default';
            },
            customRow(record) {
                return {
                    on: {
                        click: () => {
                            if (record.ok === '是') {
                                this.showSkillModal(record.no);
                            }
                        }
                    },
                    style: {
                        cursor: record.ok === '是' ? 'pointer' : 'default'
                    }
                };
            },
            showSkillModal(heroNo) {
                const hero = heroEntities.get(heroNo);
                if (!hero) return;

                const heroData = HeroData.find(d => d.id === heroNo);
                
                this.currentHero = {
                    no: hero.no,
                    name: hero.name,
                    rank: hero.rank || 'N',
                    hp: Math.round(hero.getProperty(BattleProperties.MAX_HP)),
                    atk: Math.round(hero.getProperty(BattleProperties.ATK)),
                    def: Math.round(hero.getProperty(BattleProperties.DEF)),
                    spd: Math.round(hero.getProperty(BattleProperties.SPD)),
                    cri: Math.round(hero.getProperty(BattleProperties.CRI) * 100) + '%',
                    cri_dmg: Math.round(hero.getProperty(BattleProperties.CRI_DMG) * 100) + '%',
                    eft_hit: Math.round(hero.getProperty(BattleProperties.EFT_HIT) * 100) + '%',
                    eft_res: Math.round(hero.getProperty(BattleProperties.EFT_RES) * 100) + '%',
                    grade: heroData ? heroData.grade : null,
                    school: heroData ? heroData.school : null,
                    position: heroData ? heroData.position : null,
                    labels: heroData && heroData.label ? heroData.label.split('，').filter(l => l.trim()) : [],
                    type: heroData ? heroData.type : null,
                };
                this.currentHeroSkills = hero.skills.map(skill => {
                    return {
                        no: skill.no,
                        name: skill.name,
                        cost: skill.cost,
                        passive: skill.passive,
                        hide: skill.hide,
                        text: skill.text,
                    };
                });
                this.skillModalVisible = true;
            }
        }
    }
</script>

<style scoped>
.site-card {
    padding: 20px;
}

.square-avatar {
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: 4px;
    margin-right: 8px;
    vertical-align: middle;
}

.card-detail-modal .card-detail {
    background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%);
}

.card-header {
    display: flex;
    padding: 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    gap: 24px;
    position: relative;
}

.card-avatar-section {
    flex-shrink: 0;
    display: flex;
    align-items: stretch;
}

.card-avatar {
    width: 180px;
    height: 100%;
    min-height: 200px;
    object-fit: cover;
    border-radius: 12px;
    border: 3px solid rgba(255, 255, 255, 0.8);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.card-info-section {
    flex: 1;
    color: white;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 16px;
}

.card-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.card-name {
    font-size: 26px;
    font-weight: bold;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.rank-tag {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 4px;
}

.card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
}

.meta-item {
    display: flex;
    align-items: center;
    gap: 6px;
}

.meta-label {
    font-size: 12px;
    opacity: 0.8;
}

.meta-value {
    font-size: 14px;
    font-weight: 500;
}

.card-labels {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
}

.label-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    border-radius: 12px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.label-tag:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
}

.card-attrs {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-top: auto;
}

.attr-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.15);
    padding: 8px 12px;
    border-radius: 6px;
}

.attr-label {
    font-size: 12px;
    opacity: 0.9;
    min-width: 32px;
}

.attr-value {
    font-size: 14px;
    font-weight: 600;
}

.card-type {
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 6px;
    padding: 6px 14px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.type-label {
    font-size: 13px;
    font-weight: 600;
    color: #667eea;
}

.card-skills {
    padding: 20px;
}

.skills-title {
    font-size: 16px;
    font-weight: 600;
    color: #333;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #667eea;
}

.skill-list {
    max-height: 50vh;
    overflow-y: auto;
}

.skill-card {
    background: #ffffff;
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
    border: 1px solid #e8e8e8;
    transition: all 0.3s ease;
}

.skill-card:hover {
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
    border-color: #667eea;
}

.skill-header {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid #e8e8e8;
}

.skill-no {
    font-size: 11px;
    color: #999;
    background: #f0f0f0;
    padding: 2px 8px;
    border-radius: 4px;
}

.skill-name {
    font-size: 15px;
    font-weight: 600;
    color: #333;
    flex: 1;
}

.skill-cost {
    display: flex;
    align-items: center;
    gap: 2px;
}

.fire-icon {
    font-size: 14px;
}

.fire-icon.zero {
    font-size: 12px;
    color: #999;
    font-weight: normal;
}

.skill-body {
    padding: 12px 16px;
}

.skill-desc {
    font-size: 13px;
    color: #555;
    line-height: 1.6;
    white-space: pre-wrap;
}

.skill-desc.no-desc {
    color: #999;
    font-style: italic;
}

.no-skill {
    text-align: center;
    color: #999;
    padding: 40px 0;
    font-size: 14px;
}

.ant-table-row {
    transition: background-color 0.2s ease;
}

.ant-table-row:hover {
    background-color: #e6f7ff !important;
}

.site-card ::v-deep .ant-pagination {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 8px;
    padding: 16px 0;
    margin-top: 16px;
}

.site-card ::v-deep .ant-pagination-item,
.site-card ::v-deep .ant-pagination-prev,
.site-card ::v-deep .ant-pagination-next {
    min-width: 36px;
    height: 36px;
    line-height: 34px;
    margin: 0;
}

.site-card ::v-deep .ant-pagination-item a {
    display: flex;
    align-items: center;
    justify-content: center;
}

.site-card ::v-deep .ant-pagination-options {
    display: flex;
    align-items: center;
    gap: 8px;
}

.site-card ::v-deep .ant-pagination-options-size-changer {
    margin: 0;
}

.site-card ::v-deep .ant-select-selector {
    min-height: 36px;
}

@media (max-width: 1024px) {
    .site-card ::v-deep .ant-pagination {
        gap: 6px;
    }
    
    .site-card ::v-deep .ant-pagination-item,
    .site-card ::v-deep .ant-pagination-prev,
    .site-card ::v-deep .ant-pagination-next {
        min-width: 34px;
        height: 34px;
        line-height: 32px;
    }
}

@media (max-width: 768px) {
    .site-card {
        padding: 12px;
    }
    
    .site-card ::v-deep .ant-pagination {
        gap: 4px;
        padding: 12px 0;
    }
    
    .site-card ::v-deep .ant-pagination-item,
    .site-card ::v-deep .ant-pagination-prev,
    .site-card ::v-deep .ant-pagination-next {
        min-width: 44px;
        height: 44px;
        line-height: 42px;
    }
    
    .site-card ::v-deep .ant-pagination-item a {
        font-size: 16px;
    }
    
    .site-card ::v-deep .ant-pagination-prev .ant-pagination-item-link,
    .site-card ::v-deep .ant-pagination-next .ant-pagination-item-link {
        font-size: 16px;
    }
    
    .site-card ::v-deep .ant-pagination-options {
        width: 100%;
        justify-content: center;
        margin-top: 8px;
    }
    
    .site-card ::v-deep .ant-pagination-options-size-changer .ant-select-selector {
        min-height: 44px;
        padding: 0 12px;
    }
    
    .site-card ::v-deep .ant-pagination-options-quick-jumper {
        height: 44px;
        line-height: 44px;
    }
    
    .site-card ::v-deep .ant-pagination-options-quick-jumper input {
        width: 60px;
        height: 44px;
    }
    
    .site-card ::v-deep .ant-pagination-total-text {
        width: 100%;
        text-align: center;
        margin-bottom: 8px;
        font-size: 14px;
    }
}

@media (max-width: 480px) {
    .site-card {
        padding: 8px;
    }
    
    .site-card ::v-deep .ant-pagination {
        gap: 4px;
    }
    
    .site-card ::v-deep .ant-pagination-item,
    .site-card ::v-deep .ant-pagination-prev,
    .site-card ::v-deep .ant-pagination-next {
        min-width: 40px;
        height: 40px;
        line-height: 38px;
    }
    
    .site-card ::v-deep .ant-pagination-options-size-changer .ant-select-selector {
        min-height: 40px;
    }
    
    .site-card ::v-deep .ant-pagination-options-quick-jumper input {
        width: 50px;
        height: 40px;
    }
}

@media (max-width: 768px) {
    .card-header {
        flex-direction: column;
        padding: 16px;
    }
    
    .card-avatar-section {
        justify-content: center;
    }
    
    .card-avatar {
        width: 140px;
        min-height: 140px;
        height: 140px;
    }
    
    .card-info-section {
        align-items: center;
        text-align: center;
    }
    
    .card-title-row {
        justify-content: center;
        flex-wrap: wrap;
    }
    
    .card-name {
        font-size: 22px;
    }
    
    .card-meta {
        justify-content: center;
    }
    
    .card-labels {
        justify-content: center;
    }
    
    .card-attrs {
        grid-template-columns: repeat(2, 1fr);
    }
    
    .card-type {
        position: static;
        margin-top: 12px;
    }
}

@media (max-width: 480px) {
    .card-avatar {
        width: 100px;
        height: 100px;
        min-height: 100px;
    }
    
    .card-name {
        font-size: 18px;
    }
    
    .card-attrs {
        grid-template-columns: 1fr;
    }
    
    .card-labels {
        gap: 6px;
    }
    
    .label-tag {
        font-size: 11px;
        padding: 3px 10px;
    }
}
</style>
