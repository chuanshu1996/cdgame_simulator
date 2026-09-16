<template>
    <div class="schedule-page">
        <!-- 顶部：赛季信息 + 关键指标 -->
        <div class="page-hero">
            <div class="hero-left">
                <div class="hero-title-row">
                    <h2 class="hero-title">{{ schedule.seasonName }}</h2>
                    <a-tag :color="stageTag.color">{{ stageTag.text }}</a-tag>
                </div>
                <div class="hero-sub">
                    {{ modeText }} · 参赛 {{ schedule.teams.length }} 队 · 共 {{ schedule.rounds.length }} 轮
                    {{ schedule.config.playoff.enabled ? ' · 含季后赛' : '' }}
                </div>
                <div class="hero-actions">
                    <a-button type="primary" icon="thunderbolt" :loading="settling" @click.native="settleDue">
                        结算到期场次
                    </a-button>
                    <a-button icon="reload" @click.native="handleGenerate">生成/刷新赛程</a-button>
                    <a-button icon="save" @click.native="handleSave">保存赛程</a-button>
                </div>
            </div>
            <div class="hero-metrics">
                <div class="metric-card">
                    <span class="metric-label">当前轮次</span>
                    <span class="metric-value">{{ currentRoundName }}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">待结算</span>
                    <span class="metric-value warn">{{ pendingCount }}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">下次截止</span>
                    <span class="metric-value">{{ nextDeadlineText }}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">AI 托管</span>
                    <span class="metric-value">{{ schedule.ai.managedTeamIds.length }} 队</span>
                </div>
            </div>
        </div>

        <a-tabs v-model="activeTab" class="schedule-tabs">
            <!-- ===== 赛程日历 ===== -->
            <a-tab-pane key="calendar">
                <span slot="tab"><a-icon type="calendar" />赛程日历</span>
                <div class="calendar-layout">
                    <div class="calendar-panel">
                        <a-calendar :fullscreen="false" @select="onSelectDate" @panelChange="onPanelChange">
                            <ul slot="dateCellRender" slot-scope="value" class="calendar-cell">
                                <li v-for="r in roundsOfDate(value)" :key="r.id" class="calendar-cell-item">
                                    <span class="cell-dot" :class="roundDotClass(r)"></span>
                                    <span class="cell-text">{{ r.name }}</span>
                                </li>
                            </ul>
                        </a-calendar>
                        <div class="calendar-tip">点击日期可定位到该天的轮次；圆点：灰=未开始，绿=已结算，红=逾期未结算</div>
                    </div>

                    <div class="rounds-panel">
                        <div class="rounds-toolbar">
                            <a-radio-group v-model="stageFilter" size="small">
                                <a-radio-button value="all">全部</a-radio-button>
                                <a-radio-button value="regular">常规赛</a-radio-button>
                                <a-radio-button value="playoff">季后赛</a-radio-button>
                            </a-radio-group>
                            <span v-if="focusRoundId" class="focus-tip">
                                已定位：{{ focusRoundName }}
                                <a-button type="link" size="small" @click.native="focusRoundId = ''">取消定位</a-button>
                            </span>
                        </div>

                        <div v-if="visibleRounds.length === 0" class="empty-block">
                            暂无赛程，请先在「赛制配置」选择参赛队伍并生成赛程
                        </div>

                        <div v-for="round in visibleRounds" :key="round.id" class="round-card" :class="{ 'is-focus': round.id === focusRoundId }">
                            <div class="round-head">
                                <div class="round-title">
                                    <a-tag :color="round.stage === 'playoff' ? 'purple' : 'blue'">
                                        {{ round.stage === 'playoff' ? '季后赛' : '常规赛' }}
                                    </a-tag>
                                    <span class="round-name">{{ round.name }}</span>
                                    <a-tag v-if="isOverdue(round)" color="red">已逾期</a-tag>
                                    <a-tag v-else-if="isRoundSettled(round)" color="green">已结算</a-tag>
                                    <a-tag v-else>待进行</a-tag>
                                </div>
                                <div class="round-deadline">
                                    <span class="deadline-label">截止时间</span>
                                    <a-date-picker
                                        :value="momentOf(round.deadline)"
                                        show-time
                                        format="YYYY-MM-DD HH:mm"
                                        size="small"
                                        :disabled="!canEdit"
                                        @change="(val) => onDeadlineChange(round, val)"
                                    />
                                </div>
                            </div>

                            <div class="match-list">
                                <div v-for="match in round.matches" :key="match.id" class="match-row">
                                    <div class="match-side home">
                                        <span class="team-name" :class="{ 'is-winner': match.winnerId && match.winnerId === match.homeId }">
                                            {{ sideLabel(round, match, 'home') }}
                                        </span>
                                    </div>
                                    <div class="match-mid">
                                        <span class="vs">VS</span>
                                        <span v-if="match.status === 'settled'" class="match-result">
                                            {{ match.winnerId ? winnerName(match) + ' 胜' : '平局' }}
                                        </span>
                                        <span v-else class="match-pending">{{ matchNote(match) }}</span>
                                    </div>
                                    <div class="match-side away">
                                        <span class="team-name" :class="{ 'is-winner': match.winnerId && match.winnerId === match.awayId }">
                                            {{ sideLabel(round, match, 'away') }}
                                        </span>
                                    </div>
                                    <div class="match-actions">
                                        <a-button
                                            v-if="match.status !== 'settled'"
                                            type="link" size="small"
                                            :disabled="settling"
                                            @click.native="runMatch(round, match)"
                                        >立即结算</a-button>
                                        <a-button
                                            v-else
                                            type="link" size="small"
                                            @click.native="resetMatch(match)"
                                        >重置</a-button>
                                    </div>
                                </div>
                                <div v-if="round.matches.length === 0" class="empty-block small">本轮暂无对阵</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 按队伍查看完整赛程 -->
                <div class="team-schedule">
                    <div class="section-title">
                        <a-icon type="team" />按队伍查看赛程
                        <a-select v-model="viewTeamId" size="small" class="team-select" placeholder="选择队伍">
                            <a-select-option v-for="t in participatingTeams" :key="t.id" :value="t.id">
                                {{ t.name }}
                            </a-select-option>
                        </a-select>
                    </div>
                    <a-table
                        v-if="viewTeamId"
                        :columns="teamScheduleColumns"
                        :data-source="teamScheduleRows"
                        :pagination="false"
                        size="small"
                        row-key="key"
                    >
                        <span slot="result" slot-scope="text, record">
                            <a-tag v-if="record.status === 'settled'" color="green">
                                {{ record.result }}
                            </a-tag>
                            <a-tag v-else>未开始</a-tag>
                        </span>
                    </a-table>
                    <div v-else class="empty-block small">选择一支队伍查看它的完整赛程</div>
                </div>
            </a-tab-pane>

            <!-- ===== 赛制配置 ===== -->
            <a-tab-pane key="config">
                <span slot="tab"><a-icon type="setting" />赛制配置</span>
                <div class="config-grid">
                    <div class="config-card">
                        <div class="card-title">基础设置</div>
                        <div class="form-row">
                            <span class="form-label">赛季名称</span>
                            <a-input v-model="schedule.seasonName" class="form-input" :disabled="!canEdit" />
                        </div>
                        <div class="form-row">
                            <span class="form-label">常规赛制</span>
                            <a-radio-group v-model="schedule.config.mode" :disabled="!canEdit">
                                <a-radio value="single">单循环</a-radio>
                                <a-radio value="double">双循环</a-radio>
                            </a-radio-group>
                        </div>
                        <div class="form-row">
                            <span class="form-label">比赛性质</span>
                            <a-radio-group v-model="schedule.config.official" :disabled="!canEdit">
                                <a-radio :value="true">正赛（记胜负，勾玉翻倍）</a-radio>
                                <a-radio :value="false">友谊赛（记小分）</a-radio>
                            </a-radio-group>
                        </div>
                        <div class="form-row">
                            <span class="form-label">季后赛</span>
                            <a-switch v-model="schedule.config.playoff.enabled" :disabled="!canEdit" />
                        </div>
                        <template v-if="schedule.config.playoff.enabled">
                            <div class="form-row">
                                <span class="form-label">季后赛名额</span>
                                <a-select v-model="schedule.config.playoff.slots" size="small" class="form-input" :disabled="!canEdit">
                                    <a-select-option :value="2">2 队</a-select-option>
                                    <a-select-option :value="4">4 队</a-select-option>
                                    <a-select-option :value="8">8 队</a-select-option>
                                </a-select>
                            </div>
                            <div class="form-row">
                                <span class="form-label">淘汰形式</span>
                                <a-radio-group v-model="schedule.config.playoff.format" :disabled="!canEdit">
                                    <a-radio value="single_elim">单败淘汰</a-radio>
                                    <a-radio value="double_elim">双败淘汰（4/8 队）</a-radio>
                                </a-radio-group>
                            </div>
                        </template>
                    </div>

                    <div class="config-card">
                        <div class="card-title">参赛队伍</div>
                        <div class="team-checks">
                            <a-checkbox
                                v-for="t in recordTeams"
                                :key="t.id"
                                :checked="schedule.teams.indexOf(t.id) !== -1"
                                :disabled="!canEdit"
                                @change="(e) => toggleTeam(t.id, e)"
                            >{{ t.name }}（勾玉 {{ t.jade || 0 }}）</a-checkbox>
                        </div>
                        <div v-if="recordTeams.length === 0" class="empty-block small">
                            暂无队伍，请先到「队伍战绩」页创建
                        </div>
                    </div>

                    <div class="config-card">
                        <div class="card-title">截止时间批量排期</div>
                        <div class="form-row">
                            <span class="form-label">首轮截止</span>
                            <a-date-picker
                                :value="batchStart"
                                show-time
                                format="YYYY-MM-DD HH:mm"
                                size="small"
                                :disabled="!canEdit"
                                @change="(val) => batchStart = val"
                            />
                        </div>
                        <div class="form-row">
                            <span class="form-label">轮次间隔</span>
                            <a-input-number v-model="batchInterval" :min="1" :max="60" size="small" :disabled="!canEdit" />
                            <span class="form-hint">天</span>
                        </div>
                        <a-button size="small" type="primary" :disabled="!canEdit" @click.native="applyBatchDeadlines">
                            按间隔自动填充全部轮次
                        </a-button>
                    </div>
                </div>

                <div class="deadline-table">
                    <div class="card-title">逐轮截止时间</div>
                    <a-table :columns="deadlineColumns" :data-source="schedule.rounds" :pagination="false" size="small" row-key="id">
                        <span slot="deadline" slot-scope="text, record">
                            <a-date-picker
                                :value="momentOf(record.deadline)"
                                show-time
                                format="YYYY-MM-DD HH:mm"
                                size="small"
                                :disabled="!canEdit"
                                @change="(val) => onDeadlineChange(record, val)"
                            />
                        </span>
                        <span slot="progress" slot-scope="text, record">
                            {{ settledCount(record) }} / {{ record.matches.length }}
                        </span>
                    </a-table>
                </div>
            </a-tab-pane>

            <!-- ===== 积分榜 ===== -->
            <a-tab-pane key="standings">
                <span slot="tab"><a-icon type="trophy" />积分榜</span>
                <a-table :columns="standingsColumns" :data-source="standingsRows" :pagination="false" size="small" row-key="id">
                    <span slot="rank" slot-scope="text, record, index">
                        <span class="rank-badge" :class="'rank-' + (index + 1)">{{ index + 1 }}</span>
                    </span>
                    <span slot="progress" slot-scope="text, record">{{ record.played }} / {{ record.total }}</span>
                </a-table>
                <div class="standings-tip">排序口径与「队伍战绩」一致：胜场 → 小分 → 勾玉</div>
            </a-tab-pane>

            <!-- ===== AI 托管 ===== -->
            <a-tab-pane key="ai">
                <span slot="tab"><a-icon type="robot" />AI 托管</span>
                <div class="ai-settings">
                    <div class="card-title">模型接入（免费 GLM-4.7-Flash）</div>
                    <div class="form-row">
                        <span class="form-label">API 地址</span>
                        <a-input v-model="schedule.ai.baseUrl" class="form-input wide" placeholder="https://open.bigmodel.cn/api/paas/v4" />
                    </div>
                    <div class="form-row">
                        <span class="form-label">API Key</span>
                        <a-input-password v-model="schedule.ai.apiKey" class="form-input wide" placeholder="智谱开放平台 API Key" />
                    </div>
                    <div class="form-row">
                        <span class="form-label">模型</span>
                        <a-input v-model="schedule.ai.model" class="form-input" placeholder="glm-4.7-flash" />
                        <a-button size="small" :loading="testing" @click.native="testConnection">测试连接</a-button>
                    </div>
                    <div v-if="testResult" class="test-result" :class="testResult.ok ? 'ok' : 'error'">{{ testResult.text }}</div>
                    <div class="ai-hint">
                        浏览器直连智谱接口；若遇到跨域失败，可在本地 <code>server.js</code> 已提供 <code>/api/ai/chat</code> 代理，
                        把 API 地址改为 <code>http://localhost:3001/api/ai</code> 即可。Key 仅保存在本机浏览器。
                    </div>
                </div>

                <div class="ai-teams">
                    <div class="card-title">队伍托管</div>
                    <a-table :columns="aiTeamColumns" :data-source="aiTeamRows" :pagination="false" size="small" row-key="id">
                        <span slot="managed" slot-scope="text, record">
                            <a-switch :checked="record.managed" @change="(val) => toggleManaged(record.id, val)" />
                        </span>
                        <span slot="actions" slot-scope="text, record">
                            <a-button type="link" size="small" @click.native="openLineup(record.id)">阵容/引援</a-button>
                        </span>
                    </a-table>
                </div>

                <div class="price-table">
                    <div class="card-title">选手身价（勾玉）</div>
                    <div class="form-row">
                        <span class="form-label">身价系数</span>
                        <a-input-number v-model="schedule.ai.priceFactor" :min="1" :max="100" size="small" />
                        <span class="form-hint">实际价格 = 稀有度价值 × 系数；下方单档价格优先</span>
                    </div>
                    <div class="price-grid">
                        <div v-for="rank in rankList" :key="rank" class="price-item">
                            <span class="price-rank" :class="'rank-tag-' + rank.toLowerCase()">{{ rank }}</span>
                            <a-input-number
                                :value="priceOf(rank)"
                                :min="0"
                                size="small"
                                @change="(val) => setPrice(rank, val)"
                            />
                            <span class="price-default">默认 {{ defaultPriceOf(rank) }}</span>
                        </div>
                    </div>
                </div>
            </a-tab-pane>
        </a-tabs>

        <!-- 结算日志 -->
        <div v-if="logs.length" class="log-panel">
            <div class="card-title">最近结算日志</div>
            <div v-for="(log, i) in logs" :key="i" class="log-row" :class="log.ok ? 'ok' : 'warn'">
                <span class="log-time">{{ log.time }}</span>
                <span class="log-text">{{ log.round ? '[' + log.round + '] ' : '' }}{{ log.text }}</span>
            </div>
        </div>

        <!-- 阵容 / 引援弹窗 -->
        <a-modal
            v-model="lineupVisible"
            :title="lineupTeam ? lineupTeam.name + ' — 出战阵容与引援' : '阵容'"
            width="760px"
            :footer="null"
        >
            <div v-if="lineupTeam" class="lineup-editor">
                <div class="lineup-meta">
                    勾玉余额 <b>{{ lineupTeam.jade || 0 }}</b> · 战绩 {{ lineupTeam.wins || 0 }} 胜 {{ lineupTeam.losses || 0 }} 负
                </div>
                <div class="lineup-positions">
                    <div v-for="(pos, index) in positionLabels" :key="index" class="lineup-row">
                        <span class="pos-label">{{ pos }}</span>
                        <a-select
                            :value="lineupDraft[index] || undefined"
                            size="small"
                            allow-clear
                            show-search
                            option-filter-prop="children"
                            class="pos-select"
                            @change="(val) => setLineupSlot(index, val)"
                        >
                            <a-select-option v-for="h in lineupOptions" :key="h.id" :value="h.id">
                                {{ h.name }}（{{ h.rank }} · 战力 {{ h.point }}）
                            </a-select-option>
                        </a-select>
                    </div>
                </div>
                <div class="signing-block">
                    <div class="card-title small">引入选手（扣除勾玉，达到正赛上场门槛）</div>
                    <div class="signing-row">
                        <a-select
                            v-model="signingHeroId"
                            size="small"
                            show-search
                            option-filter-prop="children"
                            class="signing-select"
                            placeholder="选择要引入的选手"
                        >
                            <a-select-option v-for="h in signableHeroes" :key="h.id" :value="h.id">
                                {{ h.name }}（{{ h.rank }} · 战力 {{ h.point }} · {{ h.price }} 勾玉）
                            </a-select-option>
                        </a-select>
                        <a-button size="small" type="primary" :disabled="!signingHeroId" @click.native="doSigning">引入</a-button>
                    </div>
                </div>
                <div class="lineup-actions">
                    <a-button size="small" @click.native="fillAutoLineup">按战力自动排阵</a-button>
                    <a-button size="small" type="primary" @click.native="saveLineup">保存阵容</a-button>
                </div>
            </div>
        </a-modal>
    </div>
</template>

<script>
import Vue from 'vue';
import moment from 'moment';
import { mapState } from 'vuex';
import { HeroData } from '../../core';
import {
    loadSchedule,
    saveSchedule,
    generateSchedule,
    readRecordData,
    writeRecordData,
    settleDueMatches,
    settleMatch,
    computeStandings,
    resolveMatchTeam,
    getTeamSchedule,
    getLineup,
    autoBuildLineup,
    getOwnedHeroIds,
    applySigning,
    listSignableHeroes,
} from '../utils/schedule';
import { testAiConnection } from '../utils/league-ai';
import {
    RANK_VALUES,
    POSITION_LABELS,
    LINEUP_SIZE,
    SCAN_INTERVAL_MS,
    getRankPrice,
} from '../config/league';

function nowText() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default {
    name: 'Schedule',
    data() {
        return {
            activeTab: 'calendar',
            schedule: loadSchedule(),
            recordTeams: [],
            stageFilter: 'all',
            focusRoundId: '',
            viewTeamId: '',
            logs: [],
            settling: false,
            testing: false,
            testResult: null,
            nowTs: Date.now(),
            scanTimer: null,
            tickTimer: null,
            batchStart: null,
            batchInterval: 7,
            positionLabels: POSITION_LABELS,
            rankList: Object.keys(RANK_VALUES).sort((a, b) => RANK_VALUES[a] - RANK_VALUES[b]),
            lineupVisible: false,
            lineupTeamId: '',
            lineupDraft: [],
            signingHeroId: undefined,
            teamScheduleColumns: [
                { title: '轮次', dataIndex: 'roundName', key: 'roundName' },
                { title: '对手', dataIndex: 'opponent', key: 'opponent' },
                { title: '主客', dataIndex: 'side', key: 'side' },
                { title: '截止时间', dataIndex: 'deadline', key: 'deadline' },
                { title: '结果', dataIndex: 'status', key: 'status', scopedSlots: { customRender: 'result' } },
            ],
            deadlineColumns: [
                { title: '轮次', dataIndex: 'name', key: 'name' },
                { title: '截止时间', dataIndex: 'deadline', key: 'deadline', scopedSlots: { customRender: 'deadline' } },
                { title: '进度', key: 'progress', scopedSlots: { customRender: 'progress' } },
            ],
            standingsColumns: [
                { title: '排名', key: 'rank', scopedSlots: { customRender: 'rank' } },
                { title: '队伍', dataIndex: 'name', key: 'name' },
                { title: '胜', dataIndex: 'wins', key: 'wins' },
                { title: '负', dataIndex: 'losses', key: 'losses' },
                { title: '小分', dataIndex: 'score', key: 'score' },
                { title: '勾玉', dataIndex: 'jade', key: 'jade' },
                { title: '赛程', key: 'progress', scopedSlots: { customRender: 'progress' } },
            ],
            aiTeamColumns: [
                { title: '队伍', dataIndex: 'name', key: 'name' },
                { title: '勾玉', dataIndex: 'jade', key: 'jade' },
                { title: '战绩', dataIndex: 'record', key: 'record' },
                { title: 'AI 托管', key: 'managed', scopedSlots: { customRender: 'managed' } },
                { title: '操作', key: 'actions', scopedSlots: { customRender: 'actions' } },
            ],
        };
    },
    computed: {
        ...mapState(['isAdminLoggedIn']),
        canEdit() {
            return !!this.isAdminLoggedIn;
        },
        modeText() {
            return this.schedule.config.mode === 'double' ? '双循环' : '单循环';
        },
        participatingTeams() {
            return this.recordTeams.filter(t => this.schedule.teams.indexOf(t.id) !== -1);
        },
        standings() {
            return computeStandings(this.participatingTeams);
        },
        standingsRows() {
            return this.standings.map(t => {
                const games = this.getTeamScheduleRows(t.id);
                return {
                    id: t.id,
                    name: t.name,
                    wins: t.wins || 0,
                    losses: t.losses || 0,
                    score: t.score || 0,
                    jade: t.jade || 0,
                    played: games.filter(g => g.status === 'settled').length,
                    total: games.length,
                };
            });
        },
        aiTeamRows() {
            return this.participatingTeams.map(t => ({
                id: t.id,
                name: t.name,
                jade: t.jade || 0,
                record: `${t.wins || 0} 胜 ${t.losses || 0} 负`,
                managed: this.schedule.ai.managedTeamIds.indexOf(t.id) !== -1,
            }));
        },
        visibleRounds() {
            if (this.focusRoundId) {
                return this.schedule.rounds.filter(r => r.id === this.focusRoundId);
            }
            if (this.stageFilter === 'all') return this.schedule.rounds;
            return this.schedule.rounds.filter(r => r.stage === this.stageFilter);
        },
        focusRoundName() {
            const r = this.schedule.rounds.find(x => x.id === this.focusRoundId);
            return r ? r.name : '';
        },
        pendingCount() {
            let n = 0;
            this.schedule.rounds.forEach(r => r.matches.forEach(m => {
                if (m.status === 'pending') n++;
            }));
            return n;
        },
        currentRoundName() {
            const pending = this.schedule.rounds.filter(r => !this.isRoundSettled(r));
            return pending.length ? pending[0].name : '赛季结束';
        },
        nextDeadlineText() {
            const future = this.schedule.rounds
                .filter(r => r.deadline && new Date(r.deadline).getTime() > this.nowTs && !this.isRoundSettled(r))
                .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
            if (!future.length) return '—';
            const diff = new Date(future[0].deadline).getTime() - this.nowTs;
            const days = Math.floor(diff / 86400000);
            const hours = Math.floor((diff % 86400000) / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            if (days > 0) return `${days} 天 ${hours} 小时`;
            if (hours > 0) return `${hours} 小时 ${mins} 分`;
            return `${mins} 分钟`;
        },
        stageTag() {
            const hasPendingRegular = this.schedule.rounds.some(r => r.stage === 'regular' && !this.isRoundSettled(r));
            if (hasPendingRegular) return { text: '常规赛进行中', color: 'blue' };
            const hasPendingPlayoff = this.schedule.rounds.some(r => r.stage === 'playoff' && !this.isRoundSettled(r));
            if (hasPendingPlayoff) return { text: '季后赛进行中', color: 'purple' };
            return { text: '赛季结束', color: 'green' };
        },
        teamScheduleRows() {
            return this.getTeamScheduleRows(this.viewTeamId);
        },
        lineupTeam() {
            return this.recordTeams.find(t => t.id === this.lineupTeamId) || null;
        },
        lineupOptions() {
            if (!this.lineupTeam) return [];
            return getOwnedHeroIds(this.lineupTeam).map(id => {
                const h = HeroData.find(x => String(x.index) === String(id));
                return {
                    id,
                    name: h ? h.name : id,
                    rank: h ? h.rank || 'N' : 'N',
                    point: Math.round(Number(h && h.point) || 0),
                };
            }).sort((a, b) => b.point - a.point);
        },
        signableHeroes() {
            if (!this.lineupTeam) return [];
            return listSignableHeroes(
                this.lineupTeam,
                this.schedule.ai.priceFactor,
                this.schedule.ai.priceOverrides || {},
            ).sort((a, b) => b.point - a.point);
        },
    },
    watch: {
        'schedule.teams'() {
            if (this.viewTeamId && this.schedule.teams.indexOf(this.viewTeamId) === -1) {
                this.viewTeamId = '';
            }
        },
    },
    mounted() {
        this.reload();
        if (!this.schedule.rounds.length && this.schedule.teams.length) {
            this.schedule = generateSchedule(this.schedule);
            saveSchedule(this.schedule);
        }
        this.scanTimer = setInterval(() => {
            this.settleDue(true);
        }, SCAN_INTERVAL_MS);
        this.tickTimer = setInterval(() => {
            this.nowTs = Date.now();
        }, 1000);
        this.settleDue(true);
    },
    beforeDestroy() {
        if (this.scanTimer) clearInterval(this.scanTimer);
        if (this.tickTimer) clearInterval(this.tickTimer);
    },
    methods: {
        momentOf(value) {
            return value ? moment(value) : null;
        },
        reload() {
            this.recordTeams = readRecordData().teams || [];
            if (!this.viewTeamId && this.participatingTeams.length) {
                this.viewTeamId = this.participatingTeams[0].id;
            }
        },
        pushLog(log) {
            const text = log.teamName ? `${log.teamName}：${log.message}` : log.message;
            this.logs.unshift({ time: nowText(), text, ok: log.ok, round: log.roundName });
            if (this.logs.length > 40) this.logs.pop();
        },
        teamNameOf(id) {
            const t = this.recordTeams.find(x => x.id === id);
            return t ? t.name : '待定';
        },
        standingsNow() {
            return computeStandings(this.participatingTeams);
        },
        sideLabel(round, match, side) {
            const standings = this.standingsNow();
            const id = resolveMatchTeam(this.schedule, match, side, standings);
            if (id) return this.teamNameOf(id);
            const seed = side === 'home' ? match.homeSeed : match.awaySeed;
            const ref = side === 'home' ? match.homeRef : match.awayRef;
            if (ref) return ref.loser ? '败者待定' : '胜者待定';
            if (seed) return `${seed} 号种子`;
            return '待定';
        },
        winnerName(match) {
            return this.teamNameOf(match.winnerId);
        },
        matchNote(match) {
            const now = this.nowTs;
            return match.status === 'skipped' ? '已跳过' : '未开始';
        },
        isOverdue(round) {
            if (!round.deadline) return false;
            if (this.isRoundSettled(round)) return false;
            return new Date(round.deadline).getTime() < this.nowTs;
        },
        isRoundSettled(round) {
            return round.matches.length > 0 && round.matches.every(m => m.status === 'settled');
        },
        settledCount(round) {
            return round.matches.filter(m => m.status === 'settled').length;
        },
        roundDotClass(round) {
            if (this.isRoundSettled(round)) return 'done';
            if (this.isOverdue(round)) return 'overdue';
            return 'pending';
        },
        roundsOfDate(value) {
            const key = value.format('YYYY-MM-DD');
            return this.schedule.rounds.filter(r => r.deadline && moment(r.deadline).format('YYYY-MM-DD') === key);
        },
        onSelectDate(value) {
            const list = this.roundsOfDate(value);
            if (list.length) {
                this.focusRoundId = list[0].id;
                this.stageFilter = 'all';
            }
        },
        onPanelChange() {
            // 面板切换无需处理
        },
        onDeadlineChange(round, value) {
            if (!value) return;
            round.deadline = value.toDate ? value.toDate().toISOString() : new Date(value).toISOString();
            saveSchedule(this.schedule);
        },
        applyBatchDeadlines() {
            if (!this.batchStart) {
                this.$message.warning('请先选择首轮截止时间');
                return;
            }
            const start = this.batchStart.toDate ? this.batchStart.toDate() : new Date(this.batchStart);
            this.schedule.rounds.forEach((round, index) => {
                const d = new Date(start.getTime());
                d.setDate(d.getDate() + index * (Number(this.batchInterval) || 7));
                round.deadline = d.toISOString();
            });
            saveSchedule(this.schedule);
            this.$message.success('已按间隔填充全部轮次截止时间');
        },
        toggleTeam(teamId, e) {
            const checked = e && e.target ? e.target.checked : false;
            const idx = this.schedule.teams.indexOf(teamId);
            if (checked && idx === -1) this.schedule.teams.push(teamId);
            if (!checked && idx !== -1) this.schedule.teams.splice(idx, 1);
        },
        handleGenerate() {
            if (!this.canEdit) {
                this.$message.warning('请先以管理员身份登录后再调整赛程');
                return;
            }
            if (this.schedule.teams.length < 2) {
                this.$message.warning('请至少选择 2 支参赛队伍');
                return;
            }
            this.schedule = generateSchedule(this.schedule);
            saveSchedule(this.schedule);
            this.$message.success(`已生成 ${this.schedule.rounds.length} 轮赛程`);
        },
        handleSave() {
            saveSchedule(this.schedule);
            this.$message.success('赛程已保存');
        },
        async settleDue(silent) {
            if (this.settling) return;
            this.settling = true;
            try {
                const n = await settleDueMatches(this.schedule, { onLog: this.pushLog });
                if (n > 0) {
                    this.reload();
                    if (!silent) this.$message.success(`已结算 ${n} 场`);
                } else if (!silent) {
                    this.$message.info('没有到期的比赛');
                }
            } catch (e) {
                this.pushLog({ message: `结算失败：${e.message}`, ok: false });
            } finally {
                this.settling = false;
            }
        },
        async runMatch(round, match) {
            this.settling = true;
            try {
                await settleMatch(this.schedule, round, match, { onLog: this.pushLog });
                saveSchedule(this.schedule);
                this.reload();
            } catch (e) {
                this.pushLog({ message: `结算失败：${e.message}`, ok: false });
            } finally {
                this.settling = false;
            }
        },
        resetMatch(match) {
            match.status = 'pending';
            match.winnerId = null;
            match.seed = undefined;
            match.settledAt = undefined;
            match.result = undefined;
            saveSchedule(this.schedule);
        },
        getTeamScheduleRows(teamId) {
            if (!teamId) return [];
            return getTeamSchedule(this.schedule, teamId).map((item, index) => ({
                key: `${item.round.id}-${item.match.id}`,
                roundName: item.round.name,
                opponent: item.opponentId ? this.teamNameOf(item.opponentId) : '待定',
                side: item.isHome ? '主场' : '客场',
                deadline: item.round.deadline ? moment(item.round.deadline).format('YYYY-MM-DD HH:mm') : '—',
                status: item.match.status,
                result: item.match.status === 'settled'
                    ? (item.match.winnerId === teamId ? '胜' : (item.match.winnerId ? '负' : '平'))
                    : '',
            }));
        },
        toggleManaged(teamId, val) {
            const list = this.schedule.ai.managedTeamIds;
            const idx = list.indexOf(teamId);
            if (val && idx === -1) list.push(teamId);
            if (!val && idx !== -1) list.splice(idx, 1);
            saveSchedule(this.schedule);
        },
        priceOf(rank) {
            const overrides = this.schedule.ai.priceOverrides || {};
            if (overrides[rank] !== undefined && overrides[rank] !== null) return Number(overrides[rank]);
            return this.defaultPriceOf(rank);
        },
        defaultPriceOf(rank) {
            return getRankPrice(rank, this.schedule.ai.priceFactor);
        },
        setPrice(rank, val) {
            if (!this.schedule.ai.priceOverrides) Vue.set(this.schedule.ai, 'priceOverrides', {});
            Vue.set(this.schedule.ai.priceOverrides, rank, Number(val) || 0);
        },
        async testConnection() {
            this.testing = true;
            this.testResult = null;
            try {
                const text = await testAiConnection(this.schedule.ai);
                this.testResult = { ok: true, text: `连接成功：${text}` };
            } catch (e) {
                this.testResult = { ok: false, text: `连接失败：${e.message}` };
            } finally {
                this.testing = false;
            }
        },
        openLineup(teamId) {
            this.lineupTeamId = teamId;
            this.reload();
            const team = this.recordTeams.find(t => t.id === teamId);
            this.lineupDraft = team ? getLineup(this.schedule, team).slice() : [];
            this.signingHeroId = undefined;
            this.lineupVisible = true;
        },
        setLineupSlot(index, val) {
            Vue.set(this.lineupDraft, index, val || null);
        },
        fillAutoLineup() {
            const team = this.lineupTeam;
            if (!team) return;
            this.lineupDraft = autoBuildLineup(team);
        },
        saveLineup() {
            const draft = [];
            for (let i = 0; i < LINEUP_SIZE; i++) draft.push(this.lineupDraft[i] || null);
            Vue.set(this.schedule.lineups, this.lineupTeamId, draft);
            saveSchedule(this.schedule);
            this.$message.success('阵容已保存');
        },
        doSigning() {
            const team = this.lineupTeam;
            if (!team || !this.signingHeroId) return;
            const hero = HeroData.find(h => String(h.index) === String(this.signingHeroId));
            if (!hero) return;
            const price = this.priceOf((hero.rank || 'N').toUpperCase());
            if ((team.jade || 0) < price) {
                this.$message.warning('勾玉不足，无法引入该选手');
                return;
            }
            const record = readRecordData();
            const target = (record.teams || []).find(t => t.id === team.id);
            if (!target) return;
            if (applySigning(target, this.signingHeroId, price)) {
                writeRecordData(record);
                this.reload();
                this.signingHeroId = undefined;
                this.$message.success(`已引入 ${hero.name}，消耗 ${price} 勾玉`);
            }
        },
    },
};
</script>

<style scoped>
.schedule-page {
    padding: 20px;
    background: #f5f7fb;
    min-height: 100vh;
    font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
    color: #1f2430;
}

/* 顶部信息区 */
.page-hero {
    display: flex;
    justify-content: space-between;
    align-items: stretch;
    gap: 20px;
    padding: 20px 24px;
    border-radius: 14px;
    background: linear-gradient(120deg, #4c6fff 0%, #7a5af8 100%);
    color: #fff;
    box-shadow: 0 8px 24px rgba(76, 111, 255, 0.24);
    margin-bottom: 16px;
    flex-wrap: wrap;
}

.hero-left {
    flex: 1;
    min-width: 280px;
}

.hero-title-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.hero-title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    color: #fff;
}

.hero-sub {
    margin-top: 6px;
    font-size: 13px;
    opacity: 0.85;
}

.hero-actions {
    margin-top: 14px;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

.hero-metrics {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.metric-card {
    min-width: 108px;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(255, 255, 255, 0.28);
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.metric-label {
    font-size: 12px;
    opacity: 0.85;
}

.metric-value {
    font-size: 18px;
    font-weight: 600;
}

.metric-value.warn {
    color: #ffd666;
}

/* Tabs */
.schedule-tabs {
    background: #fff;
    border-radius: 12px;
    padding: 8px 16px 16px;
    box-shadow: 0 2px 10px rgba(31, 36, 48, 0.06);
}

.calendar-layout {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    flex-wrap: wrap;
}

.calendar-panel {
    width: 320px;
    flex: 0 0 320px;
    border: 1px solid #eef0f5;
    border-radius: 10px;
    padding: 4px;
}

.calendar-tip {
    padding: 8px 6px 4px;
    font-size: 12px;
    color: #6b7280;
}

.calendar-cell {
    list-style: none;
    margin: 0;
    padding: 0;
}

.calendar-cell-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    line-height: 16px;
    white-space: nowrap;
    overflow: hidden;
}

.cell-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
    flex: 0 0 6px;
}

.cell-dot.pending { background: #bfc4d0; }
.cell-dot.done { background: #34c77b; }
.cell-dot.overdue { background: #ff4d4f; }

.cell-text {
    overflow: hidden;
    text-overflow: ellipsis;
}

.rounds-panel {
    flex: 1;
    min-width: 320px;
}

.rounds-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    flex-wrap: wrap;
}

.focus-tip {
    font-size: 12px;
    color: #1890ff;
}

.round-card {
    border: 1px solid #eef0f5;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 12px;
    background: #fff;
    transition: box-shadow 0.2s ease, transform 0.2s ease;
    animation: rise 0.2s ease;
}

.round-card:hover {
    box-shadow: 0 6px 18px rgba(31, 36, 48, 0.08);
    transform: translateY(-1px);
}

.round-card.is-focus {
    border-color: #4c6fff;
    box-shadow: 0 0 0 2px rgba(76, 111, 255, 0.12);
}

@keyframes rise {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}

.round-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 8px;
}

.round-title {
    display: flex;
    align-items: center;
    gap: 8px;
}

.round-name {
    font-size: 15px;
    font-weight: 600;
}

.round-deadline {
    display: flex;
    align-items: center;
    gap: 6px;
}

.deadline-label {
    font-size: 12px;
    color: #6b7280;
}

.match-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.match-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 8px;
    background: #fafbff;
    border: 1px solid #f0f2f7;
}

.match-side {
    flex: 1;
    min-width: 0;
}

.match-side.away {
    text-align: right;
}

.team-name {
    font-size: 14px;
    color: #1f2430;
}

.team-name.is-winner {
    color: #34c77b;
    font-weight: 600;
}

.match-mid {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 96px;
}

.vs {
    font-size: 12px;
    color: #9aa1ad;
}

.match-result {
    font-size: 12px;
    color: #34c77b;
}

.match-pending {
    font-size: 12px;
    color: #9aa1ad;
}

.match-actions {
    min-width: 72px;
    text-align: right;
}

.team-schedule {
    margin-top: 18px;
    border-top: 1px dashed #eef0f5;
    padding-top: 12px;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 10px;
}

.team-select {
    width: 180px;
}

.empty-block {
    padding: 24px;
    text-align: center;
    color: #9aa1ad;
    background: #fafbff;
    border: 1px dashed #e5e8f0;
    border-radius: 8px;
}

.empty-block.small {
    padding: 12px;
    font-size: 12px;
}

/* 赛制配置 */
.config-grid {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
}

.config-card {
    flex: 1;
    min-width: 300px;
    border: 1px solid #eef0f5;
    border-radius: 10px;
    padding: 14px 16px;
    background: #fff;
}

.card-title {
    font-size: 15px;
    font-weight: 600;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
}

.card-title.small {
    font-size: 13px;
    margin: 10px 0 6px;
}

.form-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
}

.form-label {
    min-width: 84px;
    font-size: 13px;
    color: #6b7280;
}

.form-input {
    width: 220px;
}

.form-input.wide {
    width: 340px;
}

.form-hint {
    font-size: 12px;
    color: #9aa1ad;
}

.team-checks {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.deadline-table {
    margin-top: 14px;
}

.standings-tip {
    margin-top: 10px;
    font-size: 12px;
    color: #9aa1ad;
}

.rank-badge {
    display: inline-block;
    width: 22px;
    height: 22px;
    line-height: 22px;
    border-radius: 50%;
    background: #f0f2f7;
    color: #6b7280;
    font-size: 12px;
}

.rank-badge.rank-1 { background: #ffd666; color: #7a5a00; }
.rank-badge.rank-2 { background: #d9d9d9; color: #434343; }
.rank-badge.rank-3 { background: #ffbb96; color: #7a3b00; }

/* AI 托管 */
.ai-settings,
.ai-teams,
.price-table {
    border: 1px solid #eef0f5;
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 14px;
    background: #fff;
}

.ai-hint {
    margin-top: 8px;
    font-size: 12px;
    color: #6b7280;
    line-height: 1.6;
}

.test-result {
    margin-top: 6px;
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 6px;
}

.test-result.ok {
    background: #f6ffed;
    color: #34c77b;
}

.test-result.error {
    background: #fff2f0;
    color: #ff4d4f;
}

.price-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.price-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border: 1px solid #f0f2f7;
    border-radius: 8px;
    background: #fafbff;
}

.price-rank {
    font-size: 12px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    background: #f0f2f7;
    color: #4b5563;
}

.price-default {
    font-size: 11px;
    color: #9aa1ad;
}

/* 日志 */
.log-panel {
    margin-top: 14px;
    background: #fff;
    border: 1px solid #eef0f5;
    border-radius: 10px;
    padding: 12px 16px;
}

.log-row {
    display: flex;
    gap: 10px;
    font-size: 12px;
    line-height: 22px;
}

.log-row.ok .log-text { color: #34c77b; }
.log-row.warn .log-text { color: #faad14; }

.log-time {
    color: #9aa1ad;
    flex: 0 0 62px;
}

/* 阵容弹窗 */
.lineup-meta {
    font-size: 13px;
    color: #6b7280;
    margin-bottom: 10px;
}

.lineup-positions {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.lineup-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.pos-label {
    width: 48px;
    font-size: 13px;
    color: #6b7280;
}

.pos-select {
    flex: 1;
}

.signing-block {
    margin-top: 14px;
    border-top: 1px dashed #eef0f5;
    padding-top: 8px;
}

.signing-row {
    display: flex;
    gap: 8px;
    align-items: center;
}

.signing-select {
    flex: 1;
}

.lineup-actions {
    margin-top: 14px;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

@media screen and (max-width: 900px) {
    .calendar-panel {
        width: 100%;
        flex: 1 1 100%;
    }
}
</style>
