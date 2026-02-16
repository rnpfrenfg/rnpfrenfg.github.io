import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from './context/AuthContext';
import { API } from './api';

const ROLE_LABELS = {
  1: '1 (권한없음)',
  2: '2 (상담)',
  3: '3 (권한변경)',
  4: '4 (root)',
};

function Admin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    if (user === null) return;
    if (user.role < 2) {
      navigate('/', { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      const result = await API.getUsers();
      if (cancelled) return;

      if (result.ok) {
        setUsers(Array.isArray(result.data) ? result.data : []);
      } else if (result.status === 401) {
        navigate('/login', { replace: true });
      } else {
        setMessage({ type: 'error', text: result.error || t('errors.USERS_FETCH_FAILED') });
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user, navigate, t]);

  const handleRoleChange = async (userId, newRole) => {
    const r = Number(newRole);
    if (r < 1 || r > 4) return;

    setUpdatingId(userId);
    setMessage({ type: '', text: '' });

    const result = await API.updateUserRole(userId, r);
    if (result.ok) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: r } : u)));
      setMessage({ type: 'success', text: t('admin.roleChanged') });
    } else {
      setMessage({ type: 'error', text: result.error || t('errors.ROLE_UPDATE_FAILED') });
    }
    setUpdatingId(null);
  };

  if (user === null || user.role < 2) navigate('/');

  return (
    <div className="admin-page">
      <h2>{t('admin.title')}</h2>
      {message.text && (
        <div className={`admin-message admin-message-${message.type}`}>
          {message.text}
        </div>
      )}
      {loading ? (
        <p className="admin-loading">{t('admin.loading')}</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin.table.id')}</th>
                <th>{t('admin.table.email')}</th>
                <th>{t('admin.table.username')}</th>
                <th>{t('admin.table.role')}</th>
                <th>{t('admin.table.createdAt')}</th>
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
        <Link to="/">{t('admin.back')}</Link>
      </p>
    </div>
  );
}

export default Admin;
