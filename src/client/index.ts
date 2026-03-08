import amqp from "amqplib";
import { publishJSON, SimpleQueueType, publishMsgPack } from "../internal/pubsub/publish.js";
import { declareAndBind, subscribeJSON } from "../internal/pubsub/consume.js";
import { ExchangePerilDirect, ExchangePerilTopic, GameLogSlug, PauseKey } from "../internal/routing/routing.js";
import { clientWelcome, getInput, printClientHelp, printQuit } from "../internal/gamelogic/gamelogic.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove, handleMove } from "../internal/gamelogic/move.js";
import { commandStatus } from "../internal/gamelogic/gamelogic.js";
import { handlerPause, handlerMove, handlerWar } from "./handlers.js";
import { type PlayingState, GameState } from "../internal/gamelogic/gamestate.js";
import { type ArmyMove } from "../internal/gamelogic/gamedata.js";
import { type ConfirmChannel } from "amqplib";
import { type GameLog } from "../internal/gamelogic/logs.js";

async function main() {
  console.log("Starting Peril server...");
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  console.log("Connection established successfully");
  const ch = await conn.createConfirmChannel();
  const username = await clientWelcome();

  const gs = new GameState(username);

  await subscribeJSON(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${username}`,
    PauseKey,
    SimpleQueueType.Transient,
    handlerPause(gs)
  );

  await subscribeJSON(
    conn,
    ExchangePerilTopic,
    `army_moves.${username}`,
    "army_moves.*",
    SimpleQueueType.Transient,
    handlerMove(gs, ch)
  );

  await subscribeJSON (
    conn,
    ExchangePerilTopic,
    "war",
    "war.*",
    SimpleQueueType.Durable,
    handlerWar(gs, ch)
  )
  



  // REPL loop
  while (true) {
    const input = await getInput();
    if (input.length === 0) {
      continue;
    } else if (input[0] === 'spawn') {
      console.log("spawning new unit");
      try {
        commandSpawn(gs,input)
      } catch (err) {
        console.log((err as Error).message)
      };
    } else if (input[0] === 'move') {
      console.log("Moving unit");
      try {
        await publishJSON(
          ch,
          ExchangePerilTopic,
          `army_moves.${username}`,
          commandMove(gs,input)
        );
        console.log("Move successfully published");
      } catch (err) {
        console.log((err as Error).message)
      };
    } else if (input[0] === 'status') {
      console.log("Printing current status");
      commandStatus(gs);
    } else if (input[0] === 'help') {
      console.log("Showing help menu");
      printClientHelp();
    } else if (input[0] === 'spam') {
      console.log("Spamming not allowed yet!");
    } else if (input[0] === 'quit') {
      printQuit();
      break;
    } else {
      console.log("invalid command");
    }
  }



  process.on('SIGINT', () => {
    console.log('Client shutting down');
    conn.close()
    console.log("Connection successfully closed");
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

export async function publishGameLog(channel: ConfirmChannel, username: string, message: string): Promise<void> {
  const gameLog: GameLog = {
    username: username,
    message: message,
    currentTime: new Date()
  };

  console.log("PUBLISHING LOG:", gameLog); // Add this log!
  publishMsgPack(channel, ExchangePerilTopic, `${GameLogSlug}.${username}`, gameLog);
}
