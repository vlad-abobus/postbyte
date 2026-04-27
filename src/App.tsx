import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { BoardPage } from './pages/BoardPage';
import { ThreadPage } from './pages/ThreadPage';
import { Rules } from './pages/Rules';
import { About } from './pages/About';
import { Info, LogIn, LogOut, Shield, User as UserIcon } from 'lucide-react';
import { forumService } from './services/forumService';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { User } from './types';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    forumService.me().then((r) => setUser(r.user)).catch(() => setUser(null));
  }, []);

  const doLogout = async () => {
    await forumService.logout();
    setUser(null);
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-40 bg-[var(--color-post-bg)]/95 backdrop-blur-[1px] border-b border-[var(--color-border)] px-3 md:px-4 py-1 text-xs flex flex-col sm:flex-row justify-between sm:items-center gap-1">
          <div className="flex gap-3 md:gap-4 flex-wrap">
            <Link to="/" className="post-link font-bold">PostByteCL</Link>
            <Link to="/" className="post-link">Boards</Link>
            <Link to="/rules" className="post-link">Rules</Link>
            <Link to="/about" className="post-link">About</Link>
          </div>
          <div className="flex gap-3 md:gap-4 items-center flex-wrap">
            {user ? (
              <>
                <span className="flex items-center gap-1 opacity-80">
                  <UserIcon size={12} />
                  <Link to={`/profile/${user.uid}`} className="post-link font-bold">
                    {user.displayName || user.email}
                  </Link>
                </span>
                {user.role === 'admin' && (
                  <Link to="/admin" className="post-link inline-flex items-center gap-1">
                    <Shield size={12} />
                    Admin Panel
                  </Link>
                )}
                <button onClick={doLogout} className="post-link bg-transparent border-none p-0 inline-flex items-center gap-1">
                  <LogOut size={12} />
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="post-link inline-flex items-center gap-1">
                  <LogIn size={12} />
                  Login
                </Link>
              </>
            )}
            <span className="flex items-center gap-1 opacity-40">
              <Info size={12} />
              Flask
            </span>
          </div>
        </header>

        <main className="flex-1 p-3 md:p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/about" element={<About />} />
            <Route path="/profile/:uid" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/:boardId" element={<BoardPage />} />
            <Route path="/:boardId/thread/:threadId" element={<ThreadPage />} />
          </Routes>
        </main>

        <footer className="text-center py-8 text-[10px] text-[var(--color-muted)] border-top border-[var(--color-border)] mt-8">
          <p>© 2026 PostByteCL - All Rights Reserved</p>
          <p>This imageboard is for experimental purposes.</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}
