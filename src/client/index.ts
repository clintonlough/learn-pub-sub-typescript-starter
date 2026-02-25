import amqp from "amqplib";
import { declareAndBind, publishJSON, SimpleQueueType } from "../internal/pubsub/publish.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import { clientWelcome } from "../internal/gamelogic/gamelogic.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";

async function main() {
  console.log("Starting Peril server...");
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);
  console.log("Connection established successfully");
  const ch = await conn.createConfirmChannel();
  const username = await clientWelcome();
  const queue = declareAndBind(
    conn, 
    ExchangePerilDirect, 
    `${PauseKey}.${username}`,
    PauseKey, 
    SimpleQueueType.Transient
  );


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
