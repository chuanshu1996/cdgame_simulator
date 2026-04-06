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
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(unit, index) in teamData.units" :key="'unit-' + teamIndex + '-' + index"
                                :class="{'row-odd': index % 2 === 0, 'row-even': index % 2 !== 0}">
                                <td class="col-unit">
                                    <div class="unit-info">
                                        <img :src="getAvatar(unit.entityId)" :alt="unit.name" class="unit-avatar" @error="handleAvatarError">
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
                            </tr>
                            <tr v-if="teamData.units.length === 0">
                                <td colspan="6" class="no-data">暂无数据</td>
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
            }
        },
        data() {
            return {
                modalVisible: false,
                teamStats: [
                    { units: [] },
                    { units: [] }
                ]
            };
        },
        watch: {
            visible(newVal) {
                this.modalVisible = newVal;
                if (newVal) {
                    this.calculateStats();
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
                if (!this.battle) return;
                
                const teams = [{ units: [], totals: { damage: 0, damageTaken: 0, maxHit: 0, mana: 0, heal: 0 } }, 
                              { units: [], totals: { damage: 0, damageTaken: 0, maxHit: 0, mana: 0, heal: 0 } }];
                
                this.battle.entities.forEach((entity, entityId) => {
                    if (entity.teamId < 0 || entity.teamId > 1) return;
                    
                    const team = teams[entity.teamId];
                    const stats = {
                        entityId: entityId,
                        name: entity.name,
                        totalDamage: Number(entity.battleData?.get('totalDamage')) || 0,
                        damageTaken: Number(entity.battleData?.get('damageTaken')) || 0,
                        maxHit: Number(entity.battleData?.get('maxHit')) || 0,
                        manaUsed: Number(entity.battleData?.get('manaUsed')) || 0,
                        totalHeal: Number(entity.battleData?.get('totalHeal')) || 0,
                        damagePercent: 0,
                        damageTakenPercent: 0,
                        maxHitPercent: 0,
                        manaPercent: 0,
                        healPercent: 0
                    };
                    
                    team.totals.damage += stats.totalDamage;
                    team.totals.damageTaken += stats.damageTaken;
                    team.totals.maxHit = Math.max(team.totals.maxHit, stats.maxHit);
                    team.totals.mana += stats.manaUsed;
                    team.totals.heal += stats.totalHeal;
                    
                    team.units.push(stats);
                });
                
                teams.forEach((team, teamIndex) => {
                    team.units.forEach(unit => {
                        unit.damagePercent = team.totals.damage > 0 ? (unit.totalDamage / team.totals.damage * 100).toFixed(1) : '0.0';
                        unit.damageTakenPercent = team.totals.damageTaken > 0 ? (unit.damageTaken / team.totals.damageTaken * 100).toFixed(1) : '0.0';
                        unit.maxHitPercent = team.totals.maxHit > 0 ? (unit.maxHit / team.totals.maxHit * 100).toFixed(1) : '0.0';
                        unit.manaPercent = team.totals.mana > 0 ? (unit.manaUsed / team.totals.mana * 100).toFixed(1) : '0.0';
                        unit.healPercent = team.totals.heal > 0 ? (unit.totalHeal / team.totals.heal * 100).toFixed(1) : '0.0';
                    });
                    this.$set(this.teamStats, teamIndex, { units: team.units });
                });
            },
            
            getAvatar(entityId) {
                const entity = this.battle?.entities?.get(entityId);
                if (entity && entity.no) {
                    return `avatar/${entity.name}.png`;
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
            }
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
    
    .no-data {
        text-align: center;
        color: #999;
        padding: 40px;
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
