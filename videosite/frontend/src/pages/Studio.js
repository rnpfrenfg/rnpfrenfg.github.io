import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { API } from '../api';

function Studio() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [streamKey, setStreamKey] = useState('');
  const [streamKeyMessage, setStreamKeyMessage] = useState({ type: '', text: '' });
  const [streamKeyLoading, setStreamKeyLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const result = await API.getMyStreamKey();
      setStreamKey(result.ok ? result.data?.stream_key || '' : '');
    })();
  }, [user]);

  const handleRegenerateStreamKey = async () => {
    setStreamKeyMessage({ type: '', text: '' });
    setStreamKeyLoading(true);
    const result = await API.regenerateStreamKey();
    if (result.ok) {
      const data = result.data || {};
      setStreamKey(data.stream_key || '');
      setStreamKeyMessage({ type: 'success', text: data.message || t('studio.regenerateSuccess') });
    } else {
      setStreamKeyMessage({ type: 'error', text: result.error || t('studio.regenerateFail') });
    }
    setStreamKeyLoading(false);
  };

  return (
    <div>
      {user && (
        <div className="stream-key-box">
          <h4>{t('studio.title')}</h4>
          <p className="stream-key-desc">{t('studio.desc')}</p>
          <div className="stream-key-info">
            <label>{t('studio.serverUrl')}</label>
            <code>{process.env.REACT_APP_RTMP_URL || 'rtmp://localhost/live'}</code>
          </div>
          <div className="stream-key-info">
            <label>{t('studio.streamKey')}</label>
            <code className="stream-key-value">{streamKey || t('studio.loadingKey')}</code>
          </div>
          {streamKeyMessage.text && <div className={`message message-${streamKeyMessage.type}`}>{streamKeyMessage.text}</div>}
          <button type="button" className="stream-key-btn" onClick={handleRegenerateStreamKey} disabled={streamKeyLoading}>
            {streamKeyLoading ? t('studio.processing') : t('studio.regenerate')}
          </button>
          {streamKey && <p className="stream-key-current">{t('studio.currentHint')}</p>}
        </div>
      )}
    </div>
  );
}

export default Studio;
