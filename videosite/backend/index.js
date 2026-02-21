const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt')
const fs = require('fs');
const http = require('http');
require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');

const { createChatBatchWriter } = require('./chatbatch');
const { startChatServer } = require('./chat');
const { initDB, createDbPool } = require('./db');
const { authMiddleware, requireAdmin, signAccessToken, setAuthCookies, clearAuthCookies } = require('./auth');

process.on('unhandledRejection', (reason, promise) => {
    console.error('\x1b[31m%s\x1b[0m', '[UnHandled Rejection] ', reason);
});

process.on('uncaughtException', (err) => {
    console.error('\x1b[31m%s\x1b[0m', '[Uncaught Exception] ', err);
});

const debug = true;

const LIVEFOLDER = path.join(__dirname, 'media');
const VIDEOFOLDER = path.join(__dirname, 'mediaend');
const THUMBNAILFOLDER = path.join(__dirname, 'mediathumbnail');

const directories = [LIVEFOLDER, VIDEOFOLDER, THUMBNAILFOLDER];
directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[System] 폴더 생성 완료: ${dir}`);
    }
});

const JWT_SECRET = process.env.JWT_SECRET;
if(JWT_SECRET == undefined || JWT_SECRET == null){
    console.error(".env 파일의 JWT_SECRET이 작성되지 않았습니다.");
    process.exit(1);
}

const LIVE_THUMB_INTERVAL_MS = 5 * 1000;
const LIVE_THUMB_REFRESH_MS = 20 * 1000;
const LIVE_THUMB_WARMUP_MS = 15 * 1000;
// videoid -> lastGeneratedAt, version, inProgress
const liveThumbState = new Map();
let liveThumbQueue = Promise.resolve();
let liveThumbScheduler = null;

const NGINX_SERVER = 'http://localhost:8080';

// streamkey -> videoid, startTime,isLive: true
const liveSessions = new Map();
const channelIdToStreamKey = new Map();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 20, // TODO : mysql의 show variables like 'max_connections' 등에 따라 동적으로 결정;
  queueLimit: 0
};

const allowedOrigins = new Set();
allowedOrigins.add(process.env.FRONTEND_ORIGINS);
allowedOrigins.add("http://localhost");
allowedOrigins.add("http://localhost:3000");

let dbPool;
let chatServer;

startServer();

async function startServer(){
  try {
    dbPool = await createDbPool(dbConfig);
    await initDB(dbPool, dbConfig);
    await dbPool.execute('UPDATE livesetting SET is_live = 0 WHERE is_live = 1') // TODO : 처리되지 않은 동영상 파일 처리, video 테이블도 정리
    
    const app = express();
    app.use(cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        return cb(null, allowedOrigins.has(origin));
      },
      credentials: true,
    }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    if(debug){
      app.use((req, res, next) => {
        const start = Date.now();
        const { method, url } = req;

        res.on('finish', () => {
            const duration = Date.now() - start;
            if(duration > 10)
              console.log(`[API] [${new Date().toISOString()}] ${method} ${url} ${res.statusCode} - ${duration}ms`);
        });

        next();
      });
    }

    addServerAction(app);

    const chatBatch = createChatBatchWriter(dbPool);
    chatBatch.start();
    const server = http.createServer(app);

    chatServer = await startChatServer(
      server,
      liveSessions,
      channelIdToStreamKey,
      chatBatch,
      async (userid) => {
        const [userRows] = await dbPool.execute('SELECT username FROM users WHERE id = ?', [userid]);
        if (userRows.length === 0) return null;
        return userRows[0].username;
      }
    );

    server.listen(4000, () => console.log('API Server running on port 4000'));
    startLiveThumbnailScheduler();
  }
  catch(err){
    console.log('server err', err);
  }
}

function addServerAction(app){
  app.get('/static/js/admin.js', authMiddleware, requireAdmin, (req, res, next) => {
    next();
  });

  //from nginx, url(channelid/filename) to streamkey/filename
  app.get('/api/proxy/:channelid/:filename', async (req, res) => {
    const { channelid, filename } = req.params;
    try {
      const cachedStreamKey = channelIdToStreamKey.get(channelid);
      if (cachedStreamKey) {
        const internalPath = `/internal_hls/${cachedStreamKey}/${filename}`;
        res.setHeader('X-Accel-Redirect', internalPath);
        return res.end();
      }

      sendFailure(req, res, 404, 'USER_NOT_FOUND');
    } catch (err) {
      sendFailure(req, res, 500, 'PROXY_ERROR');
      console.error(err);
    }
  });

  //from nginx
  app.post('/api/livestartauth', async (req, res) => {
    try{
        const streamKey = req.body.name;

      const [dbres] = await dbPool.execute('SELECT id, channelname FROM livesetting WHERE stream_key = ?', [streamKey]);

      if (dbres.length < 1) {
        sendFailure(req, res, 404, 'LIVE_START_AUTH_NOT_FOUND');
        return;
      }

      const channel = dbres[0];
      channelIdToStreamKey.set(String(channel.id), streamKey);
      const [result] = await dbPool.execute(
        'INSERT INTO videos (channelid, title) VALUES (?, ?)',
        [channel.id, `${channel.channelname}님의 방송`]
      );
      await dbPool.execute('UPDATE livesetting SET is_live = 1 WHERE stream_key = ?', [streamKey]);
      sendSuccess(req, res, 'LIVE_START_AUTH_OK');

      const videoid = result.insertId;
      liveSessions.set(streamKey, { videoid, startTime: Date.now(), isLive: true });
      getOrCreateLiveThumbState(videoid);
    }
    catch(err){
        sendFailure(req, res, 404, 'LIVE_START_AUTH_NOT_FOUND');
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
        const channelid = users[0].id;
        await dbPool.execute('UPDATE livesetting SET is_live = 0 WHERE id = ?', [channelid]);
        channelIdToStreamKey.delete(channelid);

        const session = liveSessions.get(streamKey);
        if (session) session.isLive = false;

        chatServer.broadcastToChannel(channelid, 'system', 'WS_BROADCAST_ENDED');
        chatServer.closeChannel(channelid);
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

    const session = liveSessions.get(streamKey);
    const videoid = session?.videoid;

    if(!((Number.isInteger(videoid) && videoid > 0))) {
      console.warn('[RecordDone] Invalid videoid:', videoid);
      return sendFailure(req, res, 400, 'RECORD_DONE_VIDEO_ID_INVALID');
    }

    const mp4Path = path.join(VIDEOFOLDER, `${videoid}.mp4`);
    const filename = path.basename(mp4Path);

    sendSuccess(req, res, 'RECORD_DONE_STARTED');

    exec(`ffmpeg -y -i "${flvPath}" -c copy "${mp4Path}"`, async (error) => {
      if (error) return console.error("FFmpeg error:", error);

      try {
        const [users] = await dbPool.execute('SELECT id, channelname FROM livesetting WHERE stream_key = ?', [streamKey]);
        if (users.length === 0) {
          return console.warn('[RecordDone] Invalid streamKey:', streamKey);
        }
        await dbPool.execute('UPDATE videos SET filename = ? WHERE id = ?', [filename, videoid]);
        liveSessions.delete(streamKey);
        liveThumbState.delete(videoid);
        createMediaThumbnail(videoid);

        if (fs.existsSync(flvPath)) fs.unlinkSync(flvPath);
        
        const hlsFolder = path.join(VIDEOFOLDER, streamKey);
        if (fs.existsSync(hlsFolder)) {
          fs.rmSync(hlsFolder, { recursive: true, force: true });
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
              'SELECT COUNT(*) as count FROM videos WHERE channelid = ? AND filename IS NOT NULL',
              [channelid]
          );

          sendSuccess(req, res, 'CHANNEL_VIDEOS_FETCH_SUCCESS', {
              videos,
              currentPage: page,
              totalPages: Math.max(1, Math.ceil(Number(totalCount?.[0]?.count ?? 0) / limit))
          });
      } catch (err) {
          sendFailure(req, res, 500, 'CHANNEL_VIDEOS_FETCH_FAILED');
          console.log(err);
      }
  });

  app.get('/api/video/info', async (req, res) => {
    const videoid = req.query.id;
    try {
      const [rows] = await dbPool.query('SELECT * FROM videos WHERE id = ?', [videoid]);
      
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

  app.get('/api/video/:id/chat', async (req, res) => {
    const videoid = Number(req.params.id);
    const atSeconds = Number(req.query.at);
    const windowSeconds = Number(req.query.window ?? 5);

    if (!Number.isInteger(videoid) || videoid <= 0) {
      return sendFailure(req, res, 400, 'VIDEO_ID_INVALID');
    }
    if (!Number.isFinite(atSeconds) || atSeconds < 0) {
      return sendFailure(req, res, 400, 'CHAT_AT_INVALID');
    }

    const safeWindow = Number.isFinite(windowSeconds) && windowSeconds > 0 ? Math.min(windowSeconds, 30) : 5;
    const fromSec = Math.max(0, Math.floor(atSeconds - safeWindow));
    const toSec = Math.max(0, Math.floor(atSeconds + safeWindow));

    try {
      const [videos] = await dbPool.query('SELECT created_at FROM videos WHERE id = ?', [videoid]);
      if (videos.length === 0) return sendFailure(req, res, 404, 'VIDEO_NOT_FOUND');
      const baseTime = videos[0].created_at;

      const [rows] = await dbPool.execute(
        `SELECT id, username, message, created_at
        FROM chats
        WHERE video_id = ?
          AND created_at BETWEEN DATE_ADD(?, INTERVAL ? SECOND) AND DATE_ADD(?, INTERVAL ? SECOND)
        ORDER BY created_at ASC
        LIMIT 200`,
        [videoid, baseTime, fromSec, baseTime, toSec]
      );

      return sendSuccess(req, res, 'VIDEO_CHAT_FETCH_SUCCESS', { messages: rows });
    } catch (err) {
      console.error(err);
      return sendFailure(req, res, 500, 'VIDEO_CHAT_FETCH_FAILED');
    }
  });
  app.get('/thumbnail/:id', async (req, res) => {
    const videoid = req.params.id;
    if (!videoid) {
      return sendFailure(req, res, 400, 'VIDEO_ID_INVALID');
    }

    try {
      const thumbPath = getVideoThumbnailPath(videoid);
      if (!fs.existsSync(thumbPath)) return sendFailure(req, res, 404, 'THUMBNAIL_NOT_FOUND');

      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(thumbPath);
    } catch (err) {
      console.error(err);
      return sendFailure(req, res, 500, 'THUMBNAIL_FETCH_FAILED');
    }
  });

  app.get('/api/mainpage', async (req, res) => {
    try {
      const [lives] = await dbPool.execute(
        'SELECT id, channelname, stream_key FROM livesetting WHERE is_live = 1 LIMIT 16'
      );
      const [videos] = await dbPool.execute(
        'SELECT id, title, channelid FROM videos WHERE filename IS NOT NULL ORDER BY created_at DESC LIMIT 16'
      );
      sendSuccess(req, res, 'MAINPAGE_FETCH_SUCCESS', {
        sections: [
        {
          title: "지금 라이브 중!",
          list: lives.map((l) => {
            const session = liveSessions.get(l.stream_key);
            const videoid = session?.videoid ?? null;
            const thumbnail = liveThumbState.get(videoid)?.version ?? null;
            return {
              title: l.channelname,
              channelid: l.id,
              link: `/live/${l.id}`,
              thumbnail: (videoid && thumbnail > 0) ? (`/thumbnail/${videoid}?v=${thumbnail}`) : null,
            };
          })
        },
        {
          title: "인기 비디오",
          list: videos.map(v => {
            return {
              title: v.title,
              channelid: v.channelid,
              link: `/video/${v.id}`,
              thumbnail: `/thumbnail/${v.id}`
            }
          })
        }
        ]
      });
    } catch (err) {
      console.error('라이브 목록 조회 오류:', err);
      sendFailure(req, res, 500, 'LIVE_LIST_FETCH_FAILED');
    }
  });

  app.get('/api/liveurl', async (req, res) => {
    sendSuccess(req, res, 'LIVE_URL_FETCH_SUCCESS', { url: buildLiveUrl(req.query.channelid) });
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
      const accessMaxAgeSec = 7 * 24 * 60 * 60;
      const token = signAccessToken({ userId: user.id, role: user.role }, { expiresIn: '7d' });
      setAuthCookies(res, { accessToken: token, accessMaxAgeSec });

      sendSuccess(req, res, 'LOGIN_SUCCESS', {
        user: { id: user.id, email: user.email, username: user.username, role: user.role },
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

  app.post('/api/logout', (req, res) => {
    clearAuthCookies(res);
    return sendSuccess(req, res, 'LOGOUT_SUCCESS');
  });

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

  app.post('/api/users/:id', authMiddleware, requireAdmin, async (req, res) => {
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
}
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

function buildLiveUrl(channelid) {
  const id = String(channelid || '').trim();
  return `${NGINX_SERVER}/live/${id}/index.m3u8`;
}

function getLiveHlsIndexPath(streamKey) {
  return path.join(LIVEFOLDER, streamKey, 'index.m3u8');
}

function sendSuccess(req, res, code, data = null) {
  return res.status(200).json({ code, ...data });
}
function sendFailure(req, res, status, code) {
  const warnLevel = status >= 500 ? 2 : status >= 400 ? 1 : 0;
  console.log(`[${warnLevel}] bad request! code : [${req.method}][${req.originalUrl}] : ${code}`);
  return res.status(status).json({ code });
}

function getOrCreateLiveThumbState(videoid) {
  const id = Number(videoid);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!liveThumbState.has(id)) {
    liveThumbState.set(id, { lastGeneratedAt: 0, version: 0, inProgress: false });
  }
  return liveThumbState.get(id);
}

async function updateLiveThumbnail(videoid, streamKey) {
  const id = Number(videoid);
  if (!Number.isInteger(id) || id <= 0) return false;
  if (!streamKey) return false;

  const m3u8Path = getLiveHlsIndexPath(streamKey);
  if (!fs.existsSync(m3u8Path)) return false;

  const thumbPath = getVideoThumbnailPath(id);
  const tmpPath = `${thumbPath}.tmp.jpg`;

  const state = getOrCreateLiveThumbState(id);
  const now = Date.now();
  if (state) {
    state.lastGeneratedAt = now;
  }
  try {
    if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true });

    exec(`ffmpeg -y -hide_banner -loglevel error -i "${m3u8Path}" -frames:v 1 -q:v 2 -f image2 "${tmpPath}"`, async (error) => {
      if (error) return console.error("FFmpeg error:", error);

      if (!fs.existsSync(tmpPath)) return false;
      if (fs.existsSync(thumbPath)) fs.rmSync(thumbPath, { force: true });
      fs.renameSync(tmpPath, thumbPath);
      state.version = now;
      return true;
    });
  } catch (err) {
    console.warn('[LiveThumbnail] ffmpeg error:', err?.message || err);
    try {
      if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath, { force: true });
    } catch {}
    return false;
  }
}

function startLiveThumbnailScheduler() {
  if (liveThumbScheduler) return;

  liveThumbScheduler = setInterval(() => {
    const now = Date.now();

    for (const [streamKey, session] of liveSessions.entries()) {
      if (!session?.isLive) continue;
      const videoid = session?.videoid;
      const state = getOrCreateLiveThumbState(videoid);
      if (!state) continue;
      if (state.inProgress) continue;
      if (now - (session?.startTime || 0) < LIVE_THUMB_WARMUP_MS) continue;
      if (state.lastGeneratedAt && now - state.lastGeneratedAt < LIVE_THUMB_REFRESH_MS) continue;

      state.inProgress = true;
      liveThumbQueue = liveThumbQueue
        .then(async () => {
          try {
            await updateLiveThumbnail(videoid, streamKey);
          } finally {
            state.inProgress = false;
          }
        })
        .catch((err) => {
          state.inProgress = false;
          console.warn('[LiveThumbnail] queue error:', err?.message || err);
        });
    }
  }, LIVE_THUMB_INTERVAL_MS);
}

function getVideoThumbnailPath(videoid){
  return path.join(THUMBNAILFOLDER, `${videoid}.jpg`);
}

function getVideoPath(videoid){
  return path.join(VIDEOFOLDER, `${videoid}.mp4`);
}

async function createMediaThumbnail(videoid) {
  const id = Number(videoid);
  const thumbPath = getVideoThumbnailPath(id);

  if (fs.existsSync(thumbPath)) return thumbPath;

  try {
    const videoPath = getVideoPath(videoid);
    if (!fs.existsSync(videoPath)) return null;

    exec(`ffmpeg -y -ss 00:00:01 -i "${videoPath}" -frames:v 1 -q:v 2 "${thumbPath}"`, async (error) => {
      if (error) return console.error("FFmpeg error:", error);
    });

    return fs.existsSync(thumbPath) ? thumbPath : null;
  } catch (err) {
    console.warn('[Thumbnail] FFmpeg error:', err?.message || err);
    return null;
  }
}

function generateStreamKey(userId) {
  return `user_${userId}_${Date.now()}`;
}
