import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { forumService } from '../services/forumService';
import { IpAction, Post, Report, User } from '../types';
import { formatDate, isGifImage } from '../lib/utils';
import { LoadingState } from '../components/LoadingState';
import { useAuth } from '../lib/auth';
import { CheckCircle2, Flag, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';

export function AdminPage() {
  const { authLoading, isStaff } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [actions, setActions] = useState<IpAction[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [showResolvedReports, setShowResolvedReports] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);
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

  const resolveReport = async (reportId: string, status: 'resolved' | 'pending' = 'resolved') => {
    setUpdatingReportId(reportId);
    setError('');
    try {
      await forumService.resolveReport(reportId, status);
      await loadAll();
    } catch (e: any) {
      setError(e?.message || 'Не удалось обновить статус жалобы');
    } finally {
      setUpdatingReportId(null);
    }
  };

  const prefillIpAction = (type: 'ban' | 'mute', ip: string, reason: string) => {
    setForm((prev) => ({ ...prev, type, ip, reason }));
    document.getElementById('ip-moderation-section')?.scrollIntoView({ behavior: 'smooth' });
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
        subtitle="Получаем жалобы, пользователей, посты и настройки..."
        variant="admin"
      />
    );
  }
  if (!isStaff) return <Navigate to="/" replace />;

  const pendingReports = reports.filter((r) => r.status === 'pending');
  const resolvedReports = reports.filter((r) => r.status === 'resolved');
  const displayedReports = showResolvedReports ? resolvedReports : pendingReports;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="bg-[var(--color-post-bg)] border border-[var(--color-border)] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="font-bold text-lg">Админ-панель</h1>
          <p className="text-xs opacity-70">Жалобы на сообщения, управление аккаунтами, модерация любых постов, IP-муты и баны.</p>
        </div>
        <button
          type="button"
          onClick={() => loadAll()}
          className="post-link bg-transparent border-none p-0 inline-flex items-center gap-1 text-xs self-start sm:self-center"
        >
          <RefreshCw size={12} />
          Обновить данные
        </button>
      </div>

      {error && <div className="p-2 text-xs border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]">{error}</div>}

      {/* Reported Messages Inbox for Moderators / Admins */}
      <div className="bg-[var(--color-post-bg)] border border-[var(--color-border)] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="font-bold inline-flex items-center gap-1.5">
            <Flag size={14} className="text-orange-700" />
            <span>Жалобы на сообщения</span>
            {pendingReports.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] bg-orange-700 text-white font-bold rounded-sm">
                {pendingReports.length} новых
              </span>
            )}
          </h2>
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setShowResolvedReports(false)}
              className={`px-2 py-0.5 border cursor-pointer ${
                !showResolvedReports
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] font-bold'
                  : 'bg-white border-[var(--color-border)] text-[var(--color-post-header)]'
              }`}
            >
              Новые ({pendingReports.length})
            </button>
            <button
              type="button"
              onClick={() => setShowResolvedReports(true)}
              className={`px-2 py-0.5 border cursor-pointer ${
                showResolvedReports
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] font-bold'
                  : 'bg-white border-[var(--color-border)] text-[var(--color-post-header)]'
              }`}
            >
              Решённые ({resolvedReports.length})
            </button>
          </div>
        </div>

        {displayedReports.length === 0 ? (
          <div className="text-xs opacity-60 py-2">
            {showResolvedReports ? 'Архив решённых жалоб пуст.' : 'Новых жалоб пока нет.'}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedReports.map((r) => {
              const reportedPost = r.post;
              const gif = isGifImage(reportedPost?.image?.url, reportedPost?.image?.filename);
              return (
                <div
                  key={r.id}
                  className={`border p-3 text-xs space-y-2 ${
                    r.status === 'pending'
                      ? 'border-orange-700/60 bg-white/80'
                      : 'border-[var(--color-border)] bg-white/50 opacity-80'
                  }`}
                >
                  {/* Report metadata header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)]/60 pb-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-bold uppercase text-white ${
                          r.status === 'pending' ? 'bg-orange-700' : 'bg-[var(--color-muted)]'
                        }`}
                      >
                        {r.status === 'pending' ? 'Новая жалоба' : 'Решена'}
                      </span>
                      <Link to={`/${r.boardId}/thread/${r.threadId}`} className="post-link font-mono font-bold">
                        /{r.boardId}/ thread #{r.threadId} → пост #{r.postId}
                      </Link>
                      {reportedPost?.isOp && (
                        <span className="px-1 py-0.5 text-[9px] bg-[var(--color-accent)] text-white font-bold uppercase">
                          OP
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] opacity-70">{formatDate(r.createdAt)}</span>
                  </div>

                  {/* Report reason */}
                  <div className="bg-[var(--color-danger-bg)]/60 border border-[var(--color-danger-border)]/40 px-2 py-1">
                    <span className="font-bold text-[var(--color-danger-border)]">Причина: </span>
                    <span>{r.reason}</span>
                  </div>

                  {/* Reported message body */}
                  {reportedPost ? (
                    <div className="bg-[var(--color-reply-bg)] border border-[var(--color-reply-border)] p-2 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="font-bold text-[var(--color-post-header)]">
                          {reportedPost.authorUid ? (
                            <Link to={`/profile/${reportedPost.authorUid}`} className="post-link font-bold">
                              {reportedPost.authorName || 'Аноним'}
                            </Link>
                          ) : (
                            reportedPost.authorName || 'Аноним'
                          )}
                        </span>
                        <span className="opacity-70">{formatDate(reportedPost.createdAt)}</span>
                        {reportedPost.ip && (
                          <span className="font-mono text-[10px] px-1 bg-white/80 border border-[var(--color-border)]">
                            IP: {reportedPost.ip}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        {reportedPost.image?.url && (
                          <a
                            href={reportedPost.image.url}
                            target="_blank"
                            rel="noreferrer"
                            className="relative shrink-0 inline-block self-start"
                          >
                            <img
                              src={reportedPost.image.url}
                              alt={reportedPost.image.filename || 'media'}
                              referrerPolicy="no-referrer"
                              className="max-w-[140px] max-h-[120px] border border-[var(--color-border)] bg-white object-contain"
                            />
                            {gif && <span className="gif-badge">GIF</span>}
                          </a>
                        )}
                        <div className="flex-1 whitespace-pre-wrap break-words">
                          {reportedPost.content || <span className="italic opacity-60">(без текста)</span>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="italic opacity-60 text-[11px]">
                      Сообщение #{r.postId} уже удалено.
                    </div>
                  )}

                  {/* Moderator actions */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    {reportedPost && (
                      <button
                        type="button"
                        disabled={deletingPostId === r.postId}
                        onClick={() => deleteAnyPost(r.boardId, r.threadId, r.postId, reportedPost.isOp)}
                        className="px-2.5 py-1 bg-red-700 text-white font-bold border border-red-800 inline-flex items-center gap-1 cursor-pointer hover:bg-red-800 disabled:opacity-50"
                      >
                        <Trash2 size={11} />
                        {deletingPostId === r.postId
                          ? 'Удаление...'
                          : reportedPost.isOp
                            ? 'Удалить тред'
                            : 'Удалить сообщение'}
                      </button>
                    )}

                    {r.status === 'pending' && (
                      <button
                        type="button"
                        disabled={updatingReportId === r.id}
                        onClick={() => resolveReport(r.id, 'resolved')}
                        className="px-2.5 py-1 bg-white border border-[var(--color-border)] text-[var(--color-post-header)] font-bold inline-flex items-center gap-1 cursor-pointer hover:bg-[var(--color-post-highlight)] disabled:opacity-50"
                      >
                        <CheckCircle2 size={11} />
                        {updatingReportId === r.id ? 'Сохраняем...' : 'Отклонить жалобу'}
                      </button>
                    )}

                    {reportedPost?.ip && (
                      <>
                        <button
                          type="button"
                          onClick={() => prefillIpAction('mute', reportedPost.ip!, `По жалобе #${r.id}: ${r.reason}`)}
                          className="post-link bg-transparent border-none p-0 inline-flex items-center gap-1 text-[11px]"
                        >
                          <ShieldAlert size={11} />
                          Замутить IP
                        </button>
                        <button
                          type="button"
                          onClick={() => prefillIpAction('ban', reportedPost.ip!, `По жалобе #${r.id}: ${r.reason}`)}
                          className="post-link text-red-700 bg-transparent border-none p-0 inline-flex items-center gap-1 text-[11px]"
                        >
                          <ShieldAlert size={11} />
                          Забанить IP
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
      <div id="ip-moderation-section" className="bg-[var(--color-post-bg)] border border-[var(--color-border)] p-3">
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
