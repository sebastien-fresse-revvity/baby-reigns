// Direction « Monarchie en pyjama » : le geste est net, mais les commandes clavier offrent toujours une alternative équivalente.
import type { ChoiceSide } from "./types";

type InputHandlers = {
  choose: (side: ChoiceSide) => void;
  preview: (side: ChoiceSide | null, progress: number) => void;
  restart: () => void;
};

export class InputManager {
  private active = false;
  private pointerStart: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly handlers: InputHandlers) {
    window.addEventListener("keydown", this.onKeyDown);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerCancel);
  }

  setActive(active: boolean) {
    this.active = active;
    if (!active) this.handlers.preview(null, 0);
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (!this.active) {
      if (event.key === "Enter" || event.key === " ") this.handlers.restart();
      return;
    }
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
      event.preventDefault();
      this.handlers.choose("left");
    }
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
      event.preventDefault();
      this.handlers.choose("right");
    }
  };

  private onPointerDown = (event: PointerEvent) => {
    if (!this.active) return;
    this.pointerStart = event.clientX;
    this.canvas.setPointerCapture?.(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (!this.active || this.pointerStart === null) return;
    const delta = event.clientX - this.pointerStart;
    if (Math.abs(delta) < 8) return this.handlers.preview(null, 0);
    this.handlers.preview(delta < 0 ? "left" : "right", Math.min(1, Math.abs(delta) / 150));
  };

  private onPointerUp = (event: PointerEvent) => {
    if (!this.active || this.pointerStart === null) return;
    const delta = event.clientX - this.pointerStart;
    this.pointerStart = null;
    this.handlers.preview(null, 0);
    if (Math.abs(delta) >= 82) this.handlers.choose(delta < 0 ? "left" : "right");
  };

  private onPointerCancel = () => {
    this.pointerStart = null;
    this.handlers.preview(null, 0);
  };

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
  }
}
