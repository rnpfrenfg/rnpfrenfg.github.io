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
    <div className="chat-container">
      {errorText && <div className="message message-error chat-error">{errorText}</div>}

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className="chat-messageRow">
            <strong className="chat-username">{msg.username}</strong>:
            <span className="chat-text">{msg.message}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-form">
        {user ? (
          <div className="chat-inputRow">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('chat.inputPlaceholder')}
            />
            <button type="submit">{t('chat.send')}</button>
          </div>
        ) : (
          <p className="chat-loginHint">{t('chat.loginRequired')}</p>
        )}
      </form>
    </div>
  );
}

function VodChat({ videoId, getCurrentTime }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [errorText, setErrorText] = useState('');
  const seenIdsRef = useRef(new Set());
  const lastFetchRef = useRef({ at: -1, ts: 0 });

  useEffect(() => {
    seenIdsRef.current = new Set();
    setMessages([]);
    setErrorText('');
  }, [videoId]);

  useEffect(() => {
    if (!videoId) return;

    const timer = setInterval(async () => {
      const currentTime = typeof getCurrentTime === 'function' ? getCurrentTime() : null;
      if (!Number.isFinite(currentTime)) return;

      const at = Math.max(0, Math.floor(currentTime));
      const now = Date.now();
      const shouldFetch = at !== lastFetchRef.current.at || (now - lastFetchRef.current.ts) > 3000;
      if (!shouldFetch) return;

      lastFetchRef.current = { at, ts: now };
      const result = await API.getVideoChat(videoId, at, 2);
      if (!result.ok) {
        setErrorText(result.error || t('common.serverError'));
        return;
      }

      const list = Array.isArray(result.data?.messages) ? result.data.messages : [];
      if (list.length === 0) return;

      const next = [];
      for (const item of list) {
        if (!item?.id || seenIdsRef.current.has(item.id)) continue;
        seenIdsRef.current.add(item.id);
        next.push({ username: item.username, message: item.message });
      }

      if (next.length > 0) {
        setMessages((prev) => [...prev, ...next]);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [videoId, getCurrentTime, t]);

  return (
    <div className="chat-container">
      {errorText && <div className="message message-error chat-error">{errorText}</div>}

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className="chat-messageRow">
            <strong className="chat-username">{msg.username}</strong>:
            <span className="chat-text">{msg.message}</span>
          </div>
        ))}
      </div>

      <div className="chat-form">
        <p className="chat-loginHint">{t('chat.vodNotice', { defaultValue: t('chat.systemNotice') })}</p>
      </div>
    </div>
  );
}

export { VodChat };
export default Chat;
