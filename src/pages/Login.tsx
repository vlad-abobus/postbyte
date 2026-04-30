import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { forumService } from '../services/forumService';

export function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [captchaId, setCaptchaId] = useState<string>('');
  const [captchaImage, setCaptchaImage] = useState<string>('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refreshCaptcha = async () => {
    const c = await forumService.getCaptcha();
    setCaptchaId(c.captchaId);
    setCaptchaImage(c.image);
    setCaptchaAnswer('');
  };

  useEffect(() => {
    refreshCaptcha();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await forumService.login({ login, password, captchaId, captchaAnswer });
      window.location.assign('/');
    } catch (e: any) {
      setError(e.message || 'Не удалось войти');
      refreshCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-[var(--color-post-bg)] border border-[var(--color-border)] p-4">
      <h1 className="text-lg font-bold text-[var(--color-post-header)] mb-3">Вход</h1>
      <form onSubmit={onSubmit} className="space-y-3 text-xs">
        <div>
          <label className="block font-bold mb-1">Email или имя пользователя</label>
          <input
            className="w-full border border-[var(--color-border)] p-2 bg-white outline-none"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div>
          <label className="block font-bold mb-1">Пароль</label>
          <input
            className="w-full border border-[var(--color-border)] p-2 bg-white outline-none"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        <div>
          <label className="block font-bold mb-1">Капча</label>
          <div className="flex items-center gap-2">
            {captchaImage && (
              <img
                src={captchaImage}
                alt="Капча"
                className="border border-[var(--color-border)] bg-white select-none"
                draggable={false}
              />
            )}
            <button
              type="button"
              onClick={refreshCaptcha}
              className="post-link bg-transparent border-none p-0"
            >
              Обновить
            </button>
          </div>
          <input
            className="mt-2 w-32 border border-[var(--color-border)] p-2 bg-white outline-none uppercase tracking-widest"
            value={captchaAnswer}
            onChange={(e) => setCaptchaAnswer(e.target.value)}
          />
        </div>

        {error && <div className="text-red-700 font-bold">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-[var(--color-accent)] text-white font-bold p-2 w-full hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {submitting ? '...' : 'Войти'}
        </button>
      </form>

      <div className="text-[10px] mt-3 text-[var(--color-muted)]">
        Нет аккаунта? <Link to="/register" className="post-link">Зарегистрироваться</Link>
      </div>
    </div>
  );
}

