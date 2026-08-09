// 直接引用核心模块
const { Battle } = require('./core');

// 测试函数
async function testBattle() {
    console.log('开始测试战斗模拟系统...');
    
    // 测试配置
    const testCases = [
        {
            name: '6v6 标准配置',
            team0: [
                { no: 1, teamId: 0, max_hp: 10000, atk: 1000, def: 500, spd: 100 },
                { no: 2, teamId: 0, max_hp: 12000, atk: 800, def: 600, spd: 110 },
                { no: 3, teamId: 0, max_hp: 8000, atk: 1200, def: 400, spd: 120 },
                { no: 4, teamId: 0, max_hp: 9000, atk: 900, def: 550, spd: 90 },
                { no: 5, teamId: 0, max_hp: 11000, atk: 950, def: 520, spd: 95 },
                { no: 6, teamId: 0, max_hp: 13000, atk: 700, def: 650, spd: 85 }
            ],
            team1: [
                { no: 7, teamId: 1, max_hp: 10500, atk: 950, def: 520, spd: 105 },
                { no: 8, teamId: 1, max_hp: 11500, atk: 850, def: 580, spd: 115 },
                { no: 9, teamId: 1, max_hp: 8500, atk: 1150, def: 420, spd: 125 },
                { no: 10, teamId: 1, max_hp: 9500, atk: 850, def: 570, spd: 95 },
                { no: 11, teamId: 1, max_hp: 11500, atk: 900, def: 540, spd: 100 },
                { no: 12, teamId: 1, max_hp: 13500, atk: 650, def: 670, spd: 90 }
            ]
        },
        {
            name: '6v6 高速配置',
            team0: [
                { no: 1, teamId: 0, max_hp: 8000, atk: 800, def: 300, spd: 150 },
                { no: 2, teamId: 0, max_hp: 9000, atk: 700, def: 350, spd: 160 },
                { no: 3, teamId: 0, max_hp: 7000, atk: 900, def: 250, spd: 170 },
                { no: 4, teamId: 0, max_hp: 8500, atk: 750, def: 320, spd: 140 },
                { no: 5, teamId: 0, max_hp: 9500, atk: 720, def: 330, spd: 145 },
                { no: 6, teamId: 0, max_hp: 10000, atk: 650, def: 380, spd: 135 }
            ],
            team1: [
                { no: 7, teamId: 1, max_hp: 8500, atk: 750, def: 320, spd: 155 },
                { no: 8, teamId: 1, max_hp: 9500, atk: 650, def: 370, spd: 165 },
                { no: 9, teamId: 1, max_hp: 7500, atk: 850, def: 270, spd: 175 },
                { no: 10, teamId: 1, max_hp: 9000, atk: 700, def: 340, spd: 145 },
                { no: 11, teamId: 1, max_hp: 10000, atk: 680, def: 350, spd: 150 },
                { no: 12, teamId: 1, max_hp: 10500, atk: 600, def: 400, spd: 140 }
            ]
        },
        {
            name: '6v6 高攻击配置',
            team0: [
                { no: 1, teamId: 0, max_hp: 6000, atk: 1500, def: 200, spd: 80 },
                { no: 2, teamId: 0, max_hp: 6500, atk: 1400, def: 220, spd: 85 },
                { no: 3, teamId: 0, max_hp: 5500, atk: 1600, def: 180, spd: 90 },
                { no: 4, teamId: 0, max_hp: 5800, atk: 1450, def: 190, spd: 75 },
                { no: 5, teamId: 0, max_hp: 6200, atk: 1420, def: 210, spd: 78 },
                { no: 6, teamId: 0, max_hp: 6800, atk: 1350, def: 230, spd: 72 }
            ],
            team1: [
                { no: 7, teamId: 1, max_hp: 6200, atk: 1450, def: 210, spd: 82 },
                { no: 8, teamId: 1, max_hp: 6700, atk: 1350, def: 230, spd: 87 },
                { no: 9, teamId: 1, max_hp: 5700, atk: 1550, def: 190, spd: 92 },
                { no: 10, teamId: 1, max_hp: 6000, atk: 1400, def: 200, spd: 77 },
                { no: 11, teamId: 1, max_hp: 6400, atk: 1380, def: 220, spd: 80 },
                { no: 12, teamId: 1, max_hp: 7000, atk: 1300, def: 240, spd: 74 }
            ]
        }
    ];
    
    // 测试结果
    const results = [];
    
    // 运行每个测试用例
    for (const testCase of testCases) {
        console.log(`\n测试: ${testCase.name}`);
        
        const totalBattles = 100;
        let winner0 = 0;
        let winner1 = 0;
        let error = 0;
        
        for (let i = 0; i < totalBattles; i++) {
            try {
                const battle = new Battle(testCase.team0.concat(testCase.team1));
                let processCount = 0;
                const maxProcessCount = 10000;
                
                while (battle.process() && processCount < maxProcessCount) {
                    processCount++;
                }
                
                if (battle.winner === 0) winner0++;
                else if (battle.winner === 1) winner1++;
                else error++;
            } catch (err) {
                console.error(`战斗 ${i+1} 出错:`, err);
                error++;
            }
        }
        
        const errorRate = (error / totalBattles) * 100;
        console.log(`结果: 红队赢 ${winner0} 次 (${(winner0/totalBattles*100).toFixed(2)}%), 蓝队赢 ${winner1} 次 (${(winner1/totalBattles*100).toFixed(2)}%), 错误 ${error} 次 (${errorRate.toFixed(2)}%)`);
        
        results.push({
            testCase: testCase.name,
            totalBattles,
            winner0,
            winner1,
            error,
            errorRate
        });
    }
    
    // 输出总结
    console.log('\n测试总结:');
    let totalErrorRate = 0;
    for (const result of results) {
        console.log(`${result.testCase}: 错误率 ${result.errorRate.toFixed(2)}%`);
        totalErrorRate += result.errorRate;
    }
    const averageErrorRate = totalErrorRate / results.length;
    console.log(`\n平均错误率: ${averageErrorRate.toFixed(2)}%`);
    
    if (averageErrorRate < 5) {
        console.log('✓ 测试通过！平均错误率低于5%');
    } else {
        console.log('✗ 测试失败！平均错误率高于5%');
    }
}

// 运行测试
testBattle().catch(console.error);
