import { useTranslation } from 'react-i18next';

function StatusMessage({ type = 'info', text }) {
  const { t } = useTranslation();
  if (!text) return null;
  const className = type === 'error' ? 'message message-error' : type === 'success' ? 'message message-success' : 'message';
  return <div className={className}>{text || t('common.serverError')}</div>;
}

export default StatusMessage;
