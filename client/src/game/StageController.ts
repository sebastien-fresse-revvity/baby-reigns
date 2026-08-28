import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Ellipse,
  Image,
  Rectangle,
  StackPanel,
  TextBlock,
  TextWrapping,
} from "@babylonjs/gui";
import { ACHIEVEMENTS, GameWorld } from "./GameWorld";
import { InputManager } from "./InputManager";
import { StorageService } from "./StorageService";
import type { ChoiceResult, ChoiceSide, GaugeKey, Metrics } from "./types";

const C = {
  ink: "#152542",
  midnight: "#0E1B35",
  cream: "#FFF8E7",
  butter: "#F7C948",
  lavender: "#B9A8E6",
  tomato: "#D8544B",
  sky: "#8CB9DC",
  softInk: "#52627B",
  pale: "#E7EDF7",
};

const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`;
const BACKGROUND_URL = `${ASSET_BASE}nursery-night.svg`;
const LOGO_URL = `${ASSET_BASE}logo.svg`;
const EVENT_IMAGE_BY_ID: Record<string, string> = {
  cacapocalypse: `${ASSET_BASE}event-diaper.svg`,
  doudou: `${ASSET_BASE}event-plush.svg`,
};

const GAUGES: Array<{ key: GaugeKey; label: string; symbol: string; color: string; inverse?: boolean }> = [
  { key: "sleep", label: "Sommeil", symbol: "◔", color: C.lavender },
  { key: "clean", label: "Propreté", symbol: "✦", color: C.butter },
  { key: "stress", label: "Stress", symbol: "!", color: C.tomato, inverse: true },
  { key: "stock", label: "Réserves", symbol: "□", color: C.sky },
];

function txt(name: string, value: string, size: number, color = C.ink, weight = "400") {
  const control = new TextBlock(name, value);
  control.color = color;
  control.fontFamily = "DM Sans, Arial, sans-serif";
  control.fontSize = size;
  control.fontWeight = weight;
  return control;
}

function heading(name: string, value: string, size: number, color = C.ink) {
  const control = txt(name, value, size, color, "700");
  control.fontFamily = "Fraunces, Georgia, serif";
  return control;
}

function panel(name: string, background: string, radius = 20) {
  const control = new Rectangle(name);
  control.background = background;
  control.thickness = 0;
  control.cornerRadius = radius;
  return control;
}

function actionButton(name: string, label: string, background: string, foreground: string) {
  const control = Button.CreateSimpleButton(name, label);
  control.height = "54px";
  control.background = background;
  control.color = foreground;
  control.cornerRadius = 15;
  control.thickness = 2;
  control.fontFamily = "DM Sans, Arial, sans-serif";
  control.fontSize = 16;
  control.fontWeight = "700";
  return control;
}

export class StageController {
  private readonly root = new Rectangle("stage-root");
  private readonly input: InputManager;
  private readonly mobile = window.innerWidth < 720;
  private timer: number | undefined;
  private card: Rectangle | null = null;
  private hint: TextBlock | null = null;
  private result: TextBlock | null = null;
  private gaugeViews = new Map<GaugeKey, { value: TextBlock; fill: Rectangle; frame: Rectangle }>();

  constructor(
    private readonly ui: AdvancedDynamicTexture,
    private readonly world: GameWorld,
    canvas: HTMLCanvasElement,
  ) {
    ui.idealWidth = this.mobile ? 640 : 1440;
    ui.renderAtIdealSize = true;
    ui.useSmallestIdeal = true;

    this.buildBackdrop();
    this.root.width = 1;
    this.root.height = 1;
    this.root.thickness = 0;
    ui.addControl(this.root);

    this.input = new InputManager(canvas, {
      choose: (side) => this.resolveChoice(side),
      preview: (side, progress) => this.previewChoice(side, progress),
      restart: () => {
        if (this.world.getMode() !== "PLAYING" && this.world.getMode() !== "RESOLVING") this.startGame();
      },
    });
    this.input.setActive(false);
    this.showTitle();
  }

  private buildBackdrop() {
    const background = new Image("nursery-night", BACKGROUND_URL);
    background.width = 1;
    background.height = 1;
    background.stretch = Image.STRETCH_FILL;
    this.ui.addControl(background);

    const wash = panel("night-wash", C.midnight, 0);
    wash.width = 1;
    wash.height = 1;
    wash.alpha = this.mobile ? 0.18 : 0.1;
    this.ui.addControl(wash);
  }

  private resetStage() {
    window.clearTimeout(this.timer);
    this.root.clearControls();
    this.card = null;
    this.hint = null;
    this.result = null;
    this.gaugeViews.clear();
  }

  private logo(name: string, size: number) {
    const logo = new Image(name, LOGO_URL);
    logo.width = `${size}px`;
    logo.height = `${size}px`;
    logo.stretch = Image.STRETCH_UNIFORM;
    return logo;
  }

  private showTitle() {
    this.resetStage();
    this.input.setActive(false);

    const shell = panel("title-shell", "#0E1B35E8", 32);
    shell.width = this.mobile ? "590px" : "760px";
    shell.height = this.mobile ? "700px" : "620px";
    shell.thickness = 2;
    shell.color = "#FFFFFF22";
    this.root.addControl(shell);

    const crest = this.logo("crest", this.mobile ? 92 : 108);
    crest.top = this.mobile ? "-250px" : "-215px";
    shell.addControl(crest);

    const kicker = txt("kicker", "UNE NUIT · QUATRE JAUGES · ZÉRO RÉPIT", this.mobile ? 12 : 15, C.butter, "700");
    kicker.top = this.mobile ? "-180px" : "-150px";
    shell.addControl(kicker);

    const title = heading("title", "Bébé Reigns", this.mobile ? 54 : 68, C.cream);
    title.top = this.mobile ? "-105px" : "-80px";
    shell.addControl(title);

    const subtitle = txt("subtitle", "La nuit des petits tyrans", this.mobile ? 21 : 25, C.pale, "600");
    subtitle.top = this.mobile ? "-46px" : "-15px";
    shell.addControl(subtitle);

    const description = txt(
      "description",
      "Swipez à gauche ou à droite. Gardez sommeil, propreté et réserves à flot, sans laisser le stress atteindre la mutinerie.",
      this.mobile ? 17 : 19,
      C.pale,
      "500",
    );
    description.width = this.mobile ? "500px" : "600px";
    description.height = "110px";
    description.top = this.mobile ? "50px" : "65px";
    description.textWrapping = TextWrapping.WordWrap;
    shell.addControl(description);

    const start = actionButton("start", "Entrer dans la nuit", C.butter, C.ink);
    start.width = this.mobile ? "430px" : "360px";
    start.top = "180px";
    start.onPointerUpObservable.add(() => this.startGame());
    shell.addControl(start);

    const stats = StorageService.stats();
    const record = StorageService.bestScore();
    const history = txt(
      "history",
      record > 0 || stats.games > 0
        ? `Record ${record.toLocaleString("fr-FR")} pts · ${stats.wins} aube${stats.wins > 1 ? "s" : ""} sauvée${stats.wins > 1 ? "s" : ""} · meilleure série ${stats.bestStreak}`
        : "Glissez · cliquez · utilisez les flèches",
      this.mobile ? 12 : 14,
      C.lavender,
      "700",
    );
    history.top = "250px";
    shell.addControl(history);
  }

  private startGame(seed?: number) {
    this.world.reset(seed);
    this.showGame();
  }

  private showGame() {
    this.resetStage();
    this.buildHud();
    this.buildCard();
    this.input.setActive(true);
  }

  private buildHud() {
    const hud = panel("hud", "#0E1B35EC", 24);
    hud.width = this.mobile ? "620px" : "1280px";
    hud.height = this.mobile ? "168px" : "120px";
    hud.top = "18px";
    hud.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    hud.thickness = 2;
    hud.color = "#FFFFFF22";
    this.root.addControl(hud);

    const logo = this.logo("hud-logo", this.mobile ? 40 : 48);
    logo.left = this.mobile ? "-276px" : "-600px";
    logo.top = this.mobile ? "-50px" : "-25px";
    hud.addControl(logo);

    const night = heading("night", `NUIT ${this.world.getNight()}`, this.mobile ? 20 : 24, C.cream);
    night.width = "150px";
    night.left = this.mobile ? "-205px" : "-520px";
    night.top = this.mobile ? "-50px" : "-24px";
    hud.addControl(night);

    const meta = txt("meta", `${this.world.getTimeLabel()} · décret ${this.world.getRound() + 1}/${this.world.getTotalRounds()}`, 13, C.lavender, "700");
    meta.width = "220px";
    meta.left = this.mobile ? "-180px" : "-490px";
    meta.top = this.mobile ? "-20px" : "12px";
    hud.addControl(meta);

    const grace = txt(
      "grace",
      `${this.world.getStreak() > 1 ? `Série ${this.world.getStreak()} ✦ · ` : ""}${this.world.isGraceAvailable() ? "Grâce ♛ prête" : "Grâce utilisée"}`,
      12,
      this.world.isGraceAvailable() ? C.butter : "#9AA8BC",
      "700",
    );
    grace.width = this.mobile ? "250px" : "300px";
    grace.left = this.mobile ? "165px" : "470px";
    grace.top = this.mobile ? "-48px" : "-20px";
    hud.addControl(grace);

    const row = new StackPanel("gauges");
    row.isVertical = false;
    row.width = this.mobile ? "594px" : "760px";
    row.height = "88px";
    row.top = this.mobile ? "35px" : "8px";
    row.left = this.mobile ? "0px" : "180px";
    hud.addControl(row);
    GAUGES.forEach((gauge) => row.addControl(this.createGauge(gauge)));
    this.refreshHud(this.world.getMetrics());
  }

  private createGauge(spec: (typeof GAUGES)[number]) {
    const frame = panel(`gauge-${spec.key}`, "#FFFFFF10", 14);
    frame.width = this.mobile ? "148px" : "184px";
    frame.height = this.mobile ? "74px" : "80px";
    frame.thickness = 1;
    frame.color = "#FFFFFF22";

    const caption = txt(`caption-${spec.key}`, `${spec.symbol} ${spec.label}`, this.mobile ? 11 : 13, C.pale, "700");
    caption.top = "-20px";
    frame.addControl(caption);

    const value = txt(`value-${spec.key}`, "0", this.mobile ? 20 : 23, C.cream, "700");
    value.top = "3px";
    frame.addControl(value);

    const track = panel(`track-${spec.key}`, "#FFFFFF22", 5);
    track.width = this.mobile ? "118px" : "150px";
    track.height = "9px";
    track.top = "27px";
    frame.addControl(track);

    const fill = panel(`fill-${spec.key}`, spec.color, 5);
    fill.height = "9px";
    fill.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    track.addControl(fill);
    this.gaugeViews.set(spec.key, { value, fill, frame });
    return frame;
  }

  private refreshHud(metrics: Metrics, previous?: Metrics) {
    GAUGES.forEach((spec) => {
      const view = this.gaugeViews.get(spec.key);
      if (!view) return;
      const metric = metrics[spec.key];
      const safeRatio = spec.inverse ? 1 - metric / 100 : metric / 100;
      view.value.text = String(metric);
      view.fill.width = `${Math.max(4, safeRatio * 100)}%`;
      const danger = spec.inverse ? metric >= 76 : metric <= 25;
      view.frame.color = danger ? C.tomato : "#FFFFFF22";
      view.frame.thickness = danger ? 2 : 1;
      if (previous && previous[spec.key] !== metric) view.value.color = metric > previous[spec.key] ? C.butter : C.lavender;
    });
  }

  private buildCard() {
    const event = this.world.currentEvent();
    const card = panel("event-card", C.cream, 30);
    card.width = this.mobile ? "600px" : "760px";
    card.height = this.mobile ? "610px" : "590px";
    card.top = this.mobile ? "100px" : "95px";
    card.thickness = 5;
    card.color = C.ink;
    card.isPointerBlocker = false;
    this.root.addControl(card);
    this.card = card;

    const category = txt("category", `DÉCRET IMPROMPTU · NUIT ${this.world.getNight()} · ${this.world.getTimeLabel()}`, this.mobile ? 11 : 13, C.tomato, "700");
    category.top = this.mobile ? "-268px" : "-250px";
    card.addControl(category);

    const eventImage = EVENT_IMAGE_BY_ID[event.id];
    if (eventImage) {
      const art = new Image("event-art", eventImage);
      art.width = this.mobile ? "112px" : "136px";
      art.height = this.mobile ? "112px" : "136px";
      art.top = this.mobile ? "-190px" : "-165px";
      art.stretch = Image.STRETCH_UNIFORM;
      card.addControl(art);
    } else {
      const art = new Ellipse("event-art");
      art.width = this.mobile ? "105px" : "128px";
      art.height = this.mobile ? "105px" : "128px";
      art.top = this.mobile ? "-190px" : "-165px";
      art.background = event.art.background;
      art.color = C.ink;
      art.thickness = 3;
      card.addControl(art);
      art.addControl(heading("event-glyph", event.art.glyph, this.mobile ? 52 : 66, event.art.color));
    }

    const title = heading("event-title", event.title, this.mobile ? 31 : 39, C.ink);
    title.width = this.mobile ? "520px" : "650px";
    title.height = "74px";
    title.top = this.mobile ? "-105px" : "-72px";
    title.textWrapping = TextWrapping.WordWrap;
    card.addControl(title);

    const story = txt("story", event.story, this.mobile ? 17 : 20, C.softInk, "500");
    story.width = this.mobile ? "500px" : "620px";
    story.height = this.mobile ? "100px" : "95px";
    story.top = this.mobile ? "-17px" : "18px";
    story.textWrapping = TextWrapping.WordWrap;
    card.addControl(story);

    this.hint = txt("hint", "Glissez pour entrevoir les conséquences", this.mobile ? 13 : 15, C.softInk, "700");
    this.hint.top = this.mobile ? "72px" : "94px";
    card.addControl(this.hint);

    const actions = new StackPanel("choices");
    actions.isVertical = this.mobile;
    actions.width = this.mobile ? "520px" : "680px";
    actions.height = this.mobile ? "122px" : "58px";
    actions.top = this.mobile ? "160px" : "170px";
    card.addControl(actions);

    const left = actionButton("left", `← ${this.shortLabel(event.left.label)}`, C.lavender, C.ink);
    left.width = this.mobile ? "510px" : "330px";
    left.onPointerUpObservable.add(() => this.resolveChoice("left"));
    actions.addControl(left);

    const spacer = new Rectangle("spacer");
    spacer.width = this.mobile ? "1px" : "20px";
    spacer.height = this.mobile ? "10px" : "1px";
    spacer.thickness = 0;
    actions.addControl(spacer);

    const right = actionButton("right", `${this.shortLabel(event.right.label)} →`, C.butter, C.ink);
    right.width = this.mobile ? "510px" : "330px";
    right.onPointerUpObservable.add(() => this.resolveChoice("right"));
    actions.addControl(right);

    this.result = txt("result", "", this.mobile ? 13 : 15, C.cream, "700");
    this.result.width = this.mobile ? "590px" : "760px";
    this.result.height = "70px";
    this.result.top = this.mobile ? "360px" : "360px";
    this.result.textWrapping = TextWrapping.WordWrap;
    this.root.addControl(this.result);
  }

  private shortLabel(label: string) {
    if (!this.mobile || label.length <= 34) return label;
    return `${label.slice(0, 32).trimEnd()}…`;
  }

  private effectLabel(effects: Partial<Metrics>) {
    const labels: Record<GaugeKey, string> = { sleep: "Sommeil", clean: "Propreté", stress: "Stress", stock: "Stock" };
    return (Object.keys(effects) as GaugeKey[])
      .filter((key) => (effects[key] ?? 0) !== 0)
      .map((key) => {
        const delta = effects[key] ?? 0;
        const arrow = delta > 0 ? (Math.abs(delta) >= 14 ? "↑↑" : "↑") : Math.abs(delta) >= 14 ? "↓↓" : "↓";
        return `${labels[key]} ${arrow}`;
      })
      .join(" · ");
  }

  private previewChoice(side: ChoiceSide | null, progress: number) {
    if (!this.card || this.world.getMode() !== "PLAYING") return;
    this.card.left = side === "left" ? `${-progress * 48}px` : side === "right" ? `${progress * 48}px` : "0px";
    this.card.rotation = side === "left" ? -progress * 0.04 : side === "right" ? progress * 0.04 : 0;
    if (!this.hint) return;
    if (!side) {
      this.hint.text = "Glissez pour entrevoir les conséquences";
      this.hint.color = C.softInk;
      return;
    }
    const effects = this.world.previewEffects(side);
    this.hint.text = this.effectLabel(effects);
    const dangerous = (Object.keys(effects) as GaugeKey[]).some((key) => {
      const delta = effects[key] ?? 0;
      return (key === "stress" ? delta > 0 : delta < 0) && Math.abs(delta) >= 12;
    });
    this.hint.color = dangerous ? C.tomato : C.softInk;
  }

  private deltaLabel(previous: Metrics, metrics: Metrics) {
    const labels: Record<GaugeKey, string> = { sleep: "SOM", clean: "PROP", stress: "STR", stock: "STOCK" };
    return (["sleep", "clean", "stress", "stock"] as GaugeKey[])
      .map((key) => {
        const delta = metrics[key] - previous[key];
        return `${labels[key]} ${delta > 0 ? "+" : ""}${delta}`;
      })
      .join(" · ");
  }

  private resolveChoice(side: ChoiceSide) {
    const result = this.world.choose(side);
    if (!result) return;
    this.input.setActive(false);
    this.previewChoice(null, 0);
    this.refreshHud(result.metrics, result.previous);
    if (this.result) {
      this.result.text = `${result.choice.consequence}${result.rescued ? "  ♛ Grâce royale !" : ""}\n${this.deltaLabel(result.previous, result.metrics)}`;
      this.result.color = result.rescued ? C.butter : C.cream;
    }
    this.timer = window.setTimeout(() => {
      if (result.mode === "GAME_OVER") this.showEnding(false, result);
      else if (result.mode === "VICTORY") this.showEnding(true, result);
      else this.showGame();
    }, 1100);
  }

  private showEnding(won: boolean, result: ChoiceResult) {
    this.resetStage();
    this.input.setActive(false);

    const shell = panel("ending", won ? "#FFF8E7F2" : "#0E1B35F2", 32);
    shell.width = this.mobile ? "600px" : "850px";
    shell.height = "620px";
    shell.thickness = 4;
    shell.color = won ? C.ink : "#FFFFFF33";
    this.root.addControl(shell);

    const icon = this.logo("ending-logo", this.mobile ? 74 : 88);
    icon.top = "-225px";
    shell.addControl(icon);

    const title = heading("ending-title", won ? "L’aube est sauvée" : "Le royaume chancelle", this.mobile ? 38 : 50, won ? C.ink : C.cream);
    title.top = "-150px";
    shell.addControl(title);

    const copy = txt("ending-copy", won ? "Le petit tyran dort. Déposez la couronne quelques minutes." : result.cause ?? "Le royaume réclame une pause.", this.mobile ? 17 : 20, won ? C.softInk : C.pale, "500");
    copy.width = this.mobile ? "500px" : "650px";
    copy.height = "80px";
    copy.top = "-80px";
    copy.textWrapping = TextWrapping.WordWrap;
    shell.addControl(copy);

    const score = heading("score", `${result.score.toLocaleString("fr-FR")} points`, this.mobile ? 30 : 38, won ? C.ink : C.cream);
    score.top = "10px";
    shell.addControl(score);

    const metrics = txt("ending-metrics", `Sommeil ${result.metrics.sleep} · Propreté ${result.metrics.clean} · Stress ${result.metrics.stress} · Stock ${result.metrics.stock}`, this.mobile ? 12 : 15, won ? C.ink : C.pale, "700");
    metrics.top = "70px";
    shell.addControl(metrics);

    const unlocked = new Set(StorageService.achievements());
    const achievements = txt("achievements", ACHIEVEMENTS.map((achievement) => `${unlocked.has(achievement.id) ? achievement.symbol : "·"} ${achievement.name}`).join("   "), this.mobile ? 11 : 14, won ? C.softInk : C.lavender, "700");
    achievements.width = this.mobile ? "540px" : "720px";
    achievements.top = "125px";
    shell.addControl(achievements);

    const retry = actionButton("retry", won ? "Une autre nuit" : "Reprendre le royaume", won ? C.ink : C.butter, won ? C.cream : C.ink);
    retry.width = this.mobile ? "340px" : "380px";
    retry.top = "195px";
    retry.onPointerUpObservable.add(() => this.startGame());
    shell.addControl(retry);

    const home = txt("home", "Retour à l’accueil", 15, won ? C.softInk : C.pale, "700");
    home.top = "255px";
    home.isPointerBlocker = true;
    home.onPointerUpObservable.add(() => this.showTitle());
    shell.addControl(home);
  }

  startDemo() {
    this.startGame(42);
    const decisions: ChoiceSide[] = ["right", "left", "left", "right", "left", "right", "left", "left", "right", "left", "right", "left"];
    let index = 0;
    const next = () => {
      if (this.world.getMode() !== "PLAYING" || index >= decisions.length) return;
      this.resolveChoice(decisions[index]);
      index += 1;
      this.timer = window.setTimeout(next, 1600);
    };
    this.timer = window.setTimeout(next, 900);
  }

  showDemoEnding(won: boolean) {
    this.showEnding(won, {
      choice: { label: "Décret de démonstration", consequence: "La cour a rendu son verdict.", effects: {} },
      effectiveEffects: {},
      metrics: won ? { sleep: 72, clean: 69, stress: 27, stock: 42 } : { sleep: 18, clean: 31, stress: 100, stock: 22 },
      previous: { sleep: 30, clean: 31, stress: 84, stock: 22 },
      mode: won ? "VICTORY" : "GAME_OVER",
      cause: won ? undefined : "Le parent a atteint la limite du décret. Pause royale obligatoire.",
      score: won ? 2374 : 1125,
      round: won ? 12 : 7,
      night: won ? 3 : 2,
      streak: won ? 4 : 0,
      graceAvailable: !won,
      rescued: false,
      unlocked: won ? ["survivant"] : [],
    });
  }

  dispose() {
    window.clearTimeout(this.timer);
    this.input.dispose();
    this.root.dispose();
  }
}
