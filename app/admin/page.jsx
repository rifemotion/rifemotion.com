"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import "./admin.css";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Form states for quick local editing
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

            <div className="panelCard">
              <div className="panelHeader">
                <div>
                  <h2 className="panelTitle">Quick Module Navigation</h2>
                  <p className="panelDescription">Direct access to primary studio control centers</p>
                </div>
              </div>
              <div className="cardGrid">
                <div className="cardItem" onClick={() => setActiveTab("site")}>
                  <div className="cardItemTitle">
                    <span>Site Management</span>
                    <span style={{ color: "var(--text-dim)" }}>→</span>
                  </div>
                  <p className="cardItemDesc">Configure hero showreels, update 6 social channels, and fine-tune SEO metadata.</p>
                </div>
                <div className="cardItem" onClick={() => setActiveTab("broadcast")}>
                  <div className="cardItemTitle">
                    <span>Broadcast Center</span>
                    <span style={{ color: "var(--text-dim)" }}>→</span>
                  </div>
                  <p className="cardItemDesc">Send email newsletters, push notifications, and dispatch announcements to your audience.</p>
                </div>
                <div className="cardItem" onClick={() => setActiveTab("subscriptions")}>
                  <div className="cardItemTitle">
                    <span>Subscription Management</span>
                    <span style={{ color: "var(--text-dim)" }}>→</span>
                  </div>
                  <p className="cardItemDesc">Manage creative membership tiers, monitor customer accounts, and track monthly recurring revenue.</p>
                </div>
              </div>
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
        {/* BLOCK 3: BROADCAST CENTER */}
        {/* ========================================================================= */}
        {activeTab === "broadcast" && (
          <div>
            <div className="metricsRow">
              <div className="metricTile">
                <div className="metricLabel">Total Subscribers</div>
                <div className="metricValue">
                  <span>1,248</span>
                  <span className="metricSubtext">+42 this week</span>
                </div>
              </div>
              <div className="metricTile">
                <div className="metricLabel">Average Open Rate</div>
                <div className="metricValue">
                  <span>68.4%</span>
                  <span className="metricSubtext">Industry Top 5%</span>
                </div>
              </div>
              <div className="metricTile">
                <div className="metricLabel">Click-Through Rate</div>
                <div className="metricValue">
                  <span>24.1%</span>
                  <span className="metricSubtext">+3.2%</span>
                </div>
              </div>
            </div>

            <div className="panelCard">
              <div className="panelHeader">
                <div>
                  <h2 className="panelTitle">Compose New Broadcast</h2>
                  <p className="panelDescription">Send an instant newsletter blast or portfolio update to subscribers</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" className="btnSecondary">Save Draft</button>
                  <button type="button" className="btnPrimary" onClick={() => alert("Broadcast scheduled!")}>
                    Send Broadcast →
                  </button>
                </div>
              </div>

              <div className="formRow">
                <div className="formField">
                  <label className="formLabel">Campaign Subject</label>
                  <input type="text" className="textInput" placeholder="New Motion Reel Drop & Autumn Availability" />
                </div>
                <div className="formField">
                  <label className="formLabel">Audience Segment</label>
                  <input type="text" className="textInput" value="All Active Subscribers (1,248)" readOnly />
                </div>
              </div>

              <div className="formField">
                <label className="formLabel">Broadcast Content (Markdown / HTML Supported)</label>
                <textarea
                  className="textArea"
                  style={{ minHeight: "130px" }}
                  placeholder="Hey everyone! We just published our latest 3D showreel..."
                />
              </div>
            </div>

            <div className="panelCard">
              <div className="panelHeader">
                <div>
                  <h2 className="panelTitle">Recent Broadcast History</h2>
                  <p className="panelDescription">Previous campaign delivery stats and audience engagement</p>
                </div>
              </div>

              <table className="minimalTable">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Date</th>
                    <th>Recipients</th>
                    <th>Open Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Summer Creative Drop</td>
                    <td>Aug 10, 2026</td>
                    <td>1,210</td>
                    <td>71.2%</td>
                    <td><span className="statusPill active">Delivered</span></td>
                  </tr>
                  <tr>
                    <td>New Commercial Work Showcase</td>
                    <td>Jul 24, 2026</td>
                    <td>1,150</td>
                    <td>66.8%</td>
                    <td><span className="statusPill active">Delivered</span></td>
                  </tr>
                  <tr>
                    <td>Studio Booking Announcement</td>
                    <td>Jul 02, 2026</td>
                    <td>1,090</td>
                    <td>64.5%</td>
                    <td><span className="statusPill active">Delivered</span></td>
                  </tr>
                </tbody>
              </table>
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
