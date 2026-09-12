/**
 * 队伍能量（原"鬼火"）
 * 支持通过 BattleOptions 配置初始点数、上限、进度目标与每次恢复量。
 */
export default class Energy {
    num: number; // 当前能量数量
    progress: number; // 能量进度条
    preProgress: number; // 进度满时一次性恢复多少点
    initNum: number; // 初始数量
    maxNum: number; // 能量上限
    progressGoal: number; // 进度满值（达到后触发恢复）

    constructor(initNum: number, maxNum = 8, preProgress = 5, progressGoal = 5) {
        this.initNum = initNum;
        this.num = initNum;
        this.progress = 0;
        this.preProgress = preProgress;
        this.maxNum = maxNum;
        this.progressGoal = progressGoal;
    }
}
