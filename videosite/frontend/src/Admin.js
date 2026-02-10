import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { api, MIN_ADMIN_ROLE } from './api';
import './Admin.css';

const ROLE_LABELS = { 1: '1 (일반)', 2: '2', 3: '3 (관리자)', 4: '4 (최고관리자)' };

function Admin() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    if (user === null) return;
    if (!isAdmin) {
      navigate('/', { replace: true });
      return;
    }
    let cancelled = false;
    api.get('/api/users')
      .then(({ data }) => { if (!cancelled) setUsers(data); })
      .catch((err) => {
        if (!cancelled) {
          if (err.response?.status === 401) navigate('/login', { replace: true });
          else setMessage({ type: 'error', text: err.response?.data?.error || '유저 목록을 불러오지 못했습니다.' });
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, isAdmin, navigate]);

  const handleRoleChange = async (userId, newRole) => {
    const r = Number(newRole);
    if (r < 1 || r > 4) return;
    setUpdatingId(userId);
    setMessage({ type: '', text: '' });
    try {
      await api.patch(`/api/users/${userId}`, { role: r });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: r } : u))
      );
      setMessage({ type: 'success', text: '권한이 변경되었습니다.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || '권한 변경에 실패했습니다.' });
    } finally {
      setUpdatingId(null);
    }
  };

  if (user === null) return null;
  if (!isAdmin) return null;

  return (
    <div className="admin-page">
      <h2>관리자 페이지 — 유저 목록</h2>
      {message.text && (
        <div className={`admin-message admin-message-${message.type}`}>
          {message.text}
        </div>
      )}
      {loading ? (
        <p className="admin-loading">불러오는 중...</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이메일</th>
                <th>사용자명</th>
                <th>권한</th>
                <th>가입일</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.email}</td>
                  <td>{u.username}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={updatingId === u.id}
                      className="admin-role-select"
                    >
                      {[1, 2, 3, 4].map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r] || r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="admin-back">
        <Link to="/">메인으로 돌아가기</Link>
      </p>
    </div>
  );
}

export default Admin;
