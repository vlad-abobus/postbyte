import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { forumService } from '../services/forumService';
import { Board, Post, Thread } from '../types';
import { PostForm } from '../components/PostForm';
import { PostItem } from '../components/PostItem';
import { LoadingState } from '../components/LoadingState';
import { useAuth } from '../lib/auth';
import { Pin, Lock } from 'lucide-react';

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { user: me, isStaff } = useAuth();
  const [board, setBoard] = useState<Board | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (boardId) {
      setLoading(true);
      const fetchBoard = async () => {
        try {
          const [b, t] = await Promise.all([
            forumService.getBoard(boardId),
            forumService.getThreads(boardId),
          ]);
          setBoard(b);
          setThreads(t);
        } finally {
          setLoading(false);
        }
      };
      fetchBoard();
    }
  }, [boardId]);

  if (loading) {
    return (
      <LoadingState
        title={`Загрузка доски /${boardId}/`}
        subtitle="Подключаемся к серверу и получаем треды..."
        variant="board"
      />
    );
  }
  if (!board) return <div className="p-4 font-mono text-red-600">Доска не найдена.</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="board-banner">
        <h1 className="board-title">/{board.id}/ - {board.name}</h1>
        <p className="text-xs italic text-[var(--color-post-header)] opacity-80">{board.description}</p>
      </div>

      <div className="flex justify-center mb-8">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="text-[var(--color-link)] underline font-bold cursor-pointer hover:text-[var(--color-link-hover)]"
          >
            [Создать новый тред]
          </button>
        ) : (
          <div className="w-full max-w-lg">
            <PostForm
              boardId={board.id}
              onSuccess={() => {
                setShowForm(false);
                forumService.getThreads(board.id).then(setThreads);
              }}
              onCancel={() => setShowForm(false)}
              isThread
            />
          </div>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] pt-4">
        {threads.length === 0 ? (
          <div className="text-center py-10 opacity-50">Пока нет тредов. Будьте первым.</div>
        ) : (
          <div className="flex flex-col gap-8">
            {threads.map((thread) => (
              <ThreadPreview
                key={thread.id}
                thread={thread}
                boardId={board.id}
                currentUid={me?.uid}
                isStaff={isStaff}
                onDeleted={() => setThreads((prev) => prev.filter((item) => item.id !== thread.id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadPreview({
  thread,
  boardId,
  currentUid,
  isStaff,
  onDeleted,
}: {
  thread: Thread;
  boardId: string;
  currentUid?: string;
  isStaff: boolean;
  onDeleted: () => void;
}) {
  const [opPost, setOpPost] = useState<Post | null>(null);

  useEffect(() => {
    let active = true;
    forumService
      .getPosts(boardId, thread.id)
      .then((posts) => {
        if (active) setOpPost(posts.find((p) => p.isOp) || null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [boardId, thread.id]);

  const canDeleteOp = isStaff || (!!currentUid && !!opPost?.authorUid && currentUid === opPost.authorUid);

  return (
    <div className="border-b border-dotted border-[var(--color-border)] pb-8 mb-4">
      <div className="flex flex-col md:flex-row gap-4">
        {opPost ? (
          <PostItem
            post={opPost}
            isOp
            threadTitle={thread.title}
            boardId={boardId}
            threadId={thread.id}
            canDelete={canDeleteOp}
            onDelete={onDeleted}
            isPreview
            hideActions
          />
        ) : thread.title ? (
          <Link
            to={`/${boardId}/thread/${thread.id}`}
            className="text-base font-bold text-[var(--color-post-header)] hover:text-[var(--color-link-hover)] hover:underline"
          >
            {thread.title}
          </Link>
        ) : null}
      </div>
      <div className="mt-2 text-xs opacity-70 ml-2">
        <Link to={`/${boardId}/thread/${thread.id}`} className="post-link font-bold">
          [Открыть тред]
        </Link>
        <span className="mx-2">
          Скрыто: {thread.replyCount} ответов и {thread.imageCount} изображений.
        </span>
        {thread.isPinned && <Pin size={10} className="inline mr-1 text-[var(--color-post-header)]" />}
        {thread.isLocked && <Lock size={10} className="inline mr-1 text-[var(--color-post-header)]" />}
      </div>
    </div>
  );
}
