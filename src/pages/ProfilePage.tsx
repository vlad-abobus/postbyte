import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { forumService } from '../services/forumService';
import { Post, User } from '../types';
import { formatDate } from '../lib/utils';
import { Camera, Save, User as UserIcon } from 'lucide-react';
import { PostItem } from '../components/PostItem';

export function ProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const [profile, setProfile] = useState<User | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editData, setEditData] = useState({ displayName: '', bio: '', photoURL: '' });

  const isOwnProfile = useMemo(() => {
    if (!uid) return false;
    return me?.uid === uid;
  }, [me?.uid, uid]);

  useEffect(() => {
    if (uid) {
      const fetchProfile = async () => {
        const [meRes, p] = await Promise.all([forumService.me().catch(() => ({ user: null })), forumService.getUserProfile(uid)]);
        setMe(meRes.user);
        if (p) {
          setProfile(p);
          setEditData({ 
            displayName: p.displayName || '',
            bio: p.bio || '', 
            photoURL: p.photoURL || '' 
          });
          const userPosts = await forumService.getUserPosts(uid);
          setPosts(userPosts);
        }
        setLoading(false);
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
      setMe(updated);
      setIsEditing(false);
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 font-mono">Loading profile...</div>;
  if (!profile) return <div className="p-4 font-mono text-red-600">User not found</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-[var(--color-post-bg)] border border-[var(--color-border)] shadow-sm">
        <div className="bg-[var(--color-accent)] text-white p-2 font-bold flex justify-between items-center">
          <span>User Profile: {profile.displayName}</span>
          {isOwnProfile && (
            <button
              onClick={() => setIsEditing(s => !s)}
              className="bg-white text-[var(--color-accent)] px-2 py-0.5 rounded text-[10px] uppercase"
            >
              {isEditing ? 'Close' : 'Edit'}
            </button>
          )}
        </div>

        <div className="p-6 flex flex-col md:flex-row gap-8">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group w-32 h-32 bg-white border border-[var(--color-border)] overflow-hidden flex items-center justify-center">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={64} className="text-[var(--color-border)]" />
              )}
              
              {isOwnProfile && (
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer p-2 text-center">
                  <Camera size={24} />
                  <span className="text-[10px] font-bold uppercase mt-1">Change Avatar</span>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const updated = await forumService.uploadMyAvatar(file);
                          setProfile(updated);
                          setEditData(prev => ({
                            ...prev,
                            displayName: updated.displayName || prev.displayName,
                            photoURL: updated.photoURL || '',
                          }));
                        } catch (err) {
                          alert("Failed to upload image");
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
                user
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="flex-1 space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">Display Name</label>
                  <input
                    type="text"
                    value={editData.displayName}
                    onChange={e => setEditData({ ...editData, displayName: e.target.value })}
                    className="w-full border border-[var(--color-border)] p-1 text-xs"
                    placeholder="3-32 chars, spaces allowed"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">Avatar URL</label>
                  <input 
                    type="text" 
                    value={editData.photoURL} 
                    onChange={e => setEditData({ ...editData, photoURL: e.target.value })}
                    className="w-full border border-[var(--color-border)] p-1 text-xs"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">Biography</label>
                  <textarea 
                    value={editData.bio} 
                    onChange={e => setEditData({ ...editData, bio: e.target.value })}
                    className="w-full border border-[var(--color-border)] p-1 text-xs h-24 resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[var(--color-accent)] text-white px-4 py-1 text-[10px] font-bold uppercase flex items-center gap-1 disabled:opacity-60"
                  >
                    <Save size={12} /> {saving ? 'Saving...' : 'Save'}
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
                  <p className="text-[10px] text-[var(--color-muted)]">Member since: {formatDate(profile.createdAt)}</p>
                </div>
                <div>
                  <h3 className="text-[10px] font-bold uppercase text-[var(--color-post-header)]">Bio</h3>
                  <p className="text-xs whitespace-pre-wrap">{profile.bio || "No bio set."}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post History */}
      <div className="mt-8">
        <h3 className="font-bold border-b border-[var(--color-border)] mb-4 pb-1">Activity History</h3>
        {posts.length === 0 ? (
          <p className="text-xs italic opacity-50">No posts yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {posts.map(p => (
              <div key={p.id}>
                <div className="text-[10px] text-[var(--color-muted)] mb-1">
                  <Link to={`/${p.boardId}/thread/${p.threadId}`} className="post-link">
                    /{p.boardId}/ thread #{p.threadId}
                  </Link>
                </div>
                <PostItem post={p} isOp={p.isOp} hideActions />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
