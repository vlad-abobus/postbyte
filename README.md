# PostByteCL

<p align="center">
  <img src="./public/miku-vocaloid.gif" alt="PostByteCL preview" width="100%" />
</p>

<p align="center">
  Анонимная имиджборда с React + Flask + PostgreSQL
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22.x-339933?logo=nodedotjs&logoColor=white" alt="Node.js badge" />
  <img src="https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white" alt="Vite badge" />
  <img src="https://img.shields.io/badge/Flask-3.x-000000?logo=flask&logoColor=white" alt="Flask badge" />
  <img src="https://img.shields.io/badge/PostgreSQL-16.x-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL badge" />
  <a href="https://postbyte-2.onrender.com/">
    <img src="https://img.shields.io/badge/Render-Deployed-46E3B7?logo=render&logoColor=black" alt="Render deploy badge" />
  </a>
  <img src="https://img.shields.io/badge/License-TBD-lightgrey" alt="License badge" />
</p>

> Актуальный деплой: `https://postbyte-2.onrender.com/`.

## Оглавление

- [Скриншоты](#скриншоты)
- [Стек](#стек)
- [Быстрый старт (локально)](#быстрый-старт-локально)
- [Переменные окружения (backend)](#переменные-окружения-backend)
- [Деплой на Render](#деплой-на-render)
- [Полезно](#полезно)

## Скриншоты

<p align="center">
  <img src="./kl1.png" alt="PostByteCL screenshot 1" width="49%" />
  <img src="./kl2.png" alt="PostByteCL screenshot 2" width="49%" />
</p>

## Стек

- Frontend: `React 19`, `TypeScript`, `Vite`, `TailwindCSS`
- Backend: `Flask`, `SQLAlchemy`
- База данных: `PostgreSQL`
- Хранилище файлов: локальные uploads или Cloudinary

## Быстрый старт (локально)

### 1) Frontend

```powershell
npm install
npm run dev
```

По умолчанию фронтенд поднимается на `http://localhost:3000`.

Если API работает отдельно, укажите в `.env.local`:

```env
VITE_API_BASE=http://localhost:5000
```

### 2) Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m flask --app backend.app run --port 5000
```

API будет доступен на `http://localhost:5000`.

## Переменные окружения (backend)

- `DATABASE_URL` - URL подключения к PostgreSQL
- `UPLOADS_DIR` - директория загрузок (по умолчанию `uploads`)
- `MAX_UPLOAD_BYTES` - максимальный размер файла
- `CORS_ORIGINS` - разрешенные origin для `/api/*`
- `ADMIN_KEY` - ключ для админ-эндпоинтов
- Cloudinary (опционально): `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`

## Деплой на Render

В проекте уже есть `render.yaml` (Blueprint) с двумя сервисами:

- `postbytecl-api` - Flask API
- `postbytecl-web` - React frontend

Шаги:

1. Запушить проект в GitHub
2. В Render выбрать **New + -> Blueprint**
3. Подключить репозиторий и создать сервисы
4. Проверить `CORS_ORIGINS` и `VITE_API_BASE`, затем сделать redeploy при необходимости

## Полезно

- Детали по backend: `backend/README.md`
