/**
 * 裁判旗机制测试文件
 */

import {JudgeFlag, runJudgeFlagTests} from './core/judge-flag';

// 运行测试用例
runJudgeFlagTests();

// 额外测试：验证伤害和治疗倍率计算
console.log('\n=== 额外测试：伤害和治疗倍率计算 ===');

const judgeFlag = new JudgeFlag();

// 测试1：初始状态
console.log('\n测试1：初始状态');
console.log('伤害倍率:', judgeFlag.getDamageMultiplier());
console.log('治疗倍率:', judgeFlag.getHealMultiplier());

// 测试2：行动3次
console.log('\n测试2：行动3次');
for (let i = 0; i < 3; i++) {
    judgeFlag.onJudgeKingAction();
}
console.log('伤害倍率:', judgeFlag.getDamageMultiplier());
console.log('治疗倍率:', judgeFlag.getHealMultiplier());

// 测试3：行动4次（验证减疗上限）
console.log('\n测试3：行动4次');
judgeFlag.onJudgeKingAction();
console.log('伤害倍率:', judgeFlag.getDamageMultiplier());
console.log('治疗倍率:', judgeFlag.getHealMultiplier());

// 测试4：行动10次
console.log('\n测试4：行动10次');
for (let i = 0; i < 6; i++) {
    judgeFlag.onJudgeKingAction();
}
console.log('伤害倍率:', judgeFlag.getDamageMultiplier());
console.log('治疗倍率:', judgeFlag.getHealMultiplier());

// 测试5：行动16次
console.log('\n测试5：行动16次');
for (let i = 0; i < 6; i++) {
    judgeFlag.onJudgeKingAction();
}
console.log('伤害倍率:', judgeFlag.getDamageMultiplier());
console.log('治疗倍率:', judgeFlag.getHealMultiplier());

console.log('\n=== 所有测试完成 ===');
