"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import "./admin.css";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Active top navigation tab: 'dashboard', 'site', 'broadcast', 'subscriptions'
  const [activeTab, setActiveTab] = useState("broadcast");

  // Broadcast module view: null (showing initial 4 cards) or 'email' | 'lapath' | 'kliner' | 'telegram' (collapsed into single row)
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

  // History Database for LaPath & KLiner
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

  // Handle category change logic
  const handleCategoryChange = (newCategory) => {
    let newTargetType = dispatchForm.targetType;
    if (newCategory === "announcements") {
      newTargetType = "all";
    } else if (newCategory === "personal") {
      newTargetType = "user";
    }
    setDispatchForm({
      ...dispatchForm,
      category: newCategory,
      targetType: newTargetType,
    });
  };

  // Handle Dispatch submit
  const handleSendNotification = (e) => {
    e.preventDefault();
    if (!dispatchForm.title.trim() || !dispatchForm.message.trim()) {
      alert("Please enter a title and message.");
      return;
    }
    if (dispatchForm.targetType === "user" && !dispatchForm.userId.trim()) {
      alert("Please provide a User ID.");
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
    setTimeout(() => setDispatchSuccess(false), 3500);

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
      <div className="adminContainer" style={{ justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>Loading portal...</p>
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
              <span className="brandPill">Studio</span>
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

      {/* Segmented Sub Navigation */}
      <nav className="subNavBar">
        <div className="subNavInner">
          <button
            type="button"
            className={`navTab ${activeTab === "dashboard" ? "navTabActive" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`navTab ${activeTab === "site" ? "navTabActive" : ""}`}
            onClick={() => setActiveTab("site")}
          >
            Site Management
          </button>
          <button
            type="button"
            className={`navTab ${activeTab === "broadcast" ? "navTabActive" : ""}`}
            onClick={() => setActiveTab("broadcast")}
          >
            Broadcast Center
          </button>
          <button
            type="button"
            className={`navTab ${activeTab === "subscriptions" ? "navTabActive" : ""}`}
            onClick={() => setActiveTab("subscriptions")}
          >
            Subscription Management
          </button>
        </div>
      </nav>

      {/* Main Workspace */}
      <main className="mainWorkspace">

        {/* ========================================================================= */}
        {/* BLOCK: BROADCAST CENTER */}
        {/* ========================================================================= */}
        {activeTab === "broadcast" && (
          <div>
            <div style={{ marginBottom: "1.25rem" }}>
              <h1 className="pageTitle">Broadcast & Notification Center</h1>
              <p className="pageSubtitle">
                Dispatch announcements, system notices, and replies directly to in-app extension centers:
              </p>
            </div>

            {/* INITIAL 4 CARDS (Shown when broadcastTarget is null) */}
            {broadcastTarget === null ? (
              <div className="initialCardsGrid">
                <div className="gridCard" onClick={() => setBroadcastTarget("email")}>
                  <div>
                    <div className="gridCardTitle">Email Broadcast</div>
                    <p className="gridCardDesc">Audience newsletters & mass customer email campaigns.</p>
                  </div>
                  <div className="gridCardMeta">
                    <span className="tagBadge">Standby</span>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 600 }}>Select →</span>
                  </div>
                </div>

                <div className="gridCard" onClick={() => setBroadcastTarget("lapath")}>
                  <div>
                    <div className="gridCardTitle">LaPath Extension</div>
                    <p className="gridCardDesc">Direct in-app notification center for After Effects extension.</p>
                  </div>
                  <div className="gridCardMeta">
                    <span className="tagBadge" style={{ background: "var(--accent-black)", color: "#ffffff" }}>Active Hub</span>
                    <span style={{ color: "var(--text-main)", fontSize: "0.75rem", fontWeight: 600 }}>Open Hub →</span>
                  </div>
                </div>

                <div className="gridCard" onClick={() => setBroadcastTarget("kliner")}>
                  <div>
                    <div className="gridCardTitle">KLiner Extension</div>
                    <p className="gridCardDesc">Direct in-app notification center for After Effects extension.</p>
                  </div>
                  <div className="gridCardMeta">
                    <span className="tagBadge" style={{ background: "var(--accent-black)", color: "#ffffff" }}>Active Hub</span>
                    <span style={{ color: "var(--text-main)", fontSize: "0.75rem", fontWeight: 600 }}>Open Hub →</span>
                  </div>
                </div>

                <div className="gridCard" onClick={() => setBroadcastTarget("telegram")}>
                  <div>
                    <div className="gridCardTitle">Telegram & Webhooks</div>
                    <p className="gridCardDesc">Automated studio feed releases and bot channel dispatch.</p>
                  </div>
                  <div className="gridCardMeta">
                    <span className="tagBadge">Standby</span>
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 600 }}>Select →</span>
                  </div>
                </div>
              </div>
            ) : (
              /* COLLAPSED SINGLE-LINE SELECTOR ROW (When a channel is selected) */
              <div>
                <div className="collapsedSelectorBar">
                  <div className="collapsedTabsList">
                    <button
                      type="button"
                      className={`collapsedTabBtn ${broadcastTarget === "email" ? "collapsedTabBtnActive" : ""}`}
                      onClick={() => setBroadcastTarget("email")}
                    >
                      Email Broadcast
                    </button>
                    <button
                      type="button"
                      className={`collapsedTabBtn ${broadcastTarget === "lapath" ? "collapsedTabBtnActive" : ""}`}
                      onClick={() => setBroadcastTarget("lapath")}
                    >
                      LaPath Extension
                    </button>
                    <button
                      type="button"
                      className={`collapsedTabBtn ${broadcastTarget === "kliner" ? "collapsedTabBtnActive" : ""}`}
                      onClick={() => setBroadcastTarget("kliner")}
                    >
                      KLiner Extension
                    </button>
                    <button
                      type="button"
                      className={`collapsedTabBtn ${broadcastTarget === "telegram" ? "collapsedTabBtnActive" : ""}`}
                      onClick={() => setBroadcastTarget("telegram")}
                    >
                      Telegram & Webhooks
                    </button>
                  </div>

                  <button
                    type="button"
                    className="expandAllBtn"
                    onClick={() => setBroadcastTarget(null)}
                  >
                    View All Cards
                  </button>
                </div>

                {/* EMAIL STUB */}
                {broadcastTarget === "email" && (
                  <div className="formPanel">
                    <div className="panelHeading">
                      <span className="panelHeadingTitle">Email Broadcast</span>
                      <span className="tagBadge">Module In Development</span>
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                      Email newsletter dispatch engine is currently on standby. Use the extension channels above for live notification broadcasting.
                    </p>
                  </div>
                )}

                {/* TELEGRAM STUB */}
                {broadcastTarget === "telegram" && (
                  <div className="formPanel">
                    <div className="panelHeading">
                      <span className="panelHeadingTitle">Telegram & Webhooks</span>
                      <span className="tagBadge">Module In Development</span>
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.6 }}>
                      Connect studio Telegram bot tokens and webhook endpoints to stream automated updates.
                    </p>
                  </div>
                )}

                {/* 2-COLUMN DISPATCH & HISTORY (LaPath or KLiner) */}
                {(broadcastTarget === "lapath" || broadcastTarget === "kliner") && (
                  <div>
                    {dispatchSuccess && (
                      <div style={{
                        background: "var(--accent-green-soft)",
                        border: "1px solid var(--accent-green)",
                        color: "var(--accent-green)",
                        borderRadius: "var(--radius-pill)",
                        padding: "0.65rem 1.25rem",
                        fontSize: "0.825rem",
                        fontWeight: 500,
                        marginBottom: "1.25rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem"
                      }}>
                        <span>✓</span>
                        <span>Notification successfully dispatched to <strong>{broadcastTarget === "lapath" ? "LaPath" : "KLiner"}</strong> and recorded to database.</span>
                      </div>
                    )}

                    <div className="broadcastDenseLayout">
                      {/* LEFT COLUMN: DENSE DISPATCH FORM */}
                      <div className="formPanel">
                        <div className="panelHeading">
                          <span className="panelHeadingTitle">
                            Dispatch to {broadcastTarget === "lapath" ? "LaPath" : "KLiner"}
                          </span>
                          <span className="tagBadge" style={{ background: "var(--accent-black)", color: "#ffffff" }}>
                            {broadcastTarget.toUpperCase()}
                          </span>
                        </div>

                        <form onSubmit={handleSendNotification}>
                          <div className="fieldGroup">
                            <label className="fieldLabel">Notification Title</label>
                            <input
                              type="text"
                              className="compactInput"
                              placeholder="e.g. Summer Motion Giveaway!"
                              value={dispatchForm.title}
                              onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })}
                              required
                            />
                          </div>

                          <div className="fieldGroup">
                            <label className="fieldLabel">Category</label>
                            <select
                              className="compactSelect"
                              value={dispatchForm.category}
                              onChange={(e) => handleCategoryChange(e.target.value)}
                            >
                              <option value="announcements">Announcements (All Users)</option>
                              <option value="system">System Notice (All or Single User)</option>
                              <option value="personal">Personal Reply (Single User)</option>
                            </select>
                          </div>

                          {dispatchForm.category === "system" && (
                            <div className="fieldGroup">
                              <label className="fieldLabel">Audience Target</label>
                              <select
                                className="compactSelect"
                                value={dispatchForm.targetType}
                                onChange={(e) => setDispatchForm({ ...dispatchForm, targetType: e.target.value })}
                              >
                                <option value="all">Broadcast to All Users</option>
                                <option value="user">Specific User ID</option>
                              </select>
                            </div>
                          )}

                          {(dispatchForm.targetType === "user" || dispatchForm.category === "personal") && (
                            <div className="fieldGroup">
                              <label className="fieldLabel">User ID</label>
                              <input
                                type="text"
                                className="compactInput"
                                placeholder="e.g. USR-84920"
                                value={dispatchForm.userId}
                                onChange={(e) => setDispatchForm({ ...dispatchForm, userId: e.target.value })}
                                required
                              />
                            </div>
                          )}

                          {dispatchForm.category === "personal" && (
                            <div className="fieldGroup">
                              <label className="fieldLabel">In Response To</label>
                              <input
                                type="text"
                                className="compactInput"
                                placeholder="e.g. Feature Request #402"
                                value={dispatchForm.inReplyTo}
                                onChange={(e) => setDispatchForm({ ...dispatchForm, inReplyTo: e.target.value })}
                              />
                            </div>
                          )}

                          <div className="fieldGroup">
                            <label className="fieldLabel">Notification Message</label>
                            <textarea
                              className="compactTextarea"
                              placeholder="Type notification text..."
                              value={dispatchForm.message}
                              onChange={(e) => setDispatchForm({ ...dispatchForm, message: e.target.value })}
                              required
                            />
                          </div>

                          <div className="sendActionRow">
                            <button type="submit" className="submitBtn">
                              Dispatch Notification
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* RIGHT COLUMN: HISTORY & DATABASE LOG */}
                      <div className="historyPanel">
                        <div className="panelHeading">
                          <span className="panelHeadingTitle">Broadcast History</span>
                          <span style={{ color: "var(--text-secondary)", fontSize: "0.75rem", fontWeight: 500 }}>
                            {currentHistory.length} sent
                          </span>
                        </div>

                        <div className="historyList">
                          {currentHistory.map((item) => {
                            const isSelected = expandedCardId === item.id;
                            return (
                              <div
                                key={item.id}
                                className={`noticeCard ${isSelected ? "noticeCardSelected" : ""}`}
                                onClick={() => setExpandedCardId(isSelected ? null : item.id)}
                              >
                                <div className="noticeCardHeader">
                                  <span className="noticeTitle">{item.title}</span>
                                  <span className={`tagBadge ${
                                    item.category === "Announcements"
                                      ? "announcements"
                                      : item.category === "System Notice"
                                      ? "system"
                                      : "personal"
                                  }`}>
                                    {item.category}
                                  </span>
                                </div>

                                <div className="noticeMetaLine">
                                  <span>{item.date}</span>
                                  <span>•</span>
                                  <span>{item.target}</span>
                                </div>

                                {!isSelected ? (
                                  <p className="noticeSnippet">{item.message}</p>
                                ) : (
                                  <div>
                                    <p className="noticeFullBody">{item.message}</p>
                                    <div className="noticeDetailFooter">
                                      <span>Target: <strong>{item.target}</strong></span>
                                      {item.inReplyTo && (
                                        <span>In reply to: <em>{item.inReplyTo}</em></span>
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
          </div>
        )}

        {/* ========================================================================= */}
        {/* BLOCK: DASHBOARD */}
        {/* ========================================================================= */}
        {activeTab === "dashboard" && (
          <div>
            <h1 className="pageTitle">Dashboard & Studio Overview</h1>
            <p className="pageSubtitle">Live visitor telemetry and infrastructure health status:</p>

            <div className="metricsGrid">
              <div className="metricCard">
                <div className="metricCardLabel">Live Visitors</div>
                <div className="metricCardValue">
                  <span>24</span>
                  <span className="metricCardNote">● Active</span>
                </div>
              </div>
              <div className="metricCard">
                <div className="metricCardLabel">30d Views</div>
                <div className="metricCardValue">
                  <span>14,820</span>
                  <span className="metricCardNote">+18.4%</span>
                </div>
              </div>
              <div className="metricCard">
                <div className="metricCardLabel">Edge Latency</div>
                <div className="metricCardValue">
                  <span>18ms</span>
                  <span className="metricCardNote">Optimal</span>
                </div>
              </div>
              <div className="metricCard">
                <div className="metricCardLabel">System Health</div>
                <div className="metricCardValue">
                  <span>100%</span>
                  <span className="metricCardNote">Nominal</span>
                </div>
              </div>
            </div>

            <div className="formPanel">
              <div className="panelHeading">
                <span className="panelHeadingTitle">System Telemetry</span>
                <span className="tagBadge" style={{ background: "var(--accent-green-soft)", color: "var(--accent-green)" }}>
                  Local Dev Active
                </span>
              </div>

              <table className="cleanTable">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Runtime</th>
                    <th>Status</th>
                    <th>Endpoint</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Next.js App Engine</td>
                    <td>Node.js (App Router)</td>
                    <td><span className="tagBadge" style={{ background: "var(--accent-green-soft)", color: "var(--accent-green)" }}>Running</span></td>
                    <td><code>http://localhost:3000</code></td>
                  </tr>
                  <tr>
                    <td>Google OAuth 2.0</td>
                    <td>NextAuth.js (JWT)</td>
                    <td><span className="tagBadge" style={{ background: "var(--accent-green-soft)", color: "var(--accent-green)" }}>Authorized</span></td>
                    <td><code>{user.email}</code></td>
                  </tr>
                  <tr>
                    <td>Production Edge CDN</td>
                    <td>Vercel Global Edge</td>
                    <td><span className="tagBadge">Linked</span></td>
                    <td><code>https://rifemotion.com</code></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BLOCK: SITE MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === "site" && (
          <div>
            <h1 className="pageTitle">Site Management</h1>
            <p className="pageSubtitle">Manage background showreels, social media channels, and SEO tags:</p>

            <div className="formPanel" style={{ marginBottom: "1.5rem" }}>
              <div className="panelHeading">
                <span className="panelHeadingTitle">Hero Video Assets</span>
                <button type="button" className="expandAllBtn">Replace Video</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                <div className="fieldGroup">
                  <label className="fieldLabel">Primary Video</label>
                  <input type="text" className="compactInput" readOnly value="/video.mp4 (7.0 MB)" />
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">Fallback Video</label>
                  <input type="text" className="compactInput" readOnly value="/video.webm (6.6 MB)" />
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">Mask Animation</label>
                  <input type="text" className="compactInput" readOnly value="Soft Feathered Radial (4.5s)" />
                </div>
              </div>
            </div>

            <div className="formPanel">
              <div className="panelHeading">
                <span className="panelHeadingTitle">Social Media & Bio Links</span>
                <button type="button" className="submitBtn" onClick={() => alert("Links updated!")}>
                  Save Links
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
                <div className="fieldGroup">
                  <label className="fieldLabel">Instagram</label>
                  <input
                    type="text"
                    className="compactInput"
                    value={socials.instagram}
                    onChange={(e) => setSocials({ ...socials, instagram: e.target.value })}
                  />
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">TikTok</label>
                  <input
                    type="text"
                    className="compactInput"
                    value={socials.tiktok}
                    onChange={(e) => setSocials({ ...socials, tiktok: e.target.value })}
                  />
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">X (Twitter)</label>
                  <input
                    type="text"
                    className="compactInput"
                    value={socials.twitter}
                    onChange={(e) => setSocials({ ...socials, twitter: e.target.value })}
                  />
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">YouTube</label>
                  <input
                    type="text"
                    className="compactInput"
                    value={socials.youtube}
                    onChange={(e) => setSocials({ ...socials, youtube: e.target.value })}
                  />
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">Telegram</label>
                  <input
                    type="text"
                    className="compactInput"
                    value={socials.telegram}
                    onChange={(e) => setSocials({ ...socials, telegram: e.target.value })}
                  />
                </div>
                <div className="fieldGroup">
                  <label className="fieldLabel">Contact Email</label>
                  <input
                    type="email"
                    className="compactInput"
                    value={socials.email}
                    onChange={(e) => setSocials({ ...socials, email: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BLOCK: SUBSCRIPTION MANAGEMENT */}
        {/* ========================================================================= */}
        {activeTab === "subscriptions" && (
          <div>
            <h1 className="pageTitle">Subscription Management</h1>
            <p className="pageSubtitle">Manage member plans, active subscribers, and monthly recurring revenue:</p>

            <div className="metricsGrid">
              <div className="metricCard">
                <div className="metricCardLabel">Monthly Revenue</div>
                <div className="metricCardValue">
                  <span>$8,450</span>
                  <span className="metricCardNote">+12.6% MRR</span>
                </div>
              </div>
              <div className="metricCard">
                <div className="metricCardLabel">Active Subscribers</div>
                <div className="metricCardValue">
                  <span>142</span>
                  <span className="metricCardNote">98% Retention</span>
                </div>
              </div>
              <div className="metricCard">
                <div className="metricCardLabel">ARPU</div>
                <div className="metricCardValue">
                  <span>$59.50</span>
                  <span className="metricCardNote">Per User</span>
                </div>
              </div>
              <div className="metricCard">
                <div className="metricCardLabel">Active Tiers</div>
                <div className="metricCardValue">
                  <span>3</span>
                  <span className="metricCardNote">Configured</span>
                </div>
              </div>
            </div>

            <div className="formPanel">
              <div className="panelHeading">
                <span className="panelHeadingTitle">Membership Tiers</span>
                <button type="button" className="expandAllBtn">+ Add Tier</button>
              </div>

              <table className="cleanTable">
                <thead>
                  <tr>
                    <th>Tier Name</th>
                    <th>Interval</th>
                    <th>Price</th>
                    <th>Subscribers</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Creator Pass</strong></td>
                    <td>Monthly</td>
                    <td>$29 / mo</td>
                    <td>84 members</td>
                    <td><span className="tagBadge" style={{ background: "var(--accent-green-soft)", color: "var(--accent-green)" }}>Active</span></td>
                  </tr>
                  <tr>
                    <td><strong>Studio Retainer</strong></td>
                    <td>Monthly</td>
                    <td>$149 / mo</td>
                    <td>42 members</td>
                    <td><span className="tagBadge" style={{ background: "var(--accent-green-soft)", color: "var(--accent-green)" }}>Active</span></td>
                  </tr>
                  <tr>
                    <td><strong>Enterprise Dedicated</strong></td>
                    <td>Annual</td>
                    <td>$1,200 / yr</td>
                    <td>16 members</td>
                    <td><span className="tagBadge" style={{ background: "var(--accent-green-soft)", color: "var(--accent-green)" }}>Active</span></td>
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
