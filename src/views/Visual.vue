<template xmlns:v-slot="http://www.w3.org/1999/XSL/Transform">
    <div class="debug" @click="closePanel">
        <div class="float-panel" v-if="panelType" @click.stop>
            <template v-if="panelType==='entity'">
                <div class="panel-header">
                    <div class="panel-avatar">
                        <img :src="getAvatarPath(panelEntity && panelEntity.no)" class="square-avatar" />
                    </div>
                    <div class="panel-title">
                        <div class="panel-name">{{ panelEntity && panelEntity.name }}</div>
                        <div class="panel-hp">
                            <span class="hp-text">{{ panelRawData.hp }} / {{ panelRawData.maxHp }}</span>
                            <a-progress :percent="panelRawData.maxHp > 0 ? Math.ceil(panelRawData.hp / panelRawData.maxHp * 100) : 0" :showInfo="false" status="exception" />
                        </div>
                    </div>
                </div>
                
                <a-divider style="margin: 12px 0;" />
                
                <div class="panel-section">
                    <div class="section-title">基础属性</div>
                    <div class="stats-grid">
                        <div class="stat-item" v-for="(value, key) in panelData" :key="key">
                            <span class="stat-label">{{ key }}</span>
                            <span class="stat-value">{{ value }}</span>
                        </div>
                    </div>
                </div>
                
                <div class="panel-section" v-if="panelSouls && panelSouls.length > 0">
                    <div class="section-title">御魂信息</div>
                    <div class="soul-list">
                        <div v-for="(soul, index) in panelSouls" :key="index" class="soul-item">
                            <div class="soul-header">
                                <span class="soul-name">{{ soul.name }}</span>
                                <span class="soul-stats">{{ soul.mainStat }}</span>
                            </div>
                            <div v-if="soul.description" class="soul-description">{{ soul.description }}</div>
                        </div>
                    </div>
                </div>
                
                <div class="panel-section" v-if="panelBuffs && panelBuffs.length > 0">
                    <div class="section-title">Buff效果</div>
                    <div class="buff-list">
                        <div v-for="buff in panelBuffs" :key="buff.buffId" class="buff-card" @click="showBuffDetail(buff)">
                            <div class="buff-header-row">
                                <span class="buff-name">{{ buff.name }}</span>
                                <a-tag :color="getBuffTypeColor(buff)" size="small">{{ getBuffTypeText(buff) }}</a-tag>
                            </div>
                            <div class="buff-details">
                                <span v-if="buff.countDown !== undefined" class="buff-duration">剩余 {{ buff.countDown }} 回合</span>
                                <span v-if="buff.count > 1" class="buff-count">层数: {{ buff.count }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>
        <div class="info-bar" v-show="!hideDebugInfo">
            <span class="info-item seed-control">
                <span class="seed-label">Seed:</span>
                <a-input 
                    v-model="inputSeedStr" 
                    size="small"
                    class="seed-input"
                    placeholder="输入seed值"
                    @pressEnter="applySeed"
                />
                <a-button 
                    type="primary" 
                    size="small"
                    class="seed-btn"
                    @click="applySeed"
                >
                    应用
                </a-button>
            </span>
            <span class="info-item hint-text">{{data.hint}}</span>
        </div>
        <div v-if="data.event">事件: {{data.event}}</div>

        <div class="select-skill-field">
            <a-button 
                type="danger" 
                :block="false" 
                style="width: 80px; margin-right: 10px;"
                @click="resetBattle"
            >
                重置
            </a-button>
            <a-button 
                type="primary" 
                :block="false" 
                style="width: 100px; margin-right: 10px;"
                @click="runToEnd"
                :disabled="battle && battle.isEnd"
            >
                一键结果
            </a-button>
            <a-input-number v-model="depth"  style="width: 50px; margin-right: 5px; " :defaultValue="0" :max="10" :min="0"/>
            <a-button @click="step" :block="false" style="width: 100px; ">下一步</a-button>
            <a-button 
                :block="false" 
                :style="{width: '100px', marginLeft: '10px', backgroundColor: autoMode ? '#52c41a' : '#fff', color: autoMode ? '#fff' : '#333', borderColor: autoMode ? '#52c41a' : '#d9d9d9'}"
                @click="toggleAutoMode">
                Auto
            </a-button>
            <a-button :block="false" style="width: 100px; margin-left: 20px;" v-for="skill in data.skills"
                      :key="skill.no" @click="selectSkill(skill.no)" :disabled="!!selectionNo">{{skill.name || `技能
                ${skill.no}`}}
            </a-button>
            <a-button :block="false" style="width: 100px;  margin-left: 20px;" v-if="data.skills.length"
                      @click="useSkill(0, 0)">AI
            </a-button>
            <a-button :block="false" style="width: 100px;  margin-left: 20px;" v-if="selectionNo"
                      @click="selectionNo = 0">取消
            </a-button>
        </div>
        <div class="runway-field"> 
            <a-avatar  v-for="item in data.runway" :key="item.entityId"   class="runway-item" :class="{team0: item.teamId === 0, team1: item.teamId === 1, frozen: item.frozen, current: item.entityId === data.currentId, dead: item.dead}" :src="getAvatarPath(item.no)"  :style="{ left:  Math.floor((item.distance / 100)) + '%' }" @click="navigateToHeroList(item.no)"/>
        </div>
        <div class="team-field" v-for="teamId in 2" :key="teamId">
            <div class="mana-bar" :class="['team' + (teamId - 1)]">
                <div class="mana-label">{{ teamId === 1 ? team0Name : team1Name }}鬼火</div>
                <div class="mana-orbs">
                    <span 
                        v-for="n in 8" 
                        :key="n" 
                        class="mana-orb"
                        :class="[
                            n <= data.mana[teamId - 1].num ? 'filled' : '',
                            'team' + (teamId - 1),
                            (n === data.mana[teamId - 1].num + 1 && data.mana[teamId - 1].progress > 0) ? 'progressing' : ''
                        ]"
                    ></span>
                </div>
                <div class="mana-progress" v-if="data.mana[teamId - 1].progress > 0">
                    <span class="progress-label">回复中</span>
                    <span class="progress-value">{{ Math.floor(data.mana[teamId - 1].progress * 100) }}%</span>
                </div>
            </div>
            <div class="global-buffs">
                <div v-for="buff in data.globalBuffs[teamId-1]" :key="buff.buffId" class="buff-item" @click.stop="showBuffDetail(buff)">
                    <img v-if="buff.icon" :src="'/public/buff/'+icon"/>
                    <a-tag v-else>{{buff.name}} {{buff.count > 1 ? buff.count : ''}}</a-tag>
                    <span v-if="buff.countDown !== undefined" class="buff-countdown">{{ buff.countDown }}</span>
                </div>
            </div>
            <div class="hero-field">
                <div v-for="(e, idx) in data.teams[teamId - 1]" :key="e.entityId">
                    <div class="hero-card-wrap"
                         :class="{
                             dead: e.dead,
                             unselectable: selectionNo && selectedSkill && !selectedSkill.targets.includes(e.entityId),
                             selectable: selectionNo && selectedSkill && selectedSkill.targets.includes(e.entityId),
                             'current-turn': data.currentId === e.entityId,
                             'team0': teamId === 1,
                             'team1': teamId === 2
                         }"
                         @click.stop="selectHero(e)"
                    >
                        <div class="hero-info">
                            <div class="hero-info-left">
                                <div class="position-label">{{ positionLabels[idx] }}</div>
                                <a-avatar class="hero-avatar active" :class="'team' + (teamId - 1)" :src="getAvatarPath(e.no)" size="large" @click.stop="navigateToHeroList(e.no)"/>
                            </div>
                            <div class="hero-properties">
                                <div  v-if="!e.dead" class="bold">{{e.name}}【{{Math.round(e.hp)}}/{{Math.round(e.maxHp)}}】</div>
                                <div v-if="!e.dead" class="hp-bar">
                                    <a-progress size="small" :percent="Math.ceil(e.hp / e.maxHp * 100)"
                                                :showInfo="false"
                                                status="exception"/>
                                </div>
                            </div>
                        </div>
                        <div class="hero-buffs">
                            <div v-for="buff in e.buffs" :key="buff.buffId" class="buff-item" @click.stop="showBuffDetail(buff)">
                                <img v-if="buff.icon" :src="'/public/buff/'+icon"/>
                                <a-tag v-else>{{buff.name}} {{buff.count > 1 ? buff.count : ''}}</a-tag>
                                <span v-if="buff.countDown !== undefined" class="buff-countdown">{{ buff.countDown }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="battle-log-container" ref="logContainer">
            <div class="battle-log-header">
                <span>战斗日志</span>
                <a-button 
                    v-if="battle && battle.isEnd"
                    type="link" 
                    size="small"
                    class="stats-btn"
                    @click="showBattleStats = true"
                >
                    查看统计
                </a-button>
            </div>
            <div class="battle-log-content" ref="logContent">
                <div v-for="(log, index) in battleLogs" :key="index" class="log-item" :class="log.type">
                    <span class="log-time">{{log.time}}</span>
                    <span class="log-message">{{log.message}}</span>
                </div>
            </div>
        </div>

        <div>

        </div>
        
        <BattleStats 
            :visible="showBattleStats" 
            :battle="battle"
            @close="showBattleStats = false"
        />
        
        <a-modal
            v-model="showBuffModal"
            title="Buff详情"
            width="450px"
            :footer="null"
            class="buff-detail-modal"
            @cancel="showBuffModal = false"
        >
            <div class="buff-detail-content" v-if="currentBuff">
                <div class="buff-header">
                    <div class="buff-title-row">
                        <span class="buff-name">{{ currentBuff.name || '未命名' }}</span>
                        <a-tag :color="getBuffTypeColor(currentBuff)">{{ getBuffTypeText(currentBuff) }}</a-tag>
                    </div>
                    <div class="buff-source" v-if="getBuffDesc(currentBuff)">
                        {{ getBuffDesc(currentBuff).source }}
                    </div>
                </div>
                
                <a-divider style="margin: 12px 0;" />
                
                <div class="buff-section" v-if="getBuffDesc(currentBuff)">
                    <div class="buff-section-title">效果描述</div>
                    <div class="buff-description">{{ getBuffDesc(currentBuff).description }}</div>
                </div>
                
                <div class="buff-section" v-if="currentBuff.effects && currentBuff.effects.length > 0">
                    <div class="buff-section-title">属性效果</div>
                    <div class="buff-effects-list">
                        <div v-for="(effect, index) in currentBuff.effects" :key="index" class="effect-item">
                            <span class="effect-property">{{ getPropertyDisplayName(effect.propertyName) }}</span>
                            <span class="effect-type">{{ getEffectTypeText(effect.effectType) }}</span>
                            <span class="effect-value" v-if="effect.effectType === 2">+{{ (effect.value * 100).toFixed(0) }}%</span>
                            <span class="effect-value" v-else>{{ effect.value > 0 ? '+' : '' }}{{ effect.value }}</span>
                        </div>
                    </div>
                </div>
                
                <div class="buff-info-grid">
                    <div class="buff-info-item" v-if="currentBuff.countDown !== undefined">
                        <span class="info-label">剩余回合</span>
                        <span class="info-value">{{ currentBuff.countDown }}回合</span>
                    </div>
                    <div class="buff-info-item" v-if="currentBuff.maxCount !== undefined">
                        <span class="info-label">最大层数</span>
                        <span class="info-value">{{ currentBuff.maxCount }}层</span>
                    </div>
                    <div class="buff-info-item" v-if="currentBuff.shield !== undefined">
                        <span class="info-label">护盾值</span>
                        <span class="info-value">{{ currentBuff.shield }}</span>
                    </div>
                    <div class="buff-info-item" v-if="currentBuff.probability !== undefined">
                        <span class="info-label">触发概率</span>
                        <span class="info-value">{{ (currentBuff.probability * 100).toFixed(0) }}%</span>
                    </div>
                    <div class="buff-info-item" v-if="getBuffDesc(currentBuff) && getBuffDesc(currentBuff).duration">
                        <span class="info-label">持续时间</span>
                        <span class="info-value">{{ getBuffDesc(currentBuff).duration }}</span>
                    </div>
                    <div class="buff-info-item" v-if="currentBuff.control !== undefined">
                        <span class="info-label">控制类型</span>
                        <span class="info-value">{{ currentBuff.control }}</span>
                    </div>
                </div>
                
                <div class="buff-params" v-if="currentBuff.params && currentBuff.params.length > 0">
                    <div class="buff-section-title">特殊属性</div>
                    <div class="params-list">
                        <a-tag v-if="currentBuff.params.includes(1)" color="orange">不可驱散</a-tag>
                        <a-tag v-if="currentBuff.params.includes(2)" color="red">不可移除</a-tag>
                        <a-tag v-if="currentBuff.params.includes(9)" color="purple">控制效果</a-tag>
                        <a-tag v-if="currentBuff.params.includes(10)" color="cyan">护盾</a-tag>
                        <a-tag v-if="currentBuff.params.includes(11)" color="green">标记</a-tag>
                    </div>
                </div>
            </div>
        </a-modal>
        
        <a-modal
            v-model="skillModalVisible"
            :footer="null"
            width="750px"
            class="card-detail-modal"
            :bodyStyle="{ padding: 0 }"
        >
            <div v-if="currentHero" class="card-detail">
                <div class="card-header">
                    <div class="card-avatar-section">
                        <img :src="getAvatarPath(currentHero.no)" class="card-avatar" />
                    </div>
                    <div class="card-info-section">
                        <div class="card-title-row">
                            <span class="card-name">{{ currentHero.name }}</span>
                            <a-tag :color="getRankColor(currentHero.rank)" class="rank-tag">{{ currentHero.rank }}</a-tag>
                        </div>
                        <div class="card-meta">
                            <div class="meta-item" v-if="currentHero.grade">
                                <span class="meta-label">年级</span>
                                <span class="meta-value">{{ currentHero.grade }}</span>
                            </div>
                            <div class="meta-item" v-if="currentHero.school">
                                <span class="meta-label">学校</span>
                                <span class="meta-value">{{ currentHero.school }}</span>
                            </div>
                            <div class="meta-item" v-if="currentHero.position">
                                <span class="meta-label">位置</span>
                                <span class="meta-value">{{ currentHero.position }}</span>
                            </div>
                        </div>
                        <div class="card-labels" v-if="currentHero.labels && currentHero.labels.length > 0">
                            <a-tag v-for="(label, idx) in currentHero.labels" :key="idx" class="label-tag">{{ label }}</a-tag>
                        </div>
                        <div class="card-attrs">
                            <div class="attr-row">
                                <span class="attr-label">生命</span>
                                <span class="attr-value">{{ currentHero.hp }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">攻击</span>
                                <span class="attr-value">{{ currentHero.atk }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">防御</span>
                                <span class="attr-value">{{ currentHero.def }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">速度</span>
                                <span class="attr-value">{{ currentHero.spd }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">暴击</span>
                                <span class="attr-value">{{ currentHero.cri }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">暴伤</span>
                                <span class="attr-value">{{ currentHero.cri_dmg }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">命中</span>
                                <span class="attr-value">{{ currentHero.eft_hit }}</span>
                            </div>
                            <div class="attr-row">
                                <span class="attr-label">抵抗</span>
                                <span class="attr-value">{{ currentHero.eft_res }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="card-type" v-if="currentHero.type">
                        <span class="type-label">{{ currentHero.type }}</span>
                    </div>
                </div>
                
                <div class="card-skills">
                    <div class="skills-title">技能列表</div>
                    <div class="skill-list">
                        <div v-for="(skill, index) in currentHeroSkills" :key="index" class="skill-card">
                            <div class="skill-header">
                                <span class="skill-no">技能 {{ skill.no }}</span>
                                <span class="skill-name">{{ skill.name }}</span>
                                <span class="skill-cost" v-if="!skill.passive && typeof skill.cost !== 'function'">
                                    <span v-for="n in skill.cost" :key="n" class="fire-icon">🔥</span>
                                    <span v-if="skill.cost === 0" class="fire-icon zero">0</span>
                                </span>
                                <a-tag v-if="skill.passive" color="purple" size="small">被动</a-tag>
                                <a-tag v-if="skill.hide" color="red" size="small">隐藏</a-tag>
                            </div>
                            <div class="skill-body">
                                <div class="skill-desc" v-if="skill.text">{{ skill.text }}</div>
                                <div class="skill-desc no-desc" v-else-if="!skill.passive">该技能暂无详细描述</div>
                            </div>
                        </div>
                        <div v-if="currentHeroSkills.length === 0" class="no-skill">
                            该选手暂无已实现的技能
                        </div>
                    </div>
                </div>
            </div>
        </a-modal>
    </div>
</template>
<style lang="scss">
    .debug {
        display: flex;
        justify-content: center;
        flex-direction: column;
        padding: 20px;
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        overflow-x: hidden;
    }
    
    .debug > * {
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
    }
    
    .container {
        width: 100%;
        margin: 0 auto;
        box-sizing: border-box;
    }
    
    /* 媒体查询 */
    @media screen and (max-width: 1200px) {
        .hero-field {
            grid-template-columns: repeat(4, 1fr) !important;
        }
    }
    
    @media screen and (max-width: 992px) {
        .hero-field {
            grid-template-columns: repeat(3, 1fr) !important;
        }
    }
    
    @media screen and (max-width: 768px) {
        .debug {
            padding: 10px;
        }
        
        .hero-field {
            grid-template-columns: repeat(2, 1fr) !important;
        }
        
        .select-skill-field {
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .runway-field {
            height: 30px;
        }
    }
    
    @media screen and (max-width: 480px) {
        .hero-field {
            grid-template-columns: 1fr !important;
        }
        
        .mana {
            font-size: 12px;
        }
        
        .battle-log-container {
            height: 200px;
        }
        
        .hero-card-wrap {
            padding: 8px;
        }
        
        .hero-info {
            flex-direction: column;
            align-items: center;
        }
        
        .hero-properties {
            padding: 8px 0 0 0;
            text-align: center;
        }
    }
    .info-bar {
        display: flex;
        flex-direction: column;
        margin-bottom: 10px;
        transition: all 0.3s ease;
        width: 100%;
        box-sizing: border-box;
        
        .info-item {
            font-size: 14px;
            color: #666;
            margin-bottom: 4px;
            cursor: default;
            
            &.seed-control {
                display: flex;
                align-items: center;
                gap: 8px;
                
                .seed-label {
                    font-weight: 500;
                    color: #333;
                }
                
                .seed-input {
                    width: 150px;
                }
                
                .seed-btn {
                    padding: 0 12px;
                    height: 24px;
                    font-size: 12px;
                }
            }
        }
        
        .hint-text {
            color: #1890ff;
            font-family: Consolas, Monaco, monospace;
        }
    }
    .float-panel {
        position: fixed;
        right: 20px;
        top: 70px;
        width: 320px;
        max-height: calc(100vh - 90px);
        background: linear-gradient(180deg, #ffffff 0%, #f8f9fa 100%);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 300;
        border-radius: 12px;
        padding: 16px;
        font-size: 14px;
        box-sizing: border-box;
        overflow-y: auto;
        
        .panel-header {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .panel-avatar {
            flex-shrink: 0;
            
            .square-avatar {
                width: 64px;
                height: 64px;
                object-fit: cover;
                border-radius: 8px;
                border: 2px solid #e8e8e8;
                transition: all 0.3s ease;
                
                &:hover {
                    border-color: #1890ff;
                    box-shadow: 0 2px 8px rgba(24, 144, 255, 0.2);
                }
            }
        }
        
        .panel-title {
            flex: 1;
            min-width: 0;
        }
        
        .panel-name {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
        }
        
        .panel-hp {
            .hp-text {
                font-size: 12px;
                color: #666;
                display: block;
                margin-bottom: 4px;
            }
        }
        
        .panel-section {
            margin-top: 16px;
        }
        
        .section-title {
            font-size: 14px;
            font-weight: 600;
            color: #1890ff;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 2px solid #1890ff;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
        }
        
        .stat-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #f5f5f5;
            border-radius: 6px;
        }
        
        .stat-label {
            color: #666;
            font-size: 13px;
        }
        
        .stat-value {
            color: #333;
            font-weight: 500;
            font-size: 13px;
        }
        
        .soul-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .soul-item {
            padding: 8px 12px;
            background: #f0f5ff;
            border-radius: 6px;
            border-left: 3px solid #1890ff;
        }
        
        .soul-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }
        
        .soul-name {
            color: #1890ff;
            font-weight: 500;
        }
        
        .soul-stats {
            color: #333;
            font-size: 12px;
        }
        
        .soul-description {
            color: #666;
            font-size: 11px;
            line-height: 1.4;
            margin-top: 4px;
            padding-top: 4px;
            border-top: 1px dashed #e0e0e0;
        }
        
        .buff-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        
        .buff-card {
            padding: 10px 12px;
            background: #fafafa;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            border: 1px solid #e8e8e8;
            
            &:hover {
                background: #e6f7ff;
                border-color: #1890ff;
            }
        }
        
        .buff-header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
        }
        
        .buff-name {
            font-weight: 500;
            color: #333;
        }
        
        .buff-details {
            display: flex;
            gap: 12px;
            font-size: 12px;
            color: #666;
        }
        
        .buff-duration {
            color: #1890ff;
        }
        
        .buff-count {
            color: #52c41a;
        }
    }
    .runway-field {
        width: 100%;
        height: 25px;
        border-radius: 15px;

        position: relative;
        background-color: #00accab4;
        margin-top: 15px;
        box-sizing: border-box;
        .runway-item {
            position: absolute;
            top: 50%;
            transform:translate(-50%, -50%);
            transition: all 0.5s;
            background-color: #fefdff;
            cursor: pointer;
            &:hover {
                transform: translate(-50%, -50%) scale(1.1);
                z-index: 40;
            }
            &:active {
                transform: translate(-50%, -50%) scale(0.95);
            }
            &.team0 {
                border: rgb(220, 53, 69) 2px solid !important;
                box-shadow: 0 0 0 1px rgb(220, 53, 69);
            }
            &.team1 {
                border: rgb(0, 123, 255) 2px solid !important;
                box-shadow: 0 0 0 1px rgb(0, 123, 255);
            }
            &.frozen{
                filter: brightness(30%)
            }
            &.current {
                z-index: 30;
            }
            &.dead {
                opacity: 0;
                pointer-events: none;
            }
        }
    }

    .select-skill-field {
        display: flex;
        flex-direction: row;
        margin-top: 10px;
        width: 100%;
        box-sizing: border-box;
        flex-wrap: wrap;
    }

    .team-field {
        display: flex;
        flex-direction: column;
        margin-top: 10px;
        width: 100%;
        box-sizing: border-box;
        .mana {
            color: #1543a6;
            font-family: Courier;
        }
        
        .mana-bar {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            border-radius: 8px;
            margin-bottom: 8px;
            gap: 12px;
            
            &.team0 {
                background: linear-gradient(90deg, rgba(220, 53, 69, 0.15) 0%, rgba(220, 53, 69, 0.05) 100%);
                border: 1px solid rgba(220, 53, 69, 0.3);
            }
            
            &.team1 {
                background: linear-gradient(90deg, rgba(0, 123, 255, 0.15) 0%, rgba(0, 123, 255, 0.05) 100%);
                border: 1px solid rgba(0, 123, 255, 0.3);
            }
            
            .mana-label {
                font-size: 13px;
                font-weight: 600;
                color: #333;
                white-space: nowrap;
            }
            
            .mana-orbs {
                display: flex;
                gap: 4px;
                flex: 1;
            }
            
            .mana-orb {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #e8e8e8;
                border: 2px solid #d9d9d9;
                transition: all 0.3s ease;
                position: relative;
                
                &.filled {
                    background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
                    border-color: #ff8c00;
                    box-shadow: 0 0 8px rgba(255, 170, 0, 0.5);
                    
                    &.team0 {
                        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
                        border-color: #dc3545;
                        box-shadow: 0 0 8px rgba(220, 53, 69, 0.5);
                    }
                    
                    &.team1 {
                        background: linear-gradient(135deg, #4dabf7 0%, #339af0 100%);
                        border-color: #007bff;
                        box-shadow: 0 0 8px rgba(0, 123, 255, 0.5);
                    }
                }
                
                &.progressing {
                    animation: pulse 1s ease-in-out infinite;
                }
            }
            
            .mana-progress {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 4px 8px;
                background: rgba(255, 193, 7, 0.2);
                border-radius: 4px;
                font-size: 12px;
                
                .progress-label {
                    color: #666;
                }
                
                .progress-value {
                    font-weight: 600;
                    color: #f5a623;
                }
            }
        }
        
        @keyframes pulse {
            0%, 100% {
                transform: scale(1);
                opacity: 1;
            }
            50% {
                transform: scale(1.1);
                opacity: 0.8;
            }
        }
        .global-buffs {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            gap: 4px;
            
            .buff-item {
                cursor: pointer;
                transition: transform 0.15s ease;
                position: relative;
                
                &:hover {
                    transform: scale(1.1);
                }
                
                &:active {
                    transform: scale(0.95);
                }
                
                .buff-countdown {
                    position: absolute;
                    top: -6px;
                    right: -6px;
                    min-width: 16px;
                    height: 16px;
                    padding: 0 4px;
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
                    color: #fff;
                    font-size: 11px;
                    font-weight: bold;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                    z-index: 1;
                    font-family: 'Arial', sans-serif;
                }
            }
        }
        .hero-field {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 15px;
            width: 100%;
            box-sizing: border-box;
            
            .hero-card-wrap {
                width: 100%;
                background-color: #fefdff;
                margin-top: 5px;
                padding: 12px;
                border-radius: 4px;
                position: relative;
                box-sizing: border-box;
                overflow: hidden;

                &.team0 {
                    border-left: 4px solid rgb(220, 53, 69);
                    background: linear-gradient(90deg, rgba(220, 53, 69, 0.1) 0%, #fefdff 100%);
                }

                &.team1 {
                    border-left: 4px solid rgb(0, 123, 255);
                    background: linear-gradient(90deg, rgba(0, 123, 255, 0.1) 0%, #fefdff 100%);
                }

                &.current-turn {
                    box-shadow: rgba(0, 0, 0, .3) 1px 1px 3px;
                    background-color: burlywood;
                }

                &.unselectable {
                    opacity: 0.3;
                }
                &.dead {
                    opacity: 0.3;
                }
                &.selectable {
                    cursor: pointer;
                }

                .hero-info {
                    display: flex;
                    flex-direction: row;
                    align-items: flex-start;

                    .hero-info-left {
                        flex-shrink: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        
                        .position-label {
                            font-size: 11px;
                            color: #666;
                            margin-bottom: 4px;
                            background-color: #f0f0f0;
                            padding: 2px 6px;
                            border-radius: 3px;
                        }
                        
                        .hero-avatar {
                            cursor: pointer;
                            transition: all 0.3s ease;
                            &:hover {
                                transform: scale(1.1);
                                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                            }
                            &:active {
                                transform: scale(0.95);
                            }
                            &.active {
                                border: 2px #2565d6 solid;
                            }
                            &.team0 {
                                border: 2px rgb(220, 53, 69) solid;
                            }
                            &.team1 {
                                border: 2px rgb(0, 123, 255) solid;
                            }
                        }
                    }

                    .hero-properties {
                        flex: 1;
                        min-width: 0;
                        padding: 0 0 0 8px;
                        overflow: hidden;

                        .bold {
                            font-weight: bold;
                            font-size: 13px;
                            white-space: nowrap;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        }
                        
                        .hp-bar {
                            width: 100%;
                            margin-top: 4px;
                        }
                    }
                }

                .hero-buffs {
                    margin-top: 10px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 4px;
                    
                    .buff-item {
                        cursor: pointer;
                        transition: transform 0.15s ease;
                        position: relative;
                        
                        &:hover {
                            transform: scale(1.1);
                        }
                        
                        &:active {
                            transform: scale(0.95);
                        }
                        
                        .buff-countdown {
                            position: absolute;
                            top: -6px;
                            right: -6px;
                            min-width: 16px;
                            height: 16px;
                            padding: 0 4px;
                            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
                            color: #fff;
                            font-size: 11px;
                            font-weight: bold;
                            border-radius: 8px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                            z-index: 1;
                            font-family: 'Arial', sans-serif;
                        }
                    }
                }
            }
        }
    }

    .buff-detail-modal {
        .buff-detail-content {
            padding: 4px 0;
        }
        
        .buff-header {
            margin-bottom: 8px;
        }
        
        .buff-title-row {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .buff-name {
            font-size: 18px;
            font-weight: bold;
            color: #1890ff;
        }
        
        .buff-source {
            margin-top: 6px;
            font-size: 12px;
            color: #888;
        }
        
        .buff-section {
            margin-bottom: 16px;
        }
        
        .buff-section-title {
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
            padding-bottom: 4px;
            border-bottom: 2px solid #1890ff;
            font-size: 14px;
        }
        
        .buff-description {
            color: #555;
            line-height: 1.6;
            padding: 8px 12px;
            background: #f6f6f6;
            border-radius: 4px;
            border-left: 3px solid #1890ff;
        }
        
        .buff-effects-list {
            background: #fafafa;
            border-radius: 4px;
            padding: 8px 12px;
        }
        
        .effect-item {
            display: flex;
            align-items: center;
            padding: 6px 0;
            border-bottom: 1px dashed #e8e8e8;
            
            &:last-child {
                border-bottom: none;
            }
        }
        
        .effect-property {
            color: #1890ff;
            font-weight: 500;
            width: 80px;
        }
        
        .effect-type {
            color: #666;
            flex: 1;
        }
        
        .effect-value {
            color: #52c41a;
            font-weight: bold;
        }
        
        .buff-info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 16px;
        }
        
        .buff-info-item {
            display: flex;
            flex-direction: column;
            padding: 8px 12px;
            background: #fafafa;
            border-radius: 4px;
        }
        
        .info-label {
            font-size: 12px;
            color: #888;
            margin-bottom: 4px;
        }
        
        .info-value {
            font-size: 14px;
            font-weight: 500;
            color: #333;
        }
        
        .buff-params {
            margin-top: 16px;
        }
        
        .params-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
    }
    
    .card-detail-modal .card-detail {
        background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%);
    }
    
    .card-header {
        display: flex;
        padding: 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        gap: 24px;
        position: relative;
    }
    
    .card-avatar-section {
        flex-shrink: 0;
        display: flex;
        align-items: stretch;
    }
    
    .card-avatar {
        width: 180px;
        height: 100%;
        min-height: 200px;
        object-fit: cover;
        border-radius: 12px;
        border: 3px solid rgba(255, 255, 255, 0.8);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    
    .card-info-section {
        flex: 1;
        color: white;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        gap: 16px;
    }
    
    .card-title-row {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .card-name {
        font-size: 26px;
        font-weight: bold;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    
    .rank-tag {
        font-size: 12px;
        font-weight: 600;
        padding: 2px 10px;
        border-radius: 4px;
    }
    
    .card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
    }
    
    .meta-item {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    
    .meta-label {
        font-size: 12px;
        opacity: 0.8;
    }
    
    .meta-value {
        font-size: 14px;
        font-weight: 500;
    }
    
    .card-labels {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    
    .label-tag {
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        border-radius: 4px;
        padding: 2px 8px;
        font-size: 12px;
    }
    
    .card-attrs {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-top: auto;
    }
    
    .attr-row {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.15);
        padding: 8px 12px;
        border-radius: 6px;
    }
    
    .attr-label {
        font-size: 12px;
        opacity: 0.9;
        min-width: 32px;
    }
    
    .attr-value {
        font-size: 14px;
        font-weight: 600;
    }
    
    .card-type {
        position: absolute;
        top: 16px;
        right: 16px;
        background: rgba(255, 255, 255, 0.95);
        border-radius: 6px;
        padding: 6px 14px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    
    .type-label {
        font-size: 13px;
        font-weight: 600;
        color: #667eea;
    }
    
    .card-skills {
        padding: 20px;
    }
    
    .skills-title {
        font-size: 16px;
        font-weight: 600;
        color: #333;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 2px solid #667eea;
    }
    
    .skill-list {
        max-height: 50vh;
        overflow-y: auto;
    }
    
    .skill-card {
        background: #ffffff;
        border-radius: 8px;
        margin-bottom: 12px;
        overflow: hidden;
        border: 1px solid #e8e8e8;
        transition: all 0.3s ease;
    }
    
    .skill-card:hover {
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
        border-color: #667eea;
    }
    
    .skill-header {
        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid #e8e8e8;
    }
    
    .skill-no {
        font-size: 11px;
        color: #999;
        background: #f0f0f0;
        padding: 2px 8px;
        border-radius: 4px;
    }
    
    .skill-name {
        font-size: 15px;
        font-weight: 600;
        color: #333;
        flex: 1;
    }
    
    .skill-cost {
        display: flex;
        align-items: center;
        gap: 2px;
    }
    
    .fire-icon {
        font-size: 14px;
    }
    
    .fire-icon.zero {
        font-size: 12px;
        color: #999;
        font-weight: normal;
    }
    
    .skill-body {
        padding: 12px 16px;
    }
    
    .skill-desc {
        font-size: 13px;
        color: #555;
        line-height: 1.6;
        white-space: pre-wrap;
    }
    
    .skill-desc.no-desc {
        color: #999;
        font-style: italic;
    }
    
    .no-skill {
        text-align: center;
        color: #999;
        padding: 40px 0;
        font-size: 14px;
    }

    .battle-log-container {
        width: 100%;
        margin-top: 20px;
        background-color: #1a1a2e;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        height: 300px;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        box-sizing: border-box;

        .battle-log-header {
            background-color: #16213e;
            color: #e94560;
            padding: 10px 15px;
            font-size: 16px;
            font-weight: bold;
            border-bottom: 1px solid #0f3460;
            flex-shrink: 0;
            position: sticky;
            top: 0;
            z-index: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .stats-btn {
            color: #1890ff;
            padding: 0 8px;
            font-size: 13px;
        }
        
        .stats-btn:hover {
            color: #40a9ff;
        }

        .battle-log-content {
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 10px 15px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 14px;
            line-height: 1.8;
            color: #eaeaea;
            scroll-behavior: smooth;
            overscroll-behavior: contain;

            &::-webkit-scrollbar {
                width: 10px;
            }

            &::-webkit-scrollbar-track {
                background: #1a1a2e;
                border-radius: 5px;
            }

            &::-webkit-scrollbar-thumb {
                background: #0f3460;
                border-radius: 5px;
                border: 2px solid #1a1a2e;
            }

            &::-webkit-scrollbar-thumb:hover {
                background: #e94560;
            }

            &::-webkit-scrollbar-corner {
                background: #1a1a2e;
            }

            .log-item {
                padding: 5px 0;
                border-bottom: 1px solid #0f3460;
                display: flex;
                align-items: flex-start;

                &:last-child {
                    border-bottom: none;
                }

                .log-time {
                    color: #888;
                    margin-right: 10px;
                    font-size: 12px;
                    min-width: 60px;
                    flex-shrink: 0;
                }

                .log-message {
                    flex: 1;
                    word-break: break-word;
                    white-space: pre-wrap;
                }

                &.damage {
                    color: #ff6b6b;
                }

                &.heal {
                    color: #51cf66;
                }

                &.skill {
                    color: #74c0fc;
                }

                &.buff {
                    color: #ffd43b;
                }

                &.death {
                    color: #ff8787;
                    font-weight: bold;
                }

                &.turn {
                    color: #a78bfa;
                }
            }
        }
    }

    /* 响应式设计 - 竖屏模式优化 */
    @media screen and (max-width: 768px), screen and (orientation: portrait) {
        .debug {
            padding: 8px;
            min-height: 100vh;
        }

        .info-bar {
            padding: 6px 10px;
            font-size: 12px;
            flex-wrap: wrap;
        }

        .select-skill-field {
            padding: 8px;
            gap: 8px;
            
            .ant-input-number {
                width: 40px !important;
            }
            
            .ant-btn {
                width: auto !important;
                padding: 4px 12px;
                font-size: 12px;
                margin-left: 0 !important;
            }
        }

        .runway-field {
            height: 40px;
            margin-top: 10px;
            border-radius: 8px;
            
            .runway-item {
                width: 28px !important;
                height: 28px !important;
            }
        }

        .team-field {
            margin-top: 8px;
            
            .mana {
                font-size: 12px;
                padding: 4px 0;
            }
            
            .hero-field {
                grid-template-columns: repeat(5, 1fr);
                gap: 6px;
                
                .hero-card-wrap {
                    padding: 6px;
                    margin-top: 3px;
                    
                    .hero-info {
                        flex-direction: column;
                        align-items: center;
                        
                        .hero-info-left {
                            .position-label {
                                font-size: 9px;
                                padding: 1px 4px;
                                margin-bottom: 2px;
                            }
                            
                            .hero-avatar {
                                width: 32px !important;
                                height: 32px !important;
                            }
                        }
                        
                        .hero-properties {
                            padding: 4px 0 0 0;
                            
                            .bold {
                                font-size: 10px;
                                text-align: center;
                            }
                            
                            .hp-bar {
                                margin-top: 2px;
                            }
                        }
                    }
                    
                    .hero-buffs {
                        margin-top: 4px;
                        justify-content: center;
                        
                        .ant-tag {
                            font-size: 9px;
                            padding: 0 4px;
                            margin: 1px;
                        }
                    }
                }
            }
        }

        .battle-log-container {
            height: 200px;
            margin-top: 12px;
            border-radius: 6px;
            flex-shrink: 0;
            
            .battle-log-header {
                padding: 8px 12px;
                font-size: 14px;
            }
            
            .stats-btn {
                font-size: 12px;
            }
            
            .battle-log-content {
                padding: 8px 10px;
                font-size: 11px;
                line-height: 1.6;
                
                .log-item {
                    padding: 3px 0;
                    
                    .log-time {
                        font-size: 10px;
                        min-width: 50px;
                    }
                }
            }
        }
    }

    /* 超小屏幕优化 */
    @media screen and (max-width: 480px) {
        .debug {
            padding: 4px;
        }

        .info-bar {
            display: none;
        }

        .select-skill-field {
            padding: 6px;
            gap: 6px;
            
            .ant-btn {
                padding: 4px 8px;
                font-size: 11px;
            }
        }

        .runway-field {
            height: 35px;
            
            .runway-item {
                width: 24px !important;
                height: 24px !important;
            }
        }

        .team-field {
            .hero-field {
                gap: 4px;
                
                .hero-card-wrap {
                    padding: 4px;
                    
                    .hero-info {
                        .hero-info-left {
                            .position-label {
                                font-size: 8px;
                            }
                            
                            .hero-avatar {
                                width: 28px !important;
                                height: 28px !important;
                            }
                        }
                        
                        .hero-properties {
                            .bold {
                                font-size: 9px;
                            }
                        }
                    }
                }
            }
        }

        .battle-log-container {
            height: 150px;
            margin-top: 8px;
            
            .battle-log-header {
                padding: 6px 10px;
                font-size: 12px;
            }
            
            .battle-log-content {
                padding: 6px 8px;
                font-size: 10px;
                line-height: 1.5;
            }
        }
    }

    /* 横屏模式下的特殊处理 */
    @media screen and (orientation: landscape) and (max-height: 500px) {
        .debug {
            padding: 4px;
        }

        .info-bar {
            display: none;
        }

        .runway-field {
            height: 30px;
            margin-top: 5px;
            
            .runway-item {
                width: 24px !important;
                height: 24px !important;
            }
        }

        .team-field {
            margin-top: 5px;
            
            .hero-field {
                gap: 4px;
                
                .hero-card-wrap {
                    padding: 4px;
                    
                    .hero-info {
                        flex-direction: row;
                        
                        .hero-info-left {
                            flex-direction: row;
                            gap: 4px;
                            
                            .position-label {
                                margin-bottom: 0;
                            }
                            
                            .hero-avatar {
                                width: 28px !important;
                                height: 28px !important;
                            }
                        }
                        
                        .hero-properties {
                            padding-left: 6px;
                            
                            .bold {
                                font-size: 11px;
                            }
                        }
                    }
                }
            }
        }

        .battle-log-container {
            height: 120px;
            margin-top: 8px;
        }
    }

</style>
<script>
    // import Phaser from 'phaser';
    // import BattleScene from "@/visual/battle-scene"
    import {message} from 'ant-design-vue'
    import {Battle, BattleProperties, Buff, EffectTypes, Reasons, SoulData, HeroBuilders, HeroData} from '../../core'
    import {times, map} from 'lodash'
    import BattleStats from '@/components/BattleStats.vue'
    import {getAvatarPathByNo} from '../utils/avatar-utils'
    import {getBuffDescription, BuffDatabase} from '../../core/buff-descriptions'
    
    const heroEntities = new Map();
    HeroBuilders.forEach(build => {
        const hero = build();
        heroEntities.set(hero.no, hero);
    });

    function buildMaxExpBuff(sourceId, targetId) {
        return Buff.build(sourceId, targetId)
            .name('满经验', 1)
            .noDispel()
            .noRemove()
            .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.15)
            .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.15)
            .end();
    }

    function buildBestPositionBuff(sourceId, targetId) {
        return Buff.build(sourceId, targetId)
            .name('最佳位置', 1)
            .noDispel()
            .noRemove()
            .buffAP(BattleProperties.ATK, EffectTypes.ADD_RATE, 0.1)
            .buffAP(BattleProperties.DEF, EffectTypes.ADD_RATE, 0.1)
            .end();
    }

    function empty() {
        return {
            seed: 0,
            hint: '',
            event: '',
            currentId: 0,
            runway: [],
            mana: [
                {
                    num: 0,
                    progress: 0
                },
                {
                    num: 0,
                    progress: 0,
                }
            ],
            globalBuffs: [[], []],
            teams: [
                map(Array.from({length: 5}), () => ({
                    entityId: Math.floor(Math.random() * 10000) + 10000,
                    hp: 0,
                    maxHp: 0,
                    dead: true,
                    no: 99,
                    buffs: [],
                    name: '',
                })),
                map(Array.from({length: 5}), () => ({
                    entityId: Math.floor(Math.random() * 10000) + 10000,
                    hp: 0,
                    maxHp: 0,
                    dead: true,
                    no: 99,
                    buffs: [],
                    name: '',
                }))
            ],
            attack: {},
            skills: [],
            watiInput: false,
            selection: null,
        };
    }

    function dump(battle) {
        const dump = empty();
        const types = [];
        for (let t = battle.currentTask; t; t = t.parent) {
            types.push(`${t.type}【${t.step}】`);
            if (t.type === 'Turn') {
                const data = t.data;
                dump.currentId = data.currentId;
            }
            if (t.type === 'WaitInput') {
                dump.skills = t.data.skills;
            }
            if (t.type === 'EventProcess') {
                dump.event = '处理' + battle.getEntity(t.data.skillOwnerId).name + t.data.handler.name;
            }
        }
        battle.runway.distanceTable.forEach((distance, entityId) => {
            const entity = battle.getEntity(entityId);
            dump.runway.push({
                entityId,
                distance,
                frozen: battle.runway.frozenTable.get(entityId) || false,
                name: entity.name,
                no: entity.no,
                teamId: entity.teamId,
                dead: entity.dead || false,
            });
        });
        dump.runway.sort((a, b) => a.distance - b.distance);
        for (let teamId = 0; teamId < 2; teamId++) {
            dump.mana[teamId].num = battle.getMana(teamId).num;
            dump.mana[teamId].progress = battle.getMana(teamId).progress;

            for (let pos = 0; pos < 5; pos++) {
                const field = battle.fields[teamId];
                const id = field[pos];
                if (id) {
                    const entity = battle.getEntity(id);
                    const buffsTemp = battle.buffs
                        .filter(b => b.ownerId === entity.entityId)
                        .map(b => ({
                            name: b.name, 
                            icon: b.icon || '', 
                            countDown: b.countDown,
                            effects: b.effects,
                            params: b.params,
                            shield: b.shield,
                            probability: b.probability,
                            control: b.control,
                            maxCount: b.maxCount
                        }));
                    const buffs = [];
                    buffs.length = 0;

                    for (const b of buffsTemp) {
                        const bb = buffs.find(bbb => bbb.name === b.name);
                        if (bb) {
                            bb.count++;
                        } else {
                            buffs.push({
                                name: b.name,
                                icon: b.icon,
                                buffId: b.buffId,
                                count: 1,
                                countDown: b.countDown,
                                effects: b.effects,
                                params: b.params,
                                shield: b.shield,
                                probability: b.probability,
                                control: b.control,
                                maxCount: b.maxCount
                            })
                        }
                    }

                    dump.teams[teamId][pos] = {
                        entityId: entity.entityId,
                        hp: entity.hp,
                        maxHp: battle.getComputedProperty(entity.entityId, BattleProperties.MAX_HP),
                        dead: entity.dead,
                        no: entity.no,
                        name: entity.name,
                        buffs,
                    }
                }
            }
        }
        [-1, -2].forEach(id => {
            const buffsTemp = battle.buffs
                .filter(b => b.ownerId ===id)
                .map(b => ({
                    name: b.name, 
                    icon: b.icon || '', 
                    countDown: b.countDown,
                    effects: b.effects,
                    params: b.params,
                    shield: b.shield,
                    probability: b.probability,
                    control: b.control,
                    maxCount: b.maxCount
                }));
            const buffs = [];
            buffs.length = 0;

            for (const b of buffsTemp) {
                const bb = buffs.find(bbb => bbb.name === b.name);
                if (bb) {
                    bb.count++;
                } else {
                    buffs.push({
                        name: b.name,
                        icon: b.icon,
                        buffId: b.buffId,
                        count: 1,
                        countDown: b.countDown,
                        effects: b.effects,
                        params: b.params,
                        shield: b.shield,
                        probability: b.probability,
                        control: b.control,
                        maxCount: b.maxCount
                    })
                }
            }
            dump.globalBuffs[id + 2] = buffs;
        });
        dump.hint = 'Next:  ' + types.reverse().join(' > ');
        dump.seed = battle.seed;
        return dump;
    }

    export default {
        components: {
            BattleStats
        },
        data() {
            return {
                seed: Math.random(),
                data: empty(),
                selectionNo: 0,
                selectedSkill: {},
                depth: 0,
                panelType: '',
                panelId: 0,
                panelData: {},
                panelEntity: null,
                panelSouls: [],
                panelBuffs: [],
                panelRawData: { hp: 0, maxHp: 0 },
                battleLogs: [],
                lastLogCount: 0,
                autoMode: true,
                hideDebugInfo: false,
                positionLabels: ['先锋', '次锋', '中坚', '副将', '大将'],
                showBattleStats: false,
                showBuffModal: false,
                currentBuff: null,
                inputSeedStr: '',
                skillModalVisible: false,
                currentHero: null,
                currentHeroSkills: [],
            }
        },
        mounted() {
            this.$root.$on('toggle-debug-info', (hidden) => {
                this.hideDebugInfo = hidden;
            });
            // eslint-disable-next-line
            // 只使用先锋到大将这5人（索引1-5）
            const team0Fighters = this.$store.state.team0.slice(1, 6);
            const team1Fighters = this.$store.state.team1.slice(1, 6);
            const maxedStatus = this.$store.state.maxedStatus;
            const soulSelections = this.$store.state.soulSelections;
            
            // 为红队的选手添加御魂信息
            // team0Fighters 已经是 slice(1, 6)，所以索引从0开始，对应 soulSelections 的索引1-5
            const team0WithSoul = team0Fighters.map((d, index) => {
                return Object.assign({}, d, {waitInput: true, soulIds: soulSelections[0][index + 1] || []});
            });
            
            // 为蓝队的选手添加御魂信息
            const team1WithSoul = team1Fighters.map((d, index) => {
                return Object.assign({}, d, {waitInput: true, soulIds: soulSelections[1][index + 1] || []});
            });
            
            const data = team0WithSoul.concat(team1WithSoul);
            const initialSeed = Math.floor(this.seed * 1000000000);
            window.battle = this.battle = new Battle(data, initialSeed, true);
            this.inputSeedStr = String(initialSeed);
            
            // 为选中"满"的角色添加满经验Buff
            // 遍历两个队伍的field，找到每个实体对应的原始位置索引
            for (let teamId = 0; teamId < 2; teamId++) {
                const field = this.battle.fields[teamId];
                for (let posIndex = 0; posIndex < field.length; posIndex++) {
                    const entityId = field[posIndex];
                    if (entityId) {
                        // posIndex是战斗中的位置(0-4)，对应队伍设置中的索引是posIndex+1(1-5)
                        const originalIndex = posIndex + 1;
                        if (maxedStatus && maxedStatus[teamId] && maxedStatus[teamId][originalIndex]) {
                            const buff = buildMaxExpBuff(entityId, entityId);
                            this.battle.actionAddBuff(buff, Reasons.SKILL);
                        }
                    }
                }
            }
            
            this.data = dump(this.battle);
        },
        beforeDestroy() {
            this.$root.$off('toggle-debug-info');
        },
        computed: {
            team0() {
                return this.data.teams[0];
            },
            team1() {
                return this.data.teams[1];
            },
            team0Name() {
                return this.$store.state.team0Name || '红队';
            },
            team1Name() {
                return this.$store.state.team1Name || '蓝队';
            },
        },
        methods: {
            resetBattle() {
                this.selectionNo = 0;
                this.selectedSkill = {};
                this.depth = 0;
                this.panelType = '';
                this.panelId = 0;
                this.panelData = {};
                this.panelEntity = null;
                this.panelSouls = [];
                this.panelBuffs = [];
                this.panelRawData = { hp: 0, maxHp: 0 };
                this.battleLogs = [];
                this.lastLogCount = 0;
                this.autoMode = true;
                this.showBattleStats = false;
                this.showBuffModal = false;
                this.currentBuff = null;
                this.skillModalVisible = false;
                this.currentHero = null;
                this.currentHeroSkills = [];
                
                const team0Fighters = this.$store.state.team0.slice(1, 6);
                const team1Fighters = this.$store.state.team1.slice(1, 6);
                const maxedStatus = this.$store.state.maxedStatus;
                const soulSelections = this.$store.state.soulSelections;
                
                const team0WithSoul = team0Fighters.map((d, index) => {
                    return Object.assign({}, d, {waitInput: true, soulIds: soulSelections[0][index + 1] || []});
                });
                
                const team1WithSoul = team1Fighters.map((d, index) => {
                    return Object.assign({}, d, {waitInput: true, soulIds: soulSelections[1][index + 1] || []});
                });
                
                const data = team0WithSoul.concat(team1WithSoul);
                const currentSeed = parseInt(this.inputSeedStr, 10) || Math.floor(this.seed * 1000000000);
                window.battle = this.battle = new Battle(data, currentSeed, true);
                this.inputSeedStr = String(currentSeed);
                
                for (let teamId = 0; teamId < 2; teamId++) {
                    const field = this.battle.fields[teamId];
                    for (let posIndex = 0; posIndex < field.length; posIndex++) {
                        const entityId = field[posIndex];
                        if (entityId) {
                            const originalIndex = posIndex + 1;
                            if (maxedStatus && maxedStatus[teamId] && maxedStatus[teamId][originalIndex]) {
                                const buff = buildMaxExpBuff(entityId, entityId);
                                this.battle.actionAddBuff(buff, Reasons.SKILL);
                            }
                        }
                    }
                }
                
                this.data = dump(this.battle);
                message.success('已重置战斗（保留当前种子）');
            },
            
            runToEnd() {
                if (!this.battle || this.battle.isEnd) return;
                
                const maxIterations = 100000;
                let iterations = 0;
                
                while (!this.battle.isEnd && iterations < maxIterations) {
                    if (!this.battle.process()) break;
                    iterations++;
                    
                    if (this.battle.currentTask.type === 'WaitInput') {
                        this.useSkill(0, 0);
                    }
                }
                
                this.data = dump(this.battle);
                this.updatePanel();
                this.updateBattleLogs();
                
                if (this.battle.isEnd) {
                    message.info('胜利者是' + (this.battle.winner === 0 ? '红队' : '蓝队'));
                    this.showBattleStats = true;
                }
            },
            
            applySeed() {
                const seedValue = parseInt(this.inputSeedStr, 10);
                if (isNaN(seedValue) || seedValue < 1) {
                    message.warning('请输入有效的Seed值');
                    return;
                }
                
                // 重新创建战斗实例
                const team0Fighters = this.$store.state.team0.slice(1, 6);
                const team1Fighters = this.$store.state.team1.slice(1, 6);
                const maxedStatus = this.$store.state.maxedStatus;
                const soulSelections = this.$store.state.soulSelections;
                
                const team0WithSoul = team0Fighters.map((d, index) => {
                    return Object.assign({}, d, {waitInput: true, soulIds: soulSelections[0][index + 1] || []});
                });
                
                const team1WithSoul = team1Fighters.map((d, index) => {
                    return Object.assign({}, d, {waitInput: true, soulIds: soulSelections[1][index + 1] || []});
                });
                
                const data = team0WithSoul.concat(team1WithSoul);
                window.battle = this.battle = new Battle(data, seedValue, true);
                
                // 为选中"满"的角色添加满经验Buff
                for (let teamId = 0; teamId < 2; teamId++) {
                    const field = this.battle.fields[teamId];
                    for (let posIndex = 0; posIndex < field.length; posIndex++) {
                        const entityId = field[posIndex];
                        if (entityId) {
                            const originalIndex = posIndex + 1;
                            if (maxedStatus && maxedStatus[teamId] && maxedStatus[teamId][originalIndex]) {
                                const buff = buildMaxExpBuff(entityId, entityId);
                                this.battle.actionAddBuff(buff, Reasons.SKILL);
                            }
                        }
                    }
                }
                
                this.data = dump(this.battle);
                this.battleLogs = [];
                this.lastLogCount = 0;
                this.showBattleStats = false;
                
                message.success(`已应用Seed: ${seedValue}`);
            },
            getAvatarPath(no) {
                return getAvatarPathByNo(no);
            },
            getRankColor(rank) {
                const colorMap = {
                    'SSR': 'gold',
                    'SR': 'purple',
                    'R': 'blue',
                    'N': 'default',
                    'D': 'green',
                    'C': 'cyan',
                };
                return colorMap[rank] || 'default';
            },
            showSkillModal(heroNo) {
                const hero = heroEntities.get(heroNo);
                if (!hero) return;

                const heroData = HeroData.find(d => d.id === heroNo);
                
                this.currentHero = {
                    no: hero.no,
                    name: hero.name,
                    rank: hero.rank || 'N',
                    hp: Math.round(hero.getProperty(BattleProperties.MAX_HP)),
                    atk: Math.round(hero.getProperty(BattleProperties.ATK)),
                    def: Math.round(hero.getProperty(BattleProperties.DEF)),
                    spd: Math.round(hero.getProperty(BattleProperties.SPD)),
                    cri: Math.round(hero.getProperty(BattleProperties.CRI) * 100) + '%',
                    cri_dmg: Math.round(hero.getProperty(BattleProperties.CRI_DMG) * 100) + '%',
                    eft_hit: Math.round(hero.getProperty(BattleProperties.EFT_HIT) * 100) + '%',
                    eft_res: Math.round(hero.getProperty(BattleProperties.EFT_RES) * 100) + '%',
                    grade: heroData ? heroData.grade : null,
                    school: heroData ? heroData.school : null,
                    position: heroData ? heroData.position : null,
                    labels: heroData && heroData.labels ? heroData.labels : [],
                    type: heroData ? heroData.type : null,
                };
                this.currentHeroSkills = hero.skills.map(skill => {
                    return {
                        no: skill.no,
                        name: skill.name,
                        cost: skill.cost,
                        passive: skill.passive,
                        hide: skill.hide,
                        text: skill.text,
                    };
                });
                this.skillModalVisible = true;
            },
            navigateToHeroList(heroNo) {
                this.showSkillModal(heroNo);
            },
            showBuffDetail(buff) {
                this.currentBuff = buff;
                this.showBuffModal = true;
            },
            getBuffDesc(buff) {
                if (!buff || !buff.name) return null;
                return getBuffDescription(buff.name);
            },
            getBuffTypeText(buff) {
                const desc = this.getBuffDesc(buff);
                if (desc) return desc.type;
                
                if (!buff || !buff.params) return '特殊';
                if (buff.params.includes(4)) return '增益';
                if (buff.params.includes(5)) return '减益';
                if (buff.params.includes(9)) return '控制';
                return '特殊';
            },
            getBuffTypeColor(buff) {
                const type = this.getBuffTypeText(buff);
                const colors = {
                    '增益': 'green',
                    '减益': 'red',
                    '控制': 'purple',
                    '特殊': 'blue'
                };
                return colors[type] || 'default';
            },
            getBuffEffectText(buff) {
                if (!buff || !buff.effects || buff.effects.length === 0) {
                    return '无效果';
                }
                return buff.effects.map(effect => {
                    const propName = this.getPropertyDisplayName(effect.propertyName);
                    const effectType = this.getEffectTypeText(effect.effectType);
                    const value = effect.effectType === 2 ? `+${(effect.value * 100).toFixed(0)}%` : effect.value;
                    return `${propName} ${effectType} ${value}`;
                }).join('\n');
            },
            getPropertyDisplayName(propertyName) {
                const propertyNames = {
                    'max_hp': '最大生命',
                    'atk': '攻击',
                    'def': '防御',
                    'spd': '速度',
                    'cri': '暴击率',
                    'cri_dmg': '暴击伤害',
                    'eft_hit': '效果命中',
                    'eft_res': '效果抵抗',
                };
                return propertyNames[propertyName] || propertyName;
            },
            getEffectTypeText(effectType) {
                const effectTypes = {
                    0: '固定增加',
                    1: '设置为',
                    2: '百分比增加',
                    3: '取最大值',
                    4: '取最小值',
                };
                return effectTypes[effectType] || '修改';
            },
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            step() {
                const maxIterations = 10000; // 防止无限循环的安全限制
                let iterations = 0;
                do {
                    if (!this.battle.process()) break; // 如果process返回false，退出循环
                    iterations++;
                    if (iterations > maxIterations) {
                        console.error('step() exceeded maximum iterations, possible infinite loop');
                        break;
                    }
                } while (this.battle.currentTask.depth > this.depth && this.battle.currentTask.type !== 'WaitInput');
                this.data = dump(this.battle);
                this.updatePanel();
                this.updateBattleLogs();
                if (this.battle.isEnd) {
                    message.info('胜利者是' + (this.battle.winner === 0 ? '红队' : '蓝队'))
                    // 显示战斗数据统计页面
                    this.showBattleStats = true;
                } else if (this.autoMode && this.battle.currentTask.type === 'WaitInput') {
                    // Auto模式开启且遇到WaitInput时，自动执行AI
                    this.$nextTick(() => {
                        this.useSkill(0, 0);
                    });
                }
            },
            
            toggleAutoMode() {
                this.autoMode = !this.autoMode;
                // 如果开启Auto模式且当前在WaitInput状态，立即执行AI
                if (this.autoMode && this.battle.currentTask.type === 'WaitInput') {
                    this.$nextTick(() => {
                        this.useSkill(0, 0);
                    });
                }
            },
            selectSkill(no) {
                const skill = this.data.skills.find(s => s.no === no);
                if (!skill) return;

                this.selectedSkill = skill;
                this.selectionNo = no;
            },

            useSkill(no, targetId) {
                if (this.battle.currentTask.type !== 'WaitInput') return;
                this.selectionNo = 0;
                
                // AI按钮处理：no为0或null时，使用AI自动选择技能
                if (!no) {
                    // 获取当前回合数据和可用技能
                    const currentEntity = this.battle.getEntity(this.data.currentId);
                    const mana = this.battle.getMana(currentEntity.teamId);
                    const skills = this.data.skills;
                    
                    // 调用实体的AI方法获取技能选择
                    const selection = currentEntity.ai(this.battle, this.battle.currentTask.parent.data, mana, skills);
                    
                    if (selection && selection.no && selection.targetId) {
                        this.battle.currentTask.data.selection = selection;
                    } else {
                        // AI无法做出选择，使用默认普通攻击
                        const defaultSkill = skills.find(s => s.no === 1 && s.targets.length);
                        if (defaultSkill) {
                            this.battle.currentTask.data.selection = {
                                no: defaultSkill.no,
                                targetId: this.battle.getRandomOne(defaultSkill.targets)
                            };
                        }
                    }
                } else {
                    this.battle.currentTask.data.selection = {no, targetId};
                }
                
                this.battle.process();
                this.battle.process();
                this.data = dump(this.battle);
                this.updatePanel();
                this.updateBattleLogs();
                
                // Auto模式下，继续自动推进
                if (this.autoMode && !this.battle.isEnd && this.battle.currentTask.type === 'WaitInput') {
                    this.$nextTick(() => {
                        this.useSkill(0, 0);
                    });
                }

            },

            selectHero(e) {
                if (!e) return;
                if (this.selectionNo && this.selectedSkill && this.selectedSkill.targets.includes(e.entityId)) {
                    this.useSkill(this.selectionNo, e.entityId)
                } else if(!this.selectionNo) {
                    if (!this.battle.getEntity(e.entityId)) return;
                    this.panelId = e.entityId;
                    this.panelType = 'entity';
                    this.panelEntity = e;
                    this.updatePanel();
                }

            },
            closePanel() {
                this.panelType = '';
                this.panelId = 0;
                this.panelEntity = null;
                this.panelSouls = [];
                this.panelBuffs = [];
            },
            updatePanel() {
                const battle = this.battle;
                if (this.panelType === 'entity') {
                    const entity = battle.getEntity(this.panelId);
                    if (entity) {

                        const originMaxHp = entity.getProperty(BattleProperties.MAX_HP);
                        const maxHp =  battle.getComputedProperty(entity.entityId, BattleProperties.MAX_HP);
                        const originAtk = entity.getProperty(BattleProperties.ATK);
                        const atk =  battle.getComputedProperty(entity.entityId, BattleProperties.ATK);
                        const originDef = entity.getProperty(BattleProperties.DEF);
                        const def =  battle.getComputedProperty(entity.entityId, BattleProperties.DEF);
                        const originSpd = entity.getProperty(BattleProperties.SPD);
                        const spd =  battle.getComputedProperty(entity.entityId, BattleProperties.SPD);
                        const originCri = entity.getProperty(BattleProperties.CRI);
                        const cri =  battle.getComputedProperty(entity.entityId, BattleProperties.CRI);
                        const originCriDmg = entity.getProperty(BattleProperties.CRI_DMG);
                        const criDmg =  battle.getComputedProperty(entity.entityId, BattleProperties.CRI_DMG);
                        const originEftHit = entity.getProperty(BattleProperties.EFT_HIT);
                        const eftHit =  battle.getComputedProperty(entity.entityId, BattleProperties.EFT_HIT);
                        const originEftRes = entity.getProperty(BattleProperties.EFT_RES);
                        const eftRes =  battle.getComputedProperty(entity.entityId, BattleProperties.EFT_RES);
                        
                        // 存储原始数值用于计算
                        this.panelRawData = {
                            hp: Math.round(entity.hp),
                            maxHp: Math.round(maxHp),
                        };
                        
                        this.panelData = {
                            '攻击':  Math.round(atk) + (originAtk !== atk ? ` (${Math.round(originAtk)})` : ''),
                            '防御':  Math.round(def) + (originDef !== def ? ` (${Math.round(originDef)})` : ''),
                            '速度':  Math.round(spd) + (originSpd !== spd ? ` (${Math.round(originSpd)})` : ''),
                            '暴击':  Math.round(cri * 100) + '%' +  (originCri !== cri ? ` (${Math.round(originCri * 100)}%)` : '') ,
                            '暴击伤害':  Math.round(criDmg * 100) + '%' + (originCriDmg !== criDmg ? ` (${Math.round(originCriDmg * 100)}%)` : ''),
                            '效果命中':  Math.round(eftHit * 100) + '%' + (originEftHit !== eftHit ? ` (${Math.round(originEftHit * 100)}%)` : ''),
                            '效果抵抗':  Math.round(eftRes * 100) + '%' + (originEftRes !== eftRes ? ` (${Math.round(originEftRes * 100)}%)` : ''),
                        };
                        
                        // 获取御魂信息 - 从SoulData中获取
                        this.panelSouls = [];
                        const teamId = entity.teamId;
                        const posIndex = this.battle.fields[teamId].indexOf(entity.entityId);
                        if (posIndex !== -1) {
                            const soulSelections = this.$store.state.soulSelections;
                            const soulIds = soulSelections && soulSelections[teamId] && soulSelections[teamId][posIndex + 1];
                            if (soulIds && soulIds.length > 0) {
                                this.panelSouls = soulIds.map((soulId, idx) => {
                                    const soulData = SoulData.find(s => s.id === soulId);
                                    return {
                                        name: soulData ? soulData.name : '御魂',
                                        position: idx + 1,
                                        mainStat: soulData && soulData.mainStat ? `${soulData.mainStat.type}: ${soulData.mainStat.value}` : '',
                                        description: soulData ? soulData.description : ''
                                    };
                                });
                            }
                        }
                        
                        // 获取buff信息
                        this.panelBuffs = [];
                        const entityData = this.data.teams[entity.teamId] && this.data.teams[entity.teamId].find(en => en.entityId === entity.entityId);
                        if (entityData && entityData.buffs) {
                            this.panelBuffs = entityData.buffs;
                        }
                    }
                }

            },

            updateBattleLogs() {
                if (this.battle && this.battle.eventLogs) {
                    const newLogs = this.battle.eventLogs.slice(this.lastLogCount);
                    this.battleLogs = this.battleLogs.concat(newLogs);
                    this.lastLogCount = this.battle.eventLogs.length;
                    this.$nextTick(() => {
                        this.scrollToBottom();
                    });
                }
            },

            scrollToBottom() {
                const container = this.$refs.logContent;
                if (container) {
                    container.scrollTop = container.scrollHeight;
                }
            },

            manaNum2Text(mana) {
                if (!mana) return '';

                return times(mana.num,() => '■').concat(times(8 - mana.num,() => '□')).join(' ')
            }


        }

    }
</script>

