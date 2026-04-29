export function About() {
  return (
    <div className="max-w-4xl mx-auto bg-[var(--color-post-bg)] border border-[var(--color-border)] p-6 md:p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--color-post-header)] border-b border-[var(--color-border)] mb-4 pb-2">
        About PostByteCL
      </h1>

      <div className="space-y-6 text-sm leading-relaxed">
        <p>
          <strong>PostByteCL</strong> - це community-форум у стилі imageboard, де важливі жива дискусія, корисні поради
          та вільне спілкування без зайвого шуму.
        </p>

        <p>
          Ключова ідея: дати людям просте місце для запитань і відповідей. Особливо на дошці <strong>/help/</strong>,
          де можна отримати допомогу з технікою, роботою, навчанням і життєвими ситуаціями.
        </p>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)] mb-2">Що є зараз</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>Дошки з тредами та відповідями в реальному часі.</li>
            <li>Профілі користувачів, базова модерація, репорти.</li>
            <li>Публікація зображень і робота з ролями (user/moderator/admin).</li>
          </ul>
        </section>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)] mb-2">Технологічний стек</h2>
          <p>
            Frontend: React + Tailwind CSS. Backend: Flask + SQLAlchemy. База: PostgreSQL. Для файлів і деплою
            використовуються Cloudinary та Render.
          </p>
        </section>

        <section className="border border-[var(--color-border)] p-4 bg-white/40">
          <h2 className="font-bold text-[var(--color-post-header)] mb-2">Команда</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>Wirnty - backend та core-логіка.</li>
            <li>Lucky_13 - UI/UX та візуальний стиль.</li>
            <li>VladislavMorgan - розвиток проєкту та ком'юніті-напрямок.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
