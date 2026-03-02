import amqp from "amqplib";
import type { ConfirmChannel, Channel } from "amqplib";

export enum SimpleQueueType {
  Durable,
  Transient,
}

export enum AckType {
  Ack,
  NackRequeue,
  NackDiscard,
}

export function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {

    const valueBytes = Buffer.from(JSON.stringify(value), "utf-8");
    return new Promise((resolve, reject) => {
        ch.publish(
        exchange,
        routingKey,
        valueBytes,
        { contentType: "application/json" },
        (err) => (err ? reject(err) : resolve()),
        );
    });
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