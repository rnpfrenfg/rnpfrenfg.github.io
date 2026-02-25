const mysql = require('mysql2/promise');
require('dotenv').config();

function createDbPool(dbConfig) {
  return mysql.createPool(dbConfig);
}

async function initDB(dbPool, dbConfig) {
  let authenticated = false;
  let retryCount = 0;
  const maxRetries = 10;

  while (!authenticated && retryCount < maxRetries) {
    try {
      console.log("DB 접속 성공! 테이블 초기화를 시작합니다.");
      
      await dbPool.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
      await dbPool.query(`USE ${dbConfig.database}`);
      
      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          username VARCHAR(100) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role TINYINT DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        channelid INT,
        title VARCHAR(255),
        filename VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX(channelid),
        INDEX(id)
      );`);
      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS chats (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(100) NOT NULL,
          channelid INT,
          video_id INT NOT NULL,
          message TEXT NOT NULL,
          created_at DATETIME(3) NOT NULL,
          INDEX(created_at)
        )
      `);
      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS livesetting (
          id INT PRIMARY KEY,
          is_live TINYINT(1) DEFAULT 0,
          channelname VARCHAR(100) NOT NULL,
          stream_key VARCHAR(255) UNIQUE NULL,
          INDEX(stream_key)
        )
      `);
      await dbPool.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          channelid INT NOT NULL,
          post TEXT NOT NULL,
          image_key VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX(channelid, id)
        )
      `);

      authenticated = true;
      console.log("테이블 초기화 종료");
    }
    catch (err) {
        retryCount++;
        console.log(`DB 접속 실패 (시도 ${retryCount}/${maxRetries}): ${err}`);
        await new Promise(res => setTimeout(res, 5000));
    }
  }

  if(!authenticated){
    console.error("DB 접속 실패.");
    process.exit(1);
  }
}

module.exports = { createDbPool, initDB };