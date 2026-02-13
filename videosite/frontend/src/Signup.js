import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API } from './api';
import './Signup.css';

function Signup() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (password !== passwordConfirm) {
      setMessage({ type: 'error', text: t('auth.passwordMismatch') });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: t('auth.passwordMin') });
      return;
    }

    setLoading(true);
    const result = await API.signup(email, username, password);
    if (result.ok) {
      setMessage({ type: 'success', text: t('auth.signupSuccess') });
      setEmail('');
      setUsername('');
      setPassword('');
      setPasswordConfirm('');
      setTimeout(() => navigate('/login'), 1500);
    } else {
      setMessage({ type: 'error', text: result.error || t('errors.SIGNUP_FAILED') });
    }
    setLoading(false);
  };

  return (
    <div className="signup-page">
      <div className="signup-box">
        <h2>{t('auth.signupTitle')}</h2>
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
            <label htmlFor="username">{t('auth.username')}</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
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
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="passwordConfirm">{t('auth.passwordConfirm')}</label>
            <input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          {message.text && (
            <div className={`message message-${message.type}`}>{message.text}</div>
          )}
          <button type="submit" className="signup-btn" disabled={loading}>
            {loading ? t('common.loading') : t('nav.signup')}
          </button>
        </form>
        <p className="signup-footer">
          {t('auth.hasAccount')} <Link to="/login">{t('nav.login')}</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
