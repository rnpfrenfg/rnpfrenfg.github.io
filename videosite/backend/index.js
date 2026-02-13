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

app.get('/static/js/admin.js', (req, res, next) => {
  const token = req.headers.authorization;
  
  if (!token) return res.status(403).send('Access Denied');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role >= 2) {
      next();
    } else {
      res.status(403).send('Forbidden');
    }
  } catch (err) {
    res.status(403).send('Invalid Token');
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

//from nginx
app.post('/api/livestartauth', async (req, res) => {
  try{
      const streamKey = req.body.name;

    const [dbres] = await dbPool.execute('SELECT id, channelname FROM livesetting WHERE stream_key = ?', [streamKey]);

    if (dbres.length < 1) {
      res.status(404).send();
      return;
    }
    res.status(200).send();

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

      broadcastToChannel(user.id, { type: 'chat', message: '방송이 종료되었습니다.' });
    }
    res.status(200).send();
  } catch (err) {
    console.error(err);
    res.status(500).send();
  }
});

//from nginx
app.post('/api/recorddone', async (req, res) => {
  const streamKey = req.body.name;
  const flvPath = req.body.path;
  
  if (!flvPath) return res.status(400).send('No path');

  const mp4Path = flvPath.replace('.flv', '.mp4');
  const filename = path.basename(mp4Path);

  res.send('Started');

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

    if (rows.length === 0) return res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
    
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: '서버 오류' });
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

        res.json({
            videos,
            currentPage: page,
            totalPages: Math.ceil(totalCount[0].count / limit)
        });
    } catch (err) {
        res.status(500).json({ error: '비디오 목록을 불러오지 못했습니다.' });
        console.log(err);
    }
});

app.get('/api/video/info', async (req, res) => {
  const videoId = req.query.id;
  try {
    const [rows] = await dbPool.query('SELECT * FROM videos WHERE id = ?', [videoId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '비디오를 찾을 수 없습니다.' });
    }
    const video = rows[0];
    const fullVideoUrl = `${NGINX_SERVER}/recordings/${video.filename}`;
    res.json({
      ...video,
      url: fullVideoUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

//from nginx, url(username/filename) to streamkey/filename
app.get('/api/proxy/:channelid/:filename', async (req, res) => {
  const { channelid, filename } = req.params;
  try {
    const [rows] = await dbPool.execute('SELECT stream_key FROM livesetting WHERE id = ?', [channelid]);

    if (rows.length === 0) return res.status(404).send('User not found');
    
    const streamKey = rows[0].stream_key;

    const internalPath = `/internal_hls/${streamKey}/${filename}`;
    
    res.setHeader('X-Accel-Redirect', internalPath);
    res.end(); 
  } catch (err) {
    res.status(500).send('Proxy Error');
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
    res.status(200).json([
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
    ]);
  } catch (err) {
    console.error('라이브 목록 조회 오류:', err);
    res.status(500).json({ error: '라이브 목록을 불러오지 못했습니다.' });
  }
});

app.get('/api/liveurl', async (req, res) => {
  res.status(201).send({url:`${NGINX_SERVER}/live/${req.query.channelid}/index.m3u8`})
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }
  try {
    const [rows] = await dbPool.execute(
      'SELECT id, email, username, password_hash, role FROM users WHERE email = ?',
      [email.trim()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
      token
    });
  } catch (err) {
    console.error('로그인 오류:', err);
    res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
  }
});

app.post('/api/signup', async (req, res) => {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    return res.status(400).json({ error: '이메일, 사용자명, 비밀번호를 모두 입력해주세요.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
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
    res.status(201).json({ message: '회원가입이 완료되었습니다.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
    }
    console.log('회원가입 오류:', err);
    res.status(500).json({ error: '회원가입 처리 중 오류가 발생했습니다.' });
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
    if (rows.length === 0) {
      return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    }
    let stream_key = rows[0].stream_key;
    if (!stream_key) {
      stream_key = await regenerateStreamKey(channelid);
    }
    res.json({ stream_key });
  } catch (err) {
    console.log('스트림 키 조회 오류:', err);
    res.status(500).json({ error: '스트림 키를 불러오지 못했습니다.' });
  }
});

app.post('/api/me/stream-key/regenerate', authMiddleware, async (req, res) => {
  const channelid = req.user.id;
  const stream_key = await regenerateStreamKey(channelid);
  if(stream_key !== null){
    res.json({ message: '새 스트림 키가 발급되었습니다.', stream_key });
  }
  else{
    console.error('스트림 키 재발급 오류');
    res.status(500).json({ error: '스트림 키 재발급에 실패했습니다.' });
  }
});

app.post('/api/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [rows] = await dbPool.execute(
      'SELECT id, email, username, role, created_at FROM users ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    console.error('유저 목록 조회 오류:', err);
    res.status(500).json({ error: '유저 목록을 불러오지 못했습니다.' });
  }
});

app.patch('/api/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const { role } = req.body;
  if (role === undefined || role === null) {
    return res.status(400).json({ error: '권한(role) 값을 보내주세요.' });
  }
  const r = Number(role);
  if (!Number.isInteger(r) || r < 1 || r > 4) {
    return res.status(400).json({ error: '권한은 1~4 사이의 숫자여야 합니다.' });
  }
  try {
    const [result] = await dbPool.execute('UPDATE users SET role = ? WHERE id = ?', [r, userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '해당 유저를 찾을 수 없습니다.' });
    }
    res.json({ message: '권한이 변경되었습니다.', role: r });
  } catch (err) {
    console.error('권한 변경 오류:', err);
    res.status(500).json({ error: '권한 변경에 실패했습니다.' });
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
      ws.send(JSON.stringify({ type: 'error', error: 'channelid is required' }));
      ws.close();
      return;
    }

    ws.channelid = channelid;
    ws.user = decodeWsUser(token);
    if(ws.user == null){
      ws.send(JSON.stringify({ type: 'error', error: 'login plz' }));
      ws.close();
      return;
    }

    const [userRows] = await dbPool.execute('SELECT username FROM users WHERE id = ?', [ws.user.id]);
    if (userRows.length === 0) {
      ws.send(JSON.stringify({ type: 'error', error: '유저를 찾을 수 없습니다.' }));
      return;
    }
    ws.user.username= userRows[0].username
    getChannelClients(channelid).add(ws);
  } catch (err) {
    ws.send(JSON.stringify({ type: 'error', error: '채팅 연결 초기화 실패' }));
    ws.close();
    return;
  }

  ws.on('message', async (rawData) => {
    let parsed;
    try {
      parsed = JSON.parse(rawData.toString());
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', error: '잘못된 메시지 형식입니다.' }));
      return;
    }

    if (parsed.type !== 'chat') {
      return;
    }

    const text = typeof parsed.message === 'string' ? parsed.message.trim() : '';
    if (!text) {
      ws.send(JSON.stringify({ type: 'error', error: '메시지를 입력해주세요.' }));
      return;
    }

    if (!ws.user) {
      ws.send(JSON.stringify({ type: 'error', error: '로그인이 필요합니다.' }));
      return;
    }

    try {
      const [userRows] = await dbPool.execute('SELECT username FROM users WHERE id = ?', [ws.user.id]);
      if (userRows.length === 0) {
        ws.send(JSON.stringify({ type: 'error', error: '유저를 찾을 수 없습니다.' }));
        return;
      }

      const [rows] = await dbPool.execute('SELECT stream_key FROM livesetting WHERE id = ?', [ws.user.id]);
      if (rows.length === 0) {
        ws.send(JSON.stringify({ type: 'error', error: '방송을 찾을 수 없습니다.' }));
        ws.close();
        return;
      }
      const streamKey = rows[0].stream_key;

      const session = liveSessions.get(streamKey);
      if (!session) {
        ws.send(JSON.stringify({ type: 'error', error: '로그인이 필요합니다.' }));
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
      ws.send(JSON.stringify({ type: 'error', error: '채팅 전송 실패' }));
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
