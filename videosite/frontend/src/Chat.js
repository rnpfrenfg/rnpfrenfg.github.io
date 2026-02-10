import { useState, useEffect, useRef } from 'react';
import { api } from './api';
import { useAuth } from './context/AuthContext';

function Chat({ channelOwner }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef(null);

  const fetchChats = async () => {
    try {
      const { data } = await api.get(`/api/livechat/${channelOwner}`);
      setMessages(data);
    } catch (err) {
      console.error("채팅 로딩 실패");
    }
  };

  useEffect(() => {
    fetchChats();
    const timer = setInterval(fetchChats, 3000);
    return () => clearInterval(timer);
  }, [channelOwner]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    try {
      await api.post(`/api/livechat/${channelOwner}`, { message: inputText });
      console.log(`/api/livechat/${channelOwner}`);
      setInputText('');
    } catch (err) {
      alert("로그인이 필요하거나 전송에 실패했습니다.");
    }
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
              style={{ flex: 1, padding: '5px' }}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="채팅을 입력하세요..."
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