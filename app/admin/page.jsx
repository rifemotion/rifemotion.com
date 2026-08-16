"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import "./admin.css";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("broadcast");

  // Broadcast Center Sub-cards: 'email', 'lapath', 'kliner', 'telegram'
  const [broadcastTarget, setBroadcastTarget] = useState("lapath");

  // Form states for Dispatching Extension Notifications
  const [dispatchForm, setDispatchForm] = useState({
    title: "",
    category: "announcements", // 'system', 'announcements', 'personal'
    targetType: "all", // 'all' or 'user'
    userId: "",
    inReplyTo: "",
    message: "",
  });

  const [expandedCardId, setExpandedCardId] = useState(1);
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

  // Initial Mock History Database for LaPath & KLiner
  const [lapathHistory, setLapathHistory] = useState([
    {
      id: 1,
      title: "Summer Motion Giveaway!",
      category: "Announcements",
      date: "16.08.26 15:45",
      target: "All Users",
      inReplyTo: null,
      message: "We are giving away 10 lifetime licenses for our upcoming premium suite. Join the community Discord to participate before August 25.",
    },
    {
      id: 2,
      title: "Custom Presets Feature Coming Soon",
      category: "System Notice",
      date: "14.08.26 11:20",
      target: "All Users",
      inReplyTo: null,
      message: "Our next update will allow saving, exporting, and sharing custom motion curve presets directly in After Effects timeline.",
    },
    {
      id: 3,
      title: "Your Feature Request Was Approved!",
      category: "Personal Reply",
      date: "12.08.26 18:05",
      target: "User #USR-84920",
      inReplyTo: "Ticket #402 (Bezier Tangent Snapping)",
      message: "Hey Alex! Thanks for reporting the tangent snapping issue on macOS. We verified the bug and released a hotfix in version 2.4.1.",
    },
  ]);

  const [klinerHistory, setKlinerHistory] = useState([
    {
      id: 101,
      title: "KLiner v2.1 Major Performance Upgrade",
      category: "Announcements",
      date: "15.08.26 14:10",
      target: "All Users",
      inReplyTo: null,
      message: "Rendering keyframe velocity graphs is now 4x faster on complex multi-layer compositions. Update via the extension panel.",
    },
    {
      id: 102,
      title: "License Sync Confirmation",
      category: "System Notice",
      date: "11.08.26 09:30",
      target: "User #USR-31904",
      inReplyTo: null,
      message: "Your Studio license has been synchronized and extended for 12 months. All premium modules are now unlocked.",
    },
  ]);

  // Site Management Form states
  const [socials, setSocials] = useState({
    instagram: "https://instagram.com",
    tiktok: "https://tiktok.com",
    twitter: "https://x.com",
    youtube: "https://youtube.com",
    telegram: "https://t.me",
    email: "rifemotion.info@gmail.com",
  });

  const [metaInfo, setMetaInfo] = useState({
    title: "rifemotion — Motion Graphics Studio",
    description: "rifemotion is a creative motion graphics and visual production studio.",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  // Handle category changes to enforce audience rules
  const handleCategoryChange = (newCategory) => {
    let newTargetType = dispatchForm.targetType;
    if (newCategory === "announcements") {
      newTargetType = "all"; // Announcements are strictly for all
    } else if (newCategory === "personal") {
      newTargetType = "user"; // Personal replies are strictly for single user
    }
    setDispatchForm({
      ...dispatchForm,
      category: newCategory,
      targetType: newTargetType,
    });
  };

  // Handle Dispatch submission
  const handleSendNotification = (e) => {
    e.preventDefault();
    if (!dispatchForm.title.trim() || !dispatchForm.message.trim()) {
      alert("Please fill in both the Notification Title and Message.");
      return;
    }
    if (dispatchForm.targetType === "user" && !dispatchForm.userId.trim()) {
      alert("Please provide a User ID for personal notification.");
      return;
    }

    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, "0")}.${(now.getMonth() + 1).toString().padStart(2, "0")}.${now.getFullYear().toString().slice(2)} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    const categoryMap = {
      system: "System Notice",
      announcements: "Announcements",
      personal: "Personal Reply",
    };

    const newEntry = {
      id: Date.now(),
      title: dispatchForm.title.trim(),
      category: categoryMap[dispatchForm.category],
      date: dateStr,
      target: dispatchForm.targetType === "all" ? "All Users" : `User #${dispatchForm.userId.trim()}`,
      inReplyTo: dispatchForm.category === "personal" && dispatchForm.inReplyTo.trim() ? dispatchForm.inReplyTo.trim() : null,
      message: dispatchForm.message.trim(),
    };

    if (broadcastTarget === "lapath") {
      setLapathHistory([newEntry, ...lapathHistory]);
    } else if (broadcastTarget === "kliner") {
      setKlinerHistory([newEntry, ...klinerHistory]);
    }

    setExpandedCardId(newEntry.id);
    setDispatchSuccess(true);
    setTimeout(() => setDispatchSuccess(false), 4000);

    // Reset fields
    setDispatchForm({
      title: "",
      category: dispatchForm.category,
      targetType: dispatchForm.targetType,
      userId: "",
      inReplyTo: "",
      message: "",
    });
  };

  if (status === "loading") {
    return (
      <div className="adminContainer" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading portal...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const user = session.user;
  const currentHistory = broadcastTarget === "lapath" ? lapathHistory : klinerHistory;

  return (
    <div className="adminContainer">
      {/* Top Header */}
      <header className="adminHeader">
        <div className="headerInner">
          <div className="brandGroup">
            <Link href="/admin" className="brandLogo">
              <span>rifemotion</span>
              <span className="brandPill">Admin</span>
            </Link>
          </div>

          <div className="headerActions">
            <Link href="/" target="_blank" className="liveBtn">
              Live Website ↗
            </Link>
            <div className="userMenu">
              {user.image && (
                <img src={user.image} alt={user.name || "Admin"} className="userAvatar" />
              )}
              <span className="userEmail">{user.email}</span>
              <button
                type="button"
                className="signOutBtn"
                onClick={() => signOut({ callbackUrl: "/admin/login" })}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Minimal Sub-Navigation */}
      <nav className="subNavBar">
        <div className="subNavInner">
          <button
            type="button"
            className={`navTab ${activeTab === "dashboard" ? "navTabActive" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            1. Dashboard
          </button>
          <button
            type="button"
            className={`navTab ${activeTab === "site" ? "navTabActive" : ""}`}
            onClick={() => setActiveTab("site")}
          >
            2. Site Management
          </button>
          <button
            type="button"
            className={`navTab ${activeTab === "broadcast" ? "navTabActive" : ""}`}
            onClick={() => setActiveTab("broadcast")}
          >
            3. Broadcast Center
          </button>
          <button
            type="button"
            className={`navTab ${activeTab === "subscriptions" ? "navTabActive" : ""}`}
            onClick={() => setActiveTab("subscriptions")}
          >
            4. Subscription Management
          </button>
        </div>
      </nav>

      {/* Main Workspace */}
      <main className="mainWorkspace">

        {/* ========================================================================= */}
        {/* BLOCK 3: BROADCAST CENTER */}
        {/* ========================================================================= */}
        {activeTab === "broadcast" && (
          <div>
            <div style={{ marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                📢 Broadcast & Notification Center
              </h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Select a channel below to dispatch announcements, system notices, and replies directly to users:
              </p>
            </div>

            {/* 4 Cards Selector */}
            <div className="subCardsGrid">
              {/* Card 1: Email Broadcast */}
              <div
                className={`subCardItem ${broadcastTarget === "email" ? "subCardItemActive" : ""}`}
                onClick={() => setBroadcastTarget("email")}
              >
                <div>
                  <div className="subCardHeader">
                    <span className="subCardIcon">✉️</span>
                    <span className="subCardTitle">1. Email Broadcast</span>
                  </div>
                  <p className="subCardDesc">Newsletter campaigns & customer email blasts.</p>
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  <span className="statusPill draft">Stub / Standby</span>
                </div>
              </div>

              {/* Card 2: LaPath Extension */}
              <div
                className={`subCardItem ${broadcastTarget === "lapath" ? "subCardItemActive" : ""}`}
                onClick={() => setBroadcastTarget("lapath")}
              >
                <div>
                  <div className="subCardHeader">
                    <span className="subCardIcon">🔔</span>
                    <span className="subCardTitle">2. LaPath Extension</span>
                  </div>
                  <p className="subCardDesc">In-app Notification Center for LaPath AE extension.</p>
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  <span className="statusPill active">Live Hub (Active)</span>
                </div>
              </div>

              {/* Card 3: KLiner Extension */}
              <div
                className={`subCardItem ${broadcastTarget === "kliner" ? "subCardItemActive" : ""}`}
                onClick={() => setBroadcastTarget("kliner")}
              >
                <div>
                  <div className="subCardHeader">
                    <span className="subCardIcon">⚡</span>
                    <span className="subCardTitle">3. KLiner Extension</span>
                  </div>
                  <p className="subCardDesc">In-app Notification Center for KLiner AE extension.</p>
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  <span className="statusPill active">Live Hub (Active)</span>
                </div>
              </div>

              {/* Card 4: Webhook & Telegram */}
              <div
                className={`subCardItem ${broadcastTarget === "telegram" ? "subCardItemActive" : ""}`}
                onClick={() => setBroadcastTarget("telegram")}
              >
                <div>
                  <div className="subCardHeader">
                    <span className="subCardIcon">🤖</span>
                    <span className="subCardTitle">4. Telegram & Webhooks</span>
                  </div>
                  <p className="subCardDesc">Automated studio feed & push dispatch.</p>
                </div>
                <div style={{ marginTop: "0.5rem" }}>
                  <span className="statusPill draft">Standby</span>
                </div>
              </div>
            </div>

            {/* CARD 1: EMAIL STUB */}
            {broadcastTarget === "email" && (
              <div className="panelCard">
                <div className="panelHeader">
                  <div>
                    <h2 className="panelTitle">✉️ Email Newsletter Dispatcher</h2>
                    <p className="panelDescription">Audience email list management & studio announcements</p>
                  </div>
                  <span className="statusPill draft">Module In Development</span>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                  This section will handle mass HTML email delivery and subscriber list segmentation. For live extension notifications, switch to <strong>LaPath</strong> or <strong>KLiner</strong> above.
                </p>
              </div>
            )}

            {/* CARD 4: TELEGRAM STUB */}
            {broadcastTarget === "telegram" && (
              <div className="panelCard">
                <div className="panelHeader">
                  <div>
                    <h2 className="panelTitle">🤖 Telegram & Webhook Dispatcher</h2>
                    <p className="panelDescription">Direct broadcast to Telegram community channels and webhooks</p>
                  </div>
                  <span className="statusPill draft">Module In Development</span>
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                  Connect your studio Telegram Bot token and channel ID to auto-post showreel releases and license updates.
                </p>
              </div>
            )}

            {/* CARDS 2 & 3: LAPATH & KLINER (2-COLUMN DISPATCH & HISTORY) */}
            {(broadcastTarget === "lapath" || broadcastTarget === "kliner") && (
              <div>
                {dispatchSuccess && (
                  <div style={{
                    background: "var(--success-soft)",
                    border: "1px solid var(--success)",
                    color: "#6ee7b7",
                    borderRadius: "8px",
                    padding: "0.75rem 1rem",
                    fontSize: "0.85rem",
                    marginBottom: "1.25rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}>
                    <span>✅</span>
                    <span>Notification successfully dispatched to <strong>{broadcastTarget === "lapath" ? "LaPath" : "KLiner"}</strong> extension interface and saved to database!</span>
                  </div>
                )}

                <div className="broadcastTwoCol">
                  {/* LEFT COLUMN: DISPATCH FORM */}
                  <div className="panelCard" style={{ marginBottom: 0 }}>
                    <div className="panelHeader">
                      <div>
                        <h2 className="panelTitle">
                          📤 Dispatch to {broadcastTarget === "lapath" ? "LaPath" : "KLiner"}
                        </h2>
                        <p className="panelDescription">Compose broadcast for the in-extension Notification Center</p>
                      </div>
                      <span className="statusPill active">{broadcastTarget.toUpperCase()}</span>
                    </div>

                    <form onSubmit={handleSendNotification}>
                      {/* Notification Title */}
                      <div className="formField">
                        <label className="formLabel">Notification Title</label>
                        <input
                          type="text"
                          className="textInput"
                          placeholder="e.g. Summer Motion Giveaway!"
                          value={dispatchForm.title}
                          onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })}
                          required
                        />
                      </div>

                      {/* Category Selection (3 Categories) */}
                      <div className="formField">
                        <label className="formLabel">Notification Category</label>
                        <select
                          className="selectInput"
                          value={dispatchForm.category}
                          onChange={(e) => handleCategoryChange(e.target.value)}
                        >
                          <option value="announcements">📢 Announcements (Global to All Users)</option>
                          <option value="system">⚠️ System Notice (All Users or Specific User)</option>
                          <option value="personal">💬 Personal Reply (Targeted to Specific User ID)</option>
                        </select>
                      </div>

                      {/* Audience / Target Selection */}
                      {dispatchForm.category === "system" && (
                        <div className="formField">
                          <label className="formLabel">Target Audience</label>
                          <select
                            className="selectInput"
                            value={dispatchForm.targetType}
                            onChange={(e) => setDispatchForm({ ...dispatchForm, targetType: e.target.value })}
                          >
                            <option value="all">🌐 Broadcast to All Extension Users</option>
                            <option value="user">👤 Single Specific User (By User ID)</option>
                          </select>
                        </div>
                      )}

                      {/* User ID Field (when target is a specific user) */}
                      {(dispatchForm.targetType === "user" || dispatchForm.category === "personal") && (
                        <div className="formField">
                          <label className="formLabel">User ID / License Key</label>
                          <input
                            type="text"
                            className="textInput"
                            placeholder="e.g. USR-84920 or License Key"
                            value={dispatchForm.userId}
                            onChange={(e) => setDispatchForm({ ...dispatchForm, userId: e.target.value })}
                            required
                          />
                        </div>
                      )}

                      {/* In Reply To (Only for Personal Reply) */}
                      {dispatchForm.category === "personal" && (
                        <div className="formField">
                          <label className="formLabel">In Response To (Ticket / Inquiry Reference)</label>
                          <input
                            type="text"
                            className="textInput"
                            placeholder="e.g. Feature Request #402 (Bezier Tangents)"
                            value={dispatchForm.inReplyTo}
                            onChange={(e) => setDispatchForm({ ...dispatchForm, inReplyTo: e.target.value })}
                          />
                        </div>
                      )}

                      {/* Notification Message Body */}
                      <div className="formField">
                        <label className="formLabel">Notification Message</label>
                        <textarea
                          className="textArea"
                          style={{ minHeight: "110px" }}
                          placeholder="Type the message that will appear inside the extension notification center..."
                          value={dispatchForm.message}
                          onChange={(e) => setDispatchForm({ ...dispatchForm, message: e.target.value })}
                          required
                        />
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.25rem" }}>
                        <button type="submit" className="btnPrimary" style={{ padding: "0.6rem 1.25rem" }}>
                          🚀 Dispatch to Extension
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* RIGHT COLUMN: HISTORY & DATABASE LOG */}
                  <div className="panelCard" style={{ marginBottom: 0 }}>
                    <div className="panelHeader">
                      <div>
                        <h2 className="panelTitle">
                          📋 {broadcastTarget === "lapath" ? "LaPath" : "KLiner"} Broadcast History
                        </h2>
                        <p className="panelDescription">
                          {currentHistory.length} sent notifications in database (click card to expand details)
                        </p>
                      </div>
                    </div>

                    <div className="historyList">
                      {currentHistory.map((item) => {
                        const isExpanded = expandedCardId === item.id;
                        return (
                          <div
                            key={item.id}
                            className={`historyCard ${isExpanded ? "historyCardActive" : ""}`}
                            onClick={() => setExpandedCardId(isExpanded ? null : item.id)}
                          >
                            <div className="historyCardTop">
                              <span className="historyCardTitle">{item.title}</span>
                              <span className={`statusPill ${
                                item.category === "Announcements"
                                  ? "announcement"
                                  : item.category === "System Notice"
                                  ? "system"
                                  : "personal"
                              }`}>
                                {item.category}
                              </span>
                            </div>

                            <div className="historyCardMeta">
                              <span>📅 {item.date}</span>
                              <span>•</span>
                              <span>🎯 {item.target}</span>
                            </div>

                            {!isExpanded && (
                              <p className="historyCardSnippet">{item.message}</p>
                            )}

                            {isExpanded && (
                              <div className="historyCardExpanded">
                                <p className="historyFullMessage">{item.message}</p>

                                <div className="historyMetaGrid">
                                  <div>
                                    <div className="historyMetaLabel">Target</div>
                                    <div className="historyMetaVal">{item.target}</div>
                                  </div>
                                  <div>
                                    <div className="historyMetaLabel">Status</div>
                                    <div className="historyMetaVal" style={{ color: "var(--success)" }}>Delivered</div>
                                  </div>
                                  {item.inReplyTo && (
                                    <div style={{ gridColumn: "1 / -1" }}>
                                      <div className="historyMetaLabel">In Response To</div>
                                      <div className="historyMetaVal" style={{ color: "#93c5fd" }}>{item.inReplyTo}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* BLOCK 1: DASHBOARD */}
        {/* ========================================================================= */}
        {activeTab === "dashboard" && (
          <div>
            <div className="metricsRow">
              <div className="metricTile">
                <div className="metricLabel">Live Visitors</div>
                <div className="metricValue">
                  <span>24</span>
                  <span className="metricSubtext">● Active now</span>
                </div>
              </div>
              <div className="metricTile">
                <div className="metricLabel">Total Views (30d)</div>
                <div className="metricValue">
                  <span>14,820</span>
                  <span className="metricSubtext">+18.4%</span>
                </div>
              </div>
              <div className="metricTile">
                <div className="metricLabel">Edge CDN Latency</div>
                <div className="metricValue">
                  <span>18ms</span>
                  <span className="metricSubtext">Optimal</span>
                </div>
              </div>
              <div className="metricTile">
                <div className="metricLabel">System Health</div>
                <div className="metricValue">
                  <span style={{ color: "var(--success)" }}>100%</span>
                  <span className="metricSubtext">All services nominal</span>
                </div>
              </div>
            </div>

            <div className="panelCard">
              <div className="panelHeader">
                <div>
                  <h2 className="panelTitle">Environment & System Telemetry</h2>
                  <p className="panelDescription">Current runtime environment and authentication parameters</p>
                </div>
                <span className="statusPill active">Local Dev Active</span>
              </div>

              <table className="minimalTable">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Runtime</th>
                    <th>Status</th>
                    <th>Host URL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Next.js Core Engine</td>
                    <td>Node.js v25 (App Router)</td>
                    <td><span className="statusPill active">Running</span></td>
                    <td><code>http://localhost:3000</code></td>
                  </tr>
                  <tr>
                    <td>Google OAuth 2.0</td>
                    <td>NextAuth.js (JWT)</td>
                    <td><span className="statusPill active">Verified</span></td>
                    <td><code>{user.email}</code></td>
                  </tr>
                  <tr>
                    <td>Production Edge CDN</td>
                    <td>Vercel Global Edge</td>
                    <td><span className="statusPill active">Linked</span></td>
                    <td><code>https://rifemotion.com</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BLOCK 2: SITE MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === "site" && (
          <div>
            <div className="panelCard">
              <div className="panelHeader">
                <div>
                  <h2 className="panelTitle">Background Video Assets</h2>
                  <p className="panelDescription">Primary showreel files displayed on the landing page</p>
                </div>
                <button type="button" className="btnSecondary">Upload New Video</button>
              </div>

              <div className="formRow">
                <div className="formField">
                  <label className="formLabel">Primary MP4 Video</label>
                  <input type="text" className="textInput" readOnly value="/video.mp4 (7.0 MB)" />
                </div>
                <div className="formField">
                  <label className="formLabel">Fallback WEBM Video</label>
                  <input type="text" className="textInput" readOnly value="/video.webm (6.6 MB)" />
                </div>
                <div className="formField">
                  <label className="formLabel">Mask Iris Animation</label>
                  <input type="text" className="textInput" readOnly value="Soft Feathered Radial (4.5s)" />
                </div>
              </div>
            </div>

            <div className="panelCard">
              <div className="panelHeader">
                <div>
                  <h2 className="panelTitle">Social Media & Contact Links</h2>
                  <p className="panelDescription">Direct URLs connected to the icons on the landing page</p>
                </div>
                <button type="button" className="btnPrimary" onClick={() => alert("Settings saved successfully!")}>
                  Save Links
                </button>
              </div>

              <div className="formRow">
                <div className="formField">
                  <label className="formLabel">Instagram URL</label>
                  <input
                    type="text"
                    className="textInput"
                    value={socials.instagram}
                    onChange={(e) => setSocials({ ...socials, instagram: e.target.value })}
                  />
                </div>
                <div className="formField">
                  <label className="formLabel">TikTok URL</label>
                  <input
                    type="text"
                    className="textInput"
                    value={socials.tiktok}
                    onChange={(e) => setSocials({ ...socials, tiktok: e.target.value })}
                  />
                </div>
                <div className="formField">
                  <label className="formLabel">X (Twitter) URL</label>
                  <input
                    type="text"
                    className="textInput"
                    value={socials.twitter}
                    onChange={(e) => setSocials({ ...socials, twitter: e.target.value })}
                  />
                </div>
              </div>

              <div className="formRow">
                <div className="formField">
                  <label className="formLabel">YouTube URL</label>
                  <input
                    type="text"
                    className="textInput"
                    value={socials.youtube}
                    onChange={(e) => setSocials({ ...socials, youtube: e.target.value })}
                  />
                </div>
                <div className="formField">
                  <label className="formLabel">Telegram URL</label>
                  <input
                    type="text"
                    className="textInput"
                    value={socials.telegram}
                    onChange={(e) => setSocials({ ...socials, telegram: e.target.value })}
                  />
                </div>
                <div className="formField">
                  <label className="formLabel">Contact Email</label>
                  <input
                    type="email"
                    className="textInput"
                    value={socials.email}
                    onChange={(e) => setSocials({ ...socials, email: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="panelCard">
              <div className="panelHeader">
                <div>
                  <h2 className="panelTitle">SEO & Metadata Configuration</h2>
                  <p className="panelDescription">Search engine indexing and OpenGraph social previews</p>
                </div>
                <button type="button" className="btnPrimary" onClick={() => alert("SEO metadata updated!")}>
                  Save Meta
                </button>
              </div>

              <div className="formField">
                <label className="formLabel">Page Title</label>
                <input
                  type="text"
                  className="textInput"
                  value={metaInfo.title}
                  onChange={(e) => setMetaInfo({ ...metaInfo, title: e.target.value })}
                />
              </div>

              <div className="formField">
                <label className="formLabel">Meta Description</label>
                <textarea
                  className="textArea"
                  value={metaInfo.description}
                  onChange={(e) => setMetaInfo({ ...metaInfo, description: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BLOCK 4: SUBSCRIPTION MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === "subscriptions" && (
          <div>
            <div className="metricsRow">
              <div className="metricTile">
                <div className="metricLabel">Monthly Recurring Revenue</div>
                <div className="metricValue">
                  <span>$8,450</span>
                  <span className="metricSubtext">+12.6% MRR</span>
                </div>
              </div>
              <div className="metricTile">
                <div className="metricLabel">Active Paid Members</div>
                <div className="metricValue">
                  <span>142</span>
                  <span className="metricSubtext">98% Retention</span>
                </div>
              </div>
              <div className="metricTile">
                <div className="metricLabel">Average Revenue / User</div>
                <div className="metricValue">
                  <span>$59.50</span>
                  <span className="metricSubtext">Per month</span>
                </div>
              </div>
            </div>

            <div className="panelCard">
              <div className="panelHeader">
                <div>
                  <h2 className="panelTitle">Active Membership Tiers</h2>
                  <p className="panelDescription">Configure subscription tiers, creative retainers, and access levels</p>
                </div>
                <button type="button" className="btnSecondary">+ Add New Tier</button>
              </div>

              <table className="minimalTable">
                <thead>
                  <tr>
                    <th>Tier Name</th>
                    <th>Billing Cycle</th>
                    <th>Price</th>
                    <th>Active Members</th>
                    <th>Perks / Deliverables</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Creator Pass</strong></td>
                    <td>Monthly</td>
                    <td>$29 / mo</td>
                    <td>84 members</td>
                    <td>Asset library access, monthly templates</td>
                    <td><span className="statusPill active">Active</span></td>
                  </tr>
                  <tr>
                    <td><strong>Studio Retainer</strong></td>
                    <td>Monthly</td>
                    <td>$149 / mo</td>
                    <td>42 members</td>
                    <td>Priority motion rendering, source project files</td>
                    <td><span className="statusPill active">Active</span></td>
                  </tr>
                  <tr>
                    <td><strong>Enterprise Dedicated</strong></td>
                    <td>Annual</td>
                    <td>$1,200 / yr</td>
                    <td>16 members</td>
                    <td>Full bespoke animation production & dedicated channel</td>
                    <td><span className="statusPill active">Active</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="panelCard">
              <div className="panelHeader">
                <div>
                  <h2 className="panelTitle">Recent Subscription Activity</h2>
                  <p className="panelDescription">Real-time payment webhooks and member renewals</p>
                </div>
              </div>

              <table className="minimalTable">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Tier</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Payment Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>alex.creative@studio.io</td>
                    <td>Studio Retainer</td>
                    <td>$149.00</td>
                    <td>Just now</td>
                    <td><span className="statusPill active">Paid</span></td>
                  </tr>
                  <tr>
                    <td>marcus.vfx@agency.com</td>
                    <td>Creator Pass</td>
                    <td>$29.00</td>
                    <td>2 hours ago</td>
                    <td><span className="statusPill active">Paid</span></td>
                  </tr>
                  <tr>
                    <td>elena.motion@design.de</td>
                    <td>Creator Pass</td>
                    <td>$29.00</td>
                    <td>5 hours ago</td>
                    <td><span className="statusPill active">Paid</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
