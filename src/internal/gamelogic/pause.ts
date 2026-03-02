import { AckType } from "../pubsub/publish.js";
import type { GameState, PlayingState } from "./gamestate.js";

export function handlePause(gs: GameState, ps: PlayingState): AckType {
  console.log();
  if (ps.isPaused) {
    console.log("==== Pause Detected ====");
    gs.pauseGame();
  } else {
    console.log("==== Resume Detected ====");
    gs.resumeGame();
  }
  console.log("------------------------");
  return AckType.Ack;
}
