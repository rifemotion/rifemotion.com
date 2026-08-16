"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import "./admin.css";

// Custom Dropdown Select Component with custom vector arrow
function CustomSelect({ options, value, onChange, placeholder = "Select option..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="customSelectWrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`customSelectBtn ${isOpen ? "customSelectBtnFocused" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <img
          src="/icons_admin/chevron-down.svg"
          alt="Arrow"
          className={`customSelectArrow ${isOpen ? "customSelectArrowOpen" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="customDropdownMenu">
          {options.map((option) => (
            <div
              key={option.value}
              className={`customOptionItem ${option.value === value ? "customOptionSelected" : ""}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value && (
                <img src="/icons_admin/check.svg" alt="Selected" className="iconImg" style={{ width: "12px", height: "12px" }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Active navigation tab: 'dashboard' | 'feedback' | 'dispatch'
  const [activeTab, setActiveTab] = useState("feedback");

  // Database State from Server API
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [mutes, setMutes] = useState({});
  const [replies, setReplies] = useState([]);
  const [loadingDb, setLoadingDb] = useState(true);

  // Filters
  const [feedbackFilter, setFeedbackFilter] = useState("all");
  const [feedbackSearchQuery, setFeedbackSearchQuery] = useState("");
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [banDurationMap, setBanDurationMap] = useState({});

  // Dispatch Form states
  const [dispatchChannel, setDispatchChannel] = useState("lapath");
  const [dispatchForm, setDispatchForm] = useState({
    title: "",
    category: "announcements",
    targetType: "all",
    userId: "",
    inReplyTo: "",
    message: "",
  });
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

  // Fetch Database function (DOES NOT auto-expand any card on interval polling!)
  const fetchDb = async () => {
    try {
      const res = await fetch('/api/admin/feedback');
      const data = await res.json();
      if (data.ok) {
        setFeedbackItems(data.feedback || []);
        setMutes(data.mutes || {});
        setReplies(data.replies || []);
      }
    } catch (err) {
      console.error("Failed to fetch database:", err);
    } finally {
      setLoadingDb(false);
    }
  };

  // Poll database every 4 seconds for live submissions
  useEffect(() => {
    if (status === "authenticated") {
      fetchDb();
      const interval = setInterval(fetchDb, 4000);
      return () => clearInterval(interval);
    } else if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  // Handle Mute / Ban User Action
  const handleMuteUser = async (userId, durationDays) => {
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mute_user',
          userId: userId,
          durationDays: durationDays
        })
      });
      const data = await res.json();
      if (data.ok) {
        setMutes(data.mutes || {});
      }
    } catch (err) {
      console.error("Error muting user:", err);
    }
  };

  // Handle Unmute User Action
  const handleUnmuteUser = async (userId) => {
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unmute_user',
          userId: userId
        })
      });
      const data = await res.json();
      if (data.ok) {
        setMutes(data.mutes || {});
      }
    } catch (err) {
      console.error("Error unmuting user:", err);
    }
  };

  // Handle Reply to User Action
  const handleReplyToUser = (userTarget, ticketRef = null) => {
    setActiveTab("dispatch");
    setDispatchChannel(userTarget.extension === "kliner" ? "kliner" : "lapath");
    setDispatchForm({
      ...dispatchForm,
      category: "personal",
      targetType: "user",
      userId: userTarget.userId,
      inReplyTo: ticketRef ? `Ticket #${ticketRef.id} (${ticketRef.title})` : `Direct Reply to ${userTarget.userId}`,
    });
  };

  // Group Feedback items by User ID (1 User = 1 Unified Profile Card)
  const usersGrouped = {};
  feedbackItems.forEach((item) => {
    if (!usersGrouped[item.userId]) {
      usersGrouped[item.userId] = {
        userId: item.userId,
        email: item.email,
        extensionName: item.extensionName,
        hardware: item.hardware,
        stats: item.stats,
        os: item.os,
        appVersion: item.appVersion,
        daysInstalled: item.daysInstalled,
        items: []
      };
    }
    usersGrouped[item.userId].items.push(item);
  });

  const userProfilesList = Object.values(usersGrouped);

  // Filter User Profiles based on search & category filter
  const filteredUserProfiles = userProfilesList.filter((profile) => {
    const matchesSearch =
      profile.userId.toLowerCase().includes(feedbackSearchQuery.toLowerCase()) ||
      profile.email.toLowerCase().includes(feedbackSearchQuery.toLowerCase()) ||
      profile.hardware.toLowerCase().includes(feedbackSearchQuery.toLowerCase()) ||
      profile.items.some(i => i.title.toLowerCase().includes(feedbackSearchQuery.toLowerCase()) || i.message.toLowerCase().includes(feedbackSearchQuery.toLowerCase()));

    if (feedbackFilter === "all") return matchesSearch;
    if (feedbackFilter === "lapath") return matchesSearch && profile.items.some(i => i.extension === "lapath");
    if (feedbackFilter === "kliner") return matchesSearch && profile.items.some(i => i.extension === "kliner");
    if (feedbackFilter === "bug") return matchesSearch && profile.items.some(i => i.type === "bug");
    if (feedbackFilter === "feature") return matchesSearch && profile.items.some(i => i.type === "suggest");

    return matchesSearch;
  });

  // Handle Dispatch Notification form submit
  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!dispatchForm.title.trim() || !dispatchForm.message.trim()) {
      alert("Please enter a title and message.");
      return;
    }

    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply_user',
          userId: dispatchForm.userId || 'all',
          ticketId: null,
          message: `${dispatchForm.title}: ${dispatchForm.message}`
        })
      });

      const data = await res.json();
      if (data.ok) {
        setDispatchSuccess(true);
        setTimeout(() => setDispatchSuccess(false), 3500);
        fetchDb();
        setDispatchForm({
          title: "",
          category: dispatchForm.category,
          targetType: dispatchForm.targetType,
          userId: "",
          inReplyTo: "",
          message: "",
        });
      }
    } catch (err) {
      console.error("Dispatch error:", err);
    }
  };

  if (status === "loading" || loadingDb) {
    return (
      <div className="appShell" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>Loading portal...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const user = session.user;

  return (
    <div className="appShell">

      {/* ========================================================================= */}
      {/* 1. SIDEBAR */}
      {/* ========================================================================= */}
      <aside className="sideNav">
        <div>
          {/* Profile Card */}
          <div className="profileCard">
            <div className="profileMeta">
              {user.image ? (
                <img src={user.image} alt={user.name || "Admin"} className="avatarBadge" />
              ) : (
                <div className="avatarBadge">R</div>
              )}
              <div>
                <div className="profileName">{user.name || "rifemotion admin"}</div>
                <div className="profileSub">{user.email}</div>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="searchBox">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
              <img src="/icons_admin/search.svg" alt="Search" className="iconImg" style={{ width: "13px", height: "13px" }} />
              <input type="text" className="searchInput" placeholder="Search..." />
            </div>
            <span className="searchKbd">⌘F</span>
          </div>

          {/* DASHBOARD */}
          <div className="navGroupLabel">Essentials</div>
          <div className="navList">
            <button
              type="button"
              className={`navButton ${activeTab === "dashboard" ? "navButtonActive" : ""}`}
              onClick={() => setActiveTab("dashboard")}
            >
              <img src="/icons_admin/dashboard.svg" alt="Dashboard" className="iconImg" />
              <span>Dashboard</span>
            </button>
          </div>

          {/* USER MANAGEMENT PANEL */}
          <div className="navGroupLabel">User Management</div>
          <div className="navList">
            <button
              type="button"
              className={`navButton ${activeTab === "feedback" ? "navButtonActive" : ""}`}
              onClick={() => setActiveTab("feedback")}
            >
              <img src="/icons_admin/message.svg" alt="Feedback & Reports" className="iconImg" />
              <span>Feedback & User Profiles</span>
            </button>
            <button
              type="button"
              className={`navButton ${activeTab === "dispatch" ? "navButtonActive" : ""}`}
              onClick={() => setActiveTab("dispatch")}
            >
              <img src="/icons_admin/broadcast.svg" alt="Send Notification" className="iconImg" />
              <span>Send Notification</span>
            </button>
          </div>

          <div className="navGroupLabel">Shortcuts</div>
          <div className="navList">
            <Link href="/" target="_blank" className="navButton">
              <img src="/icons_admin/link.svg" alt="Website" className="iconImg" />
              <span>Live Website ↗</span>
            </Link>
            <button
              type="button"
              className="navButton"
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
            >
              <img src="/icons_admin/logout.svg" alt="Sign Out" className="iconImg" />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="sidebarBottom">
          <div className="brandLabel">
            <span className="brandIndicator"></span>
            <span>rifemotion</span>
          </div>
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            v3.3.0
          </span>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN CANVAS */}
      {/* ========================================================================= */}
      <main className="mainCanvas">
        
        {/* ========================================================================= */}
        {/* VIEW: FEEDBACK & UNIFIED USER PROFILES */}
        {/* ========================================================================= */}
        {activeTab === "feedback" && (
          <div>
            <div className="viewHeader">
              <div>
                <h1 className="viewTitle">User Profiles & Feedback Database</h1>
                <p className="viewSubtitle">Unified user cards with hardware telemetry, extension stats, submission timeline, and feedback ban controls</p>
              </div>
            </div>

            <div className="cleanPanel">
              <div className="panelHead">
                {/* Filter Pills */}
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`selectorPillBtn ${feedbackFilter === "all" ? "selectorPillBtnActive" : ""}`}
                    onClick={() => setFeedbackFilter("all")}
                  >
                    All Users ({userProfilesList.length})
                  </button>
                  <button
                    type="button"
                    className={`selectorPillBtn ${feedbackFilter === "lapath" ? "selectorPillBtnActive" : ""}`}
                    onClick={() => setFeedbackFilter("lapath")}
                  >
                    LaPath
                  </button>
                  <button
                    type="button"
                    className={`selectorPillBtn ${feedbackFilter === "kliner" ? "selectorPillBtnActive" : ""}`}
                    onClick={() => setFeedbackFilter("kliner")}
                  >
                    KLiner
                  </button>
                  <button
                    type="button"
                    className={`selectorPillBtn ${feedbackFilter === "bug" ? "selectorPillBtnActive" : ""}`}
                    onClick={() => setFeedbackFilter("bug")}
                  >
                    Bug Reports
                  </button>
                  <button
                    type="button"
                    className={`selectorPillBtn ${feedbackFilter === "feature" ? "selectorPillBtnActive" : ""}`}
                    onClick={() => setFeedbackFilter("feature")}
                  >
                    Suggestions
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ width: "260px" }}>
                  <input
                    type="text"
                    className="pillInput"
                    placeholder="Search User ID, Email, Hardware..."
                    value={feedbackSearchQuery}
                    onChange={(e) => setFeedbackSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* UNIFIED USER PROFILE CARDS FEED */}
              <div className="historyFeed" style={{ maxHeight: "760px" }}>
                {filteredUserProfiles.length === 0 ? (
                  <div style={{ padding: "3rem 1rem", textAlign: "center" }}>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.82rem", marginBottom: "0.25rem" }}>
                      No user profiles or feedback recorded yet.
                    </p>
                    <p style={{ color: "var(--text-muted)", fontSize: "0.74rem" }}>
                      Submissions from LaPath & KLiner will automatically appear here in real-time.
                    </p>
                  </div>
                ) : (
                  filteredUserProfiles.map((profile) => {
                    const isExpanded = expandedUserId === profile.userId;
                    const isMuted = mutes[profile.userId] && new Date(mutes[profile.userId].bannedUntil).getTime() > Date.now();
                    const selectedDuration = banDurationMap[profile.userId] || "1";

                    return (
                      <div
                        key={profile.userId}
                        className={`historyItemCard ${isExpanded ? "historyItemCardSelected" : ""}`}
                        onClick={() => setExpandedUserId(isExpanded ? null : profile.userId)}
                      >
                        <div className="historyItemTop">
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <strong style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{profile.userId}</strong>
                            <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>({profile.email})</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span className={`pillTag ${isMuted ? "banned" : "ok"}`}>
                              {isMuted ? "Muted / Banned" : "Active"}
                            </span>
                            <span className="pillTag active">{profile.items.length} {profile.items.length === 1 ? 'Submission' : 'Submissions'}</span>
                          </div>
                        </div>

                        <div className="historyItemMeta">
                          <span>OS: <strong>{profile.os}</strong></span>
                          <span>•</span>
                          <span>AE: <strong>{profile.appVersion}</strong></span>
                          <span>•</span>
                          <span>Installed: <strong>{profile.daysInstalled}</strong></span>
                        </div>

                        {!isExpanded ? (
                          <p className="historyItemSnippet">
                            Latest: "{profile.items[0]?.title}" — {profile.items[0]?.message}
                          </p>
                        ) : (
                          <div style={{ marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border-subtle)" }}>
                            
                            {/* Hardware & Telemetry Accordion */}
                            <div style={{
                              background: "var(--bg-app)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "var(--radius-sm)",
                              padding: "0.85rem",
                              marginBottom: "1rem"
                            }}>
                              <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                                Hardware & System Telemetry
                              </div>
                              <div style={{ fontSize: "0.78rem", color: "var(--text-primary)", fontFamily: "var(--font-mono)", marginBottom: "0.45rem" }}>
                                {profile.hardware}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                                Extension Stats: <code>{profile.stats}</code>
                              </div>
                            </div>

                            {/* Submission Timeline */}
                            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                              Submission Timeline ({profile.items.length})
                            </div>
                            
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
                              {profile.items.map((sub) => (
                                <div key={sub.id} style={{
                                  background: "#17181d",
                                  border: "1px solid var(--border-subtle)",
                                  borderRadius: "var(--radius-xs)",
                                  padding: "0.75rem 0.85rem"
                                }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                      <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>#{sub.id}</span>
                                      <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{sub.title}</span>
                                    </div>
                                    <div style={{ display: "flex", gap: "0.3rem" }}>
                                      <span className="pillTag">{sub.extensionName}</span>
                                      <span className={`pillTag ${sub.type === "bug" ? "banned" : "ok"}`}>{sub.typeName}</span>
                                    </div>
                                  </div>

                                  <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.45, marginBottom: "0.45rem" }}>
                                    {sub.message}
                                  </p>

                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                                    <span>Submitted: {sub.date}</span>
                                    {sub.telegramMediaUrl ? (
                                      <Link
                                        href={sub.telegramMediaUrl}
                                        target="_blank"
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ color: "var(--text-primary)", textDecoration: "underline" }}
                                      >
                                        View Media in Telegram ↗
                                      </Link>
                                    ) : (
                                      <span>No Media Attachment</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Controls Footer (Clean Separated Buttons with gap: 1rem) */}
                            <div style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              paddingTop: "0.75rem",
                              borderTop: "1px dashed var(--border-subtle)",
                              gap: "1rem"
                            }}>
                              {/* Ban / Mute Controls */}
                              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }} onClick={(e) => e.stopPropagation()}>
                                {isMuted ? (
                                  <button
                                    type="button"
                                    className="successPillBtn"
                                    onClick={() => handleUnmuteUser(profile.userId)}
                                  >
                                    Unmute User Access
                                  </button>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <div style={{ width: "110px" }}>
                                      <CustomSelect
                                        options={[
                                          { label: "1 Day", value: "1" },
                                          { label: "3 Days", value: "3" },
                                          { label: "7 Days", value: "7" },
                                          { label: "30 Days", value: "30" },
                                          { label: "Permanent", value: "permanent" },
                                        ]}
                                        value={selectedDuration}
                                        onChange={(val) => setBanDurationMap({ ...banDurationMap, [profile.userId]: val })}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      className="dangerPillBtn"
                                      onClick={() => handleMuteUser(profile.userId, selectedDuration)}
                                    >
                                      Mute Feedback
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Reply Button */}
                              <button
                                type="button"
                                className="submitPillBtn"
                                style={{ padding: "0.35rem 0.95rem", fontSize: "0.75rem", flexShrink: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReplyToUser(profile, profile.items[0]);
                                }}
                              >
                                Reply to User →
                              </button>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW: SEND NOTIFICATION */}
        {/* ========================================================================= */}
        {activeTab === "dispatch" && (
          <div>
            <div className="viewHeader">
              <div>
                <h1 className="viewTitle">Send Notification</h1>
                <p className="viewSubtitle">Dispatch announcements, system notices, and replies via Email or LaPath extension</p>
              </div>
            </div>

            {dispatchSuccess && (
              <div style={{
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--border-medium)",
                color: "var(--text-primary)",
                borderRadius: "var(--radius-sm)",
                padding: "0.6rem 0.95rem",
                fontSize: "0.78rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}>
                <img src="/icons_admin/check.svg" alt="Check" className="iconImg" style={{ width: "13px", height: "13px" }} />
                <span>Notification dispatched to <strong>{dispatchChannel === "lapath" ? "LaPath Extension" : "Email Broadcast"}</strong> and recorded to database log.</span>
              </div>
            )}

            <div className="denseTwoCol">
              {/* LEFT COLUMN: DISPATCH FORM WITH CUSTOM DROPDOWNS */}
              <div className="cleanPanel">
                <div className="panelHead">
                  <span className="panelHeadTitle">Dispatch Form</span>
                  <span className="pillTag active">{dispatchChannel === "lapath" ? "LAPATH EXTENSION" : "EMAIL BROADCAST"}</span>
                </div>

                <form onSubmit={handleSendNotification}>
                  {/* Custom Dropdown 1: Select Channel */}
                  <div className="inputField">
                    <label className="inputLabel">Select Channel</label>
                    <CustomSelect
                      options={[
                        { label: "LaPath Extension", value: "lapath" },
                        { label: "Email Broadcast", value: "email" },
                      ]}
                      value={dispatchChannel}
                      onChange={(val) => setDispatchChannel(val)}
                    />
                  </div>

                  <div className="inputField">
                    <label className="inputLabel">Notification Title</label>
                    <input
                      type="text"
                      className="pillInput"
                      placeholder="e.g. Summer Motion Giveaway!"
                      value={dispatchForm.title}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })}
                      required
                    />
                  </div>

                  {/* Custom Dropdown 2: Category */}
                  <div className="inputField">
                    <label className="inputLabel">Category</label>
                    <CustomSelect
                      options={[
                        { label: "Announcements (All Users)", value: "announcements" },
                        { label: "System Notice (All or Single User)", value: "system" },
                        { label: "Personal Reply (Single User)", value: "personal" },
                      ]}
                      value={dispatchForm.category}
                      onChange={(val) => setDispatchForm({ ...dispatchForm, category: val })}
                    />
                  </div>

                  {dispatchForm.category === "personal" && (
                    <div className="inputField">
                      <label className="inputLabel">User ID</label>
                      <input
                        type="text"
                        className="pillInput"
                        placeholder="e.g. usr_99a81b2c4"
                        value={dispatchForm.userId}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, userId: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  {dispatchForm.category === "personal" && (
                    <div className="inputField">
                      <label className="inputLabel">In Response To</label>
                      <input
                        type="text"
                        className="pillInput"
                        placeholder="e.g. Feature Request #402"
                        value={dispatchForm.inReplyTo}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, inReplyTo: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="inputField">
                    <label className="inputLabel">Notification Message</label>
                    <textarea
                      className="pillTextarea"
                      placeholder="Type notification text..."
                      value={dispatchForm.message}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, message: e.target.value })}
                      required
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                    <button type="submit" className="submitPillBtn">
                      Dispatch Notification
                    </button>
                  </div>
                </form>
              </div>

              {/* RIGHT COLUMN: REPLIES HISTORY LOG */}
              <div className="cleanPanel">
                <div className="panelHead">
                  <span className="panelHeadTitle">Dispatch History</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                    {replies.length} logged
                  </span>
                </div>

                <div className="historyFeed">
                  {replies.map((item) => (
                    <div key={item.id} className="historyItemCard">
                      <div className="historyItemTop">
                        <span className="historyItemTitle">Reply to #{item.userId}</span>
                        <span className="pillTag active">{item.date}</span>
                      </div>
                      <p className="historyItemBody">{item.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW: DASHBOARD */}
        {/* ========================================================================= */}
        {activeTab === "dashboard" && (
          <div>
            <div className="viewHeader">
              <div>
                <h1 className="viewTitle">Dashboard</h1>
                <p className="viewSubtitle">Studio operations, infrastructure health, and telemetry</p>
              </div>
            </div>

            <div className="metricsGrid">
              <div className="metricCard">
                <div className="metricCardLabel">Live Visitors</div>
                <div className="metricCardValue">
                  <span>24</span>
                  <span className="metricCardNote">Active</span>
                </div>
              </div>
              <div className="metricCard">
                <div className="metricCardLabel">Registered Users</div>
                <div className="metricCardValue">
                  <span>{userProfilesList.length}</span>
                  <span className="metricCardNote">In Database</span>
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
          </div>
        )}

      </main>

    </div>
  );
}
