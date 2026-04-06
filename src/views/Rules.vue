<template>
    <div class="rules-container">
        <div class="rules-header">
            <h1>6v6 模拟对战规则手册</h1>
            <p>掌握战斗机制，成为Cdgame大师</p>
        </div>
        
        <div class="rules-content">
            <a-anchor :affix="true" :offsetTop="80" class="rules-nav">
                <a-anchor-link href="#battle-flow" title="战斗流程" />
                <a-anchor-link href="#turn-rules" title="回合结算">
                    <a-anchor-link href="#turn-types" title="回合类型" slot="children" />
                    <a-anchor-link href="#turn-order" title="行动顺序" slot="children" />
                    <a-anchor-link href="#turn-phases" title="回合阶段" slot="children" />
                </a-anchor-link>
                <a-anchor-link href="#damage-system" title="伤害计算">
                    <a-anchor-link href="#damage-formula" title="伤害公式" slot="children" />
                    <a-anchor-link href="#damage-flow" title="结算流程" slot="children" />
                    <a-anchor-link href="#critical" title="暴击机制" slot="children" />
                </a-anchor-link>
                <a-anchor-link href="#status-effects" title="状态效果">
                    <a-anchor-link href="#control-effects" title="控制效果" slot="children" />
                    <a-anchor-link href="#buff-system" title="Buff系统" slot="children" />
                    <a-anchor-link href="#effect-hit" title="命中抵抗" slot="children" />
                </a-anchor-link>
                <a-anchor-link href="#summon-system" title="召唤物系统">
                    <a-anchor-link href="#summon-mechanics" title="召唤机制" slot="children" />
                    <a-anchor-link href="#summon-attributes" title="属性规则" slot="children" />
                    <a-anchor-link href="#summon-actions" title="行动规则" slot="children" />
                </a-anchor-link>
                <a-anchor-link href="#mana-system" title="鬼火系统" />
                <a-anchor-link href="#victory" title="胜利判定" />
            </a-anchor>
            
            <div class="rules-main">
                <section id="battle-flow" class="rule-section">
                    <h2><a-icon type="thunderbolt" /> 战斗流程概述</h2>
                    <p class="section-desc">6v6 模拟战斗采用回合制战斗系统，每场战斗由以下主要阶段组成：</p>
                    
                    <a-steps direction="vertical" :current="-1" class="battle-steps">
                        <a-step title="战斗初始化" description="根据随机种子初始化战斗环境，创建双方实体，设置初始属性和位置" />
                        <a-step title="先机阶段" description="触发所有先机技能（如御魂效果、被动技能等），准备进入战斗" />
                        <a-step title="回合循环" description="按照行动条顺序依次执行每个实体的回合，直到战斗结束" />
                        <a-step title="胜负判定" description="当一方所有上场角色阵亡时战斗结束，判定胜负" />
                    </a-steps>
                </section>
                
                <section id="turn-rules" class="rule-section">
                    <h2><a-icon type="sync" /> 回合结算规则</h2>
                    
                    <a-divider id="turn-types" orientation="left">回合类型</a-divider>
                    <p>游戏中有三种回合类型，决定了行动的优先级和处理方式：</p>
                    
                    <a-table :columns="turnTypeColumns" :data-source="turnTypeData" :pagination="false" size="small" bordered>
                        <template slot="example" slot-scope="text">
                            <span class="example-text">{{ text }}</span>
                        </template>
                    </a-table>
                    
                    <a-alert message="行动优先级" type="info" show-icon class="priority-alert">
                        <template slot="description">
                            <strong>伪回合 → 额外回合 → 普通回合</strong>
                            <br />伪回合队列处理完毕后，才会处理额外回合，最后才是普通回合行动条
                        </template>
                    </a-alert>
                    
                    <a-divider id="turn-order" orientation="left">行动顺序</a-divider>
                    <p>行动条（Runway）决定普通回合的行动顺序：</p>
                    
                    <a-card class="order-card">
                        <a-timeline>
                            <a-timeline-item color="blue">每个实体根据<strong>速度值（SPD）</strong>在行动条上移动</a-timeline-item>
                            <a-timeline-item color="blue">速度值越高，移动越快，越早获得回合</a-timeline-item>
                            <a-timeline-item color="blue">当实体到达行动条顶端时，获得行动机会</a-timeline-item>
                            <a-timeline-item color="blue">行动完成后，实体回到行动条底部重新开始移动</a-timeline-item>
                        </a-timeline>
                    </a-card>
                    
                    <a-divider id="turn-phases" orientation="left">回合阶段详解</a-divider>
                    <p>每个回合分为以下阶段，按顺序执行：</p>
                    
                    <a-table :columns="phaseColumns" :data-source="phaseData" :pagination="false" size="small" bordered>
                        <template slot="detail" slot-scope="text">
                            <div v-html="text"></div>
                        </template>
                    </a-table>
                </section>
                
                <section id="damage-system" class="rule-section">
                    <h2><a-icon type="fire" /> 伤害计算系统</h2>
                    
                    <a-divider id="damage-formula" orientation="left">伤害计算公式</a-divider>
                    
                    <a-card class="formula-card">
                        <div class="formula-box">
                            <div class="formula-title">最终伤害公式</div>
                            <div class="formula-content">
                                最终伤害 = (基础伤害 × 倍率 × 暴击倍率 × 300) ÷ (目标防御 + 300) × 伤害倍率 × 御魂修正 × 波动系数
                            </div>
                        </div>
                        
                        <a-table :columns="formulaColumns" :data-source="formulaData" :pagination="false" size="small" bordered class="formula-desc" />
                    </a-card>
                    
                    <a-divider id="damage-flow" orientation="left">伤害结算流程</a-divider>
                    <p>伤害结算分为8个步骤，按顺序执行：</p>
                    
                    <a-steps direction="vertical" :current="-1" size="small" class="damage-steps">
                        <a-step title="初始化" description="初始化攻击上下文，准备攻击数据" />
                        <a-step title="数据准备" description="获取攻击者与目标属性，计算基础伤害" />
                        <a-step title="攻击前事件" description="触发 WILL_ATTACK、WILL_BE_ATTACKED 事件" />
                        <a-step title="暴击判定" description="根据暴击率判定是否暴击，触发 CRI 事件" />
                        <a-step title="伤害计算" description="计算最终伤害，护盾结算吸收伤害" />
                        <a-step title="伤害结算" description="扣除生命值，处理死亡逻辑" />
                        <a-step title="伤害后事件" description="触发 HAS_DAMAGED、HAS_BEEN_DAMAGED 事件" />
                        <a-step title="攻击后事件" description="触发 HAS_ATTACKED、HAS_BEEN_ATTACKED 事件" />
                    </a-steps>
                    
                    <a-alert message="护盾结算" type="warning" show-icon class="shield-alert">
                        <template slot="description">
                            护盾在伤害结算前吸收伤害：获取目标所有护盾Buff → 按顺序用护盾值抵扣伤害 → 护盾值耗尽后移除护盾Buff → 剩余伤害扣除生命值
                        </template>
                    </a-alert>
                    
                    <a-divider id="critical" orientation="left">暴击机制</a-divider>
                    
                    <a-row :gutter="16">
                        <a-col :span="12">
                            <a-card title="暴击判定" size="small">
                                <ul class="rule-list">
                                    <li>暴击率由 <strong>CRI</strong> 属性决定</li>
                                    <li>暴击伤害由 <strong>CRI_DMG</strong> 属性决定（默认150%）</li>
                                    <li><strong>间接伤害</strong>：目标防御为0时必然暴击</li>
                                    <li>暴击触发 <strong>CRI</strong> 事件</li>
                                </ul>
                            </a-card>
                        </a-col>
                        <a-col :span="12">
                            <a-card title="伤害示例" size="small">
                                <div class="example-box">
                                    <p><strong>假设：</strong>攻击力1000，技能倍率125%，暴击伤害150%，目标防御300</p>
                                    <p><strong>普通伤害：</strong>(1000 × 1.25 × 300) ÷ (300 + 300) = 625</p>
                                    <p><strong>暴击伤害：</strong>(1000 × 1.25 × 1.5 × 300) ÷ (300 + 300) = 937.5</p>
                                </div>
                            </a-card>
                        </a-col>
                    </a-row>
                </section>
                
                <section id="status-effects" class="rule-section">
                    <h2><a-icon type="experiment" /> 状态效果处理</h2>
                    
                    <a-divider id="control-effects" orientation="left">控制效果</a-divider>
                    
                    <a-table :columns="controlColumns" :data-source="controlData" :pagination="false" size="small" bordered>
                        <template slot="canAct" slot-scope="text">
                            <a-tag :color="text ? 'green' : 'red'">{{ text ? '可行动' : '无法行动' }}</a-tag>
                        </template>
                    </a-table>
                    
                    <a-divider id="buff-system" orientation="left">Buff/Debuff系统</a-divider>
                    
                    <a-tabs defaultActiveKey="1">
                        <a-tab-pane tab="Buff参数" key="1">
                            <a-table :columns="buffParamColumns" :data-source="buffParamData" :pagination="false" size="small" bordered />
                        </a-tab-pane>
                        <a-tab-pane tab="倒计时规则" key="2">
                            <a-card size="small">
                                <ul class="rule-list">
                                    <li><code>countDown &gt; 0</code>：每回合减少1，归零时移除</li>
                                    <li><code>countDown &lt; 0</code>：永久存在，直到战斗结束</li>
                                    <li><code>countDown === undefined</code>：立即移除</li>
                                </ul>
                            </a-card>
                        </a-tab-pane>
                    </a-tabs>
                    
                    <a-divider id="effect-hit" orientation="left">效果命中与抵抗</a-divider>
                    
                    <a-card class="formula-card">
                        <div class="formula-box">
                            <div class="formula-title">效果命中公式</div>
                            <div class="formula-content">
                                实际命中概率 = 基础概率 + 效果命中 - 效果抵抗
                            </div>
                        </div>
                    </a-card>
                    
                    <a-row :gutter="16" style="margin-top: 16px;">
                        <a-col :span="12">
                            <a-statistic title="效果命中 (EFT_HIT)" value="增加debuff命中概率">
                                <template slot="suffix">
                                    <a-icon type="arrow-up" style="color: #3f8600" />
                                </template>
                            </a-statistic>
                        </a-col>
                        <a-col :span="12">
                            <a-statistic title="效果抵抗 (EFT_RES)" value="减少被施加debuff的概率">
                                <template slot="suffix">
                                    <a-icon type="arrow-down" style="color: #cf1322" />
                                </template>
                            </a-statistic>
                        </a-col>
                    </a-row>
                </section>
                
                <section id="summon-system" class="rule-section">
                    <h2><a-icon type="plus-circle" /> 召唤物系统</h2>
                    
                    <a-divider id="summon-mechanics" orientation="left">召唤机制</a-divider>
                    
                    <a-alert message="召唤位限制" type="info" show-icon>
                        <template slot="description">
                            每个阵营（红队/蓝队）同时只能存在 <strong>1个召唤物</strong>，新召唤的召唤物会顶替旧的召唤物
                        </template>
                    </a-alert>
                    
                    <a-card title="召唤流程" size="small" style="margin-top: 16px;">
                        <a-steps :current="-1" size="small">
                            <a-step title="检查" description="检查是否已有召唤物" />
                            <a-step title="移除" description="移除已有召唤物（如果存在）" />
                            <a-step title="创建" description="创建召唤物实体" />
                            <a-step title="设置" description="设置召唤物属性（继承规则）" />
                            <a-step title="加入" description="加入战场（位置7）" />
                        </a-steps>
                    </a-card>
                    
                    <a-divider id="summon-attributes" orientation="left">属性继承规则</a-divider>
                    
                    <a-alert message="重要提示" type="warning" show-icon>
                        <template slot="description">
                            不同召唤物的属性继承规则<strong>完全不同</strong>，需要单独实现
                        </template>
                    </a-alert>
                    
                    <a-card title="化妆镜示例" size="small" style="margin-top: 16px;">
                        <p>继承召唤者30%生命值：</p>
                        <ul class="rule-list">
                            <li>MAX_HP：召唤者最大生命值的30%</li>
                            <li>ATK：0</li>
                            <li>DEF：0</li>
                            <li>SPD：0</li>
                        </ul>
                    </a-card>
                    
                    <a-divider id="summon-actions" orientation="left">行动规则</a-divider>
                    
                    <a-row :gutter="16">
                        <a-col :span="12">
                            <a-card title="无独立行动条" size="small">
                                <ul class="rule-list">
                                    <li>召唤物不会进入普通回合队列</li>
                                    <li>召唤物不会主动行动</li>
                                    <li>召唤物可以被其他技能触发（如反击、协战）</li>
                                </ul>
                            </a-card>
                        </a-col>
                        <a-col :span="12">
                            <a-card title="作为目标" size="small">
                                <ul class="rule-list">
                                    <li>召唤物属于<strong>友方单位</strong></li>
                                    <li>可以被选为技能目标</li>
                                    <li>可以触发反击、协战、薙魂等效果</li>
                                    <li>群体技能会优先选取召唤物作为目标</li>
                                </ul>
                            </a-card>
                        </a-col>
                    </a-row>
                    
                    <a-card title="消失条件" size="small" style="margin-top: 16px;">
                        <a-list :data-source="summonDisappearData" size="small">
                            <a-list-item slot="renderItem" slot-scope="item">
                                <a-list-item-meta :description="item.desc">
                                    <span slot="title">{{ item.title }}</span>
                                </a-list-item-meta>
                            </a-list-item>
                        </a-list>
                    </a-card>
                </section>
                
                <section id="mana-system" class="rule-section">
                    <h2><a-icon type="fire" /> 鬼火系统</h2>
                    
                    <a-row :gutter="16">
                        <a-col :span="12">
                            <a-card title="鬼火机制" size="small">
                                <ul class="rule-list">
                                    <li>每个队伍独立拥有鬼火资源</li>
                                    <li>初始鬼火：<strong>4点</strong></li>
                                    <li>最大鬼火：<strong>8点</strong></li>
                                </ul>
                            </a-card>
                        </a-col>
                        <a-col :span="12">
                            <a-card title="鬼火条" size="small">
                                <div class="mana-bar">
                                    <span class="mana-slot">□</span>
                                    <span class="mana-slot">□</span>
                                    <span class="mana-slot">□</span>
                                    <span class="mana-slot">□</span>
                                    <span class="mana-slot">□</span>
                                </div>
                                <p style="margin-top: 8px; font-size: 12px; color: #666;">
                                    进度满5格 → 增加预备鬼火 → 进度归零
                                </p>
                            </a-card>
                        </a-col>
                    </a-row>
                    
                    <a-card title="鬼火消耗" size="small" style="margin-top: 16px;">
                        <ul class="rule-list">
                            <li>技能消耗鬼火：0-3点不等</li>
                            <li>鬼火不足时无法使用技能</li>
                            <li>每回合推进1格鬼火进度</li>
                        </ul>
                    </a-card>
                </section>
                
                <section id="victory" class="rule-section">
                    <h2><a-icon type="trophy" /> 胜利判定</h2>
                    
                    <a-alert message="判定条件" type="success" show-icon>
                        <template slot="description">
                            战斗胜利条件：<strong>所有敌方本体式神阵亡</strong>
                        </template>
                    </a-alert>
                    
                    <a-card title="场地位置说明" size="small" style="margin-top: 16px;">
                        <a-table :columns="positionColumns" :data-source="positionData" :pagination="false" size="small" bordered>
                            <template slot="judge" slot-scope="text">
                                <a-tag :color="text ? 'green' : 'orange'">{{ text ? '参与判定' : '不参与判定' }}</a-tag>
                            </template>
                        </a-table>
                    </a-card>
                    
                    <a-alert message="注意" type="warning" show-icon style="margin-top: 16px;">
                        <template slot="description">
                            召唤物（位置7）是否存活<strong>不影响</strong>胜负判定
                        </template>
                    </a-alert>
                </section>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'Rules',
    data() {
        return {
            turnTypeColumns: [
                { title: '类型', dataIndex: 'type', width: 120 },
                { title: '说明', dataIndex: 'desc' },
                { title: '示例', dataIndex: 'example', scopedSlots: { customRender: 'example' } },
            ],
            turnTypeData: [
                { key: '1', type: '普通回合', desc: '正常行动条结算的回合', example: '常规行动' },
                { key: '2', type: '额外回合', desc: '拉条/获得新回合，行动条拉至最大', example: '妖琴师拉条、神乐疾风、镰鼬再动、轮入道触发' },
                { key: '3', type: '伪回合', desc: '反击/追击，不影响行动条位置', example: '犬神反击、陆生反击、狰反击、黑童子追击' },
            ],
            phaseColumns: [
                { title: '阶段', dataIndex: 'phase', width: 120 },
                { title: '处理内容', dataIndex: 'detail', scopedSlots: { customRender: 'detail' } },
            ],
            phaseData: [
                { key: '1', phase: '回合开始', detail: '检查存活状态、控制效果、混乱/嘲讽状态、触发回合开始事件' },
                { key: '2', phase: 'Buff处理', detail: '处理所有带有倒计时的Buff，倒计时归零的Buff被移除' },
                { key: '3', phase: '鬼火推进', detail: '推进当前队伍的鬼火条进度，满5格时增加预备鬼火' },
                { key: '4', phase: '行动阶段', detail: '根据状态执行行动：无法行动跳过、被嘲讽强制攻击、混乱随机攻击、正常选择技能' },
                { key: '5', phase: '技能选择', detail: '过滤可使用技能，通过AI或手动输入选择技能和目标，执行技能效果' },
                { key: '6', phase: '回合结束', detail: '刷新日志，触发行动结束/回合结束事件，结算鬼火进度' },
            ],
            controlColumns: [
                { title: '控制类型', dataIndex: 'type', width: 100 },
                { title: '效果', dataIndex: 'effect' },
                { title: '可行动', dataIndex: 'canAct', width: 100, scopedSlots: { customRender: 'canAct' } },
            ],
            controlData: [
                { key: '1', type: '眩晕', effect: '无法行动', canAct: false },
                { key: '2', type: '睡眠', effect: '无法行动，受击后解除', canAct: false },
                { key: '3', type: '冰冻', effect: '无法行动', canAct: false },
                { key: '4', type: '变形', effect: '无法行动', canAct: false },
                { key: '5', type: '混乱', effect: '随机攻击任意目标（包括队友）', canAct: true },
                { key: '6', type: '沉默', effect: '无法使用技能', canAct: true },
                { key: '7', type: '嘲讽', effect: '强制攻击嘲讽来源', canAct: true },
                { key: '8', type: '禁锢', effect: '无法被位移', canAct: true },
            ],
            buffParamColumns: [
                { title: '参数', dataIndex: 'param', width: 150 },
                { title: '说明', dataIndex: 'desc' },
            ],
            buffParamData: [
                { key: '1', param: 'NO_DISPEL', desc: '不可驱散' },
                { key: '2', param: 'NO_REMOVE', desc: '不可清除' },
                { key: '3', param: 'STAMP', desc: '印记' },
                { key: '4', param: 'ENCHANTMENT', desc: '结界' },
                { key: '5', param: 'FAIRYLAND', desc: '幻境' },
                { key: '6', param: 'BUFF', desc: '增益效果' },
                { key: '7', param: 'DEBUFF', desc: '减益效果' },
                { key: '8', param: 'SHIELD', desc: '护盾' },
                { key: '9', param: 'KEEP_ON_DEATH', desc: '死亡时保留（复活后仍存在）' },
            ],
            formulaColumns: [
                { title: '参数', dataIndex: 'param', width: 100 },
                { title: '说明', dataIndex: 'desc' },
            ],
            formulaData: [
                { key: '1', param: '基础伤害', desc: '攻击力或技能指定数值' },
                { key: '2', param: '倍率', desc: '技能伤害倍率（如125% = 1.25）' },
                { key: '3', param: '暴击倍率', desc: '暴击时为暴击伤害（默认150%），否则为100%' },
                { key: '4', param: '伤害倍率', desc: '(造成伤害增益 ÷ 造成伤害减益) × (承受伤害增益 ÷ 承受伤害减益)' },
                { key: '5', param: '御魂修正', desc: '御魂增伤 × 御魂减伤' },
                { key: '6', param: '波动系数', desc: '随机浮动（默认±0%）' },
            ],
            summonDisappearData: [
                { title: '被顶替', desc: '新召唤物替换旧召唤物' },
                { title: '生命值归零', desc: '被攻击至生命值为0' },
                { title: '召唤者阵亡', desc: '部分召唤物与召唤者绑定' },
                { title: '技能效果结束', desc: '特定技能规定的持续时间结束' },
            ],
            positionColumns: [
                { title: '位置', dataIndex: 'position', width: 80 },
                { title: '名称', dataIndex: 'name', width: 80 },
                { title: '说明', dataIndex: 'desc' },
                { title: '胜负判定', dataIndex: 'judge', width: 100, scopedSlots: { customRender: 'judge' } },
            ],
            positionData: [
                { key: '0', position: '0', name: '教练', desc: '教练位置', judge: true },
                { key: '1', position: '1', name: '先锋', desc: '主力位置1', judge: true },
                { key: '2', position: '2', name: '次锋', desc: '主力位置2', judge: true },
                { key: '3', position: '3', name: '中坚', desc: '主力位置3', judge: true },
                { key: '4', position: '4', name: '副将', desc: '主力位置4', judge: true },
                { key: '5', position: '5', name: '大将', desc: '主力位置5', judge: true },
                { key: '6', position: '6', name: '替补', desc: '替补位置', judge: false },
                { key: '7', position: '7', name: '应援/召唤物', desc: '应援或召唤物位置', judge: false },
            ],
        }
    },
}
</script>

<style scoped>
.rules-container {
    height: 100%;
    background: #f0f2f5;
}

.rules-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 24px 32px;
    text-align: center;
}

.rules-header h1 {
    color: white;
    margin: 0;
    font-size: 28px;
}

.rules-header p {
    margin: 8px 0 0;
    opacity: 0.9;
}

.rules-content {
    display: flex;
    height: calc(100% - 100px);
}

.rules-nav {
    width: 200px;
    background: white;
    padding: 16px;
    overflow-y: auto;
    flex-shrink: 0;
    border-right: 1px solid #e8e8e8;
}

.rules-main {
    flex: 1;
    padding: 24px 32px;
    overflow-y: auto;
}

.rule-section {
    background: white;
    border-radius: 8px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.rule-section h2 {
    margin: 0 0 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #667eea;
    color: #333;
}

.rule-section h2 .anticon {
    margin-right: 8px;
    color: #667eea;
}

.section-desc {
    color: #666;
    margin-bottom: 16px;
}

.battle-steps,
.damage-steps {
    margin-top: 16px;
}

.priority-alert,
.shield-alert {
    margin-top: 16px;
}

.order-card {
    margin-top: 16px;
}

.formula-card {
    margin-top: 16px;
}

.formula-box {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    margin-bottom: 16px;
}

.formula-title {
    font-size: 14px;
    opacity: 0.9;
    margin-bottom: 8px;
}

.formula-content {
    font-size: 16px;
    font-weight: 500;
    line-height: 1.6;
}

.formula-desc {
    background: #fafafa;
}

.example-text {
    color: #666;
    font-size: 12px;
}

.example-box {
    background: #fafafa;
    padding: 12px;
    border-radius: 4px;
    font-size: 13px;
}

.example-box p {
    margin: 4px 0;
}

.rule-list {
    margin: 0;
    padding-left: 20px;
}

.rule-list li {
    margin: 8px 0;
    line-height: 1.6;
}

.mana-bar {
    display: flex;
    gap: 4px;
}

.mana-slot {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ff4d4f;
    color: white;
    border-radius: 4px;
    font-weight: bold;
}

::v-deep .ant-divider-inner-text {
    color: #667eea;
    font-weight: 500;
}

::v-deep .ant-anchor-link-title {
    font-size: 13px;
}

::v-deep .ant-steps-item-description {
    max-width: 100% !important;
}
</style>
