<template>
    <div class="team">
        <div class="match-mode-switch">
            <span class="mode-label">比赛模式：</span>
            <a-radio-group v-model="isOfficialMatch" @change="onMatchModeChange" :disabled="!isAdminLoggedIn">
                <a-radio-button :value="false">友谊赛</a-radio-button>
                <a-radio-button :value="true">正赛</a-radio-button>
            </a-radio-group>
            <span class="mode-hint" v-if="isOfficialMatch">
                <a-icon type="info-circle" /> 正赛模式下，经验&lt;3且非公开邀请的选手不可选用
            </span>
        </div>
        
        <div class="team-section">
            <div class="team-title-row">
                <div class="team-title">红队</div>
                <a-select
                    :value="team0Name"
                    class="team-name-select"
                    placeholder="选择队伍"
                    @change="handleTeamNameChange(0, $event)"
                    allowClear
                    showSearch
                    :filterOption="filterTeamName"
                >
                    <a-select-option 
                        v-for="team in recordTeams" 
                        :key="team.id"
                        :value="team.name"
                    >
                        {{ team.name }}
                    </a-select-option>
                </a-select>
            </div>
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
                                    style="width: 165px"
                                    :filterOption="filterHero"
                                    @change="handleSelectChange(0, idx, $event)"
                                    :loading="searchLoading"
                                    :notFoundContent="searchLoading ? '搜索中...' : '无匹配结果'"
                                    allowClear
                                    :dropdownMatchSelectWidth="false"
                                    :dropdownStyle="{ maxWidth: '300px' }"
                                >
                                    <a-select-option 
                                        v-for="hero in getAvailableHeroes(0)" 
                                        :key="hero.no"
                                        :value="hero.no"
                                        :disabled="isHeroDisabled(0, hero.no)"
                                    >
                                        <div class="hero-option">
                                            <span class="hero-rank-tag" :class="'rank-' + hero.rank.toLowerCase()">{{ hero.rank }}</span>
                                            <span class="hero-name">{{ hero.name }}</span>
                                            <span v-if="getHeroExp(0, hero.no) >= 6" class="exp-tag maxed">满</span>
                                            <span v-else-if="getHeroExp(0, hero.no) >= 3" class="exp-tag qualified">{{ getHeroExp(0, hero.no) }}</span>
                                            <span v-else class="exp-tag unqualified">{{ getHeroExp(0, hero.no) }}</span>
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
                                    @change="handleChange2(0, idx, label.key, $event)" class="attr-input" 
                                    :disabled="!isAdminLoggedIn" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <a-divider style="margin: 8px 0;" />
        
        <div class="team-section">
            <div class="team-title-row">
                <div class="team-title">蓝队</div>
                <a-select
                    :value="team1Name"
                    class="team-name-select"
                    placeholder="选择队伍"
                    @change="handleTeamNameChange(1, $event)"
                    allowClear
                    showSearch
                    :filterOption="filterTeamName"
                >
                    <a-select-option 
                        v-for="team in recordTeams" 
                        :key="team.id"
                        :value="team.name"
                    >
                        {{ team.name }}
                    </a-select-option>
                </a-select>
            </div>
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
                                    style="width: 165px"
                                    :filterOption="filterHero"
                                    @change="handleSelectChange(1, idx, $event)"
                                    :loading="searchLoading"
                                    :notFoundContent="searchLoading ? '搜索中...' : '无匹配结果'"
                                    allowClear
                                    :dropdownMatchSelectWidth="false"
                                    :dropdownStyle="{ maxWidth: '300px' }"
                                >
                                    <a-select-option 
                                        v-for="hero in getAvailableHeroes(1)" 
                                        :key="hero.no"
                                        :value="hero.no"
                                        :disabled="isHeroDisabled(1, hero.no)"
                                    >
                                        <div class="hero-option">
                                            <span class="hero-rank-tag" :class="'rank-' + hero.rank.toLowerCase()">{{ hero.rank }}</span>
                                            <span class="hero-name">{{ hero.name }}</span>
                                            <span v-if="getHeroExp(1, hero.no) >= 6" class="exp-tag maxed">满</span>
                                            <span v-else-if="getHeroExp(1, hero.no) >= 3" class="exp-tag qualified">{{ getHeroExp(1, hero.no) }}</span>
                                            <span v-else class="exp-tag unqualified">{{ getHeroExp(1, hero.no) }}</span>
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
                                    @change="handleChange2(1, idx, label.key, $event)" class="attr-input" 
                                    :disabled="!isAdminLoggedIn" />
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
    import CryptoJS from 'crypto-js';

    const ENCRYPTION_KEY = 'cdgame-record-secret-key-2024';

    function decryptData(encrypted) {
        try {
            const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
            return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch (e) {
            return null;
        }
    }

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
                recordTeams: [],
                recordData: null,
            }
        },
        computed: {
            ...mapState(['team0', "team1", "maxedStatus", "soulSelections", "team0Name", "team1Name", "isOfficialMatch", "isAdminLoggedIn"])
        },
        watch: {
            team0: {
                handler() {
                    this.autoSetMaxedStatus(0);
                },
                deep: true,
            },
            team1: {
                handler() {
                    this.autoSetMaxedStatus(1);
                },
                deep: true,
            },
            team0Name() {
                this.autoSetMaxedStatus(0);
            },
            team1Name() {
                this.autoSetMaxedStatus(1);
            },
        },
        mounted() {
            this.loadRecordTeams();
        },
        methods: {
            loadRecordTeams() {
                try {
                    const encrypted = localStorage.getItem('cdgame_record_data');
                    if (encrypted) {
                        const data = decryptData(encrypted);
                        if (data && data.teams) {
                            this.recordTeams = data.teams;
                            this.recordData = data;
                        }
                    }
                } catch (e) {
                    console.error('加载队伍战绩数据失败:', e);
                }
            },
            onMatchModeChange(e) {
                const value = e.target ? e.target.value : e;
                this.$store.commit('SET_OFFICIAL_MATCH', value);
                this.autoSetMaxedStatus(0);
                this.autoSetMaxedStatus(1);
            },
            getTeamRecord(teamId) {
                const teamName = teamId === 0 ? this.team0Name : this.team1Name;
                if (!teamName || !this.recordTeams) return null;
                return this.recordTeams.find(t => t.name === teamName);
            },
            getHeroExp(teamId, heroNo) {
                const teamRecord = this.getTeamRecord(teamId);
                if (!teamRecord || !teamRecord.heroExps) return 0;
                const heroId = this.getHeroIdByNo(heroNo);
                return teamRecord.heroExps[heroId] || 0;
            },
            isPublicInviteHero(teamId, heroNo) {
                const teamRecord = this.getTeamRecord(teamId);
                if (!teamRecord || !teamRecord.drawnHeroIds) return false;
                const heroId = this.getHeroIdByNo(heroNo);
                return teamRecord.drawnHeroIds.includes(heroId);
            },
            getHeroIdByNo(heroNo) {
                return String(heroNo);
            },
            isHeroDisabled(teamId, heroNo) {
                if (!this.isOfficialMatch) return false;
                const exp = this.getHeroExp(teamId, heroNo);
                const isPublicInvite = this.isPublicInviteHero(teamId, heroNo);
                return exp < 3 && !isPublicInvite;
            },
            getAvailableHeroes(teamId) {
                return this.flatHeroList;
            },
            autoSetMaxedStatus(teamId) {
                const team = teamId === 0 ? this.team0 : this.team1;
                team.forEach((member, idx) => {
                    if (member.no) {
                        const exp = this.getHeroExp(teamId, member.no);
                        const shouldBeMaxed = exp >= 6;
                        const currentMaxed = this.maxedStatus[teamId][idx];
                        if (shouldBeMaxed && !currentMaxed) {
                            this.$store.commit('SET_MAXED', { teamId, index: idx, maxed: true });
                        } else if (!shouldBeMaxed && currentMaxed) {
                            this.$store.commit('SET_MAXED', { teamId, index: idx, maxed: false });
                        }
                    }
                });
            },
            handleTeamNameChange(teamId, name) {
                this.$store.commit('UPDATE_TEAM_NAME', { teamId, name: name || '' });
            },
            filterTeamName(input, option) {
                if (!input) return true;
                const searchStr = input.toLowerCase().trim();
                const teamName = option.componentOptions.propsData.value.toLowerCase();
                return teamName.includes(searchStr);
            },
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
        width: 100%;
        box-sizing: border-box;
    }
    
    .match-mode-switch {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        padding: 8px 12px;
        background: #fafafa;
        border-radius: 4px;
    }
    
    .mode-label {
        font-weight: 600;
        color: #333;
    }
    
    .mode-hint {
        font-size: 12px;
        color: #faad14;
        margin-left: 12px;
    }
    
    .team-section {
        margin-bottom: 4px;
    }
    
    .team-title-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 4px;
        padding-left: 4px;
    }
    
    .team-name-select {
        width: 150px;
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
        gap: 6px;
        max-width: 180px;
    }
    
    .hero-rank-tag {
        display: inline-block;
        padding: 1px 5px;
        font-size: 10px;
        font-weight: bold;
        border-radius: 3px;
        text-transform: uppercase;
        min-width: 22px;
        text-align: center;
        flex-shrink: 0;
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
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    
    .exp-tag {
        font-size: 10px;
        padding: 1px 4px;
        border-radius: 2px;
        flex-shrink: 0;
    }
    
    .exp-tag.maxed {
        background: #52c41a;
        color: white;
    }
    
    .exp-tag.qualified {
        background: #1890ff;
        color: white;
    }
    
    .exp-tag.unqualified {
        background: #d9d9d9;
        color: #8c8c8c;
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
    
    .col-select >>> .ant-select-dropdown-menu-item-disabled {
        color: rgba(0, 0, 0, 0.25);
        cursor: not-allowed;
    }
</style>
