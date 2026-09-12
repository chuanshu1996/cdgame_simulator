<template>
    <div class="battle-setup">
        <a-card class="setup-card" title="战场配置" :bordered="false">
            <a-form layout="vertical">
                <!-- 对战规模：两侧人数独立配置 -->
                <a-form-item label="对战规模（左右两侧人数可不同）">
                    <div class="team-size-row">
                        <span class="side-label side-label-left">左队（红队）</span>
                        <a-input-number v-model="form.teamSizes[0]" :min="1" :max="6" :precision="0" style="width: 110px"/>
                        <span class="vs-text">vs</span>
                        <span class="side-label side-label-right">右队（蓝队）</span>
                        <a-input-number v-model="form.teamSizes[1]" :min="1" :max="6" :precision="0" style="width: 110px"/>
                    </div>
                    <div class="field-hint">
                        两侧各支持 1~6 人，可组合出 1v6、3v4 等非对称对局。当前：{{ form.teamSizes[0] }} v {{ form.teamSizes[1] }}。
                    </div>
                    <div class="preset-row">
                        <span class="preset-label">快捷预设：</span>
                        <a-button v-for="p in presets" :key="p.label" size="small" class="preset-btn" @click="applyPreset(p)">
                            {{ p.label }}
                        </a-button>
                    </div>
                </a-form-item>

                <a-form-item label="替补 / 应援">
                    <a-switch v-model="form.hasReserve" />
                    <span class="inline-text">
                        {{ form.hasReserve ? '启用（队伍设置中的第7、8位不上场，但可触发被动）' : '不启用（只上场正式队员）' }}
                    </span>
                </a-form-item>

                <a-divider orientation="left">能量设定</a-divider>

                <a-form-item label="无限能量">
                    <a-switch v-model="form.energy.infinite" />
                    <span class="inline-text">
                        {{ form.energy.infinite ? '开启：技能消耗不扣减能量' : '关闭：按下方规则消耗与回复' }}
                    </span>
                </a-form-item>

                <a-row :gutter="16">
                    <a-col :span="8">
                        <a-form-item label="初始能量">
                            <a-input-number v-model="form.energy.initNum" :min="0" :max="16" :disabled="form.energy.infinite" style="width: 100%"/>
                        </a-form-item>
                    </a-col>
                    <a-col :span="8">
                        <a-form-item label="能量上限">
                            <a-input-number v-model="form.energy.maxNum" :min="1" :max="16" :disabled="form.energy.infinite" style="width: 100%"/>
                        </a-form-item>
                    </a-col>
                    <a-col :span="8">
                        <a-form-item label="每次行动增加进度">
                            <a-input-number :value="1" :min="1" :max="1" disabled style="width: 100%"/>
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-row :gutter="16">
                    <a-col :span="12">
                        <a-form-item label="进度满值（满后回能）">
                            <a-input-number v-model="form.energy.progressGoal" :min="1" :max="20" :disabled="form.energy.infinite" style="width: 100%"/>
                            <div class="field-hint">每次行动进度 +1，累计达到该值后触发回能</div>
                        </a-form-item>
                    </a-col>
                    <a-col :span="12">
                        <a-form-item label="进度满时回复点数">
                            <a-input-number v-model="form.energy.recoverAmount" :min="1" :max="16" :disabled="form.energy.infinite" style="width: 100%"/>
                            <div class="field-hint">默认 5：每 5 次行动回复 5 点能量</div>
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-row :gutter="16">
                    <a-col :span="12">
                        <a-form-item label="每 N 回合额外给能量（0=关闭）">
                            <a-input-number v-model="form.energy.bonusIntervalRounds" :min="0" :max="99" :disabled="form.energy.infinite" style="width: 100%"/>
                        </a-form-item>
                    </a-col>
                    <a-col :span="12">
                        <a-form-item label="每次额外给予点数">
                            <a-input-number v-model="form.energy.bonusAmount" :min="0" :max="16" :disabled="form.energy.infinite || !form.energy.bonusIntervalRounds" style="width: 100%"/>
                            <div class="field-hint">例：每 3 回合双方各 +2 点</div>
                        </a-form-item>
                    </a-col>
                </a-row>

                <a-divider orientation="left">获胜条件</a-divider>

                <a-form-item label="结束与判定方式">
                    <a-radio-group v-model="form.winCondition.type">
                        <a-radio value="annihilation">一方全灭（默认）</a-radio>
                        <a-radio value="hp_compare">裁判旗达指定回合后，剩余在场总血量高的一方获胜</a-radio>
                    </a-radio-group>
                </a-form-item>

                <a-form-item label="裁判旗回合上限（0 = 不限回合，按全灭判定）">
                    <a-input-number v-model="form.winCondition.maxJudgeRounds" :min="0" :max="999" style="width: 200px"/>
                    <div class="field-hint">
                        设为 N 时，裁判旗行动到第 N 回合即结束战斗，按双方上场角色剩余血量总和判定胜负。
                    </div>
                </a-form-item>

                <a-form-item>
                    <a-button type="primary" size="large" @click="save">保存配置并开始模拟</a-button>
                    <a-button size="large" style="margin-left: 12px;" @click="resetDefault">恢复默认</a-button>
                </a-form-item>
            </a-form>
        </a-card>
    </div>
</template>

<script>
    import { message } from 'ant-design-vue';

    // 读取两侧人数：兼容旧持久化数据里只有单一 teamSize 的情况
    function loadFormTeamSizes(saved) {
        const def = [6, 6];
        let arr = saved && saved.teamSizes;
        if (!Array.isArray(arr) || arr.length < 2) {
            const legacy = Number(saved && saved.teamSize);
            arr = Number.isFinite(legacy) ? [legacy, legacy] : def;
        }
        return [
            Math.min(6, Math.max(1, Math.floor(Number(arr[0]) || def[0]))),
            Math.min(6, Math.max(1, Math.floor(Number(arr[1]) || def[1]))),
        ];
    }

    function defaultForm() {
        return {
            teamSizes: [6, 6],
            hasReserve: true,
            energy: {
                infinite: false,
                initNum: 4,
                maxNum: 8,
                progressGoal: 5,
                recoverAmount: 5,
                bonusIntervalRounds: 0,
                bonusAmount: 0,
            },
            winCondition: {
                type: 'annihilation',
                maxJudgeRounds: 0,
            },
        };
    }

    export default {
        name: 'BattleSetup',
        data() {
            return {
                form: defaultForm(),
                presets: [
                    { label: '1v1', sizes: [1, 1] },
                    { label: '3v3', sizes: [3, 3] },
                    { label: '5v5', sizes: [5, 5] },
                    { label: '6v6', sizes: [6, 6] },
                    { label: '1v6', sizes: [1, 6] },
                    { label: '6v1', sizes: [6, 1] },
                    { label: '3v4', sizes: [3, 4] },
                ],
            };
        },
        computed: {
            fromPath() {
                const from = this.$route.query.from;
                return typeof from === 'string' && from.indexOf('/') === 0 ? from : '/battle';
            },
        },
        created() {
            const saved = this.$store.state.battleSetup;
            if (saved) {
                this.form = Object.assign(defaultForm(), JSON.parse(JSON.stringify(saved)), {
                    teamSizes: loadFormTeamSizes(saved),
                    energy: Object.assign({}, defaultForm().energy, saved.energy),
                    winCondition: Object.assign({}, defaultForm().winCondition, saved.winCondition),
                });
            }
        },
        methods: {
            // 应用快捷预设（两侧人数）
            applyPreset(preset) {
                this.form.teamSizes = [preset.sizes[0], preset.sizes[1]];
            },
            save() {
                const f = this.form;
                const [size0, size1] = f.teamSizes;
                if (!Number.isFinite(size0) || size0 < 1 || size0 > 6
                    || !Number.isFinite(size1) || size1 < 1 || size1 > 6) {
                    message.warning('两侧上场人数均需在 1~6 之间');
                    return;
                }
                f.teamSizes = [Math.floor(size0), Math.floor(size1)];
                if (f.winCondition.type === 'hp_compare' && !(f.winCondition.maxJudgeRounds > 0)) {
                    message.warning('选择按血量判定时，请设置大于 0 的裁判旗回合上限');
                    return;
                }
                if (!f.energy.infinite) {
                    if (f.energy.maxNum < 1 || f.energy.initNum < 0) {
                        message.warning('能量参数不合法');
                        return;
                    }
                    if (f.energy.initNum > f.energy.maxNum) {
                        message.warning('初始能量不能大于能量上限');
                        return;
                    }
                }

                this.$store.commit('UPDATE_BATTLE_SETUP', JSON.parse(JSON.stringify(f)));
                message.success('战场配置已保存');
                this.$router.push(this.fromPath);
            },
            resetDefault() {
                this.form = defaultForm();
                this.$store.commit('RESET_BATTLE_SETUP');
                message.info('已恢复默认配置');
            },
        },
    };
</script>

<style lang="scss" scoped>
    .battle-setup {
        padding: 24px;
        box-sizing: border-box;

        .setup-card {
            max-width: 900px;
            margin: 0 auto;
        }

        .field-hint {
            color: #8c8c8c;
            font-size: 12px;
            margin-top: 4px;
            line-height: 1.6;
        }

        .inline-text {
            margin-left: 12px;
            color: #666;
            font-size: 13px;
        }

        .team-size-row {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;
        }

        .side-label {
            font-size: 13px;
            color: #666;
        }

        .side-label-left {
            color: #cf1322;
        }

        .side-label-right {
            color: #1890ff;
        }

        .vs-text {
            color: #8c8c8c;
            font-size: 13px;
            margin: 0 8px;
        }

        .preset-row {
            margin-top: 10px;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 8px;

            .preset-label {
                font-size: 13px;
                color: #666;
            }

            .preset-btn {
                font-size: 12px;
            }
        }
    }
</style>
