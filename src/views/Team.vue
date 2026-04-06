<template>
    <div class="team">
        <div class="team-section">
            <div class="team-title">红队</div>
            <div class="table-container">
                <table class="attr-table">
                    <thead>
                        <tr>
                            <th class="col-role">角色</th>
                            <th class="col-select">选手</th>
                            <th class="col-soul">御魂</th>
                            <th class="col-attr" v-for="label in attrLabels" :key="label.key">{{ label.text }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(member, idx) in team0" :key="'t0_'+idx" :class="{'maxed-highlight': maxedStatus[0][idx]}">
                            <td class="col-role">
                                <span class="position-name">{{ positionLabels[idx] }}</span>
                                <a-button 
                                    :type="maxedStatus[0][idx] ? 'primary' : 'default'"
                                    size="small"
                                    @click="toggleMaxed(0, idx)"
                                    class="maxed-btn"
                                    :class="{'maxed-btn-active': maxedStatus[0][idx]}"
                                >满</a-button>
                            </td>
                            <td class="col-select">
                                <a-select
                                    showSearch
                                    :value="member.no || undefined"
                                    placeholder="输入选手姓名"
                                    style="width: 140px"
                                    :filterOption="filterHero"
                                    @change="handleSelectChange(0, idx, $event)"
                                    :loading="searchLoading"
                                    :notFoundContent="searchLoading ? '搜索中...' : '无匹配结果'"
                                    allowClear
                                    :dropdownMatchSelectWidth="false"
                                    :dropdownStyle="{ maxWidth: '300px' }"
                                >
                                    <a-select-option 
                                        v-for="hero in flatHeroList" 
                                        :key="hero.no"
                                        :value="hero.no"
                                    >
                                        <div class="hero-option">
                                            <span class="hero-rank-tag" :class="'rank-' + hero.rank.toLowerCase()">{{ hero.rank }}</span>
                                            <span class="hero-name">{{ hero.name }}</span>
                                        </div>
                                    </a-select-option>
                                </a-select>
                            </td>
                            <td class="col-soul">
                                <div class="soul-selector">
                                    <div class="selected-souls">
                                        <a-tag 
                                            v-for="soulId in getSoulSelections(0, idx)" 
                                            :key="soulId"
                                            closable
                                            @close="removeSoul(0, idx, soulId)"
                                            class="soul-tag"
                                        >
                                            {{ getSoulName(soulId) }}
                                        </a-tag>
                                    </div>
                                    <a-dropdown :trigger="['click']" v-if="getSoulSelections(0, idx).length < 3">
                                        <a-button size="small" class="add-soul-btn">
                                            <a-icon type="plus" />
                                        </a-button>
                                        <a-menu slot="overlay" @click="handleSoulMenuClick(0, idx, $event)">
                                            <a-menu-item 
                                                v-for="soul in availableSouls(0, idx)" 
                                                :key="soul.id"
                                            >
                                                {{ soul.name }}
                                            </a-menu-item>
                                        </a-menu>
                                    </a-dropdown>
                                    <span v-else class="soul-limit-hint">已满</span>
                                </div>
                            </td>
                            <td class="col-attr" v-for="label in attrLabels" :key="label.key">
                                <a-input-number
                                    :value="member[label.key]" :min="label.min" :max="label.max" :precision="label.precision"
                                    @change="handleChange2(0, idx, label.key, $event)" class="attr-input" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <a-divider style="margin: 8px 0;" />
        
        <div class="team-section">
            <div class="team-title">蓝队</div>
            <div class="table-container">
                <table class="attr-table">
                    <thead>
                        <tr>
                            <th class="col-role">角色</th>
                            <th class="col-select">选手</th>
                            <th class="col-soul">御魂</th>
                            <th class="col-attr" v-for="label in attrLabels" :key="label.key">{{ label.text }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(member, idx) in team1" :key="'t1_'+idx" :class="{'maxed-highlight': maxedStatus[1][idx]}">
                            <td class="col-role">
                                <span class="position-name">{{ positionLabels[idx] }}</span>
                                <a-button 
                                    :type="maxedStatus[1][idx] ? 'primary' : 'default'"
                                    size="small"
                                    @click="toggleMaxed(1, idx)"
                                    class="maxed-btn"
                                    :class="{'maxed-btn-active': maxedStatus[1][idx]}"
                                >满</a-button>
                            </td>
                            <td class="col-select">
                                <a-select
                                    showSearch
                                    :value="member.no || undefined"
                                    placeholder="输入选手姓名"
                                    style="width: 140px"
                                    :filterOption="filterHero"
                                    @change="handleSelectChange(1, idx, $event)"
                                    :loading="searchLoading"
                                    :notFoundContent="searchLoading ? '搜索中...' : '无匹配结果'"
                                    allowClear
                                    :dropdownMatchSelectWidth="false"
                                    :dropdownStyle="{ maxWidth: '300px' }"
                                >
                                    <a-select-option 
                                        v-for="hero in flatHeroList" 
                                        :key="hero.no"
                                        :value="hero.no"
                                    >
                                        <div class="hero-option">
                                            <span class="hero-rank-tag" :class="'rank-' + hero.rank.toLowerCase()">{{ hero.rank }}</span>
                                            <span class="hero-name">{{ hero.name }}</span>
                                        </div>
                                    </a-select-option>
                                </a-select>
                            </td>
                            <td class="col-soul">
                                <div class="soul-selector">
                                    <div class="selected-souls">
                                        <a-tag 
                                            v-for="soulId in getSoulSelections(1, idx)" 
                                            :key="soulId"
                                            closable
                                            @close="removeSoul(1, idx, soulId)"
                                            class="soul-tag"
                                        >
                                            {{ getSoulName(soulId) }}
                                        </a-tag>
                                    </div>
                                    <a-dropdown :trigger="['click']" v-if="getSoulSelections(1, idx).length < 3">
                                        <a-button size="small" class="add-soul-btn">
                                            <a-icon type="plus" />
                                        </a-button>
                                        <a-menu slot="overlay" @click="handleSoulMenuClick(1, idx, $event)">
                                            <a-menu-item 
                                                v-for="soul in availableSouls(1, idx)" 
                                                :key="soul.id"
                                            >
                                                {{ soul.name }}
                                            </a-menu-item>
                                        </a-menu>
                                    </a-dropdown>
                                    <span v-else class="soul-limit-hint">已满</span>
                                </div>
                            </td>
                            <td class="col-attr" v-for="label in attrLabels" :key="label.key">
                                <a-input-number
                                    :value="member[label.key]" :min="label.min" :max="label.max" :precision="label.precision"
                                    @change="handleChange2(1, idx, label.key, $event)" class="attr-input" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script>
    import { HeroData, SoulData } from '../../core'
    import {mapState} from 'vuex'

    export default {
        data() {
            return {
                positionLabels: ['教练', '先锋', '次锋', '中坚', '副将', '大将', '替补', '应援'],
                attrLabels: [
                    { key: 'max_hp', text: '生命', min: 0, max: 1e10, precision: 0 },
                    { key: 'atk', text: '攻击', min: 0, max: 100000, precision: 2 },
                    { key: 'def', text: '防御', min: 0, max: 100000, precision: 2 },
                    { key: 'spd', text: '速度', min: 0, max: 1000, precision: 2 },
                    { key: 'cri', text: '暴击', min: 0, max: 10, precision: 4 },
                    { key: 'cri_dmg', text: '爆伤', min: 0, max: 10, precision: 4 },
                    { key: 'eft_hit', text: '命中', min: 0, max: 10000, precision: 2 },
                    { key: 'eft_res', text: '抵抗', min: 0, max: 10000, precision: 2 },
                ],
                flatHeroList: HeroData.filter(hero => hero.show === 1).map(hero => ({
                    no: hero.no,
                    name: hero.name,
                    rank: hero.rank.toUpperCase(),
                })),
                heroList: HeroData.filter(hero => hero.show === 1).reduce((list, hero) => {
                    const p = list.find(d => d.value.toUpperCase() === hero.rank.toUpperCase());
                    if (p) {
                        p.children.push({
                            value: hero.no,
                            label: hero.name,
                        });
                    }
                    return list;
                }, [{
                    value: 'd',
                    label: 'D',
                    children: [],
                },{
                    value: 'c',
                    label: 'C',
                    children: [],
                },{
                    value: 'ssr',
                    label: 'SSR',
                    children: [],
                },{
                    value: 'n',
                    label: 'N',
                    children: [],
                }]).filter(category => category.children.length > 0),
                soulData: SoulData,
                searchLoading: false,
                searchTimer: null,
            }
        },
        computed: {
            ...mapState(['team0', "team1", "maxedStatus", "soulSelections"])
        },
        methods: {
            filterHero(input, option) {
                if (!input) return true;
                const searchStr = input.toLowerCase().trim();
                const heroName = option.componentOptions.children[0].children[1].children[0].text.toLowerCase();
                return heroName.includes(searchStr);
            },
            handleSelectChange(teamId, index, value) {
                if (value === undefined) {
                    this.$store.commit('UPDATE_TEAM_MEMBER', {teamId, index, no: null});
                } else {
                    const no = Number(value);
                    this.$store.commit('UPDATE_TEAM_MEMBER', {teamId, index, no});
                }
            },
            handleChange(teamId, index, seletions) {
                if (!seletions || seletions.length < 2) return;
                const no = Number(seletions[1]);
                this.$store.commit('UPDATE_TEAM_MEMBER', {teamId, index, no});
            },
            handleChange2(teamId, index, key, v) {
                const team = teamId === 0 ? this.team0 : this.team1;
                const currentNo = team[index].no;
                this.$store.commit('UPDATE_TEAM_MEMBER', {teamId, index, no: currentNo, [key]: v});
            },
            toggleMaxed(teamId, index) {
                this.$store.commit('TOGGLE_MAXED', {teamId, index});
            },
            getSoulSelections(teamId, index) {
                return this.soulSelections[teamId][index] || [];
            },
            getSoulName(soulId) {
                const soul = this.soulData.find(s => s.id === soulId);
                return soul ? soul.name : soulId;
            },
            availableSouls(teamId, index) {
                const selected = this.getSoulSelections(teamId, index);
                return this.soulData.filter(soul => !selected.includes(soul.id));
            },
            handleSoulMenuClick(teamId, index, event) {
                const soulId = event.key;
                this.$store.commit('ADD_SOUL', {teamId, index, soulId});
            },
            removeSoul(teamId, index, soulId) {
                this.$store.commit('REMOVE_SOUL', {teamId, index, soulId});
            },
            convert(no) {
                if (!no) return [];
                const noNum = Number(no);
                for(const o of this.heroList) {
                    for(const c of o.children) {
                        if (Number(c.value) === noNum || c.value === no) {
                            return [o.value ,c.value];
                        }
                    }
                }
                return [];
            }
        }
    }
</script>

<style scoped>
    .team {
        display: flex;
        justify-content: center;
        flex-direction: column;
        padding: 8px;
        max-width: 1400px;
        margin: 0 auto;
    }
    
    .team-section {
        margin-bottom: 4px;
    }
    
    .table-container {
        overflow-x: auto;
        overflow-y: auto;
        max-height: 400px;
        border: 1px solid #f0f0f0;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        transition: all 0.3s ease;
        
        &:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
    }
    
    .team-title {
        font-size: 14px;
        font-weight: bold;
        color: #333;
        margin-bottom: 4px;
        padding-left: 4px;
    }
    
    .attr-table {
        width: 100%;
        border-collapse: collapse;
        border-spacing: 0;
        table-layout: fixed;
    }
    
    .attr-table thead tr {
        background-color: #fafafa;
        border-bottom: 2px solid #e8e8e8;
    }
    
    .attr-table th {
        font-size: 12px;
        font-weight: 600;
        color: #666;
        text-align: center;
        padding: 6px 4px;
        vertical-align: middle;
    }
    
    .attr-table th.col-role {
        width: 80px;
        text-align: left;
        padding-left: 8px;
    }
    
    .attr-table th.col-select {
        width: 130px;
        text-align: center;
    }
    
    .attr-table th.col-soul {
        width: 180px;
        text-align: center;
    }
    
    .attr-table th.col-attr {
        width: 100px;
        text-align: center;
    }
    
    .attr-table tbody tr {
        border-bottom: 1px solid #f0f0f0;
        transition: all 0.3s ease;
    }
    
    .attr-table tbody tr:hover {
        background-color: #fafafa;
    }
    
    .attr-table tbody tr.maxed-highlight {
        background-color: #e6f7ff;
    }
    
    .attr-table tbody tr.maxed-highlight:hover {
        background-color: #bae7ff;
    }
    
    .attr-table td {
        padding: 4px;
        vertical-align: middle;
    }
    
    .attr-table td.col-role {
        text-align: left;
        padding-left: 8px;
    }
    
    .attr-table td.col-select {
        text-align: center;
    }
    
    .attr-table td.col-soul {
        text-align: left;
        padding: 4px 8px;
    }
    
    .attr-table td.col-attr {
        text-align: center;
    }
    
    .position-name {
        font-size: 12px;
        color: #333;
        margin-right: 4px;
    }
    
    .attr-table tr.maxed-highlight .position-name {
        color: #1890ff;
        font-weight: bold;
    }
    
    .maxed-btn {
        padding: 0 6px;
        font-size: 11px;
        height: 20px;
        line-height: 18px;
        border-radius: 3px;
        transition: all 0.2s ease;
    }
    
    .maxed-btn:hover {
        transform: scale(1.05);
    }
    
    .maxed-btn:active {
        transform: scale(0.95);
    }
    
    .maxed-btn-active {
        font-weight: bold;
        box-shadow: 0 2px 4px rgba(24, 144, 255, 0.3);
    }
    
    .attr-input {
        width: 95px !important;
    }
    
    .attr-input >>> .ant-input-number-input {
        text-align: center;
        font-size: 12px;
    }
    
    .soul-selector {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
    }
    
    .selected-souls {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }
    
    .soul-tag {
        margin: 0;
        font-size: 11px;
        line-height: 18px;
        padding: 0 4px;
        border-radius: 3px;
    }
    
    .add-soul-btn {
        padding: 0 6px;
        font-size: 11px;
        height: 20px;
        line-height: 18px;
        border-radius: 3px;
    }
    
    .soul-limit-hint {
        font-size: 11px;
        color: #999;
        margin-left: 4px;
    }
    
    .hero-option {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    
    .hero-rank-tag {
        display: inline-block;
        padding: 1px 6px;
        font-size: 10px;
        font-weight: bold;
        border-radius: 3px;
        text-transform: uppercase;
        min-width: 28px;
        text-align: center;
    }
    
    .hero-rank-tag.rank-ssr {
        background: linear-gradient(135deg, #ff9a56 0%, #ff6b6b 100%);
        color: white;
    }
    
    .hero-rank-tag.rank-d {
        background: #e8e8e8;
        color: #666;
    }
    
    .hero-rank-tag.rank-c {
        background: #b7eb8f;
        color: #389e0d;
    }
    
    .hero-rank-tag.rank-n {
        background: #d9d9d9;
        color: #8c8c8c;
    }
    
    .hero-name {
        font-size: 13px;
        color: #333;
    }
    
    .col-select >>> .ant-select-selection--single {
        height: 28px;
    }
    
    .col-select >>> .ant-select-selection__rendered {
        line-height: 26px;
    }
    
    .col-select >>> .ant-select-dropdown-menu-item {
        padding: 6px 12px;
    }
</style>
