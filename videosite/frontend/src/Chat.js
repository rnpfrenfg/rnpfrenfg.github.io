import { useState, useEffect, useRef } from 'react';
import { api } from './api';
import { useAuth } from './context/AuthContext';

function buildWsUrl(baseHttpUrl, channelid, token) {
  const httpUrl = new URL(baseHttpUrl || window.location.origin);
  const wsProtocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = new URL('/ws/livechat', `${wsProtocol}//${httpUrl.host}`);
  wsUrl.searchParams.set('channelid', channelid);
  if (token) {
    wsUrl.searchParams.set('token', token);
  }
  return wsUrl.toString();
}

function Chat({ channelid }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const wsRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!channelid) return;

    const token = localStorage.getItem('token');
    const wsUrl = buildWsUrl(api.defaults.baseURL, channelid, token);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(data.type);
        if (data.type === 'chat' && data.message) {
          setMessages((prev) => [...prev, data.message]);
        } else if (data.type === 'error' && data.error) {
          console.error(data.error);
        }
      } catch (err) {
        console.error('채팅 메시지 파싱 실패');
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };

    return () => {
      ws.close();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, [channelid]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('채팅 서버에 연결되지 않았습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    wsRef.current.send(JSON.stringify({
      type: 'chat',
      message: inputText.trim(),
    }));
    setInputText('');
  };

  return (
    <div className="chat-container" style={{ borderLeft: '1px solid #ddd', width: '300px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: '8px' }}>
            <strong style={{ fontSize: '0.9rem' }}>{msg.username}</strong>:
            <span style={{ fontSize: '0.9rem', marginLeft: '5px' }}>{msg.message}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSendMessage} style={{ padding: '10px', borderTop: '1px solid #ddd' }}>
        {user ? (
          <div style={{ display: 'flex' }}>
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="채팅을 입력하세요.."
            />
            <button type="submit">전송</button>
          </div>
        ) : (
          <p style={{ fontSize: '0.8rem', color: '#888' }}>로그인 후 채팅 가능합니다.</p>
        )}
      </form>
    </div>
  );
}

export default Chat;
