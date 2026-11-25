import { useEffect, useState } from 'react';

interface LoadingStateProps {
  title?: string;
  subtitle?: string;
  variant?: 'home' | 'board' | 'thread' | 'profile' | 'admin';
}

export function LoadingState({
  title = 'Подключение к серверу',
  subtitle = 'Загружаем данные...',
  variant = 'home',
}: LoadingStateProps) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const dynamicHint =
    elapsedSec >= 12
      ? 'Сервер ещё просыпается — почти готово, страница обновится сама.'
      : elapsedSec >= 4
        ? 'Сервер просыпается после простоя, обычно это занимает несколько секунд...'
        : subtitle;

  return (
    <div className="max-w-4xl mx-auto py-8 px-2" role="status" aria-live="polite">
      {/* Main retro-tech loading card */}
      <div className="loader-card max-w-md mx-auto bg-[var(--color-post-bg)] border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="bg-[var(--color-accent)] text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold">
          <span className="flex items-center gap-2">
            <span className="loader-dot" aria-hidden="true" />
            <span>PostByte</span>
          </span>
          <span className="font-mono text-[10px] opacity-85">
            {elapsedSec > 0 ? `${elapsedSec}s` : 'SYNC'}
          </span>
        </div>

        <div className="p-5 flex flex-col items-center text-center gap-4">
          {/* Orbital spinner + signal bars */}
          <div className="relative flex items-center justify-center w-14 h-14">
            <div className="loader-ring-outer" aria-hidden="true" />
            <div className="loader-ring-inner" aria-hidden="true" />
            <div className="loader-bars" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-sm font-bold text-[var(--color-post-header)] tracking-tight">
              {title}
            </div>
            <div className="text-[11px] text-[var(--color-muted)] min-h-[1.25rem]">
              {dynamicHint}
            </div>
          </div>

          {/* Smooth indeterminate progress track */}
          <div className="w-full h-2 bg-[var(--color-board-bg)] border border-[var(--color-border)] overflow-hidden relative">
            <div className="loader-progress-bar" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Subtle layout skeleton underneath */}
      {variant === 'home' && (
        <div className="mt-6 border border-[var(--color-border)]/70 bg-[var(--color-post-bg)]/70 p-3 space-y-3">
          <div className="h-4 w-28 loader-skeleton" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3.5 w-32 loader-skeleton" />
                <div className="h-2.5 w-44 loader-skeleton" />
              </div>
            ))}
          </div>
        </div>
      )}

      {(variant === 'board' || variant === 'thread') && (
        <div className="mt-6 space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="border border-[var(--color-border)]/70 bg-[var(--color-post-bg)]/70 p-3 flex gap-3"
            >
              <div className="w-20 h-20 shrink-0 loader-skeleton" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 w-48 loader-skeleton" />
                <div className="h-3 w-full loader-skeleton" />
                <div className="h-3 w-2/3 loader-skeleton" />
              </div>
            </div>
          ))}
        </div>
      )}

      {variant === 'profile' && (
        <div className="mt-6 border border-[var(--color-border)]/70 bg-[var(--color-post-bg)]/70 p-4 flex gap-5 items-center">
          <div className="w-24 h-24 shrink-0 loader-skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 loader-skeleton" />
            <div className="h-3 w-28 loader-skeleton" />
            <div className="h-3 w-3/4 loader-skeleton" />
          </div>
        </div>
      )}

      {variant === 'admin' && (
        <div className="mt-6 border border-[var(--color-border)]/70 bg-[var(--color-post-bg)]/70 p-4 space-y-2.5">
          <div className="h-4 w-36 loader-skeleton" />
          <div className="h-3 w-full loader-skeleton" />
          <div className="h-3 w-5/6 loader-skeleton" />
          <div className="h-3 w-2/3 loader-skeleton" />
        </div>
      )}
    </div>
  );
}
