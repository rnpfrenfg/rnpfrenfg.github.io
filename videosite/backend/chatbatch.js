function createChatBatchWriter(dbPool, flushIntervalMs = 500) {
  if (!dbPool) throw new Error("createChatBatchWriter: dbPool is required");

  let queue = [];
  let flushing = false;
  let timer = null;

  function batch(chatMessage) {
    if (!chatMessage) return false;
    queue.push(chatMessage);
    return true;
  }

  async function flush() {
    if (flushing) return;
    if (queue.length === 0) return;

    flushing = true;

    const batchItems = queue;
    queue = [];

    try {
      const sql = `INSERT INTO chats (video_id, channelid, username, message, created_at) VALUES ?`;

      const rows = batchItems.map(c => ([
        c.videoid,
        c.channelid,
        c.username,
        c.message,
        c.created_at,
      ]));

      await dbPool.query(sql, [rows]);
    } catch (err) {
      console.error("[ChatBatch] flush failed:", err);
    } finally {
      flushing = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      void flush();
    }, flushIntervalMs);
  }

  async function stop({ flushAll = true } = {}) {
    if (timer) clearInterval(timer);
    timer = null;

    if (flushAll) {
      while (queue.length > 0) {
        await flush();
      }
    }
  }

  return { start, batch, stop };
}

module.exports = { createChatBatchWriter };
