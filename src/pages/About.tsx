export function About() {
  return (
    <div className="max-w-4xl mx-auto bg-[var(--color-post-bg)] border border-[var(--color-border)] p-6 md:p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--color-post-header)] border-b border-[var(--color-border)] mb-4 pb-2">
        О PostByteCL
      </h1>

      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong>PostByteCL</strong> - это форум-сообщество в стиле имиджборда, где важны живое общение, полезные советы
          и свободные обсуждения без лишнего шума.
        </p>

        <p>
          Ключевая идея: дать людям простое место для вопросов и ответов. Особенно на доске <strong>/help/</strong>,
          где можно получить помощь с техникой, работой, учебой и жизненными ситуациями.
        </p>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)] mb-2">Что есть сейчас</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>Доски с тредами и ответами в реальном времени.</li>
            <li>Профили пользователей, базовая модерация, репорты.</li>
            <li>Публикация изображений и работа с ролями (user/moderator/admin).</li>
          </ul>
        </section>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)] mb-2">Технологический стек</h2>
          <p>
            Фронтенд: React + Tailwind CSS. Бэкенд: Flask + SQLAlchemy. База: PostgreSQL. Для хранения файлов и деплоя
            используются Cloudinary и Render.
          </p>
        </section>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)] mb-2">Команда</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>VladislavMorgan - программист и разработчик.</li>
            <li>Lucky_13 - UI/UX и визуальный стиль.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
