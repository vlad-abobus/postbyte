export function Rules() {
  return (
    <div className="max-w-4xl mx-auto bg-[var(--color-post-bg)] border border-[var(--color-border)] p-6 md:p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--color-post-header)] border-b border-[var(--color-border)] mb-3 pb-2">
        Правила PostByteCL
      </h1>
      <p className="text-sm opacity-80 mb-6">
        Пространство для нормального общения. Здесь можно обсуждать технику, жизненные вопросы, учебу, быт и все,
        где нужен совет или поддержка.
      </p>

      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)]">1. База уважения</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Без угроз, буллинга, травли и языка ненависти.</li>
            <li>Критикуй идею, а не человека.</li>
            <li>Несогласие нормально, токсичность - нет.</li>
          </ul>
        </section>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)]">2. Контент и качество</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Не спамь, не флуди и не дублируй одинаковые треды.</li>
            <li>Добавляй понятный заголовок и суть вопроса в первых строках.</li>
            <li>Фейки, мошеннические схемы и незаконный контент удаляются.</li>
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
