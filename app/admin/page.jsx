"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import "./admin.css";

// Custom Dropdown Select Component (Max 5px radius)
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
        className="customSelectTrigger"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s ease' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>

      {isOpen && (
        <div className="customSelectDropdown" onClick={(e) => e.stopPropagation()}>
          {options.map((option) => (
            <div
              key={option.value}
              className={`customSelectOption ${option.value === value ? "selected" : ""}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
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

  // Navigation tab: 'feedback' | 'dispatch' | 'status'
  const [activeTab, setActiveTab] = useState("feedback");

  // Database State
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [mutes, setMutes] = useState({});
  const [replies, setReplies] = useState([]);
  const [loadingDb, setLoadingDb] = useState(true);

  // Read / Unread Status State
  const [readFeedbackIds, setReadFeedbackIds] = useState([]);

  // Filters & State
  const [feedbackFilter, setFeedbackFilter] = useState("all");
  const [feedbackSearchQuery, setFeedbackSearchQuery] = useState("");
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [expandedSpecsMap, setExpandedSpecsMap] = useState({});
  const [expandedSubMap, setExpandedSubMap] = useState({});

  // Mute Modal State
  const [muteModalTargetUser, setMuteModalTargetUser] = useState(null);
  const [muteModalDuration, setMuteModalDuration] = useState("7");
  const [muteModalReason, setMuteModalReason] = useState("Spam & Flooding");

  // Context Menu State
  const [contextMenu, setContextMenu] = useState(null);
  const [activeMenuUserId, setActiveMenuUserId] = useState(null);

  // Dispatch Form states
  const [dispatchForm, setDispatchForm] = useState({
    title: "",
    category: "announcements",
    targetType: "all",
    userId: "",
    message: "",
  });
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

  // Load read feedback IDs from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rifemotion_read_feedback_ids');
      if (saved) {
        setReadFeedbackIds(JSON.parse(saved));
      }
    } catch (e) {}
  }, []);

  // Save read feedback IDs to localStorage
  const saveReadIds = (ids) => {
    setReadFeedbackIds(ids);
    try {
      localStorage.setItem('rifemotion_read_feedback_ids', JSON.stringify(ids));
    } catch (e) {}
  };

  // Mark all currently loaded feedback as read
  const handleMarkAllRead = () => {
    const allIds = feedbackItems.map(i => i.id);
    const merged = Array.from(new Set([...readFeedbackIds, ...allIds]));
    saveReadIds(merged);
  };

  // Mark single user's feedback as read when expanded
  const handleUserRowClick = (profile) => {
    const isCurrentlyExpanded = expandedUserId === profile.userId;
    setExpandedUserId(isCurrentlyExpanded ? null : profile.userId);

    if (!isCurrentlyExpanded) {
      const userItemIds = profile.items.map(i => i.id);
      const merged = Array.from(new Set([...readFeedbackIds, ...userItemIds]));
      saveReadIds(merged);
    }
  };

  // Fetch Database function
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

  // Poll database every 4 seconds
  useEffect(() => {
    if (status === "authenticated") {
      fetchDb();
      const interval = setInterval(fetchDb, 4000);
      return () => clearInterval(interval);
    } else if (status === "unauthenticated") {
      router.push("/admin/login");
    }
  }, [status, router]);

  // Global mousedown listener to dismiss context menu & 3-dots dropdown on clicking anywhere outside
  useEffect(() => {
    const handleGlobalMouseDown = (e) => {
      setContextMenu(null);
      if (!e.target.closest('.dotsActionBtn') && !e.target.closest('.dotsDropdown')) {
        setActiveMenuUserId(null);
      }
    };
    window.addEventListener('mousedown', handleGlobalMouseDown);
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown);
  }, []);

  // Handle Delete Submission (Right-click menu)
  const handleDeleteSubmission = async (subId) => {
    const confirmed = window.confirm("Delete this submission permanently from server?");
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_feedback',
          id: subId
        })
      });
      const data = await res.json();
      if (data.ok) {
        setFeedbackItems(data.feedback || []);
      }
    } catch (err) {
      console.error("Error deleting submission:", err);
    }
  };

  // Handle Delete Reply / Broadcast Notification
  const handleDeleteReply = async (replyId) => {
    const confirmed = window.confirm("Delete this notification from server?");
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_reply',
          replyId: replyId
        })
      });
      const data = await res.json();
      if (data.ok) {
        setReplies(data.replies || []);
      }
    } catch (err) {
      console.error("Error deleting reply:", err);
    }
  };

  // Handle Mute Modal submit
  const handleConfirmMuteModal = async () => {
    if (!muteModalTargetUser) return;
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mute_user',
          userId: muteModalTargetUser.userId,
          durationDays: muteModalDuration,
          reason: muteModalReason
        })
      });
      const data = await res.json();
      if (data.ok) {
        setMutes(data.mutes || {});
        setReplies(data.replies || []);
        setMuteModalTargetUser(null);
        setMuteModalReason("Spam & Flooding");
      }
    } catch (err) {
      console.error("Error muting user:", err);
    }
  };

  // Handle Shadow Ban
  const handleShadowBanUser = async (userId) => {
    const confirmed = window.confirm(`Shadow ban user ${userId}? Their submissions will be silently accepted.`);
    if (!confirmed) return;

    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'shadow_ban_user',
          userId: userId
        })
      });
      const data = await res.json();
      if (data.ok) {
        setMutes(data.mutes || {});
      }
    } catch (err) {
      console.error("Error shadow banning user:", err);
    }
  };

  // Handle Unmute
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

  // Handle Dispatch Notification
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
          title: dispatchForm.title.trim(),
          category: dispatchForm.category || 'personal',
          message: dispatchForm.message.trim()
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
          message: "",
        });
      }
    } catch (err) {
      console.error("Dispatch error:", err);
    }
  };

  // Group items by User ID (guaranteeing email persistence)
  const usersGrouped = {};
  feedbackItems.forEach((item) => {
    if (!usersGrouped[item.userId]) {
      usersGrouped[item.userId] = {
        userId: item.userId,
        email: item.email && item.email.includes('@') && item.email !== 'none' ? item.email : 'none',
        extensionName: item.extensionName,
        hardware: item.hardware,
        stats: item.stats,
        os: item.os,
        appVersion: item.appVersion,
        installDate: item.installDate,
        daysInstalled: item.daysInstalled,
        items: []
      };
    }
    if (usersGrouped[item.userId].email === 'none' && item.email && item.email.includes('@') && item.email !== 'none') {
      usersGrouped[item.userId].email = item.email;
    }
    usersGrouped[item.userId].items.push(item);
  });

  const userProfilesList = Object.values(usersGrouped);

  // Sort user profiles: Unread bug reports/features at TOP, reviews/read below
  userProfilesList.sort((a, b) => {
    const aHasUnread = a.items.some(i => i.type !== 'review' && !readFeedbackIds.includes(i.id));
    const bHasUnread = b.items.some(i => i.type !== 'review' && !readFeedbackIds.includes(i.id));

    if (aHasUnread && !bHasUnread) return -1;
    if (!aHasUnread && bHasUnread) return 1;

    // Secondary sort: newest submission first
    const aLatestId = a.items[0]?.id || 0;
    const bLatestId = b.items[0]?.id || 0;
    return bLatestId - aLatestId;
  });

  // Filter User Profiles
  const filteredUserProfiles = userProfilesList.filter((profile) => {
    const matchesSearch =
      profile.userId.toLowerCase().includes(feedbackSearchQuery.toLowerCase()) ||
      profile.email.toLowerCase().includes(feedbackSearchQuery.toLowerCase()) ||
      (profile.hardware && profile.hardware.toLowerCase().includes(feedbackSearchQuery.toLowerCase())) ||
      profile.items.some(i => (i.title && i.title.toLowerCase().includes(feedbackSearchQuery.toLowerCase())) || (i.message && i.message.toLowerCase().includes(feedbackSearchQuery.toLowerCase())));

    if (feedbackFilter === "all") return matchesSearch;
    if (feedbackFilter === "lapath") return matchesSearch && profile.items.some(i => i.extension === "lapath");
    if (feedbackFilter === "kliner") return matchesSearch && profile.items.some(i => i.extension === "kliner");
    if (feedbackFilter === "bug") return matchesSearch && profile.items.some(i => i.type === "report" || i.type === "bug");
    if (feedbackFilter === "feature") return matchesSearch && profile.items.some(i => i.type === "suggest");
    if (feedbackFilter === "review") return matchesSearch && profile.items.some(i => i.type === "review");

    return matchesSearch;
  });

  if (status === "loading" || loadingDb) {
    return (
      <div className="appShell" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}>Connecting to database...</p>
      </div>
    );
  }

  if (!session) return null;
  const user = session.user;

  return (
    <div className="appShell">

      {/* 1. COMPACT SIDEBAR */}
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
                <div className="profileName">{user.name || "rifemotion"}</div>
                <div className="profileSub">{user.email}</div>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="searchBox">
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", width: "100%" }}>
              <img src="/icons_admin/search.svg" alt="Search" className="iconImg" style={{ width: "11px", height: "11px" }} />
              <input type="text" className="searchInput" placeholder="Search..." />
            </div>
            <span className="searchKbd">⌘K</span>
          </div>

          <div className="navGroupLabel">Database</div>
          <div className="navList">
            <button
              type="button"
              className={`navButton ${activeTab === "feedback" ? "navButtonActive" : ""}`}
              onClick={() => setActiveTab("feedback")}
            >
              <img src="/icons_admin/message.svg" alt="Feedback" className="iconImg" />
              <span>Feedback & Telemetry</span>
            </button>
            <button
              type="button"
              className={`navButton ${activeTab === "dispatch" ? "navButtonActive" : ""}`}
              onClick={() => setActiveTab("dispatch")}
            >
              <img src="/icons_admin/broadcast.svg" alt="Dispatch" className="iconImg" />
              <span>Broadcast Notice</span>
            </button>
            <button
              type="button"
              className={`navButton ${activeTab === "status" ? "navButtonActive" : ""}`}
              onClick={() => setActiveTab("status")}
            >
              <img src="/icons_admin/dashboard.svg" alt="Status" className="iconImg" />
              <span>System Telemetry</span>
            </button>
          </div>

          <div className="navGroupLabel">External</div>
          <div className="navList">
            <Link href="/" target="_blank" className="navButton">
              <img src="/icons_admin/link.svg" alt="Website" className="iconImg" />
              <span>rifemotion.com ↗</span>
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

        <div className="sidebarBottom">
          <div className="brandLabel">
            <span className="brandIndicator"></span>
            <span>rifemotion</span>
          </div>
          <span style={{ fontSize: "0.64rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            v4.4.0
          </span>
        </div>
      </aside>

      {/* 2. MAIN CANVAS */}
      <main className="mainCanvas">
        
        {/* ========================================================================= */}
        {/* VIEW: FEEDBACK & USER PROFILES */}
        {/* ========================================================================= */}
        {activeTab === "feedback" && (
          <div>
            <div className="viewHeader">
              <div>
                <h1 className="viewTitle">Feedback & Telemetry Fleet</h1>
                <p className="viewSubtitle">Real-time user submissions, hardware telemetry, attached media, and restriction control</p>
              </div>
            </div>

            {/* DENSE TOP TOOLBAR */}
            <div className="denseToolbar">
              <div className="toolbarLeft">
                {[
                  { id: "all", label: `All Users (${userProfilesList.length})` },
                  { id: "lapath", label: "LaPath" },
                  { id: "kliner", label: "KLiner" },
                  { id: "bug", label: "Bug Reports" },
                  { id: "feature", label: "Suggestions" },
                  { id: "review", label: "Reviews" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`denseTabBtn ${feedbackFilter === tab.id ? "denseTabBtnActive" : ""}`}
                    onClick={() => setFeedbackFilter(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="toolbarRight">
                <button
                  type="button"
                  className="markAllReadBtn"
                  onClick={handleMarkAllRead}
                  title="Mark all bug reports and suggestions as read"
                >
                  ✓ Mark All as Read
                </button>
                <input
                  type="text"
                  className="denseSearchInput"
                  placeholder="Search ID, email, specs..."
                  value={feedbackSearchQuery}
                  onChange={(e) => setFeedbackSearchQuery(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <span className="countChip">{filteredUserProfiles.length} records</span>
              </div>
            </div>

            {/* DATA TABLE */}
            <div className="denseTablePanel">
              {/* TABLE HEADER */}
              <div className="denseTableHeader">
                <div>User ID / Email</div>
                <div>App & Environment</div>
                <div>Status</div>
                <div>Submissions</div>
                <div></div>
              </div>

              {/* TABLE BODY ROWS */}
              <div className="denseTableBody">
                {filteredUserProfiles.length === 0 ? (
                  <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                    No telemetry records matching filter.
                  </div>
                ) : (
                  filteredUserProfiles.map((profile) => {
                    const isExpanded = expandedUserId === profile.userId;
                    const isSpecsExpanded = expandedSpecsMap[profile.userId] || false;
                    const userMute = mutes[profile.userId];
                    const isMuted = userMute && !userMute.shadowBanned && new Date(userMute.bannedUntil).getTime() > Date.now();
                    const isShadowBanned = userMute && userMute.shadowBanned;
                    const userReplies = replies.filter((r) => r.userId === profile.userId || r.userId === 'all');
                    const latestItem = profile.items[0];
                    const hasUnread = profile.items.some(i => i.type !== 'review' && !readFeedbackIds.includes(i.id));

                    return (
                      <div
                        key={profile.userId}
                        className={`denseRowWrapper ${isExpanded ? 'isRowExpanded' : ''}`}
                      >
                        {/* MAIN ROW LINE */}
                        <div
                          className="denseRowMain"
                          onClick={() => handleUserRowClick(profile)}
                        >
                          {/* USER CELL */}
                          <div className="cellUser">
                            <span className={`statusIndicatorDot ${isShadowBanned ? 'shadow' : isMuted ? 'muted' : 'active'}`} />
                            <span className="userIdText">{profile.userId}</span>
                            {profile.email !== 'none' && (
                              <span className="userEmailText">({profile.email})</span>
                            )}
                            {hasUnread && (
                              <span className="badgePill new">NEW</span>
                            )}
                          </div>

                          {/* SPECS CELL */}
                          <div className="cellSpecs">
                            <span>{profile.extensionName}</span>
                            <span style={{ color: "var(--text-muted)", margin: "0 0.35rem" }}>•</span>
                            <span>{profile.os || 'Win'} / AE {profile.appVersion || '26.x'}</span>
                          </div>

                          {/* STATUS CELL */}
                          <div className="cellStatus">
                            {isShadowBanned ? (
                              <span className="badgePill shadow">Shadow Banned</span>
                            ) : isMuted ? (
                              <span className="badgePill muted">Muted</span>
                            ) : (
                              <span className="badgePill active">Active</span>
                            )}
                          </div>

                          {/* COUNT CELL */}
                          <div className="cellCount">
                            <span className="badgePill">
                              {profile.items.length} {profile.items.length === 1 ? 'submission' : 'submissions'}
                            </span>
                            {latestItem && latestItem.type === 'review' && latestItem.rating && (
                              <span className="badgePill stars">★ {latestItem.rating}/5</span>
                            )}
                          </div>

                          {/* ACTIONS CELL */}
                          <div className="cellActions" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="dotsActionBtn"
                              onClick={() => setActiveMenuUserId(activeMenuUserId === profile.userId ? null : profile.userId)}
                            >
                              ⋮
                            </button>

                            {activeMenuUserId === profile.userId && (
                              <div className="dotsDropdown">
                                {isMuted || isShadowBanned ? (
                                  <div
                                    className="dotsDropdownItem"
                                    onClick={() => {
                                      handleUnmuteUser(profile.userId);
                                      setActiveMenuUserId(null);
                                    }}
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    <span>Unmute User</span>
                                  </div>
                                ) : (
                                  <>
                                    <div
                                      className="dotsDropdownItem"
                                      onClick={() => {
                                        setMuteModalTargetUser(profile);
                                        setActiveMenuUserId(null);
                                      }}
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                                      <span>Mute User...</span>
                                    </div>
                                    <div
                                      className="dotsDropdownItem"
                                      onClick={() => {
                                        handleShadowBanUser(profile.userId);
                                        setActiveMenuUserId(null);
                                      }}
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                      <span>Shadow Ban User</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* EXPANDABLE DRAWER */}
                        <div className={`accordionContent ${isExpanded ? 'isExpanded' : ''}`}>
                          <div className="accordionInner">
                            <div className="drawerContainer" onClick={(e) => e.stopPropagation()}>
                              <div className="drawerSplitGrid">
                                
                                {/* LEFT COLUMN: SUBMISSION CHAIN */}
                                <div className="drawerColumn">
                                  <div className="drawerColHead">
                                    <span>Submissions Chain ({profile.items.length})</span>
                                    <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>Right click to delete</span>
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                                    {profile.items.map((sub, idx) => {
                                      const isSubExpanded = expandedSubMap[sub.id] || false;
                                      const cleanTitle = sub.type === 'review' ? 'Review' : sub.type === 'suggest' ? 'Feature Suggestion' : 'Bug Report';
                                      const hasMediaAttached = Boolean(sub.hasMedia || sub.telegramMediaUrl);
                                      const isItemUnread = sub.type !== 'review' && !readFeedbackIds.includes(sub.id);

                                      return (
                                        <div
                                          key={sub.id}
                                          className="subItemCard"
                                          onContextMenu={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setContextMenu({ x: e.clientX, y: e.clientY, subId: sub.id });
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setExpandedSubMap({ ...expandedSubMap, [sub.id]: !isSubExpanded });
                                            if (isItemUnread) {
                                              saveReadIds([...readFeedbackIds, sub.id]);
                                            }
                                          }}
                                        >
                                          <div className="subItemTop">
                                            <div className="subItemLeft">
                                              <span className="subNumberTag">#{profile.items.length - idx}</span>
                                              <span className="subTitleText">{cleanTitle}</span>
                                              {isItemUnread && (
                                                <span className="badgePill new">NEW</span>
                                              )}
                                            </div>

                                            <div className="subItemRight">
                                              {hasMediaAttached && (
                                                <span className="badgePill media">📎 Media</span>
                                              )}
                                              {sub.type === 'review' && sub.rating && (
                                                <span className="badgePill stars">★ {sub.rating}/5</span>
                                              )}
                                              <span className="badgePill">{sub.extensionName}</span>
                                              <span className="subDateText">{sub.date}</span>
                                            </div>
                                          </div>

                                          {/* LINE 2 INSET BODY */}
                                          <div className={`accordionContent ${isSubExpanded ? 'isExpanded' : ''}`}>
                                            <div className="accordionInner">
                                              <div className="subItemBody">
                                                <p>{sub.message || "(No message body provided)"}</p>
                                                {sub.telegramMediaUrl ? (
                                                  <Link
                                                    href={sub.telegramMediaUrl}
                                                    target="_blank"
                                                    className="tgMediaBtn"
                                                    onClick={(e) => e.stopPropagation()}
                                                  >
                                                    <span>View Attached Media in Telegram</span> ↗
                                                  </Link>
                                                ) : sub.hasMedia ? (
                                                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
                                                    📎 Media attached (saved in Telegram Bot)
                                                  </div>
                                                ) : null}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* RIGHT COLUMN: HARDWARE SPEC & REPLIES */}
                                <div className="drawerColumn">
                                  
                                  {/* HARDWARE SPEC ACCORDION */}
                                  <div
                                    className="hardwareBox"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedSpecsMap({ ...expandedSpecsMap, [profile.userId]: !isSpecsExpanded });
                                    }}
                                  >
                                    <div className="hardwareBoxHeader">
                                      <span className="hardwareBoxTitle">
                                        <span>PC Telemetry & Specs</span>
                                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{isSpecsExpanded ? '▴' : '▾'}</span>
                                      </span>
                                      <span className="hardwareBoxSub">
                                        {profile.os} • AE {profile.appVersion}
                                      </span>
                                    </div>

                                    <div className={`accordionContent ${isSpecsExpanded ? 'isExpanded' : ''}`}>
                                      <div className="accordionInner">
                                        <div className="hardwareDetailRows">
                                          <div className="hardwareRow">
                                            <span className="hwLabel">GPU / CPU</span>
                                            <span className="hwVal">{profile.hardware}</span>
                                          </div>
                                          <div className="hardwareRow">
                                            <span className="hwLabel">Telemetry</span>
                                            <span className="hwVal">{profile.stats}</span>
                                          </div>
                                          <div className="hardwareRow">
                                            <span className="hwLabel">Installed</span>
                                            <span className="hwVal">{profile.daysInstalled}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* DIRECT RESPONSES HEADER */}
                                  <div className="drawerColHead" style={{ marginTop: "0.3rem" }}>
                                    <span>Direct Responses ({userReplies.length})</span>
                                  </div>

                                  {/* RESPONSES FEED */}
                                  <div className="responsesFeed">
                                    {userReplies.length === 0 ? (
                                      <div style={{
                                        backgroundColor: "var(--bg-panel)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "var(--r-sm)",
                                        padding: "0.75rem",
                                        textAlign: "center",
                                        color: "var(--text-muted)",
                                        fontSize: "0.72rem"
                                      }}>
                                        No direct responses sent to this user yet.
                                      </div>
                                    ) : (
                                      userReplies.map((r) => (
                                        <div key={r.id} className="responseItem">
                                          <div className="responseItemHead">
                                            <span className="responseSender">
                                              <span className="statusIndicatorDot active" style={{ width: "5px", height: "5px" }} />
                                              <span>{r.title || (r.userId === 'all' ? "Announcement" : "Direct Message")}</span>
                                            </span>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                              <span className="responseDate">{r.date}</span>
                                              <button
                                                type="button"
                                                className="delReplyBtn"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteReply(r.id);
                                                }}
                                                title="Delete notification"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          </div>
                                          <p className="responseText">{r.message}</p>
                                        </div>
                                      ))
                                    )}
                                  </div>

                                  {/* REPLY ACTION BUTTON */}
                                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.3rem" }}>
                                    <button
                                      type="button"
                                      className="replyUserBtn"
                                      onClick={() => {
                                        setActiveTab("dispatch");
                                        setDispatchForm({
                                          ...dispatchForm,
                                          category: "personal",
                                          userId: profile.userId
                                        });
                                      }}
                                    >
                                      <span>+ Reply to User</span>
                                    </button>
                                  </div>

                                </div>

                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW: DISPATCH NOTIFICATION & SENT HISTORY */}
        {/* ========================================================================= */}
        {activeTab === "dispatch" && (
          <div>
            <div className="viewHeader">
              <div>
                <h1 className="viewTitle">Broadcast & Notification Center</h1>
                <p className="viewSubtitle">Dispatch messages directly to CEP panels and manage broadcast history</p>
              </div>
            </div>

            <div className="dispatchSplitLayout">
              {/* LEFT: DISPATCH FORM */}
              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)", padding: "1.25rem" }}>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-pure)", marginBottom: "1rem" }}>
                  New Broadcast / Direct Message
                </div>

                {dispatchSuccess && (
                  <div style={{
                    padding: "0.65rem 0.85rem",
                    backgroundColor: "var(--acc-green-bg)",
                    border: "1px solid var(--acc-green-border)",
                    borderRadius: "var(--r-sm)",
                    color: "var(--acc-green)",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    marginBottom: "1rem"
                  }}>
                    ✓ Notification successfully dispatched to user extension.
                  </div>
                )}

                <form onSubmit={handleSendNotification}>
                  <div className="formGroup">
                    <label className="formLabel">Target Recipient</label>
                    <CustomSelect
                      options={[
                        { label: "All Users (Global Broadcast)", value: "all" },
                        { label: "Specific User ID", value: "single" }
                      ]}
                      value={dispatchForm.targetType}
                      onChange={(val) => setDispatchForm({ ...dispatchForm, targetType: val })}
                    />
                  </div>

                  {dispatchForm.targetType === "single" && (
                    <div className="formGroup">
                      <label className="formLabel">User ID</label>
                      <input
                        type="text"
                        className="techInput"
                        placeholder="e.g. da3be79b-d6a7-4ba0-9c0a-..."
                        value={dispatchForm.userId}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, userId: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  <div className="formGroup">
                    <label className="formLabel">Notification Title</label>
                    <input
                      type="text"
                      className="techInput"
                      placeholder="e.g. Feature Update or Support Reply"
                      value={dispatchForm.title}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="formGroup">
                    <label className="formLabel">Message Body</label>
                    <textarea
                      className="techTextarea"
                      placeholder="Enter message for user..."
                      value={dispatchForm.message}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, message: e.target.value })}
                      required
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.85rem" }}>
                    <button type="submit" className="submitBtn">
                      Dispatch Notification →
                    </button>
                  </div>
                </form>
              </div>

              {/* RIGHT: SENT NOTIFICATIONS & BROADCAST HISTORY */}
              <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", borderRadius: "var(--r-md)", padding: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-pure)" }}>
                    Broadcast & Message History ({replies.length})
                  </div>
                  <span className="countChip">{replies.length} Sent</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", maxHeight: "480px", overflowY: "auto" }}>
                  {replies.length === 0 ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.74rem" }}>
                      No notifications dispatched yet.
                    </div>
                  ) : (
                    replies.map((r) => (
                      <div key={r.id} className="responseItem">
                        <div className="responseItemHead">
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                            {r.userId === 'all' ? (
                              <span className="badgePill suggest">All Users (Global)</span>
                            ) : (
                              <span className="badgePill active">User: {r.userId.substring(0, 10)}...</span>
                            )}
                            <span style={{ fontWeight: 600, color: "var(--text-pure)", fontSize: "0.74rem" }}>
                              {r.title || "Notification"}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            <span className="responseDate">{r.date}</span>
                            <button
                              type="button"
                              className="delReplyBtn"
                              onClick={() => handleDeleteReply(r.id)}
                              title="Delete notification"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        <p className="responseText" style={{ marginTop: "0.25rem" }}>{r.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW: SYSTEM STATUS */}
        {/* ========================================================================= */}
        {activeTab === "status" && (
          <div>
            <div className="viewHeader">
              <div>
                <h1 className="viewTitle">System Telemetry</h1>
                <p className="viewSubtitle">Real-time infrastructure health and edge telemetry</p>
              </div>
            </div>

            <div className="metricsGrid">
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
                  <span>12ms</span>
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

      {/* FLOATING CONTEXT MENU FOR SUBMISSION RIGHT-CLICK */}
      {contextMenu && (
        <div
          style={{
            position: "fixed",
            top: contextMenu.y,
            left: contextMenu.x,
            background: "#161619",
            border: "1px solid var(--border-medium)",
            borderRadius: "var(--r-sm)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.7)",
            zIndex: 9999,
            padding: "0.25rem"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="dotsDropdownItem"
            style={{ color: "var(--acc-rose)", cursor: "pointer", borderRadius: "3px" }}
            onClick={() => {
              handleDeleteSubmission(contextMenu.subId);
              setContextMenu(null);
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>Delete this submission</span>
          </div>
        </div>
      )}

      {/* MUTE USER MODAL */}
      {muteModalTargetUser && (
        <div className="modalBackdrop" onClick={() => setMuteModalTargetUser(null)}>
          <div className="modalWindow" onClick={(e) => e.stopPropagation()}>
            <div className="modalTitle">Mute User Feedback</div>
            <div className="modalSub">
              Restrict submissions for <code style={{ color: "var(--text-pure)" }}>{muteModalTargetUser.userId}</code>
            </div>

            <div style={{ marginBottom: "0.85rem" }}>
              <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                Restriction Duration
              </label>
              <CustomSelect
                options={[
                  { label: "1 Day", value: "1" },
                  { label: "3 Days", value: "3" },
                  { label: "7 Days", value: "7" },
                  { label: "30 Days", value: "30" },
                  { label: "Permanent", value: "permanent" },
                ]}
                value={muteModalDuration}
                onChange={(val) => setMuteModalDuration(val)}
              />
            </div>

            <div style={{ marginBottom: "1.2rem" }}>
              <label style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem", fontWeight: 600 }}>
                Restriction Reason
              </label>
              <CustomSelect
                options={[
                  { label: "Spam & Flooding", value: "Spam & Flooding" },
                  { label: "Abusive Language / Toxic Behavior", value: "Abusive Language / Toxic Behavior" },
                  { label: "False Bug Reports", value: "False Bug Reports" },
                  { label: "Misuse of Support Channel", value: "Misuse of Support Channel" },
                  { label: "Terms of Service Violation", value: "Terms of Service Violation" },
                  { label: "Custom Reason", value: "Custom Reason" },
                ]}
                value={muteModalReason}
                onChange={(val) => setMuteModalReason(val)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="cancelBtn"
                onClick={() => setMuteModalTargetUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="submitBtn"
                onClick={handleConfirmMuteModal}
              >
                Confirm Mute
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
