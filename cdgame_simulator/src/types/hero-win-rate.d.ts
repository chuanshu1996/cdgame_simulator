declare module '*/hero-win-rate' {
    export function getDefaultStats(): any;
    export function loadStatsFromStorage(): any;
    export function saveStatsToStorage(stats: any): void;
    export function calculateTotalTeamDamage(battleStats: any[]): number;
    export function calculateTotalTeamDamageTaken(battleStats: any[]): number;
    export function updateHeroWinRateStats(
        battleStats: any,
        winnerTeamName: string,
        loserTeamName: string,
        team0Name: string,
        team1Name: string,
        team0Stats: any[],
        team1Stats: any[],
    ): Record<string, any>;
    export function rollbackHeroWinRateStats(heroStatsChanges: Record<string, any>): void;
}
