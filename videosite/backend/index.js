const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken');
const fs = require('fs');
require('dotenv').config();

if (!fs.existsSync('./media')) {
    fs.mkdirSync('./media', { recursive: true });
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const MIN_ADMIN_ROLE = 3;

function generateStreamKey(userId) {
  return `user_${userId}_${Date.now()}`;
}

const dbConfig = {
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
};

async function initDB() {
  let authenticated = false;
  let retryCount = 0;
  const maxRetries = 10;

  while (!authenticated && retryCount < maxRetries) {
    try {
      console.log({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
      });
      const conn = await mysql.createConnection({
        host: dbConfig.host,
        user: dbConfig.user,
        password: dbConfig.password,
      });
      
      console.log("DB 접속 성공! 테이블 초기화를 시작합니다.");
      
      await conn.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
      await conn.query(`USE ${dbConfig.database}`);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS channels (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) DEFAULT 'My Live Stream',
          stream_key VARCHAR(255) UNIQUE NOT NULL,
          is_live TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await conn.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          username VARCHAR(100) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role TINYINT DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await conn.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        channel_owner VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
      `);
      try {
        await conn.query('ALTER TABLE users ADD COLUMN role TINYINT DEFAULT 1');
      } catch (alterErr) {
        if (alterErr.code !== 'ER_DUP_FIELDNAME') throw alterErr;
      }
      try {
        await conn.query('ALTER TABLE users ADD COLUMN stream_key VARCHAR(255) UNIQUE NULL');
      } catch (alterErr) {
        if (alterErr.code !== 'ER_DUP_FIELDNAME') throw alterErr;
      }
      try {
        await conn.query('ALTER TABLE users ADD COLUMN is_live TINYINT(1) DEFAULT 0');
      } catch (alterErr) {
        if (alterErr.code !== 'ER_DUP_FIELDNAME') throw alterErr;
      }

      authenticated = true;
      await conn.end();
      console.log("DB 초기화가 종료되었습니다.");
    } catch (err) {
      retryCount++;
      console.log(`DB 접속 실패 (시도 ${retryCount}/${maxRetries}): ${err.message}`);
      console.log("5초 후 다시 시도합니다...");
      await new Promise(res => setTimeout(res, 5000));
    }
  }

  if (!authenticated) {
    console.error("DB 접속 실패. 서버를 가동하지 않습니다.");
    process.exit(1);
  }
};

initDB();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/auth', async (req, res) => {
    const streamKey = req.body.name;

    const conn = await mysql.createConnection(dbConfig);
    const [user] = await conn.execute(
      'SELECT id FROM users WHERE stream_key = ?', 
      [streamKey]
    );

    if (user.length > 0) {
      await conn.execute('UPDATE users SET is_live = 1 WHERE stream_key = ?', [streamKey]);
      res.status(200).send();
    } else {
      res.status(404).send();
    }
    await conn.end();
});

app.get('/api/proxy/:username/:filename', async (req, res) => {
    const { username, filename } = req.params;
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [rows] = await conn.execute('SELECT stream_key FROM users WHERE username = ?', [username]);
        await conn.end();

        if (rows.length === 0) return res.status(404).send('User not found');
        
        const streamKey = rows[0].stream_key;

        const internalPath = `/internal_hls/${streamKey}/${filename}`;
        
        res.setHeader('X-Accel-Redirect', internalPath);
        res.end(); 
    } catch (err) {
        res.status(500).send('Proxy Error');
    }
});

app.get('/api/live', async (req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(
      'SELECT id, username FROM users WHERE is_live = 1 AND stream_key IS NOT NULL'
    );
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error('라이브 목록 조회 오류:', err);
    res.status(500).json({ error: '라이브 목록을 불러오지 못했습니다.' });
  }
});

app.get('/api/livechat/:username', async (req, res) => {
  const channelOwner = req.params.username;
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(
      'SELECT username, message, created_at FROM chats WHERE channel_owner = ? ORDER BY created_at DESC LIMIT 30',
      [channelOwner]
    );
    conn.end();
    res.json(rows.reverse());
  } catch (err) {
    res.status(500).json({ error: '채팅을 불러오지 못했습니다.' });
    console.log(err);
  }
});

app.post('/api/livechat/:username', authMiddleware, async (req, res) => {
  const channelOwner = req.params.username;
  const { message } = req.body;
  
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [userRows] = await conn.execute('SELECT username FROM users WHERE id = ?', [req.user.id]);
    const senderName = userRows[0].username;

    await conn.execute(
      'INSERT INTO chats (username, channel_owner, message) VALUES (?, ?, ?)',
      [senderName, channelOwner, message]
    );
    conn.end();
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '채팅 전송 실패' });
    console.log(err);
  }
});

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.userId, role: decoded.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role < MIN_ADMIN_ROLE) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
}

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(
      'SELECT id, email, username, password_hash, role FROM users WHERE email = ?',
      [email.trim()]
    );
    await conn.end();
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
    const conn = await mysql.createConnection(dbConfig);
    const [result] = await conn.execute(
      'INSERT INTO users (email, username, password_hash, role) VALUES (?, ?, ?, 1)',
      [email.trim(), username.trim(), password_hash]
    );
    const userId = result.insertId;
    const stream_key = generateStreamKey(userId);
    await conn.execute('UPDATE users SET stream_key = ? WHERE id = ?', [stream_key, userId]);
    await conn.end();
    res.status(201).json({ message: '회원가입이 완료되었습니다.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '이미 사용 중인 이메일입니다.' });
    }
    console.error('회원가입 오류:', err);
    res.status(500).json({ error: '회원가입 처리 중 오류가 발생했습니다.' });
  }
});

app.get('/api/me/stream-key', authMiddleware, async (req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    let [rows] = await conn.execute(
      'SELECT stream_key FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      await conn.end();
      return res.status(404).json({ error: '유저를 찾을 수 없습니다.' });
    }
    let stream_key = rows[0].stream_key;
    if (!stream_key) {
      stream_key = generateStreamKey(req.user.id);
      await conn.execute('UPDATE users SET stream_key = ? WHERE id = ?', [stream_key, req.user.id]);
    }
    await conn.end();
    res.json({ stream_key });
  } catch (err) {
    console.error('스트림 키 조회 오류:', err);
    res.status(500).json({ error: '스트림 키를 불러오지 못했습니다.' });
  }
});

app.post('/api/me/stream-key/regenerate', authMiddleware, async (req, res) => {
  try {
    const stream_key = generateStreamKey(req.user.id);
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute('UPDATE users SET stream_key = ? WHERE id = ?', [stream_key, req.user.id]);
    await conn.end();
    res.json({ message: '새 스트림 키가 발급되었습니다.', stream_key });
  } catch (err) {
    console.error('스트림 키 재발급 오류:', err);
    res.status(500).json({ error: '스트림 키 재발급에 실패했습니다.' });
  }
});

app.get('/api/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(
      'SELECT id, email, username, role, created_at FROM users ORDER BY id'
    );
    await conn.end();
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
    const conn = await mysql.createConnection(dbConfig);
    const [result] = await conn.execute('UPDATE users SET role = ? WHERE id = ?', [r, userId]);
    await conn.end();
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '해당 유저를 찾을 수 없습니다.' });
    }
    res.json({ message: '권한이 변경되었습니다.', role: r });
  } catch (err) {
    console.error('권한 변경 오류:', err);
    res.status(500).json({ error: '권한 변경에 실패했습니다.' });
  }
});

app.listen(4000, () => console.log('API Server running on port 4000'));