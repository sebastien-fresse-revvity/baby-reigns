import { Image } from "@babylonjs/gui";
import { StageController } from "./StageController";
import veilleuseUrl from "./assets/veilleuse_fait_son_show";
import concertUrl from "./assets/concert_des_soupirs";
import reveilUrl from "./assets/reveil_trop_tot";

const EVENT_ARTWORK: Record<string, string> = {
  veilleuse: veilleuseUrl,
  "berceuse-en-boucle": concertUrl,
  "reveil-parent": reveilUrl,
};

type PatchableStage = StageController & {
  world: { currentEvent: () => { id: string } };
  ui: { getControlByName: (name: string) => unknown };
  card: { removeControl: (control: unknown) => void; addControl: (control: Image) => void } | null;
  mobile: boolean;
  buildCard: () => void;
};

const prototype = StageController.prototype as unknown as PatchableStage & { __originalArtworkPatched?: boolean };

if (!prototype.__originalArtworkPatched) {
  const originalBuildCard = prototype.buildCard;

  prototype.buildCard = function patchedBuildCard(this: PatchableStage) {
    originalBuildCard.call(this);

    const artwork = EVENT_ARTWORK[this.world.currentEvent().id];
    if (!artwork || !this.card) return;

    const existing = this.ui.getControlByName("event-art");
    if (existing) this.card.removeControl(existing);

    const image = new Image("event-art", artwork);
    image.width = this.mobile ? "105px" : "128px";
    image.height = this.mobile ? "105px" : "128px";
    image.top = this.mobile ? "-190px" : "-165px";
    image.stretch = Image.STRETCH_UNIFORM;
    image.isPointerBlocker = false;
    this.card.addControl(image);
  };

  prototype.__originalArtworkPatched = true;
}
