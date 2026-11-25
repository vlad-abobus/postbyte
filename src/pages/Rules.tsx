export function Rules() {
  return (
    <div className="max-w-4xl mx-auto bg-[var(--color-post-bg)] border border-[var(--color-border)] p-6 md:p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--color-post-header)] border-b border-[var(--color-border)] mb-3 pb-2">
        Правила PostByte
      </h1>
      <p className="text-sm opacity-80 mb-6">
        Пространство для норм общения. Здесь можно обсуждать все.
      </p>

      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)]">1. Безопасность</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Не угрожай, не троллируй и не распространяй ложную информацию.</li>
          </ul>
        </section>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)]">2. Контент и качество</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Не спамь, не флуди и не дублируй одинаковые треды.</li>
            <li>Добавляй понятный заголовок и суть вопроса в первых строках.</li>
            <li>Фейки, мошеннические схемы и незаконный контент удаляются.</li>
            <li>NFSW-медиа автоматически проверяется перед отправкой. Если такой контент попал на сайт - отправь репорт. Он будет удален.</li>
          </ul>
        </section>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)]">3. Дошка /help/</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Доска `/help/` для взаимопомощи: техника, жизнь, работа, учеба, быт.</li>
            <li>Пиши контекст: что уже пробовал, какие ошибки/симптомы, какой результат нужен.</li>
            <li>Отвечай по делу, без унижений и "троллинга ради троллинга".</li>
          </ul>
        </section>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)]">4. Модерация</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Нарушения могут привести к удалению поста, муту или бану.</li>
            <li>Решения модерации финальные, но конструктивная обратная связь приветствуется.</li>
            <li>Если видишь нарушение - используй репорт.</li>
          </ul>
        </section>
      </div>

      <div className="mt-8 pt-4 border-t border-[var(--color-border)] text-[11px] opacity-70">
        Обновлено: апрель 2026
      </div>
    </div>
  );
}
