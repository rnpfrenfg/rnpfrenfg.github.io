import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '../api';
import { useAuth } from '../context/AuthContext';

const MAX_CHAT_MESSAGES = 102;

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

function useLiveChatSource(channelid) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [errorText, setErrorText] = useState('');
  const wsRef = useRef(null);

  function addMessage(){

  }

  useEffect(() => {
    if (!channelid) return;

    const wsUrl = buildWsUrl(API.client.defaults.baseURL, channelid);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setErrorText('');

    function pushMessage(msg) {
      setMessages((prev) => {
        const next = [...prev, msg];
        if (next.length > MAX_CHAT_MESSAGES) {
          return next.slice(next.length - MAX_CHAT_MESSAGES);
        }
        return next;
      });
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat' && data.message) {
          pushMessage(data.message);
          return;
        }

        if (data.type === 'system' && data.code) {
          const translated = t(`errors.${data.code}`, { defaultValue: t('chat.systemNotice') });
          pushMessage({ username: t('chat.system'), message: translated });
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

  const send = (text) => {
    if (!text.trim() || !user) return false;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setErrorText(t('errors.WS_CONNECTION_NOT_READY'));
      return false;
    }
    wsRef.current.send(JSON.stringify({ type: 'chat', message: text.trim() }));
    return true;
  };

  return {
    messages,
    errorText,
    canSend: Boolean(user),
    send,
  };
}

function useVodChatSource(videoId, getCurrentTime) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [errorText, setErrorText] = useState('');
  const seenIdsRef = useRef(new Set());
  const lastFetchRef = useRef({ at: -1, ts: 0 });
  const lastTimeRef = useRef(null);

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
      if (at === lastFetchRef.current.at) return;
      lastFetchRef.current = { at, ts: now };

      const result = await API.getVideoChat(videoId, at, 2);
      console.log(result);
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

  return {
    messages,
    errorText,
    canSend: false,
    send: null,
  };
}

function ChatPanel({ source }) {
  const { t } = useTranslation();
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [source.messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!source.canSend || !source.send) return;
    const ok = source.send(inputText);
    if (ok) setInputText('');
  };

  return (
    <div className="chat-container">
      {source.errorText && <div className="message message-error chat-error">{source.errorText}</div>}

      <div className="chat-messages">
        {source.messages.map((msg, i) => (
          <div key={i} className="chat-messageRow">
            <strong className="chat-username">{msg.username}</strong>:
            <span className="chat-text">{msg.message}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {source.canSend ? (
        <form onSubmit={handleSendMessage} className="chat-form">
          <div className="chat-inputRow">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('chat.inputPlaceholder')}
            />
            <button type="submit">{t('chat.send')}</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Chat({ channelid }) {
  const source = useLiveChatSource(channelid);
  return <ChatPanel source={source} />;
}

function VodChat({ videoId, getCurrentTime }) {
  const source = useVodChatSource(videoId, getCurrentTime);
  return <ChatPanel source={source} />;
}

export { VodChat, useLiveChatSource, useVodChatSource, ChatPanel };
export default Chat;
