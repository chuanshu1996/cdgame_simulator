<template xmlns:v-slot="http://www.w3.org/1999/XSL/Transform">
    <div class="debug">
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
            <button @click="panelType = ''" style="margin-top:  10px">关闭</button>
        </div>
        <div class="info-bar" v-show="!hideDebugInfo">
            <span class="info-item">Seed: {{data.seed}}</span>
            <span class="info-item hint-text">{{data.hint}}</span>
        </div>
        <div class="mode-info">
            <a-tag color="blue">1v1模式</a-tag>
            <a-tag color="green">无限鬼火</a-tag>
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
            <a-avatar  v-for="item in data.runway" :key="item.entityId"   class="runway-item" :class="{team0: item.teamId === 0, team1: item.teamId === 1, frozen: item.frozen, current: item.entityId === data.currentId}" :src="getAvatarPath(item.no)"  :style="{ left:  Math.floor((item.distance / 100)) + '%' }" @click="navigateToHeroList(item.no)"/>
        </div>
        <div class="team-field" v-for="teamId in 2" :key="teamId">
            <div class="mana">{{manaNum2Text(data.mana[teamId -1])}} {{data.mana[teamId -1].progress}} <span class="infinite-mana">(无限)</span></div>
            <div style="display: flex;flex-direction: row">
                <div v-for="buff in data.globalBuffs[teamId-1]" :key="buff.buffId">
                    <img v-if="buff.icon" :src="'/public/buff/'+icon"/>
                    <a-tag v-else>{{buff.name}} {{buff.count > 1 ? buff.count : ''}}</a-tag>
                </div>
            </div>
            <div class="hero-field hero-field-1v1">
                <div v-for="(e, idx) in data.teams[teamId - 1]" :key="e.entityId">
                    <div class="hero-card-wrap"
                         :class="{dead: e.dead,
                     unselectable: selectionNo && selectedSkill && !selectedSkill.targets.includes(e.entityId),
                      selectable: selectionNo && selectedSkill && selectedSkill.targets.includes(e.entityId),
                      'current-turn': data.currentId === e.entityId
                       }"
                         @click.stop="selectHero(e)"
                    >
                        <div class="hero-info">
                            <div class="hero-info-left">
                                <div class="position-label">{{ positionLabels[idx] }}</div>
                                <a-avatar class="hero-avatar active" :src="getAvatarPath(e.no)" size="large" @click.stop="navigateToHeroList(e.no)"/>
                            </div>
                            <div class="hero-properties">
                                <div  v-if="!e.dead" class="bold">{{e.name}}【{{Math.round(e.hp)}}/{{Number(e.maxHp.toFixed(2))}}】</div>
                                <div v-if="!e.dead" class="hp-bar">
                                    <a-progress size="small" :percent="Math.ceil(e.hp / e.maxHp * 100)"
                                                :showInfo="false"
                                                status="exception"/>
                                </div>
                            </div>
                        </div>
                        <div class="hero-buffs">
                            <div v-for="buff in e.buffs" :key="buff.buffId">
                                <img v-if="buff.icon" :src="'/public/buff/'+icon"/>
                                <a-tag v-else>{{buff.name}} {{buff.count > 1 ? buff.count : ''}}</a-tag>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="battle-log-container" ref="logContainer">
            <div class="battle-log-header">战斗日志</div>
            <div class="battle-log-content" ref="logContent">
                <div v-for="(log, index) in battleLogs" :key="index" class="log-item" :class="log.type">
                    <span class="log-time">{{log.time}}</span>
                    <span class="log-message">{{log.message}}</span>
                </div>
            </div>
        </div>
        
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
    }
    .mode-info {
        margin-bottom: 10px;
        display: flex;
        gap: 10px;
    }
    .info-bar {
        display: flex;
        flex-direction: column;
        margin-bottom: 10px;
        transition: all 0.3s ease;
        
        .info-item {
            font-size: 14px;
            color: #666;
            cursor: default;
            margin-bottom: 4px;
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
    .runway-field {
        width: calc(100vw - 40px);
        height: 25px;
        border-radius: 15px;

        position: relative;
        background-color: #00accab4;
        margin-top: 15px;
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
            &.team0{
                border:rgb(250, 162, 0) 2px solid;

            }
            &.team1{
                border:rgb(158, 5, 0) 2px solid;
            }
            &.frozen{
                filter: brightness(30%)
            }
            &.current {
                z-index: 30;
            }
        }
    }

    .select-skill-field {
        display: flex;
        flex-direction: row;
        margin-top: 10px;
    }

    .team-field {
        display: flex;
        flex-direction: column;
        margin-top: 10px;
        .mana {
            color: #1543a6;
            font-family: Courier;
            .infinite-mana {
                color: #52c41a;
                font-weight: bold;
            }
        }
        .hero-field {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 15px;
            width: 100%;
            
            &.hero-field-1v1 {
                grid-template-columns: repeat(1, 1fr);
                max-width: 300px;
            }
            
            .hero-card-wrap {
                width: 100%;
                background-color: #fefdff;
                margin-top: 5px;
                padding: 12px;
                border-radius: 4px;
                position: relative;
                box-sizing: border-box;
                overflow: hidden;

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
                }
            }
        }
    }

    .battle-log-container {
        width: calc(100vw - 40px);
        margin-top: 20px;
        background-color: #1a1a2e;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        height: 300px;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;

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

</style>
<script>
    import {message} from 'ant-design-vue'
    import {Battle, BattleProperties, HeroBuilders, HeroData} from '../../core'
    import {times, map} from 'lodash'
    import {getAvatarPathByNo} from '../utils/avatar-utils'
    
    const heroEntities = new Map();
    HeroBuilders.forEach(build => {
        const hero = build();
        heroEntities.set(hero.no, hero);
    });

    function empty() {
        return {
            seed: 0,
            hint: '',
            event: '',
            currentId: 0,
            runway: [],
            mana: [
                {
                    num: 8,
                    progress: 0
                },
                {
                    num: 8,
                    progress: 0,
                }
            ],
            globalBuffs: [[], []],
            teams: [
                map(Array.from({length: 1}), () => ({
                    entityId: Math.floor(Math.random() * 10000) + 10000,
                    hp: 0,
                    maxHp: 0,
                    dead: true,
                    no: 99,
                    buffs: [],
                    name: '',
                })),
                map(Array.from({length: 1}), () => ({
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
            });
        });
        dump.runway.sort((a, b) => a.distance - b.distance);
        for (let teamId = 0; teamId < 2; teamId++) {
            dump.mana[teamId].num = 8;
            dump.mana[teamId].progress = battle.getMana(teamId).progress;

            for (let pos = 0; pos < 1; pos++) {
                const field = battle.fields[teamId];
                const id = field[pos];
                if (id) {
                    const entity = battle.getEntity(id);
                    const buffsTemp = battle.buffs
                        .filter(b => b.ownerId === entity.entityId)
                        .map(b => ({name: b.name, icon: b.icon || ''}));
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
                .map(b => ({name: b.name, icon: b.icon || ''}));
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
                positionLabels: ['大将'],
                skillModalVisible: false,
                currentHero: null,
                currentHeroSkills: [],
            }
        },
        mounted() {
            this.$root.$on('toggle-debug-info', (hidden) => {
                this.hideDebugInfo = hidden;
            });
            // 1v1模式使用大将（索引5）
            const soulSelections = this.$store.state.soulSelections;
            const team0Data = this.$store.state.team0.slice(5, 6).map(d => Object.assign({}, d, {waitInput: true, soulIds: soulSelections[0][5] || []}));
            const team1Data = this.$store.state.team1.slice(5, 6).map(d => Object.assign({}, d, {waitInput: true, soulIds: soulSelections[1][5] || []}));
            const data = team0Data.concat(team1Data);
            window.battle = this.battle = new Battle(data, Date.now(), true);
            this.battle.infiniteMana = true;
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
                this.skillModalVisible = false;
                this.currentHero = null;
                this.currentHeroSkills = [];
                
                const soulSelections = this.$store.state.soulSelections;
                const team0Data = this.$store.state.team0.slice(5, 6).map(d => Object.assign({}, d, {waitInput: true, soulIds: soulSelections[0][5] || []}));
                const team1Data = this.$store.state.team1.slice(5, 6).map(d => Object.assign({}, d, {waitInput: true, soulIds: soulSelections[1][5] || []}));
                const data = team0Data.concat(team1Data);
                const currentSeed = this.battle ? this.battle.seed : Date.now();
                window.battle = this.battle = new Battle(data, currentSeed, true);
                this.battle.infiniteMana = true;
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
                }
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
            showBuffDetail(buff) {
                // 这里可以添加显示Buff详细信息的逻辑
            },
            getBuffTypeColor(buff) {
                return 'blue'; // 默认颜色
            },
            getBuffTypeText(buff) {
                return '特殊'; // 默认类型
            },
            navigateToHeroList(heroNo) {
                this.showSkillModal(heroNo);
            },
            step() {
                this.refillMana();
                do {
                    this.battle.process();
                } while (this.battle.currentTask.depth > this.depth && this.battle.currentTask.type !== 'WaitInput');
                this.data = dump(this.battle);
                this.updatePanel();
                this.updateBattleLogs();
                if (this.battle.isEnd) {
                    message.info('胜利者是' + (this.battle.winner === 0 ? '红队' : '蓝队'))
                } else if (this.autoMode && this.battle.currentTask.type === 'WaitInput') {
                    this.$nextTick(() => {
                        this.useSkill(0, 0);
                    });
                }
            },
            
            refillMana() {
                if (this.battle.manas && this.battle.manas.length >= 2) {
                    this.battle.manas[0].num = 8;
                    this.battle.manas[1].num = 8;
                }
            },
            
            toggleAutoMode() {
                this.autoMode = !this.autoMode;
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
                this.refillMana();
                
                if (!no) {
                    const currentEntity = this.battle.getEntity(this.data.currentId);
                    const mana = this.battle.getMana(currentEntity.teamId);
                    const skills = this.data.skills;
                    
                    const selection = currentEntity.ai(this.battle, this.battle.currentTask.parent.data, mana, skills);
                    
                    if (selection && selection.no && selection.targetId) {
                        this.battle.currentTask.data.selection = selection;
                    } else {
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
                this.refillMana();
                this.data = dump(this.battle);
                this.updatePanel();
                this.updateBattleLogs();
                
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
                    this.updatePanel();
                }

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

                return times(8,() => '■').concat(times(0,() => '□')).join(' ')
            }


        }

    }
</script>
