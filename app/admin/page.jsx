"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import "./admin.css";

// Custom Dropdown Select Component
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
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}><polyline points="6 9 12 15 18 9"></polyline></svg>
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

  // Navigation tab
  const [activeTab, setActiveTab] = useState("feedback");

  // Database State
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [mutes, setMutes] = useState({});
  const [replies, setReplies] = useState([]);
  const [loadingDb, setLoadingDb] = useState(true);

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

  // Global click listener to close context menu & dropdowns
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
      setActiveMenuUserId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
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

  // Handle Delete Reply
  const handleDeleteReply = async (replyId) => {
    const confirmed = window.confirm("Delete this notification?");
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
          message: "",
        });
      }
    } catch (err) {
      console.error("Dispatch error:", err);
    }
  };

  // Group items by User ID
  const usersGrouped = {};
  feedbackItems.forEach((item) => {
    if (!usersGrouped[item.userId]) {
      usersGrouped[item.userId] = {
        userId: item.userId,
        email: item.email && item.email.includes('@') ? item.email : 'none',
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
    usersGrouped[item.userId].items.push(item);
  });

  const userProfilesList = Object.values(usersGrouped);

  // Statistics calculation for the Overview Segment Bar
  const totalReviews = feedbackItems.filter(i => i.type === 'review').length;
  const totalSuggestions = feedbackItems.filter(i => i.type === 'suggest').length;
  const totalBugReports = feedbackItems.filter(i => i.type === 'report' || i.type === 'bug').length;
  const totalSubmissionsCount = feedbackItems.length || 1;

  const reviewPct = (totalReviews / totalSubmissionsCount) * 100;
  const suggestPct = (totalSuggestions / totalSubmissionsCount) * 100;
  const reportPct = (totalBugReports / totalSubmissionsCount) * 100;

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

    return matchesSearch;
  });

  if (status === "loading" || loadingDb) {
    return (
      <div className="appShell" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.8rem", fontFamily: "var(--font-mono)" }}>Connecting to database...</p>
      </div>
    );
  }

  if (!session) return null;
  const user = session.user;

  return (
    <div className="appShell">

      {/* 1. SIDEBAR */}
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
              <input type="text" className="searchInput" placeholder="Search portal..." />
            </div>
            <span className="searchKbd">⌘F</span>
          </div>

          <div className="navGroupLabel">Essentials</div>
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
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            v4.2.0
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
                <h1 className="viewTitle">User Profiles & Telemetry Database</h1>
                <p className="viewSubtitle">Real-time telemetry, chain submissions, attached media, and restriction controls</p>
              </div>
            </div>

            {/* OVERVIEW SEGMENT BAR (MATCHING REFERENCE BUDGET BREAKDOWN STYLE) */}
            <div className="overviewSegmentBar">
              <div className="segmentBarHeader">
                <span className="segmentBarTitle">Activity Breakdown</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {feedbackItems.length} Total Records
                </span>
              </div>

              <div className="segmentTilesRow">
                <div className="segmentTile">
                  <span className="segmentTileLabel">Active Users</span>
                  <span className="segmentTileValue">{userProfilesList.length}</span>
                </div>
                <div className="segmentTile">
                  <span className="segmentTileLabel" style={{ color: "var(--accent-amber)" }}>Reviews</span>
                  <span className="segmentTileValue">{totalReviews}</span>
                </div>
                <div className="segmentTile">
                  <span className="segmentTileLabel" style={{ color: "var(--accent-purple)" }}>Suggestions</span>
                  <span className="segmentTileValue">{totalSuggestions}</span>
                </div>
                <div className="segmentTile">
                  <span className="segmentTileLabel" style={{ color: "var(--accent-rose)" }}>Bug Reports</span>
                  <span className="segmentTileValue">{totalBugReports}</span>
                </div>
              </div>

              {/* MULTI-SEGMENT PROGRESS BAR */}
              <div className="segmentMultiProgress">
                <div className="progressSlice" style={{ width: `${reviewPct}%`, backgroundColor: "var(--accent-amber)" }} />
                <div className="progressSlice" style={{ width: `${suggestPct}%`, backgroundColor: "var(--accent-purple)" }} />
                <div className="progressSlice" style={{ width: `${reportPct}%`, backgroundColor: "var(--accent-rose)" }} />
              </div>
            </div>

            {/* FILTER & SEARCH ROW */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.8rem" }}>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {[
                  { id: "all", label: `All Users (${userProfilesList.length})` },
                  { id: "lapath", label: "LaPath" },
                  { id: "kliner", label: "KLiner" },
                  { id: "bug", label: "Bug Reports" },
                  { id: "feature", label: "Suggestions" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`pillChip ${feedbackFilter === tab.id ? "active" : ""}`}
                    style={{ cursor: "pointer", borderRadius: "var(--radius-pill)", padding: "0.35rem 0.8rem", fontSize: "0.74rem" }}
                    onClick={() => setFeedbackFilter(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ width: "260px" }}>
                <input
                  type="text"
                  className="pillInput"
                  placeholder="Search by ID, email, specs..."
                  value={feedbackSearchQuery}
                  onChange={(e) => setFeedbackSearchQuery(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
            </div>

            {/* UNIFIED USER PROFILE CARDS FEED */}
            <div className="historyFeed">
              {filteredUserProfiles.length === 0 ? (
                <div className="userMasterCard" style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-muted)" }}>
                  No user records match your search filter.
                </div>
              ) : (
                filteredUserProfiles.map((profile) => {
                  const isExpanded = expandedUserId === profile.userId;
                  const isSpecsExpanded = expandedSpecsMap[profile.userId] || false;
                  const userMute = mutes[profile.userId];
                  const isMuted = userMute && !userMute.shadowBanned && new Date(userMute.bannedUntil).getTime() > Date.now();
                  const isShadowBanned = userMute && userMute.shadowBanned;
                  const userReplies = replies.filter((r) => r.userId === profile.userId || r.userId === 'all');

                  return (
                    <div
                      key={profile.userId}
                      className={`userMasterCard ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => setExpandedUserId(isExpanded ? null : profile.userId)}
                    >
                      {/* CARD HEADER */}
                      <div className="userCardHeader">
                        <div className="userIdentBlock">
                          <span className="userIdentCode">{profile.userId}</span>
                          {profile.email !== 'none' && (
                            <span className="userIdentEmail">({profile.email})</span>
                          )}
                          <span className="userIdentDate">• Installed: {profile.installDate || 'Recent'}</span>
                        </div>

                        <div className="userChipsRow">
                          {/* Status Chip */}
                          {isShadowBanned ? (
                            <span className="pillChip shadow">
                              <span className="dotIndicator" />
                              <span>Shadow Banned</span>
                            </span>
                          ) : isMuted ? (
                            <span className="pillChip muted">
                              <span className="dotIndicator" />
                              <span>Muted</span>
                            </span>
                          ) : (
                            <span className="pillChip active">
                              <span className="dotIndicator" />
                              <span>Active</span>
                            </span>
                          )}

                          {/* Submissions Count Chip */}
                          <span className="pillChip">
                            {profile.items.length} {profile.items.length === 1 ? 'submission' : 'submissions'}
                          </span>

                          {/* 3-DOTS ACTION MENU */}
                          <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className="dotsMenuBtn"
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
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
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
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                                      <span>Mute User...</span>
                                    </div>
                                    <div
                                      className="dotsDropdownItem"
                                      onClick={() => {
                                        handleShadowBanUser(profile.userId);
                                        setActiveMenuUserId(null);
                                      }}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.8 }}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                      <span>Shadow Ban User</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* EXPANDED CONTENT VIEW (SMOOTH TRANSITION GRID) */}
                      <div className={`accordionContent ${isExpanded ? 'isExpanded' : ''}`}>
                        <div className="accordionInner">
                          <div className="expandedSplitGrid" onClick={(e) => e.stopPropagation()}>
                            
                            {/* LEFT COLUMN: TIMELINE SUBMISSIONS */}
                            <div className="splitColumn">
                              <div className="columnHeader">
                                <span className="columnHeaderTitle">Submissions Chain</span>
                                <span className="columnHeaderCount">{profile.items.length} Total</span>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                                {profile.items.map((sub, idx) => {
                                  const isSubExpanded = expandedSubMap[sub.id] || false;
                                  const itemType = sub.type === 'review' ? 'review' : sub.type === 'suggest' ? 'suggest' : 'report';
                                  const cleanTitle = sub.type === 'review' ? 'Review' : sub.type === 'suggest' ? 'Feature Suggestion' : 'Bug Report';
                                  const hasMediaAttached = Boolean(sub.hasMedia || sub.telegramMediaUrl);

                                  return (
                                    <div
                                      key={sub.id}
                                      className="timelineRow"
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setContextMenu({ x: e.clientX, y: e.clientY, subId: sub.id });
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedSubMap({ ...expandedSubMap, [sub.id]: !isSubExpanded });
                                      }}
                                    >
                                      {/* ROW LINE 1 */}
                                      <div className="timelineRowTop">
                                        <div className="timelineRowLeft">
                                          <span className={`timelineTimeTag ${itemType}`}>
                                            #{profile.items.length - idx}
                                          </span>
                                          <span className="timelineTitle">{cleanTitle}</span>
                                        </div>

                                        <div className="timelineRowRight">
                                          {hasMediaAttached && (
                                            <span className="pillChip media">📎 Media</span>
                                          )}
                                          {sub.type === 'review' && sub.rating && (
                                            <span className="pillChip stars">
                                              {"★".repeat(sub.rating)} {sub.rating}/5
                                            </span>
                                          )}
                                          <span className="pillChip">{sub.extensionName}</span>
                                          <span className="timelineDate">{sub.date}</span>
                                        </div>
                                      </div>

                                      {/* ROW LINE 2 (SMOOTH INSET BODY) */}
                                      <div className={`accordionContent ${isSubExpanded ? 'isExpanded' : ''}`}>
                                        <div className="accordionInner">
                                          <div className="timelineBodyInset">
                                            <p>{sub.message || "(No message body written)"}</p>
                                            {sub.telegramMediaUrl ? (
                                              <Link
                                                href={sub.telegramMediaUrl}
                                                target="_blank"
                                                className="telegramMediaLink"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <span>View Attached Media in Telegram</span> ↗
                                              </Link>
                                            ) : sub.hasMedia ? (
                                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.35rem" }}>
                                                📎 Media attached (saved in Telegram Bot channel)
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

                            {/* RIGHT COLUMN: HARDWARE SPEC & DIRECT MESSAGES */}
                            <div className="splitColumn">
                              
                              {/* HARDWARE SPECS BOX (ACCORDION) */}
                              <div
                                className="specsBoxContainer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedSpecsMap({ ...expandedSpecsMap, [profile.userId]: !isSpecsExpanded });
                                }}
                              >
                                <div className="specsBoxHeader">
                                  <span className="specsBoxTitle">
                                    <span>PC Telemetry & Specs</span>
                                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{isSpecsExpanded ? '▴' : '▾'}</span>
                                  </span>
                                  <span className="specsBoxSub">
                                    OS: {profile.os} • AE {profile.appVersion}
                                  </span>
                                </div>

                                <div className={`accordionContent ${isSpecsExpanded ? 'isExpanded' : ''}`}>
                                  <div className="accordionInner">
                                    <div className="specsDetailGrid">
                                      <div className="specRow">
                                        <span className="specLabel">GPU / CPU</span>
                                        <span className="specValue">{profile.hardware}</span>
                                      </div>
                                      <div className="specRow">
                                        <span className="specLabel">Telemetry</span>
                                        <span className="specValue">{profile.stats}</span>
                                      </div>
                                      <div className="specRow">
                                        <span className="specLabel">Installed</span>
                                        <span className="specValue">{profile.daysInstalled}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* DIRECT RESPONSES HEADER */}
                              <div className="columnHeader" style={{ marginTop: "0.4rem" }}>
                                <span className="columnHeaderTitle">Direct Responses</span>
                                <span className="columnHeaderCount">{userReplies.length} Sent</span>
                              </div>

                              {/* DIRECT RESPONSES FEED */}
                              <div className="directResponsesList">
                                {userReplies.length === 0 ? (
                                  <div style={{
                                    backgroundColor: "var(--bg-card-inner)",
                                    border: "1px solid var(--border-subtle)",
                                    borderRadius: "var(--radius-md)",
                                    padding: "0.9rem",
                                    textAlign: "center",
                                    color: "var(--text-muted)",
                                    fontSize: "0.74rem"
                                  }}>
                                    No direct responses sent to this user yet.
                                  </div>
                                ) : (
                                  userReplies.map((r) => (
                                    <div key={r.id} className="directResponseBubble">
                                      <div className="directResponseHeader">
                                        <span className="directResponseSender">
                                          <span className="dotIndicator" style={{ backgroundColor: "var(--accent-sky)" }} />
                                          <span>Support Team</span>
                                        </span>
                                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                          <span className="directResponseDate">{r.date}</span>
                                          <button
                                            type="button"
                                            className="deleteBtn"
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
                                      <p className="directResponseText">{r.message}</p>
                                    </div>
                                  ))
                                )}
                              </div>

                              {/* ACTION BUTTON */}
                              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.4rem" }}>
                                <button
                                  type="button"
                                  className="replyUserActionBtn"
                                  onClick={() => {
                                    setActiveTab("dispatch");
                                    setDispatchForm({
                                      ...dispatchForm,
                                      category: "personal",
                                      userId: profile.userId
                                    });
                                  }}
                                >
                                  <span>Reply to User</span>
                                  <span>→</span>
                                </button>
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
        )}

        {/* ========================================================================= */}
        {/* VIEW: DISPATCH NOTIFICATION */}
        {/* ========================================================================= */}
        {activeTab === "dispatch" && (
          <div style={{ maxWidth: "680px" }}>
            <div className="viewHeader">
              <div>
                <h1 className="viewTitle">Broadcast Notification</h1>
                <p className="viewSubtitle">Dispatch messages directly into After Effects notification centers</p>
              </div>
            </div>

            <div className="cleanPanel" style={{ background: "var(--bg-card)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-lg)", padding: "1.5rem" }}>
              {dispatchSuccess && (
                <div style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "var(--accent-green-bg)",
                  border: "1px solid var(--accent-green-border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--accent-green)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  marginBottom: "1.2rem"
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
                      className="pillInput"
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
                    className="pillInput"
                    placeholder="e.g. Feature Update or Feedback Response"
                    value={dispatchForm.title}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="formGroup">
                  <label className="formLabel">Message Body</label>
                  <textarea
                    className="pillTextarea"
                    placeholder="Enter the message for the user..."
                    value={dispatchForm.message}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, message: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                  <button type="submit" className="submitPillBtn">
                    Dispatch Notification →
                  </button>
                </div>
              </form>
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
                <h1 className="viewTitle">System Status</h1>
                <p className="viewSubtitle">Real-time health telemetry across edge infrastructure</p>
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
                  <span>14ms</span>
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
            background: "#1c1d25",
            border: "1px solid var(--border-medium)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            zIndex: 9999,
            padding: "0.3rem"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="dotsDropdownItem"
            style={{ color: "var(--accent-rose)", cursor: "pointer", borderRadius: "4px" }}
            onClick={() => {
              handleDeleteSubmission(contextMenu.subId);
              setContextMenu(null);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
              Restrict submissions for <code style={{ color: "var(--text-primary)" }}>{muteModalTargetUser.userId}</code>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>
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

            <div style={{ marginBottom: "1.4rem" }}>
              <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                className="cancelPillBtn"
                onClick={() => setMuteModalTargetUser(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="submitPillBtn"
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
