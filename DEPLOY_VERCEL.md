# Деплой на Vercel

Проект разворачивается одним Vercel-проектом с двумя сервисами:

```text
/            -> web (Vite, статика из dist/)
/api/*       -> api (Flask, Python Function)
/uploads/*   -> api (нужно только при локальных загрузках)
```

База данных — PostgreSQL (Neon), картинки — Cloudinary.

## Что уже подготовлено в репозитории

- `vercel.json` — сервисы `web` и `api`, маршрутизация, SPA fallback.
- `backend/.python-version` — Python 3.13.
- `backend/app.py`, `backend/models.py` — импорты работают и как пакет (`backend.app`), и как top-level модуль (`app`) на Vercel.
- `src/services/forumService.ts` — в production использует относительный `/api`, локально — `http://localhost:5000`.
- `.gitignore` — добавлены `.vercel/`, `__pycache__/`, `*.pyc`.

## 1. Neon PostgreSQL

В Vercel: **Storage → Create Database → Neon**.

- Регион — рядом с функциями (например, `fra1` / `eu-central-1`).
- Для Production используй отдельную базу.
- Для Preview лучше создать отдельную базу или Neon branch, иначе preview-деплои будут писать в production.

Нужна переменная `DATABASE_URL` — pooled connection string. Переменная `DATABASE_URL_UNPOOLED` используется только для restore/миграций.

Схема создастся автоматически при первом запросе: `db.create_all()` и `_ensure_default_boards()`.

## 2. Cloudinary

Создай аккаунт на cloudinary.com и возьми данные из **Dashboard → Product Environment Credentials**.

Переменные:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=postbytecl
```

Без Cloudinary загрузки будут писаться в `/tmp` и исчезать. Для production это не подходит.

## 3. Переменные окружения Vercel

| Переменная | Значение | Обязательно |
|---|---|---|
| `SECRET_KEY` | `python -c "import secrets; print(secrets.token_hex(32))"` | да |
| `DATABASE_URL` | pooled URL из Neon | да |
| `UPLOADS_DIR` | `/tmp/uploads` | да |
| `MAX_UPLOAD_BYTES` | `4000000` | да |
| `CORS_ORIGINS` | `https://<production-домен>` | да |
| `SESSION_COOKIE_SAMESITE` | `Lax` | да |
| `SESSION_COOKIE_SECURE` | `true` | да |
| `CLOUDINARY_CLOUD_NAME` | из Cloudinary | для картинок |
| `CLOUDINARY_API_KEY` | из Cloudinary | для картинок |
| `CLOUDINARY_API_SECRET` | из Cloudinary | для картинок |
| `CLOUDINARY_FOLDER` | `postbytecl` | нет |
| `ADMIN_KEY` | random hex | рекомендуется |
| `VITE_API_BASE` | не задавать | нет |
| `VITE_ADMIN_KEY` | **не задавать** | — |

Важно:

- `SECRET_KEY` должен быть фиксированным. Иначе капча и логин будут случайно ломаться между инстансами.
- `UPLOADS_DIR=/tmp/uploads` не даёт приложению упасть на read-only filesystem.
- `MAX_UPLOAD_BYTES` меньше лимита Vercel в 4.5 MB.
- `CORS_ORIGINS` — точный origin без слэша на конце. При кастомном домене перечисли оба через запятую.
- `VITE_ADMIN_KEY` попадает в публичный JS-бандл. Для админки используй роль пользователя в БД.

## 4. Импорт проекта в Vercel

1. Push в GitHub.
2. [vercel.com/new](https://vercel.com/new) → импорт репозитория.
3. **Framework Preset** — `Services`.
4. **Root Directory** — корень репозитория (`./`).
5. Build & Output Settings не заполнять — всё в `vercel.json`.
6. Добавить переменные окружения для Production.
7. Deploy.

Если пресета `Services` нет:

```bash
npm i -g vercel@latest
vercel link
vercel project update --framework services
vercel --prod
```

В логах сборки должно быть два сервиса: `web` и `api`.

## 5. После деплоя

Проверь:

```text
GET /api/health              -> {"ok": true}
GET /api/boards              -> help, meme, talk
GET /rules                   -> страница открывается (SPA fallback)
GET /api/captcha             -> captchaId + image
POST /api/auth/register      -> регистрация, cookie session
POST /api/uploads            -> URL res.cloudinary.com
```

Cookie должна быть `HttpOnly`, `Secure`, `SameSite=Lax`.

Если добавляешь кастомный домен — добавь его в `CORS_ORIGINS` и сделай redeploy.

## 6. Первый администратор

Зарегистрируйся на сайте, затем в Neon SQL Editor:

```sql
UPDATE users SET role = 'admin' WHERE username = 'твой_username';
```

Роль подхватится сразу, потому что она читается из БД на каждом запросе.

## 7. Частые ошибки

| Ошибка | Решение |
|---|---|
| `attempted relative import with no known parent package` | Проверь патч импортов в `backend/app.py` и `backend/models.py` |
| `Read-only file system` | `UPLOADS_DIR=/tmp/uploads`, Cloudinary |
| `ModuleNotFoundError: flask` | Сервис `api` должен иметь `root: "backend/"` и `backend/requirements.txt` |
| `ModuleNotFoundError: backend` | При `root: "backend/"` entrypoint — `app:app` |
| 413 при загрузке | Уменьшить `MAX_UPLOAD_BYTES`, сжать картинку |
| `FUNCTION_INVOCATION_FAILED` | Смотреть Runtime Logs; чаще всего нет `DATABASE_URL`, не задан `UPLOADS_DIR` или неверный `MAX_UPLOAD_BYTES` |
| Картинки исчезают | Настроить Cloudinary |
| Капча/логин не работают | Проверить `SECRET_KEY`, cookie, same-origin |
| CORS | Добавить точный origin в `CORS_ORIGINS`, redeploy |
| 404 на deep link | Проверить SPA rewrite в сервисе `web` |
| Preview пишет в prod | Отдельная Neon-база/branch для Preview |

## 8. Ограничения

- Диск Vercel не постоянный: всё, что нужно сохранить, — в БД или Cloudinary.
- Лимит тела запроса — 4.5 MB на Hobby.
- Функция не должна рассчитывать на фоновые процессы.
- `db.create_all()` выполняется при холодном старте, поэтому база должна быть доступна до первого запроса.
- Vercel Services — Beta. Если нужна максимально консервативная схема, можно разнести frontend и backend на два проекта, но тогда cookie лучше держать same-origin через прокси или кастомные поддомены.

## 9. Переменные Neon

`DATABASE_URL` и `DATABASE_URL_UNPOOLED` бери в Neon Console → Connection Details.
Не коммить строки подключения и пароли в репозиторий — добавляй их только в Vercel Environment Variables.

## 10. Если функция падает с `FUNCTION_INVOCATION_FAILED`

Это не ошибка сборки, а падение Python-функции при старте. Нужен traceback:

1. Vercel → проект → **Deployments** → последний deployment → **Logs** → **Runtime Logs**.
2. Ищи строку `[postbyte] startup:` — в ней видно, какие переменные дошли до функции.
3. Если в логах есть `Database initialization failed`, смотри текст исключения ниже.
4. Через CLI:

```bash
npm i -g vercel@latest
vercel link
vercel logs <deployment-url>
```

Что означает ошибка:

| В логах | Причина |
|---|---|
| `database_url=missing` | `DATABASE_URL` не добавлен для **Production** |
| `OperationalError` / `could not connect` | неверный Neon URL, пароль, SSL или база недоступна |
| `Read-only file system` | не задан `UPLOADS_DIR=/tmp/uploads` |
| `Invalid MAX_UPLOAD_BYTES` | значение должно быть целым числом, например `4000000` |
| `ModuleNotFoundError` | зависимости не установились: проверь `backend/requirements.txt` и `root: "backend/"` |
| `attempted relative import` | задеплоен старый коммит без патча импортов |

После изменения Environment Variables сделай **новый deployment**. Обновление старого deployment переменные не подхватывает.