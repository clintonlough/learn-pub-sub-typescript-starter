import { printClientHelp } from "../internal/gamelogic/gamelogic.js";
import { type ConfirmChannel } from "amqplib";
import { type ArmyMove, type RecognitionOfWar } from "../internal/gamelogic/gamedata.js";
import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";
import { AckType, publishJSON, subscribeJSON } from "../internal/pubsub/publish.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { ExchangePerilTopic } from "../internal/routing/routing.js";
import { WarRecognitionsPrefix } from "../internal/routing/routing.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  return (ps: PlayingState): AckType => {
    // call your logic here
    handlePause(gs,ps);
    return AckType.Ack;
  };
}

export function handlerMove(gs: GameState, publishCh: ConfirmChannel): (move: ArmyMove) => AckType {
    return ( move: ArmyMove): AckType => {
        try {
            const outcome = handleMove(gs,move);
            if (outcome === MoveOutcome.Safe) {
                return AckType.Ack;
            } else if (outcome === MoveOutcome.MakeWar) {
                const rw: RecognitionOfWar = {
                attacker: move.player,
                defender: gs.getPlayerSnap(),
                };
                publishJSON(
                    publishCh,
                    ExchangePerilTopic,
                    `${WarRecognitionsPrefix}.${gs.getUsername()}`,
                    rw
                );
                return AckType.Ack;
            } else if (outcome === MoveOutcome.SamePlayer) {
                return AckType.NackDiscard;
            } else {
                return AckType.NackDiscard;
            }
        } catch (err) {
            console.log("An error has occured");
            return AckType.NackRequeue;
        } 
        finally {
            process.stdout.write("> ");
        };
    };
}


export function handlerWar(gs: GameState): (rw: RecognitionOfWar) => Promise<AckType> {
  return async (rw: RecognitionOfWar): Promise<AckType> => {
    try {
        const outcome = handleWar(gs,rw);
        switch (outcome.result) {
            case WarOutcome.NotInvolved:
                return AckType.NackRequeue;
            case WarOutcome.NoUnits:
                return AckType.NackDiscard;
            case WarOutcome.OpponentWon:
                return AckType.Ack;
            case WarOutcome.YouWon:
                return AckType.Ack;
            case WarOutcome.Draw:
                return AckType.Ack;
            default:
                console.log("Error: Undefined War Outcome");
                return AckType.NackDiscard;
        }
    } catch (err) {
        console.log("Error: War failed");
        return AckType.NackRequeue;
    } finally {
        process.stdout.write("> ");
    };   
  };
}