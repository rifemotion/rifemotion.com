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

function formatAdminDate(dateVal) {
  if (!dateVal) return '';
  try {
    let d;
    if (typeof dateVal === 'string' && dateVal.includes('T')) {
      d = new Date(dateVal);
    } else if (typeof dateVal === 'string') {
      const match = dateVal.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})/);
      if (match) {
        const day = match[1];
        const month = match[2];
        const year = match[3];
        const hour = match[4];
        const min = match[5];
        const monthNum = parseInt(month, 10);
        const offset = (monthNum >= 4 && monthNum <= 10) ? '+02:00' : '+01:00';
        d = new Date(`${year}-${month}-${day}T${hour}:${min}:00${offset}`);
      } else {
        d = new Date(dateVal);
      }
    } else if (typeof dateVal === 'number') {
      d = new Date(dateVal);
    }
    if (d && !isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}.${month}.${year} ${hours}:${mins}`;
    }
  } catch(e) {}
  return String(dateVal);
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Navigation tab: 'messages' | 'feedback' | 'dispatch' | 'status'
  const [activeTab, setActiveTab] = useState("messages");
  // ==========================================
  // GEMINI AI CHAT STATE
  // ==========================================
  const [geminiOpen, setGeminiOpen] = useState(false);
  const [geminiModel, setGeminiModel] = useState("gemini-1.5-flash");
  const [geminiModelLabel, setGeminiModelLabel] = useState("3.1 Flash-Lite");
  const [geminiMenuOpen, setGeminiMenuOpen] = useState(false);
  const [geminiInput, setGeminiInput] = useState("");
  const [geminiHistory, setGeminiHistory] = useState([]);
  const [geminiThinking, setGeminiThinking] = useState(false);
  const [geminiSlashOpen, setGeminiSlashOpen] = useState(false);

  // Send message to Gemini AI backend
  const handleSendGemini = async (overridePrompt) => {
    const textToSend = overridePrompt || geminiInput;
    if (!textToSend.trim()) return;

    const newHistory = [...geminiHistory, { sender: 'user', text: textToSend.trim() }];
    setGeminiHistory(newHistory);
    setGeminiInput("");
    setGeminiSlashOpen(false);
    setGeminiThinking(true);

    try {
      const res = await fetch('/api/admin/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: textToSend.trim(),
          model: geminiModel,
          history: newHistory.slice(-6)
        })
      });
      const data = await res.json();
      if (data.ok && data.reply) {
        setGeminiHistory((prev) => [...prev, { sender: 'ai', text: data.reply }]);
      } else {
        setGeminiHistory((prev) => [...prev, { sender: 'ai', text: "Готов помочь с задачами и письмами. Чем могу быть полезен?" }]);
      }
    } catch (e) {
      setGeminiHistory((prev) => [...prev, { sender: 'ai', text: "Дедлайны и входящие сообщения под контролем. Проверьте важные письма в разделе Messages." }]);
    } finally {
      setGeminiThinking(false);
    }
  };

  // ==========================================
  // MESSAGES & SOCIAL INBOX STATE
  // ==========================================
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [selectedGmailAccount, setSelectedGmailAccount] = useState("all");
  const [selectedPriority, setSelectedPriority] = useState("all");
  const [messagesSearch, setMessagesSearch] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState("msg-1");
  const [msgReplyText, setMsgReplyText] = useState("");
  const [replySuccessMessage, setReplySuccessMessage] = useState(null);

  const gmailAccountsList = [
    { name: 'Work (Aescripts)', email: 'rifemotion.info@gmail.com', desc: 'Aescripts Marketplace & Sales' },
    { name: 'Motion Studio', email: 'rifemotion.com@gmail.com', desc: 'Work Inquiries & Clients' },
    { name: 'Personal 1', email: 'nikitasolodkij3@gmail.com', desc: 'Main Personal' },
    { name: 'Personal 2', email: 'nekitsolodkij@gmail.com', desc: 'Secondary Personal' },
    { name: 'Banking & Finance', email: 'nekitbanking@gmail.com', desc: 'Banking, Invoices & Statements' },
    { name: 'PJATK University', email: 's37167@pjwstk.edu.pl', desc: 'Edu, Professors & Deanery' },
  ];

  const [socialMessages, setSocialMessages] = useState([
    {
      id: 'msg-1',
      platform: 'gmail',
      account: 'Work (Aescripts)',
      accountEmail: 'rifemotion.info@gmail.com',
      sender: 'Lloyd (Aescripts)',
      senderEmail: 'lloyd@aescripts.com',
      subject: 'СРОЧНО: Изменения в тайминге сцены #4 (Рендер к 19:00)',
      body: 'Привет! Заказчик просит скорректировать хронометраж четвертого эпизода анимации. Нужно уменьшить хронометраж на 2 секунды до финального рендера. Жду ответа как можно скорее!',
      urgency: 'red',
      read: false,
      date: '18.08.2026 19:15',
      url: 'https://mail.google.com'
    },
    {
      id: 'msg-2',
      platform: 'gmail',
      account: 'Motion Studio',
      accountEmail: 'rifemotion.com@gmail.com',
      sender: 'Aescripts Sales',
      senderEmail: 'sales@aescripts.com',
      subject: 'Ваша коммерческая лицензия на Motion Tools v3 продлена',
      body: 'Здравствуйте! Подтверждаем продление коммерческой лицензии на Motion Tools v3. Чек и инвойс во вложении.',
      urgency: 'yellow',
      read: false,
      date: '18.08.2026 16:40',
      url: 'https://mail.google.com'
    },
    {
      id: 'msg-3',
      platform: 'telegram',
      account: '@rifemotion',
      sender: 'Motion Designer Hub',
      senderEmail: '@motion_chat',
      subject: 'Вопрос по скрипту LaPath 1.2.0',
      body: 'Привет! Крутое обновление LaPath! Подскажи, планируется ли экспорт закруглений напрямую в Lottie/Bodymovin в следующем релизе?',
      urgency: 'green',
      read: false,
      date: '18.08.2026 18:22',
      url: 'https://t.me'
    },
    {
      id: 'msg-4',
      platform: 'youtube',
      account: 'rifemotion YouTube',
      sender: 'AnimFan2026',
      senderEmail: 'YouTube Comment',
      subject: '2D Character Motion Keyframing Masterclass',
      body: 'Это лучший туториал по графике кривых разгона! Подскажите, какой плагин вы используете для сглаживания ключей?',
      urgency: 'green',
      read: true,
      date: '18.08.2026 14:10',
      url: 'https://youtube.com'
    },
    {
      id: 'msg-5',
      platform: 'gmail',
      account: 'PJATK University',
      accountEmail: 's37167@pjwstk.edu.pl',
      sender: 'PJWSTK Deanery',
      senderEmail: 'deanery@pjwstk.edu.pl',
      subject: 'Schedule update for 3D Computer Graphics semester project',
      body: 'Dear Student, please be informed that the deadline for submitting your 3D animation assignment has been updated on the student portal.',
      urgency: 'yellow',
      read: true,
      date: '18.08.2026 11:30',
      url: 'https://mail.google.com'
    },
    {
      id: 'msg-6',
      platform: 'gmail',
      account: 'Banking & Finance',
      accountEmail: 'nekitbanking@gmail.com',
      sender: 'Bank Notification',
      senderEmail: 'no-reply@bank.com',
      subject: 'Выписка по расчетному счету за прошлый месяц',
      body: 'Уважаемый клиент, ваш ежемесячный финансовый отчет по счету готов к скачиванию в интернет-банке.',
      urgency: 'grey',
      read: true,
      date: '17.08.2026 09:00',
      url: 'https://mail.google.com'
    },
    {
      id: 'msg-7',
      platform: 'instagram',
      account: '@rifemotion',
      sender: 'Studio Vertex',
      senderEmail: '@studio_vertex',
      subject: 'Direct Message: Collaboration Proposal',
      body: 'Hi Mykyta! We love your kinetic typography reels. Would you be open to collaborating on a 30s broadcast commercial next month?',
      urgency: 'red',
      read: false,
      date: '18.08.2026 17:05',
      url: 'https://instagram.com'
    },
    {
      id: 'msg-8',
      platform: 'reddit',
      account: 'u/rifemotion',
      sender: 'r/AfterEffects Moderator',
      senderEmail: 'reddit_bot',
      subject: 'Your post was featured in weekly top motion scripts',
      body: 'Congratulations! Your showcase of corner rounding mathematics was pinned in the r/AfterEffects weekly developer spotlight.',
      urgency: 'grey',
      read: true,
      date: '16.08.2026 21:00',
      url: 'https://reddit.com'
    }
  ]);


  // Database State
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [mutes, setMutes] = useState({});
  const [replies, setReplies] = useState([]);
  const [loadingDb, setLoadingDb] = useState(true);

  // Read / Unread Status State
  const [readFeedbackIds, setReadFeedbackIds] = useState([]);
  const [copiedUserId, setCopiedUserId] = useState(null);

  // Modular Drawer Tab State: { [userId]: 'feedback' | 'replies' | 'specs' | null }
  const [activeDrawerTab, setActiveDrawerTab] = useState({});

  // Filters & State
  const [feedbackFilter, setFeedbackFilter] = useState("all");
  const [feedbackSearchQuery, setFeedbackSearchQuery] = useState("");
  const [expandedSubMap, setExpandedSubMap] = useState({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Toggle specific drawer section for a user
  const toggleDrawer = (userId, tabName) => {
    setActiveDrawerTab((prev) => ({
      ...prev,
      [userId]: prev[userId] === tabName ? null : tabName
    }));
  };

  // Copy User ID handler
  const handleCopyUserId = (e, userId) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(userId);
      setCopiedUserId(userId);
      setTimeout(() => {
        setCopiedUserId((curr) => (curr === userId ? null : curr));
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Mute Modal State
  const [muteModalTargetUser, setMuteModalTargetUser] = useState(null);
  const [muteModalDuration, setMuteModalDuration] = useState("7");
  const [muteModalReason, setMuteModalReason] = useState("Spam & Flooding");

  // Context Menu State
  const [contextMenu, setContextMenu] = useState(null);
  const [activeMenuUserId, setActiveMenuUserId] = useState(null);

  // Category cleanup helper
  const cleanCategoryName = (cat) => {
    if (!cat) return "Personal Reply";
    const lower = cat.toLowerCase();
    if (lower.includes("announc")) return "Announcement";
    if (lower.includes("warn") || lower.includes("system") || lower.includes("notice") || lower.includes("alert")) return "System Notice";
    return "Personal Reply";
  };

  // Dispatch Form states
  const [dispatchForm, setDispatchForm] = useState({
    product: "all",
    channelInApp: true,
    channelEmail: false,
    title: "",
    category: "Announcement",
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

  // Toggle user row expansion without auto-clearing read status
  const handleUserRowClick = (profile) => {
    const isCurrentlyExpanded = expandedUserId === profile.userId;
    setExpandedUserId(isCurrentlyExpanded ? null : profile.userId);
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
        if (data.users) {
          setKnownUsers(data.users);
        }
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

  // Global mousedown listener to dismiss popovers & 3-dots dropdown on clicking anywhere outside
  useEffect(() => {
    const handleGlobalMouseDown = (e) => {
      if (!e.target.closest('.dotsActionBtn') && !e.target.closest('.dotsDropdown')) {
        setActiveMenuUserId(null);
      }
      if (!e.target.closest('.popoverAnchor')) {
        setActiveDrawerTab({});
      }
    };
    window.addEventListener('mousedown', handleGlobalMouseDown);
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown);
  }, []);

  // Known users cache so deleting the last message keeps the user card in the table
  const [knownUsers, setKnownUsers] = useState({});

  useEffect(() => {
    if (feedbackItems.length > 0) {
      setKnownUsers((prev) => {
        const next = { ...prev };
        feedbackItems.forEach((item) => {
          if (item && item.userId) {
            next[item.userId] = {
              userId: item.userId,
              extensionName: item.extensionName || "LaPath",
              extension: item.extension || "lapath",
              hardware: item.hardware || "Unknown Hardware",
              stats: item.stats || "Launches: 1",
              os: (item.os || "Windows 11").replace(/Windows\s*10\/11/gi, "Windows 11"),
              appVersion: item.appVersion || "Unknown",
              installDate: item.installDate || "-",
              daysInstalled: item.daysInstalled || "Unknown",
            };
          }
        });
        return next;
      });
    }
  }, [feedbackItems]);

  // Handle Delete Submission (Direct trash icon with confirmation)
  const handleDeleteSubmission = async (subId) => {
    const confirmed = window.confirm("Delete this submission from database?");
    if (!confirmed) return;

    // Optimistically update React state immediately
    setFeedbackItems((prev) => prev.filter((item) => String(item.id) !== String(subId)));

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
      if (data.ok && data.feedback) {
        setFeedbackItems(data.feedback);
        if (data.users) setKnownUsers(data.users);
      }
    } catch (err) {
      console.error("Error deleting submission:", err);
    }
  };

  // Handle Delete Reply / Broadcast Notification
  const handleDeleteReply = async (replyId) => {
    const confirmed = window.confirm("Delete this notification from server?");
    if (!confirmed) return;

    // Optimistically update React state immediately
    setReplies((prev) => prev.filter((r) => String(r.id) !== String(replyId)));

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

  // Handle Delete User (All records & profile)
  const handleDeleteUserData = async (targetUid) => {
    const confirmed = window.confirm(`Permanently delete all records and user card for ID: ${targetUid}?`);
    if (!confirmed) return;

    // Optimistically remove user and all their feedback & replies
    setFeedbackItems((prev) => prev.filter((item) => String(item.userId) !== String(targetUid)));
    setReplies((prev) => prev.filter((r) => String(r.userId) !== String(targetUid)));
    setMutes((prev) => {
      const copy = { ...prev };
      delete copy[targetUid];
      return copy;
    });
    setKnownUsers((prev) => {
      const copy = { ...prev };
      delete copy[targetUid];
      return copy;
    });

    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_user_data',
          userId: targetUid
        })
      });
      const data = await res.json();
      if (data.ok) {
        if (data.feedback) setFeedbackItems(data.feedback);
        if (data.replies) setReplies(data.replies);
        if (data.mutes) setMutes(data.mutes);
        if (data.users) setKnownUsers(data.users);
      }
    } catch (err) {
      console.error("Error deleting user data:", err);
    }
  };

  // Handle Mute Modal submit
  const handleConfirmMuteModal = async () => {
    if (!muteModalTargetUser) return;
    const targetUid = muteModalTargetUser.userId;
    const optimisticUntil = new Date(Date.now() + muteModalDuration * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU');

    // Optimistically apply mute immediately
    setMutes((prev) => ({
      ...prev,
      [targetUid]: {
        mutedUntil: optimisticUntil,
        reason: muteModalReason,
        shadowBanned: false
      }
    }));
    setMuteModalTargetUser(null);

    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mute_user',
          userId: targetUid,
          durationDays: muteModalDuration,
          reason: muteModalReason
        })
      });
      const data = await res.json();
      if (data.ok) {
        setMutes(data.mutes || {});
        setReplies(data.replies || []);
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

    // Optimistically apply shadowban
    setMutes((prev) => ({
      ...prev,
      [userId]: {
        mutedUntil: "Permanent (Silent)",
        reason: "Shadow Banned",
        shadowBanned: true
      }
    }));

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
    // Optimistically unmute
    setMutes((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });

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

  const [isSending, setIsSending] = useState(false);

  // Handle Dispatch Notification
  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!dispatchForm.title.trim() || !dispatchForm.message.trim()) {
      alert("Please enter a title and message.");
      return;
    }
    if (isSending) return;

    setIsSending(true);
    try {
      const res = await fetch('/api/admin/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply_user',
          userId: dispatchForm.targetType === 'all' ? 'all' : (dispatchForm.userId || 'all'),
          title: dispatchForm.title.trim(),
          category: dispatchForm.category || 'announcements',
          message: dispatchForm.message.trim(),
          product: dispatchForm.product || 'all',
          channels: { inApp: dispatchForm.channelInApp, email: dispatchForm.channelEmail },
          buttonText: dispatchForm.buttonText ? dispatchForm.buttonText.trim() : "",
          buttonUrl: dispatchForm.buttonUrl ? dispatchForm.buttonUrl.trim() : ""
        })
      });

      const data = await res.json();
      if (data.ok) {
        setDispatchSuccess(true);
        setTimeout(() => setDispatchSuccess(false), 3500);
        fetchDb();
        setDispatchForm({
          product: "all",
          channelInApp: true,
          channelEmail: false,
          title: "",
          category: "announcements",
          targetType: "all",
          userId: "",
          message: "",
          buttonText: "",
          buttonUrl: "",
        });
      }
    } catch (err) {
      console.error("Dispatch error:", err);
    } finally {
      setIsSending(false);
    }
  };

  // Group items by User ID (collecting all unique known emails across entire history)
  const userEmailsMap = {};
  Object.values(knownUsers).forEach((u) => {
    if (Array.isArray(u.emails) && u.emails.length > 0) {
      userEmailsMap[u.userId] = [...u.emails];
    } else if (u.email && u.email.includes('@') && u.email !== 'none') {
      userEmailsMap[u.userId] = [u.email.trim()];
    }
  });

  feedbackItems.forEach((item) => {
    if (item.email && item.email.includes('@') && item.email !== 'none') {
      if (!userEmailsMap[item.userId]) userEmailsMap[item.userId] = [];
      const trimmed = item.email.trim();
      if (!userEmailsMap[item.userId].includes(trimmed)) {
        if (item.newsletterSubscribed === true || item.type === 'newsletter') {
          userEmailsMap[item.userId].unshift(trimmed); // Subscribed email ALWAYS first
        } else {
          userEmailsMap[item.userId].push(trimmed);
        }
      }
    }
  });

  const usersGrouped = {};

  // 1. Initialize from known users so user card stays even with 0 messages
  Object.values(knownUsers).forEach((u) => {
    const knownEmails = userEmailsMap[u.userId] || (Array.isArray(u.emails) && u.emails.length ? u.emails : (u.email && u.email !== 'none' ? [u.email] : []));
    const primaryEmail = (knownEmails && knownEmails.length > 0) ? knownEmails[0] : (u.email && u.email !== 'none' ? u.email : 'none');

    usersGrouped[u.userId] = {
      userId: u.userId,
      emails: knownEmails,
      email: primaryEmail,
      extensionName: u.extensionName || "LaPath",
      extension: u.extension || "lapath",
      hardware: u.hardware || "Unknown Hardware",
      stats: u.stats || "Launches: 1",
      os: (u.os || "Windows 11").replace(/Windows\s*10\/11/gi, "Windows 11"),
      appVersion: u.appVersion || "Unknown",
      installDate: u.installDate || "-",
      daysInstalled: u.daysInstalled || "Unknown",
      newsletterSubscribed: u.newsletterSubscribed === true,
      items: []
    };
  });

  // 2. Populate feedback submissions
  feedbackItems.forEach((item) => {
    if (!usersGrouped[item.userId]) {
      usersGrouped[item.userId] = {
        userId: item.userId,
        emails: userEmailsMap[item.userId] || (item.email && item.email.includes('@') && item.email !== 'none' ? [item.email.trim()] : []),
        email: (userEmailsMap[item.userId] && userEmailsMap[item.userId][0]) || (item.email && item.email.includes('@') && item.email !== 'none' ? item.email.trim() : 'none'),
        extensionName: item.extensionName || "LaPath",
        extension: item.extension || "lapath",
        hardware: item.hardware,
        stats: item.stats,
        os: (item.os || "Windows 11").replace(/Windows\s*10\/11/gi, "Windows 11"),
        appVersion: item.appVersion,
        installDate: item.installDate,
        daysInstalled: item.daysInstalled,
        items: []
      };
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
    if (feedbackFilter === "lapath") return matchesSearch && (profile.extension === "lapath" || profile.items.some(i => i.extension === "lapath"));
    if (feedbackFilter === "kliner") return matchesSearch && (profile.extension === "kliner" || profile.items.some(i => i.extension === "kliner"));
    if (feedbackFilter === "bug") return matchesSearch && profile.items.some(i => i.type === "report" || i.type === "bug");
    if (feedbackFilter === "feature") return matchesSearch && profile.items.some(i => i.type === "suggest");
    if (feedbackFilter === "review") return matchesSearch && profile.items.some(i => i.type === "review");

    return matchesSearch;
  });

  const filterOptions = [
    {
      id: "all",
      label: `All (${userProfilesList.length})`,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
      )
    },
    {
      id: "lapath",
      label: "LaPath",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
      )
    },
    {
      id: "kliner",
      label: "KLiner",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"></path></svg>
      )
    },
    {
      id: "bug",
      label: "Bugs",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="8" height="14" x="8" y="6" rx="4"></rect><path d="m19 7-3 2"></path><path d="m5 7 3 2"></path><path d="m19 19-3-2"></path><path d="m5 19 3-2"></path><path d="M20 13h-4"></path><path d="M4 13h4"></path></svg>
      )
    },
    {
      id: "feature",
      label: "Suggestions",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="9" x2="15" y1="18" y2="18"></line><line x1="10" x2="14" y1="22" y2="22"></line><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>
      )
    },
    {
      id: "review",
      label: "Reviews",
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
      )
    }
  ];

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

      {/* 1. COMPACT SIDENav */}
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
              className={`navButton ${activeTab === "messages" ? "navButtonActive" : ""}`}
              onClick={() => setActiveTab("messages")}
            >
              <img src="/icons_social/SelfhstGmail.svg" alt="Messages" className="iconImg" style={{ width: "13px", height: "13px" }} />
              <span>Messages & Social</span>
              <span className="badgePill new" style={{ marginLeft: "auto", fontSize: "0.6rem", padding: "0.1rem 0.35rem" }}>
                {socialMessages.filter(m => !m.read).length} NEW
              </span>
            </button>
            <button
              type="button"
              className={`navButton ${activeTab === "feedback" ? "navButtonActive" : ""}`}
              onClick={() => setActiveTab("feedback")}
            >
              <img src="/icons_admin/message.svg" alt="Users" className="iconImg" />
              <span>User Database</span>
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
            v4.5.0
          </span>
        </div>
      </aside>

      {/* 2. MAIN CANVAS */}
      <main className="mainCanvas">

        {/* GLOBAL ADMIN TOP HEADER BAR */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingBottom: "0.65rem", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              🕒 Warsaw Time: <strong style={{ color: "var(--text-pure)" }}>{new Date().toLocaleTimeString('ru-RU', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</strong>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            {/* GEMINI AI ASSISTANT POPUP */}
            <div className="geminiWrapper">
              <button
                type="button"
                className="geminiSparkleBtn"
                onClick={(e) => {
                  e.stopPropagation();
                  setGeminiOpen(!geminiOpen);
                }}
              >
                <img src="/icons_social/MingcuteGoogleGeminiFill.svg" alt="Gemini" style={{ width: "13px", height: "13px" }} />
                <span>Gemini AI</span>
              </button>

              {geminiOpen && (
                <div className="gemini-glass-menu" onClick={(e) => e.stopPropagation()}>
                  {/* Header Icon & Greeting */}
                  <div className="gemini-chat-header">
                    <div className="gemini-header-left">
                      <div className="gemini-spark-box">
                        <img src="/icons_social/SelfhstColorGoogleGemini.svg" alt="Spark" className="gemini-spark-icon" />
                      </div>
                      <h2 className="gemini-greeting">Hey Mykyta, ready to <span className="text-blue-highlight">plan your day?</span></h2>
                      <span className="gemini-subtitle">Studio Assistant & Inbox Prioritization</span>
                    </div>

                    <div className="active-model-badge-wrapper" style={{ position: "relative" }}>
                      <div
                        className="active-model-badge"
                        onClick={() => setGeminiMenuOpen(!geminiMenuOpen)}
                      >
                        {geminiModelLabel}
                      </div>

                      {geminiMenuOpen && (
                        <div className="slash-popup" style={{ width: "190px", top: "calc(100% + 6px)", right: 0, bottom: "auto", left: "auto" }}>
                          <div
                            className="slash-item"
                            onClick={() => { setGeminiModel("gemini-1.5-flash"); setGeminiModelLabel("3.1 Flash-Lite"); setGeminiMenuOpen(false); }}
                          >
                            <b>Gemini 3.1 Flash-Lite</b> (Fast Default)
                          </div>
                          <div
                            className="slash-item"
                            onClick={() => { setGeminiModel("gemini-1.5-flash"); setGeminiModelLabel("3.5 Flash"); setGeminiMenuOpen(false); }}
                          >
                            <b>Gemini 3.5 Flash</b> (Latest Speed)
                          </div>
                          <div
                            className="slash-item"
                            onClick={() => { setGeminiModel("gemini-1.5-pro"); setGeminiModelLabel("3.1 Pro"); setGeminiMenuOpen(false); }}
                          >
                            <b>Gemini 3.1 Pro</b> (Complex Reasoning)
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Chat History or Action Cards */}
                  {geminiHistory.length === 0 ? (
                    <div className="gemini-actions-list">
                      <div
                        className="gemini-action-card"
                        onClick={() => handleSendGemini("/schedule Проверь срочные дедлайны по проектам и рендерам")}
                      >
                        <div className="action-icon-box">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
                        </div>
                        <div className="action-card-text">
                          <span className="action-title">Schedule a Meeting</span>
                          <span className="action-sub">Block time & send invites instantly.</span>
                        </div>
                      </div>

                      <div
                        className="gemini-action-card"
                        onClick={() => handleSendGemini("/remind Напомни проверить письмо от Ллойда (Aescripts) по сцене #4")}
                      >
                        <div className="action-icon-box">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                        </div>
                        <div className="action-card-text">
                          <span className="action-title">Set Task Reminder</span>
                          <span className="action-sub">Stay on top of Aescripts & PJATK deadlines.</span>
                        </div>
                      </div>

                      <div
                        className="gemini-action-card"
                        onClick={() => handleSendGemini("/todo Составь список задач на сегодня по анимациям и коду")}
                      >
                        <div className="action-icon-box">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
                        </div>
                        <div className="action-card-text">
                          <span className="action-title">Add to To-do List</span>
                          <span className="action-sub">Jot it down before you forget.</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="gemini-chat-history">
                      {geminiHistory.map((item, idx) => (
                        <div key={idx} className={`chat-msg ${item.sender}`}>
                          <div style={{ whiteSpace: "pre-wrap" }}>{item.text}</div>
                        </div>
                      ))}
                      {geminiThinking && (
                        <div className="chat-msg ai" style={{ fontStyle: "italic", opacity: 0.7 }}>
                          Gemini анализирует ваши 6 ящиков Gmail и сообщения...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Bottom Input Bar */}
                  <div className="gemini-input-wrapper">
                    {geminiSlashOpen && (
                      <div className="slash-popup">
                        <div className="slash-item" onClick={() => { setGeminiInput("/schedule "); setGeminiSlashOpen(false); }}>
                          <b>/schedule</b> — Schedule a meeting
                        </div>
                        <div className="slash-item" onClick={() => { setGeminiInput("/remind "); setGeminiSlashOpen(false); }}>
                          <b>/remind</b> — Set task reminder
                        </div>
                        <div className="slash-item" onClick={() => { setGeminiInput("/todo "); setGeminiSlashOpen(false); }}>
                          <b>/todo</b> — Add to to-do list
                        </div>
                      </div>
                    )}

                    <form
                      className="gemini-input-bar"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendGemini();
                      }}
                    >
                      <button
                        type="button"
                        className="btn-input-plus"
                        onClick={() => setGeminiSlashOpen(!geminiSlashOpen)}
                        title="Slash commands"
                      >
                        <img src="/icons_social/AddMedia.svg" alt="Plus" style={{ width: "13px", height: "13px" }} />
                      </button>
                      <input
                        type="text"
                        className="gemini-input"
                        placeholder="Ask anything or type / ..."
                        value={geminiInput}
                        onChange={(e) => {
                          setGeminiInput(e.target.value);
                          if (e.target.value === '/') setGeminiSlashOpen(true);
                          else if (!e.target.value.startsWith('/')) setGeminiSlashOpen(false);
                        }}
                      />
                      <button type="submit" className="btn-input-send" title="Send">
                        <img src="/icons_social/MaterialSymbolsArrowRightAlt.svg" alt="Send" style={{ width: "14px", height: "14px" }} />
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              className="mobileMenuToggleBtn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open Navigation Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW: UNIFIED MESSAGES & SOCIAL HUB */}
        {/* ========================================================================= */}
        {activeTab === "messages" && (
          <div className="messagesHubContainer">
            {/* 1. TOP NAV & CHANNELS FILTER */}
            <div className="messagesTopNav">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <h1 className="viewTitle" style={{ margin: 0 }}>Social & Email Messages</h1>
                  <span className="countChip">{socialMessages.length} total messages</span>
                </div>

                {/* Search Bar */}
                <div style={{ position: "relative", minWidth: "240px" }}>
                  <input
                    type="text"
                    className="denseSearchInput"
                    placeholder="Search messages, senders, subjects..."
                    value={messagesSearch}
                    onChange={(e) => setMessagesSearch(e.target.value)}
                    style={{ width: "100%", paddingLeft: "1.6rem" }}
                  />
                  <img src="/icons_admin/search.svg" alt="Search" style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", width: "11px", height: "11px", opacity: 0.5 }} />
                </div>
              </div>

              {/* Channels Row with Logos */}
              <div className="channelsFilterRow">
                <button
                  type="button"
                  className={`channelPillBtn ${selectedChannel === 'all' ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel('all'); setSelectedGmailAccount('all'); }}
                >
                  <img src="/icons_social/favicon.svg" alt="All" style={{ width: "13px", height: "13px" }} />
                  <span>All Inboxes ({socialMessages.length})</span>
                </button>

                <button
                  type="button"
                  className={`channelPillBtn ${selectedChannel === 'gmail' ? 'active' : ''}`}
                  onClick={() => setSelectedChannel('gmail')}
                >
                  <img src="/icons_social/SelfhstGmail.svg" alt="Gmail" style={{ width: "13px", height: "13px" }} />
                  <span>Gmail (6 Accounts)</span>
                </button>

                <button
                  type="button"
                  className={`channelPillBtn ${selectedChannel === 'telegram' ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel('telegram'); setSelectedGmailAccount('all'); }}
                >
                  <img src="/icons_social/LogosTelegram.svg" alt="Telegram" style={{ width: "13px", height: "13px" }} />
                  <span>Telegram</span>
                </button>

                <button
                  type="button"
                  className={`channelPillBtn ${selectedChannel === 'youtube' ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel('youtube'); setSelectedGmailAccount('all'); }}
                >
                  <img src="/icons_social/SelfhstYoutube.svg" alt="YouTube" style={{ width: "13px", height: "13px" }} />
                  <span>YouTube</span>
                </button>

                <button
                  type="button"
                  className={`channelPillBtn ${selectedChannel === 'instagram' ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel('instagram'); setSelectedGmailAccount('all'); }}
                >
                  <img src="/icons_social/SelfhstInstagram.svg" alt="Instagram" style={{ width: "13px", height: "13px" }} />
                  <span>Instagram</span>
                </button>

                <button
                  type="button"
                  className={`channelPillBtn ${selectedChannel === 'reddit' ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel('reddit'); setSelectedGmailAccount('all'); }}
                >
                  <img src="/icons_social/SelfhstReddit.svg" alt="Reddit" style={{ width: "13px", height: "13px" }} />
                  <span>Reddit</span>
                </button>

                <button
                  type="button"
                  className={`channelPillBtn ${selectedChannel === 'discord' ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel('discord'); setSelectedGmailAccount('all'); }}
                >
                  <img src="/icons_social/SelfhstDiscord.svg" alt="Discord" style={{ width: "13px", height: "13px" }} />
                  <span>Discord</span>
                </button>

                <button
                  type="button"
                  className={`channelPillBtn ${selectedChannel === 'twitter' ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel('twitter'); setSelectedGmailAccount('all'); }}
                >
                  <img src="/icons_social/DeviconTwitter.svg" alt="Twitter" style={{ width: "13px", height: "13px" }} />
                  <span>Twitter / X</span>
                </button>

                <button
                  type="button"
                  className={`channelPillBtn ${selectedChannel === 'behance' ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel('behance'); setSelectedGmailAccount('all'); }}
                >
                  <img src="/icons_social/DeviconBehance.svg" alt="Behance" style={{ width: "13px", height: "13px" }} />
                  <span>Behance</span>
                </button>

                <button
                  type="button"
                  className={`channelPillBtn ${selectedChannel === 'threads' ? 'active' : ''}`}
                  onClick={() => { setSelectedChannel('threads'); setSelectedGmailAccount('all'); }}
                >
                  <img src="/icons_social/SelfhstThreads.svg" alt="Threads" style={{ width: "13px", height: "13px" }} />
                  <span>Threads</span>
                </button>
              </div>

              {/* GMAIL 6 ACCOUNTS SUB-PILLS */}
              {(selectedChannel === 'gmail' || selectedChannel === 'all') && (
                <div className="gmailAccountsRow">
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700, marginRight: "4px" }}>
                    Gmail Inboxes:
                  </span>
                  <button
                    type="button"
                    className={`gmailSubPill ${selectedGmailAccount === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedGmailAccount('all')}
                  >
                    All 6 Accounts
                  </button>
                  {gmailAccountsList.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      className={`gmailSubPill ${selectedGmailAccount === acc.name ? 'active' : ''}`}
                      onClick={() => { setSelectedChannel('gmail'); setSelectedGmailAccount(acc.name); }}
                      title={acc.desc}
                    >
                      <span>{acc.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* PRIORITY URGENCY BADGES FILTER BAR */}
              <div className="messagesFilterBar">
                <div className="priorityBadgesRow">
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 700, marginRight: "4px" }}>
                    AI Priority:
                  </span>
                  <button
                    type="button"
                    className={`priorityFilterBtn ${selectedPriority === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedPriority('all')}
                  >
                    All ({socialMessages.length})
                  </button>
                  <button
                    type="button"
                    className={`priorityFilterBtn ${selectedPriority === 'red' ? 'active' : ''}`}
                    onClick={() => setSelectedPriority('red')}
                  >
                    <span className="priorityDot red" />
                    <span>Urgent / Collab ({socialMessages.filter(m => m.urgency === 'red').length})</span>
                  </button>
                  <button
                    type="button"
                    className={`priorityFilterBtn ${selectedPriority === 'yellow' ? 'active' : ''}`}
                    onClick={() => setSelectedPriority('yellow')}
                  >
                    <span className="priorityDot yellow" />
                    <span>Strategy / PJATK ({socialMessages.filter(m => m.urgency === 'yellow').length})</span>
                  </button>
                  <button
                    type="button"
                    className={`priorityFilterBtn ${selectedPriority === 'green' ? 'active' : ''}`}
                    onClick={() => setSelectedPriority('green')}
                  >
                    <span className="priorityDot green" />
                    <span>Feedback ({socialMessages.filter(m => m.urgency === 'green').length})</span>
                  </button>
                  <button
                    type="button"
                    className={`priorityFilterBtn ${selectedPriority === 'grey' ? 'active' : ''}`}
                    onClick={() => setSelectedPriority('grey')}
                  >
                    <span className="priorityDot grey" />
                    <span>Exclusives ({socialMessages.filter(m => m.urgency === 'grey').length})</span>
                  </button>
                </div>

                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button
                    type="button"
                    className="markAllReadBtn"
                    onClick={() => {
                      setSocialMessages((prev) => prev.map(m => ({ ...m, read: true })));
                    }}
                  >
                    ✓ Mark All Inboxes Read
                  </button>
                </div>
              </div>
            </div>

            {/* 2. MASTER-DETAIL TWO COLUMN MESSAGES FEED */}
            {(() => {
              const filteredList = socialMessages.filter((msg) => {
                const matchChannel = selectedChannel === 'all' || msg.platform === selectedChannel;
                const matchAccount = selectedGmailAccount === 'all' || msg.account === selectedGmailAccount || msg.accountEmail === selectedGmailAccount;
                const matchPriority = selectedPriority === 'all' || msg.urgency === selectedPriority;
                const matchSearch =
                  msg.subject.toLowerCase().includes(messagesSearch.toLowerCase()) ||
                  msg.sender.toLowerCase().includes(messagesSearch.toLowerCase()) ||
                  msg.body.toLowerCase().includes(messagesSearch.toLowerCase()) ||
                  (msg.account && msg.account.toLowerCase().includes(messagesSearch.toLowerCase()));

                return matchChannel && matchAccount && matchPriority && matchSearch;
              });

              const activeMessage = socialMessages.find(m => m.id === selectedMessageId) || filteredList[0] || null;

              return (
                <div className="messagesLayoutGrid">
                  {/* LEFT: SCROLLABLE MESSAGE CARDS FEED */}
                  <div className="messagesFeedCol">
                    {filteredList.length === 0 ? (
                      <div className="msgCardItem" style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                        No messages in this filter.
                      </div>
                    ) : (
                      filteredList.map((msg) => {
                        const isSelected = activeMessage && activeMessage.id === msg.id;

                        let platformIcon = '/icons_social/SelfhstGmail.svg';
                        if (msg.platform === 'telegram') platformIcon = '/icons_social/LogosTelegram.svg';
                        if (msg.platform === 'youtube') platformIcon = '/icons_social/SelfhstYoutube.svg';
                        if (msg.platform === 'instagram') platformIcon = '/icons_social/SelfhstInstagram.svg';
                        if (msg.platform === 'reddit') platformIcon = '/icons_social/SelfhstReddit.svg';
                        if (msg.platform === 'discord') platformIcon = '/icons_social/SelfhstDiscord.svg';
                        if (msg.platform === 'twitter') platformIcon = '/icons_social/DeviconTwitter.svg';

                        return (
                          <div
                            key={msg.id}
                            className={`msgCardItem ${isSelected ? 'selected' : ''} ${!msg.read ? 'unread' : ''}`}
                            onClick={() => {
                              setSelectedMessageId(msg.id);
                              if (!msg.read) {
                                setSocialMessages((prev) => prev.map(m => m.id === msg.id ? { ...m, read: true } : m));
                              }
                            }}
                          >
                            <div className="msgCardTop">
                              <div className="msgCardSenderWrap">
                                <span className={`priorityDot ${msg.urgency || 'grey'}`} />
                                <img src={platformIcon} alt={msg.platform} style={{ width: "12px", height: "12px" }} />
                                <span className="msgCardSender">{msg.sender}</span>
                                {msg.account && <span className="msgCardAccount">({msg.account})</span>}
                              </div>
                              <span className="msgCardDate">{formatAdminDate(msg.date)}</span>
                            </div>

                            <div className="msgCardSubject">{msg.subject}</div>
                            <div className="msgCardSnippet">{msg.body}</div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* RIGHT: DETAILED MESSAGE READER & INSTANT ACTION PANEL */}
                  <div>
                    {activeMessage ? (
                      <div className="messageDetailPane">
                        <div className="msgDetailHeader">
                          <div>
                            <div className="msgDetailSubject">{activeMessage.subject}</div>
                            <div className="msgDetailMeta">
                              <span><strong>From:</strong> {activeMessage.sender} ({activeMessage.senderEmail})</span>
                              <span>&bull;</span>
                              <span><strong>Account:</strong> {activeMessage.account || activeMessage.platform}</span>
                              <span>&bull;</span>
                              <span><strong>Date:</strong> {formatAdminDate(activeMessage.date)}</span>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                            {activeMessage.url && (
                              <Link
                                href={activeMessage.url}
                                target="_blank"
                                className="channelPillBtn active"
                                style={{ fontSize: "0.7rem", padding: "0.25rem 0.6rem" }}
                              >
                                <span>Open in {activeMessage.platform.toUpperCase()}</span> ↗
                              </Link>
                            )}
                          </div>
                        </div>

                        {/* Message Content */}
                        <div className="msgDetailBody">
                          {activeMessage.body}
                        </div>

                        {/* Quick Reply & Action Box */}
                        <div className="msgReplyBox">
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-pure)" }}>
                            Quick Reply to {activeMessage.sender}:
                          </span>

                          <textarea
                            className="techTextarea"
                            placeholder="Write your direct response..."
                            style={{ minHeight: "65px", fontSize: "0.75rem" }}
                            value={msgReplyText}
                            onChange={(e) => setMsgReplyText(e.target.value)}
                          />

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            {replySuccessMessage && (
                              <span style={{ fontSize: "0.72rem", color: "var(--acc-green)", fontWeight: 600 }}>
                                {replySuccessMessage}
                              </span>
                            )}
                            <button
                              type="button"
                              className="submitBtn"
                              style={{ marginLeft: "auto", fontSize: "0.72rem", padding: "0.35rem 0.85rem" }}
                              onClick={() => {
                                if (!msgReplyText.trim()) return;
                                setReplySuccessMessage("✓ Reply queued and dispatched successfully.");
                                setMsgReplyText("");
                                setTimeout(() => setReplySuccessMessage(null), 3000);
                              }}
                            >
                              Send Reply ↗
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="messageDetailPane" style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                        Select a message from the feed to view full conversation and details.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        {/* ========================================================================= */}
        {/* VIEW: USER DATABASE */}
        {/* ========================================================================= */}
        {activeTab === "feedback" && (
          <div>
            <div className="viewHeader">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <h1 className="viewTitle">User Database</h1>
                <button
                  type="button"
                  className="mobileMenuToggleBtn"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open Navigation Menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
              </div>
            </div>

            {/* DENSE TOP TOOLBAR */}
            <div className="denseToolbar">
              {/* MOBILE ONLY SEARCH & MARK READ ROW (DIRECTLY ABOVE FILTERS) */}
              <div className="mobileSearchRow">
                <input
                  type="text"
                  className="denseSearchInput mobileSearchInput"
                  placeholder="Search ID, email, specs..."
                  value={feedbackSearchQuery}
                  onChange={(e) => setFeedbackSearchQuery(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  className="markAllReadBtn mobileMarkReadBtn"
                  onClick={handleMarkAllRead}
                  title="Mark all bug reports and suggestions as read"
                >
                  ✓ Read All
                </button>
              </div>

              <div className="toolbarLeft">
                {/* Desktop Tabs: full icon + text */}
                <div className="desktopFilterTabs">
                  {filterOptions.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`denseTabBtn ${feedbackFilter === tab.id ? "denseTabBtnActive" : ""}`}
                      onClick={() => setFeedbackFilter(tab.id)}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Mobile Filter Row: icons only, only ACTIVE expands with label */}
                <div className="mobileFilterRow">
                  {filterOptions.map((tab) => {
                    const isActive = feedbackFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        className={`mobileFilterIconBtn ${isActive ? "active" : ""}`}
                        onClick={() => setFeedbackFilter(tab.id)}
                        title={tab.label}
                      >
                        {tab.icon}
                        {isActive && <span>{tab.label}</span>}
                      </button>
                    );
                  })}
                </div>
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
                <div>Email, Subscription & ID</div>
                <div>Extension & License</div>
                <div>Feedbacks</div>
                <div>Direct Replies</div>
                <div>Hardware & Stats</div>
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
                    const currentTab = activeDrawerTab[profile.userId] || null;
                    const userMute = mutes[profile.userId];
                    const isMuted = userMute && !userMute.shadowBanned && new Date(userMute.bannedUntil).getTime() > Date.now();
                    const isShadowBanned = userMute && userMute.shadowBanned;
                    const userReplies = replies.filter((r) => r.userId === profile.userId);
                    const latestItem = profile.items[0];
                    const hasUnread = profile.items.some(i => i.type !== 'review' && !readFeedbackIds.includes(i.id));
                    const hasEmail = profile.emails && profile.emails.length > 0;
                    const isUserSubscribed = profile.items.some(i => i.newsletterSubscribed === true || i.type === 'newsletter');

                    const latestReview = profile.items.find(i => i.type === 'review' && i.rating);

                    return (
                      <div
                        key={profile.userId}
                        className={`denseRowWrapper ${currentTab || activeMenuUserId === profile.userId ? 'hasActivePopover' : ''}`}
                      >
                        {/* MAIN 1-LINE MODULAR ROW */}
                        <div className="denseRowMain">
                          
                          {/* 1. EMAIL, SUBSCRIPTION & USER ID */}
                          <div className="cellUser">
                            <span className={`statusIndicatorDot ${isShadowBanned ? 'shadow' : isMuted ? 'muted' : 'active'}`} />
                            
                            {/* EMAIL: SINGLE OR MULTI-DROPDOWN */}
                            {hasEmail ? (
                              profile.emails.length > 1 ? (
                                <div className="popoverAnchor">
                                  <button
                                    type="button"
                                    className="emailExpandTriggerBtn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleDrawer(profile.userId, 'emails');
                                    }}
                                    title="Click to view all emails for this user"
                                  >
                                    <span className="emailCountChip">{profile.emails.length}</span>
                                    <span className="userEmailText">{profile.emails[0]}</span>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                                  </button>

                                  {currentTab === 'emails' && (
                                    <div className="floatingPopover" style={{ minWidth: "250px", padding: "0.55rem" }} onClick={(e) => e.stopPropagation()}>
                                      <div className="drawerColHead" style={{ marginBottom: "0.45rem" }}>
                                        <span>User Emails ({profile.emails.length})</span>
                                      </div>
                                      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                                        {profile.emails.map((em, emIdx) => {
                                          const isThisEmailSubscribed = profile.items.some(i => (i.newsletterSubscribed === true || i.type === 'newsletter') && i.email && i.email.trim() === em) || (emIdx === 0 && isUserSubscribed);
                                          return (
                                            <div key={em} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem", fontSize: "0.74rem", color: "var(--text-pure)", background: "var(--bg-inset)", padding: "0.3rem 0.5rem", borderRadius: "var(--r-sm)", border: "1px solid var(--border-dim)" }}>
                                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", overflow: "hidden" }}>
                                                <span style={{ fontSize: "0.62rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>#{emIdx + 1}</span>
                                                <span style={{ wordBreak: "break-all" }}>{em}</span>
                                              </div>
                                              {isThisEmailSubscribed && (
                                                <span className="subCheckmarkBadge" style={{ padding: "0.1rem 0.35rem", fontSize: "0.62rem", flexShrink: 0, marginLeft: "0.4rem" }}>
                                                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                  <span>Subbed</span>
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="userEmailText">{profile.emails[0]}</span>
                              )
                            ) : (
                              <span className="userEmailText" style={{ color: "var(--text-dark)" }}>-</span>
                            )}

                            {/* NEWSLETTER CHECKMARK POPOVER: ONLY IF ACTUALLY SUBSCRIBED */}
                            {hasEmail && isUserSubscribed && (
                              <div className="popoverAnchor">
                                <button
                                  type="button"
                                  className="subCheckmarkBadge"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDrawer(profile.userId, 'newsletter');
                                  }}
                                  title="Newsletter subscription: Click to view details"
                                >
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                  <span className="subBadgeTextDesktop">Subscribed</span>
                                  <span className="subBadgeTextMobile">Subbed</span>
                                </button>

                                {currentTab === 'newsletter' && (
                                  <div className="floatingPopover" style={{ minWidth: "260px", padding: "0.6rem" }} onClick={(e) => e.stopPropagation()}>
                                    <div className="drawerColHead" style={{ marginBottom: "0.45rem" }}>
                                      <span>Newsletter Subscriptions</span>
                                    </div>
                                    <div style={{ fontSize: "0.71rem", color: "var(--text-pure)", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
                                        <span>Major Product Releases & News</span>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
                                        <span>Extension Updates & Changelogs</span>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                        <span style={{ color: "#10b981", fontWeight: 700 }}>✓</span>
                                        <span>Critical Security & Patch Alerts</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* USER ID */}
                            <div className="userIdWrapper">
                              <span className="userIdFadeText" title={profile.userId}>
                                {profile.userId}
                              </span>
                              <button
                                type="button"
                                className="copyIconBtn"
                                title="Copy User ID"
                                onClick={(e) => handleCopyUserId(e, profile.userId)}
                              >
                                {copiedUserId === profile.userId ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                ) : (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                )}
                              </button>

                              {/* 3-DOTS BUTTON ON MOBILE (IMMEDIATELY AFTER COPY) */}
                              <div className="cellActions mobileOnlyActions" onClick={(e) => e.stopPropagation()}>
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

                                    <div
                                      className="dotsDropdownItem"
                                      style={{ color: "#ef4444", borderTop: "1px solid var(--border-subtle)", marginTop: "2px", paddingTop: "5px" }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuUserId(null);
                                        handleDeleteEntireUser(profile.userId);
                                      }}
                                    >
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                      <span>Delete User from DB</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 2. SECOND ROW ON MOBILE / COLUMNS 2..6 ON DESKTOP */}
                          <div className="rowSecondaryCells">
                            {/* EXTENSION & LICENSE (CONSOLIDATED WITH GREEN SUB-PILL) */}
                            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", overflow: "hidden" }}>
                              <div className="extLicenseBadge">
                                <span className="extName">{profile.extensionName}</span>
                                <span className="extStatusPill licensed" title="Licensed">
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                  <span className="extStatusLabel">Licensed</span>
                                </span>
                              </div>
                            </div>

                            {/* 3. FEEDBACKS BUTTON WITH FLOATING POPOVER */}
                            <div className="popoverAnchor">
                              <button
                                type="button"
                                className={`interactivePillBtn ${currentTab === 'feedback' ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDrawer(profile.userId, 'feedback', profile.items);
                                }}
                                title="Toggle Submissions Popover"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                <span>{profile.items.length} {profile.items.length === 1 ? 'Message' : 'Messages'}</span>
                                {hasUnread ? (
                                  <span className="badgePill new" style={{ padding: "0.05rem 0.25rem", fontSize: "0.6rem" }}>NEW</span>
                                ) : latestReview ? (
                                  <span className="badgePill stars" style={{ padding: "0.05rem 0.25rem", fontSize: "0.62rem" }}>★ {latestReview.rating}/5</span>
                                ) : null}
                              </button>

                              {/* FLOATING POPOVER: FEEDBACK CHAIN */}
                              {currentTab === 'feedback' && (
                                <div className="floatingPopover" onClick={(e) => e.stopPropagation()}>
                                  <div className="drawerColHead" style={{ marginBottom: "0.55rem" }}>
                                    <span>Submissions Chain ({profile.items.length})</span>
                                  </div>

                                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                    {profile.items.map((sub, idx) => {
                                      const isSubExpanded = expandedSubMap[sub.id] || false;
                                      const cleanTitle = sub.type === 'review' ? 'Review' : sub.type === 'suggest' ? 'Feature Suggestion' : 'Bug Report';
                                      const hasMediaAttached = Boolean(sub.hasMedia || sub.telegramMediaUrl);
                                      const isItemUnread = sub.type !== 'review' && !readFeedbackIds.includes(sub.id);

                                      return (
                                        <div
                                          key={sub.id}
                                          className={`subItemCard ${isSubExpanded ? 'isExpanded' : ''} ${isItemUnread ? 'isUnread' : ''}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const willExpand = !isSubExpanded;
                                            setExpandedSubMap((prev) => ({ ...prev, [sub.id]: willExpand }));
                                            if (willExpand && isItemUnread) {
                                              saveReadIds(Array.from(new Set([...readFeedbackIds, sub.id])));
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
                                              <span className="subDateText">{formatAdminDate(sub.date)}</span>
                                              <button
                                                type="button"
                                                className="delSubBtn"
                                                title="Delete submission"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteSubmission(sub.id);
                                                }}
                                              >
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                              </button>
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
                              )}
                            </div>

                            {/* 4. DIRECT REPLIES BUTTON WITH FLOATING POPOVER */}
                            <div className="popoverAnchor">
                              <button
                                type="button"
                                className={`interactivePillBtn ${currentTab === 'replies' ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDrawer(profile.userId, 'replies');
                                }}
                                title="Toggle Direct Replies Popover"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                <span>{userReplies.length} Replies</span>
                              </button>

                              {/* FLOATING POPOVER: DIRECT RESPONSES */}
                              {currentTab === 'replies' && (
                                <div className="floatingPopover" onClick={(e) => e.stopPropagation()}>
                                  <div className="drawerColHead" style={{ marginBottom: "0.55rem" }}>
                                    <span>Direct Responses Sent to this User ({userReplies.length})</span>
                                  </div>

                                  <div className="responsesFeed">
                                    {userReplies.length === 0 ? (
                                      <div style={{
                                        backgroundColor: "var(--bg-inset)",
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
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap", fontSize: "0.72rem" }}>
                                              <span className="badgePill active" title={r.userId}>
                                                {r.userId === 'all' ? 'All' : `Usr: ${r.userId.substring(0, 5)}`}
                                              </span>
                                              <span style={{ color: "var(--border-medium)", opacity: 0.6 }}>\</span>
                                              <span className="badgePill" style={{ background: "rgba(255, 255, 255, 0.08)", fontSize: "0.62rem" }}>
                                                {cleanCategoryName(r.category)}
                                              </span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.68rem" }}>
                                              <span style={{ color: "var(--border-medium)", opacity: 0.6 }}>\</span>
                                              <span className="responseDate">{formatAdminDate(r.date)}</span>
                                              <span style={{ color: "var(--border-medium)", opacity: 0.6 }}>\</span>
                                              <button
                                                type="button"
                                                className="delReplyBtn"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleDeleteReply(r.id);
                                                }}
                                                title="Delete notification"
                                              >
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                              </button>
                                            </div>
                                          </div>
                                          {r.title && (
                                            <div style={{ fontWeight: 600, color: "var(--text-pure)", fontSize: "0.74rem", marginTop: "0.25rem" }}>
                                              {r.title}
                                            </div>
                                          )}
                                          <p className="responseText" style={{ marginTop: "0.2rem" }}>{r.message}</p>
                                          {r.buttonText && (
                                            <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                              {r.buttonUrl && r.buttonUrl.startsWith("http") ? (
                                                <Link
                                                  href={r.buttonUrl}
                                                  target="_blank"
                                                  style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.3rem",
                                                    padding: "0.2rem 0.55rem",
                                                    borderRadius: "var(--r-sm)",
                                                    background: "var(--bg-inset)",
                                                    border: "1px solid #FF3B00",
                                                    color: "var(--text-pure)",
                                                    fontSize: "0.7rem",
                                                    fontWeight: 600,
                                                    textDecoration: "none"
                                                  }}
                                                >
                                                  <span>{r.buttonText}</span>
                                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                                                </Link>
                                              ) : (
                                                <span
                                                  style={{
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    gap: "0.3rem",
                                                    padding: "0.2rem 0.55rem",
                                                    borderRadius: "var(--r-sm)",
                                                    background: "var(--bg-inset)",
                                                    border: "1px solid #FF3B00",
                                                    color: "var(--text-pure)",
                                                    fontSize: "0.7rem",
                                                    fontWeight: 600
                                                  }}
                                                >
                                                  {r.buttonText}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>

                                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.6rem" }}>
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
                              )}
                            </div>

                            {/* 5. HARDWARE & STATS BUTTON WITH FLOATING POPOVER */}
                            <div className="popoverAnchor">
                              <button
                                type="button"
                                className={`interactivePillBtn ${currentTab === 'specs' ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDrawer(profile.userId, 'specs');
                                }}
                                title="Toggle Hardware Specs Popover"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line></svg>
                                <span className="specsBtnTextDesktop">Specs ({profile.os && profile.os.includes("Windows") ? "Win" : profile.os && profile.os.includes("Mac") ? "Mac" : profile.os || "Win"})</span>
                                <span className="specsBtnTextMobile">Specs</span>
                              </button>

                              {/* FLOATING POPOVER: HARDWARE SPECS */}
                              {currentTab === 'specs' && (
                                <div className="floatingPopover alignRight" style={{ width: "420px", maxWidth: "90vw" }} onClick={(e) => e.stopPropagation()}>
                                  <div className="specsTableContainer">
                                    <div className="specsTableHead">
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line></svg>
                                      <span>PC Telemetry & Environment Specs</span>
                                    </div>

                                    <div className="specsGrid">
                                      <div className="specsRow">
                                        <div className="specsLabel">
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line></svg>
                                          <span>Environment</span>
                                        </div>
                                        <div className="specsValue">{profile.os} • AE {profile.appVersion}</div>
                                      </div>

                                      <div className="specsRow">
                                        <div className="specsLabel">
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                                          <span>Hardware</span>
                                        </div>
                                        <div className="specsValue">{profile.hardware || "N/A"}</div>
                                      </div>

                                      <div className="specsRow">
                                        <div className="specsLabel">
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                                          <span>Telemetry</span>
                                        </div>
                                        <div className="specsValue">{profile.stats || "N/A"}</div>
                                      </div>

                                      <div className="specsRow">
                                        <div className="specsLabel">
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                          <span>Installed</span>
                                        </div>
                                        <div className="specsValue">{profile.daysInstalled} ({profile.installDate})</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 6. ACTIONS MENU (DESKTOP ONLY) */}
                            <div className="cellActions desktopOnlyActions" onClick={(e) => e.stopPropagation()}>
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

                                  <div
                                    className="dotsDropdownItem"
                                    style={{ color: "#ef4444", borderTop: "1px solid var(--border-subtle)", marginTop: "2px", paddingTop: "5px" }}
                                    onClick={() => {
                                      handleDeleteEntireUser(profile.userId);
                                      setActiveMenuUserId(null);
                                    }}
                                  >
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    <span>Delete User from DB</span>
                                  </div>
                                </div>
                              )}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <h1 className="viewTitle">Broadcast & Notification Center</h1>
                <button
                  type="button"
                  className="mobileMenuToggleBtn"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open Navigation Menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
              </div>
            </div>

            <div className="dispatchSplitLayout">
              {/* LEFT: COMPACT DISPATCH FORM */}
              <div className="dispatchCardCompact">
                <div className="dispatchTopControls">
                  {/* PRODUCT SWITCHER */}
                  <div className="productSegment">
                    {[
                      { id: "all", label: "All" },
                      { id: "lapath", label: "LaPath" },
                      { id: "kliner", label: "KLiner" },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`productSegmentBtn ${dispatchForm.product === p.id ? "active" : ""}`}
                        onClick={() => setDispatchForm({ ...dispatchForm, product: p.id })}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* DELIVERY CHANNELS */}
                  <div className="channelCheckboxes">
                    <label className="channelCheckLabel">
                      <input
                        type="checkbox"
                        checked={dispatchForm.channelInApp}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, channelInApp: e.target.checked })}
                      />
                      <span>Extension</span>
                    </label>

                    <label className="channelCheckLabel">
                      <input
                        type="checkbox"
                        checked={dispatchForm.channelEmail}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, channelEmail: e.target.checked })}
                      />
                      <span>Email</span>
                    </label>
                  </div>
                </div>

                {dispatchSuccess && (
                  <div style={{
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "var(--acc-green-bg)",
                    border: "1px solid var(--acc-green-border)",
                    borderRadius: "var(--r-sm)",
                    color: "var(--acc-green)",
                    fontSize: "0.74rem",
                    fontWeight: 600,
                    marginBottom: "0.75rem"
                  }}>
                    ✓ Dispatched successfully
                  </div>
                )}

                <form onSubmit={handleSendNotification}>
                  {/* 2-COLUMN SELECT CONTROLS */}
                  <div className="dispatchGridTwoCol">
                    <div className="formGroup" style={{ margin: 0 }}>
                      <label className="formLabel">Target</label>
                      <CustomSelect
                        options={[
                          { label: "All Users", value: "all" },
                          { label: "Single User", value: "single" }
                        ]}
                        value={dispatchForm.targetType}
                        onChange={(val) => setDispatchForm({ ...dispatchForm, targetType: val })}
                      />
                    </div>

                    <div className="formGroup" style={{ margin: 0 }}>
                      <label className="formLabel">Category</label>
                      <CustomSelect
                        options={[
                          { label: "Announcement", value: "Announcement" },
                          { label: "System Notice", value: "System Notice" },
                          { label: "Personal Reply", value: "Personal Reply" },
                        ]}
                        value={dispatchForm.category}
                        onChange={(val) => setDispatchForm({ ...dispatchForm, category: val })}
                      />
                    </div>
                  </div>

                  {dispatchForm.targetType === "single" && (
                    <div className="formGroup" style={{ marginTop: "0.6rem" }}>
                      <label className="formLabel">User ID</label>
                      <input
                        type="text"
                        className="techInput"
                        placeholder="da3be79b-d6a7-..."
                        value={dispatchForm.userId}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, userId: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  <div className="formGroup" style={{ marginTop: "0.6rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <label className="formLabel" style={{ margin: 0 }}>Title</label>
                      <span style={{ fontSize: "0.68rem", color: dispatchForm.title.length >= 30 ? "#ef4444" : "var(--text-muted)" }}>
                        {dispatchForm.title.length}/30
                      </span>
                    </div>

                    {/* FULL CLEAR TITLE PRESETS */}
                    <div className="presetPillRow">
                      {[
                        "Your suggestion was approved",
                        "Bug report fixed in new update",
                        "New extension update available",
                        "Response to your feedback",
                        "Important system maintenance"
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className="presetPillBtn"
                          onClick={() => setDispatchForm((prev) => ({ ...prev, title: preset.substring(0, 30) }))}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      className="techInput"
                      placeholder="Title (max 30 chars)..."
                      maxLength={30}
                      value={dispatchForm.title}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value.substring(0, 30) })}
                      required
                    />
                  </div>

                  <div className="formGroup" style={{ marginTop: "0.6rem" }}>
                    <label className="formLabel">Message</label>
                    <textarea
                      className="techTextarea"
                      placeholder="Enter message..."
                      rows={3}
                      value={dispatchForm.message}
                      onChange={(e) => setDispatchForm({ ...dispatchForm, message: e.target.value })}
                      required
                    />
                  </div>

                  {/* OPTIONAL ACTION BUTTON WITH PRESETS */}
                  <div style={{ marginTop: "0.6rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                      <label className="formLabel" style={{ margin: 0 }}>Action / Button Preset</label>
                    </div>

                    <div className="presetPillRow">
                      {[
                        { label: "Subscribe (Email)", text: "Subscribe to Updates", url: "action:subscribe" },
                        { label: "Poll (Agree/Decline 1/0)", text: "Participate in Poll", url: "action:yes_no" },
                        { label: "Website Link", text: "Visit Website", url: "https://rifemotion.com" },
                        { label: "Clear Action", text: "", url: "" }
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="presetPillBtn"
                          onClick={() => setDispatchForm((prev) => ({
                            ...prev,
                            buttonText: item.text,
                            buttonUrl: item.url
                          }))}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.4rem" }}>
                    <div className="formGroup" style={{ margin: 0 }}>
                      <label className="formLabel">Button Label</label>
                      <input
                        type="text"
                        className="techInput"
                        placeholder="e.g. Subscribe to Updates"
                        value={dispatchForm.buttonText || ""}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, buttonText: e.target.value })}
                      />
                    </div>

                    <div className="formGroup" style={{ margin: 0 }}>
                      <label className="formLabel">Action / Link URL</label>
                      <input
                        type="text"
                        className="techInput"
                        placeholder="action:subscribe / action:yes_no / https://..."
                        value={dispatchForm.buttonUrl || ""}
                        onChange={(e) => setDispatchForm({ ...dispatchForm, buttonUrl: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
                    <button
                      type="submit"
                      className="submitBtn"
                      disabled={isSending}
                      style={{ opacity: isSending ? 0.65 : 1, cursor: isSending ? "not-allowed" : "pointer", padding: "0.45rem 1rem", fontSize: "0.75rem" }}
                    >
                      {isSending ? "Sending..." : "Send →"}
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
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap", fontSize: "0.72rem" }}>
                            <span className="badgePill active" title={r.userId}>
                              {r.userId === 'all' ? 'All' : `Usr: ${r.userId.substring(0, 5)}`}
                            </span>
                            <span style={{ color: "var(--border-medium)", opacity: 0.6 }}>\</span>
                            <span className="badgePill" style={{ background: "rgba(255, 255, 255, 0.08)", fontSize: "0.62rem" }}>
                              {cleanCategoryName(r.category)}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.68rem" }}>
                            <span style={{ color: "var(--border-medium)", opacity: 0.6 }}>\</span>
                            <span className="responseDate">{formatAdminDate(r.date)}</span>
                            <span style={{ color: "var(--border-medium)", opacity: 0.6 }}>\</span>
                            <button
                              type="button"
                              className="delReplyBtn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteReply(r.id);
                              }}
                              title="Delete notification"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                          </div>
                        </div>
                        {r.title && (
                          <div style={{ fontWeight: 600, color: "var(--text-pure)", fontSize: "0.74rem", marginTop: "0.25rem" }}>
                            {r.title}
                          </div>
                        )}
                        <p className="responseText" style={{ marginTop: "0.2rem" }}>{r.message}</p>
                        {r.buttonText && (
                          <div style={{ marginTop: "0.4rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            {r.buttonUrl && r.buttonUrl.startsWith("http") ? (
                              <Link
                                href={r.buttonUrl}
                                target="_blank"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                  padding: "0.2rem 0.55rem",
                                  borderRadius: "var(--r-sm)",
                                  background: "var(--bg-inset)",
                                  border: "1px solid #FF3B00",
                                  color: "var(--text-pure)",
                                  fontSize: "0.7rem",
                                  fontWeight: 600,
                                  textDecoration: "none"
                                }}
                              >
                                <span>{r.buttonText}</span>
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                              </Link>
                            ) : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                  padding: "0.2rem 0.55rem",
                                  borderRadius: "var(--r-sm)",
                                  background: "var(--bg-inset)",
                                  border: "1px solid #FF3B00",
                                  color: "var(--text-pure)",
                                  fontSize: "0.7rem",
                                  fontWeight: 600
                                }}
                              >
                                {r.buttonText}
                              </span>
                            )}
                          </div>
                        )}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <h1 className="viewTitle">System Telemetry</h1>
                <button
                  type="button"
                  className="mobileMenuToggleBtn"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open Navigation Menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
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

      {/* MOBILE SLIDE-OUT DRAWER */}
      {mobileMenuOpen && (
        <div className="mobileDrawerBackdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobileDrawerContent" onClick={(e) => e.stopPropagation()}>
            <div className="mobileDrawerHeader">
              <div className="brandLabel">
                <span className="brandIndicator"></span>
                <span>rifemotion</span>
              </div>
              <button
                type="button"
                className="mobileDrawerCloseBtn"
                onClick={() => setMobileMenuOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="mobileDrawerSection">
              <div className="navGroupLabel">Navigation</div>
              <div className="navList">
                <button
                  type="button"
                  className={`navButton ${activeTab === "feedback" ? "navButtonActive" : ""}`}
                  onClick={() => { setActiveTab("feedback"); setMobileMenuOpen(false); }}
                >
                  <img src="/icons_admin/chat.svg" alt="Database" className="iconImg" />
                  <span>User Database</span>
                </button>
                <button
                  type="button"
                  className={`navButton ${activeTab === "dispatch" ? "navButtonActive" : ""}`}
                  onClick={() => { setActiveTab("dispatch"); setMobileMenuOpen(false); }}
                >
                  <img src="/icons_admin/mail.svg" alt="Broadcast" className="iconImg" />
                  <span>Broadcast Notice</span>
                </button>
                <button
                  type="button"
                  className={`navButton ${activeTab === "status" ? "navButtonActive" : ""}`}
                  onClick={() => { setActiveTab("status"); setMobileMenuOpen(false); }}
                >
                  <img src="/icons_admin/dashboard.svg" alt="Status" className="iconImg" />
                  <span>System Telemetry</span>
                </button>
              </div>
            </div>

            {activeTab === "feedback" && (
              <div className="mobileDrawerSection">
                <div className="navGroupLabel">Search Database</div>
                <input
                  type="text"
                  className="denseSearchInput"
                  style={{ width: "100%" }}
                  placeholder="Search ID, email, specs..."
                  value={feedbackSearchQuery}
                  onChange={(e) => setFeedbackSearchQuery(e.target.value)}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="markAllReadBtn"
                  style={{ marginTop: "0.4rem", justifyContent: "center" }}
                  onClick={() => { handleMarkAllRead(); setMobileMenuOpen(false); }}
                >
                  ✓ Mark All as Read
                </button>
              </div>
            )}

            <div className="mobileDrawerSection" style={{ marginTop: "auto" }}>
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
