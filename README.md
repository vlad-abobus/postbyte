# PostByteCL

<p align="center">
  <img src="./public/miku-vocaloid.gif" alt="PostByteCL preview" width="100%" />
</p>

<p align="center">
  Анонимная имиджборда с вайбом классических imageboard и современным веб-стеком
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22.x-339933?logo=nodedotjs&logoColor=white" alt="Node.js badge" />
  <img src="https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white" alt="Vite badge" />
  <img src="https://img.shields.io/badge/Flask-3.x-000000?logo=flask&logoColor=white" alt="Flask badge" />
  <img src="https://img.shields.io/badge/PostgreSQL-16.x-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL badge" />
  <a href="https://postbyte-2.onrender.com/">
    <img src="https://img.shields.io/badge/Render-Live-46E3B7?logo=render&logoColor=black" alt="Render live badge" />
  </a>
  <img src="https://img.shields.io/badge/License-TBD-lightgrey" alt="License badge" />
</p>

<p align="center">
  <a href="https://postbyte-2.onrender.com/">Live Demo</a>
</p>

## О проекте

**PostByteCL** - это pet-проект, где я собрал анонимный форум с древовидными тредами, загрузкой изображений и минималистичным UI в духе старых имиджборд.  
Главная цель - показать умение собирать полноценный full-stack продукт: от интерфейса и UX до API, хранения данных и деплоя.

## Что демонстрирует проект

- Проектирование структуры форума: доски, треды, ответы, профили
- Работа с пользовательским контентом и загрузками изображений
- Разделение фронтенда и API с чистыми контрактами
- Продакшен-деплой full-stack приложения в Render
- Масштабируемая архитектура, которую можно развивать в сторону модерации, ролей и аналитики

## Галерея интерфейса

<p align="center">
  <img src="./kl1.png" alt="PostByteCL screenshot 1" width="49%" />
  <img src="./kl2.png" alt="PostByteCL screenshot 2" width="49%" />
</p>

## Архитектура

- **Frontend:** `React 19` + `TypeScript` + `Vite` + `TailwindCSS`
- **Backend:** `Flask` + `SQLAlchemy`
- **Data Layer:** `PostgreSQL`
- **Media:** локальные uploads / опционально Cloudinary
- **Deployment:** Render Blueprint (`web + api`)

## Ключевые возможности

- Категории досок и навигация по разделам
- Создание тредов и ответов в анонимном формате
- Публикация контента с изображениями
- Базовые механики админ-доступа для модерации
- Аутентификация и страницы профиля пользователя

## Технический фокус

Проект сфокусирован не на "учебном CRUD", а на продуктовой сборке:

- единый стиль UI и быстрый рендер интерфейса;
- понятный API для фронтенда и изоляция бизнес-логики;
- готовность к реальному хостингу и работе с внешними сервисами.

## Demo

- Live: [https://postbyte-2.onrender.com/](https://postbyte-2.onrender.com/)

## Статус

Проект в активном развитии: планируются улучшения модерации, производительности и UX.
