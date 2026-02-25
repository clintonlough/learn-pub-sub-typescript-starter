import amqp from "amqplib";
import type { ConfirmChannel, Channel } from "amqplib";

export enum SimpleQueueType {
  Durable,
  Transient,
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
    };

    const queue = await ch.assertQueue(queueName, options);
    ch.bindQueue(queue.queue, exchange, key);
    
    return [ch, queue];
}