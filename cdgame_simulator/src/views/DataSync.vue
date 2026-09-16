<template>
    <div class="data-sync-page">
        <a-card title="数据同步（D1 快照方案）" class="info-card">
            <p>本功能采用「本地优先」同步策略：</p>
            <ul>
                <li>日常读写全在 localStorage（本机），数据隐私自控；</li>
                <li>管理员可手动将本地快照 <strong>上传</strong> 到云端（D1）；</li>
                <li>也可从云端 <strong>下载</strong> 快照覆盖本地（覆盖操作需二次确认）；</li>
                <li>上传/下载仅涉及单表单行 JSON REPLACE（sync_records、sync_stats），远低于 D1 免费额度；</li>
                <li>本机 AES 加密密钥 = <code>cdgame-record-secret-key-2024</code>，如需更换需同时更新前后端密钥；</li>
            </ul>
        </a-card>

        <!-- 自动同步（本地 -> 云端） -->
        <a-card title="自动同步（本地 → 云端）" class="info-card" style="margin-top: 16px">
            <p>开启后，在页面保持打开且管理员登录态下，按设定间隔检测本地战绩快照（含选手经验/体力）是否变化，
                仅在变化时才上传；不会自动下载，本地数据不会被云端旧快照覆盖。</p>
            <div class="auto-sync-row">
                <span class="auto-sync-label">启用自动同步</span>
                <a-switch :checked="autoSync.enabled" @change="onAutoSyncEnabledChange" />
                <span class="auto-sync-label">间隔（分钟）</span>
                <a-input-number v-model="autoSync.intervalMin" :min="5" :max="1440" />
                <a-button type="primary" @click="applyAutoSync">保存并应用</a-button>
                <a-button :loading="syncingNow" @click="handleSyncNow">立即同步到云端</a-button>
            </div>
            <div class="auto-sync-status">
                <span>上次同步：</span>
                <a-tag color="blue">{{ formatTime(status.lastSyncAt) }}</a-tag>
                <span>当前状态：</span>
                <a-tag :color="status.pending ? 'orange' : 'green'">
                    {{ status.pending ? '有改动待上传' : '已与云端一致' }}
                </a-tag>
                <p v-if="status.lastError" class="error-text">
                    最近错误：{{ status.lastError }}（{{ formatTime(status.lastErrorAt) }}）
                </p>
            </div>
        </a-card>

        <a-row :gutter="16" style="margin-top: 16px">
            <!-- 记录同步卡片 -->
            <a-col :span="12">
                <a-card title="比赛记录同步" class="sync-card">
                    <div class="sync-info">
                        <span v-if="loadingInfo" class="sync-loading">加载同步时间中...</span>
                        <span v-else-if="!loadingInfo && !infoLoaded"
                              >云端暂无快照，请先在其他设备上传</span
                        >
                        <template v-else>
                            <span>上次上传/下载时间：</span>
                            <a-tag color="blue">{{ formatTime(info.recordsUpdatedAt) }}</a-tag>
                            <a-tag color="green">{{ formatTime(info.statsUpdatedAt) }}</a-tag>
                        </template>
                    </div>

                    <div class="action-group">
                        <a-button
                            type="primary"
                            :loading="uploadingRecords"
                            @click="handleUploadRecords"
                            :disabled="uploadingRecords || loadingInfo"
                        >
                            上传比赛记录到云端
                        </a-button>
                        <a-button
                            type="default"
                            :loading="downloadingRecords"
                            @click="handleDownloadRecords"
                            :disabled="downloadingRecords || loadingInfo"
                        >
                            从云端下载比赛记录
                        </a-button>
                    </div>
                </a-card>
            </a-col>

            <!-- 胜率统计同步卡片 -->
            <a-col :span="12">
                <a-card title="胜率统计同步" class="sync-card">
                    <div class="sync-info">
                        <span v-if="loadingInfo" class="sync-loading">加载同步时间中...</span>
                        <span v-else-if="!loadingInfo && !infoLoaded"
                              >云端暂无快照，请先在其他设备上传</span
                        >
                        <template v-else>
                            <span>上次上传/下载时间：</span>
                            <a-tag color="blue">{{ formatTime(info.recordsUpdatedAt) }}</a-tag>
                            <a-tag color="green">{{ formatTime(info.statsUpdatedAt) }}</a-tag>
                        </template>
                    </div>

                    <div class="action-group">
                        <a-button
                            type="primary"
                            :loading="uploadingStats"
                            @click="handleUploadStats"
                            :disabled="uploadingStats || loadingInfo"
                        >
                            上传胜率统计到云端
                        </a-button>
                        <a-button
                            type="default"
                            :loading="downloadingStats"
                            @click="handleDownloadStats"
                            :disabled="downloadingStats || loadingInfo"
                        >
                            从云端下载胜率统计
                        </a-button>
                    </div>
                </a-card>
            </a-col>
        </a-row>

        <!-- 未登录空状态 -->
        <div v-if="!isLoggedIn" class="empty-state">
            <a-empty description="请以管理员身份登录后访问此页面" />
        </div>
    </div>
</template>

<script>
import { mapState } from 'vuex';
import { uploadRecords, downloadRecords, uploadStats, downloadStats, getSyncTimestamps } from '../utils/sync-api';
import { getAutoSyncConfig, setAutoSyncConfig, getAutoSyncStatus, syncNow } from '../utils/auto-sync';

const ADMIN_PASSWORD_HASH = '4f323fde03b2d593d6988bb02ab0b7b7';

export default {
    name: 'DataSync',
    data() {
        return {
            loadingInfo: false,
            infoLoaded: false,
            info: {
                recordsUpdatedAt: null,
                statsUpdatedAt: null,
            },
            uploadingRecords: false,
            downloadingRecords: false,
            uploadingStats: false,
            downloadingStats: false,
            autoSync: { enabled: true, intervalMin: 30 },
            status: { lastSyncAt: null, lastError: '', lastErrorAt: null, pending: false },
            syncingNow: false,
            statusTimer: null,
        };
    },
    computed: {
        ...mapState(['adminPasswordHash']),
        isLoggedIn() {
            return this.adminPasswordHash === ADMIN_PASSWORD_HASH;
        },
    },
    mounted() {
        this.loadSyncInfo();
        this.loadAutoSync();
        this.statusTimer = setInterval(() => {
            this.status = getAutoSyncStatus();
        }, 20000);
    },
    beforeDestroy() {
        if (this.statusTimer) {
            clearInterval(this.statusTimer);
            this.statusTimer = null;
        }
    },
    methods: {
        loadAutoSync() {
            this.autoSync = getAutoSyncConfig();
            this.status = getAutoSyncStatus();
        },
        onAutoSyncEnabledChange(checked) {
            this.autoSync.enabled = checked;
            setAutoSyncConfig({ enabled: checked });
            this.status = getAutoSyncStatus();
            this.$message.success(checked ? '已启用自动同步' : '已停用自动同步');
        },
        applyAutoSync() {
            this.autoSync = setAutoSyncConfig({
                enabled: this.autoSync.enabled,
                intervalMin: this.autoSync.intervalMin,
            });
            this.status = getAutoSyncStatus();
            this.$message.success('自动同步设置已保存');
        },
        async handleSyncNow() {
            this.syncingNow = true;
            try {
                const result = await syncNow(true);
                if (result && result.uploaded) {
                    this.$message.success('已同步到云端');
                } else {
                    this.$message.info('本地数据无变化或暂无数据，无需同步');
                }
            } catch (e) {
                this.$message.error('同步失败: ' + e.message);
            } finally {
                this.syncingNow = false;
                this.status = getAutoSyncStatus();
            }
        },
        async loadSyncInfo() {
            this.loadingInfo = true;
            try {
                this.info = await getSyncTimestamps();
                this.infoLoaded = true;
            } catch (e) {
                this.$message.error('加载同步时间失败: ' + e.message);
            } finally {
                this.loadingInfo = false;
            }
        },

        async handleUploadRecords() {
            this.uploadingRecords = true;
            try {
                const result = await uploadRecords();
                this.$message.success(
                    `上传成功：${result.count} 条（${result.count === 1 ? '1 条' : result.count + ' 条'}数据）`
                );
                this.loadSyncInfo();
            } catch (e) {
                this.$message.error('上传失败: ' + e.message);
            } finally {
                this.uploadingRecords = false;
            }
        },

        async handleDownloadRecords() {
            this.$confirm({
                title: '确认覆盖本地比赛记录',
                content:
                    '从云端下载后将覆盖本地的比赛记录和队伍战绩快照，此操作不可撤销。是否继续？',
                onOk: async () => {
                    this.downloadingRecords = true;
                    try {
                        const result = await downloadRecords();
                        this.$message.success(
                            `下载成功：${result.count} 条（${result.count === 1 ? '1 条' : result.count + ' 条'}数据）`
                        );
                        this.loadSyncInfo();
                    } catch (e) {
                        this.$message.error('下载失败: ' + e.message);
                    } finally {
                        this.downloadingRecords = false;
                    }
                },
            });
        },

        async handleUploadStats() {
            this.uploadingStats = true;
            try {
                const result = await uploadStats();
                this.$message.success('上传胜率统计成功');
                this.loadSyncInfo();
            } catch (e) {
                this.$message.error('上传胜率统计失败: ' + e.message);
            } finally {
                this.uploadingStats = false;
            }
        },

        async handleDownloadStats() {
            this.$confirm({
                title: '确认覆盖本地胜率统计',
                content:
                    '从云端下载后将覆盖本地的选手胜率统计和卡牌胜率结果，此操作不可撤销。是否继续？',
                onOk: async () => {
                    this.downloadingStats = true;
                    try {
                        const result = await downloadStats();
                        this.$message.success(
                            `下载成功：${result.restored.join('、')}（已恢复 ${result.updated_at}）`
                        );
                        this.loadSyncInfo();
                    } catch (e) {
                        this.$message.error('下载胜率统计失败: ' + e.message);
                    } finally {
                        this.downloadingStats = false;
                    }
                },
            });
        },

        formatTime(ts) {
            if (!ts) return '未知';
            const date = new Date(ts);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
            });
        },
    },
};
</script>

<style scoped>
.data-sync-page {
    padding: 24px;
}

.info-card {
    margin-bottom: 16px;
}

.info-card ul {
    margin-top: 12px;
    margin-bottom: 0;
}

.info-card li {
    margin-bottom: 4px;
}

.sync-card {
    min-height: 240px;
}

.sync-info {
    margin-bottom: 16px;
    font-size: 14px;
}

.sync-loading {
    color: #999;
}

.action-group {
    display: flex;
    gap: 8px;
    justify-content: center;
}

.auto-sync-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 12px;
}

.auto-sync-label {
    color: #262626;
}

.auto-sync-status {
    margin-top: 12px;
    color: #595959;
}

.error-text {
    color: #ff4d4f;
    margin-top: 8px;
    margin-bottom: 0;
}

.empty-state {
    padding: 48px 0;
}
</style>
