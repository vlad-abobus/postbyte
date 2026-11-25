import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { forumService } from '../services/forumService';
import { IpAction, Post, Report, User } from '../types';
import { formatDate, isGifImage } from '../lib/utils';
import { LoadingState } from '../components/LoadingState';
import { useAuth } from '../lib/auth';
import { Trash2 } from 'lucide-react';

export function AdminPage() {
  const { authLoading, isStaff } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [actions, setActions] = useState<IpAction[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [form, setForm] = useState({ type: 'ban' as 'ban' | 'mute', ip: '', reason: '', durationHours: '' });
  const [clearIp, setClearIp] = useState('');
  const [clearType, setClearType] = useState<'all' | 'ban' | 'mute'>('all');

  const loadAll = async () => {
    const [usersRes, actionsRes, postsRes, reportsRes] = await Promise.all([
      forumService.adminListUsers(),
      forumService.adminListIpActions(),
      forumService.adminListPosts(),
      forumService.getReports().catch(() => [] as Report[]),
    ]);
    setUsers(usersRes);
    setActions(actionsRes);
    setPosts(postsRes);
    setReports(reportsRes);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isStaff) {
      setLoading(false);
      return;
    }
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
  }, [authLoading, isStaff]);

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

  const deleteAnyPost = async (boardId: string, threadId: string, postId: string, isOp?: boolean) => {
    const msg = isOp
      ? `Удалить весь тред #${threadId} в /${boardId}/ (ОП-пост и все ответы)?`
      : `Удалить пост #${postId} в /${boardId}/ thread #${threadId}?`;
    if (!window.confirm(msg)) return;
    setDeletingPostId(postId);
    setError('');
    try {
      await forumService.deletePost(boardId, threadId, postId);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'Не удалось удалить пост');
    } finally {
      setDeletingPostId(null);
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

  if (authLoading || loading) {
    return (
      <LoadingState
        title="Загрузка админ-панели"
        subtitle="Получаем пользователей, посты и настройки..."
        variant="admin"
      />
    );
  }
  if (!isStaff) return <Navigate to="/" replace />;

  const pendingReports = reports.filter((r) => r.status === 'pending');

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="bg-[var(--color-post-bg)] border border-[var(--color-border)] p-3">
        <h1 className="font-bold text-lg">Админ-панель</h1>
        <p className="text-xs opacity-70">Управление аккаунтами, ролями, модерация любых постов, IP-муты и баны.</p>
      </div>

      {error && <div className="p-2 text-xs border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]">{error}</div>}

      {/* Pending Reports */}
      {pendingReports.length > 0 && (
        <div className="bg-[var(--color-post-bg)] border border-[var(--color-border)] p-3">
          <h2 className="font-bold mb-2">Жалобы ({pendingReports.length})</h2>
          <div className="space-y-2">
            {pendingReports.map((r) => (
              <div key={r.id} className="border border-[var(--color-border)] bg-white/60 p-2 text-xs flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                <Link to={`/${r.boardId}/thread/${r.threadId}`} className="post-link font-mono font-bold">
                  /{r.boardId}/ #{r.threadId} → пост #{r.postId}
                </Link>
                <span className="flex-1">{r.reason}</span>
                <span className="opacity-70">{formatDate(r.createdAt)}</span>
                <button
                  type="button"
                  disabled={deletingPostId === r.postId}
                  onClick={() => deleteAnyPost(r.boardId, r.threadId, r.postId)}
                  className="post-link text-red-700 hover:text-red-900 bg-transparent border-none p-0 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={11} />
                  Удалить пост
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Posts Moderation */}
      <div className="bg-[var(--color-post-bg)] border border-[var(--color-border)] p-3">
        <h2 className="font-bold mb-2">Последние посты ({posts.length})</h2>
        {posts.length === 0 ? (
          <div className="text-xs opacity-60">Постов пока нет.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left py-1 pr-2">Тред</th>
                  <th className="text-left py-1 pr-2">Автор</th>
                  <th className="text-left py-1 pr-2">Контент</th>
                  <th className="text-left py-1 pr-2">Дата</th>
                  <th className="text-right py-1">Действие</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => {
                  const gif = isGifImage(p.image?.url, p.image?.filename);
                  return (
                    <tr key={p.id} className="border-b border-[var(--color-border)]/50">
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        <Link to={`/${p.boardId}/thread/${p.threadId}`} className="post-link font-mono">
                          /{p.boardId}/ #{p.threadId}
                        </Link>
                        {p.isOp && (
                          <span className="ml-1 px-1 py-0.5 text-[9px] bg-[var(--color-accent)] text-white font-bold uppercase">
                            OP
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        <span className="font-bold">{p.authorName || 'Аноним'}</span>
                        {p.ip && <span className="ml-1 font-mono text-[10px] opacity-60">({p.ip})</span>}
                      </td>
                      <td className="py-1.5 pr-2 max-w-md">
                        <div className="flex items-center gap-1.5 truncate">
                          {p.image?.url && (
                            <span className="px-1 py-0.5 text-[9px] bg-[var(--color-post-header)] text-white font-bold uppercase shrink-0">
                              {gif ? 'GIF' : 'IMG'}
                            </span>
                          )}
                          <span className="truncate">{p.content || '(без текста)'}</span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-2 whitespace-nowrap opacity-70">{formatDate(p.createdAt)}</td>
                      <td className="py-1.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          disabled={deletingPostId === p.id}
                          onClick={() => deleteAnyPost(p.boardId, p.threadId, p.id, p.isOp)}
                          className="post-link text-red-700 hover:text-red-900 bg-transparent border-none p-0 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 size={11} />
                          {deletingPostId === p.id ? 'Удаление...' : p.isOp ? 'Удалить тред' : 'Удалить'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Users */}
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

      {/* IP Bans / Mutes */}
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
