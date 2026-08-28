// Direction « Monarchie en pyjama » : React encadre une scène Babylon théâtrale ; le canvas est l’unique scène de jeu.
import { useEffect, useRef } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "../game/scene";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;

    startedRef.current = true;
    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
    });

    let handle: GameHandle | null = null;
    let disposed = false;
    let titleTapFallback: (() => void) | null = null;

    createGameScene(engine, canvas)
      .then((gameHandle: GameHandle) => {
        if (disposed) {
          gameHandle.dispose();
          return;
        }

        handle = gameHandle;
        engine.runRenderLoop(() => gameHandle.scene.render());

        // Babylon GUI can occasionally miss the title button pointer-up on touch
        // browsers. Keep a one-shot native canvas fallback for the title screen.
        // It uses the exact same keyboard path as pressing Enter, then removes
        // itself so it cannot interfere with swipes or choice buttons in-game.
        titleTapFallback = () => {
          window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
          if (titleTapFallback) {
            canvas.removeEventListener("pointerup", titleTapFallback);
            titleTapFallback = null;
          }
        };
        canvas.addEventListener("pointerup", titleTapFallback);
      })
      .catch((error: unknown) => console.error("Impossible d’initialiser Bébé Reigns", error));

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      if (titleTapFallback) canvas.removeEventListener("pointerup", titleTapFallback);
      handle?.dispose();
      engine.dispose();
      startedRef.current = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="bebe-reigns-canvas"
      aria-label="Bébé Reigns, jeu de décisions parentales nocturnes. Utilisez les flèches gauche et droite pour choisir."
      tabIndex={0}
      style={{ touchAction: "none" }}
    />
  );
}
