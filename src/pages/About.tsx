export function About() {
  return (
    <div className="max-w-4xl mx-auto bg-[var(--color-post-bg)] border border-[var(--color-border)] p-6 md:p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--color-post-header)] border-b border-[var(--color-border)] mb-4 pb-2">
        О PostByte
      </h1>

      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong>PostByte</strong> - это форум-сообщество в стиле имиджборда, где важны живое общение, полезные советы
          и свободные обсуждения без лишнего шума.
        </p>

        <p>
          Ключевая идея: дать людям простое место для вопросов и ответов. Особенно на доске <strong>/help/</strong>,
          где можно получить помощь с техникой, работой, учебой и жизненными ситуациями.
        </p>

        <figure className="border border-[var(--color-border)] bg-white/50 p-4 flex flex-col items-center text-center gap-3">
          <img
            src="/kitsuni.jpg"
            alt="Официальный маскот PostByte"
            className="max-w-full sm:max-w-sm max-h-[380px] object-contain border border-[var(--color-border)] bg-white shadow-sm"
          />
          <figcaption className="text-xs font-bold text-[var(--color-post-header)]">
            Официальный маскот PostByte! Нарисовано Lucky_13X
          </figcaption>
        </figure>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)] mb-2">Что есть сейчас</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>Доски с тредами и ответами в реальном времени.</li>
            <li>Профили пользователей, базовая модерация, репорты.</li>
            <li>Публикация изображений и GIF, проверка контента и работа с ролями (user/moderator/admin).</li>
          </ul>
        </section>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)] mb-2">Технологический стек</h2>
          <p>
            Фронтенд: React + Tailwind CSS. Бэкенд: Flask + SQLAlchemy. База: PostgreSQL. Для хранения файлов и деплоя
            используются Cloudinary, Vercel и Render.
          </p>
        </section>
      </div>
    </div>
  );
}
