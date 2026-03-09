import { printClientHelp } from "../internal/gamelogic/gamelogic.js";
import { type ConfirmChannel } from "amqplib";
import { type ArmyMove, type RecognitionOfWar } from "../internal/gamelogic/gamedata.js";
import type { GameState, PlayingState } from "../internal/gamelogic/gamestate.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";
import { AckType, publishJSON } from "../internal/pubsub/publish.js";
import { subscribeJSON } from "../internal/pubsub/consume.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { ExchangePerilTopic, WarRecognitionsPrefix } from "../internal/routing/routing.js";
import { publishGameLog } from "./index.js";
import { writeLog, type GameLog } from "../internal/gamelogic/logs.js";

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


export function handlerWar(gs: GameState, publishCh: ConfirmChannel): (rw: RecognitionOfWar) => Promise<AckType> {
  return async (rw: RecognitionOfWar): Promise<AckType> => {
    try {
        const outcome = handleWar(gs,rw);
        const attacker = rw.attacker.username;
        const defender = rw.defender.username;
        
        switch (outcome.result) {
            case WarOutcome.NotInvolved:
                return AckType.NackRequeue;
            case WarOutcome.NoUnits:
                return AckType.NackDiscard;
            case WarOutcome.OpponentWon:
                try {
                    await publishGameLog(
                    publishCh,
                    gs.getUsername(),
                    `${outcome.winner} won the war against ${outcome.loser}.`,
                    );
                } catch (err) {
                    console.error("Error publishing game log:", err);
                    return AckType.NackRequeue;
                }
                return AckType.Ack;
            case WarOutcome.YouWon:
                try {
                    
                    await publishGameLog(
                    publishCh,
                    gs.getUsername(),
                    `${outcome.winner} won the war against ${outcome.loser}.`,
                    );
                } catch (err) {
                    console.error("Error publishing game log:", err);
                    return AckType.NackRequeue;
                }
                return AckType.Ack;
            case WarOutcome.Draw:
                try {
                    await publishGameLog(
                    publishCh,
                    gs.getUsername(),
                    `A war between ${attacker} and ${defender} resulted in a draw`,
                    );
                } catch (err) {
                    console.error("Error publishing game log:", err);
                    return AckType.NackRequeue;
                }
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

export async function handlerWriteLog(data: any) {
    try {
        // Log exactly what 'data' is to see the problematic message
        if (!data || typeof data !== 'object' && typeof data !== 'string') {
            console.log("Received malformed log data:", data);
            return AckType.NackDiscard;
        }

        const logData: GameLog = {
            username: data.username || "unknown",
            message: data.message || (typeof data === 'string' ? data : "no message"),
            // Use a fallback date if data.currentTime is missing or invalid
            currentTime: data.currentTime ? new Date(data.currentTime) : new Date()
        };

        // Final check: if the Date is still invalid, use current time
        if (isNaN(logData.currentTime.getTime())) {
            logData.currentTime = new Date();
        }

        await writeLog(logData);
        return AckType.Ack;
    } catch (err) {
        console.log("error writing log file...", err);
        return AckType.NackDiscard;
    } finally {
        process.stdout.write("> ");
    }
}