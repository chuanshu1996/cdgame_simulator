<template>
    <a-modal
        :visible="visible"
        :title="title"
        :width="'96vw'"
        :style="{ top: '24px' }"
        :bodyStyle="bodyStyle"
        :footer="null"
        :maskClosable="false"
        wrapClassName="hero-edit-modal-wrap"
        destroyOnClose
        @cancel="handleClose"
    >
        <div class="hero-edit">
            <div class="toolbar">
                <a-input
                    v-model="keyword"
                    class="keyword-input"
                    placeholder="搜索选手名称或编号"
                    allowClear
                >
                    <a-icon slot="prefix" type="search" />
                </a-input>
                <a-select v-model="rankFilter" class="rank-select" size="default">
                    <a-select-option value="ALL">全部稀有度</a-select-option>
                    <a-select-option v-for="r in rankList" :key="r" :value="r">{{ r }}</a-select-option>
                </a-select>
                <a-checkbox v-model="showAll">显示全部选手</a-checkbox>
                <span class="count-tip">共 {{ filteredRows.length }} 名</span>
            </div>

            <a-table
                :columns="columns"
                :data-source="filteredRows"
                :pagination="paginationConfig"
                :rowClassName="rowClassName"
                size="small"
                row-key="id"
                :scroll="{ y: 460 }"
                @change="handleTableChange"
            >
                <span slot="rank" slot-scope="text">
                    <a-tag :color="rankColor(text)">{{ text || 'N' }}</a-tag>
                </span>
                <span slot="exp" slot-scope="text, record">
                    <a-input-number
                        :value="record.exp"
                        :min="0"
                        :max="MAX_EXP"
                        size="small"
                        class="num-input"
                        @change="(val) => handleExpChange(record, val)"
                    />
                </span>
                <span slot="stamina" slot-scope="text, record">
                    <a-input-number
                        :value="record.stamina"
                        :min="0"
                        :max="MAX_STAMINA"
                        size="small"
                        class="num-input"
                        @change="(val) => handleStaminaChange(record, val)"
                    />
                </span>
                <div slot="emptyText" class="empty-tip">
                    <a-empty description="没有匹配的选手，可勾选「显示全部选手」或调整筛选条件" />
                </div>
            </a-table>

            <div class="footer-bar">
                <span class="footer-tip">修改即时生效，返回战绩页后需点击「保存」（或同步到云端）才会落库</span>
                <a-button type="primary" @click.native="handleClose">关闭</a-button>
            </div>
        </div>
    </a-modal>
</template>

<script>
import Vue from 'vue';
import { HeroData } from '../../core';
import { MAX_EXP, MAX_STAMINA, RANK_VALUES } from '../config/league';

const RANK_COLORS = {
    SSR: 'gold',
    SS: 'volcano',
    'S+': 'orange',
    S: 'purple',
    EX: 'magenta',
    SR: 'purple',
    R: 'blue',
    A: 'cyan',
    B: 'green',
    UC: 'geekblue',
    C: 'cyan',
    D: 'green',
    N: 'default',
};

function clampNumber(value, min, max) {
    const num = Number(value);
    if (Number.isNaN(num)) return min;
    return Math.min(max, Math.max(min, Math.round(num)));
}

export default {
    name: 'TeamHeroEditModal',
    props: {
        visible: {
            type: Boolean,
            default: false,
        },
        team: {
            type: Object,
            default: null,
        },
    },
    data() {
        return {
            MAX_EXP,
            MAX_STAMINA,
            keyword: '',
            rankFilter: 'ALL',
            showAll: false,
            pagination: { current: 1, pageSize: 20 },
            lastEditedId: '',
            rankList: Object.keys(RANK_VALUES).sort((a, b) => RANK_VALUES[a] - RANK_VALUES[b]),
            heroList: [],
        };
    },
    computed: {
        title() {
            return `编辑选手 - ${this.team ? this.team.name : ''}`;
        },
        bodyStyle() {
            return { padding: '16px 20px 12px', background: '#fff' };
        },
        drawnSet() {
            return new Set((this.team && this.team.drawnHeroIds) || []);
        },
        rows() {
            const exps = (this.team && this.team.heroExps) || {};
            const staminas = (this.team && this.team.heroStaminas) || {};
            return this.heroList.map(h => ({
                id: h.id,
                name: h.name,
                rank: h.rank || 'N',
                exp: Number(exps[h.id]) || 0,
                stamina: staminas[h.id] === undefined ? MAX_STAMINA : Number(staminas[h.id]) || 0,
            }));
        },
        filteredRows() {
            const keyword = this.keyword.trim().toLowerCase();
            return this.rows.filter(row => {
                if (this.rankFilter !== 'ALL' && row.rank !== this.rankFilter) return false;
                if (keyword) {
                    const hitName = row.name.toLowerCase().indexOf(keyword) !== -1;
                    const hitId = String(row.id).indexOf(keyword) !== -1;
                    if (!hitName && !hitId) return false;
                }
                if (this.showAll) return true;
                // 默认只显示「有数据」的选手：经验>0 / 公开邀请 / 体力不满（被手动调整过）
                return row.exp > 0 || row.stamina !== MAX_STAMINA || this.drawnSet.has(row.id);
            });
        },
        columns() {
            return [
                { title: '编号', dataIndex: 'id', width: 90, align: 'center' },
                { title: '选手', dataIndex: 'name', width: 200 },
                { title: '稀有度', dataIndex: 'rank', width: 100, align: 'center', scopedSlots: { customRender: 'rank' } },
                { title: `经验 (0-${MAX_EXP})`, dataIndex: 'exp', width: 140, align: 'center', scopedSlots: { customRender: 'exp' } },
                { title: `体力 (0-${MAX_STAMINA})`, dataIndex: 'stamina', width: 140, align: 'center', scopedSlots: { customRender: 'stamina' } },
            ];
        },
        paginationConfig() {
            return {
                current: this.pagination.current,
                pageSize: this.pagination.pageSize,
                total: this.filteredRows.length,
                showSizeChanger: true,
                pageSizeOptions: ['20', '50', '100'],
                size: 'small',
                showTotal: total => `共 ${total} 名选手`,
            };
        },
    },
    watch: {
        visible(val) {
            if (val) {
                this.keyword = '';
                this.rankFilter = 'ALL';
                this.showAll = false;
                this.pagination = { current: 1, pageSize: 20 };
                this.lastEditedId = '';
                this.loadHeroList();
            }
        },
    },
    created() {
        this.loadHeroList();
    },
    methods: {
        loadHeroList() {
            this.heroList = HeroData.filter(h => h.show === 1 || h.show === undefined).map(h => ({
                id: String(h.index),
                name: h.name,
                rank: h.rank || 'N',
            }));
        },
        rankColor(rank) {
            return RANK_COLORS[rank] || 'default';
        },
        rowClassName(record) {
            return record.id === this.lastEditedId ? 'row-edited' : '';
        },
        handleTableChange(pagination) {
            this.pagination = { current: pagination.current, pageSize: pagination.pageSize };
        },
        ensureMaps() {
            if (!this.team) return null;
            if (!this.team.heroExps) Vue.set(this.team, 'heroExps', {});
            if (!this.team.heroStaminas) Vue.set(this.team, 'heroStaminas', {});
            return this.team;
        },
        handleExpChange(record, value) {
            const team = this.ensureMaps();
            if (!team) return;
            Vue.set(team.heroExps, record.id, clampNumber(value, 0, MAX_EXP));
            this.lastEditedId = record.id;
            this.$emit('change');
        },
        handleStaminaChange(record, value) {
            const team = this.ensureMaps();
            if (!team) return;
            Vue.set(team.heroStaminas, record.id, clampNumber(value, 0, MAX_STAMINA));
            this.lastEditedId = record.id;
            this.$emit('change');
        },
        handleClose() {
            this.$emit('update:visible', false);
        },
    },
};
</script>

<style lang="scss" scoped>
.hero-edit {
    .toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        padding-bottom: 12px;
        border-bottom: 1px solid #f0f0f0;
        margin-bottom: 12px;

        .keyword-input {
            width: 260px;
        }

        .rank-select {
            width: 160px;
        }

        .count-tip {
            margin-left: auto;
            color: #8c8c8c;
            font-size: 13px;
        }
    }

    .num-input {
        width: 92px;
    }

    .empty-tip {
        padding: 24px 0;
    }

    .footer-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #f0f0f0;

        .footer-tip {
            color: #8c8c8c;
            font-size: 13px;
        }
    }

    ::v-deep .ant-table-thead > tr > th {
        background: #fafafa;
        font-weight: 600;
    }

    ::v-deep .row-edited {
        background: #e6f7ff;
        transition: background 0.6s ease;
    }
}
</style>
