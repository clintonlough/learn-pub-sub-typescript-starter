import { printClientHelp } from "../internal/gamelogic/gamelogic.js";
import { type ArmyMove } from "../internal/gamelogic/gamedata.js";
import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { AckType } from "../internal/pubsub/publish.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  return (ps: PlayingState): AckType => {
    // call your logic here
    handlePause(gs,ps);
    return AckType.Ack;
  };
}

export function handlerMove(gs: GameState): (move: ArmyMove) => AckType {
    return ( move: ArmyMove): AckType => {
        try {
            const outcome = handleMove(gs,move);
            if (outcome === MoveOutcome.Safe) {
                return AckType.Ack;
            } else if (outcome === MoveOutcome.MakeWar) {
                return AckType.Ack;
            } else if (outcome === MoveOutcome.SamePlayer) {
                return AckType.NackDiscard;
            } else {
                return AckType.NackDiscard;
            }
        } finally {
            process.stdout.write("> ");
        }
    };
}