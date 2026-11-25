import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { forumService } from '../services/forumService';
import { Post, User } from '../types';
import { formatDate } from '../lib/utils';
import { Camera, Save, User as UserIcon } from 'lucide-react';
import { PostItem } from '../components/PostItem';
import { LoadingState } from '../components/LoadingState';
import { useAuth } from '../lib/auth';

export function ProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const { user: me, isStaff, setUser: setAuthUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editData, setEditData] = useState({ displayName: '', bio: '', photoURL: '' });

  const isOwnProfile = useMemo(() => {
    if (!uid) return false;
    return me?.uid === uid;
  }, [me?.uid, uid]);

  useEffect(() => {
    if (uid) {
      setLoading(true);
      const fetchProfile = async () => {
        try {
          const p = await forumService.getUserProfile(uid);
          if (p) {
            setProfile(p);
            setEditData({
              displayName: p.displayName || '',
              bio: p.bio || '',
              photoURL: p.photoURL || '',
            });
            const userPosts = await forumService.getUserPosts(uid);
            setPosts(userPosts);
          } else {
            setProfile(null);
            setPosts([]);
          }
        } catch {
          setProfile(null);
          setPosts([]);
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
    }
  }, [uid]);

  const handleSave = async () => {
    if (!uid) return;
    setSaveError('');
    setSaving(true);
    try {
      const updated = await forumService.updateMeProfile(editData);
      setProfile(updated);
      setAuthUser(updated);
      setIsEditing(false);
    } catch (e: any) {
      setSaveError(e?.message || 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LoadingState
        title="Загрузка профиля"
        subtitle="Получаем данные пользователя..."
        variant="profile"
      />
    );
  }
  if (!profile) return <div className="p-4 font-mono text-red-600">Пользователь не найден</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-[var(--color-post-bg)] border border-[var(--color-border)] shadow-sm">
        <div className="bg-[var(--color-accent)] text-white p-2 font-bold flex justify-between items-center">
          <span>Профиль пользователя: {profile.displayName}</span>
          {isOwnProfile && (
            <button
              onClick={() => setIsEditing((s) => !s)}
              className="bg-white text-[var(--color-accent)] px-2 py-0.5 rounded text-[10px] uppercase cursor-pointer"
            >
              {isEditing ? 'Закрыть' : 'Редактировать'}
            </button>
          )}
        </div>

        <div className="p-6 flex flex-col md:flex-row gap-8">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group w-32 h-32 bg-white border border-[var(--color-border)] overflow-hidden flex items-center justify-center">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="Аватар" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={64} className="text-[var(--color-border)]" />
              )}

              {isOwnProfile && (
                <label className={`absolute inset-0 bg-black/45 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer p-2 text-center ${avatarUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {avatarUploading ? (
                    <>
                      <span className="loader-inline-spinner mb-1" />
                      <span className="text-[10px] font-bold uppercase">Загрузка...</span>
                    </>
                  ) : (
                    <>
                      <Camera size={24} />
                      <span className="text-[10px] font-bold uppercase mt-1">Сменить аватар (вкл. GIF)</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    disabled={avatarUploading}
                    accept="image/png,image/jpeg,image/gif,image/webp,.gif,.png,.jpg,.jpeg,.webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) {
                        setAvatarUploading(true);
                        try {
                          const updated = await forumService.uploadMyAvatar(file);
                          setProfile(updated);
                          setAuthUser(updated);
                          setEditData((prev) => ({
                            ...prev,
                            displayName: updated.displayName || prev.displayName,
                            photoURL: updated.photoURL || '',
                          }));
                        } catch (err: any) {
                          alert(err?.message || 'Не удалось загрузить изображение');
                        } finally {
                          setAvatarUploading(false);
                        }
                      }
                    }}
                  />
                </label>
              )}
            </div>
            {profile.role !== 'user' && (
              <div className="bg-[var(--color-post-header)] text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                {profile.role}
              </div>
            )}
            {profile.role === 'user' && (
              <div className="bg-[var(--color-border)] text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                пользователь
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="flex-1 space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">Отображаемое имя</label>
                  <input
                    type="text"
                    value={editData.displayName}
                    onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                    className="w-full border border-[var(--color-border)] p-1 text-xs"
                    placeholder="3-32 символа, пробелы разрешены"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">Ссылка на аватар (поддерживает GIF)</label>
                  <input
                    type="text"
                    value={editData.photoURL}
                    onChange={(e) => setEditData({ ...editData, photoURL: e.target.value })}
                    className="w-full border border-[var(--color-border)] p-1 text-xs"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">О себе</label>
                  <textarea
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    className="w-full border border-[var(--color-border)] p-1 text-xs h-24 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[var(--color-accent)] text-white px-4 py-1 text-[10px] font-bold uppercase flex items-center gap-1 disabled:opacity-60 cursor-pointer"
                  >
                    <Save size={12} /> {saving ? 'Сохраняем...' : 'Сохранить'}
                  </button>
                </div>
                {saveError && (
                  <div className="text-red-700 font-bold text-xs">{saveError}</div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-post-header)]">{profile.displayName}</h2>
                  <p className="text-[10px] text-[var(--color-muted)]">На сайте с: {formatDate(profile.createdAt)}</p>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold uppercase text-[var(--color-post-header)]">О себе</h3>
                  <p className="text-xs whitespace-pre-wrap">{profile.bio || 'Описание пока не добавлено.'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post History */}
      <div className="mt-8">
        <h3 className="font-bold border-b border-[var(--color-border)] mb-4 pb-1">История активности</h3>
        {posts.length === 0 ? (
          <p className="text-xs italic opacity-50">Пока нет постов.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {posts.map((p) => (
              <div key={p.id}>
                <div className="text-[10px] text-[var(--color-muted)] mb-1">
                  <Link to={`/${p.boardId}/thread/${p.threadId}`} className="post-link">
                    /{p.boardId}/ thread #{p.threadId}
                  </Link>
                </div>
                <PostItem
                  post={p}
                  isOp={p.isOp}
                  boardId={p.boardId}
                  threadId={p.threadId}
                  canDelete={isStaff || isOwnProfile}
                  onDelete={({ postId, deletedThread }) => {
                    setPosts((prev) =>
                      deletedThread
                        ? prev.filter((item) => !(item.boardId === p.boardId && item.threadId === p.threadId))
                        : prev.filter((item) => item.id !== postId),
                    );
                  }}
                  hideActions
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
