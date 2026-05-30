<template>
    <div class="predict">
        <div>注意本项目尚在开发中，必须保证下面列表中所有选手均已实现ai和技能才有参考价值</div>
        
        <!-- 模式选择区域 -->
        <div class="mode-selector" style="margin: 20px 0;">
            <span>对战模式:</span>
            <a-radio-group v-model="battleMode" @change="onModeChange">
                <a-radio-button value="1v1">1v1</a-radio-button>
                <a-radio-button value="5v5">5v5</a-radio-button>
                <a-radio-button value="6v6">6v6</a-radio-button>
            </a-radio-group>
        </div>
        
        <!-- 测试控制区域 -->
        <div style="margin-bottom: 20px;">
            测试次数:
            <a-input-number :min="1" :max="1000" v-model="count"/>
            <a-button @click="getWinner" :loading="!!total">预测</a-button>
            <a-button v-if="hasResults" @click="exportResults">导出结果</a-button>
            <a-button v-if="errorLogs.length > 0" @click="showErrorLogs">查看错误日志</a-button>
            <span v-if="total" class="progress-text">剩余计算次数: {{total}}</span>
            <span v-if="!total && hasResults" class="result-text">
                {{ team0Name }}赢{{results[battleMode].winner0}}次({{Math.floor(results[battleMode].winner0/count*100)}}%)
                {{ team1Name }}赢{{results[battleMode].winner1}}次({{Math.floor(results[battleMode].winner1/count*100)}}%)
                <span v-if="results[battleMode].error > 0">
                    错误{{results[battleMode].error}}次({{Math.floor(results[battleMode].error/count*100)}}%)
                </span>
            </span>
        </div>
        
        <!-- 测试结果图表 -->
        <div v-if="hasResults" class="chart-container" style="margin: 20px 0;">
            <h3>胜率对比</h3>
            <div class="chart-wrapper">
                <div v-for="(result, mode) in results" :key="mode" class="chart-item">
                    <h4>{{mode === '1v1' ? '1v1对战' : mode === '5v5' ? '5v5对战' : '6v6对战'}}</h4>
                    <div class="bar-chart">
                        <div class="bar red" :style="{width: (result.winner0/count*100) + '%'}">
                            {{Math.floor(result.winner0/count*100)}}%
                        </div>
                        <div class="bar blue" :style="{width: (result.winner1/count*100) + '%'}">
                            {{Math.floor(result.winner1/count*100)}}%
                        </div>
                        <div v-if="result.error > 0" class="bar gray" :style="{width: (result.error/count*100) + '%'}">
                            {{Math.floor(result.error/count*100)}}%
                        </div>
                    </div>
                    <div class="bar-labels">
                        <span>{{ team0Name }}</span>
                        <span>{{ team1Name }}</span>
                        <span v-if="result.error > 0">错误</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 选手数据表格 -->
        <a-table
                :columns="columns"
                :rowKey="r => r.teamId + '_' + r.index + '_' +r.no"
                :dataSource="data"
                size="small"
                :pagination="false"
        >
            <span slot="name" slot-scope="name, record">  <a-avatar :src="getAvatarPath(name, record.no)"/>    {{name}}</span>
        </a-table>

    </div>
</template>
<script>
    import {Battle, HeroBuilders, BattleProperties} from '../../core'
    import {getAvatarPathByName} from '../utils/avatar-utils'

    const columns = [
        {
            title: '编号',
            dataIndex: 'no',
        },
        {
            title: '选手',
            width: '20%',
            key: 'name',
            dataIndex: 'name',
            scopedSlots: {customRender: 'name'},
        },
        {
            title: '队伍',
            dataIndex: 'teamId',
        },
        {
            title: '生命',
            dataIndex: 'max_hp',
        },
        {
            title: '攻击',
            dataIndex: 'atk',
        },
        {
            title: '防御',
            dataIndex: 'def',
        },
        {
            title: '速度',
            dataIndex: 'spd',
        },
        {
            title: '暴击',
            dataIndex: 'cri',
        },
        {
            title: '暴击伤害',
            dataIndex: 'cri_dmg',
        },
        {
            title: '命中',
            dataIndex: 'eft_hit',
        },
        {
            title: '抵抗',
            dataIndex: 'eft_res',
        },
    ];


    export default {
        data() {
            return {
                count: 100,
                battleMode: '6v6', // 默认模式改为6v6
                results: {
                    '1v1': {winner0: 0, winner1: 0, error: 0},
                    '5v5': {winner0: 0, winner1: 0, error: 0},
                    '6v6': {winner0: 0, winner1: 0, error: 0}
                },
                errorLogs: [], // 错误日志
                data: this.$store.state.team0.concat(this.$store.state.team1),
                columns,
                total: 0,
            }
        },
        computed: {
            hasResults() {
                return this.results['1v1'].winner0 + this.results['1v1'].winner1 > 0 ||
                       this.results['5v5'].winner0 + this.results['5v5'].winner1 > 0 ||
                       this.results['6v6'].winner0 + this.results['6v6'].winner1 > 0;
            },
            team0Name() {
                return this.$store.state.team0Name || '红队';
            },
            team1Name() {
                return this.$store.state.team1Name || '蓝队';
            }
        },
        methods: {
            getAvatarPath(name, no) {
                return getAvatarPathByName(name, no);
            },
            onModeChange() {
                // 模式切换时的处理
            },
            getWinner() {
                // 重置当前模式的结果
                this.results[this.battleMode] = {winner0: 0, winner1: 0, error: 0};
                this.errorLogs = []; // 清空错误日志
                this.total = this.count;
                
                // 战斗相关变量
                let currentBattle = null;
                let isRunning = true;
                let processCount = 0;
                const maxProcessCount = 50000;
                const processesPerFrame = 500;
                let runBattle = null; // 先声明，后面赋值
                
                // 清理战斗对象的函数
                const cleanupBattle = () => {
                    if (currentBattle) {
                        currentBattle.buffs = [];
                        currentBattle.eventLogs = [];
                        currentBattle.pendingDamageLogs.clear();
                        currentBattle.pendingBuffLogs.clear();
                        currentBattle.fakeTurns = [];
                        currentBattle.entities.clear();
                        currentBattle = null;
                    }
                };
                
                // 页面可见性变化处理
                const handleVisibilityChange = () => {
                    if (document.hidden) {
                        isRunning = false;
                    } else {
                        if (isRunning === false && this.total > 0 && runBattle) {
                            isRunning = true;
                            setTimeout(runBattle, 10);
                        }
                    }
                };
                document.addEventListener('visibilitychange', handleVisibilityChange);
                
                const fn = () => {
                    if (!this.total || !isRunning) return;
                    
                    // 为队伍添加御魂信息
                    const soulSelections = this.$store.state.soulSelections;
                    const team0WithSoul = this.$store.state.team0.map((d, index) => {
                        return Object.assign({}, d, {soulIds: soulSelections[0][index] || []});
                    });
                    const team1WithSoul = this.$store.state.team1.map((d, index) => {
                        return Object.assign({}, d, {soulIds: soulSelections[1][index] || []});
                    });
                    
                    let team0Fighters, team1Fighters;
                    
                    // 根据选择的模式确定使用的角色范围
                    if (this.battleMode === '1v1') {
                        team0Fighters = team0WithSoul.slice(5, 6);
                        team1Fighters = team1WithSoul.slice(5, 6);
                    } else if (this.battleMode === '5v5') {
                        team0Fighters = team0WithSoul.slice(1, 6);
                        team1Fighters = team1WithSoul.slice(1, 6);
                    } else if (this.battleMode === '6v6') {
                        team0Fighters = team0WithSoul.slice(0, 6);
                        team1Fighters = team1WithSoul.slice(0, 6);
                    }
                    
                    // 验证队伍数据
                    if (!team0Fighters.length || !team1Fighters.length) {
                        console.error('队伍数据为空，无法进行战斗');
                        this.results[this.battleMode].error++;
                        this.total--;
                        setTimeout(fn, 1);
                        return;
                    }
                    
                    // 清理上一场战斗
                    cleanupBattle();
                    
                    // 创建新战斗
                    currentBattle = new Battle(team0Fighters.concat(team1Fighters));
                    processCount = 0;
                    
                    // 定义战斗执行函数
                    runBattle = () => {
                        if (!isRunning || !currentBattle) return;
                        
                        let frameCount = 0;
                        while (!currentBattle.isEnd && processCount < maxProcessCount && frameCount < processesPerFrame) {
                            const result = currentBattle.process();
                            processCount++;
                            frameCount++;
                            
                            if (!result) break;
                            
                            // 处理等待输入的情况
                            if (currentBattle.currentTask && currentBattle.currentTask.type === 'WaitInput') {
                                const waitInputData = currentBattle.currentTask.data;
                                if (waitInputData && waitInputData.skills && waitInputData.skills.length > 0) {
                                    const skills = waitInputData.skills;
                                    const defaultSkill = skills[0];
                                    if (defaultSkill && defaultSkill.targets && defaultSkill.targets.length > 0) {
                                        waitInputData.selection = {
                                            no: defaultSkill.no,
                                            targetId: currentBattle.getRandomOne(defaultSkill.targets)
                                        };
                                    }
                                }
                            }
                        }
                        
                        if (!currentBattle.isEnd && processCount < maxProcessCount) {
                            // 继续执行
                            if (typeof requestIdleCallback !== 'undefined') {
                                requestIdleCallback(() => runBattle(), {timeout: 50});
                            } else {
                                setTimeout(runBattle, 0);
                            }
                        } else {
                            // 战斗结束
                            if (processCount >= maxProcessCount) {
                                console.warn(`战斗超过最大处理次数 ${maxProcessCount}，强制结束`);
                            }
                            
                            if (currentBattle.winner === 0) this.results[this.battleMode].winner0++;
                            else if (currentBattle.winner === 1) this.results[this.battleMode].winner1++;
                            else {
                                this.results[this.battleMode].error++;
                                if (this.errorLogs.length < 10) {
                                    this.errorLogs.push({
                                        timestamp: new Date().toISOString(),
                                        mode: this.battleMode,
                                        processCount,
                                        turn: currentBattle.turn,
                                        winner: currentBattle.winner
                                    });
                                }
                            }
                            
                            // 清理战斗对象
                            cleanupBattle();
                            
                            this.total--;
                            
                            // 开始下一场战斗
                            if (this.total > 0) {
                                setTimeout(fn, 1);
                            } else {
                                // 所有战斗结束，移除事件监听
                                document.removeEventListener('visibilitychange', handleVisibilityChange);
                            }
                        }
                    };
                    
                    // 开始战斗
                    runBattle();
                };
                
                // 开始测试
                setTimeout(fn, 10);
            },
            exportResults() {
                // 导出测试结果
                const results = {
                    timestamp: new Date().toISOString(),
                    count: this.count,
                    modes: this.results,
                    errorLogs: this.errorLogs
                };
                
                const blob = new Blob([JSON.stringify(results, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `battle-prediction-results-${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            },
            showErrorLogs() {
                // 使用Ant Design Vue的Modal组件显示错误日志
                this.$modal.info({
                    title: '错误日志',
                    content: <pre style={{whiteSpace: 'pre-wrap'}}>{JSON.stringify(this.errorLogs, null, 2)}</pre>,
                    width: 800
                });
            }
        }

    }
</script>
<style>
    .predict {
        display: flex;
        justify-content: center;
        flex-direction: column;
        padding: 20px;
    }
    
    .mode-selector {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .progress-text {
        margin-left: 10px;
        color: #1890ff;
        font-weight: 500;
    }
    
    .result-text {
        margin-left: 10px;
        color: #52c41a;
        font-weight: 500;
    }
    
    .chart-container {
        background: #f5f5f5;
        padding: 20px;
        border-radius: 8px;
    }
    
    .chart-wrapper {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        margin-top: 10px;
    }
    
    .chart-item {
        flex: 1;
        min-width: 250px;
        background: white;
        padding: 15px;
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    
    .chart-item h4 {
        margin-top: 0;
        margin-bottom: 10px;
        color: #333;
    }
    
    .bar-chart {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 10px;
    }
    
    .bar {
        height: 30px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        padding: 0 10px;
        color: white;
        font-weight: 500;
        transition: width 0.3s ease;
    }
    
    .bar.red {
        background: #ff4d4f;
    }
    
    .bar.blue {
        background: #1890ff;
    }
    
    .bar.gray {
        background: #bfbfbf;
    }
    
    .bar-labels {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: #666;
    }
    
    @media screen and (max-width: 768px) {
        .chart-wrapper {
            flex-direction: column;
        }
        
        .chart-item {
            width: 100%;
        }
        
        .mode-selector {
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
        }
    }
</style>
