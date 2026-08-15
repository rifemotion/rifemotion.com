"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import "./admin.css";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="adminContainer" style={{ justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "#9ca3af" }}>Проверка авторизации...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const user = session.user;

  return (
    <div className="adminContainer">
      <header className="adminNav">
        <Link href="/admin" className="adminBrand">
          <div className="adminBrandIcon">R</div>
          <span>rifemotion <span style={{ fontWeight: 400, color: "#6b7280" }}>admin</span></span>
        </Link>

        <div className="adminNavRight">
          <Link href="/" target="_blank" className="btnSite">
            🌐 На сайт
          </Link>
          <div className="userProfile">
            {user.image && (
              <img src={user.image} alt={user.name || "Admin"} className="userAvatar" />
            )}
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{user.name || "Администратор"}</div>
              <div className="userEmail">{user.email}</div>
            </div>
          </div>
          <button
            type="button"
            className="btnLogout"
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
          >
            Выйти
          </button>
        </div>
      </header>

      <main className="adminMain">
        <div className="heroCard">
          <h1 className="heroTitle">👋 Hello World, {user.name || "Admin"}!</h1>
          <p className="heroDesc">
            Добро пожаловать в админ-панель rifemotion.com на Next.js. Авторизация через Google успешно выполнена, сессия активна на 30 дней.
          </p>
          <div className="badgeRow">
            <span className="badge badgeActive">🟢 Google Auth: Активен</span>
            <span className="badge badgeActive">⚡ Next.js App Router</span>
            <span className="badge badgeReady">☁️ Cloudflare Ready (0$/мес)</span>
          </div>
        </div>

        <div className="statsGrid">
          <div className="statCard">
            <div className="statLabel">Авторизованный аккаунт</div>
            <div className="statVal" style={{ fontSize: "0.95rem", wordBreak: "break-all" }}>{user.email}</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Тип сессии</div>
            <div className="statVal" style={{ color: "#10b981" }}>JWT (30 дней)</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Среда хостинга</div>
            <div className="statVal">Cloudflare / Vercel Edge</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Стоимость содержания</div>
            <div className="statVal" style={{ color: "#60a5fa" }}>0 ₽ / $0 навсегда</div>
          </div>
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.35rem" }}>Модули управления</h2>
          <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>Фундамент готов для подключения следующих функций:</p>
        </div>

        <div className="modulesGrid">
          <div className="moduleCard">
            <div>
              <div className="moduleHeader">
                <div className="moduleIcon">📁</div>
                <h3>Медиа и Файлы</h3>
              </div>
              <p>Загрузка и замена фоновых видео (webm / mp4), ассетов и иконок без пересборки сайта (через бесплатный Cloudflare R2).</p>
            </div>
            <div>
              <span className="badge badgeReady">Готово к подключению</span>
            </div>
          </div>

          <div className="moduleCard">
            <div>
              <div className="moduleHeader">
                <div className="moduleIcon">🌐</div>
                <h3>API и Вебхуки</h3>
              </div>
              <p>Отправка запросов по внешним API, интеграции с Telegram-ботами, вебхуки и аналитика.</p>
            </div>
            <div>
              <span className="badge badgeReady">Готово к подключению</span>
            </div>
          </div>

          <div className="moduleCard">
            <div>
              <div className="moduleHeader">
                <div className="moduleIcon">⚙️</div>
                <h3>Ссылки и Соцсети</h3>
              </div>
              <p>Быстрое редактирование ссылок на Telegram, TikTok, YouTube, Instagram и Email прямо из браузера.</p>
            </div>
            <div>
              <span className="badge badgeReady">Готово к подключению</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
