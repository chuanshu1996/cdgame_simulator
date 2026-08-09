<template>
    <div class="site-card">
        <h2 class="soul-title">御魂图鉴</h2>
        
        <div class="soul-filter-section">
            <a-select
                v-model="selectedProperty"
                placeholder="按属性筛选"
                style="width: 200px"
                @change="handlePropertyFilter"
            >
                <a-select-option value="">全部</a-select-option>
                <a-select-option value="max_hp">生命加成</a-select-option>
                <a-select-option value="atk">攻击加成</a-select-option>
                <a-select-option value="def">防御加成</a-select-option>
                <a-select-option value="spd">速度加成</a-select-option>
                <a-select-option value="cri">暴击加成</a-select-option>
                <a-select-option value="cri_dmg">暴击伤害加成</a-select-option>
                <a-select-option value="eft_hit">效果命中加成</a-select-option>
                <a-select-option value="eft_res">效果抵抗加成</a-select-option>
                <a-select-option value="special">特殊效果</a-select-option>
            </a-select>
        </div>
        
        <a-table
                :columns="soulColumns"
                :rowKey="record => record.id"
                :dataSource="filteredSoulData"
                :pagination="false"
                :scroll="{ x: 'max-content' }"
        >
            <span slot="effects" slot-scope="effects">
                <div v-for="(category, categoryName) in categorizeEffects(effects)" :key="categoryName" class="soul-effect-category">
                    <div class="category-title">{{ getCategoryDisplayName(categoryName) }}</div>
                    <div v-for="(effect, index) in category" :key="index" class="soul-effect-item">
                        {{ effect.description }}
                    </div>
                </div>
            </span>
        </a-table>
    </div>
</template>

<script>
    import {SoulData} from '../../core/soul'
    import {BattleProperties} from '../../core/constant'

    const soulColumns = [
        {
            title: '御魂名称',
            dataIndex: 'name',
            width: 120,
            sorter: (a, b) => a.name.localeCompare(b.name, 'zh-CN'),
        },
        {
            title: '御魂描述',
            dataIndex: 'description',
            width: 200,
        },
        {
            title: '效果',
            dataIndex: 'effects',
            scopedSlots: {customRender: 'effects'},
            width: 300,
        },
    ];

    export default {
        data() {
            return {
                soulData: SoulData,
                soulColumns,
                selectedProperty: '',
            }
        },
        computed: {
            filteredSoulData() {
                if (!this.selectedProperty) {
                    return this.soulData;
                }
                
                return this.soulData.filter(soul => {
                    if (this.selectedProperty === 'special') {
                        // 筛选具有特殊效果的御魂
                        return soul.effects.some(effect => 
                            effect.type !== 'property_buff' || !effect.propertyBuff
                        );
                    } else {
                        // 筛选具有特定属性加成的御魂
                        return soul.effects.some(effect => 
                            effect.type === 'property_buff' && 
                            effect.propertyBuff && 
                            effect.propertyBuff.propertyName === this.selectedProperty
                        );
                    }
                });
            }
        },
        methods: {
            categorizeEffects(effects) {
                const categories = {
                    'max_hp': [],
                    'atk': [],
                    'def': [],
                    'spd': [],
                    'cri': [],
                    'cri_dmg': [],
                    'eft_hit': [],
                    'eft_res': [],
                    'special': []
                };
                
                effects.forEach(effect => {
                    if (effect.type === 'property_buff' && effect.propertyBuff) {
                        const propertyName = effect.propertyBuff.propertyName;
                        if (Object.prototype.hasOwnProperty.call(categories, propertyName)) {
                            categories[propertyName].push(effect);
                        } else {
                            categories.special.push(effect);
                        }
                    } else {
                        categories.special.push(effect);
                    }
                });
                
                // 过滤空分类
                Object.keys(categories).forEach(key => {
                    if (categories[key].length === 0) {
                        delete categories[key];
                    }
                });
                
                return categories;
            },
            getCategoryDisplayName(categoryName) {
                const propertyNames = {
                    'max_hp': '生命加成',
                    'atk': '攻击加成',
                    'def': '防御加成',
                    'spd': '速度加成',
                    'cri': '暴击加成',
                    'cri_dmg': '暴击伤害加成',
                    'eft_hit': '效果命中加成',
                    'eft_res': '效果抵抗加成',
                    'special': '特殊效果'
                };
                return propertyNames[categoryName] || categoryName;
            },
            handlePropertyFilter(value) {
                this.selectedProperty = value;
            }
        }
    }
</script>

<style scoped>
.soul-title {
    font-size: 20px;
    font-weight: 600;
    color: #333;
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 2px solid #667eea;
}

.soul-filter-section {
    margin-bottom: 20px;
}

.soul-effect-category {
    margin-bottom: 12px;
}

.category-title {
    font-size: 12px;
    font-weight: 600;
    color: #1890ff;
    margin-bottom: 4px;
    padding-bottom: 2px;
    border-bottom: 1px solid #e8e8e8;
}

.soul-effect-item {
    padding: 4px 0 4px 12px;
    font-size: 13px;
    color: #555;
    line-height: 1.4;
}

.soul-list-section ::v-deep .ant-table-row {
    transition: background-color 0.2s ease;
}

.soul-list-section ::v-deep .ant-table-row:hover {
    background-color: #e6f7ff !important;
}

.soul-list-section ::v-deep .ant-table-thead > tr > th {
    background-color: #f8f9fa;
    font-weight: 600;
    color: #333;
    border-bottom: 2px solid #667eea;
}

.soul-list-section ::v-deep .ant-table-tbody > tr > td {
    border-bottom: 1px solid #f0f0f0;
}

@media (max-width: 768px) {
    .soul-title {
        font-size: 18px;
        margin-bottom: 20px;
        padding-bottom: 10px;
    }
    
    .soul-filter-section {
        margin-bottom: 16px;
    }
    
    .soul-effect-item {
        font-size: 12px;
        padding-left: 8px;
    }
    
    .category-title {
        font-size: 11px;
    }
}

@media (max-width: 480px) {
    .soul-title {
        font-size: 16px;
        margin-bottom: 16px;
        padding-bottom: 8px;
    }
    
    .soul-filter-section {
        margin-bottom: 12px;
    }
    
    .soul-effect-item {
        font-size: 11px;
    }
}
</style>