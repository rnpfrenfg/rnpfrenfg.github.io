import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from './api';
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [errorText, setErrorText] = useState('');
  const wsRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (!channelid) return;

    const token = localStorage.getItem('token');
    const wsUrl = buildWsUrl(API.client.defaults.baseURL, channelid, token);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setErrorText('');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat' && data.message) {
          setMessages((prev) => [...prev, data.message]);
          return;
        }

        if (data.type === 'system' && data.code) {
          const translated = t(`errors.${data.code}`, { defaultValue: t('chat.systemNotice') });
          setMessages((prev) => [...prev, { username: t('chat.system'), message: translated }]);
          return;
        }

        if (data.type === 'error' && data.code) {
          const translated = t(`errors.${data.code}`, { defaultValue: t('common.serverError') });
          setErrorText(translated);
        }
      } catch {
        setErrorText(t('errors.WS_INVALID_MESSAGE_FORMAT'));
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
  }, [channelid, t]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setErrorText(t('errors.WS_CONNECTION_NOT_READY'));
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
      {errorText && <div className="message message-error" style={{ margin: '10px' }}>{errorText}</div>}

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
              placeholder={t('chat.inputPlaceholder')}
            />
            <button type="submit">{t('chat.send')}</button>
          </div>
        ) : (
          <p style={{ fontSize: '0.8rem', color: '#888' }}>{t('chat.loginRequired')}</p>
        )}
      </form>
    </div>
  );
}

export default Chat;
