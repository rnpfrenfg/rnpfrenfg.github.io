const { createClient } = require('redis');

const connectedServers = new Set();

async function initMemoryDB(url) {
  if(connectedServers.has(url)){
    console.error('[Redis Error] cannot connect to same server');
  }

  const redis = createClient({ url: url });
  redis.on('error', (err) => console.error('[Redis Error]', err));
  
  connectedServers.add(url);

  await redis.connect();
  console.log('[Redis] redis server connected');

  function keyRecent(channelid) {
    return `channel:${channelid}:recent`;
  }

  async function addChat(channelid, data) {
    const key = keyRecent(channelid);
    const payload = JSON.stringify(data ?? null);

    await redis.multi()
      .lPush(key, payload)
      .lTrim(key, 0, 100)
      .exec();
  }

  async function closeChat(channelid) {
    await redis.del(keyRecent(channelid));
  }

  async function getRecentChats(channelid) {
    const list = await redis.lRange(keyRecent(channelid), 0, -1);
    const out = [];
    for (const raw of list) {
      try {
        out.push(JSON.parse(raw));
      } catch {}
    }
    return out.reverse();
  }

  return {addChat,closeChat,getRecentChats};
}

module.exports = { initMemoryDB };
