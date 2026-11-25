import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { Home } from './pages/Home';
import { BoardPage } from './pages/BoardPage';
import { ThreadPage } from './pages/ThreadPage';
import { Rules } from './pages/Rules';
import { About } from './pages/About';
import { Info, LogIn, LogOut, Shield, User as UserIcon } from 'lucide-react';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ProfilePage } from './pages/ProfilePage';
import { AdminPage } from './pages/AdminPage';
import { AuthProvider, useAuth } from './lib/auth';

function AppShell() {
  const { user, authLoading, isStaff, logout } = useAuth();

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-40 bg-[var(--color-post-bg)]/95 backdrop-blur-[1px] border-b border-[var(--color-border)] px-3 md:px-4 py-1 text-xs flex flex-col sm:flex-row justify-between sm:items-center gap-1">
          <div className="flex gap-3 md:gap-4 flex-wrap">
            <Link to="/" className="post-link font-bold">AnyWhere</Link>
            <Link to="/" className="post-link">Доски</Link>
            <Link to="/rules" className="post-link">Правила</Link>
            <Link to="/about" className="post-link">О проекте</Link>
          </div>
          <div className="flex gap-3 md:gap-4 items-center flex-wrap">
            {authLoading ? (
              <span className="inline-flex items-center gap-1.5 opacity-60" aria-label="Проверка сессии">
                <span className="loader-inline-spinner" aria-hidden="true" />
              </span>
            ) : user ? (
              <>
                <span className="flex items-center gap-1 opacity-80">
                  <UserIcon size={12} />
                  <Link to={`/profile/${user.uid}`} className="post-link font-bold">
                    {user.displayName || user.email}
                  </Link>
                </span>
                {isStaff && (
                  <Link to="/admin" className="post-link inline-flex items-center gap-1">
                    <Shield size={12} />
                    Админ-панель
                  </Link>
                )}
                <button onClick={logout} className="post-link bg-transparent border-none p-0 inline-flex items-center gap-1">
                  <LogOut size={12} />
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="post-link inline-flex items-center gap-1">
                  <LogIn size={12} />
                  Войти
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
          <p>Это AnyWhere</p>
          <p>2026</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
