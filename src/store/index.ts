import Vue from 'vue';
import Vuex from 'vuex';
import { HeroData, HeroBuilders } from '../../core';
import {sampleSize} from 'lodash';
import CryptoJS from 'crypto-js';

Vue.use(Vuex);

const ENCRYPTION_KEY = 'cdgame-record-secret-key-2024';
const ADMIN_PASSWORD_HASH = '4f323fde03b2d593d6988bb02ab0b7b7';
const ADMIN_TOKEN_KEY = 'cdgame_admin_token';

function hashPassword(password: string) {
    return CryptoJS.MD5(password).toString();
}

function loadAdminToken(): boolean {
    try {
        const token = localStorage.getItem(ADMIN_TOKEN_KEY);
        if (token) {
            const data = CryptoJS.AES.decrypt(token, ENCRYPTION_KEY);
            const parsed = JSON.parse(data.toString(CryptoJS.enc.Utf8));
            if (parsed && parsed.hash === ADMIN_PASSWORD_HASH) {
                return true;
            }
        }
    } catch (e) {
        console.error('加载管理员令牌失败:', e);
    }
    return false;
}

function saveAdminToken() {
    try {
        const token = CryptoJS.AES.encrypt(
            JSON.stringify({ 
                loginTime: Date.now(),
                hash: ADMIN_PASSWORD_HASH 
            }), 
            ENCRYPTION_KEY
        ).toString();
        localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } catch (e) {
        console.error('保存管理员令牌失败:', e);
    }
}

function clearAdminToken() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function verifyAdminPassword(password: string): boolean {
    const hashedInput = hashPassword(password);
    return hashedInput === ADMIN_PASSWORD_HASH;
}

function data2myData(data: any) {
    if (!data) return {};
    return {
        no: Number(data.id),
        name: data.name,
        max_hp: Number(data.hp),
        atk: Number(data.atk),
        def: Number(data.def),
        spd: Number(data.spd),
        cri: Number(data.cri),
        cri_dmg: Number(data.cri_dmg),
        eft_hit: Number(data.eft_hit) || 0,
        eft_res: Number(data.eft_res) || 0,
        waitInput: false,
        index: 0
    };
}

// 只选择已实现技能的角色
const implementedHeroList = HeroData
    .filter(data => HeroBuilders.has(Number(data.id)))
    .map(data => data2myData(data));

// 处理边界情况：如果没有已实现技能的角色，使用所有角色
const heroList = implementedHeroList.length > 0 ? implementedHeroList : HeroData.map(data => data2myData(data));

// 确保队伍总是有8个角色（教练、先锋、次锋、中坚、副将、大将、替补、应援）
function getTeamMembers(list: any[], teamId: number) {
    const members: any[] = [];
    const listLength = list.length;
    
    if (listLength === 0) {
        // 如果没有可用角色，返回空对象数组
        for (let i = 0; i < 8; i++) {
            members.push({teamId, waitInput: false});
        }
    } else if (listLength >= 8) {
        // 如果可用角色足够，随机选择8个
        const shuffled = [...list].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 8; i++) {
            members.push(Object.assign({teamId, waitInput: false}, shuffled[i]));
        }
    } else {
        // 如果可用角色不足，随机选择并循环使用
        const shuffled = [...list].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 8; i++) {
            const index = i % listLength;
            members.push(Object.assign({teamId, waitInput: false}, shuffled[index]));
        }
    }
    
    return members;
}

// 从本地存储读取状态
function loadState() {
    try {
        const savedState = localStorage.getItem('omj_team_state');
        if (savedState) {
            return JSON.parse(savedState);
        }
    } catch (error) {
        console.warn('Failed to load state from localStorage:', error);
    }
    return null;
}

// 保存状态到本地存储
function saveState(state: any) {
    try {
        localStorage.setItem('omj_team_state', JSON.stringify(state));
    } catch (error) {
        console.warn('Failed to save state to localStorage:', error);
    }
}

// 初始化状态
const savedState = loadState();

// 将旧的 soulSelections 格式转换为新格式（单个 soulId 转为数组）
function convertSoulSelections(oldSelections: any) {
    if (!oldSelections) {
        return {
            0: [[], [], [], [], [], [], [], []],
            1: [[], [], [], [], [], [], [], []],
        };
    }
    
    // 检查是否已经是新格式（数组）
    const team0 = oldSelections[0] || [];
    const team1 = oldSelections[1] || [];
    
    // 如果第一个元素是数组，说明已经是新格式
    if (Array.isArray(team0[0])) {
        // 确保有8个位置
        while (team0.length < 8) team0.push([]);
        while (team1.length < 8) team1.push([]);
        return oldSelections;
    }
    
    // 否则转换为新格式
    const newTeam0 = team0.map((soulId: string | null) => soulId ? [soulId] : []);
    const newTeam1 = team1.map((soulId: string | null) => soulId ? [soulId] : []);
    
    // 确保有8个位置
    while (newTeam0.length < 8) newTeam0.push([]);
    while (newTeam1.length < 8) newTeam1.push([]);
    
    return {
        0: newTeam0,
        1: newTeam1,
    };
}

// 确保队伍数据有8个位置
function ensureTeamSize(team: any[], teamId: number) {
    if (!team || team.length < 8) {
        const newTeam = team ? [...team] : [];
        while (newTeam.length < 8) {
            newTeam.push({teamId, waitInput: false});
        }
        return newTeam;
    }
    return team;
}

// 确保maxedStatus有8个位置
function ensureMaxedStatusSize(status: boolean[]) {
    if (!status || status.length < 8) {
        const newStatus = status ? [...status] : [];
        while (newStatus.length < 8) {
            newStatus.push(false);
        }
        return newStatus;
    }
    return status;
}

const initialState = {
    team0: ensureTeamSize(savedState?.team0, 0) || getTeamMembers(heroList, 0),
    team1: ensureTeamSize(savedState?.team1, 1) || getTeamMembers(heroList, 1),
    team0Name: savedState?.team0Name || '红队',
    team1Name: savedState?.team1Name || '蓝队',
    maxedStatus: {
        0: ensureMaxedStatusSize(savedState?.maxedStatus?.[0]) || [false, false, false, false, false, false, false, false],
        1: ensureMaxedStatusSize(savedState?.maxedStatus?.[1]) || [false, false, false, false, false, false, false, false],
    },
    soulSelections: convertSoulSelections(savedState?.soulSelections),
    isAdminLoggedIn: loadAdminToken(),
    isOfficialMatch: savedState?.isOfficialMatch || false,
};

export default new Vuex.Store({
    state: initialState,
    mutations: {
        UPDATE_TEAM_MEMBER(state, data) {
            const team = data.teamId === 0 ? state.team0 : state.team1;
            const current = team[data.index];
            
            let newData;
            if (data.no !== undefined && Object.keys(data).length <= 3) {
                const heroNo = Number(data.no);
                const hero = HeroData.find(d => Number(d.id) === heroNo || String(d.id) === String(data.no));
                if (!hero) {
                    console.warn('未找到选手:', data.no);
                    return;
                }
                newData = Object.assign(
                    {teamId: data.teamId, waitInput: false},
                    data2myData(hero),
                    data
                );
            } else {
                newData = Object.assign({}, current, data);
            }
            
            if (data.teamId === 0) {
                Vue.set(state.team0, data.index, newData);
            }
            if (data.teamId === 1) {
                Vue.set(state.team1, data.index, newData);
            }
            
            // 保存状态到本地存储
            saveState(state);
        },
        TOGGLE_MAXED(state, payload: { teamId: 0 | 1; index: number }) {
            const teamId = payload.teamId;
            const index = payload.index;
            const current = state.maxedStatus[teamId][index];
            Vue.set(state.maxedStatus[teamId], index, !current);
            
            // 保存状态到本地存储
            saveState(state);
        },
        UPDATE_SOUL_SELECTION(state, payload: { teamId: 0 | 1; index: number; soulIds: string[] }) {
            const { teamId, index, soulIds } = payload;
            // 限制最多3个御魂
            const limitedSoulIds = soulIds.slice(0, 3);
            Vue.set(state.soulSelections[teamId], index, limitedSoulIds);
            
            // 保存状态到本地存储
            saveState(state);
        },
        ADD_SOUL(state, payload: { teamId: 0 | 1; index: number; soulId: string }) {
            const { teamId, index, soulId } = payload;
            const currentSouls = state.soulSelections[teamId][index] || [];
            
            // 检查是否已达到上限（3个）
            if (currentSouls.length >= 3) {
                return;
            }
            
            // 检查是否已存在该御魂
            if (currentSouls.includes(soulId)) {
                return;
            }
            
            // 添加新御魂
            const newSouls = [...currentSouls, soulId];
            Vue.set(state.soulSelections[teamId], index, newSouls);
            
            // 保存状态到本地存储
            saveState(state);
        },
        REMOVE_SOUL(state, payload: { teamId: 0 | 1; index: number; soulId: string }) {
            const { teamId, index, soulId } = payload;
            const currentSouls = state.soulSelections[teamId][index] || [];
            
            // 移除指定御魂
            const newSouls = currentSouls.filter((id: string) => id !== soulId);
            Vue.set(state.soulSelections[teamId], index, newSouls);
            
            // 保存状态到本地存储
            saveState(state);
        },
        REORDER_SOULS(state, payload: { teamId: 0 | 1; index: number; soulIds: string[] }) {
            const { teamId, index, soulIds } = payload;
            Vue.set(state.soulSelections[teamId], index, soulIds);
            
            // 保存状态到本地存储
            saveState(state);
        },
        UPDATE_TEAM_NAME(state, payload: { teamId: 0 | 1; name: string }) {
            const { teamId, name } = payload;
            if (teamId === 0) {
                state.team0Name = name;
            } else {
                state.team1Name = name;
            }
            
            // 保存状态到本地存储
            saveState(state);
        },
        ADMIN_LOGIN(state, password: string) {
            if (verifyAdminPassword(password)) {
                state.isAdminLoggedIn = true;
                saveAdminToken();
            }
        },
        ADMIN_LOGOUT(state) {
            state.isAdminLoggedIn = false;
            clearAdminToken();
        },
        SET_OFFICIAL_MATCH(state, isOfficial: boolean) {
            state.isOfficialMatch = isOfficial;
            saveState(state);
        },
    },
    actions: {},
    modules: {},
});
