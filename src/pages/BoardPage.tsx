import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { forumService } from '../services/forumService';
import { Board, Thread } from '../types';
import { PostForm } from '../components/PostForm';
import { PostItem } from '../components/PostItem';
import { formatDate } from '../lib/utils';
import { Pin, Lock } from 'lucide-react';

export function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (boardId) {
      const fetchBoard = async () => {
        const b = await forumService.getBoard(boardId);
        const t = await forumService.getThreads(boardId);
        setBoard(b);
        setThreads(t);
        setLoading(false);
      };
      fetchBoard();
    }
  }, [boardId]);

  if (loading) return <div className="p-4 font-mono">Мы грузим подключение к серверу</div>;
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
                // Refresh threads
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
            {threads.map(thread => (
              <ThreadPreview key={thread.id} thread={thread} boardId={board.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadPreview({ thread, boardId }: { thread: Thread, boardId: string }) {
  const [opPost, setOpPost] = useState<any>(null);

  useEffect(() => {
    forumService.getPosts(boardId, thread.id).then(posts => {
      setOpPost(posts.find(p => p.isOp));
    });
  }, [boardId, thread.id]);

  return (
    <div className="border-b border-dotted border-[var(--color-border)] pb-8 mb-4">
      <div className="flex flex-col md:flex-row gap-4">
        {opPost && <PostItem post={opPost} isPreview hideActions />}
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
