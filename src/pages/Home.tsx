import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { forumService } from '../services/forumService';
import { Board } from '../types';
import { SitePromoBox } from '../components/SitePromoBox';

export function Home() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBoards = async () => {
      try {
        await forumService.seedData();
        const b = await forumService.getBoards();
        setBoards(b);
      } catch (e: any) {
        setError(e?.message || 'Не удалось загрузить доски');
      } finally {
        setLoading(false);
      }
    };
    fetchBoards();
  }, []);

  if (loading) return <div className="p-4 font-mono">Грузим подключение к серверу 1-3 минуты пожалуйста.</div>;
  if (error) return <div className="p-4 font-mono text-red-700">{error}</div>;

  const categories = Array.from(new Set(boards.map(b => b.category)));

  return (
    <div className="max-w-4xl mx-auto">
      <div className="board-banner">
        <h1 className="board-title">AnyWhere</h1>
        <p className="text-xs text-[var(--color-post-header)] opacity-80">Неплохой форум с досками у стиле "старого интернета "і</p>
      </div>
      <div className="w-fit mx-auto mb-6">
        <SitePromoBox />
      </div>

      <div className="flex flex-col gap-6">
        {categories.map(cat => (
          <div key={cat} className="border border-[var(--color-border)] bg-[var(--color-post-bg)] shadow-sm rounded-sm overflow-hidden">
            <div className="bg-[var(--color-accent)] text-white font-bold p-1 text-sm">{cat}</div>
            <div className="p-2 flex flex-wrap gap-x-8 gap-y-2">
              {boards.filter(b => b.category === cat).map(board => (
                <div key={board.id} className="w-[200px]">
                  <Link to={`/${board.id}`} className="post-link font-bold">
                    /{board.id}/ - {board.name}
                  </Link>
                  <p className="text-[11px] opacity-70">{board.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 border border-[var(--color-border)] bg-[var(--color-post-bg)] p-4 text-center shadow-sm">
        <h2 className="font-bold mb-2">Статистика</h2>
        <div className="flex justify-center gap-8 text-xs">
          <div>Всего досок: {boards.length}</div>
          <div>Формат общения: анонимно и по делу</div>
        </div>
      </div>
    </div>
  );
}
