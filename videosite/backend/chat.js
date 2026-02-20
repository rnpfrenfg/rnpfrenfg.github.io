const { WebSocketServer, WebSocket } = require("ws");
const { parseCookies, decodeUserFromToken, COOKIE } = require("./auth");
const crypto = require("crypto");

// channelid -> Set(WebSocket)
const wsChannels = new Map();

const ALLOWED_ORIGINS = new Set(
  [process.env.FRONTEND_ORIGIN, "http://localhost:3000"].filter(Boolean)
);

function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.has(origin);
}

function getChannelClients(channelid) {
  const id = String(channelid || "");
  if (!wsChannels.has(id)) wsChannels.set(id, new Set());
  return wsChannels.get(id);
}

function broadcastToChannel(channelid, payload) {
  const clients = wsChannels.get(String(channelid || ""));
  if (!clients || clients.size === 0) return 0;

  const serialized = JSON.stringify(payload);
  let sent = 0;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(serialized);
        sent++;
      } catch {}
    }
  }
  return sent;
}

function closeChannel(channelid, { code = 1000, reason = "channel closed", notify = true } = {}) {
  const id = String(channelid || "");
  const clients = wsChannels.get(id);
  if (!clients || clients.size === 0) {
    wsChannels.delete(id);
    return 0;
  }

  if (notify) {
    const msg = JSON.stringify({ type: "channel_closed", channelid: id });
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(msg); } catch {}
      }
    }
  }

  for (const ws of clients) {
    try { ws.close(code, reason); } catch {}
  }

  wsChannels.delete(id);
  return clients.size;
}

function sendWsError(ws, code, shouldClose = false) {
  try {
    ws.send(JSON.stringify({ type: "error", code }));
  } catch {}
  if (shouldClose) {
    try { ws.close(); } catch {}
  }
}

function generateMessageId() {
  return crypto.randomUUID();
}

function canSend(ws) {
  const now = Date.now();
  if (!ws._rate) ws._rate = { ts: now, count: 0 };

  if (now - ws._rate.ts > 1000) {
    ws._rate.ts = now;
    ws._rate.count = 0;
  }

  ws._rate.count++;
  return ws._rate.count <= 3;
}

function startChatServer(
  server,
  memorydb,
  liveSessions,
  channelIdToStreamKey,
  chatBatch,
  getUsernameById
) {
  if (!server) throw new Error("startChatServer: server is required");
  if (!getUsernameById) throw new Error("startChatServer: getUsernameById is required");
  if (!memorydb) throw new Error("startChatServer: memorydb is required");
  if (!liveSessions) throw new Error("startChatServer: liveSessions is required");
  if (!channelIdToStreamKey) throw new Error("startChatServer: channelIdToStreamKey is required");
  if (!chatBatch) throw new Error("startChatServer: chatBatch is required");

  const wss = new WebSocketServer({ server, path: "/ws/livechat" });
  console.log("[Chat] WebSocket server listening on /ws/livechat");

  wss.on("connection", async (ws, req) => {
    let channelid = "";

    try {
      if (!isOriginAllowed(req.headers.origin)) {
        sendWsError(ws, "WS_ORIGIN_NOT_ALLOWED", true);
        return;
      }

      const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      channelid = requestUrl.searchParams.get("channelid") || "";

      if (!channelid) {
        sendWsError(ws, "WS_CHANNEL_ID_REQUIRED", true);
        return;
      }

      const cookies = parseCookies(req.headers.cookie || "");
      const cookieToken = cookies[COOKIE.accessTokenName] || "";

      ws.channelid = channelid;
      ws.user = decodeUserFromToken(cookieToken);

      if (!ws.user) {
        sendWsError(ws, "AUTH_REQUIRED", true);
        return;
      }

      ws.user.username = await getUsernameById(ws.user.id);
      if (ws.user.username === null) {
        sendWsError(ws, "USER_NOT_FOUND", true);
        return;
      }

      getChannelClients(channelid).add(ws);

      const recent = await memorydb.getRecentChats(channelid);
      if (recent?.length) {
        ws.send(JSON.stringify({ type: "recent", messages: recent }));
      }
    } catch (err) {
      console.error("[Chat] connection init failed:", err?.message || err);
      sendWsError(ws, "WS_CONNECTION_INIT_FAILED", true);
      return;
    }

    ws.on("message", async (rawData) => {
      let parsed;
      try {
        parsed = JSON.parse(rawData.toString());
      } catch {
        sendWsError(ws, "WS_INVALID_MESSAGE_FORMAT");
        return;
      }

      if (parsed.type !== "chat") return;

      const text = typeof parsed.message === "string" ? parsed.message.trim() : "";
      if (!text) return sendWsError(ws, "WS_MESSAGE_REQUIRED");
      if (text.length > 300) return sendWsError(ws, "WS_MESSAGE_TOO_LONG");
      if (!canSend(ws)) return sendWsError(ws, "WS_RATE_LIMIT");

      try {
        const streamKey = channelIdToStreamKey.get(String(ws.channelid));
        const session = streamKey ? liveSessions.get(streamKey) : null;

        if (!session || !streamKey || !session.videoId) {
          sendWsError(ws, "WS_SESSION_NOT_FOUND");
          return;
        }

        const now = new Date();
        const messageId = generateMessageId();

        const chatMessage = {
          id: messageId,
          channelid: Number(ws.channelid),
          videoId: session.videoId,
          userid: ws.user.id,
          username: ws.user.username,
          message: text,
          created_at: now,
        };

        chatBatch.batch(chatMessage);
        memorydb.addChat(ws.channelid, chatMessage).catch((err) =>
          console.error("[Redis] addChat failed:", err?.message || err)
        );

        broadcastToChannel(ws.channelid, { type: "chat", message: chatMessage });
      } catch (err) {
        console.error("[Chat] send failed:", err?.message || err);
        sendWsError(ws, "WS_CHAT_SEND_FAILED");
      }
    });

    ws.on("close", () => {
      if (!channelid) return;
      const clients = wsChannels.get(String(channelid));
      if (!clients) return;
      clients.delete(ws);
      if (clients.size === 0) wsChannels.delete(String(channelid));
    });
  });

  return { broadcastToChannel, closeChannel };
}

module.exports = { startChatServer };
