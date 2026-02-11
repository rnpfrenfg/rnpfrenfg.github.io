const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 1000,
  queueLimit: 0
};

const dbPool = mysql.createPool(dbConfig);

async function initDB() {
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
        stream_key VARCHAR(255) UNIQUE NULL,
        is_live TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS chats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        channel_owner VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS videos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      channel_name VARCHAR(100),
      title VARCHAR(255),
      filename VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );`);
  } catch (err) {
    console.error("DB 초기화 실패:", err.message);
  }
}

module.exports = { dbPool, initDB };