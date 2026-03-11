/**
 * Client RabbitMQ pour le service Messaging
 * Publie les événements (ex: new_message) dans la queue 'messages'. Connexion avec retry pour démarrage Docker.
 */
const amqp = require('amqplib');
require('dotenv').config();

let channel;

const connect = async (retries = 5, delay = 3000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await amqp.connect(process.env.RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertQueue('messages', { durable: true });
      console.log('RabbitMQ connected');
      return;
    } catch (_err) {
      console.log(`RabbitMQ not ready, retrying in ${delay/1000}s... (${i + 1}/${retries})`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  throw new Error('Could not connect to RabbitMQ after retries');
};

const publish = async (message) => {
  if (!channel) await connect();
  channel.sendToQueue('messages', Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
};

module.exports = { connect, publish };