const NodeMediaServer = require('node-media-server');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
};

// 서버 시작 전 실행될 초기화 함수
async function initDB() {
  try {
    const conn = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
    });

    await conn.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await conn.query(`USE ${dbConfig.database}`);

    // 테이블 생성
    await conn.query(`
      CREATE TABLE IF NOT EXISTS channels (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) DEFAULT 'My Live Stream',
        stream_key VARCHAR(255) UNIQUE NOT NULL,
        is_live TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log("✔ DB와 테이블이 준비되었습니다.");
    await conn.end();
  } catch (err) {
    console.error("❌ DB 초기화 실패 (DB가 켜지는 중일 수 있습니다):", err.message);
  }
}

// 실행
initDB();

// 1. 스트리밍 서버(NMS) 설정
const nmsConfig = {
  rtmp: {
    port: 1935,
    chunk_size: 4000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000, // HLS 재생을 위한 포트
    mediaroot: './media', // 영상 조각들이 저장될 폴더
    allow_origin: '*'
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg', // 도커(리눅스) 환경의 ffmpeg 경로
    tasks: [
      {
        app: 'live',
        hls: true,
        hls_flags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
      }
    ]
  }
};

const nms = new NodeMediaServer(nmsConfig);
nms.run();

// 2. API 서버(Express) 설정
const app = express();
app.use(cors());
app.use(express.json());

// 3. 스트리밍 이벤트 리스너 (Nginx의 on_publish 역할 대체)
nms.on('prePublish', async (id, StreamPath, args) => {
  console.log('[방송 시작]', StreamPath);
  const streamKey = StreamPath.split('/').pop(); // /live/test -> test 추출
  
  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute('UPDATE channels SET is_live = 1 WHERE stream_key = ?', [streamKey]);
    await conn.end();
  } catch (err) {
    console.error('DB 업데이트 실패:', err);
  }
});

nms.on('donePublish', async (id, StreamPath, args) => {
  console.log('[방송 종료]', StreamPath);
  const streamKey = StreamPath.split('/').pop();
  
  const conn = await mysql.createConnection(dbConfig);
  await conn.execute('UPDATE channels SET is_live = 0 WHERE stream_key = ?', [streamKey]);
  await conn.end();
});

// 4. 리액트용 API
app.get('/api/live', async (req, res) => {
  const conn = await mysql.createConnection(dbConfig);
  const [rows] = await conn.execute('SELECT * FROM channels WHERE is_live = 1');
  await conn.end();
  res.json(rows);
});

app.listen(4000, () => console.log('API Server running on port 4000'));