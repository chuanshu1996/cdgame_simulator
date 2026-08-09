<template>
    <div class="card-win-rate-page">
        <div class="config-section">
            <h3 class="section-title">测试配置</h3>
            <div class="config-hint-text">主力6人按等级和类型约束配置，替补和应援自动随机填充</div>
            <div class="config-row">
                <div class="config-item">
                    <span class="config-label">对战次数：</span>
                    <a-input-number v-model="config.matchCount" :min="1" :max="10000" :step="100" style="width: 120px" />
                </div>
                <div class="config-item">
                    <span class="config-label">D级数量：</span>
                    <a-input-number v-model="config.rankDCount" :min="0" :max="6" :step="1" style="width: 80px" />
                </div>
                <div class="config-item">
                    <span class="config-label">C级数量：</span>
                    <a-input-number v-model="config.rankCCount" :min="0" :max="6" :step="1" style="width: 80px" />
                </div>
                <div class="config-item">
                    <span class="config-label">UC级数量：</span>
                    <a-input-number v-model="config.rankUCCount" :min="0" :max="6" :step="1" style="width: 80px" />
                </div>
            </div>
            <div class="config-row">
                <div class="config-item">
                    <span class="config-label">能量类：</span>
                    <a-input-number v-model="config.fireTypeCount" :min="0" :max="6" :step="1" style="width: 80px" />
                </div>
                <div class="config-item">
                    <span class="config-label">输出类：</span>
                    <a-input-number v-model="config.outputTypeCount" :min="0" :max="6" :step="1" style="width: 80px" />
                </div>
                <div class="config-item">
                    <span class="config-label">控制类：</span>
                    <a-input-number v-model="config.controlTypeCount" :min="0" :max="6" :step="1" style="width: 80px" />
                </div>
                <div class="config-item">
                    <span class="config-label">回复类：</span>
                    <a-input-number v-model="config.healTypeCount" :min="0" :max="6" :step="1" style="width: 80px" />
                </div>
                <div class="config-item">
                    <span class="config-label">拉条类：</span>
                    <a-input-number v-model="config.speedTypeCount" :min="0" :max="6" :step="1" style="width: 80px" />
                </div>
            </div>
            <div class="config-hint-text">类型数量为主力6人中该类型的最低数量，替补和应援自动随机填充且不纳入胜率统计</div>
            <div class="config-actions">
                <a-button type="primary" @click="startTest" :loading="running" :disabled="running">
                    <a-icon type="thunderbolt" />{{ running ? `测试中 (${progress}/${config.matchCount})` : '开始测试' }}
                </a-button>
                <a-button @click="resetData" :disabled="running">
                    <a-icon type="delete" />重置数据
                </a-button>
                <a-button @click="showReplay" :disabled="running || !lastReplay">
                    <a-icon type="play-circle" />单场回放
                </a-button>
            </div>
            <div class="config-hint" v-if="configError">
                <a-alert :message="configError" type="error" showIcon />
            </div>
        </div>

        <div class="progress-section" v-if="running">
            <a-progress :percent="Math.round(progress / config.matchCount * 100)" :format="() => `${progress}/${config.matchCount}`" />
        </div>

        <div class="stats-summary" v-if="results.length > 0">
            <div class="stat-item">
                <span class="stat-label">总测试场次</span>
                <span class="stat-value">{{ totalMatches }}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">参战卡牌数</span>
                <span class="stat-value">{{ results.length }}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">最高胜率</span>
                <span class="stat-value highlight">{{ topWinRate }}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">最低胜率</span>
                <span class="stat-value low">{{ bottomWinRate }}</span>
            </div>
        </div>

        <div class="table-section" v-if="results.length > 0">
            <a-table
                :columns="columns"
                :rowKey="record => record.name"
                :dataSource="results"
                :pagination="pagination"
                :scroll="{ x: 'max-content' }"
                size="middle"
            >
                <span slot="name" slot-scope="name, record">
                    <img :src="getAvatarPath(name, record.no)" class="square-avatar" @click="showSkillModal(record.no)" />
                    <span class="hero-name-link" @click="showSkillModal(record.no)">{{ name }}</span>
                </span>
                <span slot="winRate" slot-scope="text, record">
                    <span :class="getWinRateClass(record.winRateNum)">{{ text }}</span>
                </span>
                <span slot="winRateBar" slot-scope="text, record">
                    <div class="win-rate-bar-container">
                        <div class="win-rate-bar" :style="{ width: record.winRateNum + '%', background: getWinRateColor(record.winRateNum) }"></div>
                        <span class="win-rate-bar-label">{{ record.winRateNum.toFixed(1) }}%</span>
                    </div>
                </span>
            </a-table>
        </div>

        <div class="empty-section" v-else-if="!running">
            <a-empty description="暂无测试数据，请配置参数后开始测试" />
        </div>

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
                        <img :src="getAvatarPath(currentHero.name, currentHero.index)" class="card-avatar" />
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
                            <div class="attr-row"><span class="attr-label">生命</span><span class="attr-value">{{ currentHero.hp }}</span></div>
                            <div class="attr-row"><span class="attr-label">攻击</span><span class="attr-value">{{ currentHero.atk }}</span></div>
                            <div class="attr-row"><span class="attr-label">防御</span><span class="attr-value">{{ currentHero.def }}</span></div>
                            <div class="attr-row"><span class="attr-label">速度</span><span class="attr-value">{{ currentHero.spd }}</span></div>
                            <div class="attr-row"><span class="attr-label">暴击</span><span class="attr-value">{{ currentHero.cri }}</span></div>
                            <div class="attr-row"><span class="attr-label">暴伤</span><span class="attr-value">{{ currentHero.cri_dmg }}</span></div>
                            <div class="attr-row"><span class="attr-label">命中</span><span class="attr-value">{{ currentHero.eft_hit }}</span></div>
                            <div class="attr-row"><span class="attr-label">抵抗</span><span class="attr-value">{{ currentHero.eft_res }}</span></div>
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
                            </div>
                            <div class="skill-body">
                                <div class="skill-desc" v-if="skill.text">{{ skill.text }}</div>
                                <div class="skill-desc no-desc" v-else-if="!skill.passive">该技能暂无详细描述</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </a-modal>

        <a-modal
            v-model="replayModalVisible"
            :footer="null"
            width="720px"
            title="单场回放 · 裁判旗回合行动序列"
            class="replay-modal"
        >
            <div v-if="lastReplay" class="replay-content">
                <div class="replay-meta">
                    <a-tag color="blue">Seed: {{ lastReplay.seed }}</a-tag>
                    <a-tag :color="lastReplay.winner === 0 ? 'red' : 'green'">
                        胜方: 队伍{{ lastReplay.winner + 1 }}
                    </a-tag>
                    <a-tag>裁判旗回合: {{ lastReplay.judgeRound }}</a-tag>
                    <a-tag>总行动: {{ lastReplay.totalActions }}</a-tag>
                </div>
                <div class="replay-rounds">
                    <div
                        v-for="round in lastReplay.roundSummary"
                        :key="round.judgeRound"
                        class="replay-round"
                    >
                        <div class="replay-round-title">
                            裁判旗回合 #{{ round.judgeRound }}（{{ round.actionCount }} 次行动）
                        </div>
                        <div class="replay-actions">
                            <span
                                v-for="act in round.actions"
                                :key="act.actionSeq"
                                class="replay-action"
                                :class="act.teamId === 0 ? 'team-0' : 'team-1'"
                            >
                                行动{{ act.actionSeq }} · 队伍{{ act.teamId }}·{{ act.name }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <div v-else class="replay-empty">暂无回放数据，请先运行测试</div>
        </a-modal>
    </div>
</template>

<script>
import { Battle, BattleProperties, HeroBuilders, HeroData } from '../../core';
import { getAvatarPathByName } from '../utils/avatar-utils';

const STORAGE_KEY = 'card-win-rate-results';

const columns = [
    {
        title: 'rank',
        dataIndex: 'rank',
        width: 70,
        filters: [
            { text: 'D', value: 'D' },
            { text: 'C', value: 'C' },
            { text: 'UC', value: 'UC' },
            { text: 'B', value: 'B' },
            { text: 'A', value: 'A' },
            { text: 'EX', value: 'EX' },
            { text: 'S', value: 'S' },
            { text: 'S+', value: 'S+' },
            { text: 'SS', value: 'SS' },
        ],
        filterMultiple: true,
        onFilter: (value, record) => record.rank === value,
        sorter: (a, b) => {
            const order = { 'SS': 1, 'S+': 2, 'S': 3, 'EX': 4, 'A': 5, 'B': 6, 'UC': 7, 'C': 8, 'D': 9, 'N': 10 };
            return (order[a.rank] || 99) - (order[b.rank] || 99);
        },
    },
    {
        title: '选手',
        key: 'name',
        dataIndex: 'name',
        scopedSlots: { customRender: 'name' },
        sorter: (a, b) => a.name.localeCompare(b.name, 'zh-CN'),
    },
    {
        title: '出场次数',
        dataIndex: 'appearances',
        width: 100,
        sorter: (a, b) => a.appearances - b.appearances,
        defaultSortOrder: 'descend',
    },
    {
        title: '胜场',
        dataIndex: 'wins',
        width: 80,
        sorter: (a, b) => a.wins - b.wins,
    },
    {
        title: '负场',
        dataIndex: 'losses',
        width: 80,
        sorter: (a, b) => a.losses - b.losses,
    },
    {
        title: '胜率',
        dataIndex: 'winRate',
        width: 90,
        scopedSlots: { customRender: 'winRate' },
        sorter: (a, b) => a.winRateNum - b.winRateNum,
    },
    {
        title: '胜率分布',
        key: 'winRateBar',
        width: 180,
        scopedSlots: { customRender: 'winRateBar' },
        sorter: (a, b) => a.winRateNum - b.winRateNum,
    },
    {
        title: '平均行动/裁判旗回合',
        dataIndex: 'actionRate',
        width: 130,
        sorter: (a, b) => a.actionRateNum - b.actionRateNum,
        defaultSortOrder: 'descend',
    },
    {
        title: '类型',
        dataIndex: 'type',
        width: 80,
        filters: [
            { text: '能量', value: '能量' },
            { text: '输出', value: '输出' },
            { text: '辅助', value: '辅助' },
            { text: '控制', value: '控制' },
            { text: '回复', value: '回复' },
            { text: '拉条', value: '拉条' },
        ],
        filterMultiple: true,
        onFilter: (value, record) => record.type === value,
    },
];

const heroEntities = new Map();

export default {
    name: 'CardWinRate',
    data() {
        const savedResults = this.loadResultsFromStorage();
        return {
            config: {
                matchCount: 100,
                seedBase: 20260809,
                rankDCount: 0,
                rankCCount: 0,
                rankUCCount: 0,
                fireTypeCount: 0,
                outputTypeCount: 0,
                controlTypeCount: 0,
                healTypeCount: 0,
                speedTypeCount: 0,
            },
            running: false,
            progress: 0,
            results: savedResults,
            columns,
            pagination: {
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total) => `共 ${total} 条`,
                pageSizeOptions: ['10', '20', '50', '100'],
            },
            skillModalVisible: false,
            currentHero: null,
            currentHeroSkills: [],
            configError: '',
            replayModalVisible: false,
            lastReplay: null,
        };
    },
    computed: {
        totalMatches() {
            return this.results.length > 0 ? Math.max(...this.results.map(r => r.appearances + r.losses)) || 0 : 0;
        },
        topWinRate() {
            if (this.results.length === 0) return '-';
            const valid = this.results.filter(r => r.appearances > 0);
            if (valid.length === 0) return '-';
            return valid.reduce((a, b) => a.winRateNum > b.winRateNum ? a : b).winRate;
        },
        bottomWinRate() {
            if (this.results.length === 0) return '-';
            const valid = this.results.filter(r => r.appearances > 0);
            if (valid.length === 0) return '-';
            return valid.reduce((a, b) => a.winRateNum < b.winRateNum ? a : b).winRate;
        },
    },
    methods: {
        getAvatarPath(name, no) {
            return getAvatarPathByName(name, no);
        },
        getRankColor(rank) {
            const map = { 'SS': 'gold', 'S+': 'gold', 'S': 'orange', 'EX': 'purple', 'A': 'blue', 'B': 'blue', 'UC': 'cyan', 'C': 'cyan', 'D': 'green', 'N': 'default' };
            return map[rank] || 'default';
        },
        getWinRateClass(rate) {
            if (rate >= 55) return 'win-rate-high';
            if (rate >= 45) return 'win-rate-mid';
            return 'win-rate-low';
        },
        getWinRateColor(rate) {
            if (rate >= 55) return '#52c41a';
            if (rate >= 45) return '#1890ff';
            return '#ff4d4f';
        },
        validateConfig() {
            const { matchCount, rankDCount, rankCCount, rankUCCount, fireTypeCount, outputTypeCount, controlTypeCount, healTypeCount, speedTypeCount } = this.config;
            if (matchCount < 1) return '对战次数至少为1';
            if (rankDCount + rankCCount + rankUCCount > 6) return 'D/C/UC级数量总和不能超过6（主力6人）';
            const totalTypeCount = fireTypeCount + outputTypeCount + controlTypeCount + healTypeCount + speedTypeCount;
            if (totalTypeCount > 6) return '类型数量总和不能超过6（主力6人）';
            return '';
        },
        getAvailableHeroes() {
            if (this._availableHeroes) return this._availableHeroes;
            this._availableHeroes = HeroData.filter(h => {
                if (h.show !== 1 || !HeroBuilders.has(Number(h.index))) return false;
                // 排除只有默认普通攻击的英雄（技能未实现）
                const builder = HeroBuilders.get(Number(h.index));
                const entity = builder();
                const hasOnlyNormalAttack = entity.skills.length === 1 && entity.skills[0].name === '普通攻击';
                return !hasOnlyNormalAttack;
            });
            return this._availableHeroes;
        },
        buildTeamPool() {
            // 构建8人队伍：6主力 + 1替补 + 1应援
            const available = this.getAvailableHeroes();
            const { rankDCount, rankCCount, rankUCCount, fireTypeCount, outputTypeCount, controlTypeCount, healTypeCount, speedTypeCount } = this.config;
            
            const mainPool = [];
            const usedIds = new Set();
            let remaining = 6;
            
            const pickRandom = (arr, count) => {
                const shuffled = [...arr].sort(() => Math.random() - 0.5);
                return shuffled.slice(0, count);
            };
            
            const addToPool = (heroes) => {
                for (const h of heroes) {
                    if (remaining <= 0) break;
                    if (!usedIds.has(h.index)) {
                        mainPool.push(h);
                        usedIds.add(h.index);
                        remaining--;
                    }
                }
            };
            
            // 按等级配置选人
            if (rankDCount > 0) addToPool(pickRandom(available.filter(h => h.rank === 'D'), rankDCount));
            if (rankCCount > 0 && remaining > 0) addToPool(pickRandom(available.filter(h => h.rank === 'C'), rankCCount));
            if (rankUCCount > 0 && remaining > 0) addToPool(pickRandom(available.filter(h => h.rank === 'UC'), rankUCCount));
            
            // 类型约束：确保主力中包含足够的各类型角色
            const typeConstraints = [
                { type: '能量', count: fireTypeCount },
                { type: '输出', count: outputTypeCount },
                { type: '控制', count: controlTypeCount },
                { type: '回复', count: healTypeCount },
                { type: '拉条', count: speedTypeCount },
            ];
            
            for (const { type, count } of typeConstraints) {
                if (count <= 0) continue;
                const currentCount = mainPool.filter(h => h.type === type).length;
                const needMore = count - currentCount;
                if (needMore <= 0) continue;
                
                // 从主力中找非该类型的角色替换
                const otherInPool = mainPool.filter(h => h.type !== type);
                const shuffled = [...otherInPool].sort(() => Math.random() - 0.5);
                const typeHeroes = available.filter(h => h.type === type);
                
                for (let i = 0; i < needMore && i < shuffled.length; i++) {
                    const toReplace = shuffled[i];
                    const replacement = typeHeroes.find(h => !usedIds.has(h.index));
                    if (replacement) {
                        const idx = mainPool.findIndex(p => p.index === toReplace.index);
                        mainPool[idx] = replacement;
                        usedIds.delete(toReplace.index);
                        usedIds.add(replacement.index);
                    }
                }
            }
            
            // 补齐主力剩余位置
            remaining = 6 - mainPool.length;
            if (remaining > 0) {
                const notInPool = available.filter(h => !usedIds.has(h.index));
                addToPool(pickRandom(notInPool, remaining));
            }
            
            // 替补和应援：从剩余角色中随机选取
            const reservePool = [];
            const remainingHeroes = available.filter(h => !usedIds.has(h.index));
            const shuffledRemaining = [...remainingHeroes].sort(() => Math.random() - 0.5);
            if (shuffledRemaining.length > 0) reservePool.push(shuffledRemaining[0]);
            if (shuffledRemaining.length > 1) reservePool.push(shuffledRemaining[1]);
            
            return { main: mainPool.slice(0, 6), reserve: reservePool };
        },
        runSingleBattle(seed) {
            try {
                const team0 = this.buildTeamPool();
                const team1 = this.buildTeamPool();
                
                if (team0.main.length < 1 || team1.main.length < 1) return null;
                
                const buildTeamData = (team, teamId) => {
                    const data = [];
                    team.main.forEach(h => {
                        data.push({
                            no: Number(h.index),
                            teamId,
                            waitInput: true,
                            soulIds: [],
                            isReserve: false,
                        });
                    });
                    team.reserve.forEach(h => {
                        data.push({
                            no: Number(h.index),
                            teamId,
                            waitInput: true,
                            soulIds: [],
                            isReserve: true,
                        });
                    });
                    return data;
                };
                
                const team0Data = buildTeamData(team0, 0);
                const team1Data = buildTeamData(team1, 1);
                const data = team0Data.concat(team1Data);
                const battle = new Battle(data, seed);
                
                const maxIterations = 100000;
                let iterations = 0;
                let noProgressCount = 0;
                while (!battle.isEnd && iterations < maxIterations) {
                    if (!battle.process()) break;
                    iterations++;
                    if (battle.currentTask && battle.currentTask.type === 'WaitInput') {
                        const currentEntity = battle.getEntity(battle.currentTask.data.currentId || battle.currentId);
                        const skills = battle.currentTask.data.skills || [];
                        let selection = null;
                        
                        // 尝试AI选择
                        if (currentEntity && currentEntity.teamId >= 0 && !currentEntity.dead) {
                            try {
                                const energy = battle.getEnergy(currentEntity.teamId);
                                selection = currentEntity.ai(battle, battle.currentTask.parent ? battle.currentTask.parent.data : {}, energy, skills);
                            } catch (e) {
                                // AI异常，使用默认选择
                            }
                        }
                        
                        // AI未返回有效选择时，使用默认技能
                        if (!selection || !selection.no || !selection.targetId) {
                            const defaultSkill = skills.find(s => s.no === 1 && s.targets && s.targets.length);
                            if (defaultSkill) {
                                selection = { no: defaultSkill.no, targetId: battle.getRandomOne(defaultSkill.targets) };
                            } else if (skills.length > 0 && skills[0].targets && skills[0].targets.length) {
                                selection = { no: skills[0].no, targetId: battle.getRandomOne(skills[0].targets) };
                            }
                        }
                        
                        if (selection) {
                            battle.currentTask.data.selection = selection;
                            noProgressCount = 0;
                        } else {
                            noProgressCount++;
                            if (noProgressCount > 20) break;
                        }
                        battle.process();
                    }
                }
                
                // 计算本场各英雄"行动次数 / 参与的裁判旗回合数"
                const rounds = battle.judgeRound;
                const actionStats = {}; // no -> { actions, hasRound }
                const turnLogs = battle.eventLogs.filter(l => l.type === 'turn' && l.data && typeof l.data.entityId === 'number');
                turnLogs.forEach(l => {
                    if (l.judgeRound < 1) return;
                    const ent = battle.getEntity(l.data.entityId);
                    if (!ent) return;
                    const no = Number(ent.no);
                    if (!actionStats[no]) actionStats[no] = { actions: 0, hasRound: false };
                    actionStats[no].actions += 1;
                });
                Object.keys(actionStats).forEach(no => { actionStats[no].rounds = rounds; });
                
                return {
                    winner: battle.winner,
                    team0MainHeroes: team0.main.map(h => Number(h.index)),
                    team1MainHeroes: team1.main.map(h => Number(h.index)),
                    actionStats,
                    replay: {
                        seed,
                        winner: battle.winner,
                        judgeRound: battle.judgeRound,
                        totalActions: battle.turn,
                        roundSummary: battle.buildRoundActionSummary(),
                    },
                };
            } catch (e) {
                console.warn('单场对战异常:', e);
                return null;
            }
        },
        async startTest() {
            this.configError = this.validateConfig();
            if (this.configError) return;
            
            this.running = true;
            this.progress = 0;
            
            const heroMap = {};
            this.getAvailableHeroes().forEach(h => {
                heroMap[Number(h.index)] = {
                    no: Number(h.index),
                    name: h.name,
                    rank: h.rank,
                    type: h.type || '-',
                    appearances: 0,
                    wins: 0,
                    losses: 0,
                    actionCount: 0,   // 累计行动次数（仅裁判旗回合#1及以后）
                    roundCount: 0,     // 累计参与的裁判旗回合数
                };
            });
            
            // 每场战斗的"平均每个裁判旗回合行动次数"累计统计
            const accumulateActionStats = (actionStats) => {
                Object.keys(actionStats).forEach(no => {
                    const s = actionStats[no];
                    const entry = heroMap[Number(no)];
                    if (!entry) return;
                    entry.actionCount += s.actions;
                    entry.roundCount += s.rounds;
                });
            };
            
            const batchSize = 10;
            const totalBattles = this.config.matchCount;
            let completed = 0;
            let statsSuccess = 0, statsDraw = 0, statsError = 0;
            let lastReplay = null;
            
            const runBatch = () => {
                return new Promise(resolve => {
                    const batchEnd = Math.min(completed + batchSize, totalBattles);
                    for (let i = completed; i < batchEnd; i++) {
                        const seed = this.config.seedBase + i * 7919;
                        const result = this.runSingleBattle(seed);
                        if (result === null) {
                            statsError++;
                        } else if (result.winner < 0) {
                            statsDraw++;
                        } else {
                            statsSuccess++;
                            lastReplay = result.replay;
                            if (result.actionStats) accumulateActionStats(result.actionStats);
                            // 找出双方共有的角色（内战），这些角色不纳入统计
                            const mirrorHeroes = result.team0MainHeroes.filter(id => result.team1MainHeroes.includes(id));
                            const isMirror = (heroId) => mirrorHeroes.includes(heroId);
                            
                            const winnerTeam = result.winner === 0 ? result.team0MainHeroes : result.team1MainHeroes;
                            const loserTeam = result.winner === 0 ? result.team1MainHeroes : result.team0MainHeroes;
                            
                            winnerTeam.forEach(heroId => {
                                if (heroMap[heroId] && !isMirror(heroId)) {
                                    heroMap[heroId].appearances++;
                                    heroMap[heroId].wins++;
                                }
                            });
                            loserTeam.forEach(heroId => {
                                if (heroMap[heroId] && !isMirror(heroId)) {
                                    heroMap[heroId].appearances++;
                                    heroMap[heroId].losses++;
                                }
                            });
                        }
                    }
                    completed = batchEnd;
                    this.progress = completed;
                    resolve();
                });
            };
            
            while (completed < totalBattles) {
                await runBatch();
                await new Promise(r => setTimeout(r, 0));
            }
            
            this.lastReplay = lastReplay;
            
            this.results = Object.values(heroMap)
                .filter(h => h.appearances > 0)
                .map(h => {
                    const winRateNum = h.appearances > 0 ? (h.wins / h.appearances * 100) : 0;
                    // 平均每个裁判旗回合行动次数 = 总行动次数 / 参与的裁判旗回合数
                    const actionRateNum = h.roundCount > 0 ? (h.actionCount / h.roundCount) : 0;
                    return {
                        ...h,
                        winRateNum,
                        winRate: winRateNum.toFixed(1) + '%',
                        actionRateNum,
                        actionRate: actionRateNum.toFixed(2),
                    };
                })
                .sort((a, b) => b.appearances - a.appearances);
            
            this.saveResultsToStorage();
            this.running = false;
            
            if (statsSuccess === 0) {
                this.$message.warning(`测试完成：有效${statsSuccess}场 / 平局${statsDraw}场 / 异常${statsError}场，无有效数据。可用角色数：${this.getAvailableHeroes().length}`);
            } else {
                this.$message.success(`测试完成：有效${statsSuccess}场 / 平局${statsDraw}场 / 异常${statsError}场`);
            }
        },
        resetData() {
            this.results = [];
            localStorage.removeItem(STORAGE_KEY);
            this.$message.success('数据已重置');
        },
        loadResultsFromStorage() {
            try {
                const data = localStorage.getItem(STORAGE_KEY);
                if (data) return JSON.parse(data);
            } catch (e) {
                console.error('加载卡牌胜率数据失败:', e);
            }
            return [];
        },
        saveResultsToStorage() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.results));
            } catch (e) {
                console.error('保存卡牌胜率数据失败:', e);
            }
        },
        showSkillModal(heroNo) {
            const hero = heroEntities.get(heroNo);
            if (!hero) {
                const builder = HeroBuilders.get(heroNo);
                if (builder) {
                    const entity = builder();
                    heroEntities.set(heroNo, entity);
                    this.openSkillModal(entity, heroNo);
                }
                return;
            }
            this.openSkillModal(hero, heroNo);
        },
        showReplay() {
            this.replayModalVisible = true;
        },
        openSkillModal(hero, heroNo) {
            const heroData = HeroData.find(d => d.index === heroNo);
                this.currentHero = {
                    no: hero.no,
                    index: hero.no,
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
            this.currentHeroSkills = hero.skills.map(skill => ({
                no: skill.no,
                name: skill.name,
                cost: skill.cost,
                passive: skill.passive,
                hide: skill.hide,
                text: skill.text,
            }));
            this.skillModalVisible = true;
        },
    },
};
</script>

<style scoped>
.card-win-rate-page {
    padding: 20px;
}

.config-section {
    background: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
}

.section-title {
    font-size: 16px;
    font-weight: 600;
    color: #333;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid #1890ff;
}

.config-row {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    margin-bottom: 16px;
}

.config-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.config-label {
    font-size: 14px;
    color: #555;
    white-space: nowrap;
}

.config-sub-label {
    font-size: 12px;
    color: #999;
}

.config-hint-text {
    font-size: 12px;
    color: #888;
    margin-bottom: 12px;
}

.config-actions {
    display: flex;
    gap: 12px;
}

.config-hint {
    margin-top: 12px;
}

.progress-section {
    margin-bottom: 20px;
}

.stats-summary {
    display: flex;
    gap: 24px;
    margin-bottom: 20px;
    padding: 16px;
    background: #f5f5f5;
    border-radius: 8px;
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.stat-label {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
}

.stat-value {
    font-size: 24px;
    font-weight: bold;
    color: #1890ff;
}

.stat-value.highlight {
    color: #52c41a;
}

.stat-value.low {
    color: #ff4d4f;
}

.table-section {
    background: #fff;
    border: 1px solid #e8e8e8;
    border-radius: 8px;
    padding: 12px;
}

.empty-section {
    padding: 60px 0;
}

.square-avatar {
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: 4px;
    margin-right: 8px;
    vertical-align: middle;
    cursor: pointer;
}

.hero-name-link {
    cursor: pointer;
    color: #1890ff;
}

.hero-name-link:hover {
    text-decoration: underline;
}

.win-rate-high {
    color: #52c41a;
    font-weight: 600;
}

.win-rate-mid {
    color: #1890ff;
}

.win-rate-low {
    color: #ff4d4f;
}

.win-rate-bar-container {
    position: relative;
    height: 20px;
    background: #f0f0f0;
    border-radius: 10px;
    overflow: hidden;
}

.win-rate-bar {
    height: 100%;
    border-radius: 10px;
    transition: width 0.3s ease;
    min-width: 2px;
}

.win-rate-bar-label {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 11px;
    color: #333;
    font-weight: 600;
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

.card-avatar {
    width: 140px;
    height: 140px;
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
    gap: 12px;
}

.card-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.card-name {
    font-size: 24px;
    font-weight: bold;
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

.card-attrs {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
}

.attr-row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.15);
    padding: 6px 12px;
    border-radius: 6px;
}

.attr-label {
    font-size: 12px;
    opacity: 0.9;
}

.attr-value {
    font-size: 14px;
    font-weight: 600;
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
    background: #fff;
    border-radius: 8px;
    margin-bottom: 12px;
    overflow: hidden;
    border: 1px solid #e8e8e8;
}

.skill-header {
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
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

@media screen and (max-width: 768px) {
    .card-win-rate-page {
        padding: 10px;
    }
    .config-row {
        flex-direction: column;
        gap: 12px;
    }
    .stats-summary {
        flex-wrap: wrap;
        gap: 16px;
    }
    .stat-item {
        flex: 1;
        min-width: 80px;
    }
    .card-header {
        flex-direction: column;
        align-items: center;
        text-align: center;
    }
    .card-attrs {
        grid-template-columns: 1fr;
    }
}

/* 单场回放 modal */
.replay-content {
    max-height: 70vh;
    overflow-y: auto;
}
.replay-meta {
    margin-bottom: 12px;
}
.replay-rounds {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.replay-round {
    border: 1px solid #e8e8e8;
    border-radius: 6px;
    padding: 8px 10px;
    background: #fafafa;
}
.replay-round-title {
    font-weight: 600;
    margin-bottom: 6px;
    color: #1890ff;
}
.replay-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.replay-action {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid transparent;
}
.replay-action.team-0 {
    background: #fff1f0;
    border-color: #ffccc7;
    color: #cf1322;
}
.replay-action.team-1 {
    background: #f6ffed;
    border-color: #b7eb8f;
    color: #389e0d;
}
.replay-empty {
    text-align: center;
    color: #999;
    padding: 30px 0;
}
</style>
