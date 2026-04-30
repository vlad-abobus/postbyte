import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { forumService } from '../services/forumService';
import { IpAction, User } from '../types';
import { formatDate } from '../lib/utils';

export function AdminPage() {
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [actions, setActions] = useState<IpAction[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: 'ban' as 'ban' | 'mute', ip: '', reason: '', durationHours: '' });
  const [clearIp, setClearIp] = useState('');
  const [clearType, setClearType] = useState<'all' | 'ban' | 'mute'>('all');

  const isAdmin = useMemo(() => me?.role === 'admin' || me?.role === 'moderator', [me?.role]);

  const loadAll = async () => {
    const [meRes, usersRes, actionsRes] = await Promise.all([
      forumService.me(),
      forumService.adminListUsers(),
      forumService.adminListIpActions(),
    ]);
    setMe(meRes.user);
    setUsers(usersRes);
    setActions(actionsRes);
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        await loadAll();
      } catch (e: any) {
        setError(e?.message || 'Не удалось загрузить админ-панель');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const setRole = async (uid: string, role: 'admin' | 'moderator' | 'user') => {
    setSaving(true);
    setError('');
    try {
      await forumService.adminSetUserRole(uid, role);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'Не удалось изменить роль');
    } finally {
      setSaving(false);
    }
  };

  const createAction = async () => {
    setSaving(true);
    setError('');
    try {
      await forumService.adminCreateIpAction({
        type: form.type,
        ip: form.ip.trim(),
        reason: form.reason.trim(),
        durationHours: form.durationHours.trim() ? Number(form.durationHours) : null,
      });
      setForm((prev) => ({ ...prev, ip: '', reason: '', durationHours: '' }));
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'Не удалось применить действие');
    } finally {
      setSaving(false);
    }
  };

  const disableAction = async (action: IpAction) => {
    setSaving(true);
    setError('');
    try {
      await forumService.adminDisableIpAction(action.type, action.id);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'Не удалось отключить действие');
    } finally {
      setSaving(false);
    }
  };

  const clearByIp = async () => {
    setSaving(true);
    setError('');
    try {
      await forumService.adminClearIpActionsByIp(clearIp.trim(), clearType === 'all' ? undefined : clearType);
      setClearIp('');
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'Не удалось очистить IP-действия');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 font-mono">Загрузка админ-панели...</div>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="bg-[var(--color-post-bg)] border border-[var(--color-border)] p-3">
        <h1 className="font-bold text-lg">Админ-панель</h1>
        <p className="text-xs opacity-70">Управление аккаунтами, ролями, IP-мутами и банами.</p>
      </div>

      {error && <div className="p-2 text-xs border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]">{error}</div>}

      <div className="bg-[var(--color-post-bg)] border border-[var(--color-border)] p-3">
        <h2 className="font-bold mb-2">Пользователи</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-1">Имя</th>
                <th className="text-left py-1">Email</th>
                <th className="text-left py-1">Роль</th>
                <th className="text-left py-1">Дата регистрации</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-b border-[var(--color-border)]/50">
                  <td className="py-1">{u.displayName || '(без имени)'}</td>
                  <td className="py-1">{u.email || '-'}</td>
                  <td className="py-1">
                    <select
                      className="border border-[var(--color-border)] bg-white/80 p-1"
                      disabled={saving}
                      value={u.role}
                      onChange={(e) => setRole(u.uid, e.target.value as 'admin' | 'moderator' | 'user')}
                    >
                      <option value="user">user</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="py-1">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[var(--color-post-bg)] border border-[var(--color-border)] p-3">
        <h2 className="font-bold mb-2">IP-мут / бан</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            className="border border-[var(--color-border)] p-1 text-xs"
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as 'ban' | 'mute' }))}
          >
            <option value="ban">бан</option>
            <option value="mute">мут</option>
          </select>
          <input
            className="border border-[var(--color-border)] p-1 text-xs"
            value={form.ip}
            onChange={(e) => setForm((prev) => ({ ...prev, ip: e.target.value }))}
            placeholder="IP-адрес"
          />
          <input
            className="border border-[var(--color-border)] p-1 text-xs"
            value={form.durationHours}
            onChange={(e) => setForm((prev) => ({ ...prev, durationHours: e.target.value }))}
            placeholder="Длительность в часах (пусто = навсегда)"
          />
          <button className="post-link text-left" disabled={saving || !form.ip.trim()} onClick={createAction}>
            Добавить
          </button>
        </div>
        <textarea
          className="mt-2 w-full border border-[var(--color-border)] p-1 text-xs h-16"
          value={form.reason}
          onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
          placeholder="Причина"
        />
        <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            className="border border-[var(--color-border)] p-1 text-xs"
            value={clearType}
            onChange={(e) => setClearType(e.target.value as 'all' | 'ban' | 'mute')}
          >
            <option value="all">снять бан + мут</option>
            <option value="ban">только снять бан</option>
            <option value="mute">только снять мут</option>
          </select>
          <input
            className="border border-[var(--color-border)] p-1 text-xs md:col-span-2"
            value={clearIp}
            onChange={(e) => setClearIp(e.target.value)}
            placeholder="IP для мгновенной очистки"
          />
          <button className="post-link text-left" disabled={saving || !clearIp.trim()} onClick={clearByIp}>
            Очистить по IP
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {actions.map((a) => (
            <div key={`${a.type}-${a.id}`} className="border border-[var(--color-border)] p-2 text-xs flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
              <span className="font-bold uppercase">{a.type}</span>
              <span>{a.ip}</span>
              <span className="opacity-70">{a.reason || '-'}</span>
              <span className="opacity-70">Создано: {formatDate(a.createdAt)}</span>
              <span className="opacity-70">До: {a.expiresAt ? formatDate(a.expiresAt) : 'без срока'}</span>
              <span className={`font-bold ${a.active ? 'text-[var(--color-post-header)]' : 'opacity-60'}`}>{a.active ? 'активно' : 'неактивно'}</span>
              {a.active && (
                <button className="post-link md:ml-auto" disabled={saving} onClick={() => disableAction(a)}>
                  Отключить
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
