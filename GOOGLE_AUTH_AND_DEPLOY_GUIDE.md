# Руководство: Бесплатный запуск Next.js (0$/мес) + Вход через Google в 1 клик

Это руководство позволит вам:
1. Получить бесплатные ключи Google для входа в админку без ввода паролей.
2. Опубликовать сайт на бесплатном хостинге **Vercel** или **Cloudflare Pages** с автоматическим SSL и привязкой домена `rifemotion.com`.

---

## Шаг 1. Получение бесплатных ключей Google OAuth (2 минуты)

Чтобы кнопка **«Войти через Google»** работала для вашего аккаунта:

1. Откройте [Google Cloud Console](https://console.cloud.google.com/).
2. Вверху нажмите **«Select a project»** (или выпадающий список проектов) → **«New Project»** (Создать проект) → назовите его `RifeMotion` → нажмите **Create**.
3. В левом меню перейдите в раздел **APIs & Services** → **OAuth consent screen** (Экран согласия OAuth):
   - Выберите **External** (Внешний) → нажмите **Create**.
   - **App name**: `RifeMotion`
   - **User support email**: выберите вашу почту.
   - **Developer contact information**: укажите вашу почту.
   - Нажмите **Save and Continue** (Сохранить и продолжить) до конца.
4. В левом меню перейдите в раздел **Credentials** (Учетные данные):
   - Вверху нажмите **+ CREATE CREDENTIALS** → выберите **OAuth client ID**.
   - **Application type**: выберите **Web application**.
   - **Name**: `RifeMotion Web`
   - В блоке **Authorized JavaScript origins** (Разрешенные источники JavaScript) добавьте:
     - `http://localhost:3000` (для тестов на компьютере)
     - `https://rifemotion.com` (ваш домен)
     - `https://www.rifemotion.com`
   - В блоке **Authorized redirect URIs** (Разрешенные URI перенаправления) добавьте:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://rifemotion.com/api/auth/callback/google`
     - `https://www.rifemotion.com/api/auth/callback/google`
5. Нажмите **Create**!
   - Вам покажут всплывающее окно с двумя ключами:
     - **Client ID** (например, `123456789-abc.apps.googleusercontent.com`)
     - **Client Secret** (например, `GOCSPX-xyz123...`)
   - Скопируйте их.

---

## Шаг 2. Настройка переменных окружения

В вашем проекте в файле `.env.local` укажите:

```env
NEXTAUTH_URL=https://rifemotion.com
NEXTAUTH_SECRET=super_secret_random_32_characters_key_here

GOOGLE_CLIENT_ID=ваш_Client_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=ваш_Client_Secret

# Ваш личный Google Email (только вы сможете заходить в админку)
ALLOWED_ADMIN_EMAILS=ваш_email@gmail.com
```

> 💡 Для локальной разработки на компьютере укажите `NEXTAUTH_URL=http://localhost:3000`.

---

## Шаг 3. Бесплатный деплой на Vercel (0$/мес, самый простой вариант)

1. Зарегистрируйтесь бесплатно на [Vercel.com](https://vercel.com/) через ваш GitHub.
2. Нажмите **Add New...** → **Project**.
3. Выберите репозиторий `rifemotion.com`.
4. В поле **Environment Variables** добавьте 5 переменных из Шага 2:
   - `NEXTAUTH_URL` = `https://rifemotion.com`
   - `NEXTAUTH_SECRET` = любой случайный пароль/строка
   - `GOOGLE_CLIENT_ID` = ваш Client ID
   - `GOOGLE_CLIENT_SECRET` = ваш Client Secret
   - `ALLOWED_ADMIN_EMAILS` = ваша почта Google
5. Нажмите кнопку **Deploy**! Через 30 секунд ваш сайт будет в сети.

---

## Шаг 4. Подключение домена `rifemotion.com` в Vercel

1. В панели проекта на Vercel перейдите в **Settings** → **Domains**.
2. Введите `rifemotion.com` и нажмите **Add**.
3. Vercel покажет 2 DNS-записи:
   - **A-запись**: `76.76.21.21` для `@`
   - **CNAME-запись**: `cname.vercel-dns.com` для `www`
4. В панели, где покупался ваш домен (Reg.ru, Namecheap, Cloudflare и т.д.), добавьте эти 2 записи в DNS.
5. Vercel автоматически выпустит бесплатный SSL-сертификат (HTTPS).

---

## Готово! Как это работает:

- Главная страница: **`https://rifemotion.com`** (видеофон, маска, соцсети, быстрый CDN).
- Вход в админку: **`https://rifemotion.com/admin/login`**.
- Нажимаете **«Продолжить с Google»** → выбираете свой аккаунт → мгновенно попадаете в дашборд.
- Браузер запоминает вас на **30 дней**, больше никаких паролей вводить не нужно!
- Посторонние люди при попытке входа получат отказ в доступе (Access Denied).
