<template>
    <div class="match-records-page">
        <div class="page-header">
            <h2>比赛记录</h2>
            <div class="header-actions">
                <a-input-search
                    v-model="searchText"
                    placeholder="搜索队伍名称"
                    style="width: 200px"
                    @search="handleSearch"
                    allowClear
                />
                <a-select
                    v-model="filterMode"
                    style="width: 120px"
                    placeholder="比赛模式"
                    allowClear
                    @change="handleFilterChange"
                >
                    <a-select-option value="all">全部模式</a-select-option>
                    <a-select-option value="official">正赛</a-select-option>
                    <a-select-option value="friendly">友谊赛</a-select-option>
                </a-select>
                <a-select
                    v-model="sortBy"
                    style="width: 140px"
                    @change="handleSortChange"
                >
                    <a-select-option value="time-desc">时间降序</a-select-option>
                    <a-select-option value="time-asc">时间升序</a-select-option>
                    <a-select-option value="seed">Seed排序</a-select-option>
                </a-select>
            </div>
        </div>

        <div class="stats-summary" v-if="filteredRecords.length > 0">
            <div class="stat-item">
                <span class="stat-label">总记录数</span>
                <span class="stat-value">{{ matchRecords.length }}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">正赛场次</span>
                <span class="stat-value">{{ officialCount }}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">友谊赛场次</span>
                <span class="stat-value">{{ friendlyCount }}</span>
            </div>
        </div>

        <div class="table-container" v-if="!loading">
            <table class="match-records-table">
                <thead>
                    <tr>
                        <th class="col-versus">对阵</th>
                        <th class="col-mode">模式</th>
                        <th class="col-winner">胜队</th>
                        <th class="col-loser">负队</th>
                        <th class="col-seed">比赛seed</th>
                        <th class="col-time">记录时间</th>
                        <th class="col-stats">战斗数据</th>
                        <th class="col-report">战报查询</th>
                        <th class="col-review">回顾</th>
                        <th v-if="isAdminLoggedIn" class="col-action">操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="(record, index) in paginatedRecords" :key="record.id" @click="showRecordDetail(record)">
                        <td class="col-versus">{{ record.team0Name }} VS {{ record.team1Name }}</td>
                        <td class="col-mode">
                            <a-tag :color="record.isOfficial ? 'orange' : 'green'">
                                {{ record.isOfficial ? '正赛' : '友谊赛' }}
                            </a-tag>
                        </td>
                        <td class="col-winner">{{ record.winnerName }}</td>
                        <td class="col-loser">{{ record.loserName }}</td>
                        <td class="col-seed">{{ record.seed }}</td>
                        <td class="col-time">{{ formatTime(record.recordedAt) }}</td>
                        <td class="col-stats" @click.stop>
                            <a-button 
                                type="link" 
                                size="small" 
                                @click.native="viewBattleStats(record)"
                                :disabled="!record.battleStats || record.battleStats.length === 0"
                            >
                                {{ record.battleStats && record.battleStats.length > 0 ? '查看数据' : '无数据' }}
                            </a-button>
                        </td>
                        <td class="col-report" @click.stop>
                            <a-button type="link" size="small" @click.native="viewReport(record)">
                                查看战报
                            </a-button>
                        </td>
                        <td class="col-review" @click.stop>
                            <a-button type="link" size="small" @click.native="reviewMatch(record)">
                                回顾
                            </a-button>
                        </td>
                        <td v-if="isAdminLoggedIn" class="col-action" @click.stop>
                            <a-button type="danger" size="small" @click.native="deleteMatchRecord(record, index)">
                                <a-icon type="delete" />
                            </a-button>
                        </td>
                    </tr>
                    <tr v-if="paginatedRecords.length === 0">
                        <td :colspan="isAdminLoggedIn ? 10 : 9" class="empty-hint">
                            <a-empty description="暂无比赛记录" />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="loading-container" v-else>
            <a-spin size="large" tip="加载中..." />
        </div>

        <div class="pagination-container" v-if="filteredRecords.length > pageSize">
            <a-pagination
                v-model="currentPage"
                :total="filteredRecords.length"
                :page-size="pageSize"
                show-quick-jumper
                show-size-changer
                :page-size-options="['10', '20', '50']"
                @showSizeChange="handlePageSizeChange"
            />
        </div>

        <a-modal 
            v-model="reportModalVisible" 
            :title="currentReportTitle"
            width="800px"
            :footer="null">
            <div class="report-content">
                <div v-if="currentReportLogs.length > 0">
                    <div v-for="(log, index) in currentReportLogs" :key="index" class="report-log-item" :class="log.type">
                        <span class="log-time">{{ log.time }}</span>
                        <span class="log-message">{{ log.message }}</span>
                    </div>
                </div>
                <a-empty v-else description="暂无战报数据" />
            </div>
        </a-modal>

        <a-modal 
            v-model="detailModalVisible" 
            :title="currentDetailTitle"
            width="600px"
            :footer="null">
            <div class="detail-content" v-if="currentDetail">
                <div class="detail-row">
                    <span class="detail-label">对阵双方：</span>
                    <span class="detail-value">{{ currentDetail.team0Name }} VS {{ currentDetail.team1Name }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">比赛模式：</span>
                    <a-tag :color="currentDetail.isOfficial ? 'orange' : 'green'">
                        {{ currentDetail.isOfficial ? '正赛' : '友谊赛' }}
                    </a-tag>
                </div>
                <div class="detail-row">
                    <span class="detail-label">获胜队伍：</span>
                    <span class="detail-value winner">{{ currentDetail.winnerName }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">失败队伍：</span>
                    <span class="detail-value loser">{{ currentDetail.loserName }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">比赛Seed：</span>
                    <span class="detail-value seed">{{ currentDetail.seed }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">记录时间：</span>
                    <span class="detail-value">{{ formatTime(currentDetail.recordedAt) }}</span>
                </div>
                <div class="detail-actions">
                    <a-button type="primary" @click="reviewMatch(currentDetail)">
                        <a-icon type="reload" />回顾比赛
                    </a-button>
                    <a-button @click="viewReport(currentDetail)">
                        <a-icon type="file-text" />查看战报
                    </a-button>
                </div>
            </div>
        </a-modal>

        <BattleStats
            :visible="battleStatsVisible"
            :savedStats="currentBattleStats"
            :team0Name="currentStatsTeam0Name"
            :team1Name="currentStatsTeam1Name"
            :read-only="true"
            @close="battleStatsVisible = false"
        />
    </div>
</template>

<script>
import { mapState } from 'vuex';
import CryptoJS from 'crypto-js';
import BattleStats from '../components/BattleStats.vue';
import { rollbackHeroWinRateStats } from '../utils/hero-win-rate';

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
    name: 'MatchRecords',
    components: {
        BattleStats,
    },
    data() {
        return {
            matchRecords: [],
            loading: false,
            searchText: '',
            filterMode: 'all',
            sortBy: 'time-desc',
            currentPage: 1,
            pageSize: 20,
            reportModalVisible: false,
            currentReportTitle: '战报详情',
            currentReportLogs: [],
            detailModalVisible: false,
            currentDetail: null,
            currentDetailTitle: '比赛详情',
            battleStatsVisible: false,
            currentBattleStats: null,
            currentStatsTeam0Name: '红队',
            currentStatsTeam1Name: '蓝队',
        };
    },
    computed: {
        ...mapState(['isAdminLoggedIn']),
        filteredRecords() {
            let records = [...this.matchRecords];
            
            if (this.searchText) {
                const search = this.searchText.toLowerCase();
                records = records.filter(r => 
                    r.team0Name.toLowerCase().includes(search) ||
                    r.team1Name.toLowerCase().includes(search) ||
                    r.winnerName.toLowerCase().includes(search) ||
                    r.loserName.toLowerCase().includes(search)
                );
            }
            
            if (this.filterMode === 'official') {
                records = records.filter(r => r.isOfficial);
            } else if (this.filterMode === 'friendly') {
                records = records.filter(r => !r.isOfficial);
            }
            
            if (this.sortBy === 'time-desc') {
                records.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
            } else if (this.sortBy === 'time-asc') {
                records.sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
            } else if (this.sortBy === 'seed') {
                records.sort((a, b) => Number(a.seed) - Number(b.seed));
            }
            
            return records;
        },
        paginatedRecords() {
            const start = (this.currentPage - 1) * this.pageSize;
            const end = start + this.pageSize;
            return this.filteredRecords.slice(start, end);
        },
        officialCount() {
            return this.matchRecords.filter(r => r.isOfficial).length;
        },
        friendlyCount() {
            return this.matchRecords.filter(r => !r.isOfficial).length;
        },
    },
    mounted() {
        this.loadMatchRecords();
    },
    methods: {
        loadMatchRecords() {
            this.loading = true;
            try {
                const encrypted = localStorage.getItem('cdgame_record_data');
                if (encrypted) {
                    const data = decryptData(encrypted);
                    if (data && data.matchRecords) {
                        this.matchRecords = data.matchRecords;
                    }
                }
            } catch (e) {
                console.error('加载比赛记录失败:', e);
                this.$message.error('加载比赛记录失败');
            } finally {
                this.loading = false;
            }
        },
        formatTime(isoString) {
            if (!isoString) return '-';
            const date = new Date(isoString);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        },
        handleSearch() {
            this.currentPage = 1;
        },
        handleFilterChange() {
            this.currentPage = 1;
        },
        handleSortChange() {
            this.currentPage = 1;
        },
        handlePageSizeChange(current, size) {
            this.pageSize = size;
            this.currentPage = 1;
        },
        showRecordDetail(record) {
            this.currentDetail = record;
            this.currentDetailTitle = `${record.team0Name} VS ${record.team1Name}`;
            this.detailModalVisible = true;
        },
        viewReport(record) {
            this.currentReportTitle = `${record.team0Name} VS ${record.team1Name} - 战报`;
            this.currentReportLogs = record.battleLogs || [];
            this.reportModalVisible = true;
            this.detailModalVisible = false;
        },
        viewBattleStats(record) {
            if (!record.battleStats || record.battleStats.length === 0) {
                this.$message.warning('该比赛记录没有战斗数据');
                return;
            }
            this.currentStatsTeam0Name = record.team0Name;
            this.currentStatsTeam1Name = record.team1Name;
            this.currentBattleStats = record.battleStats;
            this.battleStatsVisible = true;
        },
        reviewMatch(record) {
            this.detailModalVisible = false;
            this.$router.push({
                path: '/visual6v6',
                query: { seed: record.seed }
            });
        },
        deleteMatchRecord(record, index) {
            this.$confirm({
                title: '确认删除',
                content: '删除后将回滚该比赛的战绩数据，确定要删除吗？',
                onOk: () => {
                    this.rollbackMatchRecord(record);
                    const originalIndex = this.matchRecords.findIndex(r => r.id === record.id);
                    if (originalIndex !== -1) {
                        this.matchRecords.splice(originalIndex, 1);
                    }
                    this.saveData();
                    this.$message.success('已删除比赛记录并回滚数据');
                },
            });
        },
        rollbackMatchRecord(record) {
            const rollbackData = record.rollbackData;
            if (!rollbackData) return;
            
            const encrypted = localStorage.getItem('cdgame_record_data');
            if (!encrypted) return;
            
            const data = decryptData(encrypted);
            if (!data || !data.teams) return;
            
            const winnerTeam = data.teams.find(t => t.name === record.winnerName);
            const loserTeam = data.teams.find(t => t.name === record.loserName);
            
            if (winnerTeam && rollbackData.winnerChanges) {
                if (record.isOfficial) {
                    winnerTeam.wins -= rollbackData.winnerChanges.wins || 0;
                } else {
                    winnerTeam.score -= rollbackData.winnerChanges.score || 0;
                }
                winnerTeam.jade -= rollbackData.winnerChanges.jade || 0;
            }
            
            if (loserTeam && rollbackData.loserChanges) {
                if (record.isOfficial) {
                    loserTeam.losses -= rollbackData.loserChanges.losses || 0;
                }
                loserTeam.jade -= rollbackData.loserChanges.jade || 0;
            }
            
            if (rollbackData.heroExpChanges) {
                rollbackData.heroExpChanges.forEach(change => {
                    const team = data.teams.find(t => t.name === change.teamName);
                    if (team && team.heroExps && team.heroExps[change.heroId] !== undefined) {
                        team.heroExps[change.heroId] -= change.expGain;
                    }
                });
            }
            
            if (record.heroStatsChanges) {
                rollbackHeroWinRateStats(record.heroStatsChanges);
            }
            
            data.matchRecords = this.matchRecords;
            const newEncrypted = CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
            localStorage.setItem('cdgame_record_data', newEncrypted);
        },
        saveData() {
            try {
                const encrypted = localStorage.getItem('cdgame_record_data');
                let data = { teams: [], matchRecords: [] };
                
                if (encrypted) {
                    const decrypted = decryptData(encrypted);
                    if (decrypted) {
                        data = decrypted;
                    }
                }
                
                data.matchRecords = this.matchRecords;
                data.savedAt = new Date().toISOString();
                
                const newEncrypted = CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
                localStorage.setItem('cdgame_record_data', newEncrypted);
            } catch (e) {
                console.error('保存数据失败:', e);
            }
        },
    },
};
</script>

<style scoped>
.match-records-page {
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
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
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

.table-container {
    overflow-x: auto;
    border: 1px solid #e8e8e8;
    border-radius: 4px;
    background: #fff;
}

.match-records-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
}

.match-records-table th,
.match-records-table td {
    border: 1px solid #e8e8e8;
    padding: 10px 14px;
    text-align: center;
    vertical-align: middle;
}

.match-records-table thead th {
    background: #fafafa;
    font-weight: 600;
    white-space: nowrap;
}

.match-records-table tbody tr {
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.match-records-table tbody tr:hover {
    background: #e6f7ff;
}

.col-versus {
    min-width: 180px;
    font-weight: 500;
}

.col-mode {
    min-width: 70px;
}

.col-winner {
    min-width: 80px;
    color: #52c41a;
    font-weight: 500;
}

.col-loser {
    min-width: 80px;
    color: #ff4d4f;
}

.col-seed {
    min-width: 100px;
    font-family: monospace;
}

.col-time {
    min-width: 130px;
    color: #666;
    font-size: 13px;
}

.col-stats {
    min-width: 80px;
}

.col-report,
.col-review {
    min-width: 80px;
}

.col-action {
    min-width: 60px;
}

.empty-hint {
    text-align: center;
    padding: 40px;
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 300px;
}

.pagination-container {
    margin-top: 20px;
    display: flex;
    justify-content: center;
}

.report-content {
    max-height: 500px;
    overflow-y: auto;
    padding: 12px;
    background: #f8f9fa;
    border-radius: 4px;
}

.report-log-item {
    padding: 6px 10px;
    margin-bottom: 4px;
    border-radius: 4px;
    font-size: 13px;
    display: flex;
    gap: 12px;
}

.report-log-item .log-time {
    color: #666;
    min-width: 60px;
}

.report-log-item .log-message {
    flex: 1;
}

.report-log-item.damage {
    background: #fff1f0;
}

.report-log-item.heal {
    background: #f6ffed;
}

.report-log-item.buff {
    background: #e6f7ff;
}

.report-log-item.info {
    background: #fff;
}

.detail-content {
    padding: 8px;
}

.detail-row {
    display: flex;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;
}

.detail-row:last-of-type {
    border-bottom: none;
}

.detail-label {
    min-width: 100px;
    color: #666;
    font-size: 14px;
}

.detail-value {
    font-size: 14px;
    color: #333;
}

.detail-value.winner {
    color: #52c41a;
    font-weight: bold;
}

.detail-value.loser {
    color: #ff4d4f;
}

.detail-value.seed {
    font-family: monospace;
    background: #f5f5f5;
    padding: 2px 8px;
    border-radius: 4px;
}

.detail-actions {
    display: flex;
    gap: 12px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #e8e8e8;
}

@media screen and (max-width: 768px) {
    .match-records-page {
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
    
    .stats-summary {
        flex-wrap: wrap;
        gap: 16px;
    }
    
    .stat-item {
        flex: 1;
        min-width: 80px;
    }
}
</style>
