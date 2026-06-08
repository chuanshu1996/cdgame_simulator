<template>
    <a-modal
        v-model="modalVisible"
        title="战斗数据统计"
        width="900px"
        :footer="null"
        class="battle-stats-modal"
        :bodyStyle="{ padding: '16px' }"
        @cancel="handleClose"
    >
        <div class="stats-content">
            <div class="save-record-section" v-if="!recordSaved">
                <a-button type="primary" @click="saveMatchRecord" :loading="saving">
                    <a-icon type="save" />保存比赛记录
                </a-button>
                <span class="save-hint">保存后将更新队伍战绩数据</span>
            </div>
            <div class="record-saved-hint" v-else>
                <a-icon type="check-circle" style="color: #52c41a; margin-right: 8px;" />
                比赛记录已保存
            </div>
            <div class="team-section" v-for="(teamData, teamIndex) in teamStats" :key="'team-' + teamIndex">
                <div class="team-label">{{ teamIndex === 0 ? '红队' : '蓝队' }}</div>
                <div class="stats-table-wrapper">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th class="col-unit">单位</th>
                                <th class="col-data">有效伤害<br><span class="percent-hint">%</span></th>
                                <th class="col-data">承受伤害<br><span class="percent-hint">%</span></th>
                                <th class="col-data">单次伤害<br><span class="percent-hint">%</span></th>
                                <th class="col-data">鬼火消耗<br><span class="percent-hint">%</span></th>
                                <th class="col-data">治疗量<br><span class="percent-hint">%</span></th>
                                <th class="col-data">护盾量<br><span class="percent-hint">%</span></th>
                                <th class="col-data">控制次数<br><span class="percent-hint">%</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(unit, index) in teamData.units" :key="'unit-' + teamIndex + '-' + index"
                                :class="{'row-odd': index % 2 === 0, 'row-even': index % 2 !== 0}">
                                <td class="col-unit">
                                    <div class="unit-info">
                                        <img :src="getAvatar(unit)" :alt="unit.name" class="unit-avatar" @error="handleAvatarError">
                                        <span class="unit-name">{{ unit.name }}</span>
                                    </div>
                                </td>
                                <td class="col-data">
                                    <div class="data-value">{{ formatNumber(unit.totalDamage) }}</div>
                                    <div class="data-percent">{{ unit.damagePercent }}%</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill damage-fill" :style="{width: unit.damagePercent + '%'}"></div>
                                    </div>
                                </td>
                                <td class="col-data">
                                    <div class="data-value">{{ formatNumber(unit.damageTaken) }}</div>
                                    <div class="data-percent">{{ unit.damageTakenPercent }}%</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill damagetaken-fill" :style="{width: unit.damageTakenPercent + '%'}"></div>
                                    </div>
                                </td>
                                <td class="col-data">
                                    <div class="data-value">{{ formatNumber(unit.maxHit) }}</div>
                                    <div class="data-percent">{{ unit.maxHitPercent }}%</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill maxhit-fill" :style="{width: unit.maxHitPercent + '%'}"></div>
                                    </div>
                                </td>
                                <td class="col-data">
                                    <div class="data-value">{{ unit.manaUsed.toFixed(2) }}</div>
                                    <div class="data-percent">{{ unit.manaPercent }}%</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill mana-fill" :style="{width: unit.manaPercent + '%'}"></div>
                                    </div>
                                </td>
                                <td class="col-data">
                                    <div class="data-value">{{ formatNumber(unit.totalHeal) }}</div>
                                    <div class="data-percent">{{ unit.healPercent }}%</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill heal-fill" :style="{width: unit.healPercent + '%'}"></div>
                                    </div>
                                </td>
                                <td class="col-data">
                                    <div class="data-value">{{ formatNumber(unit.totalShield) }}</div>
                                    <div class="data-percent">{{ unit.shieldPercent }}%</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill shield-fill" :style="{width: unit.shieldPercent + '%'}"></div>
                                    </div>
                                </td>
                                <td class="col-data">
                                    <div class="data-value">{{ unit.totalControl }}</div>
                                    <div class="data-percent">{{ unit.controlPercent }}%</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill control-fill" :style="{width: unit.controlPercent + '%'}"></div>
                                    </div>
                                </td>
                            </tr>
                            <tr v-if="teamData.units.length === 0">
                                <td colspan="8" class="no-data">暂无数据</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="team-divider" v-if="teamIndex === 0"></div>
            </div>
        </div>
    </a-modal>
</template>

<script>
    import CryptoJS from 'crypto-js';
    import { updateHeroWinRateStats } from '../utils/hero-win-rate';
    
    const ENCRYPTION_KEY = 'cdgame-record-secret-key-2024';
    
    function decryptData(encrypted) {
        try {
            const bytes = CryptoJS.AES.decrypt(encrypted, ENCRYPTION_KEY);
            return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch (e) {
            return null;
        }
    }
    
    function encryptData(data) {
        return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
    }
    
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    const RANK_VALUES = {
        'D': 6, 'C': 9, 'UC': 12, 'B': 18, 'A': 24,
        'EX': 30, 'S': 36, 'S+': 42, 'SS': 48,
        'SSR': 48, 'SR': 24, 'R': 12, 'N': 6,
    };
    
    export default {
        name: 'BattleStats',
        props: {
            visible: {
                type: Boolean,
                default: false
            },
            battle: {
                type: Object,
                default: null
            },
            team0Name: {
                type: String,
                default: '红队'
            },
            team1Name: {
                type: String,
                default: '蓝队'
            },
            isOfficialMatch: {
                type: Boolean,
                default: false
            },
            battleSeed: {
                type: [String, Number],
                default: ''
            },
            battleLogs: {
                type: Array,
                default: () => []
            },
            savedStats: {
                type: Array,
                default: null
            },
            readOnly: {
                type: Boolean,
                default: false
            }
        },
        data() {
            return {
                modalVisible: false,
                teamStats: [
                    { units: [] },
                    { units: [] }
                ],
                recordSaved: false,
                saving: false,
            };
        },
        watch: {
            visible(newVal) {
                this.modalVisible = newVal;
                if (newVal) {
                    this.calculateStats();
                    this.recordSaved = this.readOnly;
                }
            },
            modalVisible(newVal) {
                if (!newVal) {
                    this.$emit('close');
                }
            }
        },
        methods: {
            calculateStats() {
                if (this.savedStats && this.savedStats.length === 2) {
                    this.teamStats = JSON.parse(JSON.stringify(this.savedStats));
                    return;
                }
                
                if (!this.battle) return;
                
                const teams = [{ units: [], totals: { damage: 0, damageTaken: 0, maxHit: 0, mana: 0, heal: 0, shield: 0, control: 0 } }, 
                              { units: [], totals: { damage: 0, damageTaken: 0, maxHit: 0, mana: 0, heal: 0, shield: 0, control: 0 } }];
                
                this.battle.entities.forEach((entity, entityId) => {
                    if (entity.teamId < 0 || entity.teamId > 1) return;
                    
                    const team = teams[entity.teamId];
                    const stats = {
                        entityId: entityId,
                        name: entity.name,
                        no: entity.no,
                        rank: entity.rank,
                        totalDamage: Number(entity.battleData?.get('totalDamage')) || 0,
                        damageTaken: Number(entity.battleData?.get('damageTaken')) || 0,
                        maxHit: Number(entity.battleData?.get('maxHit')) || 0,
                        manaUsed: Number(entity.battleData?.get('manaUsed')) || 0,
                        totalHeal: Number(entity.battleData?.get('totalHeal')) || 0,
                        totalShield: Number(entity.battleData?.get('totalShield')) || 0,
                        totalControl: Number(entity.battleData?.get('totalControl')) || 0,
                        damagePercent: 0,
                        damageTakenPercent: 0,
                        maxHitPercent: 0,
                        manaPercent: 0,
                        healPercent: 0,
                        shieldPercent: 0,
                        controlPercent: 0
                    };
                    
                    team.totals.damage += stats.totalDamage;
                    team.totals.damageTaken += stats.damageTaken;
                    team.totals.maxHit = Math.max(team.totals.maxHit, stats.maxHit);
                    team.totals.mana += stats.manaUsed;
                    team.totals.heal += stats.totalHeal;
                    team.totals.shield += stats.totalShield;
                    team.totals.control += stats.totalControl;
                    
                    team.units.push(stats);
                });
                
                teams.forEach((team, teamIndex) => {
                    team.units.forEach(unit => {
                        unit.damagePercent = team.totals.damage > 0 ? (unit.totalDamage / team.totals.damage * 100).toFixed(1) : '0.0';
                        unit.damageTakenPercent = team.totals.damageTaken > 0 ? (unit.damageTaken / team.totals.damageTaken * 100).toFixed(1) : '0.0';
                        unit.maxHitPercent = team.totals.maxHit > 0 ? (unit.maxHit / team.totals.maxHit * 100).toFixed(1) : '0.0';
                        unit.manaPercent = team.totals.mana > 0 ? (unit.manaUsed / team.totals.mana * 100).toFixed(1) : '0.0';
                        unit.healPercent = team.totals.heal > 0 ? (unit.totalHeal / team.totals.heal * 100).toFixed(1) : '0.0';
                        unit.shieldPercent = team.totals.shield > 0 ? (unit.totalShield / team.totals.shield * 100).toFixed(1) : '0.0';
                        unit.controlPercent = team.totals.control > 0 ? (unit.totalControl / team.totals.control * 100).toFixed(1) : '0.0';
                    });
                    this.$set(this.teamStats, teamIndex, { units: team.units });
                });
            },
            
            getAvatar(unit) {
                if (unit && unit.name) {
                    return `avatar/${unit.name}.png`;
                }
                if (unit && unit.entityId) {
                    const entity = this.battle?.entities?.get(unit.entityId);
                    if (entity && entity.name) {
                        return `avatar/${entity.name}.png`;
                    }
                }
                return 'avatar/default.png';
            },
            
            handleAvatarError(e) {
                e.target.src = 'avatar/default.png';
            },
            
            formatNumber(num) {
                const n = Number(num) || 0;
                if (n >= 10000) {
                    return (n / 10000).toFixed(2) + 'w';
                }
                return n.toFixed(2);
            },
            
            handleClose() {
                this.$emit('close');
            },
            
            getRankValue(rank) {
                return RANK_VALUES[rank?.toUpperCase()] || 6;
            },
            
            saveMatchRecord() {
                if ((!this.battle && !this.teamStats) || this.recordSaved) return;
                
                this.saving = true;
                
                try {
                    let winnerName, loserName, heroIds0, heroIds1;
                    
                    if (this.battle) {
                        const winner = this.battle.winner;
                        winnerName = winner === 0 ? this.team0Name : this.team1Name;
                        loserName = winner === 0 ? this.team1Name : this.team0Name;
                        heroIds0 = this.teamStats[0].units.map(u => String(u.no));
                        heroIds1 = this.teamStats[1].units.map(u => String(u.no));
                    } else {
                        winnerName = this.team0Name;
                        loserName = this.team1Name;
                        heroIds0 = this.teamStats[0].units.map(u => String(u.no));
                        heroIds1 = this.teamStats[1].units.map(u => String(u.no));
                    }
                    
                    const battleStats = JSON.parse(JSON.stringify(this.teamStats));
                    
                    const team0StatsFormatted = battleStats[0]?.units?.map(u => ({
                        name: u.name,
                        damage: u.totalDamage,
                        damageTaken: u.damageTaken,
                        onmyojiFireUsed: u.manaUsed,
                        healing: u.totalHeal,
                    })) || [];
                    
                    const team1StatsFormatted = battleStats[1]?.units?.map(u => ({
                        name: u.name,
                        damage: u.totalDamage,
                        damageTaken: u.damageTaken,
                        onmyojiFireUsed: u.manaUsed,
                        healing: u.totalHeal,
                    })) || [];
                    
                    const heroStatsChanges = updateHeroWinRateStats(
                        battleStats,
                        winnerName,
                        loserName,
                        this.team0Name,
                        this.team1Name,
                        team0StatsFormatted,
                        team1StatsFormatted
                    );
                    
                    const recordData = this.createMatchRecord(
                        this.team0Name,
                        this.team1Name,
                        winnerName,
                        loserName,
                        heroIds0,
                        heroIds1,
                        this.isOfficialMatch,
                        this.battleSeed,
                        this.battleLogs,
                        battleStats,
                        heroStatsChanges
                    );
                    
                    this.saveToLocalStorage(recordData);
                    
                    this.recordSaved = true;
                    this.$message.success('比赛记录已保存');
                } catch (e) {
                    console.error('保存比赛记录失败:', e);
                    this.$message.error('保存失败: ' + e.message);
                } finally {
                    this.saving = false;
                }
            },
            
            createMatchRecord(team0Name, team1Name, winnerName, loserName, heroIds0, heroIds1, isOfficial, seed, battleLogs, battleStats, heroStatsChanges) {
                const rollbackData = this.calculateRollbackData(
                    team0Name, team1Name, winnerName, loserName, heroIds0, heroIds1, isOfficial
                );
                
                return {
                    id: generateId(),
                    team0Name,
                    team1Name,
                    isOfficial,
                    winnerName,
                    loserName,
                    seed: String(seed),
                    recordedAt: new Date().toISOString(),
                    battleLogs: battleLogs || [],
                    battleStats: battleStats || [],
                    heroStatsChanges: heroStatsChanges || {},
                    rollbackData,
                };
            },
            
            calculateRollbackData(team0Name, team1Name, winnerName, loserName, heroIds0, heroIds1, isOfficial) {
                const encrypted = localStorage.getItem('cdgame_record_data');
                let teams = [];
                
                if (encrypted) {
                    const data = decryptData(encrypted);
                    if (data && data.teams) {
                        teams = data.teams;
                    }
                }
                
                const winnerTeam = teams.find(t => t.name === winnerName);
                const loserTeam = teams.find(t => t.name === loserName);
                
                const rollbackData = {
                    winnerChanges: { wins: 0, score: 0, jade: 0 },
                    loserChanges: { losses: 0, jade: 0 },
                    heroExpChanges: [],
                };
                
                if (!winnerTeam || !loserTeam) {
                    return rollbackData;
                }
                
                const winnerHeroIds = winnerName === team0Name ? heroIds0 : heroIds1;
                const loserHeroIds = winnerName === team0Name ? heroIds1 : heroIds0;
                
                if (isOfficial) {
                    rollbackData.winnerChanges.wins = 1;
                    rollbackData.loserChanges.losses = 1;
                } else {
                    rollbackData.winnerChanges.score = 1;
                }
                
                const allHeroIds = [...heroIds0, ...heroIds1];
                const totalValue = this.calculateTeamValue(allHeroIds, teams);
                
                let winnerJade = Math.round(totalValue / 12);
                let loserJade = Math.round(totalValue / 10);
                
                if (isOfficial) {
                    winnerJade *= 2;
                    loserJade *= 2;
                }
                
                rollbackData.winnerChanges.jade = winnerJade;
                rollbackData.loserChanges.jade = loserJade;
                
                winnerHeroIds.forEach(heroId => {
                    const currentExp = winnerTeam.heroExps?.[heroId] || 0;
                    let expGain = 0;
                    
                    if (isOfficial) {
                        expGain = 1;
                    } else if (currentExp === 0) {
                        expGain = 1;
                    }
                    
                    if (expGain > 0) {
                        rollbackData.heroExpChanges.push({
                            teamName: winnerName,
                            heroId,
                            expGain,
                        });
                    }
                });
                
                loserHeroIds.forEach(heroId => {
                    const currentExp = loserTeam.heroExps?.[heroId] || 0;
                    let expGain = 0;
                    
                    if (isOfficial) {
                        expGain = 1;
                    } else if (currentExp === 0) {
                        expGain = 1;
                    }
                    
                    if (expGain > 0) {
                        rollbackData.heroExpChanges.push({
                            teamName: loserName,
                            heroId,
                            expGain,
                        });
                    }
                });
                
                return rollbackData;
            },
            
            calculateTeamValue(heroIds, teams) {
                let totalValue = 0;
                heroIds.forEach(heroId => {
                    for (const team of teams) {
                        if (team.heroExps && team.heroExps[heroId] !== undefined) {
                            const rank = this.getHeroRank(heroId);
                            totalValue += this.getRankValue(rank);
                            break;
                        }
                    }
                });
                return totalValue;
            },
            
            getHeroRank(heroId) {
                for (const unit of [...this.teamStats[0].units, ...this.teamStats[1].units]) {
                    if (String(unit.no) === String(heroId)) {
                        return unit.rank;
                    }
                }
                return 'N';
            },
            
            saveToLocalStorage(recordData) {
                const encrypted = localStorage.getItem('cdgame_record_data');
                let data = { teams: [], matchRecords: [] };
                
                if (encrypted) {
                    const decrypted = decryptData(encrypted);
                    if (decrypted) {
                        data = decrypted;
                    }
                }
                
                if (!data.matchRecords) {
                    data.matchRecords = [];
                }
                
                data.matchRecords.unshift(recordData);
                
                this.updateTeamStats(data, recordData);
                
                data.savedAt = new Date().toISOString();
                
                const newEncrypted = encryptData(data);
                localStorage.setItem('cdgame_record_data', newEncrypted);
            },
            
            updateTeamStats(data, recordData) {
                const { team0Name, team1Name, winnerName, loserName, isOfficial, rollbackData } = recordData;
                
                const winnerTeam = data.teams.find(t => t.name === winnerName);
                const loserTeam = data.teams.find(t => t.name === loserName);
                
                if (!winnerTeam || !loserTeam) return;
                
                if (isOfficial) {
                    winnerTeam.wins = (winnerTeam.wins || 0) + 1;
                    loserTeam.losses = (loserTeam.losses || 0) + 1;
                } else {
                    winnerTeam.score = (winnerTeam.score || 0) + 1;
                }
                
                winnerTeam.jade = (winnerTeam.jade || 0) + (rollbackData.winnerChanges.jade || 0);
                loserTeam.jade = (loserTeam.jade || 0) + (rollbackData.loserChanges.jade || 0);
                
                rollbackData.heroExpChanges.forEach(change => {
                    const team = change.teamName === winnerName ? winnerTeam : loserTeam;
                    if (!team.heroExps) {
                        team.heroExps = {};
                    }
                    const currentExp = team.heroExps[change.heroId] || 0;
                    team.heroExps[change.heroId] = currentExp + change.expGain;
                });
            },
        }
    };
</script>

<style scoped>
    .battle-stats-modal .stats-content {
        max-height: 60vh;
        overflow-y: auto;
    }
    
    .team-section {
        margin-bottom: 12px;
    }
    
    .team-label {
        font-size: 16px;
        color: #1890ff;
        margin-bottom: 12px;
        font-weight: bold;
    }
    
    .team-divider {
        height: 2px;
        background: linear-gradient(90deg, transparent, #e8e8e8, transparent);
        margin: 16px 0;
    }
    
    .stats-table-wrapper {
        overflow-x: auto;
        border-radius: 8px;
        border: 1px solid #e8e8e8;
    }
    
    .stats-table {
        width: 100%;
        min-width: 600px;
        border-collapse: collapse;
        table-layout: fixed;
    }
    
    .stats-table thead tr {
        background: #fafafa;
        height: 50px;
    }
    
    .stats-table th {
        color: #333;
        font-size: 14px;
        font-weight: 600;
        text-align: center;
        border-bottom: 1px solid #e8e8e8;
        padding: 12px 8px;
        line-height: 1.4;
    }
    
    .stats-table th.col-unit {
        width: 140px;
        text-align: left;
        padding-left: 16px;
    }
    
    .stats-table th.col-data {
        width: calc((100% - 140px) / 4);
    }
    
    .percent-hint {
        font-size: 11px;
        color: #999;
    }
    
    .stats-table tbody tr {
        height: 72px;
        transition: background-color 0.2s ease;
    }
    
    .stats-table tbody tr.row-odd {
        background-color: #fff;
    }
    
    .stats-table tbody tr.row-even {
        background-color: #fafafa;
    }
    
    .stats-table tbody tr:hover {
        background-color: #e6f7ff;
    }
    
    .stats-table td {
        padding: 10px 12px;
        border-bottom: 1px solid #f0f0f0;
        vertical-align: middle;
    }
    
    .stats-table td.col-unit {
        padding-left: 16px;
    }
    
    .unit-info {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .unit-avatar {
        width: 44px;
        height: 44px;
        border: 2px solid #1890ff;
        border-radius: 6px;
        object-fit: cover;
        background-color: #f5f5f5;
        flex-shrink: 0;
    }
    
    .unit-name {
        color: #333;
        font-size: 14px;
        text-align: left;
        font-weight: 500;
    }
    
    .stats-table td.col-data {
        text-align: right;
    }
    
    .data-value {
        color: #333;
        font-size: 15px;
        font-weight: bold;
        margin-bottom: 4px;
        font-family: 'Consolas', 'Monaco', monospace;
    }
    
    .data-percent {
        color: #666;
        font-size: 12px;
        margin-bottom: 6px;
    }
    
    .progress-bar {
        width: 100%;
        max-width: 80px;
        height: 4px;
        background-color: #f0f0f0;
        border-radius: 2px;
        overflow: hidden;
        margin-left: auto;
    }
    
    .progress-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.5s ease-out;
    }
    
    .damage-fill {
        background: linear-gradient(90deg, #ff4d4f, #faad14);
    }
    
    .damagetaken-fill {
        background: linear-gradient(90deg, #722ed1, #eb2f96);
    }
    
    .maxhit-fill {
        background: linear-gradient(90deg, #fa8c16, #faad14);
    }
    
    .mana-fill {
        background: linear-gradient(90deg, #1890ff, #faad14);
    }
    
    .heal-fill {
        background: linear-gradient(90deg, #52c41a, #faad14);
    }
    
    .shield-fill {
        background: linear-gradient(90deg, #13c2c2, #faad14);
    }
    
    .control-fill {
        background: linear-gradient(90deg, #722ed1, #faad14);
    }
    
    .no-data {
        text-align: center;
        color: #999;
        padding: 40px;
        font-size: 14px;
    }
    
    .save-record-section {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 16px;
        padding: 12px 16px;
        background: #f6ffed;
        border: 1px solid #b7eb8f;
        border-radius: 8px;
    }
    
    .save-hint {
        color: #52c41a;
        font-size: 13px;
    }
    
    .record-saved-hint {
        display: flex;
        align-items: center;
        margin-bottom: 16px;
        padding: 12px 16px;
        background: #f6ffed;
        border: 1px solid #b7eb8f;
        border-radius: 8px;
        color: #52c41a;
        font-size: 14px;
    }
    
    @media (max-width: 768px) {
        .stats-table {
            min-width: 500px;
        }
        
        .stats-table th.col-unit,
        .stats-table td.col-unit {
            width: 120px;
        }
        
        .unit-avatar {
            width: 36px;
            height: 36px;
        }
        
        .unit-name {
            font-size: 13px;
        }
        
        .data-value {
            font-size: 14px;
        }
        
        .data-percent {
            font-size: 11px;
        }
        
        .progress-bar {
            max-width: 60px;
        }
    }
</style>
