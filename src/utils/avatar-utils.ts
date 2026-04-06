import { HeroData } from '../../core';

const avatarCache = new Map<string, string>();
let heroDataLoaded = false;

function initHeroData(): void {
    if (heroDataLoaded) return;
    try {
        if (!HeroData || !Array.isArray(HeroData)) {
            console.warn('[AvatarUtils] hero-data.ts 加载失败或格式错误');
            heroDataLoaded = true;
            return;
        }
        heroDataLoaded = true;
    } catch (e) {
        console.error('[AvatarUtils] hero-data.ts 解析错误:', e);
        heroDataLoaded = true;
    }
}

function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^\w\u4e00-\u9fa5]/g, '');
}

export function getAvatarPathByName(name: string | undefined, no: number | string | undefined): string {
    initHeroData();
    
    if (!name && !no) {
        return '/avatar/99.png';
    }
    
    const cacheKey = `${name}_${no}`;
    if (avatarCache.has(cacheKey)) {
        return avatarCache.get(cacheKey)!;
    }
    
    let avatarPath = '/avatar/99.png';
    
    try {
        if (name) {
            avatarPath = `/avatar/${name}.png`;
        } else if (no) {
            avatarPath = `/avatar/${no}.png`;
        }
    } catch (e) {
        console.warn('[AvatarUtils] 获取头像路径失败:', e);
        if (no) {
            avatarPath = `/avatar/${no}.png`;
        }
    }
    
    avatarCache.set(cacheKey, avatarPath);
    return avatarPath;
}

export function getAvatarPathByNo(no: number | string | undefined): string {
    initHeroData();
    
    if (!no) {
        return '/avatar/99.png';
    }
    
    if (avatarCache.has(`_${no}`)) {
        return avatarCache.get(`_${no}`)!;
    }
    
    let avatarPath = '/avatar/99.png';
    
    try {
        if (HeroData && Array.isArray(HeroData)) {
            const hero = HeroData.find(h => h && (h.no === no || String(h.no) === String(no) || Number(h.no) === Number(no)));
            
            if (hero && hero.name) {
                avatarPath = `/avatar/${hero.name}.png`;
            } else {
                avatarPath = `/avatar/${no}.png`;
            }
        } else {
            avatarPath = `/avatar/${no}.png`;
        }
    } catch (e) {
        console.warn('[AvatarUtils] 根据no获取头像路径失败:', e);
        avatarPath = `/avatar/${no}.png`;
    }
    
    avatarCache.set(`_${no}`, avatarPath);
    return avatarPath;
}

export function clearAvatarCache(): void {
    avatarCache.clear();
}

export default {
    getAvatarPathByName,
    getAvatarPathByNo,
    clearAvatarCache
};
