<template>
    <div class="hero-data-container" @keydown="onKeyDown" tabindex="0" ref="container">
        <a-card title="卡牌属性管理" :bordered="false">
            <!-- 未登录：明确提示，避免只呈现空表格与灰按钮 -->
            <a-empty v-if="!isAdminLoggedIn" class="admin-empty">
                <template slot="description">
                    <p>需要管理员权限才能查看和编辑卡牌属性</p>
                    <p class="admin-empty-hint">请点击右上角「管理员登录」完成验证后重试</p>
                </template>
            </a-empty>

            <template v-else>
            <div class="toolbar">
                <a-input-search
                    v-model="searchText"
                    placeholder="搜索卡牌名称"
                    style="width: 200px"
                    @search="onSearch"
                />
                <a-select v-model="rankFilter" style="width: 120px" placeholder="筛选等级">
                    <a-select-option value="">全部</a-select-option>
                    <a-select-option v-for="r in rankOptions" :key="r" :value="r">{{ r }}</a-select-option>
                </a-select>
                <a-button type="primary" @click="saveAllChanges" :loading="saving" :disabled="!hasChanges">
                    <a-icon type="save" />保存所有修改
                </a-button>
                <a-button @click="resetChanges" :disabled="!hasChanges">
                    <a-icon type="undo" />重置修改
                </a-button>
                <a-button @click="$refs.fileInput.click()" :loading="importing">
                    <a-icon type="upload" />导入 Excel
                </a-button>
                <a-button @click="openExport" :disabled="heroData.length === 0">
                    <a-icon type="download" />导出 Excel
                </a-button>
                <input ref="fileInput" type="file" accept=".xlsx,.xls" style="display:none" @change="onFileChange" />
                <span class="selection-info" v-if="selectionInfo">
                    <a-tag color="blue">{{ selectionInfo }}</a-tag>
                </span>
                <span class="copy-hint">
                    <a-icon type="info-circle" /> 选中单元格后 Ctrl+C 复制 / Ctrl+V 粘贴
                </span>
            </div>

            <div class="table-wrapper" ref="tableWrapper">
                <table class="excel-table" ref="excelTable">
                    <thead>
                        <tr>
                            <th v-for="col in editableColumns" :key="col.key"
                                :class="{ 'col-selected': isColInSelection(col.key) }"
                                @mousedown.prevent="onHeaderMouseDown($event, col.key)">
                                {{ col.title }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(row, ri) in pagedData" :key="row.index"
                            :class="{ 'row-selected': isRowInSelection(ri) }"
                            @contextmenu.prevent.stop="onRowContextMenu($event, ri, row)">
                            <td v-for="col in editableColumns" :key="col.key"
                                :class="{
                                    'cell-selected': isCellSelected(ri, col.key),
                                    'cell-editing': editingCell && editingCell.ri === ri && editingCell.key === col.key,
                                }"
                                @mousedown="onCellMouseDown($event, ri, col.key)"
                                @mouseover="onCellMouseOver($event, ri, col.key)"
                                @dblclick="startEdit(ri, col.key)">
                                <!-- 编辑态 -->
                                <template v-if="editingCell && editingCell.ri === ri && editingCell.key === col.key">
                                    <!-- 下拉选择类型 -->
                                    <select v-if="col.type === 'select'"
                                        v-model="row[col.key]"
                                        ref="editInput"
                                        class="cell-select"
                                        @blur="finishEdit(row, col.key)"
                                        @keydown.enter.prevent="finishEdit(row, col.key)"
                                        @keydown.esc.prevent="cancelEdit">
                                        <option value=""></option>
                                        <option v-for="opt in col.options" :key="opt" :value="opt">{{ opt }}</option>
                                    </select>
                                    <!-- 开关类型 -->
                                    <select v-else-if="col.type === 'switch'"
                                        v-model="row[col.key]"
                                        ref="editInput"
                                        class="cell-select"
                                        @blur="finishEdit(row, col.key)"
                                        @keydown.enter.prevent="finishEdit(row, col.key)"
                                        @keydown.esc.prevent="cancelEdit">
                                        <option :value="1">是</option>
                                        <option :value="0">否</option>
                                    </select>
                                    <!-- 数字类型 -->
                                    <input v-else-if="col.type === 'number'"
                                        v-model.number="row[col.key]"
                                        ref="editInput"
                                        class="cell-input"
                                        type="number"
                                        :step="col.step || 1"
                                        :min="col.min"
                                        :max="col.max"
                                        @blur="finishEdit(row, col.key)"
                                        @keydown.enter.prevent="finishEdit(row, col.key)"
                                        @keydown.esc.prevent="cancelEdit" />
                                    <!-- 文本类型 -->
                                    <input v-else
                                        v-model="row[col.key]"
                                        ref="editInput"
                                        class="cell-input"
                                        @blur="finishEdit(row, col.key)"
                                        @keydown.enter.prevent="finishEdit(row, col.key)"
                                        @keydown.esc.prevent="cancelEdit" />
                                </template>
                                <!-- 显示态 -->
                                <template v-else>
                                    <span class="cell-text">{{ getCellDisplay(row, col) }}</span>
                                </template>
                            </td>
                        </tr>
                        <tr v-if="pagedData.length === 0">
                            <td :colspan="editableColumns.length" class="empty-row">
                                {{ loading ? '数据加载中...' : '暂无数据' }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 分页 -->
            <div class="pagination-wrapper">
                <a-pagination
                    v-model="currentPage"
                    :total="filteredData.length"
                    :page-size="pageSize"
                    show-size-changer
                    show-quick-jumper
                    :page-size-options="['20', '50', '100', '200']"
                    @showSizeChange="onPageSizeChange"
                    size="small"
                />
                <span class="page-info">共 {{ filteredData.length }} 条</span>
            </div>
            </template>
        </a-card>

        <!-- 粘贴确认弹窗 -->
        <a-modal
            v-model="pasteModalVisible"
            title="粘贴数据确认"
            width="600px"
            @ok="confirmPaste"
            @cancel="cancelPaste"
            okText="确认粘贴"
            cancelText="取消"
        >
            <div v-if="pastePreview">
                <a-alert v-if="pasteErrors.length > 0" type="warning" showIcon
                    :message="`发现 ${pasteErrors.length} 个数据问题`"
                    style="margin-bottom: 12px">
                    <template slot="description">
                        <ul class="error-list">
                            <li v-for="(err, i) in pasteErrors.slice(0, 10)" :key="i">{{ err }}</li>
                            <li v-if="pasteErrors.length > 10">...还有 {{ pasteErrors.length - 10 }} 个问题</li>
                        </ul>
                    </template>
                </a-alert>
                <p>将粘贴 {{ pastePreview.rowCount }} 行 x {{ pastePreview.colCount }} 列数据到以下位置：</p>
                <p><strong>起始行：</strong>{{ pastePreview.startRow + 1 }} &nbsp; <strong>起始列：</strong>{{ pastePreview.startColName }}</p>
                <a-radio-group v-model="pasteMode" v-if="pasteErrors.length > 0">
                    <a-radio value="skip">跳过错误数据，粘贴有效数据</a-radio>
                    <a-radio value="cancel">取消粘贴</a-radio>
                </a-radio-group>
            </div>
        </a-modal>

        <!-- Excel 导入进度 / 结果摘要 -->
        <a-modal
            v-model="importVisible"
            title="导入 Excel"
            width="560px"
            :footer="null"
            :maskClosable="false"
            :closable="!importing"
        >
            <div v-if="importing">
                <p>正在解析并写入数据，请稍候…</p>
                <a-progress :percent="importProgress" status="active" />
            </div>
            <div v-else-if="importSummary">
                <a-result
                    status="success"
                    title="导入完成"
                    :sub-title="`共处理 ${importSummary.total} 行数据`"
                >
                    <template slot="extra">
                        <a-descriptions bordered size="small" :column="2">
                            <a-descriptions-item label="新增行数">{{ importSummary.added }}</a-descriptions-item>
                            <a-descriptions-item label="更新行数（覆盖重复索引）">{{ importSummary.updated }}</a-descriptions-item>
                            <a-descriptions-item label="跳过空行">{{ importSummary.empty }}</a-descriptions-item>
                            <a-descriptions-item label="文件内重复跳过">{{ importSummary.duplicateSkip }}</a-descriptions-item>
                            <a-descriptions-item label="格式错误行">{{ importSummary.formatError }}</a-descriptions-item>
                            <a-descriptions-item label="成功写入">{{ importSummary.added + importSummary.updated }}</a-descriptions-item>
                        </a-descriptions>
                        <a-alert v-if="importSummary.errors.length > 0" type="warning" showIcon
                            style="margin-top: 12px"
                            :message="`${importSummary.errors.length} 处问题（已自动归一化或跳过）`">
                            <template slot="description">
                                <ul class="error-list">
                                    <li v-for="(err, i) in importSummary.errors.slice(0, 10)" :key="i">{{ err }}</li>
                                    <li v-if="importSummary.errors.length > 10">…还有 {{ importSummary.errors.length - 10 }} 处</li>
                                </ul>
                            </template>
                        </a-alert>
                        <div style="margin-top: 16px; text-align: right">
                            <a-button type="primary" @click="importVisible = false">知道了</a-button>
                        </div>
                    </template>
                </a-result>
            </div>
        </a-modal>

        <!-- Excel 导出配置 -->
        <a-modal
            v-model="exportVisible"
            title="导出 Excel"
            width="640px"
            :footer="null"
        >
            <template v-if="!exporting">
                <a-form layout="vertical">
                    <a-form-item label="导出文件名">
                        <a-input v-model="exportFileName" placeholder="carddata_export.xlsx" />
                    </a-form-item>
                    <a-form-item label="导出列（可多选，默认全选）">
                        <a-checkbox-group v-model="exportSelectedCols" :options="exportableColumns.map(c => ({ label: c.title, value: c.key }))" />
                    </a-form-item>
                    <a-form-item label="排序方式">
                        <a-select v-model="exportSortKey" style="width: 200px; margin-right: 12px">
                            <a-select-option v-for="c in exportableColumns" :key="c.key" :value="c.key">{{ c.title }}</a-select-option>
                        </a-select>
                        <a-radio-group v-model="exportSortDir">
                            <a-radio value="asc">升序</a-radio>
                            <a-radio value="desc">降序</a-radio>
                        </a-radio-group>
                    </a-form-item>
                    <a-alert type="info" showIcon
                        message="说明：浏览器端导出将生成新文件并触发下载（无法原地覆盖任意磁盘路径）；当前数据共包含数值/文本列，原文件样式与公式不保留。" />
                    <div style="margin-top: 16px; text-align: right">
                        <a-button @click="exportVisible = false" style="margin-right: 8px">取消</a-button>
                        <a-button type="primary" @click="doExport">开始导出</a-button>
                    </div>
                </a-form>
            </template>
            <div v-else>
                <p>正在生成 Excel 文件，请稍候…</p>
                <a-progress :percent="exportProgress" status="active" />
            </div>
        </a-modal>

        <!-- 详情弹窗 -->
        <a-modal
            v-model="detailVisible"
            title="卡牌详情"
            width="600px"
            :footer="null"
        >
            <a-descriptions :column="2" bordered size="small" v-if="currentHero">
                <a-descriptions-item v-for="col in editableColumns" :key="col.key"
                    :label="col.title">
                    {{ getCellDisplay(currentHero, col) || '-' }}
                </a-descriptions-item>
            </a-descriptions>
        </a-modal>

        <!-- 右键菜单 -->
        <div v-if="contextMenuVisible"
            class="context-menu"
            :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
            @click.stop>
            <div class="context-menu-item" @click="insertRowAbove">
                <a-icon type="plus" /> 在上方插入行
            </div>
            <div class="context-menu-item" @click="insertRowBelow">
                <a-icon type="plus" /> 在下方插入行
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item danger" @click="deleteSelectedRows">
                <a-icon type="delete" /> 删除选中行
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" @click="copyRow">
                <a-icon type="copy" /> 复制行数据
            </div>
        </div>
    </div>
</template>

<script>
import { mapState } from 'vuex';
import * as XLSX from 'xlsx';

const ADMIN_PASSWORD_HASH = '4f323fde03b2d593d6988bb02ab0b7b7';

// 保存请求超时时间（毫秒），避免后端未启动时请求长时间挂起
const SAVE_TIMEOUT_MS = 15000;

const RANK_OPTIONS = ['D', 'C', 'UC', 'B', 'A', 'EX', 'S', 'S+', 'SS', 'SSR', 'N'];
const POSITION_OPTIONS = ['先锋', '次锋', '中坚', '副将', '大将', '替补', '应援'];
const TYPE_OPTIONS = ['输出', '控制', '辅助', '回复', '能量', '拉条'];

export default {
    name: 'HeroData',
    data() {
        return {
            loading: false,
            saving: false,
            heroData: [],
            originalData: [],
            searchText: '',
            rankFilter: '',
            detailVisible: false,
            currentHero: null,
            rankOptions: RANK_OPTIONS,

            // 分页
            currentPage: 1,
            pageSize: 50,

            // 选区
            selection: null, // { startRI, startKey, endRI, endKey }
            isSelecting: false,

            // 编辑
            editingCell: null, // { ri, key }
            editOldValue: null,

            // 粘贴
            pasteModalVisible: false,
            pastePreview: null,
            pasteErrors: [],
            pasteMode: 'skip',
            pendingPasteData: null,

            // 右键菜单
            contextMenuVisible: false,
            contextMenuX: 0,
            contextMenuY: 0,
            contextMenuRow: null, // 右键点击的行数据
            contextMenuRI: null, // 右键点击的行索引（pagedData中的索引）

            // 列定义
            editableColumns: [
                { title: '索引', key: 'index', type: 'number', width: 70, editable: false },
                { title: '名称', key: 'name', type: 'text', width: 110 },
                { title: '等级', key: 'rank', type: 'select', options: RANK_OPTIONS, width: 70 },
                { title: '攻击', key: 'atk', type: 'number', width: 80 },
                { title: '生命', key: 'hp', type: 'number', width: 80 },
                { title: '防御', key: 'def', type: 'number', width: 70 },
                { title: '速度', key: 'spd', type: 'number', width: 70 },
                { title: '暴击', key: 'cri', type: 'number', step: 0.01, min: 0, max: 1, width: 70 },
                { title: '暴伤', key: 'cri_dmg', type: 'number', step: 0.1, min: 0, width: 70 },
                { title: '命中', key: 'eft_hit', type: 'number', step: 0.01, min: 0, max: 1, width: 70 },
                { title: '抵抗', key: 'eft_res', type: 'number', step: 0.01, min: 0, max: 1, width: 70 },
                { title: '代表地', key: 'region', type: 'text', width: 80 },
                { title: '学校', key: 'school', type: 'text', width: 140 },
                { title: '年级', key: 'grade', type: 'text', width: 70 },
                { title: '位置', key: 'position', type: 'select', options: POSITION_OPTIONS, width: 70 },
                { title: '类型', key: 'type', type: 'select', options: TYPE_OPTIONS, width: 70 },
                { title: '标签', key: 'label', type: 'text', width: 100 },
                { title: '昵称', key: 'nickname', type: 'text', width: 80 },
                { title: '显示', key: 'show', type: 'switch', width: 50 },
            ],
            // Excel 中存在但编辑表格不展示的字段，导入时保留、导出时可选
            extraFields: ['sex', 'point', 'index'],
            // ===== 导入状态 =====
            importVisible: false,
            importing: false,
            importProgress: 0,
            importSummary: null, // { total, empty, added, updated, duplicateSkip, formatError, errors:[] }
            // ===== 导出状态 =====
            exportVisible: false,
            exporting: false,
            exportProgress: 0,
            exportFileName: 'carddata_export.xlsx',
            exportSelectedCols: [], // 选中的导出列 key
            exportSortKey: 'index',
            exportSortDir: 'asc',
        };
    },
    computed: {
        ...mapState(['isAdminLoggedIn']),
        filteredData() {
            let data = this.heroData;
            if (this.searchText) {
                const s = this.searchText.toLowerCase();
                data = data.filter(item => item.name && item.name.toLowerCase().includes(s));
            }
            if (this.rankFilter) {
                data = data.filter(item => item.rank === this.rankFilter);
            }
            return data;
        },
        pagedData() {
            const start = (this.currentPage - 1) * this.pageSize;
            return this.filteredData.slice(start, start + this.pageSize);
        },
        // 深比较检测变更：覆盖编辑 / 粘贴 / 插入行 / 删除行 / 清空选区等全部路径，
        // 避免依赖 markChanged 手动打点造成的漏标记
        hasChanges() {
            if (this.heroData.length !== this.originalData.length) return true;
            return JSON.stringify(this.normalizeForCompare(this.heroData))
                !== JSON.stringify(this.normalizeForCompare(this.originalData));
        },
        selectionInfo() {
            if (!this.selection) return '';
            const { startRI, startKey, endRI, endKey } = this.getNormalizedSelection();
            const cols = this.editableColumns;
            const startColIdx = cols.findIndex(c => c.key === startKey);
            const endColIdx = cols.findIndex(c => c.key === endKey);
            const rowCount = Math.abs(endRI - startRI) + 1;
            const colCount = Math.abs(endColIdx - startColIdx) + 1;
            if (rowCount === 1 && colCount === 1) return '';
            return `已选 ${rowCount} 行 x ${colCount} 列`;
        },
        // 可导出列：编辑列全集 + 数据中实际出现的额外字段（如 sex/point）
        exportableColumns() {
            const titleMap = { sex: '性别', point: '点数', index: '编号' };
            const base = this.editableColumns.map(c => ({ title: c.title, key: c.key }));
            const seen = new Set(base.map(c => c.key));
            this.extraFields.forEach(k => {
                if (seen.has(k)) return;
                const exists = this.heroData.some(r => r[k] !== undefined && r[k] !== null && r[k] !== '');
                if (exists) {
                    base.push({ title: titleMap[k] || k, key: k });
                    seen.add(k);
                }
            });
            return base;
        },
    },
    mounted() {
        if (this.isAdminLoggedIn) {
            this.loadHeroData();
        } else {
            this.$message.warning('请先以管理员身份登录，登录后才能查看和编辑卡牌数据');
        }
        document.addEventListener('mouseup', this.onMouseUp);
        document.addEventListener('paste', this.onDocumentPaste);
        document.addEventListener('mousedown', this.hideContextMenu);
    },
    beforeDestroy() {
        document.removeEventListener('mouseup', this.onMouseUp);
        document.removeEventListener('paste', this.onDocumentPaste);
        document.removeEventListener('mousedown', this.hideContextMenu);
    },
    watch: {
        isAdminLoggedIn(newVal) {
            if (newVal) this.loadHeroData();
        },
    },
    methods: {
        // ========== 数据加载与保存 ==========
        async loadHeroData() {
            this.loading = true;
            try {
                const response = await fetch('/api/hero-data', {
                    headers: { 'Authorization': `Bearer ${ADMIN_PASSWORD_HASH}` },
                });
                if (!response.ok) throw new Error(await this.extractError(response));
                const data = await response.json();
                this.heroData = data.map(item => ({ ...item }));
                this.originalData = data.map(item => ({ ...item }));
            } catch (error) {
                this.$message.error('加载卡牌数据失败: ' + error.message);
            } finally {
                this.loading = false;
            }
        },

        // 比较前归一化：消除 '' 与 0、'1' 与 1 这类等价值造成的误判
        normalizeForCompare(list) {
            const colMap = {};
            this.editableColumns.forEach(c => { colMap[c.key] = c; });
            return list.map(row => {
                const out = {};
                Object.keys(row).sort().forEach(k => {
                    const col = colMap[k];
                    let v = row[k];
                    if (col && (col.type === 'number' || col.type === 'switch')) {
                        v = (v === '' || v === null || v === undefined) ? 0 : Number(v);
                        if (isNaN(v)) v = 0;
                    } else if (v === null || v === undefined) {
                        v = '';
                    }
                    out[k] = v;
                });
                return out;
            });
        },

        // 统一解析错误响应：兼容 413 / 502 / 代理超时返回的 HTML 或纯文本
        async extractError(response) {
            let raw = '';
            try {
                raw = await response.text();
            } catch (e) {
                return `HTTP ${response.status}`;
            }
            try {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.error) return parsed.error;
            } catch (e) {
                // 非 JSON 响应，走下方状态码兜底
            }
            if (response.status === 413) return '数据量超出服务端限制（413），请联系管理员调整上传上限';
            if (response.status === 401) return '登录状态已失效，请重新以管理员身份登录';
            const snippet = raw.replace(/<[^>]+>/g, '').trim().slice(0, 80);
            return snippet ? `HTTP ${response.status}：${snippet}` : `HTTP ${response.status}`;
        },

        // 保存前全量校验并归一化数值字段
        validateAllData() {
            const errors = [];
            const seenIndex = new Set();

            this.heroData.forEach((row, i) => {
                const rowNo = i + 1;

                if (!row.name || String(row.name).trim() === '') {
                    errors.push(`第 ${rowNo} 行：名称不能为空`);
                }

                const idx = Number(row.index);
                if (idx === undefined || idx === null || isNaN(idx) || idx <= 0) {
                    errors.push(`第 ${rowNo} 行：索引无效`);
                } else if (seenIndex.has(idx)) {
                    errors.push(`第 ${rowNo} 行：索引 ${idx} 重复`);
                } else {
                    seenIndex.add(idx);
                }

                this.editableColumns.forEach(col => {
                    const v = row[col.key];

                    if (col.type === 'number') {
                        // 空值归一化为 0，避免写入 hero-data.ts 后战斗计算出现 NaN
                        if (v === '' || v === null || v === undefined) {
                            row[col.key] = 0;
                            return;
                        }
                        const num = Number(v);
                        if (isNaN(num)) {
                            errors.push(`第 ${rowNo} 行 "${col.title}"：“${v}” 不是有效数字`);
                            return;
                        }
                        if (col.min !== undefined && num < col.min) {
                            errors.push(`第 ${rowNo} 行 "${col.title}"：${num} 小于最小值 ${col.min}`);
                            return;
                        }
                        if (col.max !== undefined && num > col.max) {
                            errors.push(`第 ${rowNo} 行 "${col.title}"：${num} 大于最大值 ${col.max}`);
                            return;
                        }
                        row[col.key] = num;
                    } else if (col.type === 'switch') {
                        row[col.key] = (v === 1 || v === '1' || v === true || v === '是') ? 1 : 0;
                    } else if (col.type === 'select') {
                        if (v !== '' && v !== null && v !== undefined
                            && col.options && !col.options.includes(v)) {
                            errors.push(`第 ${rowNo} 行 "${col.title}"：“${v}” 不在可选项中`);
                        }
                    } else if (v === null || v === undefined) {
                        row[col.key] = '';
                    }
                });
            });

            return errors;
        },

        async saveAllChanges() {
            if (!this.isAdminLoggedIn) {
                this.$message.warning('请先以管理员身份登录后再保存');
                return;
            }

            // 退出编辑态，确保最后一个单元格的输入已写回数据
            if (this.editingCell) {
                const row = this.pagedData[this.editingCell.ri];
                if (row) this.finishEdit(row, this.editingCell.key);
            }

            // 保存前全量校验 + 数值归一化
            const errors = this.validateAllData();
            if (errors.length > 0) {
                this.$message.error(
                    `数据校验未通过，共 ${errors.length} 处问题：${errors.slice(0, 3).join('；')}`
                    + (errors.length > 3 ? ` 等` : ''),
                    6
                );
                return;
            }

            this.saving = true;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
            try {
                // 使用批量保存 API，保存整个 heroData 数组
                const response = await fetch('/api/hero-data', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${ADMIN_PASSWORD_HASH}`,
                    },
                    body: JSON.stringify(this.heroData),
                    signal: controller.signal,
                });
                if (!response.ok) {
                    throw new Error(await this.extractError(response));
                }
                this.$message.success('保存成功');
                this.originalData = this.heroData.map(item => ({ ...item }));
            } catch (error) {
                if (error.name === 'AbortError') {
                    this.$message.error(`保存超时（超过 ${SAVE_TIMEOUT_MS / 1000} 秒），请检查后端服务是否正常运行`);
                } else {
                    this.$message.error('保存失败: ' + error.message);
                }
            } finally {
                clearTimeout(timer);
                this.saving = false;
            }
        },

        resetChanges() {
            // 先退出编辑态，避免残留的 editingCell 在重置后把旧值写回
            this.editingCell = null;
            this.editOldValue = null;
            this.heroData = this.originalData.map(item => ({ ...item }));
            this.$message.info('已重置所有修改');
        },

        onSearch(value) {
            this.searchText = value;
            this.currentPage = 1;
        },

        onPageSizeChange(current, size) {
            this.pageSize = size;
            this.currentPage = 1;
        },

        // ========== 单元格显示 ==========
        getCellDisplay(row, col) {
            const val = row[col.key];
            if (val === undefined || val === null || val === '') return '';
            if (col.type === 'switch') return val ? '是' : '否';
            return String(val);
        },

        // ========== 选区操作 ==========
        getNormalizedSelection() {
            if (!this.selection) return null;
            const { startRI, startKey, endRI, endKey } = this.selection;
            const cols = this.editableColumns;
            const startColIdx = cols.findIndex(c => c.key === startKey);
            const endColIdx = cols.findIndex(c => c.key === endKey);
            return {
                startRI: Math.min(startRI, endRI),
                endRI: Math.max(startRI, endRI),
                startColIdx: Math.min(startColIdx, endColIdx),
                endColIdx: Math.max(startColIdx, endColIdx),
            };
        },

        isCellSelected(ri, key) {
            const norm = this.getNormalizedSelection();
            if (!norm) return false;
            const colIdx = this.editableColumns.findIndex(c => c.key === key);
            return ri >= norm.startRI && ri <= norm.endRI &&
                   colIdx >= norm.startColIdx && colIdx <= norm.endColIdx;
        },

        isRowInSelection(ri) {
            const norm = this.getNormalizedSelection();
            if (!norm) return false;
            return ri >= norm.startRI && ri <= norm.endRI;
        },

        isColInSelection(key) {
            const norm = this.getNormalizedSelection();
            if (!norm) return false;
            const colIdx = this.editableColumns.findIndex(c => c.key === key);
            return colIdx >= norm.startColIdx && colIdx <= norm.endColIdx;
        },

        onCellMouseDown(e, ri, key) {
            if (e.button !== 0) return;
            // 如果点击的是正在编辑的单元格，不退出编辑模式，让输入框处理点击
            if (this.editingCell && this.editingCell.ri === ri && this.editingCell.key === key) {
                // 不阻止默认行为，让输入框能接收点击事件设置光标位置
                return;
            }
            // 阻止默认行为（如文本选择等），并开始选区操作
            e.preventDefault();
            this.isSelecting = true;
            this.selection = { startRI: ri, startKey: key, endRI: ri, endKey: key };
            this.editingCell = null;
        },

        onCellMouseOver(e, ri, key) {
            if (!this.isSelecting) return;
            this.selection = { ...this.selection, endRI: ri, endKey: key };
        },

        onMouseUp() {
            this.isSelecting = false;
        },

        onHeaderMouseDown(e, key) {
            if (e.button !== 0) return;
            this.isSelecting = true;
            this.selection = {
                startRI: 0,
                startKey: key,
                endRI: this.pagedData.length - 1,
                endKey: key,
            };
        },

        // ========== 编辑操作 ==========
        startEdit(ri, key) {
            const col = this.editableColumns.find(c => c.key === key);
            if (col && col.editable === false) return;
            const row = this.pagedData[ri];
            if (!row) return;
            this.editOldValue = row[key];
            this.editingCell = { ri, key };
            this.$nextTick(() => {
                const input = this.$refs.editInput;
                if (input) {
                    const el = Array.isArray(input) ? input[0] : input;
                    if (el) {
                        el.focus();
                        if (el.select) el.select();
                    }
                }
            });
        },

        finishEdit(row, key) {
            if (!this.editingCell) return;
            // 变更由 hasChanges 深比较自动识别，此处只负责退出编辑态
            this.editingCell = null;
            this.editOldValue = null;
            // 强制触发更新
            this.$forceUpdate();
        },

        cancelEdit() {
            if (this.editingCell) {
                const row = this.pagedData[this.editingCell.ri];
                if (row) {
                    row[this.editingCell.key] = this.editOldValue;
                }
                this.editingCell = null;
                this.editOldValue = null;
            }
        },

        // ========== 键盘操作 ==========
        onKeyDown(e) {
            // Ctrl+C 复制
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                this.copySelection();
                return;
            }
            // Ctrl+V 粘贴
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                // 由 onDocumentPaste 处理
                return;
            }
            // Ctrl+A 全选
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                if (this.pagedData.length > 0) {
                    const firstKey = this.editableColumns[0].key;
                    const lastKey = this.editableColumns[this.editableColumns.length - 1].key;
                    this.selection = {
                        startRI: 0,
                        startKey: firstKey,
                        endRI: this.pagedData.length - 1,
                        endKey: lastKey,
                    };
                }
                return;
            }
            // Delete 清空选中
            if (e.key === 'Delete') {
                this.deleteSelection();
                return;
            }
            // 方向键移动选区
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                this.moveSelection(e.key);
                return;
            }
            // Enter 开始编辑或移动
            if (e.key === 'Enter') {
                if (this.editingCell) {
                    this.editingCell = null;
                    this.moveSelection('ArrowDown');
                } else if (this.selection) {
                    this.startEdit(this.selection.startRI, this.selection.startKey);
                }
                return;
            }
            // F2 编辑
            if (e.key === 'F2') {
                e.preventDefault();
                if (this.selection && !this.editingCell) {
                    this.startEdit(this.selection.startRI, this.selection.startKey);
                }
                return;
            }
            // Tab 移动
            if (e.key === 'Tab') {
                e.preventDefault();
                this.moveSelection(e.shiftKey ? 'ArrowLeft' : 'ArrowRight');
                return;
            }
            // 直接输入开始编辑：先进入编辑态（由 startEdit 记录真实原值），
            // 再把首字符写入输入框，避免提前清空导致 editOldValue 丢失
            if (!this.editingCell && this.selection && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const col = this.editableColumns.find(c => c.key === this.selection.startKey);
                if (col && col.editable !== false && col.type !== 'select' && col.type !== 'switch') {
                    const row = this.pagedData[this.selection.startRI];
                    if (row) {
                        e.preventDefault();
                        const key = this.selection.startKey;
                        this.startEdit(this.selection.startRI, key);
                        this.$nextTick(() => {
                            const input = this.$refs.editInput;
                            const el = Array.isArray(input) ? input[0] : input;
                            if (!el) return;
                            // 数字列仅接受合法的数字起始字符
                            if (col.type === 'number' && !/[0-9.-]/.test(e.key)) return;
                            this.$set(row, key, col.type === 'number' ? Number(e.key) || 0 : e.key);
                            el.value = String(row[key]);
                        });
                    }
                }
            }
        },

        moveSelection(key) {
            if (!this.selection || this.editingCell) return;
            const cols = this.editableColumns;
            const { startKey } = this.selection;
            let { startRI } = this.selection;
            let colIdx = cols.findIndex(c => c.key === startKey);

            switch (key) {
                case 'ArrowUp': startRI = Math.max(0, startRI - 1); break;
                case 'ArrowDown': startRI = Math.min(this.pagedData.length - 1, startRI + 1); break;
                case 'ArrowLeft': colIdx = Math.max(0, colIdx - 1); break;
                case 'ArrowRight': colIdx = Math.min(cols.length - 1, colIdx + 1); break;
            }

            this.selection = {
                startRI,
                startKey: cols[colIdx].key,
                endRI: startRI,
                endKey: cols[colIdx].key,
            };
        },

        // ========== 复制操作 ==========
        copySelection() {
            const norm = this.getNormalizedSelection();
            if (!norm) return;

            const cols = this.editableColumns;
            const rows = [];
            for (let ri = norm.startRI; ri <= norm.endRI; ri++) {
                const row = this.pagedData[ri];
                if (!row) continue;
                const cells = [];
                for (let ci = norm.startColIdx; ci <= norm.endColIdx; ci++) {
                    const val = row[cols[ci].key];
                    cells.push(val !== undefined && val !== null ? String(val) : '');
                }
                rows.push(cells.join('\t'));
            }

            const text = rows.join('\n');
            navigator.clipboard.writeText(text).then(() => {
                this.$message.success('已复制到剪贴板');
            }).catch(() => {
                // fallback
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                this.$message.success('已复制到剪贴板');
            });
        },

        // ========== 粘贴操作 ==========
        onDocumentPaste(e) {
            // 如果正在编辑单元格内，不拦截（允许输入框内正常粘贴）
            if (this.editingCell) return;
            // <td> 不可聚焦，点击单元格后 activeElement 会落在 body，
            // 因此不能依赖 container.contains(activeElement) 判断是否处于表格，
            // 改为：存在选区即视为针对表格粘贴；若焦点在其它输入框则放行，避免吞掉其它输入
            const ae = document.activeElement;
            if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.tagName === 'SELECT')) {
                return;
            }
            if (!this.selection) return;

            e.preventDefault();
            const clipboardData = e.clipboardData || window.clipboardData;
            const text = clipboardData.getData('text');
            if (!text) return;

            this.processPasteData(text);
        },

        processPasteData(text) {
            const norm = this.getNormalizedSelection();
            if (!norm) return;

            // 解析剪贴板数据
            const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
            // 去掉末尾空行
            while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
                lines.pop();
            }

            const pasteRows = lines.map(line => line.split('\t'));

            // 仅可编辑列参与粘贴：index 列只读且由系统维护，绝不参与对齐，避免整列错位
            const editableCols = this.editableColumns.filter(c => c.editable !== false);
            // 选区起始列在可编辑列序列中的相对索引；
            // 若起始列是只读列（index），则回退到第一个可编辑列（name）
            let startEditableIdx = editableCols.findIndex(
                c => c.key === this.editableColumns[norm.startColIdx].key
            );
            if (startEditableIdx === -1) startEditableIdx = 0;

            // 若复制的是整行（列数等于全部列数，含 index 列），自动剥离首列 index，
            // 否则 name 会被写成数字、整列右移错位
            if (pasteRows.length && pasteRows[0].length === this.editableColumns.length) {
                pasteRows.forEach(r => { if (r.length === this.editableColumns.length) r.shift(); });
            }

            const startRI = norm.startRI;

            // 验证数据
            const errors = [];
            const validatedData = [];

            for (let ri = 0; ri < pasteRows.length; ri++) {
                const rowData = [];
                for (let ci = 0; ci < pasteRows[ri].length; ci++) {
                    const targetEditableIdx = startEditableIdx + ci;
                    if (targetEditableIdx >= editableCols.length) break;
                    const col = editableCols[targetEditableIdx];
                    const rawVal = pasteRows[ri][ci] || '';
                    const trimmed = rawVal.trim();

                    const targetRI = startRI + ri;
                    if (targetRI >= this.pagedData.length) {
                        errors.push(`第 ${targetRI + 1} 行超出表格范围`);
                        rowData.push({ valid: false, value: trimmed });
                        continue;
                    }

                    // 验证
                    const validation = this.validateCellData(col, trimmed);
                    rowData.push(validation);
                    if (!validation.valid) {
                        errors.push(`第 ${targetRI + 1} 行 "${col.title}" 列: ${validation.error}`);
                    }
                }
                validatedData.push(rowData);
            }

            this.pendingPasteData = {
                startRI,
                startEditableIdx,
                data: validatedData,
                pasteRowCount: pasteRows.length,
                pasteColCount: Math.max(...pasteRows.map(r => r.length)),
            };

            this.pastePreview = {
                rowCount: pasteRows.length,
                colCount: Math.max(...pasteRows.map(r => r.length)),
                startRow: startRI,
                startColName: editableCols[startEditableIdx].title,
            };
            this.pasteErrors = errors;
            this.pasteMode = errors.length > 0 ? 'cancel' : 'skip';
            this.pasteModalVisible = true;
        },

        validateCellData(col, value) {
            if (value === '') {
                return { valid: true, value: '' };
            }

            if (col.type === 'number') {
                const num = Number(value);
                if (isNaN(num)) {
                    return { valid: false, value, error: `"${value}" 不是有效数字` };
                }
                if (col.min !== undefined && num < col.min) {
                    return { valid: false, value, error: `${num} 小于最小值 ${col.min}` };
                }
                if (col.max !== undefined && num > col.max) {
                    return { valid: false, value, error: `${num} 大于最大值 ${col.max}` };
                }
                return { valid: true, value: num };
            }

            if (col.type === 'select') {
                if (col.options && !col.options.includes(value)) {
                    return { valid: false, value, error: `"${value}" 不在选项 [${col.options.join(', ')}] 中` };
                }
                return { valid: true, value };
            }

            if (col.type === 'switch') {
                if (value === '是' || value === '1' || value === 'true') {
                    return { valid: true, value: 1 };
                }
                if (value === '否' || value === '0' || value === 'false') {
                    return { valid: true, value: 0 };
                }
                return { valid: false, value, error: `"${value}" 不是有效的布尔值` };
            }

            return { valid: true, value };
        },

        confirmPaste() {
            if (!this.pendingPasteData) return;

            if (this.pasteErrors.length > 0 && this.pasteMode === 'cancel') {
                this.pasteModalVisible = false;
                this.pendingPasteData = null;
                return;
            }

            const { startRI, startEditableIdx, data } = this.pendingPasteData;
            const editableCols = this.editableColumns.filter(c => c.editable !== false);
            let pasteCount = 0;

            for (let ri = 0; ri < data.length; ri++) {
                const targetRI = startRI + ri;
                if (targetRI >= this.pagedData.length) break;
                const row = this.pagedData[targetRI];

                for (let ci = 0; ci < data[ri].length; ci++) {
                    const targetEditableIdx = startEditableIdx + ci;
                    if (targetEditableIdx >= editableCols.length) break;
                    const cell = data[ri][ci];

                    if (!cell.valid && this.pasteMode === 'skip') continue;

                    const col = editableCols[targetEditableIdx];
                    this.$set(row, col.key, cell.value);
                    pasteCount++;
                }
            }

            this.$message.success(`已粘贴 ${pasteCount} 个单元格`);
            this.pasteModalVisible = false;
            this.pendingPasteData = null;
        },

        cancelPaste() {
            this.pasteModalVisible = false;
            this.pendingPasteData = null;
        },

        // ========== 删除选区 ==========
        deleteSelection() {
            const norm = this.getNormalizedSelection();
            if (!norm) return;
            const cols = this.editableColumns;

            for (let ri = norm.startRI; ri <= norm.endRI; ri++) {
                const row = this.pagedData[ri];
                if (!row) continue;
                for (let ci = norm.startColIdx; ci <= norm.endColIdx; ci++) {
                    const col = cols[ci];
                    if (col.editable === false) continue;
                    if (col.type === 'switch' || col.type === 'number') {
                        this.$set(row, col.key, 0);
                    } else {
                        this.$set(row, col.key, '');
                    }
                }
            }
            this.$message.info('已清空选区');
        },

        showDetail(record) {
            this.currentHero = record;
            this.detailVisible = true;
        },

        // ========== 右键菜单操作 ==========
        onRowContextMenu(e, ri, row) {
            // 选中该行
            const firstKey = this.editableColumns[0].key;
            const lastKey = this.editableColumns[this.editableColumns.length - 1].key;
            this.selection = {
                startRI: ri,
                startKey: firstKey,
                endRI: ri,
                endKey: lastKey,
            };

            // 显示右键菜单
            this.contextMenuVisible = true;
            this.contextMenuX = e.clientX;
            this.contextMenuY = e.clientY;
            this.contextMenuRow = row;
            this.contextMenuRI = ri;
        },

        hideContextMenu(e) {
            // 如果点击的是菜单本身，不关闭
            if (e && e.target && e.target.closest('.context-menu')) return;
            this.contextMenuVisible = false;
        },

        // 获取选中行的范围（在 filteredData 中的索引）
        getSelectedRowRange() {
            if (!this.selection) return null;
            const norm = this.getNormalizedSelection();
            if (!norm) return null;

            // 将 pagedData 的索引转换为 filteredData 的索引
            const pageStart = (this.currentPage - 1) * this.pageSize;
            const startRowIdx = pageStart + norm.startRI;
            const endRowIdx = pageStart + norm.endRI;

            return { start: startRowIdx, end: endRowIdx };
        },

        // 在上方插入行
        insertRowAbove() {
            this.hideContextMenu();
            const range = this.getSelectedRowRange();
            if (!range) return;

            const insertIdx = range.start;
            this.insertRowAt(insertIdx);
        },

        // 在下方插入行
        insertRowBelow() {
            this.hideContextMenu();
            const range = this.getSelectedRowRange();
            if (!range) return;

            const insertIdx = range.end + 1;
            this.insertRowAt(insertIdx);
        },

        // 在指定位置插入新行
        insertRowAt(filteredIdx) {
            // 计算新行的 index（基于 heroData）
            let newIndex = 1;
            if (this.heroData.length > 0) {
                const maxIndex = Math.max(...this.heroData.map(h => h.index || 0));
                newIndex = maxIndex + 1;
            }

            // 创建新行数据
            const newRow = {
                index: newIndex,
                name: '',
                rank: 'D',
                atk: 0,
                hp: 0,
                def: 0,
                spd: 100,
                cri: 0,
                cri_dmg: 1.5,
                eft_hit: 0,
                eft_res: 0,
                region: '',
                school: '',
                grade: '',
                position: '先锋',
                type: '输出',
                label: '',
                nickname: '',
                show: 1,
            };

            // 找到 filteredData[filteredIdx] 对应的 heroData 索引
            const targetHero = this.filteredData[filteredIdx];
            let heroDataIdx = this.heroData.length;
            if (targetHero) {
                heroDataIdx = this.heroData.findIndex(h => h.index === targetHero.index);
                if (heroDataIdx === -1) heroDataIdx = this.heroData.length;
            }

            // 在 heroData 中插入
            this.heroData.splice(heroDataIdx, 0, newRow);

            // 重新计算所有 index（保持连续）
            this.reindexHeroData();

            this.$message.success('已插入新行');
        },

        // 删除选中的行
        deleteSelectedRows() {
            this.hideContextMenu();
            const range = this.getSelectedRowRange();
            if (!range) return;

            const rowCount = range.end - range.start + 1;
            const rowsToDelete = this.filteredData.slice(range.start, range.end + 1);

            // 从 heroData 中删除
            for (const row of rowsToDelete) {
                const heroIdx = this.heroData.findIndex(h => h.index === row.index);
                if (heroIdx !== -1) {
                    this.heroData.splice(heroIdx, 1);
                }
            }

            // 重新计算 index
            this.reindexHeroData();

            // 清除选区
            this.selection = null;

            this.$message.success(`已删除 ${rowCount} 行`);
        },

        // 复制行数据到剪贴板
        copyRow() {
            this.hideContextMenu();
            const range = this.getSelectedRowRange();
            if (!range) return;

            const rows = this.filteredData.slice(range.start, range.end + 1);
            const cols = this.editableColumns;

            const lines = rows.map(row => {
                return cols.map(col => {
                    const val = row[col.key];
                    return val !== undefined && val !== null ? String(val) : '';
                }).join('\t');
            });

            const text = lines.join('\n');
            navigator.clipboard.writeText(text).then(() => {
                this.$message.success('已复制行数据');
            }).catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                this.$message.success('已复制行数据');
            });
        },

        // 重新计算所有行的 index，保持连续且唯一
        reindexHeroData() {
            for (let i = 0; i < this.heroData.length; i++) {
                const newIndex = i + 1;
                if (this.heroData[i].index !== newIndex) {
                    this.$set(this.heroData[i], 'index', newIndex);
                }
            }
        },

        // ========== Excel 导入 ==========
        onFileChange(e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            this.importVisible = true;
            this.importExcel(file);
            e.target.value = '';
        },

        async importExcel(file) {
            if (!this.isAdminLoggedIn) {
                this.$message.warning('请先以管理员身份登录后再导入');
                this.importVisible = false;
                return;
            }
            this.importing = true;
            this.importProgress = 0;
            this.importSummary = null;
            try {
                const buf = await file.arrayBuffer();
                const wb = XLSX.read(buf, { type: 'array' });
                // 选择第一个含数据的 sheet（数据行 > 1）
                let ws = null;
                for (const name of wb.SheetNames) {
                    const s = wb.Sheets[name];
                    const r = XLSX.utils.sheet_to_json(s, { header: 1, defval: null, blankrows: false });
                    if (r.length > 1) { ws = s; break; }
                }
                if (!ws) throw new Error('未找到包含数据的工作表');
                // 采用对象模式：每个单元格直接以表头名为 key 取值，避免按位置索引可能造成的列错位/串位
                const jsonRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
                // 反向建立 表头名 -> 字段key 的映射：允许 Excel 表头使用中文别名（位置/类型/名称等）
                const headerAlias = {
                    '索引': 'index', '名称': 'name', '等级': 'rank', '攻击': 'atk', '生命': 'hp',
                    '防御': 'def', '速度': 'spd', '暴击': 'cri', '暴伤': 'cri_dmg', '命中': 'eft_hit',
                    '抵抗': 'eft_res', '代表地': 'region', '学校': 'school', '年级': 'grade',
                    '位置': 'position', '类型': 'type', '标签': 'label', '昵称': 'nickname',
                    '显示': 'show', '性别': 'sex', '点数': 'point', '编号': 'index',
                };
                const resolveKey = (h) => {
                    const norm = String(h == null ? '' : h).trim();
                    if (headerAlias[norm]) return headerAlias[norm];
                    return norm; // 已是英文字段名（如 position）
                };

                const allKeys = [...this.editableColumns.map(c => c.key), ...this.extraFields];
                const summary = { total: jsonRows.length, empty: 0, added: 0, updated: 0, duplicateSkip: 0, formatError: 0, errors: [] };

                // 现有数据按 index 建索引，便于覆盖更新
                const existingByIndex = new Map();
                this.heroData.forEach(r => existingByIndex.set(Number(r.index), r));
                const pendingIdx = new Set(); // 本次文件内已处理的 index（防止文件内重复）
                const newRows = [];

                for (let ri = 0; ri < jsonRows.length; ri++) {
                    const rowObj = jsonRows[ri];
                    // 每个字段严格按表头名取值，绝不使用相邻单元格兜底（防止串位）
                    const getCell = (key) => {
                        // Excel 表头可能是中文别名或英文字段名，都解析到目标 key
                        for (const h of Object.keys(rowObj)) {
                            if (resolveKey(h) === key) return rowObj[h];
                        }
                        return ''; // 该列不存在：保持空，不串用其它字段
                    };
                    // 空行：所有目标字段均为空
                    const isEmpty = allKeys.every(k => {
                        const v = getCell(k);
                        return v === null || v === undefined || String(v).trim() === '';
                    });
                    if (isEmpty) { summary.empty++; continue; }

                    const obj = {};
                    let rowBad = false;
                    for (const key of allKeys) {
                        let val = getCell(key);
                        if (key === 'index') {
                            if (val === null || val === undefined || String(val).trim() === '') {
                                summary.errors.push(`第 ${ri + 1} 行：缺少索引`);
                                rowBad = true; break;
                            }
                            const n = Number(val);
                            if (isNaN(n) || n <= 0) {
                                summary.errors.push(`第 ${ri + 1} 行：索引无效`);
                                rowBad = true; break;
                            }
                            val = n;
                        } else {
                            const col = this.editableColumns.find(c => c.key === key);
                            if (col && col.type === 'number') {
                                if (val === null || val === undefined || String(val).trim() === '') val = 0;
                                else {
                                    const n = Number(val);
                                    if (isNaN(n)) {
                                        summary.errors.push(`第 ${ri + 1} 行 "${col.title}" 不是有效数字，已置 0`);
                                        val = 0;
                                    } else val = n;
                                }
                            } else if (col && col.type === 'switch') {
                                val = (val === 1 || val === '1' || val === true || val === '是') ? 1 : 0;
                            } else {
                                // 文本字段：源为空（'' / null / undefined）时严格保持空，不填充其它字段
                                let textVal = (val === null || val === undefined) ? '' : String(val).trim();
                                // 核心标识符 index：Excel 中为空时保留原有值，
                                // 避免覆盖 hero-data.ts 中有效的 index 而破坏 HeroTable 索引（导致队伍设置取错英雄）
                                if (key === 'index' && textVal === '' && existingByIndex.has(Number(obj.index))) {
                                    const oldRec = existingByIndex.get(Number(obj.index));
                                    if (oldRec && oldRec[key]) textVal = oldRec[key];
                                }
                                val = textVal;
                            }
                        }
                        obj[key] = val;
                    }
                    if (rowBad) { summary.formatError++; continue; }
                    if (!obj.name || String(obj.name).trim() === '') {
                        summary.errors.push(`第 ${ri + 1} 行：名称不能为空`);
                        summary.formatError++;
                        continue;
                    }

                    const idx = Number(obj.index);
                    if (pendingIdx.has(idx)) { summary.duplicateSkip++; continue; } // 文件内重复，跳过
                    pendingIdx.add(idx);
                    if (existingByIndex.has(idx)) {
                        const old = existingByIndex.get(idx);
                        Object.keys(obj).forEach(k => this.$set(old, k, obj[k]));
                        summary.updated++;
                    } else {
                        newRows.push(obj);
                        existingByIndex.set(idx, obj);
                        summary.added++;
                    }

                    this.importProgress = Math.round(((ri + 1) / jsonRows.length) * 100);
                    if (ri % 20 === 0) await new Promise(res => setTimeout(res, 0));
                }

                this.heroData = this.heroData.concat(newRows);
                this.importSummary = summary;
                this.importProgress = 100;
                this.$message.success(
                    `导入完成：新增 ${summary.added} 行，更新 ${summary.updated} 行，跳过空行 ${summary.empty} 行，文件内重复 ${summary.duplicateSkip} 行，格式错误 ${summary.formatError} 行`
                );
            } catch (err) {
                this.$message.error('导入失败: ' + err.message);
                this.importVisible = false;
            } finally {
                this.importing = false;
            }
        },

        // ========== Excel 导出 ==========
        openExport() {
            if (this.exportSelectedCols.length === 0) {
                this.exportSelectedCols = this.exportableColumns.map(c => c.key);
            }
            this.exportVisible = true;
        },

        async doExport() {
            this.exporting = true;
            this.exportProgress = 0;
            try {
                const cols = this.exportableColumns.filter(c => this.exportSelectedCols.includes(c.key));
                if (cols.length === 0) throw new Error('请至少选择一列导出');

                const data = this.heroData.slice();
                // 排序
                const sk = this.exportSortKey;
                const dir = this.exportSortDir === 'asc' ? 1 : -1;
                data.sort((a, b) => {
                    let va = a[sk];
                    let vb = b[sk];
                    if (va === undefined || va === null || va === '') va = 0;
                    if (vb === undefined || vb === null || vb === '') vb = 0;
                    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
                    return String(va).localeCompare(String(vb), 'zh') * dir;
                });
                this.exportProgress = 45;

                const aoa = [cols.map(c => c.title)];
                data.forEach(r => {
                    aoa.push(cols.map(c => {
                        const v = r[c.key];
                        if (v === undefined || v === null) return '';
                        if (typeof v === 'boolean') return v ? 1 : 0;
                        return v;
                    }));
                });
                this.exportProgress = 75;

                const ws = XLSX.utils.aoa_to_sheet(aoa);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
                // 浏览器端只能生成新文件下载（无法原地覆盖任意路径），文件名可自定义
                XLSX.writeFile(wb, this.exportFileName || 'carddata_export.xlsx');
                this.exportProgress = 100;
                this.$message.success(`导出成功：${data.length} 行 × ${cols.length} 列`);
                this.exportVisible = false;
            } catch (err) {
                this.$message.error('导出失败: ' + err.message);
            } finally {
                this.exporting = false;
            }
        },
    },
};
</script>

<style lang="scss" scoped>
.hero-data-container {
    padding: 24px;
    outline: none;

    .admin-empty {
        padding: 48px 0;

        .admin-empty-hint {
            color: #999;
            font-size: 12px;
            margin: 4px 0 0;
        }
    }

    .toolbar {
        margin-bottom: 16px;
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;

        .selection-info {
            margin-left: 8px;
        }

        .copy-hint {
            margin-left: auto;
            color: #999;
            font-size: 12px;
        }
    }

    .table-wrapper {
        overflow: auto;
        max-height: calc(100vh - 260px);
        border: 1px solid #e8e8e8;
        border-radius: 4px;
        user-select: none;
    }

    .excel-table {
        border-collapse: collapse;
        width: max-content;
        min-width: 100%;
        font-size: 13px;

        thead {
            position: sticky;
            top: 0;
            z-index: 10;

            th {
                background: #fafafa;
                border: 1px solid #e8e8e8;
                padding: 6px 8px;
                font-weight: 600;
                white-space: nowrap;
                text-align: center;
                cursor: pointer;
                min-width: 50px;

                &:hover {
                    background: #e6f7ff;
                }

                &.col-selected {
                    background: #bae7ff;
                }
            }
        }

        tbody {
            tr {
                &.row-selected td:not(.cell-selected) {
                    background: #e6f7ff;
                }

                &:hover td:not(.cell-selected) {
                    background: #fafafa;
                }
            }

            td {
                border: 1px solid #e8e8e8;
                padding: 0;
                height: 28px;
                position: relative;
                cursor: cell;

                &.cell-selected {
                    background: #1890ff !important;
                    color: #fff;
                    outline: 2px solid #096dd9;
                    outline-offset: -2px;

                    .cell-text {
                        color: #fff;
                    }
                }

                &.cell-editing {
                    padding: 0;
                    background: #fff !important;
                    outline: 2px solid #1890ff;
                    outline-offset: -2px;
                }

                &.empty-row {
                    text-align: center;
                    color: #999;
                    padding: 24px 0;
                    cursor: default;
                }

                .cell-text {
                    display: block;
                    padding: 4px 8px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    min-height: 20px;
                    line-height: 20px;
                }

                .cell-input,
                .cell-select {
                    width: 100%;
                    height: 28px;
                    border: none;
                    outline: none;
                    padding: 4px 8px;
                    font-size: 13px;
                    background: #fff;
                    color: #333;
                    box-sizing: border-box;
                    display: block;
                    line-height: 20px;
                    caret-color: #333;
                }

                .cell-input:focus,
                .cell-select:focus {
                    background: #fff;
                    color: #333;
                }
            }
        }
    }

    .pagination-wrapper {
        margin-top: 16px;
        display: flex;
        align-items: center;
        gap: 16px;

        .page-info {
            color: #999;
            font-size: 12px;
        }
    }

    .error-list {
        margin: 0;
        padding-left: 20px;
        font-size: 12px;
        max-height: 150px;
        overflow-y: auto;

        li {
            margin-bottom: 2px;
        }
    }
}

// 右键菜单样式（不使用 scoped，因为菜单是动态定位的）
.context-menu {
    position: fixed;
    z-index: 1000;
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 4px 0;
    min-width: 150px;

    .context-menu-item {
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: #333;

        &:hover {
            background: #e6f7ff;
        }

        &.danger {
            color: #ff4d4f;

            &:hover {
                background: #fff1f0;
            }
        }

        .anticon {
            font-size: 14px;
        }
    }

    .context-menu-divider {
        height: 1px;
        background: #e8e8e8;
        margin: 4px 0;
    }
}
</style>