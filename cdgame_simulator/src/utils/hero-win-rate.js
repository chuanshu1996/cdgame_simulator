const STORAGE_KEY = 'hero-win-rate-stats';

export function getDefaultStats() {
    return {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        totalDamage: 0,
        totalDamageTaken: 0,
        totalOnmyojiFire: 0,
        totalHealing: 0,
        totalDamagePercentage: 0,
        totalDamageTakenPercentage: 0,
    };
}

export function loadStatsFromStorage() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Failed to load hero win rate stats from storage:', e);
    }
    return {};
}

export function saveStatsToStorage(stats) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {
        console.error('Failed to save hero win rate stats to storage:', e);
    }
}

export function calculateTotalTeamDamage(battleStats) {
    let totalDamage = 0;
    battleStats.forEach(stat => {
        totalDamage += stat.damage;
    });
    return totalDamage;
}

export function calculateTotalTeamDamageTaken(battleStats) {
    let totalDamageTaken = 0;
    battleStats.forEach(stat => {
        totalDamageTaken += stat.damageTaken;
    });
    return totalDamageTaken;
}

export function updateHeroWinRateStats(battleStats, winnerTeamName, loserTeamName, team0Name, team1Name, team0Stats, team1Stats) {
    const stats = loadStatsFromStorage();
    
    const team0TotalDamage = calculateTotalTeamDamage(team0Stats);
    const team1TotalDamage = calculateTotalTeamDamage(team1Stats);
    const team0TotalDamageTaken = calculateTotalTeamDamageTaken(team0Stats);
    const team1TotalDamageTaken = calculateTotalTeamDamageTaken(team1Stats);
    
    const heroStatsChanges = {};
    
    const isTeam0Winner = team0Name === winnerTeamName;
    
    // 收集两边的选手
    const team0HeroNames = new Set();
    const team1HeroNames = new Set();
    
    team0Stats.forEach(stat => {
        team0HeroNames.add(stat.name);
    });
    
    team1Stats.forEach(stat => {
        team1HeroNames.add(stat.name);
    });
    
    // 处理队伍0的选手
    team0Stats.forEach(stat => {
        const heroName = stat.name;
        const inBothTeams = team1HeroNames.has(heroName);
        
        if (!heroStatsChanges[heroName]) {
            heroStatsChanges[heroName] = {
                wasWinner: inBothTeams ? 'both' : isTeam0Winner,
                damage: 0,
                damageTaken: 0,
                onmyojiFire: 0,
                healing: 0,
                damagePercentage: 0,
                damageTakenPercentage: 0,
            };
        }
        heroStatsChanges[heroName].damage += stat.damage;
        heroStatsChanges[heroName].damageTaken += stat.damageTaken;
        heroStatsChanges[heroName].onmyojiFire += stat.onmyojiFireUsed || 0;
        heroStatsChanges[heroName].healing += stat.healing || 0;
        if (team0TotalDamage > 0) {
            heroStatsChanges[heroName].damagePercentage += (stat.damage / team0TotalDamage) * 100;
        }
        if (team0TotalDamageTaken > 0) {
            heroStatsChanges[heroName].damageTakenPercentage += (stat.damageTaken / team0TotalDamageTaken) * 100;
        }
    });
    
    // 处理队伍1的选手
    team1Stats.forEach(stat => {
        const heroName = stat.name;
        const inBothTeams = team0HeroNames.has(heroName);
        
        if (!heroStatsChanges[heroName]) {
            heroStatsChanges[heroName] = {
                wasWinner: inBothTeams ? 'both' : !isTeam0Winner,
                damage: 0,
                damageTaken: 0,
                onmyojiFire: 0,
                healing: 0,
                damagePercentage: 0,
                damageTakenPercentage: 0,
            };
        }
        heroStatsChanges[heroName].damage += stat.damage;
        heroStatsChanges[heroName].damageTaken += stat.damageTaken;
        heroStatsChanges[heroName].onmyojiFire += stat.onmyojiFireUsed || 0;
        heroStatsChanges[heroName].healing += stat.healing || 0;
        if (team1TotalDamage > 0) {
            heroStatsChanges[heroName].damagePercentage += (stat.damage / team1TotalDamage) * 100;
        }
        if (team1TotalDamageTaken > 0) {
            heroStatsChanges[heroName].damageTakenPercentage += (stat.damageTaken / team1TotalDamageTaken) * 100;
        }
    });
    
    Object.keys(heroStatsChanges).forEach(heroName => {
        if (!stats[heroName]) {
            stats[heroName] = getDefaultStats();
        }
        
        const change = heroStatsChanges[heroName];
        
        if (change.wasWinner === 'both') {
            // 选手在两边，算作1胜1负
            stats[heroName].totalMatches += 2;
            stats[heroName].wins += 1;
            stats[heroName].losses += 1;
        } else {
            stats[heroName].totalMatches += 1;
            
            if (change.wasWinner) {
                stats[heroName].wins += 1;
            } else {
                stats[heroName].losses += 1;
            }
        }
        
        stats[heroName].totalDamage += change.damage;
        stats[heroName].totalDamageTaken += change.damageTaken;
        stats[heroName].totalOnmyojiFire += change.onmyojiFire;
        stats[heroName].totalHealing += change.healing;
        stats[heroName].totalDamagePercentage += change.damagePercentage;
        stats[heroName].totalDamageTakenPercentage += change.damageTakenPercentage;
    });
    
    saveStatsToStorage(stats);
    
    return heroStatsChanges;
}

export function rollbackHeroWinRateStats(heroStatsChanges) {
    const stats = loadStatsFromStorage();
    
    Object.keys(heroStatsChanges).forEach(heroName => {
        if (!stats[heroName]) {
            return;
        }
        
        const change = heroStatsChanges[heroName];
        
        if (change.wasWinner === 'both') {
            // 选手在两边，回滚2场，1胜1负
            stats[heroName].totalMatches -= 2;
            stats[heroName].wins -= 1;
            stats[heroName].losses -= 1;
        } else {
            stats[heroName].totalMatches -= 1;
            
            if (change.wasWinner) {
                stats[heroName].wins -= 1;
            } else {
                stats[heroName].losses -= 1;
            }
        }
        
        stats[heroName].totalDamage -= change.damage;
        stats[heroName].totalDamageTaken -= change.damageTaken;
        stats[heroName].totalOnmyojiFire -= change.onmyojiFire;
        stats[heroName].totalHealing -= change.healing;
        stats[heroName].totalDamagePercentage -= change.damagePercentage;
        stats[heroName].totalDamageTakenPercentage -= change.damageTakenPercentage;
        
        if (stats[heroName].totalMatches <= 0) {
            delete stats[heroName];
        }
    });
    
    saveStatsToStorage(stats);
}
