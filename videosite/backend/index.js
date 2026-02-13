const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');
const fs = require('fs');
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const { initDB, dbPool } = require('./db');
const { authMiddleware, requireAdmin, JWT_SECRET } = require('./auth');
require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');

process.on('unhandledRejection', (reason, promise) => {
    console.error('\x1b[31m%s\x1b[0m', '[UnHandled Rejection] ', reason);
});

process.on('uncaughtException', (err) => {
    console.error('\x1b[31m%s\x1b[0m', '[Uncaught Exception] ', err);
});

const directories = ['./media', './mediaend'];
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[System] 폴더 생성 완료: ${dir}`);
    }
});

function generateStreamKey(userId) {
  return `user_${userId}_${Date.now()}`;
}

async function startServer(){
  await initDB();

  try{
    dbPool.execute('UPDATE livesetting SET is_live = 0 WHERE is_live = 1')
  }
  catch(err){
    console.log('db cleare err');
  }
}

const NGINX_SERVER = 'http://localhost:8080';

const liveSessions = new Map();
const wsChannels = new Map();

startServer();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function sendSuccess(req, res, code, data = null) {
  if (data === null) {
    return res.status(204).end();
  }
  return res.status(200).json({ code, ...data });
}
function sendFailure(req, res, status, code) {
  const warnLevel = status >= 500 ? 2 : status >= 400 ? 1 : 0;
  console.log(`[${warnLevel}] bad request! at ${req} : ${code}`);
  return res.status(status).json({ code });
}

app.get('/static/js/admin.js', (req, res, next) => {
  const token = req.headers.authorization;
  
  if (!token) return sendFailure(req, res, 401, 'ACCESS_DENIED');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role >= 2) {
      next();
    } else {
      sendFailure(req, res, 403, 'FORBIDDEN');
    }
  } catch (err) {
    sendFailure(req, res, 401, 'INVALID_TOKEN');
  }
});

const debug = true;

if(debug){
  app.use((req, res, next) => {
    const start = Date.now();
    const { method, url, body } = req;

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[API] [${new Date().toISOString()}] ${method} ${url} ${res.statusCode} - ${duration}ms`);
    });

    next();
  });
}

function getChannelClients(channelid) {
  if (!wsChannels.has(channelid)) {
    wsChannels.set(channelid, new Set());
  }
  return wsChannels.get(channelid);
}

function broadcastToChannel(channelid, payload) {
  const clients = wsChannels.get(channelid);
  if (!clients) return;
  const serialized = JSON.stringify(payload);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  }
}

function decodeWsUser(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { id: decoded.userId, role: decoded.role };
  } catch (err) {
    return null;
  }
}

function sendWsError(ws, code, shouldClose = false) {
  ws.send(JSON.stringify({ type: 'error', code }));
  if (shouldClose) {
    ws.close();
  }
}

//from nginx
app.post('/api/livestartauth', async (req, res) => {
  try{
      const streamKey = req.body.name;

    const [dbres] = await dbPool.execute('SELECT id, channelname FROM livesetting WHERE stream_key = ?', [streamKey]);

    if (dbres.length < 1) {
      sendFailure(req, res, 404, 'LIVE_START_AUTH_NOT_FOUND');
      return;
    }
    sendSuccess(req, res, 'LIVE_START_AUTH_OK');

    const channel = dbres[0];
    const [result] = await dbPool.execute(
      'INSERT INTO videos (channelid, title) VALUES (?, ?)',
      [channel.id, `${channel.channelname}님의 방송`]
    );
    
    await dbPool.execute('UPDATE livesetting SET is_live = 1 WHERE stream_key = ?', [streamKey]);
    const videoId = result.insertId;
    liveSessions.set(streamKey, {videoId: videoId,startTime: Date.now()});
  }
  catch(err){
    console.error(err);
  }
});

//from nginx
app.post('/api/livedone', async (req, res) => {
  const streamKey = req.body.name;

  try {
    const [users] = await dbPool.execute(
        'SELECT id, channelname FROM livesetting WHERE stream_key = ?', 
        [streamKey]
    );

    if (users.length > 0) {
      const user = users[0];
      await dbPool.execute('UPDATE livesetting SET is_live = 0 WHERE id = ?', [user.id]);

      broadcastToChannel(user.id, { type: 'system', code: 'WS_BROADCAST_ENDED' });
    }
    sendSuccess(req, res, 'LIVE_DONE_OK');
  } catch (err) {
    console.error(err);
    sendFailure(req, res, 500, 'LIVE_DONE_FAILED');
  }
});

//from nginx
app.post('/api/recorddone', async (req, res) => {
  const streamKey = req.body.name;
  const flvPath = req.body.path;
  
  if (!flvPath) return sendFailure(req, res, 400, 'RECORD_DONE_PATH_MISSING');

  const mp4Path = flvPath.replace('.flv', '.mp4');
  const filename = path.basename(mp4Path);

  sendSuccess(req, res, 'RECORD_DONE_STARTED');

  exec(`ffmpeg -y -i "${flvPath}" -c copy "${mp4Path}"`, async (error) => {
    if (error) return console.error("FFmpeg error:", error);

    try {
      const [users] = await dbPool.execute('SELECT id, channelname FROM livesetting WHERE stream_key = ?', [streamKey]);
      if (users.length > 0) {
        const session = liveSessions.get(streamKey);
        await dbPool.execute('UPDATE videos SET filename = ? WHERE id = ?', [filename, session.videoId]);
      }
      liveSessions.delete(streamKey);

      if (fs.existsSync(flvPath)) fs.unlinkSync(flvPath);
      
      const hlsFolder = path.join(__dirname, 'media', streamKey);
      if (fs.existsSync(hlsFolder)) {
        fs.rmSync(hlsFolder, { recursive: true, force: true });
      }

      const hlsFolderPath = path.join(__dirname, 'media', streamKey);
      if (fs.existsSync(hlsFolderPath)) {
        fs.rmSync(hlsFolderPath, { recursive: true, force: true });
        console.log(`[Cleanup] HLS 임시 폴더 삭제 완료: ${hlsFolderPath}`);
      }
    } catch (err) {
        console.error("Post-process error:", err);
    }
  });
});

app.get('/api/channel/info/:channelid', async (req, res) => {
  const { channelid } = req.params;
  try {
    const [rows] = await dbPool.execute(`
      SELECT u.username, u.created_at, l.channelname, l.is_live
      FROM users u
      JOIN livesetting l ON u.id = l.id
      WHERE u.id = ?`, 
      [channelid]
    );

    if (rows.length === 0) return sendFailure(req, res, 404, 'CHANNEL_NOT_FOUND');

    sendSuccess(req, res, 'CHANNEL_INFO_FETCH_SUCCESS', rows[0]);
  } catch (err) {
    sendFailure(req, res, 500, 'CHANNEL_INFO_FETCH_FAILED');
  }
});

app.get('/api/channel/videos', async (req, res) => {
    const channelid = req.query.channelid;
    const page = parseInt(req.query.page) || 1; 
    const limit = 10; 
    const offset = (page - 1) * limit;

    try {
        const [videos] = await dbPool.query(
            'SELECT id, title, created_at FROM videos WHERE channelid = ? AND filename IS NOT NULL ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [channelid, limit, offset]
        );

        const [totalCount] = await dbPool.query(
            'SELECT COUNT(*) as count FROM videos WHERE channelid = ?',
            [channelid]
        );

        sendSuccess(req, res, 'CHANNEL_VIDEOS_FETCH_SUCCESS', {
            videos,
            currentPage: page,
            totalPages: Math.ceil(totalCount[0].count / limit)
        });
    } catch (err) {
        sendFailure(req, res, 500, 'CHANNEL_VIDEOS_FETCH_FAILED');
        console.log(err);
    }
});

app.get('/api/video/info', async (req, res) => {
  const videoId = req.query.id;
  try {
    const [rows] = await dbPool.query('SELECT * FROM videos WHERE id = ?', [videoId]);
    
    if (rows.length === 0) return sendFailure(req, res, 404, 'VIDEO_NOT_FOUND');
    const video = rows[0];
    const fullVideoUrl = `${NGINX_SERVER}/recordings/${video.filename}`;
    sendSuccess(req, res, 'VIDEO_INFO_FETCH_SUCCESS', {
      ...video,
      url: fullVideoUrl
    });
  } catch (err) {
    console.error(err);
    sendFailure(req, res, 500, 'VIDEO_INFO_FETCH_FAILED');
  }
});

//from nginx, url(username/filename) to streamkey/filename
app.get('/api/proxy/:channelid/:filename', async (req, res) => {
  const { channelid, filename } = req.params;
  try {
    const [rows] = await dbPool.execute('SELECT stream_key FROM livesetting WHERE id = ?', [channelid]);

    if (rows.length === 0) return sendFailure(req, res, 404, 'USER_NOT_FOUND');
    
    const streamKey = rows[0].stream_key;

    const internalPath = `/internal_hls/${streamKey}/${filename}`;
    
    res.setHeader('X-Accel-Redirect', internalPath);
    res.end(); 
  } catch (err) {
    sendFailure(req, res, 500, 'PROXY_ERROR');
    console.error(err);
  }
});

app.get('/api/mainpage', async (req, res) => {
  try {
    const [lives] = await dbPool.execute(
      'SELECT id, channelname FROM livesetting WHERE is_live = 1 LIMIT 16'
    );
    const [videos] = await dbPool.execute(
      'SELECT id, title, channelid FROM videos WHERE filename IS NOT NULL ORDER BY created_at LIMIT 16'
    );
    sendSuccess(req, res, 'MAINPAGE_FETCH_SUCCESS', {
      sections: [
      {
        title: "지금 라이브 중!",
        list: lives.map(l => ({
          title: l.channelname,
          channelid: l.channelname,
          link: `/live/${l.id}`
        }))
      },
      {
        title: "인기 비디오",
        list: videos.map(v => ({
          title: v.title,
          channelid: v.channelid,
          link: `/video/${v.id}`
        }))
      }
      ]
    });
  } catch (err) {
    console.error('라이브 목록 조회 오류:', err);
    sendFailure(req, res, 500, 'LIVE_LIST_FETCH_FAILED');
  }
});

app.get('/api/liveurl', async (req, res) => {
  sendSuccess(req, res, 'LIVE_URL_FETCH_SUCCESS', { url: `${NGINX_SERVER}/live/${req.query.channelid}/index.m3u8` });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return sendFailure(req, res, 400, 'LOGIN_MISSING_FIELDS');
  }
  try {
    const [rows] = await dbPool.execute(
      'SELECT id, email, username, password_hash, role FROM users WHERE email = ?',
      [email.trim()]
    );
    if (rows.length === 0) {
      return sendFailure(req, res, 401, 'LOGIN_INVALID_CREDENTIALS');
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) {
      return sendFailure(req, res, 401, 'LOGIN_INVALID_CREDENTIALS');
    }
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    sendSuccess(req, res, 'LOGIN_SUCCESS', {
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      token
    });
  } catch (err) {
    console.error('로그인 오류:', err);
    sendFailure(req, res, 500, 'LOGIN_FAILED');
  }
});

app.post('/api/signup', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return sendFailure(req, res, 400, 'SIGNUP_MISSING_FIELDS');
  }
  if (password.length < 6) {
    return sendFailure(req, res, 400, 'SIGNUP_PASSWORD_TOO_SHORT');
  }
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await dbPool.execute(
      'INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, 1)',
      [email.trim(), username.trim(), password_hash]
    );
    const userId = result.insertId;
    const stream_key = generateStreamKey(userId);
    await dbPool.execute('INSERT INTO livesetting (id, channelname, stream_key) VALUES (?, ?, ?)', [userId, username.trim(), stream_key]);
    sendSuccess(req, res, 'SIGNUP_SUCCESS');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return sendFailure(req, res, 409, 'SIGNUP_DUPLICATE_EMAIL');
    }
    console.log('회원가입 오류:', err);
    sendFailure(req, res, 500, 'SIGNUP_FAILED');
  }
});

async function regenerateStreamKey(channelid){
  try {
    //TODO 방송중이면 방어
    const stream_key = generateStreamKey(channelid);
    await dbPool.execute('UPDATE livesetting SET stream_key = ? WHERE id = ?', [stream_key, channelid]);
    return stream_key;
  } catch (err) {
    return null;
  }
}

app.post('/api/me/streamkey', authMiddleware, async (req, res) => {
  try {
    const channelid = req.user.id; 

    let [rows] = await dbPool.execute(
      'SELECT stream_key FROM livesetting WHERE id = ?',
      [channelid]
    );
    if (rows.length === 0) return sendFailure(req, res, 404, 'USER_NOT_FOUND');
    let stream_key = rows[0].stream_key;
    if (!stream_key) {
      stream_key = await regenerateStreamKey(channelid);
    }
    sendSuccess(req, res, 'STREAM_KEY_FETCH_SUCCESS', { stream_key });
  } catch (err) {
    console.log('스트림 키 조회 오류:', err);
    sendFailure(req, res, 500, 'STREAM_KEY_FETCH_FAILED');
  }
});

app.post('/api/me/stream-key/regenerate', authMiddleware, async (req, res) => {
  const channelid = req.user.id;
  const stream_key = await regenerateStreamKey(channelid);
  if(stream_key !== null){
    sendSuccess(req, res, 'STREAM_KEY_REGENERATE_SUCCESS', { stream_key });
  }
  else{
    console.error('스트림 키 재발급 오류');
    sendFailure(req, res, 500, 'STREAM_KEY_REGENERATE_FAILED');
  }
});

app.post('/api/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [rows] = await dbPool.execute(
      'SELECT id, email, username, role, created_at FROM users ORDER BY id'
    );
    sendSuccess(req, res, 'USERS_FETCH_SUCCESS', { users: rows });
  } catch (err) {
    console.error('유저 목록 조회 오류:', err);
    sendFailure(req, res, 500, 'USERS_FETCH_FAILED');
  }
});

app.patch('/api/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const { role } = req.body;
  if (role === undefined || role === null) {
    return sendFailure(req, res, 400, 'ROLE_MISSING');
  }
  const r = Number(role);
  if (!Number.isInteger(r) || r < 1 || r > 4) {
    return sendFailure(req, res, 400, 'ROLE_INVALID');
  }
  try {
    const [result] = await dbPool.execute('UPDATE users SET role = ? WHERE id = ?', [r, userId]);
    if (result.affectedRows === 0) {
      return sendFailure(req, res, 404, 'USER_NOT_FOUND');
    }
    sendSuccess(req, res, 'ROLE_UPDATED');
  } catch (err) {
    console.error('권한 변경 오류:', err);
    sendFailure(req, res, 500, 'ROLE_UPDATE_FAILED');
  }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/livechat' });

wss.on('connection', async (ws, req) => {
  let channelid = '';

  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    channelid = requestUrl.searchParams.get('channelid') || '';
    const token = requestUrl.searchParams.get('token');

    if (!channelid) {
      sendWsError(ws, 'WS_CHANNEL_ID_REQUIRED', true);
      return;
    }

    ws.channelid = channelid;
    ws.user = decodeWsUser(token);
    if(ws.user == null){
      sendWsError(ws, 'AUTH_REQUIRED', true);
      return;
    }

    const [userRows] = await dbPool.execute('SELECT username FROM users WHERE id = ?', [ws.user.id]);
    if (userRows.length === 0) {
      sendWsError(ws, 'USER_NOT_FOUND');
      return;
    }
    ws.user.username= userRows[0].username
    getChannelClients(channelid).add(ws);
  } catch (err) {
    sendWsError(ws, 'WS_CONNECTION_INIT_FAILED', true);
    return;
  }

  ws.on('message', async (rawData) => {
    let parsed;
    try {
      parsed = JSON.parse(rawData.toString());
    } catch (err) {
      sendWsError(ws, 'WS_INVALID_MESSAGE_FORMAT');
      return;
    }

    if (parsed.type !== 'chat') {
      return;
    }

    const text = typeof parsed.message === 'string' ? parsed.message.trim() : '';
    if (!text) {
      sendWsError(ws, 'WS_MESSAGE_REQUIRED');
      return;
    }

    if (!ws.user) {
      sendWsError(ws, 'AUTH_REQUIRED');
      return;
    }

    try {
      const [userRows] = await dbPool.execute('SELECT username FROM users WHERE id = ?', [ws.user.id]);
      if (userRows.length === 0) {
        sendWsError(ws, 'USER_NOT_FOUND');
        return;
      }

      const [rows] = await dbPool.execute('SELECT stream_key FROM livesetting WHERE id = ?', [ws.user.id]);
      if (rows.length === 0) {
        sendWsError(ws, 'CHANNEL_NOT_FOUND', true);
        return;
      }
      const streamKey = rows[0].stream_key;

      const session = liveSessions.get(streamKey);
      if (!session) {
        sendWsError(ws, 'WS_SESSION_NOT_FOUND');
        return;
      }
      await dbPool.execute(
        'INSERT INTO chats (video_id, channelid, username, message) VALUES (?, ?, ?, ?)',
        [session.videoId, ws.user.id, ws.user.username, text]
      );

      const chatMessage = {
        username: userRows[0].username,
        message: text,
        created_at: new Date().toISOString(),
      };
      broadcastToChannel(ws.channelid, {
        type: 'chat',
        message: chatMessage,
      });
    } catch (err) {
      sendWsError(ws, 'WS_CHAT_SEND_FAILED');
      console.log('채팅 전송 에러', err);
    }
  });

  ws.on('close', () => {
    if (!channelid) return;
    const clients = wsChannels.get(channelid);
    if (!clients) return;
    clients.delete(ws);
    if (clients.size === 0) {
      wsChannels.delete(channelid);
    }
  });
});

server.listen(4000, () => console.log('API Server running on port 4000'));

