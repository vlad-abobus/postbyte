export function Rules() {
  return (
    <div className="max-w-4xl mx-auto bg-[var(--color-post-bg)] border border-[var(--color-border)] p-6 md:p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--color-post-header)] border-b border-[var(--color-border)] mb-3 pb-2">
        Правила PostByteCL
      </h1>
      <p className="text-sm opacity-80 mb-6">
        Простір для нормального спілкування. Тут можна обговорювати техніку, життєві питання, навчання, побут і все,
        де потрібна порада або підтримка.
      </p>

      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)]">1. База поваги</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Без погроз, булінгу, переслідування та мови ненависті.</li>
            <li>Критикуй ідею, а не людину.</li>
            <li>Незгода ок, токсичність - ні.</li>
          </ul>
        </section>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)]">2. Контент і якість</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Не спам, не флуд, не дублюй однакові треди.</li>
            <li>Додавай зрозумілий заголовок і суть питання в перших рядках.</li>
            <li>Фейки, шахрайські схеми та незаконний контент видаляються.</li>
          </ul>
        </section>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)]">3. Дошка /help/</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Дошка `/help/` для взаємодопомоги: техніка, життя, робота, навчання, побут.</li>
            <li>Пиши контекст: що вже пробував, які помилки/симптоми, який результат хочеш.</li>
            <li>Відповідай по суті, без принижень і "тролінгу заради тролінгу".</li>
          </ul>
        </section>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)]">4. Модерація</h2>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>Порушення можуть призвести до видалення поста, муту або бану.</li>
            <li>Рішення модерації фінальні, але конструктивний фідбек вітається.</li>
            <li>Якщо бачиш порушення - використовуй репорт.</li>
          </ul>
        </section>
      </div>

      <div className="mt-8 pt-4 border-t border-[var(--color-border)] text-[11px] opacity-70">
        Оновлено: квітень 2026
      </div>
    </div>
  );
}
