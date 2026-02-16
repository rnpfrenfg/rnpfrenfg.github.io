import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '../api';
import StatusMessage from '../components/StatusMessage';

function getVideoIdFromLink(link) {
  if (typeof link !== 'string') return null;
  const match = link.match(/^\/video\/(\d+)(?:$|[/?#])/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function useMainPage() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await API.getMainPage();
      if (cancelled) return;
      if (result.ok) {
        setSections(Array.isArray(result.data) ? result.data : []);
        setErrorText('');
      } else {
        setErrorText(result.error || '');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { sections, loading, errorText };
}


function MainPage() {
  const { t } = useTranslation();
  const { sections, loading, errorText } = useMainPage();

  return (
    <div className="mp-page">
      {loading && <StatusMessage text={t('common.loading')} />}
      {!loading && errorText && <StatusMessage type="error" text={errorText} />}
      <div className="mp-sections">
        {sections.map((item, idx) => (
          <div key={idx} className="mp-section">
            <h3 className="mp-sectionTitle">{item.title}</h3>
            <div className="item-list mp-itemList">
              {(item.list || []).map((entry, i) => (
                <div key={i} className="item-card mp-itemCard">
                  <Link to={entry.link} className="item-link mp-itemLink">
                    <div className="thumb-frame media-thumbFrame" aria-hidden="true">
                      {(() => {
                        const thumbnail = entry.thumbnail ?? getVideoIdFromLink(entry.link);
                        if (!thumbnail) return <div className="thumb-placeholder media-thumbPlaceholder">LIVE</div>;
                        return (
                          <img
                            className="thumb-img media-thumbImg"
                            src={API.getVideoThumbnailUrl(entry.thumbnail)}
                            loading="lazy"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        );
                      })()}
                    </div>
                    <div className="item-meta mp-itemMeta">
                      <div className="item-title mp-itemTitle">{entry.title}</div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MainPage;
