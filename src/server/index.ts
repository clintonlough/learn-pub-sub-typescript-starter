import amqp from "amqplib";
import { publishJSON, declareAndBind, SimpleQueueType } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, PauseKey, ExchangePerilTopic, GameLogSlug } from "../internal/routing/routing.js";
import { printServerHelp, getInput } from "../internal/gamelogic/gamelogic.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";

async function main() {
  console.log("Starting Peril server...");
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  console.log("Connection established successfully");
  const ch = await conn.createConfirmChannel();

  const queue = declareAndBind(
    conn, 
    ExchangePerilTopic, 
    GameLogSlug,
    "game_logs.*", 
    SimpleQueueType.Durable
  );

  printServerHelp();
  
  while (true) {
    const input = await getInput();
    if (input.length === 0) {
      continue;
    } else if (input[0] === 'pause') {
      console.log("sending pause message");
      const msg: PlayingState = {isPaused: true };
      publishJSON(ch, ExchangePerilDirect, PauseKey, msg);
    } else if (input[0] === 'resume') {
      console.log("sending resume message");
      const msg: PlayingState = {isPaused: false };
      publishJSON(ch, ExchangePerilDirect, PauseKey, msg);
    } else if (input[0] === 'quit') {
      console.log("exiting the program");
      break;
    } else {
      console.log("invalid command");
    }
  }



  process.on('SIGINT', () => {
    console.log('Server shutting down');
    conn.close()
    console.log("Connection successfully closed");
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
