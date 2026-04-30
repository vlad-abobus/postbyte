import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { forumService } from '../services/forumService';
import { Board, Thread, Post, User } from '../types';
import { PostForm } from '../components/PostForm';
import { PostItem } from '../components/PostItem';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export function ThreadPage() {
  const { boardId, threadId } = useParams<{ boardId: string, threadId: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (boardId && threadId) {
      const [b, t, p] = await Promise.all([
        forumService.getBoard(boardId),
        forumService.getThread(boardId, threadId),
        forumService.getPosts(boardId, threadId),
      ]);
      const meRes = await forumService.me().catch(() => ({ user: null }));
      setBoard(b);
      setThread(t);
      setPosts(p);
      setMe(meRes.user);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [boardId, threadId]);

  if (loading) return <div className="p-4 font-mono">Загрузка треда...</div>;
  if (!board || !thread) return <div className="p-4 font-mono text-red-600">Тред не найден</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4 flex justify-between items-center bg-[var(--color-post-bg)] p-1 border border-[var(--color-border)]">
        <Link to={`/${boardId}`} className="post-link flex items-center gap-1">
          <ArrowLeft size={12} />
          <span>Назад в /{boardId}/</span>
        </Link>
        <button onClick={fetchData} className="post-link flex items-center gap-1">
          <RefreshCw size={12} />
          <span>Обновить</span>
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {posts.map((post, idx) => (
          <div key={post.id} className={post.isOp ? "mb-4" : "reply-container"}>
            {!post.isOp && <div className="reply-side"></div>}
            <PostItem 
              post={post} 
              isOp={post.isOp} 
              boardId={boardId!}
              threadId={threadId!}
              onDelete={fetchData}
              canDelete={
                me?.role === 'admin' ||
                me?.role === 'moderator' ||
                (!!me?.uid && !!post.authorUid && me.uid === post.authorUid)
              }
            />
          </div>
        ))}
      </div>

      {thread.isLocked ? (
        <div className="mt-8 p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger-border)] text-center font-bold">
          Этот тред закрыт. Новые ответы недоступны.
        </div>
      ) : (
        <div className="mt-12 flex justify-center">
          <div className="w-full max-w-lg">
            <PostForm 
              boardId={boardId!} 
              threadId={threadId!} 
              onSuccess={fetchData}
            />
          </div>
        </div>
      )}
    </div>
  );
}
