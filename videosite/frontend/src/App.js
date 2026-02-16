import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './App.css';
import { useAuth } from './context/AuthContext';

import Login from './pages/Login';
import Signup from './pages/Signup';
import MainPage from './pages/MainPage';
import ViewLive from './pages/ViewLive';
import ViewVideo from './pages/ViewVideo';
import Studio from './pages/Studio';
import ErrorPage from './pages/ErrorPage';
import Admin from './pages/Admin';
import { ChannelLayout, ChannelHome, ChannelVideos, ChannelCommunity, ChannelAbout } from './pages/ChannelLayout';

function App() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  return (
    <BrowserRouter>
      <div className="app-root">
        <div className="app-layout">
          <div className="app-nav">
            <Link to="/"><h4>{t('nav.appTitle')}</h4></Link>
            <div className="app-navLinks">
              {user ? (
                <>
                  <span className="app-navUser">{user.username}</span>
                  {user.role > 1 && <Link to="/admin" className="app-navLink">{t('nav.admin')}</Link>}
                  <Link to="/studio" className="app-navLink">{t('nav.studio')}</Link>
                  <button type="button" onClick={logout} className="app-navBtn">{t('nav.logout')}</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="app-navLink">{t('nav.login')}</Link>
                  <Link to="/signup" className="app-navLink">{t('nav.signup')}</Link>
                </>
              )}
            </div>
          </div>
          <div className="app-sidebar">{t('main.leftBar')}</div>
          <div className="app-main">
            <Routes>
              <Route path="/" element={<MainPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/live/:id" element={<ViewLive />} />
              <Route path="/video/:id" element={<ViewVideo />} />
              <Route path="/studio" element={<Studio />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/channel/:channelid" element={<ChannelLayout />}>
                <Route index element={<ChannelHome />} />
                <Route path="videos" element={<ChannelVideos />} />
                <Route path="community" element={<ChannelCommunity />} />
                <Route path="about" element={<ChannelAbout />} />
              </Route>
              <Route path="*" element={<ErrorPage />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
