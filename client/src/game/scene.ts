// Direction « Monarchie en pyjama » : Babylon orchestre une scène GUI immersive, encre et crème, pensée comme un théâtre nocturne.
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";
import { AdvancedDynamicTexture } from "@babylonjs/gui";
import { GameWorld } from "./GameWorld";
import { StageController } from "./StageController";
import "./eventArtworkPatch";

export type GameHandle = {
  scene: Scene;
  dispose: () => void;
};

export async function createGameScene(engine: Engine, canvas: HTMLCanvasElement): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.055, 0.106, 0.208, 1);
  const camera = new FreeCamera("ui-camera", new Vector3(0, 0, -10), scene);
  camera.setTarget(Vector3.Zero());
  scene.activeCamera = camera;

  const ui = AdvancedDynamicTexture.CreateFullscreenUI("bebe-reigns-ui", true, scene);
  const world = new GameWorld();
  const stage = new StageController(ui, world, canvas);

  const params = new URLSearchParams(window.location.search);
  if (params.get("ending") === "success") stage.showDemoEnding(true);
  else if (params.get("ending") === "failure") stage.showDemoEnding(false);
  else if (params.has("demo")) stage.startDemo();

  return {
    scene,
    dispose: () => {
      stage.dispose();
      ui.dispose();
      scene.dispose();
    },
  };
}
