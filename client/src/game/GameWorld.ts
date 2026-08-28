// Direction « Monarchie en pyjama » : un état explicite transforme chaque décret en conséquences compréhensibles, tendues et rejouables.
import { EVENTS } from "./events";
import { StorageService } from "./StorageService";
import type { Achievement, AchievementId, Choice, ChoiceResult, ChoiceSide, GameEvent, GameMode, GaugeKey, Metrics } from "./types";

const INITIAL_METRICS: Metrics = { sleep: 66, clean: 62, stress: 34, stock: 64 };
const TOTAL_ROUNDS = 12;
const SAFE_LOW = 30;
const SAFE_STRESS = 70;

export const ACHIEVEMENTS: Achievement[] = [
  { id: "survivant", name: "Survivant", detail: "Traverser la nuit jusqu’à l’aube.", symbol: "◈" },
  { id: "parent-zen", name: "Parent zen", detail: "Maintenir le stress sous 30 après une relève.", symbol: "◌" },
  { id: "macgyver", name: "MacGyver", detail: "Reprendre pied après être passé sous 25 ressources.", symbol: "⌘" },
  { id: "bebe-roi", name: "Bébé roi", detail: "Conserver 80 de sommeil après huit décisions.", symbol: "♛" },
];

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const isHarmful = (key: GaugeKey, delta: number) => (key === "stress" ? delta > 0 : delta < 0);
const signedSeed = (seed: number) => (seed >>> 0) || 0x6d2b79f5;

export class GameWorld {
  private metrics: Metrics = { ...INITIAL_METRICS };
  private round = 0;
  private mode: GameMode = "TITLE";
  private lowStockMoment = false;
  private streak = 0;
  private bestStreak = 0;
  private graceAvailable = true;
  private rngState = signedSeed(Date.now());
  private selectedEvent: GameEvent | null = null;
  private readonly usedEventIds = new Set<string>();

  reset(seed = Date.now()) {
    this.metrics = { ...INITIAL_METRICS };
    this.round = 0;
    this.mode = "PLAYING";
    this.lowStockMoment = false;
    this.streak = 0;
    this.bestStreak = 0;
    this.graceAvailable = true;
    this.rngState = signedSeed(seed);
    this.selectedEvent = null;
    this.usedEventIds.clear();
  }

  getMetrics() {
    return { ...this.metrics };
  }

  getRound() {
    return this.round;
  }

  getTotalRounds() {
    return TOTAL_ROUNDS;
  }

  getNight() {
    return Math.min(3, Math.floor(this.round / 4) + 1);
  }

  getTimeLabel() {
    const totalMinutes = 20 + this.round * 30;
    const hour = Math.floor(totalMinutes / 60);
    const minute = totalMinutes % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  getMode() {
    return this.mode;
  }

  getStreak() {
    return this.streak;
  }

  isGraceAvailable() {
    return this.graceAvailable;
  }

  currentEvent(): GameEvent {
    if (!this.selectedEvent) this.selectedEvent = this.pickEvent();
    return this.selectedEvent;
  }

  previewEffects(side: ChoiceSide): Partial<Metrics> {
    const event = this.currentEvent();
    return this.scaledEffects(event[side]);
  }

  getScore() {
    const reserves = this.metrics.sleep + this.metrics.clean + this.metrics.stock + (100 - this.metrics.stress);
    const safeGauges = [this.metrics.sleep, this.metrics.clean, this.metrics.stock].filter((value) => value >= SAFE_LOW).length + (this.metrics.stress <= SAFE_STRESS ? 1 : 0);
    const gracePenalty = this.graceAvailable ? 0 : 125;
    return Math.max(0, Math.round(this.round * 145 + reserves * 2.5 + this.bestStreak * 45 + safeGauges * 25 - gracePenalty));
  }

  choose(side: ChoiceSide): ChoiceResult | null {
    if (this.mode !== "PLAYING") return null;

    this.mode = "RESOLVING";
    const current = this.currentEvent();
    const choice = current[side];
    const previous = this.getMetrics();
    const effectiveEffects = this.scaledEffects(choice);

    this.applyEffects(effectiveEffects);
    this.usedEventIds.add(current.id);
    this.selectedEvent = null;
    this.round += 1;
    this.applyNightPressure();

    if (this.metrics.stock <= 24) this.lowStockMoment = true;

    let rescued = false;
    let cause = this.failureCause();
    if (cause && this.graceAvailable) {
      rescued = true;
      this.graceAvailable = false;
      this.applyRoyalGrace();
      cause = this.failureCause();
    }

    this.updateStreak(rescued);

    if (cause) this.mode = "GAME_OVER";
    else if (this.round >= TOTAL_ROUNDS) this.mode = "VICTORY";
    else this.mode = "PLAYING";

    const candidateAchievements = this.achievementCandidates();
    const unlocked = StorageService.unlock(candidateAchievements);
    const score = this.getScore();
    if (this.mode === "GAME_OVER" || this.mode === "VICTORY") {
      StorageService.saveBestScore(score);
      StorageService.recordGame(this.mode === "VICTORY", this.bestStreak);
    }

    return {
      choice,
      effectiveEffects,
      metrics: this.getMetrics(),
      previous,
      mode: this.mode,
      cause,
      score,
      round: this.round,
      night: this.getNight(),
      streak: this.streak,
      graceAvailable: this.graceAvailable,
      rescued,
      unlocked,
    };
  }

  private nextRandom() {
    // Mulberry32 : très léger, déterministe pour ?demo et bien réparti même avec des seeds voisines.
    this.rngState = (this.rngState + 0x6d2b79f5) >>> 0;
    let value = this.rngState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  }

  private pickEvent() {
    const night = this.getNight();
    const eligible = EVENTS.filter((event) => (event.minNight ?? 1) <= night && !this.usedEventIds.has(event.id));
    const pool = eligible.length > 0 ? eligible : EVENTS.filter((event) => (event.minNight ?? 1) <= night);
    const weighted = pool.map((event) => ({ event, weight: this.eventWeight(event, night) }));
    const total = weighted.reduce((sum, candidate) => sum + candidate.weight, 0);
    let cursor = this.nextRandom() * total;

    for (const candidate of weighted) {
      cursor -= candidate.weight;
      if (cursor <= 0) return candidate.event;
    }
    return weighted[weighted.length - 1]?.event ?? EVENTS[0];
  }

  private eventWeight(event: GameEvent, night: number) {
    let weight = (event.minNight ?? 1) === night ? 1.7 : 1;
    const critical: Array<[GaugeKey, boolean]> = [
      ["sleep", this.metrics.sleep < 34],
      ["clean", this.metrics.clean < 34],
      ["stock", this.metrics.stock < 34],
      ["stress", this.metrics.stress > 66],
    ];

    for (const [key, active] of critical) {
      if (!active) continue;
      const left = event.left.effects[key] ?? 0;
      const right = event.right.effects[key] ?? 0;
      const rescue = key === "stress" ? Math.min(left, right) < 0 : Math.max(left, right) > 0;
      const bothHarmful = isHarmful(key, left) && isHarmful(key, right);
      if (rescue) weight += 2.5;
      if (bothHarmful) weight *= 0.35;
    }

    return Math.max(0.15, weight);
  }

  private scaledEffects(choice: Choice) {
    const night = this.getNight();
    const harmfulMultiplier = 1 + (night - 1) * 0.18;
    const helpfulMultiplier = 1 - (night - 1) * 0.07;
    const effects: Partial<Metrics> = {};

    (Object.keys(choice.effects) as GaugeKey[]).forEach((key) => {
      const delta = choice.effects[key] ?? 0;
      const multiplier = isHarmful(key, delta) ? harmfulMultiplier : helpfulMultiplier;
      effects[key] = Math.round(delta * multiplier);
    });
    return effects;
  }

  private applyEffects(effects: Partial<Metrics>) {
    (Object.keys(effects) as GaugeKey[]).forEach((key) => {
      this.metrics[key] = clamp(this.metrics[key] + (effects[key] ?? 0));
    });
  }

  private applyNightPressure() {
    if (this.round === 4) this.applyEffects({ sleep: -5, stress: 5 });
    if (this.round === 8) this.applyEffects({ sleep: -8, stress: 8, stock: -5 });
  }

  private applyRoyalGrace() {
    // Une seule seconde chance par partie : elle évite une défaite brutale, sans remettre les jauges dans le confort.
    this.metrics.sleep = Math.max(8, this.metrics.sleep);
    this.metrics.clean = Math.max(8, this.metrics.clean);
    this.metrics.stock = Math.max(8, this.metrics.stock);
    this.metrics.stress = Math.min(92, this.metrics.stress);
  }

  private updateStreak(rescued: boolean) {
    const balanced = this.metrics.sleep >= SAFE_LOW && this.metrics.clean >= SAFE_LOW && this.metrics.stock >= SAFE_LOW && this.metrics.stress <= SAFE_STRESS;
    this.streak = !rescued && balanced ? this.streak + 1 : 0;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
  }

  private failureCause() {
    if (this.metrics.sleep <= 0) return "Le souverain n’a plus une once de sommeil. La révolte est totale.";
    if (this.metrics.clean <= 0) return "Le royaume est submergé. Même les bavoirs demandent l’asile.";
    if (this.metrics.stock <= 0) return "Les réserves sont épuisées. La cour réclame couches et biberons.";
    if (this.metrics.stress >= 100) return "Le parent a atteint la limite du décret. Pause royale obligatoire.";
    return undefined;
  }

  private achievementCandidates(): AchievementId[] {
    const candidates: AchievementId[] = [];
    if (this.mode === "VICTORY") candidates.push("survivant");
    if (this.round >= 4 && this.metrics.stress <= 30) candidates.push("parent-zen");
    if (this.lowStockMoment && this.metrics.stock >= 34) candidates.push("macgyver");
    if (this.round >= 8 && this.metrics.sleep >= 80) candidates.push("bebe-roi");
    return candidates;
  }
}
