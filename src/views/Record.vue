<template>
    <div class="record-page">
        <div class="page-header">
            <h2>队伍战绩</h2>
            <div class="header-actions">
                <a-button v-if="!isAdminLoggedIn && !isEditMode" type="primary" @click.native="showPasswordModal">
                    <a-icon type="lock" />解锁编辑
                </a-button>
                <a-button v-if="isAdminLoggedIn && !isEditMode" type="primary" @click.native="adminUnlock">
                    <a-icon type="unlock" />解锁编辑
                </a-button>
                <a-button v-if="isEditMode" type="danger" @click.native="logout">
                    <a-icon type="logout" />锁定
                </a-button>
                <a-button v-if="isEditMode" type="primary" @click.native="saveData" :loading="saving">
                    <a-icon type="save" />保存
                </a-button>
                <a-button v-if="isEditMode" @click.native="showDrawModal">
                    <a-icon type="gift" />抽取公开邀请选手
                </a-button>
                <a-checkbox v-model="showAllHeroes" v-if="isEditMode">
                    显示全部选手
                </a-checkbox>
            </div>
        </div>

        <div class="table-container" ref="tableContainer">
            <table class="record-table">
                <thead>
                    <tr>
                        <th class="fixed-col rank-col">排名</th>
                        <th class="fixed-col team-col">
                            <a-dropdown :trigger="['click']" placement="bottomLeft">
                                <div class="team-header-clickable">
                                    <span>队伍</span>
                                    <a-icon type="filter" :class="{ 'filter-active': selectedTeamIds.length > 0 }" />
                                </div>
                                <a-menu slot="overlay" class="team-filter-menu">
                                    <a-menu-item key="select-all">
                                        <a-checkbox 
                                            :indeterminate="isIndeterminate" 
                                            :checked="isAllSelected"
                                            @change="toggleSelectAllTeams">
                                            全选
                                        </a-checkbox>
                                    </a-menu-item>
                                    <a-menu-divider />
                                    <a-menu-item v-for="team in teams" :key="team.id">
                                        <a-checkbox 
                                            :checked="selectedTeamIds.includes(team.id)"
                                            @change="toggleTeamSelection(team.id)">
                                            {{ team.name }}
                                        </a-checkbox>
                                    </a-menu-item>
                                </a-menu>
                            </a-dropdown>
                        </th>
                        <th @click="toggleSort('matches')">
                            小场
                            <span v-if="sortField === 'matches'" class="sort-icon">
                                {{ sortOrder === 'asc' ? '↑' : '↓' }}
                            </span>
                        </th>
                        <th @click="toggleSort('jade')">
                            勾玉
                            <span v-if="sortField === 'jade'" class="sort-icon">
                                {{ sortOrder === 'asc' ? '↑' : '↓' }}
                            </span>
                        </th>
                        <th @click="toggleSort('wins')">
                            胜场
                            <span v-if="sortField === 'wins'" class="sort-icon">
                                {{ sortOrder === 'asc' ? '↑' : '↓' }}
                            </span>
                        </th>
                        <th @click="toggleSort('losses')">
                            负场
                            <span v-if="sortField === 'losses'" class="sort-icon">
                                {{ sortOrder === 'asc' ? '↑' : '↓' }}
                            </span>
                        </th>
                        <th @click="toggleSort('score')">
                            小分
                            <span v-if="sortField === 'score'" class="sort-icon">
                                {{ sortOrder === 'asc' ? '↑' : '↓' }}
                            </span>
                        </th>
                        <th class="hero-col">选手</th>
                        <th class="soul-col">御魂</th>
                        <th v-if="isEditMode" class="action-col">操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(team, teamIndex) in filteredTeams" :key="team.id" 
                        :class="{ 'highlight-row': team.isDrawTarget }">
                        <td class="fixed-col rank-col">
                            {{ getTeamRank(team) }}
                        </td>
                        <td class="fixed-col team-col">
                            <template v-if="isEditMode">
                                <a-input v-model="team.name" 
                                         @change="markModified"
                                         class="team-name-input" />
                            </template>
                            <template v-else>
                                {{ team.name }}
                            </template>
                        </td>
                        <td>
                            <template v-if="isEditMode">
                                <a-input-number v-model="team.matches" 
                                               :min="0" 
                                               @change="markModified"
                                               class="num-input" />
                            </template>
                            <template v-else>{{ team.matches }}</template>
                        </td>
                        <td>
                            <template v-if="isEditMode">
                                <a-input-number v-model="team.jade" 
                                               :min="0" 
                                               @change="markModified"
                                               class="num-input" />
                            </template>
                            <template v-else>{{ team.jade }}</template>
                        </td>
                        <td>
                            <template v-if="isEditMode">
                                <a-input-number v-model="team.wins" 
                                               :min="0" 
                                               @change="markModified"
                                               class="num-input" />
                            </template>
                            <template v-else>{{ team.wins }}</template>
                        </td>
                        <td>
                            <template v-if="isEditMode">
                                <a-input-number v-model="team.losses" 
                                               :min="0" 
                                               @change="markModified"
                                               class="num-input" />
                            </template>
                            <template v-else>{{ team.losses }}</template>
                        </td>
                        <td>
                            <template v-if="isEditMode">
                                <a-input-number v-model="team.score" 
                                               :min="0" 
                                               @change="markModified"
                                               class="num-input" />
                            </template>
                            <template v-else>{{ team.score }}</template>
                        </td>
                        <td class="hero-col">
                            <div class="heroes-container">
                                <template v-if="isEditMode">
                                    <div v-for="heroId in heroIdList" :key="'hero-' + team.id + '-' + heroId" class="hero-item-inline">
                                        <span class="hero-name">{{ getHeroName(heroId) }}</span>
                                        <a-input-number 
                                            :value="getHeroExp(team, heroId)"
                                            :min="0" :max="6"
                                            size="small"
                                            @change="handleExpChange(team, heroId, $event)"
                                            class="exp-input" />
                                    </div>
                                </template>
                                <template v-else>
                                    <span v-for="heroId in heroIdList" :key="'hero-' + team.id + '-' + heroId" class="hero-item-inline">
                                        <template v-if="shouldShowHero(getHeroExp(team, heroId))">
                                            <span class="hero-cell" @click="showHeroDetail(heroId)">
                                                {{ getHeroName(heroId) }} {{ getHeroExp(team, heroId) }}/6
                                            </span>
                                        </template>
                                    </span>
                                </template>
                            </div>
                        </td>
                        <td class="soul-col">
                            <div class="souls-container">
                                <div v-for="(soul, soulIndex) in team.souls" :key="'soul-' + team.id + '-' + soulIndex" class="soul-item">
                                    <template v-if="isEditMode">
                                        <div class="edit-row">
                                            <a-select 
                                                :value="soul ? soul.id : undefined"
                                                placeholder="选择御魂"
                                                size="small"
                                                @change="handleSoulChange(team, soulIndex, $event)"
                                                class="soul-select"
                                                allowClear>
                                                <a-select-option v-for="s in soulList" 
                                                                :key="s.id" 
                                                                :value="s.id">
                                                    {{ s.name }}
                                                </a-select-option>
                                            </a-select>
                                            <a-input-number 
                                                v-if="soul && soul.id"
                                                :value="soul.count"
                                                :min="1"
                                                size="small"
                                                @change="handleCountChange(team, soulIndex, $event)"
                                                class="count-input" />
                                            <a-button type="link" size="small" @click.native="removeSoul(team, soulIndex)" class="remove-btn">
                                                <a-icon type="close" />
                                            </a-button>
                                        </div>
                                    </template>
                                    <template v-else>
                                        <template v-if="soul && soul.id">
                                            <span class="soul-cell" @click="showSoulDetail(soul)">
                                                {{ soul.name }}*{{ soul.count }}
                                            </span>
                                        </template>
                                    </template>
                                </div>
                                <a-button v-if="isEditMode" type="dashed" size="small" @click.native="addSoul(team)" class="add-btn">
                                    <a-icon type="plus" />添加御魂
                                </a-button>
                            </div>
                        </td>
                        <td v-if="isEditMode" class="action-col">
                            <a-button type="danger" size="small" @click.native="removeTeam(teamIndex)">
                                <a-icon type="delete" />
                            </a-button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div v-if="isEditMode" class="add-team-section">
            <a-button type="dashed" @click.native="addTeam">
                <a-icon type="plus" />新增队伍
            </a-button>
        </div>

        <a-modal 
            v-model="passwordModalVisible" 
            title="输入密码解锁编辑" 
            @ok="verifyPassword" 
            @cancel="closePasswordModal"
            :maskClosable="false"
            okText="确认"
            cancelText="取消">
            <a-input-password 
                v-model="inputPassword" 
                placeholder="请输入密码" 
                @pressEnter="verifyPassword"
                ref="passwordInput" />
            <p v-if="passwordError" class="error-text">{{ passwordError }}</p>
        </a-modal>

        <a-modal 
            v-model="heroDetailVisible" 
            :footer="null"
            width="750px"
            class="card-detail-modal"
            :bodyStyle="{ padding: 0 }"
        >
            <div v-if="currentHero" class="card-detail">
                <div class="card-header">
                    <div class="card-avatar-section">
                        <img :src="getAvatarPath(currentHero.no)" class="card-avatar" />
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
                                <span class="attr-value">{{ currentHero.eft_hit || '0%' }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">抵抗</span>
                                <span class="attr-value">{{ currentHero.eft_res || '0%' }}</span>
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

        <a-modal v-model="soulDetailVisible" :title="currentSoul ? currentSoul.name : '御魂详情'" 
                 width="500px" :footer="null">
            <div v-if="currentSoul" class="soul-detail">
                <div class="soul-icon">
                    <a-icon type="star" :style="{ fontSize: '48px', color: '#faad14' }" />
                </div>
                <div class="soul-info">
                    <p><strong>名称：</strong>{{ currentSoul.name }}</p>
                    <p><strong>数量：</strong>{{ currentSoul.count }}</p>
                    <p><strong>属性：</strong>{{ getSoulProperties(currentSoul.id) }}</p>
                    <p><strong>套装效果：</strong>{{ getSoulDescription(currentSoul.id) }}</p>
                </div>
            </div>
        </a-modal>

        <a-modal v-model="drawModalVisible" title="抽取公开邀请选手" width="600px" @ok="executeDraw" @cancel="drawModalVisible = false">
            <div class="draw-config">
                <div class="draw-row">
                    <span>N级选手：</span>
                    <a-input-number v-model="drawConfig.nCount" :min="0" :max="10" />
                </div>
                <div class="draw-row">
                    <span>R级选手：</span>
                    <a-input-number v-model="drawConfig.rCount" :min="0" :max="10" />
                </div>
                <div class="draw-row">
                    <span>SR级选手：</span>
                    <a-input-number v-model="drawConfig.srCount" :min="0" :max="10" />
                </div>
                <div class="draw-row">
                    <span>SSR级选手：</span>
                    <a-input-number v-model="drawConfig.ssrCount" :min="0" :max="10" />
                </div>
                <div class="draw-row">
                    <span>目标队伍：</span>
                    <a-select v-model="drawTargetTeamId" style="width: 200px">
                        <a-select-option v-for="team in teams" :key="team.id" :value="team.id">
                            {{ team.name }}
                        </a-select-option>
                    </a-select>
                </div>
            </div>
            <div v-if="drawnHeroes.length > 0" class="draw-result">
                <h4>抽取结果：</h4>
                <div class="drawn-heroes">
                    <a-tag v-for="hero in drawnHeroes" :key="hero.id" 
                           :color="getRankColor(hero.rank)">
                        {{ hero.name }} ({{ hero.rank }})
                    </a-tag>
                </div>
            </div>
        </a-modal>
    </div>
</template>

<script>
import Vue from 'vue';
import { mapState } from 'vuex';
import { HeroData, SoulData, HeroBuilders } from '../../core';
import { getAvatarPathByNo } from '../utils/avatar-utils';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = 'cdgame-record-secret-key-2024';
const PASSWORD_HASH = '73835c7ac154b5f38f1398114d500f43';

function hashPassword(password) {
    return CryptoJS.MD5(password).toString();
}

function encryptData(data) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
}

function decryptData(encrypted) {
    try {
        const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (e) {
        return null;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getDefaultHeroExps() {
    const exps = {};
    HeroData.filter(h => h.show === 1 || h.show === undefined).forEach(h => {
        exps[h.id] = 0;
    });
    return exps;
}

function getDefaultTeams() {
    return [
        { id: generateId(), name: '传书', matches: 0, jade: 0, wins: 0, losses: 0, score: 0, heroExps: getDefaultHeroExps(), souls: [], isDrawTarget: false, drawnHeroIds: [] },
        { id: generateId(), name: '勇士', matches: 0, jade: 0, wins: 0, losses: 0, score: 0, heroExps: getDefaultHeroExps(), souls: [], isDrawTarget: false, drawnHeroIds: [] },
        { id: generateId(), name: '新月', matches: 0, jade: 0, wins: 0, losses: 0, score: 0, heroExps: getDefaultHeroExps(), souls: [], isDrawTarget: false, drawnHeroIds: [] },
        { id: generateId(), name: '苍叶', matches: 0, jade: 0, wins: 0, losses: 0, score: 0, heroExps: getDefaultHeroExps(), souls: [], isDrawTarget: false, drawnHeroIds: [] },
    ];
}

function getDefaultState() {
    return {
        teams: getDefaultTeams(),
        sortField: 'wins',
        sortOrder: 'desc',
        showAllHeroes: false,
        drawnHeroes: [],
        selectedTeamIds: [],
    };
}

export default {
    name: 'Record',
    data() {
        return {
            ...getDefaultState(),
            isEditMode: false,
            passwordModalVisible: false,
            inputPassword: '',
            passwordError: '',
            heroDetailVisible: false,
            currentHero: null,
            currentHeroSkills: [],
            soulDetailVisible: false,
            currentSoul: null,
            drawModalVisible: false,
            drawConfig: {
                nCount: 0,
                rCount: 0,
                srCount: 0,
                ssrCount: 0,
            },
            drawTargetTeamId: null,
            drawnHeroes: [],
            saving: false,
            modified: false,
            soulList: SoulData,
            heroDataMap: {},
            heroIdList: [],
        };
    },
    computed: {
        ...mapState(['isAdminLoggedIn']),
        availableHeroes() {
            return HeroData.filter(h => h.show === 1 || h.show === undefined);
        },
        sortedTeams() {
            const teams = [...this.teams];
            const field = this.sortField;
            const order = this.sortOrder;
            
            if (field === 'wins' && order === 'desc') {
                teams.sort((a, b) => {
                    if (b.wins !== a.wins) return b.wins - a.wins;
                    if (b.score !== a.score) return b.score - a.score;
                    if (a.losses !== b.losses) return a.losses - b.losses;
                    return b.matches - a.matches;
                });
            } else {
                teams.sort((a, b) => {
                    const multiplier = order === 'asc' ? 1 : -1;
                    return (a[field] - b[field]) * multiplier;
                });
            }
            
            return teams;
        },
        filteredTeams() {
            if (this.selectedTeamIds.length === 0) {
                return this.sortedTeams;
            }
            return this.sortedTeams.filter(team => 
                this.selectedTeamIds.includes(team.id)
            );
        },
        isAllSelected() {
            return this.teams.length > 0 && this.selectedTeamIds.length === this.teams.length;
        },
        isIndeterminate() {
            return this.selectedTeamIds.length > 0 && this.selectedTeamIds.length < this.teams.length;
        },
    },
    watch: {
        teams: {
            handler(newTeams) {
                const validIds = newTeams.map(t => t.id);
                this.selectedTeamIds = this.selectedTeamIds.filter(id => validIds.includes(id));
            },
            deep: true,
        },
    },
    created() {
        this.availableHeroes.forEach(h => {
            this.heroDataMap[h.id] = h;
            this.heroIdList.push(h.id);
        });
    },
    mounted() {
        this.loadData();
    },
    methods: {
        getHeroName(heroId) {
            const hero = this.heroDataMap[heroId];
            return hero ? hero.name : heroId;
        },
        getTeamRank(team) {
            const allTeams = [...this.teams];
            allTeams.sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                if (b.score !== a.score) return b.score - a.score;
                return b.jade - a.jade;
            });
            const rank = allTeams.findIndex(t => t.id === team.id);
            return rank + 1;
        },
        getHeroExp(team, heroId) {
            if (!team.heroExps) {
                return 0;
            }
            return team.heroExps[heroId] !== undefined ? team.heroExps[heroId] : 0;
        },
        shouldShowHero(exp) {
            return this.showAllHeroes || exp >= 3;
        },
        showPasswordModal() {
            this.passwordModalVisible = true;
            this.inputPassword = '';
            this.passwordError = '';
            this.$nextTick(() => {
                if (this.$refs.passwordInput) {
                    this.$refs.passwordInput.focus();
                }
            });
        },
        closePasswordModal() {
            this.passwordModalVisible = false;
            this.inputPassword = '';
            this.passwordError = '';
        },
        verifyPassword() {
            const hashedInput = hashPassword(this.inputPassword);
            if (hashedInput === PASSWORD_HASH) {
                this.isEditMode = true;
                this.passwordModalVisible = false;
                this.passwordError = '';
                this.$message.success('已解锁编辑模式');
            } else {
                this.passwordError = '密码错误，请重试';
            }
        },
        logout() {
            this.isEditMode = false;
            this.$message.info('已锁定编辑模式');
        },
        adminUnlock() {
            this.isEditMode = true;
            this.$message.success('已解锁编辑模式');
        },
        onTeamFilterChange(selectedIds) {
            this.selectedTeamIds = selectedIds;
            this.saveFilterState();
        },
        toggleTeamSelection(teamId) {
            const index = this.selectedTeamIds.indexOf(teamId);
            if (index === -1) {
                this.selectedTeamIds.push(teamId);
            } else {
                this.selectedTeamIds.splice(index, 1);
            }
            this.saveFilterState();
        },
        toggleSelectAllTeams() {
            if (this.isAllSelected) {
                this.selectedTeamIds = [];
            } else {
                this.selectedTeamIds = this.teams.map(t => t.id);
            }
            this.saveFilterState();
        },
        saveFilterState() {
            try {
                localStorage.setItem('cdgame_record_filter', JSON.stringify(this.selectedTeamIds));
            } catch (e) {
                console.error('保存筛选状态失败:', e);
            }
        },
        loadFilterState() {
            try {
                const saved = localStorage.getItem('cdgame_record_filter');
                if (saved) {
                    const ids = JSON.parse(saved);
                    const validIds = this.teams.map(t => t.id);
                    this.selectedTeamIds = ids.filter(id => validIds.includes(id));
                }
            } catch (e) {
                console.error('加载筛选状态失败:', e);
            }
        },
        toggleSort(field) {
            if (this.sortField === field) {
                this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = field;
                this.sortOrder = 'desc';
            }
            this.markModified();
        },
        addTeam() {
            const newTeam = {
                id: generateId(),
                name: '新队伍',
                matches: 0,
                jade: 0,
                wins: 0,
                losses: 0,
                score: 0,
                heroExps: getDefaultHeroExps(),
                souls: [],
                isDrawTarget: false,
                drawnHeroIds: [],
            };
            this.teams.push(newTeam);
            this.markModified();
        },
        removeTeam(index) {
            this.$confirm({
                title: '确认删除',
                content: '确定要删除这个队伍吗？',
                onOk: () => {
                    const teamId = this.filteredTeams[index].id;
                    const originalIndex = this.teams.findIndex(t => t.id === teamId);
                    if (originalIndex !== -1) {
                        this.teams.splice(originalIndex, 1);
                        const filterIndex = this.selectedTeamIds.indexOf(teamId);
                        if (filterIndex !== -1) {
                            this.selectedTeamIds.splice(filterIndex, 1);
                        }
                    }
                    this.markModified();
                },
            });
        },
        addSoul(team) {
            team.souls.push({ id: null, name: '', count: 1 });
            this.markModified();
        },
        removeSoul(team, index) {
            team.souls.splice(index, 1);
            this.markModified();
        },
        handleExpChange(team, heroId, exp) {
            const newExp = exp !== null ? exp : 0;
            Vue.set(team.heroExps, heroId, newExp);
            this.$forceUpdate();
            this.markModified();
        },
        handleSoulChange(team, index, soulId) {
            if (!soulId) {
                team.souls[index] = { id: null, name: '', count: 1 };
            } else {
                const soul = this.soulList.find(s => s.id === soulId);
                if (soul) {
                    team.souls[index] = {
                        id: soul.id,
                        name: soul.name,
                        count: team.souls[index]?.count || 1,
                    };
                }
            }
            Vue.set(team.souls, index, team.souls[index]);
            this.markModified();
        },
        handleCountChange(team, index, count) {
            if (team.souls[index]) {
                team.souls[index].count = count;
                Vue.set(team.souls, index, team.souls[index]);
                this.markModified();
            }
        },
        showHeroDetail(heroId) {
            const heroData = this.heroDataMap[heroId];
            if (!heroData) return;
            
            const builder = HeroBuilders.get(Number(heroId));
            let skills = [];
            
            if (builder) {
                const heroEntity = builder();
                skills = heroEntity.skills.map(skill => ({
                    no: skill.no,
                    name: skill.name,
                    cost: skill.cost,
                    passive: skill.passive,
                    hide: skill.hide,
                    text: skill.text,
                }));
            }
            
            this.currentHero = {
                no: heroData.id,
                name: heroData.name,
                rank: heroData.rank || 'N',
                hp: heroData.hp,
                atk: heroData.atk,
                def: heroData.def,
                spd: heroData.spd,
                cri: heroData.cri,
                cri_dmg: heroData.cri_dmg,
                eft_hit: heroData.eft_hit ? heroData.eft_hit + '%' : '0%',
                eft_res: heroData.eft_res ? heroData.eft_res + '%' : '0%',
                grade: heroData.grade,
                school: heroData.school,
                position: heroData.position,
                type: heroData.type,
            };
            this.currentHeroSkills = skills;
            this.heroDetailVisible = true;
        },
        getAvatarPath(no) {
            return getAvatarPathByNo(no);
        },
        showSoulDetail(soul) {
            if (!soul) return;
            this.currentSoul = soul;
            this.soulDetailVisible = true;
        },
        getSoulProperties(soulId) {
            const soul = SoulData.find(s => s.id === soulId);
            if (!soul) return '未知';
            return soul.effects.map(e => e.description).join('；');
        },
        getSoulDescription(soulId) {
            const soul = SoulData.find(s => s.id === soulId);
            return soul ? soul.description : '未知';
        },
        getRankColor(rank) {
            const colors = {
                'SSR': 'gold',
                'SR': 'purple',
                'R': 'blue',
                'N': 'default',
                'D': 'green',
                'C': 'cyan',
            };
            return colors[rank] || 'default';
        },
        showDrawModal() {
            this.drawModalVisible = true;
            this.drawnHeroes = [];
            if (this.teams.length > 0) {
                this.drawTargetTeamId = this.teams[0].id;
            }
        },
        executeDraw() {
            const { nCount, rCount, srCount, ssrCount } = this.drawConfig;
            const total = nCount + rCount + srCount + ssrCount;
            
            if (total === 0) {
                this.$message.warning('请至少选择一个等级的选手数量');
                return;
            }
            
            if (!this.drawTargetTeamId) {
                this.$message.warning('请选择目标队伍');
                return;
            }
            
            const targetTeam = this.teams.find(t => t.id === this.drawTargetTeamId);
            if (!targetTeam) {
                this.$message.error('目标队伍不存在');
                return;
            }
            
            this.teams.forEach(t => t.isDrawTarget = false);
            
            const drawnList = [];
            
            const drawByRank = (rank, count) => {
                const heroes = this.availableHeroes.filter(h => h.rank === rank);
                const shuffled = [...heroes].sort(() => Math.random() - 0.5);
                return shuffled.slice(0, count);
            };
            
            drawnList.push(...drawByRank('N', nCount));
            drawnList.push(...drawByRank('R', rCount));
            drawnList.push(...drawByRank('SR', srCount));
            drawnList.push(...drawByRank('SSR', ssrCount));
            
            this.drawnHeroes = drawnList;
            
            targetTeam.isDrawTarget = true;
            if (!targetTeam.drawnHeroIds) {
                targetTeam.drawnHeroIds = [];
            }
            
            drawnList.forEach(hero => {
                Vue.set(targetTeam.heroExps, hero.id, 0);
                if (!targetTeam.drawnHeroIds.includes(hero.id)) {
                    targetTeam.drawnHeroIds.push(hero.id);
                }
            });
            
            this.markModified();
            this.$message.success(`已抽取${drawnList.length}名选手并填充到${targetTeam.name}`);
        },
        markModified() {
            this.modified = true;
        },
        saveData() {
            this.saving = true;
            try {
                const data = {
                    teams: this.teams,
                    sortField: this.sortField,
                    sortOrder: this.sortOrder,
                    showAllHeroes: this.showAllHeroes,
                    savedAt: new Date().toISOString(),
                };
                
                const encrypted = encryptData(data);
                localStorage.setItem('cdgame_record_data', encrypted);
                
                this.modified = false;
                this.$message.success('保存成功');
            } catch (e) {
                console.error('保存失败:', e);
                this.$message.error('保存失败: ' + e.message);
            } finally {
                this.saving = false;
            }
        },
        loadData() {
            try {
                const encrypted = localStorage.getItem('cdgame_record_data');
                if (encrypted) {
                    const data = decryptData(encrypted);
                    if (data) {
                        this.teams = data.teams || getDefaultTeams();
                        this.sortField = data.sortField || 'wins';
                        this.sortOrder = data.sortOrder || 'desc';
                        this.showAllHeroes = data.showAllHeroes || false;
                        this.ensureTeamData();
                        this.$nextTick(() => {
                            this.loadFilterState();
                        });
                        return;
                    }
                }
            } catch (e) {
                console.error('加载数据失败:', e);
            }
            
            const defaultState = getDefaultState();
            this.teams = defaultState.teams;
        },
        ensureTeamData() {
            const defaultExps = getDefaultHeroExps();
            this.teams.forEach(team => {
                if (!team.heroExps) {
                    team.heroExps = { ...defaultExps };
                } else {
                    const allHeroIds = Object.keys(defaultExps);
                    allHeroIds.forEach(heroId => {
                        if (team.heroExps[heroId] === undefined) {
                            team.heroExps[heroId] = 0;
                        }
                    });
                }
                if (!team.souls) {
                    team.souls = [];
                }
                if (!team.drawnHeroIds) {
                    team.drawnHeroIds = [];
                }
            });
        },
    },
    beforeRouteLeave(to, from, next) {
        if (this.modified) {
            this.$confirm({
                title: '未保存的更改',
                content: '您有未保存的更改，确定要离开吗？',
                onOk: () => next(),
                onCancel: () => next(false),
            });
        } else {
            next();
        }
    },
};
</script>

<style scoped>
.record-page {
    padding: 20px;
    max-width: 100%;
    overflow-x: auto;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 10px;
}

.page-header h2 {
    margin: 0;
}

.header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
}

.table-container {
    overflow-x: auto;
    overflow-y: visible;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    background: #fff;
}

.record-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
}

.record-table th,
.record-table td {
    border: 1px solid #e8e8e8;
    padding: 6px 8px;
    text-align: center;
    vertical-align: middle;
}

.record-table thead th {
    background: #fafafa;
    font-weight: 600;
    position: sticky;
    top: 0;
    z-index: 10;
    cursor: pointer;
    white-space: nowrap;
}

.record-table thead th:hover {
    background: #f0f0f0;
}

.fixed-col {
    position: sticky;
    left: 0;
    background: #fff;
    z-index: 5;
    vertical-align: middle;
    white-space: nowrap;
}

.rank-col {
    left: 0;
    min-width: 40px;
    max-width: 50px;
    font-weight: 600;
}

.team-col {
    left: 50px;
    min-width: 80px;
    max-width: 120px;
}

.record-table thead .fixed-col {
    background: #fafafa;
    z-index: 15;
}

.team-header-clickable {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
}

.team-header-clickable:hover {
    color: #1890ff;
}

.filter-active {
    color: #1890ff;
}

.team-filter-menu {
    max-height: 300px;
    overflow-y: auto;
}

.team-filter-menu :deep(.ant-dropdown-menu-item) {
    padding: 8px 12px;
}

.hero-col {
    min-width: 300px;
    max-width: 500px;
    text-align: left;
}

.soul-col {
    min-width: 150px;
    max-width: 250px;
    text-align: left;
}

.action-col {
    min-width: 50px;
    vertical-align: middle;
}

.sort-icon {
    margin-left: 4px;
    color: #1890ff;
}

.highlight-row {
    background-color: #fff7e6 !important;
}

.highlight-row td {
    background-color: #fff7e6 !important;
}

.hero-name {
    display: inline-block;
    min-width: 60px;
    text-align: left;
}

.hero-cell,
.soul-cell {
    cursor: pointer;
    color: #1890ff;
    display: inline-block;
    margin: 2px 4px;
}

.hero-cell:hover,
.soul-cell:hover {
    text-decoration: underline;
}

.team-name-input {
    width: 100px;
}

.num-input {
    width: 60px;
}

.heroes-container {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 8px;
    padding: 4px;
    max-height: none;
    align-items: center;
}

.souls-container {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0;
}

.hero-item-inline {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
}

.hero-item,
.soul-item {
    display: inline-block;
}

.edit-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 2px;
}

.soul-select {
    width: 120px;
}

.exp-input,
.count-input {
    width: 50px;
}

.remove-btn {
    padding: 0 4px;
    color: #ff4d4f;
}

.add-btn {
    margin-top: 4px;
}

.add-team-section {
    margin-top: 16px;
    text-align: center;
}

.error-text {
    color: #ff4d4f;
    margin-top: 8px;
}

.hero-detail {
    padding: 16px;
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

.skill-body {
    padding: 12px 16px;
}

.skill-desc {
    font-size: 13px;
    color: #666;
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
    padding: 20px;
}

.soul-detail {
    padding: 16px;
}

.soul-icon {
    text-align: center;
    margin-bottom: 16px;
}

.soul-info p {
    margin: 8px 0;
}

.draw-config {
    margin-bottom: 20px;
}

.draw-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

.draw-row span {
    min-width: 80px;
}

.draw-result {
    margin-top: 16px;
    padding: 12px;
    background: #f5f5f5;
    border-radius: 4px;
}

.drawn-heroes {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
}

@media screen and (max-width: 768px) {
    .record-page {
        padding: 10px;
    }
    
    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }
    
    .header-actions {
        width: 100%;
        justify-content: flex-start;
    }
    
    .hero-col {
        min-width: 200px;
    }
}
</style>
