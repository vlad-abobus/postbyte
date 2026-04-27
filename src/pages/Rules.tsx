export function Rules() {
  return (
    <div className="max-w-3xl mx-auto bg-[var(--color-post-bg)] border border-[var(--color-border)] p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--color-post-header)] border-b border-[var(--color-border)] mb-4 pb-2">Global Rules</h1>
      
      <div className="space-y-6 text-sm">
        <section>
          <h2 className="font-bold text-[var(--color-post-header)]">Общие правила</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Пиши что угодно но не нарушай законы . Терористов мы сливаем фапкой</li>
            <li>Нет спама или флуда пожалуйста.</li>
            <li>Уважайте темы доски. Хотябы чучуть Строго наказывать не буду но пожалуйста!</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-post-header)]">2. Постинг и изображения</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Дубликаты изображений в одном треде не нада.</li>
            <li>Названия тредов должны быть описательными.</li>
            <li>NSFW контент разрешен ТОЛЬКО на NFSW доске.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-[var(--color-post-header)]">3. Модерация</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Админы имеют последнее слово. Если ты нарушаешь правила то ты будешь наказан.</li>
            <li>Админы тут вроде норм . Если хочешь им сказать то напиши пост об этом </li>
          </ul>
        </section>
      </div>

      <div className="mt-8 pt-4 border-t border-[var(--color-border)] text-[10px] opacity-70">
        Последнее обновление: когда ты сидел на толчке ахахахаха
      </div>
    </div>
  );
}
