import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from './api';
import './Signup.css';

function Signup() {
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
      setMessage({ type: 'error', text: '비밀번호가 일치하지 않습니다.' });
      return;
    }
    if (password.length < 6) {
      setMessage({ type: 'error', text: '비밀번호는 6자 이상이어야 합니다.' });
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/signup', { email, username, password });
      setMessage({ type: 'success', text: '회원가입이 완료되었습니다. 로그인해 주세요.' });
      setEmail('');
      setUsername('');
      setPassword('');
      setPasswordConfirm('');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      const text = err.response?.data?.error || '회원가입에 실패했습니다. 다시 시도해 주세요.';
      setMessage({ type: 'error', text });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-box">
        <h2>회원가입</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">이메일</label>
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
            <label htmlFor="username">사용자명</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="닉네임 또는 이름"
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label htmlFor="passwordConfirm">비밀번호 확인</label>
            <input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="비밀번호 다시 입력"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          {message.text && (
            <div className={`message message-${message.type}`}>{message.text}</div>
          )}
          <button type="submit" className="signup-btn" disabled={loading}>
            {loading ? '가입 중...' : '가입하기'}
          </button>
        </form>
        <p className="signup-footer">
          이미 계정이 있으신가요? <Link to="/">로그인</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;
