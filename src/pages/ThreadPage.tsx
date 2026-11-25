import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { forumService } from '../services/forumService';
import { Board, Thread, Post } from '../types';
import { PostForm } from '../components/PostForm';
import { PostItem } from '../components/PostItem';
import { LoadingState } from '../components/LoadingState';
import { useAuth } from '../lib/auth';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export function ThreadPage() {
  const { boardId, threadId } = useParams<{ boardId: string; threadId: string }>();
  const navigate = useNavigate();
  const { user: me, isStaff } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!boardId || !threadId) return;
    try {
      const [b, t] = await Promise.all([
        forumService.getBoard(boardId),
        forumService.getThread(boardId, threadId),
      ]);
      setBoard(b);
      setThread(t);
      if (t) {
        const p = await forumService.getPosts(boardId, threadId);
        setPosts(p);
      } else {
        setPosts([]);
      }
    } finally {
      setLoading(false);
    }
  }, [boardId, threadId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handlePostDeleted = ({ postId, deletedThread }: { postId: string; deletedThread: boolean }) => {
    if (deletedThread) {
      navigate(`/${boardId}`, { replace: true });
      return;
    }
    setPosts((prev) => prev.filter((item) => item.id !== postId));
  };

  if (loading) {
    return (
      <LoadingState
        title="Загрузка треда"
        subtitle="Получаем сообщения..."
        variant="thread"
      />
    );
  }
  if (!board || !thread) return <div className="p-4 font-mono text-red-600">Тред не найден</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-4 flex justify-between items-center gap-3 bg-[var(--color-post-bg)] p-1.5 px-2 border border-[var(--color-border)]">
        <Link to={`/${boardId}`} className="post-link flex items-center gap-1 shrink-0">
          <ArrowLeft size={12} />
          <span>Назад в /{boardId}/</span>
        </Link>
        {thread.title && (
          <span className="font-bold text-xs text-[var(--color-post-header)] truncate">
            {thread.title}
          </span>
        )}
        <button onClick={fetchData} className="post-link flex items-center gap-1 bg-transparent border-none p-0 shrink-0">
          <RefreshCw size={12} />
          <span>Обновить</span>
        </button>
      </div>

      <div className="flex flex-col gap-1">
        {posts.map((post) => (
          <div key={post.id} className={post.isOp ? 'mb-4' : 'reply-container'}>
            {!post.isOp && <div className="reply-side"></div>}
            <PostItem
              post={post}
              isOp={post.isOp}
              threadTitle={post.isOp ? thread.title : undefined}
              boardId={boardId!}
              threadId={threadId!}
              onDelete={handlePostDeleted}
              canDelete={
                isStaff ||
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
