"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import "./admin.css";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="adminContainer" style={{ justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "#9ca3af" }}>Checking authentication...</p>
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
            🌐 Live Website
          </Link>
          <div className="userProfile">
            {user.image && (
              <img src={user.image} alt={user.name || "Admin"} className="userAvatar" />
            )}
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{user.name || "Administrator"}</div>
              <div className="userEmail">{user.email}</div>
            </div>
          </div>
          <button
            type="button"
            className="btnLogout"
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="adminMain">
        {/* Navigation Tabs */}
        <div className="tabsNav">
          <button
            type="button"
            className={`tabBtn ${activeTab === "overview" ? "tabBtnActive" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            📊 All Modules
          </button>
          <button
            type="button"
            className={`tabBtn ${activeTab === "dashboard" ? "tabBtnActive" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            ⚡ 1. Dashboard
          </button>
          <button
            type="button"
            className={`tabBtn ${activeTab === "site" ? "tabBtnActive" : ""}`}
            onClick={() => setActiveTab("site")}
          >
            ⚙️ 2. Site Management
          </button>
          <button
            type="button"
            className={`tabBtn ${activeTab === "broadcast" ? "tabBtnActive" : ""}`}
            onClick={() => setActiveTab("broadcast")}
          >
            📢 3. Broadcast Center
          </button>
          <button
            type="button"
            className={`tabBtn ${activeTab === "subscriptions" ? "tabBtnActive" : ""}`}
            onClick={() => setActiveTab("subscriptions")}
          >
            💳 4. Subscription Management
          </button>
        </div>

        {/* Hero Section */}
        <div className="heroCard">
          <h1 className="heroTitle">👋 Welcome back, {user.name || "Admin"}!</h1>
          <p className="heroDesc">
            rifemotion.com centralized management portal. All core services, authentication, and content delivery networks are running normally.
          </p>
          <div className="badgeRow">
            <span className="badge badgeActive">🟢 Google 2FA: Active</span>
            <span className="badge badgeActive">⚡ Next.js Edge Network</span>
            <span className="badge badgeReady">☁️ Vercel Global CDN (0$/mo)</span>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="statsGrid">
          <div className="statCard">
            <div className="statLabel">Authenticated Admin</div>
            <div className="statVal" style={{ fontSize: "0.95rem", wordBreak: "break-all" }}>{user.email}</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Active Session</div>
            <div className="statVal" style={{ color: "#10b981" }}>JWT (30-Day Persisted)</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Deployment Status</div>
            <div className="statVal" style={{ color: "#60a5fa" }}>Production Ready</div>
          </div>
          <div className="statCard">
            <div className="statLabel">Infrastructure Cost</div>
            <div className="statVal" style={{ color: "#10b981" }}>$0.00 / Free Forever</div>
          </div>
        </div>

        {/* 4 CORE MODULES */}

        {/* Overview: 4-Cards Grid */}
        {activeTab === "overview" && (
          <div>
            <div style={{ marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.35rem" }}>Management Center</h2>
              <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>Select a module below to view controls and configuration:</p>
            </div>

            <div className="modulesGrid">
              {/* Block 1: Dashboard */}
              <div className="moduleCard" onClick={() => setActiveTab("dashboard")}>
                <div>
                  <div className="moduleHeader">
                    <div className="moduleIcon">📊</div>
                    <h3>1. Dashboard</h3>
                  </div>
                  <p>Real-time traffic metrics, edge server health, uptime telemetry, visitor geographic breakdown, and system audit logs.</p>
                </div>
                <div>
                  <span className="badge badgeActive">Live Telemetry</span>
                </div>
              </div>

              {/* Block 2: Site Management */}
              <div className="moduleCard" onClick={() => setActiveTab("site")}>
                <div>
                  <div className="moduleHeader">
                    <div className="moduleIcon">⚙️</div>
                    <h3>2. Site Management</h3>
                  </div>
                  <p>Background video uploads (mp4/webm), social media links (Instagram, TikTok, X, YouTube, Telegram), SEO meta tags, and brand assets.</p>
                </div>
                <div>
                  <span className="badge badgeReady">Content Engine</span>
                </div>
              </div>

              {/* Block 3: Broadcast Center */}
              <div className="moduleCard" onClick={() => setActiveTab("broadcast")}>
                <div>
                  <div className="moduleHeader">
                    <div className="moduleIcon">📢</div>
                    <h3>3. Broadcast Center</h3>
                  </div>
                  <p>Email newsletters, subscriber announcements, instant push dispatch, template designer, and outreach campaign tracking.</p>
                </div>
                <div>
                  <span className="badge badgeReady">Campaign Ready</span>
                </div>
              </div>

              {/* Block 4: Subscription Management */}
              <div className="moduleCard" onClick={() => setActiveTab("subscriptions")}>
                <div>
                  <div className="moduleHeader">
                    <div className="moduleIcon">💳</div>
                    <h3>4. Subscription Management</h3>
                  </div>
                  <p>Subscriber membership tiers, active customer accounts, recurring billing lifecycles, payment webhooks, and MRR metrics.</p>
                </div>
                <div>
                  <span className="badge badgeReady">Billing Ready</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Dashboard Details */}
        {(activeTab === "dashboard" || activeTab === "overview") && (
          <div className="sectionCard" style={{ marginTop: "2rem" }}>
            <div className="sectionHeader">
              <h2>📊 Block 1: Dashboard & Analytics</h2>
              <span className="badge badgeActive">Active System</span>
            </div>
            <div className="featureList">
              <div className="featureItem">
                <div className="featureItemTitle">
                  <span>Server Telemetry</span>
                  <span style={{ color: "#10b981", fontSize: "0.8rem" }}>100% Uptime</span>
                </div>
                <p className="featureItemDesc">Global edge CDN response latency under 35ms. Zero downtime deployment pipeline active.</p>
              </div>
              <div className="featureItem">
                <div className="featureItemTitle">
                  <span>Visitor Traffic</span>
                  <span style={{ color: "#60a5fa", fontSize: "0.8rem" }}>Analytics Ready</span>
                </div>
                <p className="featureItemDesc">Real-time visitor counts, landing page impressions, and social media click-through rates.</p>
              </div>
              <div className="featureItem">
                <div className="featureItemTitle">
                  <span>Security & Access Logs</span>
                  <span style={{ color: "#10b981", fontSize: "0.8rem" }}>Protected</span>
                </div>
                <p className="featureItemDesc">Google OAuth 2.0 handshake verified. Admin session restricted to authorized whitelist email.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Site Management Details */}
        {(activeTab === "site" || activeTab === "overview") && (
          <div className="sectionCard">
            <div className="sectionHeader">
              <h2>⚙️ Block 2: Site Management</h2>
              <span className="badge badgeReady">Configured</span>
            </div>
            <div className="featureList">
              <div className="featureItem">
                <div className="featureItemTitle">
                  <span>Hero Video Assets</span>
                  <span style={{ color: "#93c5fd", fontSize: "0.8rem" }}>video.mp4 / webm</span>
                </div>
                <p className="featureItemDesc">Manage and swap full-screen background showreels, posters, and mask animation parameters.</p>
              </div>
              <div className="featureItem">
                <div className="featureItemTitle">
                  <span>Social Media & Bio Links</span>
                  <span style={{ color: "#93c5fd", fontSize: "0.8rem" }}>6 Channels</span>
                </div>
                <p className="featureItemDesc">Update URLs for Instagram, TikTok, X (Twitter), YouTube, Telegram channel, and contact email.</p>
              </div>
              <div className="featureItem">
                <div className="featureItemTitle">
                  <span>SEO & Brand Identity</span>
                  <span style={{ color: "#93c5fd", fontSize: "0.8rem" }}>OpenGraph Meta</span>
                </div>
                <p className="featureItemDesc">Edit meta titles, descriptions, favicon icon sets, and social preview banners dynamically.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Broadcast Center Details */}
        {(activeTab === "broadcast" || activeTab === "overview") && (
          <div className="sectionCard">
            <div className="sectionHeader">
              <h2>📢 Block 3: Broadcast Center</h2>
              <span className="badge badgeReady">Configured</span>
            </div>
            <div className="featureList">
              <div className="featureItem">
                <div className="featureItemTitle">
                  <span>Newsletter Dispatch</span>
                  <span style={{ color: "#93c5fd", fontSize: "0.8rem" }}>Email Blasts</span>
                </div>
                <p className="featureItemDesc">Compose and dispatch studio announcements, product releases, and showcase drops to email list.</p>
              </div>
              <div className="featureItem">
                <div className="featureItemTitle">
                  <span>Subscriber Audience</span>
                  <span style={{ color: "#93c5fd", fontSize: "0.8rem" }}>List Segmentation</span>
                </div>
                <p className="featureItemDesc">Manage subscriber database, export contact lists (CSV/JSON), and monitor delivery rates.</p>
              </div>
              <div className="featureItem">
                <div className="featureItemTitle">
                  <span>Push & Telegram Webhooks</span>
                  <span style={{ color: "#93c5fd", fontSize: "0.8rem" }}>Instant Bots</span>
                </div>
                <p className="featureItemDesc">Automated webhooks to broadcast portfolio updates directly to your Telegram channel.</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Subscription Management Details */}
        {(activeTab === "subscriptions" || activeTab === "overview") && (
          <div className="sectionCard">
            <div className="sectionHeader">
              <h2>💳 Block 4: Subscription Management</h2>
              <span className="badge badgeReady">Configured</span>
            </div>
            <div className="featureList">
              <div className="featureItem">
                <div className="featureItemTitle">
                  <span>Membership Tiers</span>
                  <span style={{ color: "#93c5fd", fontSize: "0.8rem" }}>Plans & Pricing</span>
                </div>
                <p className="featureItemDesc">Configure recurring creative subscription packages, tier perks, and access controls.</p>
              </div>
              <div className="featureItem">
                <div className="featureItemTitle">
                  <span>Active Subscribers</span>
                  <span style={{ color: "#93c5fd", fontSize: "0.8rem" }}>Customer Accounts</span>
                </div>
                <p className="featureItemDesc">Inspect member renewal dates, payment status, active licenses, and member lifecycle.</p>
              </div>
              <div className="featureItem">
                <div className="featureItemTitle">
                  <span>Revenue & MRR Analytics</span>
                  <span style={{ color: "#10b981", fontSize: "0.8rem" }}>Stripe / Crypto</span>
                </div>
                <p className="featureItemDesc">Track monthly recurring revenue, churn rate, transaction history, and payout balances.</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
