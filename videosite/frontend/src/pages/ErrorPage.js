import { useTranslation } from 'react-i18next';
import StatusMessage from '../components/StatusMessage';

function ErrorPage() {
  const { t } = useTranslation();
  return <StatusMessage type="error" text={t('errorPage.notFound')} />;
}

export default ErrorPage;
