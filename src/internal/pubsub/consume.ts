import amqp from "amqplib";
import type { ConfirmChannel, Channel } from "amqplib";
import { encode, decode } from "@msgpack/msgpack";

export enum SimpleQueueType {
  Durable,
  Transient,
}

export enum AckType {
  Ack,
  NackRequeue,
  NackDiscard,
}

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {

    const ch = await conn.createChannel();
    const options = {
        durable: queueType === SimpleQueueType.Durable,
        autoDelete: queueType === SimpleQueueType.Transient,
        exclusive: queueType === SimpleQueueType.Transient,
        arguments: {
          "x-dead-letter-exchange": "peril_dlx"
        },
    };

    const queue = await ch.assertQueue(queueName, options);
    ch.bindQueue(queue.queue, exchange, key);
    
    return [ch, queue];
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  const [ch, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType
  );
  await ch.consume(queue.queue,
    (msg: amqp.ConsumeMessage | null) => {
  // 1. Check if msg is null
      if (msg === null) {
        return;
      }
  // 2. Parse the content
      const msgContent = JSON.parse(msg.content.toString());
  // 3. Call the handler
      const acknowledgment = handler(msgContent);
  // 4. Acknowledge the message
      if (acknowledgment === AckType.Ack) {
        ch.ack(msg);
        console.log("message acknowledged");
      } else if (acknowledgment === AckType.NackRequeue) {
        ch.nack(msg,false,true);
        console.log("message failed, requeing");
      } else if (acknowledgment === AckType.NackDiscard) {
        ch.nack(msg,false,false);
        console.log("message failed, discarding");
      }
      
    }
  );
}

export async function subscribeMsgPack<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType, // an enum to represent "durable" or "transient"
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  const [ch, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType
  );
  ch.consume(queue.queue, (msg: amqp.ConsumeMessage | null) => {
  if (msg === null) return;

  const decoded = decode(msg.content) as any;

  const msgContent = decoded.value ? decoded.value : decoded;
  console.log("Decoded content:", msgContent);

  // Handle the promise returned by the handler
  Promise.resolve(handler(msgContent)).then((acknowledgment) => {
    if (acknowledgment === AckType.Ack) {
      ch.ack(msg);
      console.log("message acknowledged");
    } else if (acknowledgment === AckType.NackRequeue) {
      ch.nack(msg, false, true);
    } else if (acknowledgment === AckType.NackDiscard) {
      ch.nack(msg, false, false);
    }
  }).catch((err) => {
    console.error("Handler crashed:", err);
    ch.nack(msg, false, false);
  });
});
}