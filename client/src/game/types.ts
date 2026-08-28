// Direction « Monarchie en pyjama » : les données privilégient des dilemmes lisibles, rejouables et des conséquences perceptibles.
export type GaugeKey = "sleep" | "clean" | "stress" | "stock";

export type Metrics = Record<GaugeKey, number>;

export type ChoiceSide = "left" | "right";

export type Choice = {
  label: string;
  consequence: string;
  effects: Partial<Metrics>;
};

export type EventArt = {
  glyph: string;
  color: string;
  background: string;
};

export type GameEvent = {
  id: string;
  title: string;
  story: string;
  art: EventArt;
  minNight?: 1 | 2 | 3;
  left: Choice;
  right: Choice;
};

export type GameMode = "TITLE" | "PLAYING" | "RESOLVING" | "GAME_OVER" | "VICTORY";

export type AchievementId = "survivant" | "parent-zen" | "macgyver" | "bebe-roi";

export type Achievement = {
  id: AchievementId;
  name: string;
  detail: string;
  symbol: string;
};

export type GameStats = {
  games: number;
  wins: number;
  bestStreak: number;
};

export type ChoiceResult = {
  choice: Choice;
  effectiveEffects: Partial<Metrics>;
  metrics: Metrics;
  previous: Metrics;
  mode: GameMode;
  cause?: string;
  score: number;
  round: number;
  night: number;
  streak: number;
  graceAvailable: boolean;
  rescued: boolean;
  unlocked: AchievementId[];
};
