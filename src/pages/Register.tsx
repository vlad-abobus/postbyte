import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { forumService } from '../services/forumService';

export function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
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
      await forumService.register({ email, username, password, captchaId, captchaAnswer });
      window.location.assign('/');
    } catch (e: any) {
      setError(e.message || 'Не удалось создать аккаунт');
      refreshCaptcha();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-[var(--color-post-bg)] border border-[var(--color-border)] p-4">
      <h1 className="text-lg font-bold text-[var(--color-post-header)] mb-3">Регистрация</h1>
      <form onSubmit={onSubmit} className="space-y-3 text-xs">
        <div>
          <label className="block font-bold mb-1">Email</label>
          <input
            className="w-full border border-[var(--color-border)] p-2 bg-white outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block font-bold mb-1">Имя пользователя</label>
          <input
            className="w-full border border-[var(--color-border)] p-2 bg-white outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <div className="text-[10px] text-[var(--color-muted)] mt-1">
            3-32 символа: буквы, цифры и нижнее подчеркивание
          </div>
        </div>
        <div>
          <label className="block font-bold mb-1">Пароль</label>
          <input
            className="w-full border border-[var(--color-border)] p-2 bg-white outline-none"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
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
          {submitting ? '...' : 'Создать аккаунт'}
        </button>
      </form>

      <div className="text-[10px] mt-3 text-[var(--color-muted)]">
        Уже есть аккаунт? <Link to="/login" className="post-link">Войти</Link>
      </div>
    </div>
  );
}

