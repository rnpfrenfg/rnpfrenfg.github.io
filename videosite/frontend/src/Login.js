import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './context/AuthContext';
import { API } from './api';

function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);
    const result = await API.login(email, password);
    if (result.ok) {
      const data = result.data || {};
      login(data.user);
      navigate('/');
    } else {
      setMessage({ type: 'error', text: result.error || t('errors.LOGIN_FAILED') });
    }
    setLoading(false);
  };

  return (
    <div className="signup-page">
      <div className="signup-box">
        <h2>{t('auth.loginTitle')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">{t('auth.email')}</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">{t('auth.password')}</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {message.text && (
            <div className={`message message-${message.type}`}>{message.text}</div>
          )}
          <button type="submit" className="signup-btn" disabled={loading}>
            {loading ? t('common.loading') : t('nav.login')}
          </button>
        </form>
        <p className="signup-footer">
          {t('auth.noAccount')} <Link to="/signup">{t('auth.signupLink')}</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
