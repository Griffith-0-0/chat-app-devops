const amqp = require('amqplib');
require('dotenv').config();

let channel;

const connect = async () => {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue('messages', { durable: true });
  console.log('RabbitMQ connected');
};

const publish = async (message) => {
  if (!channel) await connect();
  channel.sendToQueue('messages', Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
};

module.exports = { connect, publish };