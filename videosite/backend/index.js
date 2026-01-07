const NodeMediaServer = require('node-media-server');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

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

const dbConfig = {
  host: 'db',
  user: 'user',
  password: 'password',
  database: 'streaming_db'
};

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