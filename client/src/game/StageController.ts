// Direction « Monarchie en pyjama » : une scène Babylon lisible, tactile et responsive autour des décrets nocturnes.
import {
  AdvancedDynamicTexture,
  Button,
  Control,
  Ellipse,
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

const GAUGES: Array<{ key: GaugeKey; label: string; symbol: string; color: string; inverse?: boolean }> = [
  { key: "sleep", label: "Sommeil", symbol: "◔", color: C.lavender },
  { key: "clean", label: "Propreté", symbol: "✦", color: C.butter },
  { key: "stress", label: "Stress", symbol: "!", color: C.tomato, inverse: true },
  { key: "stock", label: "Réserves", symbol: "□", color: C.sky },
];

function text(name: string, value: string, size: number, color = C.ink, weight = "400") {
  const block = new TextBlock(name, value);
  block.color = color;
  block.fontFamily = "DM Sans, Arial, sans-serif";
  block.fontSize = size;
  block.fontWeight = weight;
  return block;
}

function title(name: string, value: string, size: number, color = C.ink) {
  const block = text(name, value, size, color, "700");
  block.fontFamily = "Fraunces, Georgia, serif";
  return block;
}

function panel(name: string, background: string, radius = 20) {
  const rectangle = new Rectangle(name);
  rectangle.background = background;
  rectangle.thickness = 0;
  rectangle.cornerRadius = radius;
  return rectangle;
}

function button(name: string, label: string, background: string, foreground: string) {
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
    const bg = panel("night-sky", C.midnight, 0);
    bg.width = 1;
    bg.height = 1;
    this.ui.addControl(bg);

    const moonGlow = new Ellipse("moon-glow");
    moonGlow.width = this.mobile ? "260px" : "420px";
    moonGlow.height = this.mobile ? "260px" : "420px";
    moonGlow.left = this.mobile ? "205px" : "500px";
    moonGlow.top = this.mobile ? "-300px" : "-250px";
    moonGlow.background = "#F7C94818";
    moonGlow.color = "#F7C94844";
    moonGlow.thickness = 2;
    bg.addControl(moonGlow);

    const moon = title("moon", "◔", this.mobile ? 112 : 170, "#FFF8E7CC");
    moon.left = moonGlow.left;
    moon.top = moonGlow.top;
    bg.addControl(moon);

    const stars = text("stars", "✦      ·      ✧        ·      ✦       ·       ✧", this.mobile ? 15 : 22, "#F7C94877", "700");
    stars.top = this.mobile ? "-225px" : "-325px";
    bg.addControl(stars);

    const floor = panel("floor", "#172B4ECC", 0);
    floor.width = 1;
    floor.height = this.mobile ? "270px" : "330px";
    floor.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    bg.addControl(floor);

    const crib = panel("crib", "#FFF8E719", 18);
    crib.width = this.mobile ? "250px" : "410px";
    crib.height = this.mobile ? "105px" : "145px";
    crib.left = this.mobile ? "165px" : "450px";
    crib.top = this.mobile ? "295px" : "270px";
    crib.thickness = 4;
    crib.color = "#FFF8E744";
    bg.addControl(crib);
  }

  private resetStage() {
    window.clearTimeout(this.timer);
    this.root.clearControls();
    this.card = null;
    this.hint = null;
    this.result = null;
    this.gaugeViews.clear();
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

    const crest = title("crest", "♛", this.mobile ? 70 : 82, C.butter);
    crest.top = this.mobile ? "-255px" : "-220px";
    shell.addControl(crest);

    const kicker = text("kicker", "UNE NUIT · QUATRE JAUGES · ZÉRO RÉPIT", this.mobile ? 12 : 15, C.butter, "700");
    kicker.top = this.mobile ? "-190px" : "-155px";
    shell.addControl(kicker);

    const heading = title("heading", "Bébé Reigns", this.mobile ? 54 : 68, C.cream);
    heading.top = this.mobile ? "-115px" : "-84px";
    shell.addControl(heading);

    const subtitle = text("subtitle", "La nuit des petits tyrans", this.mobile ? 21 : 25, C.pale, "600");
    subtitle.top = this.mobile ? "-54px" : "-18px";
    shell.addControl(subtitle);

    const description = text(
      "description",
      "Swipez à gauche ou à droite. Gardez sommeil, propreté et réserves à flot, sans laisser le stress atteindre la mutinerie.",
      this.mobile ? 17 : 19,
      C.pale,
      "500",
    );
    description.width = this.mobile ? "500px" : "600px";
    description.height = "110px";
    description.top = this.mobile ? "44px" : "63px";
    description.textWrapping = TextWrapping.WordWrap;
    shell.addControl(description);

    const start = button("start", "Entrer dans la nuit", C.butter, C.ink);
    start.width = this.mobile ? "430px" : "360px";
    start.top = this.mobile ? "180px" : "180px";
    start.onPointerUpObservable.add(() => this.startGame());
    shell.addControl(start);

    const stats = StorageService.stats();
    const record = StorageService.bestScore();
    const history = text(
      "history",
      record > 0 || stats.games > 0
        ? `Record ${record.toLocaleString("fr-FR")} pts · ${stats.wins} aube${stats.wins > 1 ? "s" : ""} sauvée${stats.wins > 1 ? "s" : ""} · meilleure série ${stats.bestStreak}`
        : "Glissez · cliquez · utilisez les flèches",
      this.mobile ? 12 : 14,
      C.lavender,
      "700",
    );
    history.top = this.mobile ? "250px" : "250px";
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

    const night = title("night", `NUIT ${this.world.getNight()}`, this.mobile ? 20 : 24, C.cream);
    night.width = "150px";
    night.left = this.mobile ? "-215px" : "-525px";
    night.top = this.mobile ? "-50px" : "-24px";
    hud.addControl(night);

    const meta = text("meta", `${this.world.getTimeLabel()} · décret ${this.world.getRound() + 1}/${this.world.getTotalRounds()}`, 13, C.lavender, "700");
    meta.width = "220px";
    meta.left = this.mobile ? "-180px" : "-490px";
    meta.top = this.mobile ? "-20px" : "12px";
    hud.addControl(meta);

    const grace = text(
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

    const caption = text(`caption-${spec.key}`, `${spec.symbol} ${spec.label}`, this.mobile ? 11 : 13, C.pale, "700");
    caption.top = "-20px";
    frame.addControl(caption);

    const value = text(`value-${spec.key}`, "0", this.mobile ? 20 : 23, C.cream, "700");
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

    const category = text("category", `DÉCRET IMPROMPTU · NUIT ${this.world.getNight()} · ${this.world.getTimeLabel()}`, this.mobile ? 11 : 13, C.tomato, "700");
    category.top = this.mobile ? "-268px" : "-250px";
    card.addControl(category);

    const art = new Ellipse("event-art");
    art.width = this.mobile ? "105px" : "128px";
    art.height = this.mobile ? "105px" : "128px";
    art.top = this.mobile ? "-190px" : "-165px";
    art.background = event.art.background;
    art.color = C.ink;
    art.thickness = 3;
    card.addControl(art);
    art.addControl(title("event-glyph", event.art.glyph, this.mobile ? 52 : 66, event.art.color));

    const heading = title("event-title", event.title, this.mobile ? 31 : 39, C.ink);
    heading.width = this.mobile ? "520px" : "650px";
    heading.height = "74px";
    heading.top = this.mobile ? "-105px" : "-72px";
    heading.textWrapping = TextWrapping.WordWrap;
    card.addControl(heading);

    const story = text("story", event.story, this.mobile ? 17 : 20, C.softInk, "500");
    story.width = this.mobile ? "500px" : "620px";
    story.height = this.mobile ? "100px" : "95px";
    story.top = this.mobile ? "-17px" : "18px";
    story.textWrapping = TextWrapping.WordWrap;
    card.addControl(story);

    this.hint = text("hint", "Glissez pour entrevoir les conséquences", this.mobile ? 13 : 15, C.softInk, "700");
    this.hint.top = this.mobile ? "72px" : "94px";
    card.addControl(this.hint);

    const actions = new StackPanel("choices");
    actions.isVertical = this.mobile;
    actions.width = this.mobile ? "520px" : "680px";
    actions.height = this.mobile ? "122px" : "58px";
    actions.top = this.mobile ? "160px" : "170px";
    card.addControl(actions);

    const left = button("left", `← ${this.shortLabel(event.left.label)}`, C.lavender, C.ink);
    left.width = this.mobile ? "510px" : "330px";
    left.onPointerUpObservable.add(() => this.resolveChoice("left"));
    actions.addControl(left);

    if (this.mobile) {
      const spacer = new Rectangle("spacer");
      spacer.width = "1px";
      spacer.height = "10px";
      spacer.thickness = 0;
      actions.addControl(spacer);
    } else {
      const spacer = new Rectangle("spacer");
      spacer.width = "20px";
      spacer.height = "1px";
      spacer.thickness = 0;
      actions.addControl(spacer);
    }

    const right = button("right", `${this.shortLabel(event.right.label)} →`, C.butter, C.ink);
    right.width = this.mobile ? "510px" : "330px";
    right.onPointerUpObservable.add(() => this.resolveChoice("right"));
    actions.addControl(right);

    this.result = text("result", "", this.mobile ? 13 : 15, C.cream, "700");
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
      const harmful = key === "stress" ? delta > 0 : delta < 0;
      return harmful && Math.abs(delta) >= 12;
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
    shell.height = this.mobile ? "620px" : "620px";
    shell.thickness = 4;
    shell.color = won ? C.ink : "#FFFFFF33";
    this.root.addControl(shell);

    const icon = title("ending-icon", won ? "♛" : "!", this.mobile ? 66 : 82, won ? C.butter : C.tomato);
    icon.top = "-225px";
    shell.addControl(icon);

    const heading = title("ending-heading", won ? "L’aube est sauvée" : "Le royaume chancelle", this.mobile ? 38 : 50, won ? C.ink : C.cream);
    heading.top = "-150px";
    shell.addControl(heading);

    const copy = text(
      "ending-copy",
      won ? "Le petit tyran dort. Déposez la couronne quelques minutes." : result.cause ?? "Le royaume réclame une pause.",
      this.mobile ? 17 : 20,
      won ? C.softInk : C.pale,
      "500",
    );
    copy.width = this.mobile ? "500px" : "650px";
    copy.height = "80px";
    copy.top = "-80px";
    copy.textWrapping = TextWrapping.WordWrap;
    shell.addControl(copy);

    const score = title("score", `${result.score.toLocaleString("fr-FR")} points`, this.mobile ? 30 : 38, won ? C.ink : C.cream);
    score.top = "10px";
    shell.addControl(score);

    const metrics = text(
      "ending-metrics",
      `Sommeil ${result.metrics.sleep} · Propreté ${result.metrics.clean} · Stress ${result.metrics.stress} · Stock ${result.metrics.stock}`,
      this.mobile ? 12 : 15,
      won ? C.ink : C.pale,
      "700",
    );
    metrics.top = "70px";
    shell.addControl(metrics);

    const unlocked = new Set(StorageService.achievements());
    const achievements = text(
      "achievements",
      ACHIEVEMENTS.map((achievement) => `${unlocked.has(achievement.id) ? achievement.symbol : "·"} ${achievement.name}`).join("   "),
      this.mobile ? 11 : 14,
      won ? C.softInk : C.lavender,
      "700",
    );
    achievements.width = this.mobile ? "540px" : "720px";
    achievements.top = "125px";
    shell.addControl(achievements);

    const retry = button("retry", won ? "Une autre nuit" : "Reprendre le royaume", won ? C.ink : C.butter, won ? C.cream : C.ink);
    retry.width = this.mobile ? "340px" : "380px";
    retry.top = "195px";
    retry.onPointerUpObservable.add(() => this.startGame());
    shell.addControl(retry);

    const home = text("home", "Retour à l’accueil", 15, won ? C.softInk : C.pale, "700");
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
