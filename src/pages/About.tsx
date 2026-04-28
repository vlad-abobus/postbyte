export function About() {
  return (
    <div className="max-w-3xl mx-auto bg-[var(--color-post-bg)] border border-[var(--color-border)] p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-[var(--color-post-header)] border-b border-[var(--color-border)] mb-4 pb-2">About PostByteCL</h1>
      
      <div className="space-y-4 text-sm leading-relaxed">
        <p>
          <strong>PostByteCL</strong> это неплохой форум для обсуждения всякого, что угодно 
          и всюду, где нельзя обсуждать в социальных сетях.
        </p>

        <p>
          Создан еще у январе но это чтото типа ремейка у каком виде его хотели быть но не были в состоянии сделать
        </p>

        <h2 className="font-bold text-[var(--color-post-header)] mt-6">Features</h2>
        Авторы этого форума:
        <ul className="list-disc ml-5 space-y-1">
          <li>Wirnty - главный программист</li>
          <li>Lucky_13 - главный UI/UX дизайнер именно он разработал дизайн этого форума у стиле 4 чана</li>
          <li>VladislavMorgan - <p>ля кто его сюда добавил</p></li>
        </ul>

        <h2 className="font-bold text-[var(--color-post-header)] mt-6">Технологии</h2>
        <p>
          Тута у нас есть React, Flask, Tailwind CSS, и PostgreSQL - неплохой стек для форума
          нам еще понадобится Cloudinary для хранения изображений и Cloudflare для CDN
          и Render для развертывания нашего форума
          Но тута бесплатная версия у хостинге так шо если хотите поддержать развитие напишите 
        </p>
      </div>

    
    </div>
  );
}
