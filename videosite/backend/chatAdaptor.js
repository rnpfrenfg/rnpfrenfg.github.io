const { createClient } = require('redis');

const connectedServers = new Set();

function channelChatKey(channelid) {
  return `channel:recent:${channelid}`;
}

function channelPubSubKey(channelid){
  return `channel:chat:${channelid}`;
}

async function initChatAdaptor(url, onMessage) {
  if(connectedServers.has(url)){
    console.error('[Redis Error] cannot connect to same server');
    return;
  }

  const redis = createClient({ url: url });
  redis.on('error', (err) => console.error('[Redis Error]', err));
  const subscribeRedis = createClient({ url: url });

  await redis.connect();
  await subscribeRedis.connect();

  connectedServers.add(url);

  console.log('[Redis] redis server connected');

  async function subscribeRoom(channelid) {
    await subscribeRedis.subscribe(channelPubSubKey(channelid), (message) => {
      const data = JSON.parse(message);
      onMessage(channelid, data);
    });
  }

  async function unSubscribeRoom(channelid) {
    await subscribeRedis.unsubscribe(channelPubSubKey(channelid));
  }

  async function addAndBroadcastChat(channelid, data) {
    const chatKey = channelChatKey(channelid);
    const pubKey = channelPubSubKey(channelid);
    const payload = JSON.stringify(data);

    await redis.multi()
      .lPush(chatKey, payload)
      .lTrim(chatKey, 0, 100)
      .publish(pubKey, payload)
      .exec();
  }

  async function getRecentChats(channelid) {
    const list = await redis.lRange(channelChatKey(channelid), 0, -1);
    const out = [];
    for (const raw of list) {
      try {
        out.push(JSON.parse(raw));
      } catch {}
    }
    return out.reverse();
  }

  async function closeChat(channelid) {
    await redis.del(channelChatKey(channelid));
  }

  return {subscribeRoom, unSubscribeRoom, addAndBroadcastChat,closeChat,getRecentChats};
}

module.exports = { initChatAdaptor };
