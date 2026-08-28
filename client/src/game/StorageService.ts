// Direction « Monarchie en pyjama » : la mémoire locale conserve les petites victoires, sans compte ni données distantes.
import type { AchievementId, GameStats } from "./types";

const SCORE_KEY = "bebe-reigns-best-score";
const ACHIEVEMENTS_KEY = "bebe-reigns-achievements";
const STATS_KEY = "bebe-reigns-stats-v2";

function readNumber(key: string) {
  const value = Number(window.localStorage.getItem(key) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function safeStats(): GameStats {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STATS_KEY) ?? "{}");
    return {
      games: Number.isFinite(parsed.games) ? Math.max(0, parsed.games) : 0,
      wins: Number.isFinite(parsed.wins) ? Math.max(0, parsed.wins) : 0,
      bestStreak: Number.isFinite(parsed.bestStreak) ? Math.max(0, parsed.bestStreak) : 0,
    };
  } catch {
    return { games: 0, wins: 0, bestStreak: 0 };
  }
}

export const StorageService = {
  bestScore() {
    return readNumber(SCORE_KEY);
  },
  saveBestScore(score: number) {
    const best = Math.max(score, readNumber(SCORE_KEY));
    window.localStorage.setItem(SCORE_KEY, String(best));
    return best;
  },
  achievements(): AchievementId[] {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(ACHIEVEMENTS_KEY) ?? "[]");
      return Array.isArray(parsed) ? (parsed as AchievementId[]) : [];
    } catch {
      return [];
    }
  },
  unlock(ids: AchievementId[]) {
    const current = new Set(this.achievements());
    const newIds = ids.filter((id) => !current.has(id));
    newIds.forEach((id) => current.add(id));
    window.localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(Array.from(current)));
    return newIds;
  },
  stats() {
    return safeStats();
  },
  recordGame(won: boolean, streak: number) {
    const current = safeStats();
    const next: GameStats = {
      games: current.games + 1,
      wins: current.wins + (won ? 1 : 0),
      bestStreak: Math.max(current.bestStreak, streak),
    };
    window.localStorage.setItem(STATS_KEY, JSON.stringify(next));
    return next;
  },
};
