"use client";
// Add these NEW imports (keep all existing ones):
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import React, { useState, useRef, useEffect } from "react";
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useSocket } from "@/lib/socket-context";
import { contacts, generateMessages, type Contact, type Message } from "@/lib/chat-data";
import { MessageContextMenu } from "@/components/message-context-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { User, Shield, Lock, Sun, Moon, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/supabaseClient";
import { sendNotification, isPermissionGranted, requestPermission, onAction } from '@tauri-apps/plugin-notification';
import { Trash2 } from "lucide-react";
import { savePrefs } from "@/lib/savePrefs";
import {
  Search, Send, Paperclip, Smile, MoreVertical, Phone, Video,
  MessageCircle, Settings as SettingsIcon, LogOut, Star, Users, VolumeX, Bell, ChevronDown,
  ImageIcon, Mic, Clock, Check, X, Ban, Pin, Reply, Forward, ChevronLeft,Pencil,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

const normalizeName = (name?: string) => {
  if (!name) return "";
  // Remove parenthesized suffixes like (You) and any trailing labels that are not part of the actual name.
  return name
    .replace(/\(.*?\)/g, "")
    .replace(/\b(you|me)\b/gi, "")
    .trim();
};

const isUserBlocked = (
  contact,
  userEmail,
  preferences,
  blockedUsers
) => {
  if (contact.id === "self") return false;

  const contactKey = (contact.email || contact.id || "")
    .toLowerCase()
    .trim();

  // ✅ DB (maine block kiya)
  const blockedByMe = Array.from(preferences.blocked).some(
    (b) => String(b).toLowerCase().trim() === contactKey
  );

  // ✅ BACKEND RESPONSE (usne mujhe block kiya)
  const blockedByThem =
    blockedUsers?.[contactKey]?.includes(userEmail) || false;

  return blockedByMe || blockedByThem;
};

type PreferencesType = {
  favorites: Set<string>;
  blocked: Set<string>;
  muted: Set<string>;
  pinned: Set<string>;
  backgrounds: Record<string, string>;
  online_visible?: boolean;
  read_receipts_enabled?: boolean;
  typing_indicator?: boolean;
  notifications_enabled?: boolean;
};

const getInitials = (name?: string) => {
  const normalized = normalizeName(name);
  if (!normalized) return "";
  const parts = normalized.split(/\s+/).filter(Boolean);
  const initials = parts
    .map((part) => part.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase());
  return initials.join("");
};
const showNotification = async (title: string, body: string, contactId?: string, isGroup: boolean = false) => {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    if (granted) {
      sendNotification({
        title,
        body,
        channelId: 'messages',
        silent: false,
        extra: { contactId, isGroup: String(isGroup) },
      });
    }
  } catch (err) {
    console.error("Notification failed:", err);
  }
};

const getFirstName = (name?: string) => {
  const normalized = normalizeName(name);
  if (!normalized) return "";
  const parts = normalized.split(/\s+/).filter(Boolean);
  return parts[0]?.replace(/[^a-zA-Z0-9]/g, "") || "";
};

const getContactKey = (contact: any): string => {
  return contact.email || contact.uid || contact.id || "";
};
const formatMessageDateTime = (dateInput: Date | string | number) => {
  const date = new Date(dateInput);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (isToday) return `Today, ${timeStr}`;
  if (isYesterday) return `Yesterday, ${timeStr}`;

  const dateStr = date.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
  return `${dateStr}, ${timeStr}`;
};
const parseSystemMessage = (raw: string, viewerEmail?: string) => {
  let text = raw.replace("[SYSTEM]", "");
  if (text.includes("###")) {
    const [textPart, emailPart] = text.split("###");
    if (
      emailPart &&
      viewerEmail &&
      emailPart.trim().toLowerCase() === viewerEmail.trim().toLowerCase()
    ) {
      const idx = textPart.lastIndexOf(" added ");
      text = idx !== -1 ? textPart.slice(0, idx) + " added you" : textPart;
    } else {
      text = textPart;
    }
  }
  return text;
};
const formatTypingNames = (names: string[]) => {
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is typing...`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing...`;
  return `${names[0]}, ${names[1]} and ${names.length - 2} others are typing...`;
};



const SettingsModal = ({
  isOpen,
  onClose,
  user,
  preferences,
  setPreferences,
  updateProfile,
  logout,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  preferences: PreferencesType;
  setPreferences: React.Dispatch<React.SetStateAction<PreferencesType>>;
  updateProfile: (data: any) => Promise<void>;
  logout: () => void;
}) => {
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || "");
  const [uploading, setUploading] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'privacy' | 'notifications'>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileForm, setProfileForm] = useState({ name: user?.name || '', bio: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [localPrefs, setLocalPrefs] = useState({
    online_visible: preferences.online_visible ?? true,
    read_receipts_enabled: preferences.read_receipts_enabled ?? true,
    typing_indicator: preferences.typing_indicator ?? true,
    notifications_enabled: preferences.notifications_enabled ?? true,
    blocked: [] as string[],
  });
  useEffect(() => {
    setSelectedAvatar(user?.avatar || "");
  }, [user?.avatar]);

  useEffect(() => {
    setProfileForm({
      name: user?.name || "",
      bio: profileForm.bio || "",
    });
  }, [user?.name]);

  useEffect(() => {
    if (!isOpen) return;
    const loadData = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        const { data } = await supabase.from('profiles').select('bio').eq('id', authData.user.id).single();
        if (data?.bio) setProfileForm(prev => ({ ...prev, bio: data.bio }));
      }
      if (user?.email) {
        const { data } = await supabase.from('user_preferences').select('*').eq('user_id', user.email).single();
        if (data) {
          setLocalPrefs({
            online_visible: data.online_visible ?? true,
            read_receipts_enabled: data.read_receipts_enabled ?? true,
            typing_indicator: data.typing_indicator ?? true,
            notifications_enabled: data.notifications_enabled ?? true,
            blocked: data.blocked || [],
          });
          // ✅ theme state/applyTheme yahan bilkul mat chhuao
        }
      }
    };
    loadData();
  }, [isOpen, user?.email]);

  const applyTheme = (t: 'light' | 'dark') => {
    t === 'dark'
      ? document.documentElement.classList.add('dark')
      : document.documentElement.classList.remove('dark');
  };

  const handleThemeToggle = async () => {
    toggleTheme(); // ✅ context wala use karo
    const newTheme = theme === 'light' ? 'dark' : 'light';
    await supabase.from('user_preferences').upsert({ user_id: user?.email, theme: newTheme });
    setMessage({ type: 'success', text: 'Theme updated!' });
    setTimeout(() => setMessage(null), 1300);
  };

  const updatePreference = async (key: string, value: any) => {
    setLocalPrefs(prev => ({ ...prev, [key]: value }));
    setPreferences(prev => ({ ...prev, [key]: value }));
    try {
      const { data: existing } = await supabase.from('user_preferences').select('user_id').eq('user_id', user?.email).single();
      if (existing) {
        await supabase.from('user_preferences').update({ [key]: value }).eq('user_id', user?.email);
      } else {
        await supabase.from('user_preferences').insert({ user_id: user?.email, [key]: value });
      }
      setMessage({ type: 'success', text: 'Settings updated!' });
      setTimeout(() => setMessage(null), 1300);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings' });
      setTimeout(() => setMessage(null), 1300);
    }
  };
  const handlePhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("https://chatify-backend-mrlh.onrender.com/upload-profile", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();

      setSelectedAvatar(data.imageUrl);

      setMessage({
        type: "success",
        text: "Profile photo uploaded!",
      });

      setTimeout(() => setMessage(null), 1300);
    } catch (error) {
      console.error(error);

      setMessage({
        type: "error",
        text: "Failed to upload image",
      });

      setTimeout(() => setMessage(null), 1300);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const { data: authData } = await supabase.auth.getUser();

      if (authData?.user?.id) {
        await supabase
          .from("profiles")
          .update({
            name: profileForm.name,
            bio: profileForm.bio,
            avatar: selectedAvatar || "",
          })
          .eq("id", authData.user.id);
      }

      // 🔥 LOCAL USER STATE UPDATE
      await updateProfile({
        name: profileForm.name,
        email: user?.email || "",
        avatar: selectedAvatar || "",
      });

      setMessage({
        type: "success",
        text: "Profile updated!",
      });

      setTimeout(() => setMessage(null), 1300);

    } catch (err) {

      setMessage({
        type: "error",
        text: "Failed to update profile",
      });

      setTimeout(() => setMessage(null), 1300);

    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('https://chatify-backend-mrlh.onrender.com/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email, password: passwordForm.newPassword }),
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Password changed!' });
        setPasswordForm({ newPassword: '', confirmPassword: '' });
      } else {
        setMessage({ type: 'error', text: 'Failed to change password' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Error changing password' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 1300);
    }
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => {
    const [on, setOn] = useState(checked);
    const handleClick = () => {
      const next = !on;
      setOn(next);
      onChange(next);
    };
    return (
      <button
        type="button"
        onClick={handleClick}
        style={{ backgroundColor: on ? '#f97316' : '#d1d5db', transition: 'background-color 0.3s' }}
        className="relative inline-flex h-6 w-11 items-center rounded-full"
      >
        <span
          style={{ transform: on ? 'translateX(22px)' : 'translateX(3px)', transition: 'transform 0.3s' }}
          className="inline-block h-5 w-5 rounded-full bg-white shadow"
        />
      </button>
    );
  };

  const menuItems = [
    { id: 'profile' as const, label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'account' as const, label: 'Account', icon: <Shield className="w-4 h-4" /> },
    { id: 'privacy' as const, label: 'Privacy', icon: <Lock className="w-4 h-4" /> },
    { id: 'notifications' as const, label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative bg-card w-[95vw] h-[85vh] sm:w-[820px] sm:h-[580px] rounded-2xl shadow-2xl border border-border flex flex-col sm:flex-row overflow-hidden">
        {/* Buttons - bilkul corner pe */}
        <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
          <button
            onClick={handleThemeToggle}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light'
              ? <Moon className="w-5 h-5 text-muted-foreground" />
              : <Sun className="w-5 h-5 text-muted-foreground" />
            }
          </button>
          <button onClick={onClose} className="group p-1.5 rounded-md transition-colors hover:bg-red-500">
            <X className="w-6 h-6 text-muted-foreground group-hover:text-white transition-colors" />
          </button>
        </div>


        {/* Left Sidebar */}
        <div className="w-full sm:w-56 bg-card border-r-0 sm:border-r border-b sm:border-b-0 border-border flex flex-col p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3 sm:mb-5">
            <span className="font-bold text-base">Settings</span>
          </div>

          <nav className="flex flex-row sm:flex-col gap-2 sm:gap-0 sm:space-y-1 flex-1 overflow-x-auto pb-3">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`shrink-0 sm:w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-xl transition-colors text-left text-sm whitespace-nowrap ${activeTab === item.id
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-foreground hover:bg-muted'
                  }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">

          {/* Header */}
          <div className="flex items-center px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-base font-semibold">
                {menuItems.find(m => m.id === activeTab)?.label} Settings
              </h2>
              <p className="text-xs text-muted-foreground">Manage your account preferences</p>
            </div>
          </div>





          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {message && (
              <div className={`mb-4 p-3 rounded-xl flex items-center gap-3 text-sm ${message.type === 'success'
                  ? 'bg-green-50 dark:bg-green-950 border border-green-200'
                  : 'bg-red-50 dark:bg-red-950 border border-red-200'
                }`}>
                {message.type === 'success'
                  ? <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                }
                <span className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                  {message.text}
                </span>
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-4">

                  <div className="relative">

                    <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-orange-500/20 bg-muted flex items-center justify-center">
                      {selectedAvatar ? (
                        <img
                          src={selectedAvatar}
                          alt="Profile"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="text-3xl font-bold text-muted-foreground">
                          {getInitials(profileForm.name || user?.name || "?")}
                        </div>
                      )}
                    </div>

                    {/* ✅ X button added here */}
                    {selectedAvatar && (
                      <button
                        onClick={() => setSelectedAvatar("")}
                        className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                      >
                        <X size={14} />
                      </button>
                    )}

                  </div>

                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="text-sm text-orange-500 hover:text-orange-600 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploading
                      ? "Uploading..."
                      : selectedAvatar
                        ? "Change Profile Photo"
                        : "Add Profile Photo"}
                  </button>

                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Change Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    className="w-full px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-orange-500 bg-background text-sm"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Bio</label>
                  <textarea
                    placeholder="Tell us about yourself"
                    className="w-full px-3 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-orange-500 bg-background text-sm"
                    rows={3}
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
                >
                  {loading ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            )}

            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email Address</label>
                  <input
                    type="email"
                    disabled
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-muted text-muted-foreground cursor-not-allowed text-sm"
                    value={user?.email || ''}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      className="w-full px-3 py-2.5 pr-10 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-orange-500 bg-background text-sm"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2.5 pr-10 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-orange-500 bg-background text-sm"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleChangePassword}
                  disabled={loading || !passwordForm.newPassword}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
                >
                  {loading ? 'Updating...' : 'Change Password'}
                </button>
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors">
                  <div>
                    <p className="font-medium text-sm">Online Status Visible</p>
                    <p className="text-xs text-muted-foreground">Show when you're active to others</p>
                  </div>
                  <Toggle
                    checked={localPrefs.online_visible}
                    onChange={(v) => updatePreference('online_visible', v)}
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors">
                  <div>
                    <p className="font-medium text-sm">Read Receipts</p>
                    <p className="text-xs text-muted-foreground">Show when you've read messages</p>
                  </div>
                  <Toggle
                    checked={localPrefs.read_receipts_enabled}
                    onChange={(v) => updatePreference('read_receipts_enabled', v)}
                  />
                </div>
                <div className="pt-4 border-t border-border">
                  <h3 className="font-semibold text-sm mb-3">Blocked Users</h3>
                  {localPrefs.blocked.length > 0 ? (
                    <div className="space-y-2">
                      {localPrefs.blocked.map((email) => (
                        <div key={email} className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                          <span className="text-sm">{email}</span>
                          <button
                            onClick={() => updatePreference('blocked', localPrefs.blocked.filter(e => e !== email))}
                            className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                          >
                            Unblock
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No blocked users</p>
                  )}
                </div>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors">
                  <div>
                    <p className="font-medium text-sm">Show Notifications</p>
                    <p className="text-xs text-muted-foreground">Get popup alerts for new messages</p>
                  </div>
                  <Toggle
                    checked={localPrefs.notifications_enabled}
                    onChange={(v) => updatePreference('notifications_enabled', v)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted transition-colors">
                  <div>
                    <p className="font-medium text-sm">Typing Indicator</p>
                    <p className="text-xs text-muted-foreground">Show when you're typing</p>
                  </div>
                  <Toggle
                    checked={localPrefs.typing_indicator}
                    onChange={(v) => updatePreference('typing_indicator', v)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
const CreateGroupModal = ({
  isOpen,
  onClose,
  friends,
  userEmail,
  onGroupCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  friends: any[];
  userEmail: string;
  onGroupCreated?: (group: any) => void;
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [groupBio, setGroupBio] = useState("");
  const [groupAvatar, setGroupAvatar] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nameError, setNameError] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [searchUID, setSearchUID] = useState("");
const [foundUserByUid, setFoundUserByUid] = useState<any>(null);
const [loadingUidSearch, setLoadingUidSearch] = useState(false);
const [uidSearchDelayActive, setUidSearchDelayActive] = useState(false);
const [uidNotFound, setUidNotFound] = useState(false);
const [manualUsers, setManualUsers] = useState<any[]>([]); 

  const resetState = () => {
    setStep(1);
    setSearchQuery("");
    setSelectedContacts(new Set());
    setGroupName("");
    setGroupBio("");
    setGroupAvatar("");
    setNameError(false);
     setSearchUID("");
    setFoundUserByUid(null);
    setUidNotFound(false);
    setManualUsers([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

const filteredContacts = friends.filter((c) =>
  (c.name || "").toLowerCase().includes(searchQuery.toLowerCase().trim())
);
const filteredManualUsers = manualUsers
  .filter((mu) => {
    const muKey = (mu.email || mu.id || "").toLowerCase().trim();
    return !friends.some((f) => {
      const fKey = (f.email || f.id || "").toLowerCase().trim();
      return fKey === muKey;
    });
  })
  .filter((mu) => (mu.name || "").toLowerCase().includes(searchQuery.toLowerCase().trim()));
  const toggleContact = (id: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
    const handleUidSearch = async () => {
    if (!searchUID.trim()) return;
    setFoundUserByUid(null);
    setUidNotFound(false);
    setLoadingUidSearch(true);
    setUidSearchDelayActive(true);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const cleanedUID = searchUID.trim().replace(/\s+/g, "");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, avatar, uid")
      .ilike("uid", cleanedUID)
      .single();

    if (error || !data || data.email === userEmail) {
      setFoundUserByUid(null);
      setUidNotFound(true);
    } else {
      setFoundUserByUid(data);
    }

    setLoadingUidSearch(false);
    setUidSearchDelayActive(false);
  };

  const handleAddFoundUser = () => {
    if (!foundUserByUid) return;
    const id = foundUserByUid.email || foundUserByUid.id;

    setManualUsers((prev) =>
      prev.some((u) => (u.email || u.id) === id)
        ? prev
        : [
            ...prev,
            {
              id,
              email: foundUserByUid.email,
              name: foundUserByUid.name || foundUserByUid.uid,
              avatar: foundUserByUid.avatar || "",
              uid: foundUserByUid.uid,
            },
          ]
    );

    setSelectedContacts((prev) => new Set(prev).add(id));
    setFoundUserByUid(null);
    setSearchUID("");
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch("https://chatify-backend-mrlh.onrender.com/upload-profile", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      setGroupAvatar(data.imageUrl);
    } catch (err) {
      console.error("Group photo upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setNameError(true);
      return;
    }
    setCreating(true);

    // 🔥 2.5 second delay
    await new Promise((resolve) => setTimeout(resolve, 2500));

    try {
      const { data: groupData, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: groupName.trim(),
          bio: groupBio.trim() || null,
          avatar: groupAvatar || null,
          created_by: userEmail,
        })
        .select()
        .single();

      if (groupError || !groupData) {
        console.error("Error creating group:", groupError);
        setCreating(false);
        return;
      }

      const memberEmails = Array.from(selectedContacts);
      const memberRows = [
        { group_id: groupData.id, member_email: userEmail, role: "admin" },
        ...memberEmails.map((email) => ({
          group_id: groupData.id,
          member_email: email,
          role: "member",
        })),
      ];

      const { error: memberError } = await supabase
        .from("group_members")
        .insert(memberRows);

      if (memberError) {
        console.error("Error adding group members:", memberError);
      }
      const { data: creatorProfile } = await supabase
  .from("profiles")
  .select("name")
  .eq("email", userEmail)
  .single();
const creatorName = creatorProfile?.name || userEmail;

if (memberEmails.length > 0) {
  const { data: memberProfiles } = await supabase
    .from("profiles")
    .select("email, name")
    .in("email", memberEmails);

  const systemRows = memberEmails.map((email) => {
    const name = memberProfiles?.find((p: any) => p.email === email)?.name || email;
    return {
      group_id: groupData.id,
      sender_email: userEmail,
      content: `[SYSTEM]${creatorName} added ${name}###${email}`,
    };
  });

  await supabase.from("group_messages").insert(systemRows);
}
      

      onGroupCreated?.(groupData);
      handleClose();
    } catch (err) {
      console.error("Error creating group:", err);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="relative bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col max-h-[85vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">
            {step === 1 ? "Add Group Members" : "New Group"}
          </h2>
          <button
            onClick={handleClose}
            className="group p-1.5 rounded-md transition-colors hover:bg-red-500"
          >
            <X className="w-5 h-5 text-muted-foreground group-hover:text-white transition-colors" />
          </button>
        </div>

        {/* STEP 1: Select Contacts */}
        {step === 1 && (
          <>
            <div className="px-5 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 rounded-xl border border-gray-300 bg-muted pl-10 text-sm focus:border-orange-600 focus:ring-0 outline-none shadow-none"
                />
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Search user by UID"
                  value={searchUID}
                  onChange={(e) => {
                    setSearchUID(e.target.value);
                    setUidNotFound(false);
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck="false"
                  className="h-10 rounded-xl border border-gray-300 bg-muted text-sm focus:border-orange-600 focus:ring-0 outline-none shadow-none"
                />
                <Button onClick={handleUidSearch} disabled={loadingUidSearch}>
                  Search
                </Button>
              </div>

              {loadingUidSearch && uidSearchDelayActive && (
                <div className="mt-2 rounded-2xl border border-border bg-muted/70 px-4 py-3 shadow-sm flex items-center gap-3">
                  <div className="h-6 w-6 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin"></div>
                  <p className="text-sm font-medium">Searching for User</p>
                </div>
              )}

              {foundUserByUid && (
                <div className="mt-2 rounded-2xl border border-border bg-muted/70 px-3 py-2 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={foundUserByUid.avatar} />
                        <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                          {getInitials(foundUserByUid.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{foundUserByUid.name || "User"}</p>
                        <p className="text-[11px] text-muted-foreground truncate">UID: {foundUserByUid.uid}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddFoundUser}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              {uidNotFound && (
                <p className="mt-2 text-xs text-red-500">User not found</p>
              )}

            
              
              {selectedContacts.size > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {selectedContacts.size} selected
                </p>
              )}
            </div>

                        <div className="flex-1 overflow-y-auto px-2 pb-2">
              {filteredContacts.length === 0 && filteredManualUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                  <Users size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">No contact found</p>
                </div>
              ) : (
                <>
                  {/* 🔥 Added via UID - ab TOP pe */}
                  {filteredManualUsers.length > 0 && (
                    <>
                      <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground">
                        Added via UID
                      </p>
                      {filteredManualUsers.map((contact) => {
                        const id = contact.email || contact.id;
                        const isSelected = selectedContacts.has(id);
                        return (
                          <button
                            key={id}
                            onClick={() => toggleContact(id)}
                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors"
                          >
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={contact.avatar} />
                              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                                {getInitials(contact.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left min-w-0">
                              <p className="text-sm font-medium truncate">{contact.name}</p>
                              {contact.uid && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  UID: {contact.uid}
                                </p>
                              )}
                            </div>
                            <div
                              className={`h-5 w-5 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected
                                  ? "bg-orange-500 border-orange-500"
                                  : "border-gray-400"
                                }`}
                            >
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                          </button>
                        );
                      })}
                      <div className="my-2 border-t border-border" />
                    </>
                  )}

                  {/* Normal friends list */}
                                    {/* 🔥 Normal Contacts heading - hamesha dikhega */}
                  {filteredContacts.length > 0 && (
                    <p className="px-3 pt-2 pb-1 text-xs font-semibold text-muted-foreground">
                      Contacts
                    </p>
                  )}

                  {/* Normal friends list */}
                  {filteredContacts.map((contact) => {
                    const id = contact.email || contact.id;
                    const isSelected = selectedContacts.has(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleContact(id)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={contact.avatar} />
                          <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                            {getInitials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-left text-sm font-medium">
                          {contact.name}
                        </span>
                        <div
                          className={`h-5 w-5 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected
                              ? "bg-orange-500 border-orange-500"
                              : "border-gray-400"
                            }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-border">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-red-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors"
              >
                Create
              </button>
            </div>
          </>
        )}

        {/* STEP 2: Group Details */}
        {step === 2 && (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Group Photo */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-orange-500/20 bg-muted flex items-center justify-center">
                    {groupAvatar ? (
                      <img src={groupAvatar} alt="Group" className="h-full w-full object-cover" />
                    ) : (
                      <Users className="h-9 w-9 text-muted-foreground" />
                    )}
                  </div>
                  {groupAvatar && (
                    <button
                      onClick={() => setGroupAvatar("")}
                      className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploading}
                  className="text-sm text-orange-500 hover:text-orange-600 font-medium disabled:opacity-60"
                >
                  {uploading ? "Uploading..." : groupAvatar ? "Change Group Photo" : "Add Group Photo (optional)"}
                </button>
              </div>

              {/* Group Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Group Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter group name"
                  value={groupName}
                  onChange={(e) => {
                    setGroupName(e.target.value);
                    if (e.target.value.trim()) setNameError(false);
                  }}
                  className={`w-full px-3 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 ${nameError ? "border-red-500 focus:ring-red-500" : "border-border focus:ring-orange-500"
                    }`}
                />
                {nameError && (
                  <p className="mt-1 text-xs text-red-500">Group name is required</p>
                )}
              </div>

              {/* Group Bio */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Bio (optional)</label>
                <textarea
                  placeholder="What's this group about?"
                  rows={3}
                  value={groupBio}
                  onChange={(e) => setGroupBio(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {selectedContacts.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedContacts.size} member{selectedContacts.size > 1 ? "s" : ""} will be added
                </p>
              )}
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-border">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={creating}
                className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                Create Group
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};


const ChatSidebar = ({

  activeContact,
  onSelect,
  filter,
   groupTypingUsers,      // 🔥 NEW
  typingProfilesCache,
  setFilter,
  setGroupTypingUsers,       // 🔥 NEW
  setTypingProfilesCache,
  searchQuery,
  setSearchQuery,
  user,
  uid,
  onLogout,
  dialogOpen,
  setDialogOpen,
  logoutLoading,
  setFriends,
  friends,
  previewImage,
  previewTitle,
  setPreviewImage,
  setPreviewTitle,
  typingStatus,
  unreadCounts,
  groupActivityCount,
  contactOrder,
  allMessages,
  preferences,
  setPreferences,
  updateContactOrder,
  onSettingsOpen,
  setUnreadCounts,
  setContactOrderIfMissing,
}: {
  activeContact: Contact | null;
  setContactOrderIfMissing: (key: string, timestamp: number) => void;
  onSelect: (c: Contact) => void;
  friends: any[];
  setFriends: (f: any[]) => void;
  filter: string;
  updateContactOrder: (key: string, timestamp: number) => void;
  setFilter: (f: string) => void;
  setUnreadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  user: any;
  setGroupTypingUsers: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;   // 🔥 NEW
  setTypingProfilesCache: React.Dispatch<React.SetStateAction<Record<string, { name: string; avatar: string }>>>; // 🔥 NEW
  uid: string;
  contactOrder: Record<string, number>;
  onLogout: () => void;
  groupActivityCount?: Record<string, number>;
  dialogOpen: boolean;
  setDialogOpen: (v: boolean) => void;
  logoutLoading: boolean;
  previewImage: string | null;
  previewTitle: string | null;
  setPreviewImage: (url: string | null) => void;
  setPreviewTitle: (value: string | null) => void;
  typingStatus: Record<string, boolean>;
  unreadCounts: Record<string, number>;
  allMessages: Record<string, any[]>;
  preferences: PreferencesType;
    groupTypingUsers: Record<string, string[]>;
  typingProfilesCache: Record<string, { name: string; avatar: string }>;
  setPreferences: React.Dispatch<React.SetStateAction<PreferencesType>>;
  onSettingsOpen: () => void;
}) => {
  const { user: authUser } = useAuth();
  const { blockedUsers } = useSocket();
  const userEmail = authUser?.email;
  const navigate = useNavigate();


  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [searchUID, setSearchUID] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);
  const [restoreMode, setRestoreMode] = useState(false); // 🔥 NEW
  const [loadingUser, setLoadingUser] = useState(false);
  const [searchDelayActive, setSearchDelayActive] = useState(false);
  const [infoDialog, setInfoDialog] = useState({
    open: false,
    message: "",
  });

  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [notifTab, setNotifTab] = useState<'received' | 'sent'>('received');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});
  const [acceptedFriends, setAcceptedFriends] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem(`friends_cache_${authUser?.email || ""}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [contextMenu, setContextMenu] = useState<{
    contactId: string;
    contactName: string;
    x: number;
    y: number;
  } | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    contactId: string;
    contactName: string;
    contactEmail: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const isOnline = (lastSeen?: string) => {
    if (!lastSeen) return false;

    try {
      // 🔥 FIX: Multiple format handle karo
      let normalized = lastSeen;
      if (!lastSeen.includes('Z') && !lastSeen.includes('+') && !lastSeen.includes('-', 10)) {
        normalized = lastSeen + 'Z';
      }

      const date = new Date(normalized);
      if (isNaN(date.getTime())) return false; // Invalid date check

      const diff = Date.now() - date.getTime();
      return diff < 180000; // 3c minutes
    } catch {
      return false;
    }
  };
    useEffect(() => {
    console.log("[SIDEBAR] contactOrder prop received:", contactOrder);
  }, [contactOrder]);
  // Fetch pending friend requests
  useEffect(() => {
    const fetchPendingRequests = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const { data: userData } = await supabase.auth.getUser();
        const receiverEmail =
          authUser?.email ||
          sessionData.session?.user?.email ||
          userData.user?.email;

        if (!receiverEmail) {
          console.warn("No receiver email found for pending requests", {
            authUserEmail: authUser?.email,
            sessionData,
          });
          setPendingRequests([]);
          return;
        }

        const { data: requests, error } = await supabase
          .from("friend_requests")
          .select("id,sender_email,receiver_email,status")
          .eq("receiver_email", receiverEmail)
          .eq("status", "pending");  // 🔥 wapas add kar diya

        if (error) {
          console.error("Error fetching requests:", error);
          setPendingRequests([]);
          return;
        }

        const senderEmails =
          (requests || []).map((r: any) => r.sender_email).filter(Boolean) || [];

        const { data: senderProfiles } = senderEmails.length
          ? await supabase
            .from("profiles")
            .select("id, name, email, avatar, uid, last_seen")
            .in("email", senderEmails)
          : { data: [] };

        const requestsWithProfiles = (requests || []).map((request: any) => ({
          ...request,
          senderProfile:
            senderProfiles?.find((profile: any) => profile.email === request.sender_email) ||
            null,
        }));

        setPendingRequests(requestsWithProfiles);
      } catch (error) {
        console.error("Error fetching requests:", error);
        setPendingRequests([]);
      }
    };

    // 🔥 NEW: Sent requests fetch karne wala function
    const fetchSentRequests = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const { data: userData } = await supabase.auth.getUser();
        const senderEmail =
          authUser?.email ||
          sessionData.session?.user?.email ||
          userData.user?.email;

        if (!senderEmail) {
          setSentRequests([]);
          return;
        }

        const { data: requests, error } = await supabase
          .from("friend_requests")
          .select("id,sender_email,receiver_email,status")
          .eq("sender_email", senderEmail)
          .eq("status", "pending")  // 🔥 sirf pending
          .order("id", { ascending: false });

        if (error) {
          console.error("Error fetching sent requests:", error);
          setSentRequests([]);
          return;
        }

        const receiverEmails =
          (requests || []).map((r: any) => r.receiver_email).filter(Boolean) || [];

        const { data: receiverProfiles } = receiverEmails.length
          ? await supabase
            .from("profiles")
            .select("id, name, email, avatar, uid")
            .in("email", receiverEmails)
          : { data: [] };

        const requestsWithProfiles = (requests || []).map((request: any) => ({
          ...request,
          receiverProfile:
            receiverProfiles?.find((profile: any) => profile.email === request.receiver_email) ||
            null,
        }));

        setSentRequests(requestsWithProfiles);
      } catch (error) {
        console.error("Error fetching sent requests:", error);
        setSentRequests([]);
      }
    };

    fetchPendingRequests();
    fetchSentRequests(); // 🔥 NEW

    // Subscribe to real-time updates
    const subscription = supabase
      .channel("friend_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        () => {
          fetchPendingRequests();
          fetchSentRequests(); // 🔥 NEW
        }
      )
      .subscribe();

    const interval = setInterval(() => {
      fetchPendingRequests();
      fetchSentRequests(); // 🔥 NEW
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [authUser]);
  // 🔥 Fetch groups user is part of + realtime updates
  useEffect(() => {
    if (!userEmail) return;
const fetchGroups = async () => {
  const { data: memberships, error } = await supabase
    .from("group_members")
    .select("group_id, groups(id, name, bio, avatar, created_by, created_at)")
    .eq("member_email", userEmail);

  if (error) {
    console.error("Error fetching groups:", error);
    return;
  }

  const groupsList = (memberships || [])
    .map((m: any) => m.groups)
    .filter(Boolean)
    .sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  setUserGroups(groupsList);

  // 🔥 FIXED: ab stale contactOrder pe depend nahi karta
  groupsList.forEach((g: any) => {
    setContactOrderIfMissing(g.id, new Date(g.created_at).getTime());
  });
};

    fetchGroups();

    // 🔥 Realtime - jese hi koi naya member add ho ya group bane, sab members ke sidebar mein turant reflect ho
    const subscription = supabase
  .channel("group_members_realtime")
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "group_members" },
    () => {
      fetchGroups();
    }
  )
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "groups" },
    () => {
      fetchGroups();
    }
  )
  .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userEmail]);
  
  // 🔥 NEW: Subscribe to typing broadcast for ALL groups (not just the open one)
const fetchedProfilesRef = useRef<Set<string>>(new Set());

useEffect(() => {
  if (userGroups.length === 0) return;

  const channels = userGroups.map((group) =>
    supabase
      .channel(`group_typing_${group.id}`)   // 🔥 CHANGED — pehle group_messages_ tha
      .on("broadcast", { event: "typing" }, async (payload: any) => {
        const { email, isTyping } = payload.payload;
        if (email === userEmail) return;

        setGroupTypingUsers((prev) => {
          const current = new Set(prev[group.id] || []);
          if (isTyping) {
            current.add(email);
          } else {
            current.delete(email);
          }
          return { ...prev, [group.id]: Array.from(current) };
        });

        if (isTyping && !fetchedProfilesRef.current.has(email)) {
          fetchedProfilesRef.current.add(email);
          const { data } = await supabase
            .from("profiles")
            .select("name, avatar")
            .eq("email", email)
            .single();
          if (data) {
            setTypingProfilesCache((prev) => ({
              ...prev,
              [email]: { name: data.name, avatar: data.avatar },
            }));
          }
        }
      })
      .subscribe()
  );

  return () => {
    channels.forEach((ch) => supabase.removeChannel(ch));
  };
}, [userGroups, userEmail]);
useEffect(() => {
  if (!userEmail || userGroups.length === 0) return;

  const loadInitialGroupUnread = async () => {
    for (const g of userGroups) {
      const { data: allMsgs } = await supabase
        .from("group_messages")
        .select("id, sender_email, content")
        .eq("group_id", g.id);

      const { data: readRows } = await supabase
        .from("group_message_reads")
        .select("message_id")
        .eq("group_id", g.id)
        .eq("reader_email", userEmail);

      const readIds = new Set((readRows || []).map((r: any) => r.message_id));

      const unread = (allMsgs || []).filter((m: any) =>
        m.sender_email !== userEmail &&
        !readIds.has(m.id) &&
        !(typeof m.content === "string" && m.content.startsWith("[SYSTEM]"))
      ).length;

      setUnreadCounts((prev) => ({ ...prev, [g.id]: unread }));
    }
  };

  loadInitialGroupUnread();
}, [userGroups, userEmail]);

  // Fetch accepted friends
  useEffect(() => {
    const fetchAcceptedFriends = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userEmail = sessionData.session?.user?.email;
        if (!userEmail) return;

        // ✅ FRESH fetch from DB - har baar latest value aayegi
        const { data: myPrefs } = await supabase
          .from("user_preferences")
          .select("online_visible")
          .eq("user_id", userEmail)
          .single();

        const myOnlineVisible = myPrefs?.online_visible !== false;

        // Ab rest ke requests...
        const { data: sentRequests } = await supabase
          .from("friend_requests")
          .select("id,receiver_email")
          .eq("sender_email", userEmail)
          .eq("status", "accepted");

        const { data: receivedRequests } = await supabase
          .from("friend_requests")
          .select("id,sender_email")
          .eq("receiver_email", userEmail)
          .eq("status", "accepted");

        const receiverEmails = sentRequests?.map((r: any) => r.receiver_email).filter(Boolean) || [];
        const senderEmails = receivedRequests?.map((r: any) => r.sender_email).filter(Boolean) || [];
        const friendEmails = Array.from(new Set([...receiverEmails, ...senderEmails]));

        const { data: deletedList } = await supabase
          .from("deleted_contacts")
          .select("contact_email")
          .eq("user_email", userEmail);

        const deletedSet = new Set((deletedList || []).map((d: any) => d.contact_email));
        const visibleFriendEmails = friendEmails.filter((e) => !deletedSet.has(e));

        const { data: friendProfiles } = visibleFriendEmails.length
          ? await supabase
            .from("profiles")
            .select("id, name, email, avatar, uid, last_seen")
            .in("email", visibleFriendEmails)
          : { data: [] };

        const friendPrefs = visibleFriendEmails.length
          ? await supabase
            .from("user_preferences")
            .select("user_id, online_visible")
            .in("user_id", visibleFriendEmails)
          : { data: [] };

        const uniqueProfiles = Array.from(
          new Map(
            (friendProfiles || []).map((profile: any) => [profile.email, profile])
          ).values()
        );

        // ✅ YAH PE myOnlineVisible USE KAR (fresh DB se, props se nahi)
        const friends: any[] = uniqueProfiles
          .map((profile: any) => {
            const pref = (friendPrefs.data || []).find(
              (p: any) => p.user_id === profile.email
            );
            const friendOnlineVisible = pref ? pref.online_visible !== false : true;

            return {
              id: profile.email || profile.uid || profile.id,
              name: profile.name || "Unknown",
              avatar: profile.avatar || "",
              lastMessage: "Connected as friends",
              time: "",
              unread: 0,
              last_seen: (myOnlineVisible && friendOnlineVisible)
                ? (profile.last_seen || null)
                : null,
              email: profile.email,
              uid: profile.uid,
            };
          })
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        setAcceptedFriends((prev) => {
          const prevKey = prev.map(f => `${f.id}|${f.last_seen}|${f.name}|${f.avatar}`).join(",");
          const newKey = friends.map(f => `${f.id}|${f.last_seen}|${f.name}|${f.avatar}`).join(",");

          if (prevKey === newKey) return prev;

          if (userEmail) {
            localStorage.setItem(`friends_cache_${userEmail}`, JSON.stringify(friends));
          }
          setFriends(friends);
          return friends;
        });
      } catch (error) {
        console.error("Error fetching accepted friends:", error);
      }
    };

    fetchAcceptedFriends();

    const subscription = supabase
      .channel("accepted_friends")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        () => {
          fetchAcceptedFriends();
        }
      )
      .subscribe();

    const interval = setInterval(fetchAcceptedFriends, 3000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [authUser]); // ✅ SIRF authUser - preferences?.online_visible hata do // 🔥 dependency add ki

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  // Close notification on outside click
  useEffect(() => {
    if (!notificationOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-notification-popup]') &&
        !target.closest('[data-notification-bell]')) {
        setNotificationOpen(false);
      }
    };

    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => document.removeEventListener("click", handleClickOutside);
  }, [notificationOpen]);

  const handleAcceptRequest = async (requestId: string, senderEmail: string) => {
    setLoadingStates(p => ({ ...p, [requestId]: true }));

    try {
      // ✅ Accept request
      const { error } = await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", requestId);

      if (error) {
        console.error("Accept request error:", error);
        return;
      }

      // ✅ (OPTIONAL but recommended) add to friends table
      await supabase.from("friends").insert([
        { user_email: senderEmail, friend_email: authUser?.email },
        { user_email: authUser?.email, friend_email: senderEmail },
      ]);

      // ✅ Fetch sender data
      const { data: senderData } = await supabase
        .from("profiles")
        .select("id, name, email, avatar, uid, last_seen")
        .eq("email", senderEmail)
        .single();

      if (senderData) {
        const newFriend = {
          id: senderData.email || senderData.uid || senderData.id,
          name: senderData.name || "Unknown",
          avatar: senderData.avatar || "",
          lastMessage: "Connected as friends",
          time: "",
          unread: 0,
          last_seen: senderData.last_seen,
          email: senderData.email,
          uid: senderData.uid,
        };

        setAcceptedFriends(p => [...p, newFriend]);
      }

      setPendingRequests(p => p.filter(r => r.id !== requestId));
      setAcceptDialogOpen(true);

    } catch (error) {
      console.error("Error accepting request:", error);
    } finally {
      setLoadingStates(p => ({ ...p, [requestId]: false }));
    }
  };
  const handleRejectRequest = async (requestId: string) => {
    setLoadingStates(p => ({ ...p, [requestId]: true }));
    try {
      await supabase
        .from("friend_requests")
        .delete()
        .eq("id", requestId);

      setPendingRequests(p => p.filter(r => r.id !== requestId));
    } catch (error) {
      console.error("Error rejecting request:", error);
    } finally {
      setLoadingStates(p => ({ ...p, [requestId]: false }));
    }
  };

  const filters = ["All messages", "Unread", "Favorites"];

  // Deduplicate friends by id to avoid showing same contact twice
  const uniqueFriendsMap = new Map(
    acceptedFriends.map(f => [f.id, f])
  );

  const getSortTime = (contactId: string) => {
    const friend = acceptedFriends.find(f => f.id === contactId);
    const key = (friend?.email || contactId || "").toLowerCase().trim();
    const time = contactOrder[key] || 0;
    console.log("[SORT]", contactId, "sortTime =", time);
    return time;
  };

  const baseContacts = [
    {
      id: "self",
      name: `${user?.name} (You)`,
      avatar: user?.avatar,
      lastMessage: "Send a message to yourself",
      time: "",
      unread: 0,
      last_seen: new Date().toISOString(),
    },
    ...Array.from(uniqueFriendsMap.values()).map(f => ({
      ...f,
      unread: unreadCounts[f.id] || 0,
    })),
    ...userGroups.map(g => ({
      id: g.id,
      name: g.name,
      avatar: g.avatar || "",
      email: g.id,
      lastMessage: g.bio || "",
      time: "",
      unread: unreadCounts[g.id] || 0,
      last_seen: null,
      isGroup: true,
      bio: g.bio,
    })),
  ];
  // 🔥 WhatsApp style - latest message wala contact upar
  const selfContact = baseContacts.find(c => c.id === "self");
  const sortedOthers = baseContacts
    .filter(c => c.id !== "self")
    .sort((a, b) => {
      const diff = getSortTime(b.id) - getSortTime(a.id);
      if (diff !== 0) return diff;
      return (a.name || "").localeCompare(b.name || "");
    });
  const sortedContacts = selfContact ? [selfContact, ...sortedOthers] : sortedOthers;

  const filteredByType = (() => {
    if (filter === "Unread") {
      return sortedContacts.filter(
        (c) => c.id !== "self" && (unreadCounts[c.id] || 0) > 0
      );
    } else if (filter === "Favorites") {
      return sortedContacts.filter(
        (c) =>
          c.id !== "self" && preferences.favorites.has(c.id)
      );
    }
    return sortedContacts;
  })();
  const pinnedList = filteredByType.filter(c => c.id !== "self" && preferences.pinned.has(c.id));
  const unpinnedList = filteredByType.filter(c => c.id === "self" || !preferences.pinned.has(c.id));

  const filtered = filter === "Favorites"
    ? [...pinnedList, ...filteredByType.filter(c => !preferences.pinned.has(c.id))]
    : [...unpinnedList.slice(0, 1), ...pinnedList, ...unpinnedList.slice(1)];
  const finalFiltered = filtered.filter((contact) => {
    const name = (contact.name || "").toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    return name.includes(query);
  });
  const visibleContacts = finalFiltered.filter((contact) => {
    if (contact.id === "self") return true; // Apna contact hamesha dikhao

    const contactKey = (contact.email || contact.id || "").toLowerCase().trim();
    const myEmail = (userEmail || "").toLowerCase().trim();

    // Maine block kiya
    const blockedByMe = Array.from(preferences.blocked).some(
      (b) => b.toLowerCase().trim() === contactKey
    );

    // Usne mujhe block kiya
    const blockedByThem = blockedUsers?.[contactKey]?.includes(myEmail) || false;

    // 🔥 Dono case mein sidebar se hide karo
    return !blockedByMe && !blockedByThem;
  });
  if (!userEmail) return null;
  return (
    <div className="flex h-full w-full md:w-80 flex-col border-r bg-card relative">

      {/* Notification Popup - Positioned over sidebar */}
      {notificationOpen && (
        <div
          data-notification-popup
          className="absolute top-16 left-2 right-2 bg-card border border-border rounded-lg shadow-lg z-50 flex flex-col max-h-96 overflow-y-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-3 border-b border-border sticky top-0 bg-card">
            <span className="text-sm font-semibold text-foreground">Friend Requests</span>
            <button
              onClick={() => setNotificationOpen(false)}
              className="text-muted-foreground hover:bg-red-500 hover:text-white p-1.5 rounded-md transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* 🔥 NEW: Tabs */}
          <div className="flex border-b border-border sticky top-[49px] bg-card z-10">
            <button
              onClick={() => setNotifTab('received')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${notifTab === 'received'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Received {pendingRequests.length > 0 && `(${pendingRequests.length})`}
            </button>
            <button
              onClick={() => setNotifTab('sent')}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${notifTab === 'sent'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              Sent {sentRequests.length > 0 && `(${sentRequests.length})`}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1">
            {notifTab === 'received' ? (
              pendingRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                  <Clock size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">No requests received</p>
                </div>
              ) : (
                pendingRequests.map((request: any) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-3 p-3 border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    {/* Avatar */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (request.senderProfile?.avatar) {
                          setPreviewImage(request.senderProfile.avatar);
                          setPreviewTitle(getFirstName(request.senderProfile?.name || request.senderProfile?.uid || request.sender_email || "Profile"));
                        }
                      }}
                      disabled={!request.senderProfile?.avatar}
                      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground text-sm font-bold flex-shrink-0"
                    >
                      {request.senderProfile?.avatar ? (
                        <img
                          src={request.senderProfile.avatar}
                          alt={request.senderProfile?.name || "Profile"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          {getInitials(
                            request.senderProfile?.name ||
                            request.senderProfile?.uid ||
                            request.sender_email ||
                            "?"
                          )}
                        </span>
                      )}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">
                        {request.senderProfile?.name || request.senderProfile?.uid || request.senderProfile?.email || request.sender_email || "Unknown"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {request.senderProfile?.email
                          ? request.senderProfile.email
                          : request.sender_email
                            ? request.sender_email
                            : request.senderProfile?.uid
                              ? `UID: ${request.senderProfile.uid}`
                              : "Unknown"}
                      </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleAcceptRequest(request.id, request.sender_email)}
                        disabled={loadingStates[request.id]}
                        className="w-7 h-7 rounded-md bg-primary text-primary-foreground hover:opacity-80 disabled:opacity-50 flex items-center justify-center transition-opacity"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        disabled={loadingStates[request.id]}
                        className="w-7 h-7 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 flex items-center justify-center transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : (
              // 🔥 NEW: Sent requests tab
              sentRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                  <Clock size={32} className="mb-2 opacity-50" />
                  <p className="text-sm">No requests sent</p>
                </div>
              ) : (
                sentRequests.map((request: any) => (
                  <div
                    key={request.id}
                    className="flex items-center gap-3 p-3 border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    {/* Avatar */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (request.receiverProfile?.avatar) {
                          setPreviewImage(request.receiverProfile.avatar);
                          setPreviewTitle(
                            getFirstName(
                              request.receiverProfile?.name ||
                              request.receiverProfile?.uid ||
                              request.receiver_email ||
                              "Profile"
                            )
                          );
                        }
                      }}
                      disabled={!request.receiverProfile?.avatar}
                      className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground text-sm font-bold flex-shrink-0"
                    >
                      {request.receiverProfile?.avatar ? (
                        <img
                          src={request.receiverProfile.avatar}
                          alt={request.receiverProfile?.name || "Profile"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>
                          {getInitials(
                            request.receiverProfile?.name ||
                            request.receiverProfile?.uid ||
                            request.receiver_email ||
                            "?"
                          )}
                        </span>
                      )}
                    </button>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">
                        {request.receiverProfile?.name || request.receiverProfile?.uid || request.receiver_email || "Unknown"}
                      </p>
                    </div>

                    {/* Status Badge - hamesha Pending */}
                    <div className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400">
                      Pending
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-5 py-4"
        style={{ paddingTop: 'calc(0.25rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">Messages</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Notification Bell */}
          <div data-notification-bell className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl relative"
              onClick={() => setNotificationOpen(!notificationOpen)}
            >
              <Bell className="h-4 w-4" />
              {pendingRequests.length > 0 && (
                <div className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                  {pendingRequests.length}
                </div>
              )}
            </Button>

          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={() => setCreateGroupOpen(true)}
            title="New Group"
          >
            <Users className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            onClick={onSettingsOpen}
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="px-4 pb-1 mt-3">
        <div className="flex gap-2">
          <Input
            placeholder="Search by UID"
            value={searchUID}
            onChange={(e) => {
              const raw = e.target.value;
              console.log("🔎 RAW INPUT:", JSON.stringify(raw), "Length:", raw.length);
              setSearchUID(raw);
            }}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck="false"
            className="
    h-10 rounded-xl
    border-2 border-gray-300
    focus:border-orange-600
    focus:ring-0 focus:outline-none
    shadow-none focus:shadow-none
  "
          />
          <Button
            onClick={async () => {
              if (!searchUID.trim()) return;
              // 🔍 TEMPORARY DEBUG - isse hum exact truth pata karenge
              const { data: allData, error: allError } = await supabase
                .from("profiles")
                .select("id, name, uid");

              console.log("=== TOTAL PROFILES FOUND ===", allData?.length);
              console.log("=== RLS/FETCH ERROR (agar hai) ===", allError);

              const typedTrimmed = searchUID.trim();
              const target = allData?.find(p => p.uid === typedTrimmed);
              const closeMatch = allData?.find(p =>
                p.uid?.toLowerCase() === typedTrimmed.toLowerCase()
              );

              console.log("EXACT match found?:", !!target);
              console.log("Case-insensitive match found?:", !!closeMatch);

              if (closeMatch && !target) {
                console.log("DB uid (exact):", JSON.stringify(closeMatch.uid));
                console.log("Typed uid (exact):", JSON.stringify(typedTrimmed));
                console.log("DB char codes:", [...closeMatch.uid].map(c => c.charCodeAt(0)));
                console.log("Typed char codes:", [...typedTrimmed].map(c => c.charCodeAt(0)));
              }

              if (!target && !closeMatch) {
                console.log("⚠️ Ye UID DB mein exist hi nahi karta — na exact, na case-insensitive");
                console.log("Available UIDs in DB:", allData?.map(p => p.uid));
              }

              // 🔥 Check if searching for own UID
              if (searchUID.trim() === uid) {
                setFoundUser(null);
                setInfoDialog({
                  open: true,
                  message: "This is your own UID. You cannot send a request to yourself.",
                });
                return;
              }

              setFoundUser(null); // 🔥 Clear previous search results
              setLoadingUser(true);
              setSearchDelayActive(true);

              // Add 3 second delay
              await new Promise(resolve => setTimeout(resolve, 3000));

              const { data: authData } = await supabase.auth.getUser();
              const currentUserId = authData?.user?.id;
              const currentUserEmail = authData?.user?.email;

              // 🔍 DEBUG - console mein check karo exact value kya ja rahi hai
              console.log("Searching UID:", JSON.stringify(searchUID.trim()), "Length:", searchUID.trim().length);

              const cleanedUID = searchUID.trim().replace(/\s+/g, "");

              const { data, error } = await supabase
                .from("profiles")
                .select("id, name, email, uid")
                .ilike("uid", cleanedUID)
                .single();

              // 🔍 DEBUG - query ka result bhi console mein dekho
              console.log("Query result:", data, "Error:", error);

              if (error || !data) {
                setFoundUser(null);
                setInfoDialog({
                  open: true,
                  message: "User not found",
                });
              } else if (data.id === currentUserId) {
                // 🔥 Safety check - Prevent searching for own profile
                setFoundUser(null);
                setInfoDialog({
                  open: true,
                  message: "You cannot send a request to yourself",
                });
              } else {
                // 🔥 Check karo ki pehle se accepted friend hai aur delete kiya tha
                const { data: existingRequest1 } = await supabase
                  .from("friend_requests")
                  .select("id, status")
                  .eq("sender_email", currentUserEmail)
                  .eq("receiver_email", data.email)
                  .maybeSingle();

                const { data: existingRequest2 } = await supabase
                  .from("friend_requests")
                  .select("id, status")
                  .eq("sender_email", data.email)
                  .eq("receiver_email", currentUserEmail)
                  .maybeSingle();

                const existingRequest = existingRequest1 || existingRequest2;

                let isRestore = false;

                if (existingRequest?.status === "accepted") {
                  const { data: deletedRow } = await supabase
                    .from("deleted_contacts")
                    .select("id")
                    .eq("user_email", currentUserEmail)
                    .eq("contact_email", data.email)
                    .maybeSingle();

                  if (deletedRow) {
                    isRestore = true;
                  }
                }

                setRestoreMode(isRestore);
                setFoundUser(data);
              }

              setLoadingUser(false);
              setSearchDelayActive(false);
            }}
          >
            Search
          </Button>
        </div>
      </div>

      {loadingUser && searchDelayActive && (
        <div className="mx-4 mt-3 rounded-2xl border border-border bg-muted/70 px-4 py-3 shadow-sm flex items-center gap-3">
          <div className="h-7 w-7 border-4 border-gray-110 border-t-orange-500 rounded-full animate-spin"></div>
          <p className="text-sm font-medium">Searching for User</p>
        </div>
      )}

      {foundUser && (
        <div className="mx-auto mt-3 w-full max-w-[19rem] rounded-2xl border border-border bg-muted/70 px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{foundUser.name || "User"}</p>
              <p className="text-[11px] text-muted-foreground truncate">UID: {foundUser.uid}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRestoreMode(false);
                setFoundUser(null)
              }
              }

              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:text-destructive transition"
              aria-label="Clear search result"
            >
              <X size={16} />
            </button>
          </div>

          <AlertDialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button className="mt-2 w-full">
                {restoreMode ? "Restore Contact" : "Send Request"}
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {restoreMode ? "Restore Contact" : "Send Friend Request"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {restoreMode
                    ? `Do you want to restore ${foundUser?.name || "this contact"}?`
                    : `Do you want to send request to ${foundUser?.name || "this user"}?`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="hover:bg-red-500 hover:text-white transition-colors">
                  Cancel
                </AlertDialogCancel>

                <div
                  
                  style={requestLoading ? { cursor: "not-allowed" } : {}}
                >
                  <AlertDialogAction
                    onClick={async (e) => {
                      e.preventDefault();

                      const { data: authData } = await supabase.auth.getUser();
                      const currentUser = authData?.user;

                      if (!currentUser) {
                        setInfoDialog({
                          open: true,
                          message: "Authentication error. Please login again.",
                        });
                        setRequestDialogOpen(false);
                        return;
                      }

                      if (currentUser.id === foundUser?.id) {
                        setRequestDialogOpen(false);
                        setInfoDialog({
                          open: true,
                          message: "You cannot send a request to yourself",
                        });
                        return;
                      }

                      setRequestLoading(true);

                      await new Promise(resolve => setTimeout(resolve, 2500));

                      // 🔥 RESTORE FLOW (agar search ke time hi restoreMode true set hua tha)
                      if (restoreMode) {
                        await supabase
                          .from("deleted_contacts")
                          .delete()
                          .eq("user_email", currentUser.email)
                          .eq("contact_email", foundUser.email);

                        setRequestLoading(false);
                        setRequestDialogOpen(false);
                        setInfoDialog({ open: true, message: "Contact restored!" });
                        setFoundUser(null);
                        setSearchUID("");
                        setRestoreMode(false);
                        return;
                      }

                      // 🔥 NORMAL SEND-REQUEST FLOW
                      const { data: existingRequest1 } = await supabase
                        .from("friend_requests")
                        .select("id, status")
                        .eq("sender_email", currentUser.email)
                        .eq("receiver_email", foundUser.email)
                        .maybeSingle();

                      const { data: existingRequest2 } = await supabase
                        .from("friend_requests")
                        .select("id, status")
                        .eq("sender_email", foundUser.email)
                        .eq("receiver_email", currentUser.email)
                        .maybeSingle();

                      const existingRequest = existingRequest1 || existingRequest2;

                      if (existingRequest) {
                        setRequestLoading(false);
                        setRequestDialogOpen(false);

                        let message = "Request already sent";
                        if (existingRequest.status === "accepted") {
                          message = "You are already friends";
                        }

                        setInfoDialog({ open: true, message });
                        return;
                      }

                      const { error } = await supabase.from("friend_requests").insert([
                        {
                          sender_email: currentUser.email || "",
                          receiver_email: foundUser.email || "",
                          status: "pending",
                        },
                      ]);

                      setRequestLoading(false);
                      setRequestDialogOpen(false);

                      if (error) {
                        setInfoDialog({ open: true, message: "Something went wrong" });
                      } else {
                        setInfoDialog({ open: true, message: "Request sent successfully!" });
                        setFoundUser(null);
                        setSearchUID("");
                      }
                    }}
                    disabled={requestLoading}
                    
                    style={requestLoading ? { opacity: 0.4, pointerEvents: "none" } : {}}
                  >
                    Confirm
                  </AlertDialogAction>
                </div>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* ✅ SAME STYLE INFO POPUP */}
      <AlertDialog
        open={infoDialog.open}
        onOpenChange={(v) =>
          setInfoDialog({ ...infoDialog, open: v })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Info</AlertDialogTitle>
            <AlertDialogDescription>
              {infoDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>OK</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Request Accepted Dialog */}
      <AlertDialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Request Accepted</AlertDialogTitle>
            <AlertDialogDescription>
              Friend request has been accepted successfully!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setAcceptDialogOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">

          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchQuery("");
              }
            }}
            className="
        h-10 rounded-xl
        border border-gray-300
        bg-muted pl-10 pr-10 text-sm
        focus:border-orange-600
        focus:ring-0 focus-visible:ring-0
        outline-none
        shadow-none focus:shadow-none
        transition-colors
      "
          />

          {/* CLEAR BUTTON */}
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              ✖
            </button>
          )}

        </div>
      </div>
      {/* Filters */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-3">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`relative w-full rounded-full px-2 py-1.5 text-[11px] font-medium transition-all ${filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
          >
            {f}
            {/* Show unread count badge next to Unread filter */}
            {f === "Unread" && Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) > 0 && (
              <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[9px] font-bold shadow-md">
                {Object.values(unreadCounts).reduce((sum, count) => sum + count, 0) > 99 ? "99+" : Object.values(unreadCounts).reduce((sum, count) => sum + count, 0)}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Contacts + Groups - dono ek hi scrollable area mein */}
      <ScrollArea className="flex-1">
        <div className="px-2">

          

          {searchQuery.trim() !== "" && finalFiltered.length === 0 && (
            <div className="px-16 py-10">
              <p className="text-sm font-medium text-muted-foreground">
                No conversations found
              </p>
            </div>
          )}
          {finalFiltered.map((contact) => (
            <div
              key={contact.id}
              onContextMenu={(e) => {
                e.preventDefault();

                if (contact.id !== "self") {
                  requestAnimationFrame(() => {
                    setContextMenu({
                      contactId: contact.id,
                      contactName: contact.name,
                      x: e.pageX, // 🔥 FIX
                      y: e.pageY, // 🔥 FIX
                    });
                  });
                }
              }}
            >

              <button
                onClick={() => onSelect(contact)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-all ${activeContact?.id === contact.id
                    ? "bg-primary/10"
                    : "hover:bg-muted"
                  }`}
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const contactKey = (contact.email || contact.id || "").toLowerCase().trim();
                      const myEmail = (userEmail || "").toLowerCase().trim();
                      const blockedByMe = Array.from(preferences.blocked).some(b => b.toLowerCase().trim() === contactKey);
                      const blockedByThem = blockedUsers?.[contactKey]?.includes(myEmail) || false;
                      const isContactBlocked = blockedByMe || blockedByThem;

                      if (contact.avatar && !isContactBlocked) { // 🔥 blocked ho toh preview nahi
                        setPreviewImage(contact.avatar);
                        setPreviewTitle(contact.name || "Profile");
                      }
                    }}
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${contact.avatar ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <Avatar className="h-11 w-11">
                      <AvatarImage
                        src={(() => {
                          const contactKey = (contact.email || contact.id || "").toLowerCase().trim();
                          const myEmail = (userEmail || "").toLowerCase().trim();
                          const blockedByMe = Array.from(preferences.blocked).some(b => b.toLowerCase().trim() === contactKey);
                          const blockedByThem = blockedUsers?.[contactKey]?.includes(myEmail) || false;
                          return (blockedByMe || blockedByThem)
                            ? "https://res.cloudinary.com/dpaiyfwdu/image/upload/v1778137689/Blocked_oh9wfk.png"
                            : contact.avatar;
                        })()}
                      />
                     <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
  {(contact as any).isGroup ? <Users className="h-5 w-5" /> : getInitials(contact.name)}
</AvatarFallback>
                    </Avatar>
                  </button>
                   {(contact as any).isGroup && (groupActivityCount?.[contact.id] || 0) > 0 && (
    <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold border-2 border-card">
      {groupActivityCount[contact.id]}
    </div>
  )}

                  {/* 🔥 Hide online status if blocked - but ALWAYS show for self */}
                  {(() => {
                    const contactKey = (contact.email || contact.id || "")
                      .toLowerCase()
                      .trim();

                    const myEmail = (userEmail || "").toLowerCase().trim();

                    const blockedByMe = Array.from(preferences.blocked).some(
                      (b) => b.toLowerCase().trim() === contactKey
                    );

                    const blockedByThem =
                      blockedUsers?.[contactKey]?.includes(myEmail) || false;

                    const blocked = blockedByMe || blockedByThem;

                    return (
                      (contact.id === "self" ||
                        (!blocked && contact.last_seen && isOnline(contact.last_seen))) && (
                        <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-orange-500" />
                      )
                    );
                  })()}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {contact.name}
                      {preferences.pinned.has(contact.id) && " 📌"}
                      {preferences.favorites.has(contact.id) && " ⭐"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{contact.time}</span>
                  </div>
<div className="mt-0.5 flex items-center gap-1">
  {(contact as any).isGroup ? (
    (() => {
      const typingEmails = groupTypingUsers?.[contact.id] || [];
      if (typingEmails.length > 0) {
        const names = typingEmails.map((email) => typingProfilesCache?.[email]?.name || email);
        return (
          <p className="text-[11px] font-medium text-orange-500 animate-pulse truncate">
            {formatTypingNames(names)}
          </p>
        );
      }
      return (contact as any).bio ? (
        <p className="text-[11px] text-muted-foreground truncate">{(contact as any).bio}</p>
      ) : null;
    })()
  ) : (
    (() => {
      const contactKey = (contact.email || contact.id || "")
        .toLowerCase()
        .trim();

      if (typingStatus[getContactKey(contact)]) {
        return (
          <p className="truncate text-xs font-medium text-orange-500 animate-pulse">
            typing...
          </p>
        );
      }

      const myEmail = (userEmail || "").toLowerCase().trim();
      const blockedByMe = Array.from(preferences.blocked).some(
        (b) => b.toLowerCase().trim() === contactKey
      );
      const blockedByThem =
        blockedUsers?.[contactKey]?.includes(myEmail) || false;
      const blocked = blockedByMe || blockedByThem;

      return (
        <div className="flex items-center gap-2 text-xs flex-wrap text-muted-foreground">
          {!blocked && contact.id === "self" && (
            <span>Active now</span>
          )}
          {!blocked && contact.id !== "self" && (() => {
            if (!contact.last_seen) return null;
            return (
              <span>{isOnline(contact.last_seen) ? "Active now" : "Not Active"}</span>
            );
          })()}
          {contact.id !== "self" && preferences.muted.has(contact.id) && (
            <div className="flex items-center gap-1">
              <VolumeX className="h-3.5 w-3.5" />
              <span>Muted</span>
            </div>
          )}
        </div>
      );
    })()
  )}
</div>
                </div>
                {/* 🔥 Show unread badge with count */}
                {contact.id !== "self" && (unreadCounts[contact.id] || 0) > 0 && (
                  <div className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-2 text-[11px] font-bold text-white shadow-md">
                    {unreadCounts[contact.id] > 99 ? "99+" : unreadCounts[contact.id]}
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 w-[240px] rounded-2xl border border-border bg-card shadow-2xl p-1.5 animate-in fade-in-0 zoom-in-95"
          style={{
            left: `${Math.min(contextMenu.x, window.innerWidth - 240)}px`,
            top: `${Math.min(contextMenu.y, window.innerHeight - 240)}px`,
          }}
          onMouseLeave={() => setContextMenu(null)}
        >

          {/* 📌 PIN */}
          <button
            onClick={() => {
              const id = contextMenu.contactId;

              setPreferences((prev) => {
                const next = new Set(prev.pinned);

                next.has(id) ? next.delete(id) : next.add(id);


                savePrefs(userEmail, "pinned", [...next]);

                return { ...prev, pinned: next };
              });

              setContextMenu(null);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm hover:bg-muted transition-colors"
          >
            <Pin size={16} />
            <span>
              {preferences.pinned.has(contextMenu.contactId) ? "Unpin" : "Pin"}
            </span>
          </button>

          {/* 🔇 MUTE */}
          <button
            onClick={() => {
              const id = contextMenu.contactId;

              setPreferences((prev) => {
                const next = new Set(prev.muted);

                next.has(id) ? next.delete(id) : next.add(id);

                const updated = { ...prev, muted: next };
                savePrefs(userEmail, "muted", [...next]);

                return updated;
              });

              setContextMenu(null);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm hover:bg-muted transition-colors"
          >
            <Bell size={16} />
            <span>
              {preferences.muted.has(contextMenu.contactId) ? "Unmute" : "Mute"}
            </span>
          </button>

          {/* ⭐ FAVORITE */}
          <button
            onClick={() => {
              const id = contextMenu.contactId;

              setPreferences((prev) => {
                const next = new Set(prev.favorites);

                next.has(id) ? next.delete(id) : next.add(id);

                const updated = { ...prev, favorites: next };
                savePrefs(userEmail, "favorites", [...next]);

                return updated;
              });

              setContextMenu(null);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm hover:bg-muted transition-colors"
          >
            <Star size={16} className="shrink-0" />
            <span>
              {preferences.favorites.has(contextMenu.contactId)
                ? "Remove from Favorites"
                : "Add to Favorites"}
            </span>
          </button>

          {/* 🗑 DELETE */}
          <button
            onClick={() => {
              setDeleteConfirm({
                contactId: contextMenu.contactId,
                contactName: contextMenu.contactName,
                contactEmail:
                  friends.find((f) => f.id === contextMenu.contactId)?.email || "",
              });
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={16} />
            <span>Delete</span>
          </button>

        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to delete {deleteConfirm?.contactName}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0 transition-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteConfirm) {
                  setDeleteLoading(true);
                  // Add 2-3 second delay
                  await new Promise(resolve => setTimeout(resolve, 2500));

                  try {
                    // Get current user
                    const { data: userData } = await supabase.auth.getUser();
                    if (!userData.user?.email) return;
                    const currentEmail = userData.user.email;

                    // Delete all messages between the two users
                    // 🔥 Sirf apni taraf ke messages hide karo, dusre ke messages untouched
                    await supabase
                      .from("messages")
                      .update({ deleted_for_sender: true })
                      .eq("sender_email", currentEmail)
                      .eq("receiver_email", deleteConfirm.contactEmail);

                    await supabase
                      .from("messages")
                      .update({ deleted_for_receiver: true })
                      .eq("sender_email", deleteConfirm.contactEmail)
                      .eq("receiver_email", currentEmail);

                    // 🔥 friend_requests row delete NAHI karni — sirf apni side se contact hide karo
                    await supabase.from("deleted_contacts").upsert({
                      user_email: currentEmail,
                      contact_email: deleteConfirm.contactEmail,
                    });

                    // Remove from local state
                    setAcceptedFriends((prev) =>
                      prev.filter((f) => f.id !== deleteConfirm.contactId)
                    );
                    setDeleteConfirm(null);
                  } catch (error) {
                    console.error("Error deleting friend:", error);
                  } finally {
                    setDeleteLoading(false);
                  }
                }
              }}
              disabled={deleteLoading}
              className={`bg-red-500 hover:bg-red-600 text-white ${deleteLoading ? 'cursor-not-allowed opacity-40 disabled:pointer-events-auto disabled:cursor-not-allowed' : ''}`}
            >
              <div className="w-full flex items-center justify-center">
                {deleteLoading ? 'Delete' : 'Delete'}
              </div>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* User Footer */}
      {/* User Footer */}
      <div
        className="border-t p-2"
        style={{ paddingBottom: 'max(calc(0.5rem + env(safe-area-inset-bottom, 0px)), 1rem)' }}
      >
        <div className="flex items-center gap-3 rounded-xl p-2">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {getInitials(user?.name) || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {user?.name || "User"} <span className="text-primary">(You)</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              UID: {uid || "loading..."}
            </p>

            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-orange-500"></div>
              <p className="text-[11px] text-muted-foreground">Active now</p>
            </div>
          </div>
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>

            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                <LogOut className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>

            <AlertDialogContent>

              <AlertDialogHeader>
                <AlertDialogTitle>
                  Confirm Logout
                </AlertDialogTitle>

                <AlertDialogDescription>
                  Are you sure you want to logout from Chatify?
                </AlertDialogDescription>
              </AlertDialogHeader>

              <AlertDialogFooter>

                <AlertDialogCancel className="hover:bg-red-500 hover:text-white transition-colors">
                  Cancel
                </AlertDialogCancel>

                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    if (!logoutLoading) {
                      onLogout();
                    }
                  }}
                  className={`flex items-center gap-2 ${logoutLoading
                      ? "cursor-not-allowed opacity-40"
                      : ""
                    }`}
                  style={{ cursor: logoutLoading ? "not-allowed" : "pointer" }}
                >



                  Confirm

                </AlertDialogAction>

              </AlertDialogFooter>

            </AlertDialogContent>

          </AlertDialog>
          <CreateGroupModal
            isOpen={createGroupOpen}
            onClose={() => setCreateGroupOpen(false)}
            friends={acceptedFriends}
            userEmail={userEmail || ""}
            onGroupCreated={(group) => {
              setUserGroups((prev) => [group, ...prev]); // 🔥 turant khud ki list mein dikhao
            }}
          />
        </div>
      </div>
    </div>
  );
};

const ChatArea = React.memo(({
  contact,
  messages,
  onLeaveGroup,
  onSend,
  onTyping,
  isTyping,
  groupTypingUsers,   
  typingProfilesCache, 
  user,
  tick,
  friends,
  setPreviewImage,
  setPreviewTitle,
  contextMenu,
  setContextMenu,
  pinnedMessages,
  groupReads,
  onDeleteForMe,
  onDeleteForEveryone,
  onPinMessage,
  onReplyMessage,
  onForwardMessage,
  onClearAllChats,
  preferences,
  setPreferences,
  setAllMessages,
  onSendAudio,
  onForwardTo,
  isMobile,
  onBack,
}: {
  contact: Contact | null;
  messages: Message[];
  onSend: (text: string, replyTo?: Message | null) => void;
  onTyping: (isTyping: boolean) => void;
  onSendAudio: (audioUrl: string, clientId: string) => void;
  onForwardTo: (targetContact: any, text: string) => void;
  isTyping: boolean;
  user: any;
  groupTypingUsers?: string[];
  typingProfilesCache?: Record<string, { name: string; avatar: string }>;
  tick: number;
  friends: any[];
  setPreviewImage: (url: string | null) => void;
  setPreviewTitle: (value: string | null) => void;
  contextMenu: { isOpen: boolean; position: { x: number; y: number }; messageId: string | null };
  setContextMenu: (menu: { isOpen: boolean; position: { x: number; y: number }; messageId: string | null }) => void;
  pinnedMessages: Set<string>;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForEveryone: (messageId: string) => void;
  onPinMessage: (messageId: string) => void;
  onReplyMessage: (messageId: string) => void;
  onForwardMessage: (messageId: string) => void;
  onClearAllChats: () => Promise<void>;
  isMobile?: boolean;
  onBack?: () => void;
  groupReads?: Record<string, { email: string; name: string; avatar: string; read_at: string }[]>;
  onLeaveGroup?: () => void;
  preferences: PreferencesType;
  setPreferences: React.Dispatch<React.SetStateAction<PreferencesType>>;
  setAllMessages: React.Dispatch<React.SetStateAction<Record<string, Message[]>>>;
}) => {
  // 🎤 Mic recording state
  const [isRecording, setIsRecording] = useState(false);
   const [isAndroidApp] = useState(() => {
    if (typeof window === "undefined") return false;
    return "__TAURI_INTERNALS__" in window && /android/i.test(navigator.userAgent || "");
  });
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains("dark")
  );
  const [groupNameOverride, setGroupNameOverride] = useState<string | null>(null);
const [editingGroupName, setEditingGroupName] = useState(false);
const [groupNameInput, setGroupNameInput] = useState("");
const [savingGroupName, setSavingGroupName] = useState(false);
  const [groupCreatedBy, setGroupCreatedBy] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 😊 Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  
  // 🖼️ Image upload ref
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [contactBio, setContactBio] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const { blockUser, unblockUser, onUserBlocked, onUserUnblocked, blockedUsers, setBlockedUsers, socket } = useSocket();
  const { theme: appTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [groupMembersList, setGroupMembersList] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [bgChangeOpen, setBgChangeOpen] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  const [editMessage, setEditMessage] = useState<Message | null>(null);
  const [editText, setEditText] = useState("");
  const [leaveGroupConfirm, setLeaveGroupConfirm] = useState(false);
  const [leaveGroupLoading, setLeaveGroupLoading] = useState(false);
  // 🔥 Per-contact background colors (persisted)


  // 🔥 Per-contact favourites (persisted)


  const [blockedDialogOpen, setBlockedDialogOpen] = useState<
    false | "blockedByMe" | "blockedByThem"
  >(false);
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
const [adminRequiredDialog, setAdminRequiredDialog] = useState(false);
const [makeAdminConfirm, setMakeAdminConfirm] = useState<{ email: string; name: string } | null>(null);
const [removeAdminConfirm, setRemoveAdminConfirm] = useState<{ email: string; name: string } | null>(null);
const [removeAdminLoading, setRemoveAdminLoading] = useState(false);
const [makeAdminLoading, setMakeAdminLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [isTypingLocal, setIsTypingLocal] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [forwardSearchQuery, setForwardSearchQuery] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [makeAdminListOpen, setMakeAdminListOpen] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
const [addMembersSearch, setAddMembersSearch] = useState("");
const [selectedAddMembers, setSelectedAddMembers] = useState<Set<string>>(new Set());
const [addingMembers, setAddingMembers] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clearConfirm, setClearConfirm] = useState<{ contactId: string; contactName: string; contactEmail: string } | null>(null);
  const [clearLoading, setClearLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [seenByMsgId, setSeenByMsgId] = useState<string | null>(null);
  const [groupAvatarOverride, setGroupAvatarOverride] = useState<string | null>(null);
const [groupPhotoUploading, setGroupPhotoUploading] = useState(false);
const groupPhotoInputRef = useRef<HTMLInputElement | null>(null);
  // 🔥 Get current contact's bg color
  const userEmail = user?.email || "";

  // 🔥 CRITICAL FIX: Normalize contactKey to avoid case sensitivity issues
  const contactKey = (contact?.email || contact?.id || "").toLowerCase().trim();

  // 🔥 Check if current user blocked this contact OR this contact blocked current user
  // Only check preferences.blocked for "blocked by me" - this is the source of truth after unblock
  const isBlockedByMe = contact?.id !== "self" && Array.from(preferences.blocked).some(b => b.toLowerCase().trim() === contactKey);
  // For "blocked by them", check the socket state and make sure we're not blocked by them
  // If they unblocked us, blockedUsers[contactKey] won't include our email
  // 🔥 FIXED: After unblock, immediately clear the blockedByThem status for both UI and messaging
  const isBlockedByThem = contact?.id !== "self" && !isBlockedByMe && (blockedUsers[contactKey]?.includes(userEmail) || false);
  const isBlocked = isBlockedByMe || isBlockedByThem;

  const bgColor = preferences.backgrounds[contactKey] || "white";

  // 🔥 Check if current contact is favourite
  const favorite = preferences.favorites.has(contactKey);

  // 🔥 State for forcing re-render to update timestamps
  const [refreshKey, setRefreshKey] = useState(0);

  // 🔥 Persist bgColors to localStorage


  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);


  // 🔥 Utility function to format read time - Instagram style
  const formatReadTime = (readAt: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - readAt.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "seen just now";
    if (diffMins < 60) return `seen ${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `seen ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `seen ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };
  const handleEditSubmit = async () => {
    if (!editMessage) return;

    const updatedText = editText;

    // 🔥 1. INSTANT UI UPDATE
    setLocalMessages(prev =>
      prev.map(m =>
        m.id === editMessage.id
          ? { ...m, text: updatedText, edited: true }
          : m
      )
    );

    // 🔥 2. UPDATE PARENT STATE (CRITICAL FIX for persistence)
    if (contact) {
      const contactKey = getContactKey(contact);
      setAllMessages(prev => {
        const updated = { ...prev };
        const contactMessages = updated[contactKey] || [];
        updated[contactKey] = contactMessages.map(m =>
          m.id === editMessage.id
            ? { ...m, text: updatedText, edited: true }
            : m
        );
        // Save to localStorage so edit persists on refresh
        localStorage.setItem(`chat_messages_${user?.email || ""}`, JSON.stringify(updated)); // 🔥
        return updated;
      });
    }

    // 🔥 3. DB UPDATE
    await supabase
      .from("messages")
      .update({ content: updatedText, edited: true })
      .eq("id", editMessage.id);

    // 🔥 4. SOCKET SEND
    socket.emit("edit_message", {
      messageId: editMessage.id,
      content: updatedText,
      recipientId: contact?.email
    });

    setEditMessage(null);
  };
    // 🔥 Contact switch hote hi turant bottom pe scroll karo
  useEffect(() => {
    if (!contact) return;
    // thoda delay taaki messages render ho chuke hon DOM mein
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }, 50);
    return () => clearTimeout(timer);
  }, [contact?.id]);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  // 🔥 YE NAYA ADD KARO
useEffect(() => {
  if (!window.visualViewport) return;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const setHeight = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      document.documentElement.style.setProperty(
        '--app-height',
        `${window.visualViewport!.height}px`
      );
    }, 100); // 🔥 100ms debounce - chhote fluctuations ignore honge
  };

  // Pehli baar turant set karo (no debounce needed on mount)
  document.documentElement.style.setProperty(
    '--app-height',
    `${window.visualViewport.height}px`
  );

  window.visualViewport.addEventListener('resize', setHeight);
  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    window.visualViewport.removeEventListener('resize', setHeight);
  };
}, []);
  useEffect(() => {
    const fetchBio = async () => {
      if (!contact) {
        setContactBio(null);
        return;
      }

      if (contact.id === "self") {
        // Apna khud ka bio fetch karo
        const { data: authData } = await supabase.auth.getUser();
        if (!authData?.user?.id) return;
        const { data } = await supabase
          .from("profiles")
          .select("bio")
          .eq("id", authData.user.id)
          .single();
        setContactBio(data?.bio || null);
        return;
      }

      // Dusre contact ka bio
      const { data } = await supabase
        .from("profiles")
        .select("bio")
        .eq("email", contact.email)
        .single();
      setContactBio(data?.bio || null);
    };

    fetchBio();
  }, [contact?.email, contact?.id]);
 useEffect(() => {
  setGroupAvatarOverride(null);
  setGroupNameOverride(null);      // 🔥 NEW
  setEditingGroupName(false);      // 🔥 NEW
}, [contact?.id]);
  // 🔥 Real-time block/unblock reflect karne ke liye
  useEffect(() => {
    const contactKey = (contact?.email || contact?.id || "").toLowerCase().trim();
    const myEmail = (user?.email || "").toLowerCase().trim();

    // Check karo ki kisi ne mujhe block/unblock kiya
    const blockedByThem = blockedUsers?.[contactKey]?.includes(myEmail) || false;

    console.log("[v0] blockedUsers changed - refreshing UI:", blockedByThem);
    setRefreshKey(prev => prev + 1);

  }, [blockedUsers]); // 🔥 blockedUsers change hone par trigger
  // Contact switch hone pe force scroll
  // 🔥 typing dots dikhte hi auto-scroll (agar user last message ke paas hai)
  useEffect(() => {
    if (isTyping && isNearBottomRef.current) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  }, [isTyping]);
  useEffect(() => {
    if (!socket) return;

    const handler = ({ messageId, content }: { messageId: string; content: string }) => {
      setLocalMessages(prev =>
        prev.map(m =>
          m.id === messageId
            ? { ...m, text: content, edited: true }
            : m
        )
      );
    };

    socket.on("message_edited", handler);

    return () => {
      socket.off("message_edited", handler); // ✅ now returns void
    };
  }, [socket]);
  // 🔥 Auto-refresh timestamps every 30 seconds for "seen" messages
  useEffect(() => {
    const hasReadMessages = messages.some(msg => msg.status === "read" && msg.readAt);
    if (!hasReadMessages) return;

    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [messages]);
  useEffect(() => {
  if (!(contact as any)?.isGroup || !contact) return;
  const groupId = contact.id;

  const channel = supabase
    .channel(`group_avatar_updates_${groupId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "groups", filter: `id=eq.${groupId}` },
      (payload: any) => {
        console.log("[realtime] group avatar update received:", payload);
        setGroupAvatarOverride(payload.new.avatar || "");
      }
    )
    .subscribe((status, err) => {
      console.log("[realtime] group_avatar_updates status:", status, err || "");
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, [contact]);

  const fetchGroupMembers = async () => {
  if (!(contact as any)?.isGroup || !contact) return [];
  setLoadingMembers(true);
  try {
    const { data: members, error } = await supabase
      .from("group_members")
      .select("member_email, role")
      .eq("group_id", contact.id);

    if (error) {
      console.error("Error fetching group members:", error);
      return [];
    }

    // 🔥 NEW: fetch group creator
    const { data: groupData } = await supabase
      .from("groups")
      .select("created_by")
      .eq("id", contact.id)
      .single();
    setGroupCreatedBy(groupData?.created_by || null);

    const emails = (members || []).map((m: any) => m.member_email);
    const { data: profiles } = emails.length
      ? await supabase
        .from("profiles")
        .select("email, name, avatar, uid, last_seen")
        .in("email", emails)
      : { data: [] };

    const merged = (members || []).map((m: any) => {
      const profile = profiles?.find((p: any) => p.email === m.member_email);
      return {
        email: m.member_email,
        role: m.role,
        name: profile?.name || m.member_email,
        avatar: profile?.avatar || "",
        uid: profile?.uid || "",
         last_seen: profile?.last_seen || null,
      };
    });

    setGroupMembersList(merged);
    return merged;
  } catch (err) {
    console.error("Error fetching group members:", err);
    return [];
  }
  
   finally {
    setLoadingMembers(false);
  }
};
const handleGroupPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !contact) return;

  setGroupPhotoUploading(true);
  try {
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("https://chatify-backend-mrlh.onrender.com/upload-profile", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      console.error("[GroupPhoto] Upload failed with status:", response.status);
      alert("Image upload failed. Please try again.");
      return;
    }

    const data = await response.json();
    console.log("[GroupPhoto] Uploaded image URL:", data.imageUrl);

    const { data: updateData, error } = await supabase
      .from("groups")
      .update({ avatar: data.imageUrl })
      .eq("id", contact.id)
      .select();

    console.log("[GroupPhoto] DB update result:", updateData, "error:", error);

    if (error) {
      console.error("[GroupPhoto] Failed to update group avatar:", error);
      alert("Failed to save photo: " + error.message);
      return;
    }

    if (!updateData || updateData.length === 0) {
      console.warn("[GroupPhoto] Update ran but no rows affected — likely RLS blocking it");
      alert("Photo update was blocked (permissions issue).");
      return;
    }

    setGroupAvatarOverride(data.imageUrl);
  } catch (err) {
    console.error("[GroupPhoto] Exception:", err);
    alert("Something went wrong uploading the photo.");
  } finally {
    setGroupPhotoUploading(false);
    if (groupPhotoInputRef.current) groupPhotoInputRef.current.value = "";
  }
};
const handleSaveGroupName = async () => {
  if (!contact || !groupNameInput.trim()) return;
  setSavingGroupName(true);
  try {
    const { data: updateData, error } = await supabase
      .from("groups")
      .update({ name: groupNameInput.trim() })
      .eq("id", contact.id)
      .select();

    if (error) {
      console.error("Failed to update group name:", error);
      return;
    }

    if (!updateData || updateData.length === 0) {
      console.warn("[GroupName] 0 rows updated — RLS blocked it");
      return;
    }

    setGroupNameOverride(groupNameInput.trim());

    const { data: editorProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("email", userEmail)
      .single();
    const editorName = editorProfile?.name || userEmail;

    await supabase.from("group_messages").insert({
      group_id: contact.id,
      sender_email: userEmail,
      content: `[SYSTEM]${editorName} changed the group name to ${groupNameInput.trim()}`,
    });

    setEditingGroupName(false);
  } catch (err) {
    console.error("Error updating group name:", err);
  } finally {
    setSavingGroupName(false);
  }
};
const handleRemoveGroupPhoto = async () => {
  if (!contact) return;
  try {
    const { error } = await supabase
      .from("groups")
      .update({ avatar: null })
      .eq("id", contact.id);

    if (error) {
      console.error("Failed to remove group avatar:", error);
      return;
    }

    setGroupAvatarOverride("");
  } catch (err) {
    console.error("Error removing group photo:", err);
  }
};
const availableToAdd = friends.filter(
  (f) => !groupMembersList.some((m) => m.email === (f.email || f.id))
);
const filteredAvailableToAdd = availableToAdd.filter((f) =>
  (f.name || "").toLowerCase().includes(addMembersSearch.toLowerCase())
);

const handleAddMembers = async () => {
  if (!contact || selectedAddMembers.size === 0) return;
  setAddingMembers(true);
  try {
    const emails = Array.from(selectedAddMembers);
    const rows = emails.map((email) => ({
      group_id: contact.id,
      member_email: email,
      role: "member",
    }));

    const { error } = await supabase.from("group_members").insert(rows);
    if (error) {
      console.error("Add members failed:", error);
      return;
    }

    // 🔥 system message - "X added Y"
    const { data: adderProfile } = await supabase
      .from("profiles")
      .select("name")
      .eq("email", userEmail)
      .single();
    const adderName = adderProfile?.name || userEmail;

    const { data: newMemberProfiles } = await supabase
      .from("profiles")
      .select("email, name")
      .in("email", emails);

    const systemRows = emails.map((email) => {
      const name = newMemberProfiles?.find((p: any) => p.email === email)?.name || email;
      return {
        group_id: contact.id,
        sender_email: userEmail,
        content: `[SYSTEM]${adderName} added ${name}###${email}`,
      };
    });
    await supabase.from("group_messages").insert(systemRows);

    await fetchGroupMembers();
    setAddMembersOpen(false);
    setSelectedAddMembers(new Set());
    setAddMembersSearch("");
  } catch (err) {
    console.error("Error adding members:", err);
  } finally {
    setAddingMembers(false);
  }
};

useEffect(() => {
  if (!contactInfoOpen || !(contact as any)?.isGroup) {
    setGroupMembersList([]);
    return;
  }
  fetchGroupMembers();
}, [contactInfoOpen, contact]);
useEffect(() => {
  if (!(contact as any)?.isGroup || !contact) return;
  const groupId = contact.id;

  const channel = supabase
    .channel(`group_members_role_updates_${groupId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` },
      (payload: any) => {
        const updated = payload.new;
        setGroupMembersList((prev) =>
          prev.map((m) =>
            m.email === updated.member_email ? { ...m, role: updated.role } : m
          )
        );
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` },
      (payload: any) => {
        const removed = payload.old;
        setGroupMembersList((prev) =>
          prev.filter((m) => m.email !== removed.member_email)
        );
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [contact]);
  // Sync local messages with prop messages
  useEffect(() => {
    setLocalMessages(prev => {
      return messages.map(msg => {
        const local = prev.find(m => m.id === msg.id);

        // 🔥 agar edited hai toh usko preserve kar
        if (local?.edited) return local;

        return msg;
      });
    });
  }, [messages]);
  useEffect(() => {
    const unsubBlock = onUserBlocked((data) => {
      const myEmail = (userEmail || "").toLowerCase().trim();
      const blocker = (data.blockerUserId || "").toLowerCase().trim();
      const target = (data.recipientId || "").toLowerCase().trim();

      // ❌ agar main blocker hu → ignore
      if (blocker === myEmail) return;

      // ✅ agar mujhe block kiya gaya hai
      if (target === myEmail) {

        setBlockedUsers((prev) => {
          const updated = { ...prev };

          if (!updated[blocker]) {
            updated[blocker] = [];
          }

          if (!updated[blocker].includes(myEmail)) {
            updated[blocker].push(myEmail);
          }

          return updated;
        });

        setRefreshKey(prev => prev + 1);
      }
    });

    const unsubUnblock = onUserUnblocked((data) => {
      const myEmail = (userEmail || "").toLowerCase().trim();
      const blocker = (data.blockerUserId || "").toLowerCase().trim();
      const target = (data.recipientId || "").toLowerCase().trim();

      if (blocker === myEmail) return;

      if (target === myEmail) {

        setBlockedUsers((prev) => {
          const updated = { ...prev };

          if (updated[blocker]) {
            updated[blocker] = updated[blocker].filter(
              (email) => email !== myEmail
            );
          }

          return updated;
        });

        setRefreshKey(prev => prev + 1);
      }
    });

    return () => {
      if (typeof unsubBlock === "function") unsubBlock();
      if (typeof unsubUnblock === "function") unsubUnblock();
    };
  }, []);
  // Cleanup typing timeout on unmount
  useEffect(() => {
    if (!menuOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, [menuOpen]);
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const lastMsg = localMessages[localMessages.length - 1];
    const isOwnMessage = lastMsg?.isOwn === true;

    // Sirf scroll karo agar:
    // 1. Apna message bheja ho
    // 2. Ya dusre ka NAYA message aaya ho (last message isOwn false ho aur bottom ke paas ho)
    if (isOwnMessage) {
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    } else if (isNearBottomRef.current && lastMsg && !lastMsg.isOwn) {
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }
  }, [localMessages.length]); // 🔥 KEY FIX: localMessages.length — sirf jab naya message aaye // 🔥 KEY FIX: localMessages.length — sirf jab naya message aaye

  // 🔥 Trigger re-render when preferences change (to update blocked status immediately)
  useEffect(() => {
    console.log("[v0] Preferences updated, triggering re-render - blocked:", Array.from(preferences.blocked));
  }, [preferences.blocked, blockedUsers, contact?.id]);

  const handleSend = () => {
    const normalizedContactKey = (contact?.email || contact?.id || "").toLowerCase().trim();

    // Only check preferences.blocked for "blocked by me" - this is the source of truth
    const isBlockedByMe = Array.from(preferences.blocked).some(b => b.toLowerCase().trim() === normalizedContactKey);

    // For "blocked by them", check socket state but not if we just unblocked them
    const isBlockedByThem = !isBlockedByMe && (blockedUsers[normalizedContactKey]?.includes(userEmail) || false);

    // 🚫 If THEY blocked YOU
    if (isBlockedByThem) {
      setBlockedDialogOpen("blockedByThem");
      return;
    }

    // 🚫 If YOU blocked THEM
    if (isBlockedByMe) {
      setBlockedDialogOpen("blockedByMe");
      return;
    }

    if (!input.trim()) return;

    // reply logic (same as before)
    if (replyTo) {
      onSend(input.trim(), replyTo);
      setReplyTo(null);
    } else {
      onSend(input.trim());
    }

    setInput("");
  };
  const toggleBlock = async (id: string) => {
    // 🔥 CRITICAL: Normalize ID to match stored format
    const normalizedId = id.toLowerCase().trim();
    console.log("[v0] toggleBlock START - id:", id, "normalized:", normalizedId, "userEmail:", userEmail);

    // Try both possible column names
    let response = await supabase
      .from("user_preferences")
      .select("blocked")
      .eq("user_id", userEmail)
      .single();

    if (response.error) {
      console.log("[v0] user_id filter failed in toggleBlock, trying email:", response.error.message);
      response = await supabase
        .from("user_preferences")
        .select("blocked")
        .eq("email", userEmail)
        .single();
    }

    const { data, error } = response;

    console.log("[v0] toggleBlock - DB fetch error:", error, "data:", data);

    if (error) {
      console.error("[v0] Error fetching blocked list:", error);
      return;
    }

    let blocked: string[] = (data?.blocked ?? []);
    console.log("[v0] toggleBlock - RAW blocked from DB:", blocked);

    // 🔥 Check with EXACT ID first (before normalizing)
    const isBlocked = blocked.includes(normalizedId) || blocked.some(b => (b || "").toLowerCase().trim() === normalizedId);
    console.log("[v0] toggleBlock - isBlocked:", isBlocked, "for:", normalizedId);

    let updatedBlocked: string[];

    if (isBlocked) {
      // ✅ UNBLOCK - Remove this specific ID
      updatedBlocked = blocked.filter((x) => {
        const xNormalized = (x || "").toLowerCase().trim();
        return xNormalized !== normalizedId;
      });
      console.log("[v0] toggleBlock - UNBLOCKING. Updated list:", updatedBlocked);
      unblockUser(normalizedId);
      setUnblockDialogOpen(true);
    } else {
      // ✅ BLOCK - Add this specific ID
      updatedBlocked = [...blocked];
      if (!updatedBlocked.includes(normalizedId)) {
        updatedBlocked.push(normalizedId);
      }
      console.log("[v0] toggleBlock - BLOCKING. Updated list:", updatedBlocked);
      blockUser(normalizedId);
      setBlockedDialogOpen("blockedByMe");
    }

    console.log("[v0] toggleBlock - Saving to DB:", updatedBlocked);
    const { error: updateError } = await supabase
      .from("user_preferences")
      .update({ blocked: updatedBlocked })
      .eq("user_id", userEmail);

    console.log("[v0] toggleBlock - DB update error:", updateError);

    if (updateError) {
      console.error("[v0] Error updating blocked list:", updateError);
      return;
    }

    console.log("[v0] toggleBlock - SUCCESS. Updating UI state with:", updatedBlocked);

    // ✅ UI sync - Use the exact updated list
    setPreferences((prev) => {
      const newPrefs = {
        ...prev,
        blocked: new Set(updatedBlocked),
      };
      console.log("[v0] setPreferences - new blocked set:", newPrefs.blocked);
      return newPrefs;
    });

    // 🔥 Force re-render to immediately update blocked status in UI
    setRefreshKey((prev) => prev + 1);

    console.log("[v0] toggleBlock END");
  };
  // Handle Reply action
  const handleReply = (message: Message) => {
    setReplyTo(message);
    inputRef.current?.focus();
  };

  // Handle Forward action
  const handleForward = (message: Message) => {
    if (message.isDeleted) return;
    setForwardMessage(message);
    setForwardDialogOpen(true);
  };

  // Forward message to a contact
  const handleForwardTo = (targetContact: any) => {
    if (forwardMessage && !forwardMessage.isDeleted) {
      const isImage = forwardMessage.text?.startsWith("[IMAGE]");
      const isAudio = forwardMessage.text?.startsWith("[AUDIO]");

      // 🔥 Media ke liye original text, normal text ke liye prefix lagao
      const textToForward = (isImage || isAudio)
        ? forwardMessage.text
        : `↪ Forwarded: ${forwardMessage.text}`;

      onForwardTo(targetContact, textToForward);
    }
    setForwardDialogOpen(false);
    setForwardMessage(null);
  };
  const isOnline = (lastSeen?: string) => {
    if (!lastSeen) return false;

    try {
      // 🔥 FIX: Multiple format handle karo
      let normalized = lastSeen;
      if (!lastSeen.includes('Z') && !lastSeen.includes('+') && !lastSeen.includes('-', 10)) {
        normalized = lastSeen + 'Z';
      }

      const date = new Date(normalized);
      if (isNaN(date.getTime())) return false; // Invalid date check

      const diff = Date.now() - date.getTime();
      return diff < 180000; // 3 minutes
    } catch {
      return false;
    }
  };
  // 😊 Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (!emojiPickerRef.current?.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker]);

  // 😊 Emoji select handler
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setInput((prev) => prev + emojiData.emoji);
    inputRef.current?.focus();
  };

  // 🖼️ Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB");
      return;
    }

    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("https://chatify-backend-mrlh.onrender.com/upload-profile", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");
      const data = await response.json();
      const imageUrl = data.imageUrl;

      // Send as message with image URL
      onSend(`[IMAGE]${imageUrl}[/IMAGE]`);
    } catch (err) {
      console.error("Image upload failed:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setImageUploading(false);
      // Reset input so same file can be selected again
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  // 🎤 Start recording
  const chunksRef = useRef<Blob[]>([]);
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = []; // 🔥 Reset

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          const clientId = `audio-${Date.now()}`;

          if (contact) {
            const ck = getContactKey(contact);
            setAllMessages(prev => ({
              ...prev,
              [ck]: [...(prev[ck] || []), {
                id: clientId,
                senderId: user?.email || "",
                text: `[AUDIO]${base64Audio}[/AUDIO]`,
                timestamp: Date.now(),
                time: formatMessageDateTime(Date.now()),
                isOwn: true,
                status: "sent" as const,
              }],
            }));
          }

          onSendAudio(`[AUDIO]${base64Audio}[/AUDIO]`, clientId);
        };

        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start(); // 🔥 No timeslice - stop pe ek saath data milega
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 60) { stopRecording(); return 0; }
          return prev + 1;
        });
      }, 1000);

    } catch (err) {
      console.error("Mic access denied:", err);
      alert("Microphone access denied.");
    }
  };

  // 🎤 Stop recording
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setMediaRecorder(null);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingTime(0);
  };
  const isEmojiOnly = (text: string) => {
    if (!text || text.startsWith("[IMAGE]") || text.startsWith("[AUDIO]")) return false;
    // Remove all emoji-related unicode, spaces, and variation selectors
    const stripped = text
      .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\u20E3\s]/gu, "")
      .trim();
    return stripped.length === 0 && text.trim().length > 0;
  };
  const cancelRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      // onstop fire na ho isliye pehle handler remove karo
      mediaRecorder.ondataavailable = null;
      mediaRecorder.onstop = null;
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setMediaRecorder(null);
    setAudioChunks([]);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingTime(0);
  };


if (!contact) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-4 bg-muted/20">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
          <MessageCircle className="h-7 w-7 text-primary-foreground -translate-y-0.5" strokeWidth={1.4} />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">Chatify</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a conversation to start chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col relative">
      {/* Chat Header */}

      {/* Chat Header */}

      <div
        className="flex items-center justify-between border-b px-6 py-3"
        style={{ paddingTop: 'calc(0.25rem + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-3">
          {isMobile && (
            <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-muted -ml-4 shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (contact.avatar && !isBlocked) {
                  setPreviewImage(contact.avatar);
                  setPreviewTitle(getFirstName(contact.name) || "Profile");
                }
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${contact.avatar && !isBlocked ? "cursor-pointer" : "cursor-default"}`}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={isBlocked
                  ? "https://res.cloudinary.com/dpaiyfwdu/image/upload/v1778137689/Blocked_oh9wfk.png"
                  : contact.avatar}
                />
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {(contact as any).isGroup ? <Users className="h-5 w-5" /> : getInitials(contact.name)}
                </AvatarFallback>
              </Avatar>
            </button>
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              {contact.name}
              {contact.id === user?.id && " (You)"}
            </h3>
            <div className="flex items-center gap-2">
              {/* 🔥 Show online/offline status - ONLY if NOT BLOCKED */}
              {!isBlocked && (
                <div className="flex items-center gap-1">
                  {contact.id === "self" ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-orange-500" />
                      <p className="text-xs text-muted-foreground">Active now</p>
                    </>
                  ) : isTyping ? (
                    <p className="text-xs font-medium text-orange-500 animate-pulse">
                      typing...
                    </p>
                  ) : (() => {
                    if (!contact?.last_seen) return null;
                    return (
                      <>
                        {isOnline(contact.last_seen) && (
                          <div className="h-2 w-2 rounded-full bg-orange-500" />
                        )}
                        <p className="text-xs text-muted-foreground">
                          {isOnline(contact.last_seen) ? "Active now" : "Not Active"}
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">

          {/* 🔍 Search Button */}
          {selectionMode ? (
            <>
              <span className="text-sm font-semibold mr-2">
                {selectedMessages.size} selected
              </span>

              <Button
                variant="ghost"
                onClick={() => {
                  const text = messages
                    .filter((m) => selectedMessages.has(m.id))
                    .map((m) => m.text)
                    .join("\n");

                  navigator.clipboard.writeText(text);
                }}
              >
                Copy
              </Button>

              <Button
                variant="ghost"
                className="hover:bg-red-500 hover:text-white transition-colors"
                onClick={() => setDeleteDialogOpen(true)}
              >
                Delete
              </Button>

              <Button
                variant="ghost"
                className="cursor-pointer hover:bg-transparent hover:text-inherit"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedMessages(new Set());
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => setSearchOpen(!searchOpen)}
              >
                <Search className="h-4 w-4" />
              </Button>


            </>
          )}

          {/* 🔥 MENU (Button ke bahar) */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-muted"
            >
              <MoreVertical className="h-5 w-5" />
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                className="absolute right-0 z-50"
                style={{ top: 'calc(3rem + env(safe-area-inset-top, 0px))' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-card rounded-2xl shadow-lg w-60 py-2 border border-border">

                  {/* Contact Info */}
                  {/* Contact Info / Members Info */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContactInfoOpen(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted rounded-xl"
                  >
                    <Users size={18} />
                    <span className="text-sm">
                      {(contact as any)?.isGroup ? "Info" : "Contact info"}
                    </span>
                  </button>
                  {(contact as any)?.isGroup &&
  groupMembersList.find((m) => m.email === userEmail)?.role === "admin" && (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        setMenuOpen(false);
        if (groupMembersList.length === 0) await fetchGroupMembers();
        setMakeAdminListOpen(true);
      }}
      className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted rounded-xl"
    >
      <Shield size={18} />
      <span className="text-sm">Make Admin</span>
    </button>
  )}

                  {/* Clear Chats */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setClearConfirm({
                        contactId: contact.id,
                        contactName: contact.name,
                        contactEmail: contact.email || "",
                      });
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted rounded-xl"
                  >
                    <Trash2 size={18} />
                    <span className="text-sm">Clear all chats</span>
                  </button>


                  {/* 🔥 UNBLOCK - Only show if YOU (current user) blocked them */}
                  {/* ✅ YOU BLOCKED THEM */}
                  {/* ✅ UNBLOCK (YOU BLOCKED THEM) */}
                  {contact?.id !== "self" && !(contact as any)?.isGroup && isBlockedByMe && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await toggleBlock(contactKey);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted rounded-xl"
                    >
                      <Ban size={18} />
                      <span className="text-sm">Unblock</span>
                    </button>
                  )}

                  {/* ✅ BLOCK (ONLY ONE CONDITION — FIXED) */}
                  {contact?.id !== "self" && !(contact as any)?.isGroup && !isBlockedByMe && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        await toggleBlock(contactKey);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted rounded-xl"
                    >
                      <Ban size={18} />
                      <span className="text-sm">Block</span>
                    </button>
                  )}
                  {/* 🔥 CHANGE BACKGROUND */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();

                      const id = contactKey;
                      const newBg = "dark"; // example

                      const { data } = await supabase
                        .from("user_preferences")
                        .select("backgrounds")
                        .eq("user_id", userEmail)
                        .single();

                      let backgrounds = data?.backgrounds || {};

                      backgrounds[id] = newBg;

                      await supabase
                        .from("user_preferences")
                        .update({ backgrounds })
                        .eq("user_id", userEmail);

                      setBgChangeOpen(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted rounded-xl whitespace-nowrap"
                  >
                    <ImageIcon size={18} className="shrink-0" />
                    <span className="text-sm">Change background</span>
                  </button>


                  {/* 🔥 FAVORITES (ARRAY BASED) */}
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();

                      const id = contactKey;

                      const { data } = await supabase
                        .from("user_preferences")
                        .select("favorites")
                        .eq("user_id", userEmail)
                        .single();

                      let favorites = data?.favorites || [];

                      if (favorites.includes(id)) {
                        favorites = favorites.filter((x) => x !== id);
                      } else {
                        favorites.push(id);
                      }

                      await supabase
                        .from("user_preferences")
                        .update({ favorites })
                        .eq("user_id", userEmail);

                      setPreferences((prev) => ({
                        ...prev,
                        favorites: new Set(favorites),
                      }));

                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted rounded-xl"
                  >
                    <Star size={18} />
                    <span className="text-sm">
                      {preferences.favorites.has(contactKey)
                        ? "Remove from favourite"
                        : "Add to favourite"}
                    </span>
                  </button>
                  {/* 🔥 LEAVE GROUP - sirf group ke liye, sabse end mein */}
                  {(contact as any)?.isGroup && (
                   <button
  onClick={async (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    const members = groupMembersList.length > 0 ? groupMembersList : await fetchGroupMembers();
    const me = members.find((m) => m.email === userEmail);
    const isAdmin = me?.role === "admin";
    const others = members.filter((m) => m.email !== userEmail);
    const hasOtherAdmin = others.some((m) => m.role === "admin");

    if (isAdmin && others.length > 0 && !hasOtherAdmin) {
      setAdminRequiredDialog(true);
    } else {
      setLeaveGroupConfirm(true);
    }
  }}
  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted rounded-xl"
>
  <LogOut size={18} />
  <span className="text-sm">Leave Group</span>
</button>
                  )}



                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Pinned Messages Bar */}
      {Array.from(pinnedMessages).length > 0 && (
        <div className="border-b bg-muted/30 px-6 py-2">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              {Array.from(pinnedMessages).length} Pinned message{Array.from(pinnedMessages).length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-1 space-y-1 max-h-20 overflow-y-auto">
            {Array.from(pinnedMessages).map((msgId) => {
              const pinnedMsg = messages.find((m) => m.id === msgId);
              if (!pinnedMsg) return null;
              return (
                <div
                  key={msgId}
                  className="flex items-center justify-between gap-2 text-xs bg-background/60 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-background transition-colors"
                  onClick={() => {
                    // Scroll to pinned message
                    const msgElement = document.getElementById(`msg-${msgId}`);
                    if (msgElement) {
                      msgElement.scrollIntoView({ behavior: "smooth", block: "center" });
                      msgElement.classList.add("bg-primary/20");
                      setTimeout(() => {
                        msgElement.classList.remove("bg-primary/20");
                      }, 2000);
                    }
                  }}
                >
                  <p className="truncate flex-1">
                    <span className="font-medium">{pinnedMsg.isOwn ? "You" : contact?.name}: </span>
                    {pinnedMsg.isDeleted ? <span className="italic">message deleted</span> : pinnedMsg.text}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Unpin message using the handler
                      onPinMessage(msgId);
                    }}
                    className="p-1 rounded hover:bg-muted transition-colors"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <ScrollArea
        className={`flex-1 w-full px-6 py-4 transition-colors ${bgColor === "dark" ? "bg-[#1a1a1a]" :

            bgColor === "blue" ? "bg-blue-50" :
              bgColor === "green" ? "bg-green-50" :
                bgColor === "purple" ? "bg-purple-50" :
                  bgColor === "orange" ? "bg-orange-50" :

                    bgColor === "red" ? "bg-red-50" :
                      bgColor === "yellow" ? "bg-yellow-50" :
                        bgColor === "pink" ? "bg-pink-50" :
                          bgColor === "indigo" ? "bg-indigo-50" :
                            bgColor === "teal" ? "bg-teal-50" :
                              bgColor === "cyan" ? "bg-cyan-50" :
                                bgColor === "lime" ? "bg-lime-50" :
                                  bgColor === "rose" ? "bg-rose-50" :

                                    bgColor === "sunset" ? "bg-gradient-to-r from-pink-50 to-orange-50" :  // 🔥 NEW

                                      bgColor === "glass" ? "bg-white" :

                                        "bg-background"
          }`}
        onScrollCapture={(e) => {
          const el = e.currentTarget.querySelector('[data-radix-scroll-area-viewport]');
          if (el) {
            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            isNearBottomRef.current = distanceFromBottom < 100;
          }
        }}
      >
        <div className="space-y-4 min-w-0">
          {localMessages.map((msg) => {
  if ((msg as any).isSystem) {
    return (
      <div key={msg.id} className="flex justify-center my-2">
        <span className="text-xs font-medium text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-1 rounded-full">
          {msg.text}
        </span>
      </div>
    );
  }
  return (
  <div
    key={msg.id}
    id={`msg-${msg.id}`}
    onClick={(e) => {
                if (selectionMode) {
                  e.stopPropagation();
                  setSelectedMessages((prev) => {
                    const set = new Set(prev);
                    set.has(msg.id) ? set.delete(msg.id) : set.add(msg.id);
                    return set;
                  });
                }
              }}

              className={`flex flex-col ${msg.isOwn ? "items-end" : "items-start"} transition-all duration-300 select-none [-webkit-touch-callout:none]`}

              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({
                  isOpen: true,
                  position: { x: e.pageX, y: e.pageY },
                  messageId: msg.id,
                });
              }}
            >

              {/* 🔥 MESSAGE BUBBLE */}
              <div
                className={`relative max-w-[70vw] sm:max-w-[60vw] min-w-0 break-words [overflow-wrap:anywhere] rounded-2xl
    ${
                  // Pure emoji message - no bubble at all
                  !msg.isDeleted && msg.text && isEmojiOnly(msg.text)
                    ? "bg-transparent px-1 py-0.5"
                    // Image message - no bubble
                    : msg.text?.startsWith("[IMAGE]")
                      ? "bg-transparent p-0"
                      : msg.text?.startsWith("[AUDIO]")   // 🔥 ADD THIS
                        ? "bg-transparent p-0"
                        : msg.isOwn
                          ? "bg-primary text-primary-foreground px-3 py-1.5"
                          : "receiver-bubble bg-[hsl(30,20%,95%)] text-[#1a1a1a] px-3 py-1.5"
                  }
  `}
              >
                {/* 🔥 GROUP SENDER NAME - sirf group mein, apne message pe nahi */}
                {!msg.isOwn && (contact as any)?.isGroup && (msg as any).groupSenderName && (
                  <p className="text-xs font-semibold text-primary mb-0.5">
                    {(msg as any).groupSenderName}
                  </p>
                )}

                {msg.replyTo && !msg.isDeleted && (
                  <div
                    className={`mb-1.5 rounded-xl px-2 py-1.5 text-xs border-l-4 border-white/60 cursor-pointer
        ${msg.isOwn ? "bg-white/20" : "bg-black/10"}
      `}
                    onClick={() => {
                      const el = document.getElementById(`msg-${msg.replyTo?.id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.classList.add("ring-2", "ring-primary");
                        setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2000);
                      }
                    }}
                  >
                    <p className={`font-semibold truncate ${msg.isOwn ? "text-white/80" : "text-primary"}`}>
                      {msg.replyTo.senderName}
                    </p>
                    <p className={`truncate max-w-[200px] ${msg.isOwn ? "text-white/70" : "text-muted-foreground"}`}>
                      {msg.replyTo.text}
                    </p>
                  </div>
                )}

                {/* ✅ SELECT TICK */}
                {selectionMode && (
                  <div className="absolute -left-7 top-1 z-10">
                    <div
                      className={`h-5 w-5 rounded-full flex items-center justify-center border-2 ${selectedMessages.has(msg.id)
                          ? "bg-[#E8D5C4] border-[#E8D5C4]"
                          : "border-gray-400"
                        }`}
                    >
                      {selectedMessages.has(msg.id) && (
                        <Check className="h-3 w-3 text-orange-600" />
                      )}
                    </div>
                  </div>
                )}

                {/* PIN */}
                {pinnedMessages.has(msg.id) && (
                  <div className="text-xs flex gap-1 mb-1">
                    <Pin size={12} /> Pinned
                  </div>
                )}

                {/* TEXT */}
                <div className={`break-words whitespace-pre-wrap ${!msg.isDeleted && msg.text && isEmojiOnly(msg.text)
                    ? "text-4xl leading-none"
                    : "text-sm"
                  }`}>
                  {msg.isDeleted ? (
                    <span className="italic opacity-70">message deleted</span>
                  ) : msg.text?.startsWith("[IMAGE]") ? (
                    <img
                      src={msg.text.replace("[IMAGE]", "").replace("[/IMAGE]", "")}
                      alt="Sent image"
                      className="max-w-[240px] max-h-[240px] rounded-xl object-cover cursor-pointer"
                      onClick={() => {
                        const url = msg.text.replace("[IMAGE]", "").replace("[/IMAGE]", "");
                        setPreviewImage(url);
                        setPreviewTitle("Image");
                      }}
                    />
                  ) : msg.text?.startsWith("[AUDIO]") ? (
                    <audio
                      controls
                      src={msg.text.replace("[AUDIO]", "").replace("[/AUDIO]", "")}
                      className="max-w-[240px] h-10"
                    />
                  ) : msg.text === "[AUDIO_UPLOADING]" ? (
                    <div className="flex items-center gap-2 px-2 py-1">

                      <span className="text-xs text-white animate-pulse">Sending voice message</span>
                    </div>
                  ) : (
                    <span>{msg.text}</span>
                  )}
                  {!msg.isDeleted && msg.edited && (
                    <span className={`ml-1 text-[10px] ${msg.isOwn ? "text-gray-300" : "text-gray-400"}`}>
                      (edited)
                    </span>
                  )}
                </div>
              </div>

              {/* 🔥🔥🔥 YAHI PE ADD KARNA THA (IMPORTANT) */}
              {msg.isOwn ? (
                <div
                  data-timestamp
                  className={`flex items-center gap-2 mt-1 text-[10px] justify-end font-medium ${bgColor === 'dark'
                      ? 'text-white/70 [&>span]:text-white/70'
                      : bgColor !== 'white'
                        ? isDark
                          ? 'text-white/80 [&>span]:text-white/80'
                          : 'text-black/60 [&>span]:text-black/60'
                        : 'text-muted-foreground'
                    }`}
                >
                  <span>{msg.time}</span>
{(contact as any)?.isGroup ? (
  (() => {
    const readers = (groupReads?.[msg.id] || []).filter((r) => r.email !== user?.email);
    if (readers.length === 0) return null;
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSeenByMsgId(msg.id);
        }}
        className="flex -space-x-1.5 hover:opacity-80 transition-opacity"
      >
        {readers.slice(0, 3).map((r) => (
          <Avatar key={r.email} className="h-4 w-4 border border-background">
            <AvatarImage src={r.avatar} />
            <AvatarFallback className="text-[6px] bg-primary/10 text-primary">
              {getInitials(r.name)}
            </AvatarFallback>
          </Avatar>
        ))}
      </button>
    );
  })()
) : msg.status === "read" && msg.readAt ? (
  <span key={refreshKey}>{formatReadTime(new Date(msg.readAt))}</span>
) : msg.status === "delivered" ? (
  <span>Delivered</span>
) : msg.status === "sent" ? (
  <span>Sent</span>
) : null}
                </div>
              ) : (
                <div
                  data-timestamp
                  className={`flex items-center gap-2 mt-1 text-[10px] justify-start font-medium ${bgColor === 'dark'
                      ? 'text-white/70 [&>span]:text-white/70'
                      : bgColor !== 'white'
                        ? isDark
                          ? 'text-white/80 [&>span]:text-white/80'
                          : 'text-black/60 [&>span]:text-black/60'
                        : 'text-muted-foreground'
                    }`}
                >
                  <span>{msg.time}</span>
                </div>
              )}

            </div>
            );
        })}

          {/* Typing indicator - ONLY shown to receiver when other person is typing */}
 {/* Typing indicator - individual chat */}
{!(contact as any)?.isGroup && isTyping && (
  <div className="flex justify-start">
    <div className="max-w-[70%] rounded-2xl rounded-bl-md bg-muted px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDuration: '1.5s', animationDelay: "0ms" }}></div>
          <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDuration: '1.5s', animationDelay: "200ms" }}></div>
          <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDuration: '1.5s', animationDelay: "400ms" }}></div>
        </div>
      </div>
    </div>
  </div>
)}

{/* Typing indicator - group chat, with avatars */}
{(contact as any)?.isGroup && groupTypingUsers && groupTypingUsers.length > 0 && (
  <div className="flex justify-start items-end gap-1.5">
    <div className="flex -space-x-2">
      {groupTypingUsers.slice(0, 3).map((email) => {
        const profile = typingProfilesCache?.[email];
        return (
          <Avatar
            key={email}
            className={`${groupTypingUsers.length > 1 ? "h-8 w-8" : "h-7 w-7"} border-2 border-background transition-all`}
          >
            <AvatarImage src={profile?.avatar} />
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {getInitials(profile?.name)}
            </AvatarFallback>
          </Avatar>
        );
      })}
    </div>
    <div className="max-w-[70%] rounded-2xl rounded-bl-md bg-muted px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDuration: '1.5s', animationDelay: "0ms" }}></div>
          <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDuration: '1.5s', animationDelay: "200ms" }}></div>
          <div className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDuration: '1.5s', animationDelay: "400ms" }}></div>
        </div>
      </div>
    </div>
  </div>
)}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Reply Preview Bar */}
      {replyTo && (
        <div className="border-t border-b bg-muted/50 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary">
                  Replying to {contact?.name}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {replyTo.isDeleted ? "message deleted" : replyTo.text}
                </p>
              </div>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      {/* Message Input */}
      <div
        className="border-t px-6 py-4"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Hidden image file input */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-24 right-6 z-50"
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={appTheme === "dark" ? Theme.DARK : Theme.LIGHT}
              width={320}
              height={400}
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* 🖼️ Image Upload Button (was red-circled) */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
            disabled={isBlocked || imageUploading}
            onClick={() => imageInputRef.current?.click()}
            title="Send image"
          >
            <ImageIcon className="h-5 w-5" />
          </Button>

          {/* Input + emoji picker wrapper */}
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              placeholder={
                isRecording
                  ? `🎤 Recording... ${recordingTime}s`
                  : isBlockedByMe || isBlockedByThem
                    ? isBlockedByThem
                      ? "You have been blocked by this user"
                      : "You blocked this user"
                    : "Type a message..."
              }
              value={isRecording ? "" : input}
              disabled={isBlockedByMe || isBlockedByThem || isRecording}
              onChange={(e) => {
                const newValue = e.target.value;
                setInput(newValue);
                const shouldBeTyping = !!newValue.trim();

                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

                // 🔥 Har keystroke pe typing true bhejo
                if (shouldBeTyping) {
                  onTyping(true);  // Hamesha true bhejo, timeout reset hoga
                } else {
                  onTyping(false);
                }
              }}
              onBlur={() => {
                setIsTypingLocal(false);
                onTyping(false);
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSend();
                  setIsTypingLocal(false);
                  onTyping(false);
                  if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                }
              }}
              className={`h-12 rounded-xl border-none bg-muted pr-12 text-sm ${isBlockedByMe || isBlockedByThem
                  ? "cursor-not-allowed opacity-50 [&::placeholder]:text-red-500"
                  : isRecording
                    ? "[&::placeholder]:text-red-500 [&::placeholder]:animate-pulse"
                    : ""
                }`}
            />

                        {/* 😊 Emoji Button - Android app pe hide, phone ka keyboard emoji use hoga */}
            {!isAndroidApp && (
              <Button
                variant="ghost"
                size="icon"
                className={`absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg transition-colors ${showEmojiPicker ? "bg-primary/10 text-primary" : ""
                  }`}
                onMouseDown={(e) => e.preventDefault()}
                onTouchStart={(e) => {
                  e.preventDefault();
                  inputRef.current?.blur();
                }}
                onClick={() => {
                  inputRef.current?.blur();
                  setShowEmojiPicker((prev) => !prev);
                }}
                disabled={isBlockedByMe || isBlockedByThem}
                title="Emoji"
              >
                <Smile className="h-5 w-5 text-muted-foreground" />
              </Button>
            )}
          </div>

          {/* 🎤 Mic Button (was red-circled) */}
          <Button
            variant="ghost"
            size="icon"
            disabled={isBlockedByMe || isBlockedByThem}
            onClick={isRecording ? cancelRecording : startRecording} // 🔥 cancel karo
            className={`h-10 w-10 shrink-0 rounded-xl transition-colors ${isRecording
                ? "bg-red-500 text-white hover:bg-red-600 animate-pulse"
                : ""
              }`}
            title={isRecording ? "Cancel recording" : "Voice message"}
          >
            <Mic className="h-5 w-5" />
          </Button>

          {/* Send Button */}

          <Button
            onClick={() => {
              if (isRecording) {
                stopRecording(); // 🔥 recording band karo aur send ho jaega
              } else {
                handleSend();
              }
            }}
            disabled={isBlockedByMe || isBlockedByThem}
            size="icon"
            className="h-12 w-12 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Message Context Menu */}
      {contextMenu.messageId && (
        <MessageContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}

          onCopy={() => {
            if (contextMenu.messageId) {
              const message = messages.find((m) => m.id === contextMenu.messageId);
              if (message && message.text) navigator.clipboard.writeText(message.text);
            }
            setContextMenu({ ...contextMenu, isOpen: false });
          }}

          onEdit={() => {
            const msg = messages.find(m => m.id === contextMenu.messageId);
            if (!msg) return;
            setEditMessage(msg);
            setEditText(msg.text);
            setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, messageId: null });
          }}

          onPin={() => {
            if (contextMenu.messageId) {
              onPinMessage(contextMenu.messageId);
              setContextMenu({ ...contextMenu, isOpen: false });
            }
          }}

          onDeleteForMe={() => {
            if (contextMenu.messageId) {
              onDeleteForMe(contextMenu.messageId);
              setContextMenu({ ...contextMenu, isOpen: false });
            }
          }}

          onDeleteForEveryone={() => {
            if (contextMenu.messageId) {
              onDeleteForEveryone(contextMenu.messageId);
              setContextMenu({ ...contextMenu, isOpen: false });
            }
          }}

          onReply={() => {
            if (contextMenu.messageId) {
              const message = messages.find((m) => m.id === contextMenu.messageId);
              if (message) {
                handleReply(message);
                setContextMenu({ ...contextMenu, isOpen: false });
              }
            }
          }}

          onForward={() => {
            if (contextMenu.messageId) {
              const message = messages.find((m) => m.id === contextMenu.messageId);
              if (message && !message.isDeleted) {
                handleForward(message);
                setContextMenu({ ...contextMenu, isOpen: false });
              }
            }
          }}


          onSelect={() => {
            if (contextMenu.messageId) {
              setSelectionMode(true);
              setSelectedMessages(new Set([contextMenu.messageId]));
              setContextMenu({ ...contextMenu, isOpen: false });
            }
          }}

          isOwn={messages.find((m) => m.id === contextMenu.messageId)?.isOwn || false}
          isPinned={contextMenu.messageId ? pinnedMessages.has(contextMenu.messageId) : false}
          isSelfChat={contact?.id === "self"}
        />
      )}

      {/* Forward Message Dialog */}
      <AlertDialog open={forwardDialogOpen} onOpenChange={(open) => {
        setForwardDialogOpen(open);
        if (!open) setForwardSearchQuery("");
      }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Forward Message</AlertDialogTitle>
            <AlertDialogDescription>
              Select a contact to forward this message to:
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={forwardSearchQuery}
              onChange={(e) => setForwardSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="max-h-64 overflow-y-auto py-2">
            {(() => {
              const allContacts = [
                {
                  id: "self",
                  name: user?.name ? `${user.name} (You)` : "You",
                  avatar: user?.avatar || "",
                  email: user?.email || "",
                },
                ...friends,
              ];

              const filtered = allContacts.filter((c) =>
                c.name.toLowerCase().includes(forwardSearchQuery.toLowerCase())
              );

              if (allContacts.length === 0) {
                return <p className="text-sm text-muted-foreground text-center py-4">No contacts available</p>;
              }

              if (filtered.length === 0) {
                return <p className="text-sm text-muted-foreground text-center py-4">No contacts found</p>;
              }

              return filtered.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => handleForwardTo(contact)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={contact.avatar} />
                    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
  {(contact as any).isGroup ? <Users className="h-5 w-5" /> : getInitials(contact.name)}
</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{contact.name}</p>
                  </div>
                </button>
              ));
            })()}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors">
              Cancel
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Chats Dialog */}
      <AlertDialog open={!!clearConfirm} onOpenChange={(open) => !open && setClearConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Chats</AlertDialogTitle>
            <AlertDialogDescription>
              Do you want to clear all chats with {clearConfirm?.contactName}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0 transition-none">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setClearLoading(true);
                // Add 2-3 second delay
                await new Promise(resolve => setTimeout(resolve, 2500));

                try {
                  await onClearAllChats();
                  setClearConfirm(null);
                } catch (error) {
                  console.error("Error clearing chats:", error);
                } finally {
                  setClearLoading(false);
                }
              }}
              disabled={clearLoading}
              className={`bg-red-500 hover:bg-red-600 text-white ${clearLoading ? 'cursor-not-allowed opacity-40 disabled:pointer-events-auto disabled:cursor-not-allowed' : ''}`}
            >
              <div className="w-full flex items-center justify-center">
                {clearLoading ? 'Clear' : 'Clear'}
              </div>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Leave Group Confirmation Dialog */}
      <AlertDialog open={leaveGroupConfirm} onOpenChange={setLeaveGroupConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave {contact?.name}? You will need to be added back by a member to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0 transition-none">
              Cancel
            </AlertDialogCancel>
<AlertDialogAction
  disabled={leaveGroupLoading}
  onClick={(e) => {
    e.preventDefault();
    if (leaveGroupLoading) return;

    setLeaveGroupLoading(true);
    setTimeout(async () => {
      try {
        onLeaveGroup?.();
      } catch (err) {
        console.error("Error leaving group:", err);
      } finally {
        setLeaveGroupLoading(false);
        setLeaveGroupConfirm(false);
      }
    }, 1500);
  }}
  className={`bg-red-500 hover:bg-red-600 text-white ${leaveGroupLoading ? 'cursor-not-allowed opacity-40 disabled:pointer-events-auto disabled:cursor-not-allowed' : ''}`}
>
  Leave
</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      

      {/* Contact Info Dialog */}
    
      {contactInfoOpen && contact && (() => {

        const isBlocked = isUserBlocked(contact, userEmail, preferences, blockedUsers);
        const isGroup = (contact as any)?.isGroup;

        return (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
            <div className="bg-card rounded-2xl p-6 w-full max-w-[380px] shadow-xl border border-border max-h-[80vh] flex flex-col">

              <h2 className="text-lg font-semibold mb-4">
                {isGroup ? "Info" : "Contact Info"}
              </h2>

              <div className="space-y-4 overflow-y-auto flex-1">

                {/* Avatar + Name */}
<div className="flex flex-col items-center gap-2 pt-2">
  <div className="flex items-center gap-4 w-full">
 <div className="relative">
 <Avatar className="h-20 w-20 border-4 border-orange-500/20">
    <AvatarImage src={
      groupAvatarOverride !== null ? groupAvatarOverride : contact.avatar
    } />
    <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
      {isGroup ? <Users className="h-7 w-7" /> : getInitials(contact.name)}
    </AvatarFallback>
  </Avatar>

  {isGroup &&
    (groupAvatarOverride !== null ? groupAvatarOverride : contact.avatar) && (
      <button
        onClick={handleRemoveGroupPhoto}
        className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 shadow-md z-10"
      >
        <X size={14} />
      </button>
    )}
</div>

      <div className="flex-1 min-w-0">
        {isGroup && editingGroupName ? (
        <div className="space-y-2 pr-1">
          <input
            autoFocus
            value={groupNameInput}
            onChange={(e) => setGroupNameInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveGroupName();
              if (e.key === "Escape") setEditingGroupName(false);
            }}
            className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setEditingGroupName(false)}
              className="flex-1 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-red-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
                        <button
              onClick={handleSaveGroupName}
              disabled={savingGroupName || !groupNameInput.trim()}
              className="flex-1 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <p className="font-semibold text-lg truncate">
            {isGroup && groupNameOverride !== null ? groupNameOverride : contact.name}
          </p>
          {isGroup && (
            <button
              onClick={() => {
                setGroupNameInput(groupNameOverride !== null ? groupNameOverride : contact.name);
                setEditingGroupName(true);
              }}
              className="p-1 rounded hover:bg-muted transition-colors shrink-0"
              title="Edit group name"
            >
              <Pencil size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>
      )}
      {isGroup && (
        <p className="text-xs text-muted-foreground">
          {groupMembersList.length} member{groupMembersList.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  </div>

  {/* 🔥 Add/Change Photo button - ab sab members ko */}
  {isGroup && (
    <>
      <input
        ref={groupPhotoInputRef}
        type="file"
        accept="image/*"
        onChange={handleGroupPhotoChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => groupPhotoInputRef.current?.click()}
        disabled={groupPhotoUploading}
        className="text-xs text-orange-500 hover:text-orange-600 font-medium disabled:cursor-not-allowed disabled:opacity-60"
      >
        {groupPhotoUploading
          ? "Uploading..."
          : (groupAvatarOverride !== null ? groupAvatarOverride : contact.avatar)
            ? "Change Group Photo"
            : "Add Group Photo"}
      </button>
    </>
  )}
</div>

                {/* 🔥 GROUP: MEMBERS LIST */}
                {isGroup ? (
                  <div className="border-t pt-4">
                   <div className="flex items-center justify-between mb-2">
  <p className="text-xs font-medium text-muted-foreground">Members</p>
  {groupMembersList.find((m) => m.email === userEmail)?.role === "admin" && (
    <button
      onClick={() => setAddMembersOpen(true)}
      className="text-xs text-orange-600 hover:text-orange-700 font-medium"
    >
      + Add Members
    </button>
  )}
</div>
                    {loadingMembers ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="h-6 w-6 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin"></div>
                      </div>
                    ) : groupMembersList.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No members found</p>
                    ) : (
                      <div className="space-y-1">
                        {groupMembersList.map((member) => (
                          <div
                            key={member.email}
                            className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted transition-colors"
                          >
                            <div className="relative">
  <Avatar className="h-10 w-10">
    <AvatarImage src={member.avatar} />
    <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
      {getInitials(member.name)}
    </AvatarFallback>
  </Avatar>
  {(member.email === userEmail || isOnline(member.last_seen)) && (
    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-orange-500" />
  )}
</div>
<div className="flex-1 min-w-0">
  <p className="text-sm font-medium truncate">
    {member.email === userEmail ? `${member.name} (You)` : member.name}
  </p>
  {member.uid && (
    <p className="text-[11px] text-muted-foreground truncate">
      UID: {member.uid}
    </p>
  )}
<div className="flex items-center gap-1.5 mt-0.5">
 
  <span className="text-[11px] text-muted-foreground">
    {member.email === userEmail
      ? "Active now"
      : isOnline(member.last_seen)
        ? "Active now"
        : "Not Active"}
  </span>
</div>
</div>
{member.role !== "admin" &&
  member.email !== userEmail &&
  groupMembersList.find((m) => m.email === userEmail)?.role === "admin" && (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setMakeAdminConfirm({ email: member.email, name: member.name });
      }}
      className="text-[11px] text-orange-600 hover:text-orange-700 font-medium flex-shrink-0"
    >
      Make Admin
    </button>
  )}
{/* Admin badge - creator ke liye koi Remove Admin button nahi, sirf badge */}
{member.role === "admin" && member.email === groupCreatedBy && (
  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 flex-shrink-0">
    Admin
  </span>
)}
{/* Admin badge + Remove Admin button - promoted admins ke liye (creator nahi) */}
{member.role === "admin" && member.email !== groupCreatedBy && (
  <div className="flex items-center gap-2 flex-shrink-0">
    {member.email !== userEmail &&
      groupMembersList.find((m) => m.email === userEmail)?.role === "admin" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setRemoveAdminConfirm({ email: member.email, name: member.name });
          }}
          className="text-[11px] text-red-600 hover:text-red-700 font-medium"
        >
          Remove Admin
        </button>
      )}
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400">
      Admin
    </span>
  </div>
)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* STATUS (ONLY if NOT BLOCKED) */}
                    {!isUserBlocked(contact, userEmail, preferences, blockedUsers) && (() => {
                      if (contact.id !== "self" && !contact?.last_seen) return null;

                      return (
                        <div className="border-t pt-4">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Status
                          </p>
                          <div className="flex items-center gap-2">
                            {(contact.id === "self" || isOnline(contact?.last_seen)) && (
                              <div className="h-2 w-2 rounded-full bg-orange-500" />
                            )}
                            <span className="text-sm font-medium">
                              {contact.id === "self"
                                ? "Active now"
                                : isOnline(contact?.last_seen)
                                  ? "Active now"
                                  : "Not Active"}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* BIO */}
                    {!isBlocked && (
                      <div className="border-t pt-4">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Bio</p>
                        <p className="text-sm text-foreground">
                          {contactBio
                            ? contactBio
                            : <span className="text-muted-foreground">No bio added</span>
                          }
                        </p>
                      </div>
                    )}
                  </>
                )}

              </div>

              {/* Close Button */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setContactInfoOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-muted text-sm transition-all hover:bg-red-500 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Background Change Dialog */}
      {bgChangeOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">

          <div className="bg-card rounded-2xl p-6 w-[380px] shadow-xl border border-border">

            <h2 className="text-lg font-semibold mb-4">Change Background</h2>

            {/* 🔥 GRID */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { name: 'Dark', key: 'dark', color: 'bg-[#1a1a1a]' },
                { name: 'Blue', key: 'blue', color: 'bg-blue-500' },
                { name: 'Green', key: 'green', color: 'bg-green-500' },
                { name: 'Purple', key: 'purple', color: 'bg-purple-500' },
                { name: 'Orange', key: 'orange', color: 'bg-orange-500' },
                { name: 'Red', key: 'red', color: 'bg-red-500' },
                { name: 'Yellow', key: 'yellow', color: 'bg-yellow-400' },
                { name: 'Pink', key: 'pink', color: 'bg-pink-500' },
                { name: 'Indigo', key: 'indigo', color: 'bg-indigo-500' },
                { name: 'Teal', key: 'teal', color: 'bg-teal-500' },
                { name: 'Cyan', key: 'cyan', color: 'bg-cyan-500' },
                { name: 'Lime', key: 'lime', color: 'bg-lime-500' },
                { name: 'Rose', key: 'rose', color: 'bg-rose-500' },
                { name: 'Sunset', key: 'sunset', color: 'bg-gradient-to-r from-pink-500 to-orange-500' },

                // FIXED GLASS
                {
                  name: 'Glass',
                  key: 'glass',
                  color: 'bg-white backdrop-blur-md'
                },
              ].map((bg) => (
                <button
                  key={bg.key}
                  onClick={() => {
                    setPreferences((prev) => {
                      const updatedBg = {
                        ...prev.backgrounds,
                        [contactKey]: bg.key
                      };

                      savePrefs(user?.email || "", "backgrounds", updatedBg);

                      return {
                        ...prev,
                        backgrounds: updatedBg
                      };
                    });

                    setBgChangeOpen(false);
                  }}
                  className={`
        h-20 rounded-xl transition-all duration-200
        ${bg.color}
        border-2

        ${bg.key === "dark"
                      ? "border-gray-500"   // ✅ dark tile visible
                      : bg.key === "glass"
                        ? "border-gray-300"
                        : "border-transparent"
                    }

        ${preferences.backgrounds[contactKey] === bg.key
                      ? "ring-2 ring-orange-500"
                      : ""
                    }

        hover:scale-105
        hover:ring-2 hover:ring-red-500
      `}
                  title={bg.name}
                />
              ))}
            </div>

            {/* 🔥 CANCEL BUTTON (NOW VISIBLE) */}
            <div className="mt-5 flex justify-center">
              <button
                onClick={() => setBgChangeOpen(false)}
                className="px-6 py-2 rounded-lg border border-border text-sm cursor-pointer 
             hover:bg-red-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}


      {/* Blocked Dialog - Shows different messages based on who blocked whom */}
      {blockedDialogOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-[320px] shadow-xl border border-border text-center">
            <div className="mb-4">
              <Ban className="h-12 w-12 text-red-500 mx-auto" />
            </div>

            <h2 className="text-lg font-semibold mb-2">
              {blockedDialogOpen === "blockedByThem"
                ? "Blocked by User"
                : "User Blocked"}
            </h2>

            <p className="text-sm text-muted-foreground mb-6">
              {blockedDialogOpen === "blockedByThem"
                ? `${contact?.name} has blocked you. You cannot send messages to this user.`
                : `You have blocked ${contact?.name}. You cannot send messages to this user.`}
            </p>

            <button
              onClick={() => setBlockedDialogOpen(false)}
              className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Unblocked Dialog */}
      {unblockDialogOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 w-[320px] shadow-xl border border-border text-center">
            <div className="mb-4">
              <Check className="h-12 w-12 text-green-500 mx-auto" />
            </div>
            <h2 className="text-lg font-semibold mb-2">User Unblocked</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You have unblocked {contact?.name}. You can now send messages to this user.
            </p>
            <button
              onClick={() => setUnblockDialogOpen(false)}
              className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}
      {makeAdminListOpen && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
    <div className="bg-card rounded-2xl p-5 w-full max-w-[340px] shadow-xl border border-border max-h-[70vh] flex flex-col">
      <h2 className="text-base font-semibold mb-3">Make Admin</h2>
      <div className="space-y-1 overflow-y-auto flex-1">
        {groupMembersList.filter((m) => m.role !== "admin").length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            All members are already admins
          </p>
        ) : (
          groupMembersList
            .filter((m) => m.role !== "admin")
            .map((m) => (
              <button
                key={m.email}
                onClick={() => {
                  setMakeAdminListOpen(false);
                  setMakeAdminConfirm({ email: m.email, name: m.name });
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted transition-colors"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={m.avatar} />
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {getInitials(m.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium flex-1 text-left truncate">{m.name}</span>
              </button>
            ))
        )}
      </div>
      <button
        onClick={() => setMakeAdminListOpen(false)}
        className="mt-4 px-4 py-2 rounded-lg bg-muted text-sm hover:bg-red-500 hover:text-white transition-colors"
      >
        Close
      </button>
    </div>
  </div>
)}
{addMembersOpen && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] px-4">
    <div className="bg-card rounded-2xl p-5 w-full max-w-[360px] shadow-xl border border-border max-h-[75vh] flex flex-col">
      <h2 className="text-base font-semibold mb-3">Add Members</h2>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={addMembersSearch}
          onChange={(e) => setAddMembersSearch(e.target.value)}
          className="pl-9 h-10 rounded-xl"
        />
      </div>

      {selectedAddMembers.size > 0 && (
        <p className="text-xs text-muted-foreground mb-2">
          {selectedAddMembers.size} selected
        </p>
      )}

      <div className="space-y-1 overflow-y-auto flex-1">
        {filteredAvailableToAdd.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {availableToAdd.length === 0
              ? "All your contacts are already in this group"
              : "No contact found"}
          </p>
        ) : (
          filteredAvailableToAdd.map((f) => {
            const email = f.email || f.id;
            const isSelected = selectedAddMembers.has(email);
            return (
              <button
                key={email}
                onClick={() => {
                  setSelectedAddMembers((prev) => {
                    const next = new Set(prev);
                    next.has(email) ? next.delete(email) : next.add(email);
                    return next;
                  });
                }}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted transition-colors"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={f.avatar} />
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {getInitials(f.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium flex-1 text-left truncate">{f.name}</span>
                <div
                  className={`h-5 w-5 rounded-full flex items-center justify-center border-2 ${
                    isSelected ? "bg-orange-500 border-orange-500" : "border-gray-400"
                  }`}
                >
                  {isSelected && <Check className="h-3 w-3 text-white" />}
                </div>
              </button>
            );
          })
        )}
      </div>

      <div className="flex gap-3 mt-4">
        <button
          onClick={() => {
            setAddMembersOpen(false);
            setSelectedAddMembers(new Set());
            setAddMembersSearch("");
          }}
          className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
  onClick={handleAddMembers}
  disabled={selectedAddMembers.size === 0 || addingMembers}
  className="flex-1 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
>
  Add
</button>
      </div>
    </div>
  </div>
)}
      
      {adminRequiredDialog && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
    <div className="bg-card rounded-2xl p-6 w-full max-w-[340px] shadow-xl border border-border text-center">
      <div className="mb-4">
        <Shield className="h-12 w-12 text-orange-500 mx-auto" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Assign an Admin First</h2>
      <p className="text-sm text-muted-foreground mb-6">
        You're the only admin in this group. Please make another member admin before leaving.
      </p>
      <button
        onClick={() => {
          setAdminRequiredDialog(false);
          setContactInfoOpen(true);
        }}
        className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        OK
      </button>
    </div>
  </div>
)}
      {seenByMsgId && (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
    <div className="bg-card rounded-2xl p-5 w-full max-w-[320px] shadow-xl border border-border max-h-[70vh] flex flex-col">
      <h2 className="text-base font-semibold mb-3">Seen by</h2>
      <div className="space-y-1 overflow-y-auto flex-1">
        {(groupReads?.[seenByMsgId] || [])
          .filter((r) => r.email !== user?.email)
          .map((r) => (
            <div key={r.email} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted transition-colors">
              <Avatar className="h-9 w-9">
                <AvatarImage src={r.avatar} />
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials(r.name)}
                </AvatarFallback>
              </Avatar>
                  <div className="flex-1 min-w-0 pr-1">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">{formatMessageDateTime(r.read_at)}</p>
              </div>
            </div>
          ))}
      </div>
      <button
        onClick={() => setSeenByMsgId(null)}
        className="mt-4 px-4 py-2 rounded-lg bg-muted text-sm hover:bg-red-500 hover:text-white transition-colors"
      >
        Close
      </button>
    </div>
  </div>
)}

      {/* Search Messages Modal */}
      {searchOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md">

            {/* 🔍 Search Input */}
            <div className="p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-muted placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
            </div>

            {/* 🔎 Results */}
            <div className="max-h-64 overflow-y-auto">
              {searchQuery.trim() ? (
                (() => {
                  const results = localMessages
                    .filter(msg =>
                      msg.text?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .slice(0, 5);

                  return results.length > 0 ? (
                    results.map((msg) => (
                      <button
                        key={msg.id}
                        onClick={() => {
                          const element = document.getElementById(`msg-${msg.id}`);
                          if (element) {
                            element.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                            element.classList.add("bg-primary/20", "dark:bg-primary/10");
                            setTimeout(() => {
                              element.classList.remove("bg-primary/20", "dark:bg-primary/10");
                            }, 2000);
                          }
                          setSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="w-full text-left px-6 py-3 hover:bg-muted transition-colors"
                      >
                        <p className="text-sm text-foreground truncate">
                          {msg.text}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {msg.time}
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-muted-foreground">

                      <p className="text-sm font-medium">No messages found</p>
                    </div>
                  );
                })()
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-muted-foreground">
                  <Search size={24} className="mb-2 opacity-50" />
                  <p className="text-sm">Type to search messages</p>
                </div>
              )}
            </div>

            {/* ❌ Close Button */}
            <div className="p-4 flex justify-end">
              <button
                onClick={() => {
                  setSearchOpen(false);
                  setSearchQuery("");
                }}
                className="px-4 py-2 rounded-lg bg-muted text-sm transition-colors hover:bg-red-500 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {editMessage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 w-[320px] shadow-xl">

            <h2 className="text-sm font-semibold mb-2">
              Type a new message
            </h2>

            <input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
            />

            <div className="flex justify-end gap-2 mt-4">

              <button
                onClick={() => setEditMessage(null)}
                className="px-3 py-1.5 text-sm rounded-lg bg-gray-200"
              >
                Cancel
              </button>

              <button
                onClick={handleEditSubmit}
                className="px-3 py-1.5 text-sm rounded-lg bg-orange-500 text-white"
              >
                Edit
              </button>

            </div>
          </div>
        </div>
      )}
      <AlertDialog open={!!makeAdminConfirm} onOpenChange={(open) => !open && setMakeAdminConfirm(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Make Admin</AlertDialogTitle>
      <AlertDialogDescription>
        Do you want to make {makeAdminConfirm?.name} an admin of this group?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel className="hover:bg-red-500 hover:text-white transition-colors">
        Cancel
      </AlertDialogCancel>
<AlertDialogAction
  onClick={async (e) => {
    e.preventDefault();
    if (!makeAdminConfirm || !contact) return;
    setMakeAdminLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const { data: updateData, error } = await supabase
        .from("group_members")
        .update({ role: "admin" })
        .eq("group_id", contact.id)
        .eq("member_email", makeAdminConfirm.email)
        .select();

      if (error) {
        console.error("Make admin failed:", error);
      } else if (!updateData || updateData.length === 0) {
        console.warn("[MakeAdmin] 0 rows updated — RLS blocked it");
      } else {
        setGroupMembersList((prev) =>
          prev.map((m) =>
            m.email === makeAdminConfirm.email ? { ...m, role: "admin" } : m
          )
        );

        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("email", userEmail)
          .single();
        const adminName = adminProfile?.name || userEmail;

        await supabase.from("group_messages").insert({
          group_id: contact.id,
          sender_email: userEmail,
          content: `[SYSTEM]${adminName} made ${makeAdminConfirm.name} as admin`,
        });
      }
    } finally {
      setMakeAdminLoading(false);
      setMakeAdminConfirm(null);
    }
  }}
  disabled={makeAdminLoading}
  className={`bg-orange-500 hover:bg-orange-600 text-white ${makeAdminLoading ? 'cursor-not-allowed opacity-40 disabled:pointer-events-auto disabled:cursor-not-allowed' : ''}`}
>
  Confirm
</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
<AlertDialog open={!!removeAdminConfirm} onOpenChange={(open) => !open && setRemoveAdminConfirm(null)}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Remove Admin</AlertDialogTitle>
      <AlertDialogDescription>
        Do you want to remove {removeAdminConfirm?.name} as admin of this group?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel className="bg-transparent text-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-0 transition-none">
  Cancel
</AlertDialogCancel>
<AlertDialogAction
  onClick={async (e) => {
    e.preventDefault();
    if (!removeAdminConfirm || !contact) return;
    setRemoveAdminLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const { data: updateData, error } = await supabase
        .from("group_members")
        .update({ role: "member" })
        .eq("group_id", contact.id)
        .eq("member_email", removeAdminConfirm.email)
        .select();

      if (error) {
        console.error("Remove admin failed:", error);
      } else if (!updateData || updateData.length === 0) {
        console.warn("[RemoveAdmin] 0 rows updated — RLS blocked it");
      } else {
        setGroupMembersList((prev) =>
          prev.map((m) =>
            m.email === removeAdminConfirm.email ? { ...m, role: "member" } : m
          )
        );

        const { data: adminProfile } = await supabase
          .from("profiles")
          .select("name")
          .eq("email", userEmail)
          .single();
        const adminName = adminProfile?.name || userEmail;

        await supabase.from("group_messages").insert({
          group_id: contact.id,
          sender_email: userEmail,
          content: `[SYSTEM]${adminName} removed ${removeAdminConfirm.name} as admin`,
        });
      }
    } finally {
      setRemoveAdminLoading(false);
      setRemoveAdminConfirm(null);
    }
  }}
  disabled={removeAdminLoading}
  className={`bg-red-500 hover:bg-red-600 text-white ${removeAdminLoading ? 'cursor-not-allowed opacity-40 disabled:pointer-events-auto disabled:cursor-not-allowed' : ''}`}
>
  Remove
</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Messages</AlertDialogTitle>
            <AlertDialogDescription>
              Choose how you want to delete selected messages
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-foreground border border-border hover:bg-transparent hover:text-inherit focus:bg-transparent active:bg-transparent cursor-pointer">
              Cancel
            </AlertDialogCancel>

            {/* ✅ Delete for Me */}
            <AlertDialogAction
              onClick={() => {
                selectedMessages.forEach((id) => onDeleteForMe(id));
                setSelectedMessages(new Set());
                setSelectionMode(false);
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete for Me
            </AlertDialogAction>

            {/* ✅ Delete for Everyone */}
            <AlertDialogAction
              onClick={() => {
                selectedMessages.forEach((id) => onDeleteForEveryone(id));
                setSelectedMessages(new Set());
                setSelectionMode(false);
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete for Everyone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Show blocked message banner when blocked by the other person */}

 </div>
  );
});
const isTauriApp =
  typeof window !== "undefined" &&
  "__TAURI_INTERNALS__" in window;
const Chat = () => {
  const { user, isAuthenticated, isProfileComplete, isLoading, logout, updateProfile: updateAuthProfile } = useAuth();
  const { isConnected, sendMessage, sendTyping, deleteMessageForEveryone, markMessagesAsRead, onMessageReceived, onMessageEdited, onMessageDeletedForEveryone, onMessageRead, onUserTyping, onUserOnline, onUserOffline, onUserBlocked, onUserUnblocked, onPendingMessagesReceived, onSentMessagesStatusReceived, requestPendingMessages, requestSentMessagesStatus, pinMessage, onMessagePinned, onMessageIdConfirmed } = useSocket();
  const [tick, setTick] = useState(0);
  const [groupOrderUpdateCount, setGroupOrderUpdateCount] = useState(0);
  const [isMobile, setIsMobile] = useState(() => 
  typeof window !== "undefined" && window.innerWidth <= 768
);
  const [friends, setFriends] = useState<any[]>([]);
  const [contactOrderLoaded, setContactOrderLoaded] = useState(false);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>({});
  const [contactOrder, setContactOrder] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`contact_order_${user?.email || ""}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
const [groupActivityCount, setGroupActivityCount] = useState<Record<string, number>>(() => {
  try {
    const saved = localStorage.getItem(`group_activity_${user?.email || ""}`);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({}); // 🔥 Track unread messages per contact
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number }; messageId: string | null }>({ isOpen: false, position: { x: 0, y: 0 }, messageId: null }); // 🔥 Context menu state
  const [replyTo, setReplyTo] = useState<Message | null>(null); // 🔥 Reply to message context
  const [pinnedMessages, setPinnedMessages] = useState<Map<string, Set<string>>>(new Map()); // 🔥 Contact-specific pinned messages
  const [groupTypingUsers, setGroupTypingUsers] = useState<Record<string, string[]>>({});
  const [groupReads, setGroupReads] = useState<Record<string, { email: string; name: string; avatar: string; read_at: string }[]>>({});
const readProfileCacheRef = useRef<Record<string, { name: string; avatar: string }>>({});
const [typingProfilesCache, setTypingProfilesCache] = useState<Record<string, { name: string; avatar: string }>>({});
const groupChannelRef = useRef<any>(null);
const groupTypingBroadcastRef = useRef<any>(null);  // 🔥 NEW

  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({}); // Only for received typing events
  const [localTyping, setLocalTyping] = useState<Record<string, boolean>>({}); // For local typing state
  const [filter, setFilter] = useState("All messages");
  const [logoutLoading, setLogoutLoading] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contactOrderSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const contactOrderSeqRef = useRef(0);
 const activeContactRef = useRef<Contact | null>(null);
  const handleSelectContactRef = useRef<(contact: Contact) => void>(() => {});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uid, setUid] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'profile' | 'account' | 'privacy' | 'notifications'>('profile');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [preferences, setPreferences] = useState<PreferencesType>({
    favorites: new Set(),
    muted: new Set(),
    pinned: new Set(),
    blocked: new Set(),
    backgrounds: {},
    online_visible: true,
    read_receipts_enabled: true,
    typing_indicator: true,
  });

  const getContactKey = (contact: any) => contact?.email || contact?.uid || contact?.id || "";
  const getUserKey = () => user?.email || user?.uid || "";
  const buildConversationId = (a: string, b: string) => [a, b].sort().join(":");
  const navigate = useNavigate();
  useEffect(() => {
    const loadPreferences = async () => {
      const userEmail = user?.email;
      if (!userEmail) return;

      let response = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userEmail)
        .single();

      if (response.error) {
        response = await supabase
          .from("user_preferences")
          .select("*")
          .eq("email", userEmail)
          .single();
      }

      const { data, error } = response;
      if (error || !data) return;

      setPreferences({
        favorites: new Set(data.favorites ?? []),
        blocked: new Set(data.blocked ?? []),
        muted: new Set(data.muted ?? []),
        pinned: new Set(data.pinned ?? []),
        backgrounds: data.backgrounds ?? {},
      });

      // ✅ FIX: Parse pinned_messages correctly regardless of format
      let pinnedMsgs = new Map<string, Set<string>>();

      if (data.pinned_messages) {
        try {
          const parsed = typeof data.pinned_messages === "string"
            ? JSON.parse(data.pinned_messages)
            : data.pinned_messages;

          const entries: [string, string[]][] = Array.isArray(parsed)
            ? parsed  // Already [[key, []], ...] format
            : Object.entries(parsed);  // {key: []} format

          for (const [key, msgs] of entries) {
            pinnedMsgs.set(key, new Set(Array.isArray(msgs) ? msgs : []));
          }
        } catch (e) {
          console.error("Error parsing pinned_messages from DB:", e);
        }
      }

      // ✅ Only fall back to localStorage if DB has nothing
      if (pinnedMsgs.size === 0) {
        const storedPinned = localStorage.getItem("pinned_messages");
        if (storedPinned) {
          try {
            const parsed: [string, string[]][] = JSON.parse(storedPinned);
            pinnedMsgs = new Map(
              parsed.map(([key, value]) => [
                key,
                new Set<string>(Array.isArray(value) ? value : []),
              ])
            );
          } catch (e) {
            console.error("Error parsing pinned_messages from localStorage:", e);
          }
        }
      }

      setPinnedMessages(pinnedMsgs);
    };

    loadPreferences();
  }, [user?.email]);
  // 🔥 Cross-device: contactOrder ko DB se load karo (localStorage sirf fallback)
useEffect(() => {
  if (!user?.email) return;

  const loadContactOrder = async () => {
    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("contact_order")
        .eq("user_id", user.email)
        .single();

      if (!error && data?.contact_order && Object.keys(data.contact_order).length > 0) {
        setContactOrder((prev) => {
  const merged = { ...data.contact_order, ...prev };
  localStorage.setItem(`contact_order_${user.email}`, JSON.stringify(merged));
  return merged;
});
        localStorage.setItem(`contact_order_${user.email}`, JSON.stringify(data.contact_order));
        setContactOrderLoaded(true);
        return;
      }
    } catch (e) {
      console.error("Failed to load contact_order from DB:", e);
    }

    // 🔥 fallback - agar DB mein kuch na mile
    try {
      const saved = localStorage.getItem(`contact_order_${user.email}`);
      if (saved) setContactOrder(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to restore contact order from localStorage:", e);
    }
    setContactOrderLoaded(true);
  };

  loadContactOrder();
}, [user?.email]);
useEffect(() => {
  if (!isTauriApp) return;

  const unlistenPromise = onOpenUrl(async (urls) => {
    const parsed = new URL(urls[0]);
    const targetId = parsed.searchParams.get('id');
    const isGroup = parsed.searchParams.get('group') === 'true';
    if (!targetId) return;

    if (isGroup) {
      const { data: group } = await supabase.from("groups").select("*").eq("id", targetId).single();
      if (group) {
        handleSelectContact({
          id: group.id,
          name: group.name,
          avatar: group.avatar || "",
          email: group.id,
          isGroup: true,
        } as any);
      }
    } else {
      const contact = friends.find((f) => f.id === targetId || f.email === targetId);
      if (contact) handleSelectContact(contact);
    }
  });

  return () => { unlistenPromise.then((unlisten) => unlisten()); };
}, [friends]);
  // 🔥 Ref banaya taaki notification click pe hamesha latest handleSelectContact use ho, stale closure na ho


useEffect(() => {
  if (!isTauriApp) return;

  let listener: { unregister: () => void } | undefined;

  const setup = async () => {
    listener = await onAction(async (performedAction: any) => {
      // 🔥 FIX: extra ab performedAction.notification.extra mein hai
      const notif = performedAction?.notification;
      const contactId = notif?.extra?.contactId;
      const isGroup =
        notif?.extra?.isGroup === "true" || notif?.extra?.isGroup === true;

      if (!contactId) return;

      try {
        if (isGroup) {
          const { data: group, error } = await supabase
            .from("groups")
            .select("id, name, avatar, bio")
            .eq("id", contactId)
            .single();

          if (error || !group) {
            console.error("Notification click: group not found", error);
            return;
          }

          handleSelectContactRef.current({
            id: group.id,
            name: group.name,
            avatar: group.avatar || "",
            email: group.id,
            isGroup: true,
            bio: group.bio,
            lastMessage: "",
            time: "",
            unread: 0,
          } as any);
        } else {
          const { data: profile, error } = await supabase
            .from("profiles")
            .select("id, name, email, avatar, uid, last_seen")
            .eq("email", contactId)
            .single();

          if (error || !profile) {
            console.error("Notification click: profile not found", error);
            return;
          }

          handleSelectContactRef.current({
            id: profile.email,
            name: profile.name || "Unknown",
            avatar: profile.avatar || "",
            email: profile.email,
            uid: profile.uid,
            last_seen: profile.last_seen || null,
            lastMessage: "",
            time: "",
            unread: 0,
          } as any);
        }
      } catch (err) {
        console.error("Notification click handling failed:", err);
      }
    });
  };

  setup();

  return () => {
    listener?.unregister();
  };
}, []);
// 🔥 Realtime - dusre device pe order change ho toh yahan bhi turant reflect ho
useEffect(() => {
  if (!user?.email) return;

  const channel = supabase
    .channel("contact_order_sync")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "user_preferences", filter: `user_id=eq.${user.email}` },
      (payload: any) => {
        if (payload.new?.contact_order) {
          setContactOrder(payload.new.contact_order);
          localStorage.setItem(`contact_order_${user.email}`, JSON.stringify(payload.new.contact_order));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user?.email]);
    // 🔥 Sabhi groups ke messages track karo taaki sidebar order update ho — chat khuli ho ya nahi
useEffect(() => {
  if (!user?.email) return;

  const channel = supabase
    .channel("user_group_order_global")
.on(
  "postgres_changes",
  { event: "INSERT", schema: "public", table: "group_messages" },
  (payload: any) => {
    const m = payload.new;
    const isSystemMsg = typeof m.content === "string" && m.content.startsWith("[SYSTEM]");

    updateContactOrder(m.group_id, new Date(m.created_at).getTime()); // 🔥 Date.now() ki jagah m.created_at

    if (isSystemMsg) {
      setGroupActivityCount((prev) => {
        const updated = { ...prev, [m.group_id]: (prev[m.group_id] || 0) + 1 };
        localStorage.setItem(`group_activity_${user?.email || ""}`, JSON.stringify(updated));
        return updated;
      });
    }
  }
)
    .subscribe((status) => {
      console.log("[GROUP ORDER] channel status:", status);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, [user?.email]);
  useEffect(() => {
  const channel = supabase
    .channel("groups_avatar_realtime")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "groups" },
      (payload: any) => {
        const updated = payload.new;
        // active contact update karo agar wahi group khula hai
        setActiveContact((prev) =>
          prev && (prev as any)?.isGroup && prev.id === updated.id
            ? { ...prev, avatar: updated.avatar, name: updated.name }
            : prev
        );
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);
  // 🔥 Load + realtime sync for group messages (jab active group chat khula ho)
  useEffect(() => {
    if (!activeContact || !(activeContact as any)?.isGroup) return;
    const groupId = activeContact.id;

    const loadGroupMessages = async () => {
      const { data: msgs, error } = await supabase
        .from("group_messages")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading group messages:", error);
        return;
      }

      const emails = Array.from(new Set((msgs || []).map((m: any) => m.sender_email)));
      const { data: profiles } = emails.length
        ? await supabase.from("profiles").select("email, name").in("email", emails)
        : { data: [] };
      const nameMap = new Map((profiles || []).map((p: any) => [p.email, p.name]));

const organized = (msgs || []).map((m: any) => {
  const isSystem = typeof m.content === "string" && m.content.startsWith("[SYSTEM]");
  return {
    id: m.id,
    senderId: m.sender_email,
    text: isSystem
      ? parseSystemMessage(m.content, user?.email)
      : (m.is_deleted ? "message deleted" : m.content),
    timestamp: new Date(m.created_at).getTime(),
    time: formatMessageDateTime(m.created_at),
    isOwn: m.sender_email === user?.email,
    groupSenderName: nameMap.get(m.sender_email) || m.sender_email,
    status: "sent" as const,
    edited: m.edited || false,
    isDeleted: m.is_deleted || false,
    isSystem,
  };
});

      setAllMessages((prev) => ({ ...prev, [groupId]: organized }));
    };

    loadGroupMessages();
    const loadGroupReads = async () => {
  const { data: reads, error } = await supabase
    .from("group_message_reads")
    .select("message_id, reader_email, read_at")
    .eq("group_id", groupId);

  if (error || !reads) return;

  const emails = Array.from(new Set(reads.map((r: any) => r.reader_email)));
  const { data: profiles } = emails.length
    ? await supabase.from("profiles").select("email, name, avatar").in("email", emails)
    : { data: [] };

  const profileMap = new Map((profiles || []).map((p: any) => [p.email, p]));
  emails.forEach((e) => {
    const p = profileMap.get(e);
    if (p) readProfileCacheRef.current[e] = { name: p.name, avatar: p.avatar };
  });

  const grouped: Record<string, any[]> = {};
  reads.forEach((r: any) => {
    const p = profileMap.get(r.reader_email);
    if (!grouped[r.message_id]) grouped[r.message_id] = [];
    grouped[r.message_id].push({
      email: r.reader_email,
      name: p?.name || r.reader_email,
      avatar: p?.avatar || "",
      read_at: r.read_at,
    });
  });

  setGroupReads((prev) => ({ ...prev, ...grouped }));
};

loadGroupReads();

    // 🔥 Realtime - naya message aate hi turant dikhao
const channel = supabase
      .channel(`group_messages_${groupId}`)
.on(
  "postgres_changes",
  { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
  async (payload: any) => {
    const m = payload.new;
    const isSystemMsg = typeof m.content === "string" && m.content.startsWith("[SYSTEM]");

    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("email", m.sender_email)
      .single();

const newMsg = {
  id: m.id,
  senderId: m.sender_email,
  text: isSystemMsg ? parseSystemMessage(m.content, user?.email) : m.content,
      timestamp: new Date(m.created_at).getTime(),
      time: formatMessageDateTime(m.created_at),
      isOwn: m.sender_email === user?.email,
      groupSenderName: profile?.name || m.sender_email,
      status: "sent" as const,
      edited: false,
      isDeleted: false,
      isSystem: isSystemMsg,
    };

    setAllMessages((prev) => {
      const existing = prev[groupId] || [];
      if (existing.some((msg: any) => msg.id === newMsg.id)) return prev;
      return { ...prev, [groupId]: [...existing, newMsg] };
    });
  }
)
        .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "group_message_reads", filter: `group_id=eq.${groupId}` },
    async (payload: any) => {
      const r = payload.new;

      // profile cache se naam/avatar lo, na ho to fetch karo
      let profile = readProfileCacheRef.current[r.reader_email];
      if (!profile) {
        const { data } = await supabase
          .from("profiles")
          .select("name, avatar")
          .eq("email", r.reader_email)
          .single();
        if (data) {
          profile = { name: data.name, avatar: data.avatar };
          readProfileCacheRef.current[r.reader_email] = profile;
        }
      }

      setGroupReads((prev) => {
        const existing = prev[r.message_id] || [];
        // duplicate check
        if (existing.some((e) => e.email === r.reader_email)) return prev;

        return {
          ...prev,
          [r.message_id]: [
            ...existing,
            {
              email: r.reader_email,
              name: profile?.name || r.reader_email,
              avatar: profile?.avatar || "",
              read_at: r.read_at,
            },
          ],
        };
      });
    }
  )

      .on("broadcast", { event: "typing" }, async (payload: any) => {
        const { email, isTyping } = payload.payload;
        if (email === user?.email) return; // apna khud ka typing ignore kar

        setGroupTypingUsers((prev) => {
          const current = new Set(prev[groupId] || []);
          if (isTyping) {
            current.add(email);
          } else {
            current.delete(email);
          }
          return { ...prev, [groupId]: Array.from(current) };
        });

        if (isTyping && !typingProfilesCache[email]) {
          const { data } = await supabase
            .from("profiles")
            .select("name, avatar")
            .eq("email", email)
            .single();
          if (data) {
            setTypingProfilesCache((prev) => ({
              ...prev,
              [email]: { name: data.name, avatar: data.avatar },
            }));
          }
        }
      })
      .subscribe();

    groupChannelRef.current = channel;

    // 🔥 NEW: separate broadcast-only channel so sidebar (different topic) doesn't collide
const typingChannel = supabase
  .channel(`group_typing_${groupId}`)
  .subscribe();
groupTypingBroadcastRef.current = typingChannel;

return () => {
  supabase.removeChannel(channel);
  supabase.removeChannel(typingChannel);   // 🔥 NEW cleanup
  groupChannelRef.current = null;
  groupTypingBroadcastRef.current = null;  // 🔥 NEW
};
  }, [activeContact]);
  useEffect(() => {
  if (!activeContact || !(activeContact as any)?.isGroup || !user?.email) return;
  const groupId = activeContact.id;
  const msgs = allMessages[groupId] || [];

  const unreadByMe = msgs.filter(
    (m) => !m.isOwn && !groupReads[m.id]?.some((r) => r.email === user.email)
  );

  if (unreadByMe.length === 0) return;

  const rows = unreadByMe.map((m) => ({
    group_id: groupId,
    message_id: m.id,
    reader_email: user.email,
  }));

  supabase
    .from("group_message_reads")
    .upsert(rows, { onConflict: "message_id,reader_email" })
    .then(({ error }) => {
      if (error) console.error("group read mark failed:", error);
    });
}, [activeContact, allMessages, user?.email]);
  // 🔥 SAVE preferences to localStorage whenever they change
  useEffect(() => {
    if (!user?.email) return;

    const prefsToSave = {
      favorites: Array.from(preferences.favorites),
      pinned: Array.from(preferences.pinned),
      blocked: Array.from(preferences.blocked),
      muted: Array.from(preferences.muted),
      backgrounds: preferences.backgrounds
    };

    localStorage.setItem(`chat_preferences_${user.email}`, JSON.stringify(prefsToSave));
    console.log("[v0] ✅ Saved preferences to localStorage");
  }, [preferences, user?.email]);

  // 🔥 RESTORE preferences from localStorage on mount
  useEffect(() => {
    if (!user?.email) return;

    const saved = localStorage.getItem(`chat_preferences_${user.email}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences(prev => ({
          ...prev,
          favorites: new Set(parsed.favorites || []),
          pinned: new Set(parsed.pinned || []),
          blocked: new Set(parsed.blocked || []),
          muted: new Set(parsed.muted || []),
          backgrounds: parsed.backgrounds || {}
        }));
        console.log("[v0] ✅ Restored preferences from localStorage");
      } catch (e) {
        console.error("[v0] Failed to restore preferences:", e);
      }
    }
  }, [user?.email]);
    useEffect(() => {
    activeContactRef.current = activeContact;
  }, [activeContact]);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    window.addEventListener('orientationchange', checkMobile);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('orientationchange', checkMobile);
    };
  }, []);
const updateContactOrder = (contactKey: string, timestamp: number) => {
  setContactOrder((prev) => {
    const updated = { ...prev, [contactKey]: timestamp };
    localStorage.setItem(`contact_order_${user?.email || ""}`, JSON.stringify(updated));

    if (user?.email) {
      const mySeq = ++contactOrderSeqRef.current;
      if (contactOrderSaveTimerRef.current) clearTimeout(contactOrderSaveTimerRef.current);
      contactOrderSaveTimerRef.current = setTimeout(() => {
        // 🔥 sirf tab save karo jab ye abhi bhi sabse latest scheduled save ho
        if (mySeq === contactOrderSeqRef.current) {
          savePrefs(user.email, "contact_order", updated);
        }
      }, 600);
    }

    return updated;
  });
};

const setContactOrderIfMissing = (contactKey, timestamp) => {
  if (!contactOrderLoaded) return;
  setContactOrder((prev) => {
    if (prev[contactKey]) return prev;
    const updated = { ...prev, [contactKey]: timestamp };
    localStorage.setItem(`contact_order_${user?.email || ""}`, JSON.stringify(updated));

    if (user?.email) {
      const mySeq = ++contactOrderSeqRef.current;
      if (contactOrderSaveTimerRef.current) clearTimeout(contactOrderSaveTimerRef.current);
      contactOrderSaveTimerRef.current = setTimeout(() => {
        if (mySeq === contactOrderSeqRef.current) {
          savePrefs(user.email, "contact_order", updated);
        }
      }, 600);
    }

    return updated;
  });
};
  // 🔥 SAVE pinned messages to localStorage whenever they change
  // Pinned messages persist useEffect
  useEffect(() => {
    const pinnedKey = `pinned_messages_${user?.email || ""}`; // 🔥
    const serializable = Array.from(pinnedMessages.entries()).map(
      ([key, set]) => [key, Array.from(set)]
    );
    localStorage.setItem(pinnedKey, JSON.stringify(serializable)); // 🔥
  }, [pinnedMessages, user?.email]);

  useEffect(() => {
    const unsubscribe = onMessageReceived((message: any) => {
      console.log("📨 New message received:", message);

      const msgKey = `chat_messages_${user?.email || ""}`;
      const unreadKey = `chat_unread_counts_${user?.email || ""}`;

      const myKey = getUserKey();
      const isOwnMessage = message.senderId === myKey;
      const sender = message.senderId;
      const receiver = message.recipientId;

      // 🔥 pehle: sender === myKey ? receiver : sender
      // ab bhi wahi logic - agar khud ka message hai (dusre device se aaya) toh receiver conversationKey hai
      const conversationKey = isOwnMessage ? receiver : sender;

      // 🔥 sirf tab restore karo jab dusre se message aaya ho
      if (!isOwnMessage) {
        supabase
          .from("deleted_contacts")
          .delete()
          .eq("user_email", myKey)
          .eq("contact_email", sender)
          .then(({ error }) => {
            if (error) console.error("Failed to restore deleted contact:", error);
          });
      }

      let parsedContent: any = null;
      if (typeof message.content === "string") {
        try {
          parsedContent = JSON.parse(message.content);
        } catch {
          parsedContent = { text: message.content };
        }
      }

      if (parsedContent && parsedContent.type === "delete-for-everyone") {
        setAllMessages((prev) => {
          const updated = {
            ...prev,
            [conversationKey]: prev[conversationKey]?.map((msg) =>
              msg.id === parsedContent.messageId
                ? { ...msg, isDeleted: true, text: "message deleted" }
                : msg
            ) || [],
          };
          localStorage.setItem(msgKey, JSON.stringify(updated));
          return updated;
        });
        return;
      }

      if (
        message.content &&
        message.content.includes('"type":"delete-for-everyone"')
      ) {
        return;
      }

      const payload: any = {
        id: message.id,
        senderId: message.senderId,
        text: parsedContent?.text || message.content,
        timestamp: message.timestamp ? new Date(message.timestamp).getTime() : Date.now(),
        edited: message.edited || false,
        replyTo: parsedContent?.replyTo || message.replyTo || null,
        time: message.timestamp
          ? formatMessageDateTime(message.timestamp)
          : formatMessageDateTime(new Date()),
        isOwn: isOwnMessage,
        status: isOwnMessage ? "sent" : undefined,
      };

      setAllMessages((prev) => {
        const conversationMessages = prev[conversationKey] || [];
        // 🔥 id ke alawa clientId se bhi dedupe check karo (taki apna hi optimistic msg duplicate na ho)
        const existingIndex = conversationMessages.findIndex(
          (m: any) => m.id === payload.id || (message.clientId && m.id === message.clientId)
        );

        let updated;
        if (existingIndex !== -1) {
          const existing = conversationMessages[existingIndex];
          if (payload.edited && existing.text !== payload.text) {
            const newMessages = [...conversationMessages];
            newMessages[existingIndex] = { ...existing, id: payload.id, text: payload.text, edited: true };
            updated = { ...prev, [conversationKey]: newMessages };
          } else if (existing.id !== payload.id) {
            // 🔥 temp clientId ko real server id se replace karo
            const newMessages = [...conversationMessages];
            newMessages[existingIndex] = { ...existing, id: payload.id };
            updated = { ...prev, [conversationKey]: newMessages };
          } else {
            return prev;
          }
        } else {
          updated = {
            ...prev,
            [conversationKey]: [...conversationMessages, payload],
          };
        }

        localStorage.setItem(msgKey, JSON.stringify(updated));
        return updated;
      });
     updateContactOrder(conversationKey, payload.timestamp);

      // 🔥 unread count sirf dusre se aaye message pe badhao, apne khud ke message pe nahi
      // 🔥 unread count sirf dusre se aaye message pe badhao, apne khud ke message pe nahi
      if (!isOwnMessage) {
        // 🔥 NOTIFICATION — sirf tab dikhao jab is contact ka chat abhi khula hua na ho (ref se latest state)
        const currentActiveContact = activeContactRef.current;
        const isChatOpen = currentActiveContact && getContactKey(currentActiveContact) === conversationKey;
        const notificationsEnabled = preferences.notifications_enabled !== false; // 🔥 NAYA CHECK
              if (!isChatOpen && notificationsEnabled) {
          const senderProfile = friends.find(
            (f) => f.id === conversationKey || f.email === conversationKey
          );
          const senderName = senderProfile?.name || "New message";

          let notifBody = payload.text;
          if (payload.text?.startsWith("[IMAGE]")) notifBody = "📷 Photo";
          else if (payload.text?.startsWith("[AUDIO]")) notifBody = "🎤 Voice message";

          showNotification(senderName, notifBody, conversationKey, false);
        }

        setUnreadCounts((prev) => {
          const latestActiveContact = activeContactRef.current;
          if (
            (latestActiveContact && getContactKey(latestActiveContact) === conversationKey) ||
            payload.status === "read"
          ) {
            return prev;
          }

          if (preferences.muted.has(conversationKey)) return prev;

          const updated = {
            ...prev,
            [conversationKey]: (prev[conversationKey] || 0) + 1,
          };
          localStorage.setItem(unreadKey, JSON.stringify(updated));
          return updated;
        });
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [onMessageReceived, activeContact, preferences.muted, friends]); // 🔥 friends dependency add ki
  // 🔌 Request sent messages status when socket connects
  useEffect(() => {
    if (isConnected && requestPendingMessages) {
      console.log("[v0] Socket connected, requesting pending messages");
      requestPendingMessages();
    }
  }, [isConnected, requestPendingMessages]);

  // 🔌 Periodically sync sent messages status (every 5 seconds if connected)
  useEffect(() => {
    if (!isConnected || !requestSentMessagesStatus) return;

    const syncInterval = setInterval(() => {
      console.log("[v0] 🔄 Periodic sync: requesting sent messages status");
      requestSentMessagesStatus();
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [isConnected, requestSentMessagesStatus]);

  useEffect(() => {
    const unsubscribe = onPendingMessagesReceived?.((messages: any[]) => {
      console.log("[v0] Pending messages received:", messages.length, messages);

      if (!messages || messages.length === 0) return;

      const msgKey = `chat_messages_${user?.email || ""}`;        // 🔥
      const unreadKey = `chat_unread_counts_${user?.email || ""}`; // 🔥

      const myKey = getUserKey();

      messages.forEach((message: any) => {
        const sender = message.senderId;
        const receiver = message.recipientId;
        const conversationKey = sender === myKey ? receiver : sender;

        let parsedContent: any = null;
        if (typeof message.content === "string") {
          try {
            parsedContent = JSON.parse(message.content);
          } catch {
            parsedContent = { text: message.content };
          }
        }

        const payload: any = {
          id: message.id,
          senderId: message.senderId,
          text: parsedContent?.text || message.content,
          timestamp: message.timestamp ? new Date(message.timestamp).getTime() : Date.now(),
          replyTo: parsedContent?.replyTo || null,
          time: message.timestamp
            ? formatMessageDateTime(message.timestamp)
            : formatMessageDateTime(new Date()),
          isOwn: false,
          status: message.status,
        };

        let alreadyExists = false;

        setAllMessages((prev) => {
          const conversationMessages = prev[conversationKey] || [];
          const exists = conversationMessages.some((m: any) => m.id === payload.id);
          if (exists) {
            console.log(`[v0] Skipping duplicate message: ${payload.id}`);
            alreadyExists = true;
            return prev;
          }
          const updated = {
            ...prev,
            [conversationKey]: [...conversationMessages, payload],
          };
          localStorage.setItem(msgKey, JSON.stringify(updated)); // 🔥
          return updated;
        });

        // 🔥 agar message pehle se hai (duplicate/pending resend), toh order aur unread dono skip karo
        if (alreadyExists) return;

        updateContactOrder(conversationKey, payload.timestamp);

        setUnreadCounts((prev) => {
          if (
            (activeContact && getContactKey(activeContact) === conversationKey) ||
            payload.status === "read"
          ) {
            return prev;
          }

          if (preferences.muted.has(conversationKey)) return prev;

          const updated = {
            ...prev,
            [conversationKey]: (prev[conversationKey] || 0) + 1,
          };
          localStorage.setItem(unreadKey, JSON.stringify(updated)); // 🔥
          return updated;
        });
      });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [onPendingMessagesReceived, activeContact, preferences.muted]); // 🔥 preferences.muted added

  // 🔌 Listen for sent messages status (read receipts when sender comes back online)
  useEffect(() => {
    const unsubscribe = onSentMessagesStatusReceived?.((messages: any[]) => {
      console.log("[v0] Sent messages status received:", messages.length, messages);

      if (!messages || messages.length === 0) return;

      const msgKey = `chat_messages_${user?.email || ""}`; // 🔥

      messages.forEach((message: any) => {
        const conversationKey = message.recipientId;

        setAllMessages((prev) => {
          const conversationMessages = prev[conversationKey] || [];
          const updated = {
            ...prev,
            [conversationKey]: conversationMessages.map((m: any) => {
              const messageTime = new Date(message.timestamp).getTime();
              const localTime = new Date(`${new Date().toDateString()} ${m.time}`).getTime();
              const timeDiff = Math.abs(messageTime - localTime);

              if (m.text === message.content && timeDiff < 5000 && m.isOwn) {
                return {
                  ...m,
                  status: message.status,
                  readAt: message.readAt ? new Date(message.readAt) : undefined,
                };
              }
              return m;
            }),
          };
          localStorage.setItem(msgKey, JSON.stringify(updated)); // 🔥
          return updated;
        });
      });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [onSentMessagesStatusReceived]);
     useEffect(() => {
    if (!user?.email) return;

    const channel = supabase
      .channel("user_group_unread_global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages" },
        async (payload: any) => {
          const m = payload.new;
          const groupId = m.group_id;
          const isSystemMsg = typeof m.content === "string" && m.content.startsWith("[SYSTEM]");
          const isOwnMessage = m.sender_email === user.email;

          if (isOwnMessage || isSystemMsg) return;

          // 🔥 activeContactRef se latest state lo, stale closure na ho
          const currentActiveContact = activeContactRef.current;
          const isChatOpen =
            currentActiveContact && (currentActiveContact as any)?.isGroup && currentActiveContact.id === groupId;

          if (isChatOpen || preferences.muted.has(groupId)) return;

          const unreadKey = `chat_unread_counts_${user.email}`;
          setUnreadCounts((prev) => {
            const updated = { ...prev, [groupId]: (prev[groupId] || 0) + 1 };
            localStorage.setItem(unreadKey, JSON.stringify(updated));
            return updated;
          });

          // 🔥 NAYA: Local push notification bhejo (app open hone par bhi)
          const notificationsEnabled = preferences.notifications_enabled !== false;
          if (!notificationsEnabled) return;

          try {
            const { data: group } = await supabase
              .from("groups")
              .select("name")
              .eq("id", groupId)
              .single();

            const { data: senderProfile } = await supabase
              .from("profiles")
              .select("name")
              .eq("email", m.sender_email)
              .single();

            const groupName = group?.name || "Group";
            const senderName = senderProfile?.name || m.sender_email;

            let notifBody = m.content;
            if (notifBody?.startsWith("[IMAGE]")) notifBody = "📷 Photo";
            else if (notifBody?.startsWith("[AUDIO]")) notifBody = "🎤 Voice message";

            showNotification(groupName, `${senderName}: ${notifBody}`, groupId, true);
          } catch (err) {
            console.error("Group notification failed:", err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.email, preferences.muted, preferences.notifications_enabled]);

  // 🔌 Socket.IO: Listen for typing events
  useEffect(() => {
    const unsubscribe = onUserTyping((payload: { userId: string; isTyping: boolean; senderEmail?: string }) => {
      const key = payload.senderEmail || payload.userId;

      setTypingStatus((prev) => ({
        ...prev,
        [key]: payload.isTyping,
      }));

      // 🔥 Auto-reset typing after 4 seconds agar server se false na aaye
      if (payload.isTyping) {
        const timeoutKey = `typing_timeout_${key}`;

        // Clear previous timeout
        if ((window as any)[timeoutKey]) {
          clearTimeout((window as any)[timeoutKey]);
        }

        // Set new timeout
        (window as any)[timeoutKey] = setTimeout(() => {
          setTypingStatus((prev) => ({
            ...prev,
            [key]: false,
          }));
        }, 4000); // 🔥 4 sec ke baad auto-false
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [onUserTyping]);

  // 🔌 Socket.IO: Listen for user online status
  useEffect(() => {
    const unsubscribe = onUserOnline((userId: string) => {
      console.log(`✅ ${userId} is online`);
      setOnlineUsers((prev) => new Set([...prev, userId]));
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [onUserOnline]);

  // 🔌 Socket.IO: Listen for user offline status
  useEffect(() => {
    const unsubscribe = onUserOffline((userId: string) => {
      console.log(`❌ ${userId} is offline`);
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(userId);
        return updated;
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [onUserOffline]);

  // 🔌 Socket.IO: Listen for block events
  useEffect(() => {
    const unsubscribe = onUserBlocked((data: { blockerUserId: string }) => {
      console.log(`🚫 You have been blocked by: ${data.blockerUserId}`);

      // ❌ DO NOT update preferences
      // ❌ DO NOT savePrefs

      // optional: UI refresh / toast / refetch
      // fetchBlockedUsers();
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [onUserBlocked]);

  // 🔌 Socket.IO: Listen for unblock events
  useEffect(() => {
    const unsubscribe = onUserUnblocked((data: { blockerUserId: string }) => {
      console.log(`✅ You have been unblocked by: ${data.blockerUserId}`);

      // ❌ DO NOT update preferences
      // ❌ DO NOT savePrefs
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [onUserUnblocked]);

  // 🔌 Socket.IO: Listen for delete-for-everyone messages
  useEffect(() => {
    const unsubscribe = onMessageDeletedForEveryone((data: { messageId: string }) => {
      console.log("🗑️ MESSAGE DELETED FOR EVERYONE - messageId:", data.messageId);

      const msgKey = `chat_messages_${user?.email || ""}`; // 🔥

      setAllMessages((prev) => {
        const updated = { ...prev };
        let messageFound = false;

        for (const key in updated) {
          const newMessages = updated[key]?.map((msg) => {
            console.log("🧪 checking:", msg.id, "vs", data.messageId);

            if (msg.id === data.messageId) {
              console.log(`✅ MATCH FOUND → Deleting message ${data.messageId} in ${key}`);
              messageFound = true;

              return {
                ...msg,
                isDeleted: true,
                text: "message deleted",
                status: "deleted-for-everyone" as const,
              };
            }

            return msg;
          }) || [];

          updated[key] = newMessages;
        }

        if (!messageFound) {
          console.log(`❌ Message ${data.messageId} NOT FOUND in any conversation`);
        }

        localStorage.setItem(msgKey, JSON.stringify(updated)); // 🔥
        return updated;
      });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [onMessageDeletedForEveryone]);
  useEffect(() => {
    const unsubscribe = onMessageIdConfirmed?.((data) => {
      console.log("🔥 message_id_confirmed received:", data);
      const { clientId, serverId } = data;

      const msgKey = `chat_messages_${user?.email || ""}`; // 🔥

      setAllMessages((prev) => {
        const updated = { ...prev };
        let found = false;

        for (const key in updated) {
          updated[key] = updated[key].map((msg) => {
            if (msg.id === clientId) {
              found = true;
              return { ...msg, id: serverId };
            }
            return msg;
          });
        }

        if (found) {
          localStorage.setItem(msgKey, JSON.stringify(updated)); // 🔥
        }

        return found ? updated : prev;
      });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [onMessageIdConfirmed, user?.email]); // 🔥 user?.email add kiya
  // 🔥 Socket.IO: Listen for message edits (for offline users - sync to localStorage)
  useEffect(() => {
    const unsubscribe = onMessageEdited((data: { messageId: string; content: string }) => {
      console.log("✏️ MESSAGE EDITED - messageId:", data.messageId, "new content:", data.content);

      const msgKey = `chat_messages_${user?.email || ""}`; // 🔥

      setAllMessages((prev) => {
        const updated = { ...prev };
        let messageFound = false;

        for (const key in updated) {
          const newMessages = updated[key]?.map((msg) => {
            if (msg.id === data.messageId) {
              console.log(`✅ EDIT APPLIED → Updated message ${data.messageId} in ${key}`);
              messageFound = true;
              return { ...msg, text: data.content, edited: true };
            }
            return msg;
          }) || [];
          updated[key] = newMessages;
        }

        if (messageFound) {
          localStorage.setItem(msgKey, JSON.stringify(updated)); // 🔥
        }

        return updated;
      });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [onMessageEdited]);
  useEffect(() => {
    const unsubscribe = onMessagePinned?.((data) => {
      const { messageId, isPinned, contactKey } = data;

      const pinnedKey = `pinned_messages_${user?.email || ""}`; // 🔥

      setPinnedMessages((prev) => {
        const newMap = new Map(prev);
        const contactPinned = new Set(newMap.get(contactKey) || []);

        if (isPinned) {
          contactPinned.add(messageId);
        } else {
          contactPinned.delete(messageId);
        }

        newMap.set(contactKey, contactPinned);

        const serializable = Array.from(newMap.entries()).map(([key, set]) => [key, Array.from(set)]);
        localStorage.setItem(pinnedKey, JSON.stringify(serializable)); // 🔥
        if (user?.email) {
          savePrefs(user.email, "pinned_messages", serializable);
        }

        return newMap;
      });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [onMessagePinned, user?.email]); // ✅ dependencies sahi hain

  // 🔌 Socket.IO: Listen for read receipts
  useEffect(() => {
    const unsubscribe = onMessageRead((data: { messageIds: string[]; readerId: string; timestamp?: string; status?: string }) => {
      console.log("[v0] ✅ Real-time read receipt received from:", data.readerId, "Messages:", data.messageIds);

      const msgKey = `chat_messages_${user?.email || ""}`; // 🔥

      setAllMessages((prev) => {
        const updated = { ...prev };
        const readTimestamp = data.timestamp ? new Date(data.timestamp) : new Date();
        let updatedCount = 0;

        let conversationKey = "";
        for (const key in updated) {
          if (key === data.readerId) {
            conversationKey = key;
            break;
          }
        }

        if (conversationKey) {
          updated[conversationKey] = updated[conversationKey]?.map((msg) => {
            if (msg.isOwn && msg.status !== "read") {
              updatedCount++;
              return { ...msg, status: "read" as const, readAt: readTimestamp };
            }
            return msg;
          }) || [];
        }

        console.log(`[v0] 📊 Updated ${updatedCount} messages in conversation ${conversationKey}`);
        localStorage.setItem(msgKey, JSON.stringify(updated)); // 🔥
        return updated;
      });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [onMessageRead]);

  useEffect(() => {
    const updateLastSeen = async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;

      const now = new Date().toISOString();

      // ✅ last_seen hamesha real time set karo — chhupana hai to filtering read-time pe karo
      await supabase.from("profiles").update({ last_seen: now }).eq("id", userId);
    };

    updateLastSeen();
    const interval = setInterval(updateLastSeen, 15000);
    return () => clearInterval(interval);
  }, []); // 🔥 online_visible dependency hata do// 🔥 dependency add ki
  useEffect(() => {
    const loadMessagesFromDB = async () => {
      if (!user?.email) return;

      const msgKey = `chat_messages_${user.email}`;
      const unreadKey = `chat_unread_counts_${user.email}`;

      try {
        const { data: msgs, error } = await supabase
          .from("messages")
          .select("*")
          .or(`sender_email.eq.${user.email},receiver_email.eq.${user.email}`)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Failed to fetch messages from DB:", error);
          const stored = localStorage.getItem(msgKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            const processed = Object.keys(parsed).reduce((acc, key) => {
              acc[key] = parsed[key].map((msg: any) => ({
                ...msg,
                readAt: msg.readAt ? new Date(msg.readAt) : undefined,
              }));
              return acc;
            }, {} as Record<string, Message[]>);
            setAllMessages(processed);
          }
          return;
        }

        if (msgs && msgs.length > 0) {
          const organized: Record<string, Message[]> = {};

          msgs.forEach((msg: any) => {
            // 🔥 Agar maine sender hote hue delete kiya tha, toh mujhe mat dikhao
            if (msg.sender_email === user.email && msg.deleted_for_sender) return;
            // 🔥 Agar maine receiver hote hue delete kiya tha, toh mujhe mat dikhao
            if (msg.receiver_email === user.email && msg.deleted_for_receiver) return;

            const isSelfMessage = msg.sender_email === msg.receiver_email;

            const conversationKey = isSelfMessage
              ? "self"
              : msg.sender_email === user.email
                ? msg.receiver_email
                : msg.sender_email;

            if (!organized[conversationKey]) {
              organized[conversationKey] = [];
            }

            let parsedContent: any = null;
            if (typeof msg.content === "string") {
              try {
                parsedContent = JSON.parse(msg.content);
              } catch {
                parsedContent = { text: msg.content };
              }
            }

            organized[conversationKey].push({
              id: msg.id,
              senderId: msg.sender_email,
              text: msg.is_deleted
                ? "message deleted"
                : (parsedContent?.text || msg.content || ""),
              timestamp: new Date(msg.created_at).getTime(),
              replyTo: parsedContent?.replyTo || null,
              time: formatMessageDateTime(msg.created_at),
              isOwn: msg.sender_email === user.email,
              status: msg.status || "sent",
              edited: msg.edited || false,
              isDeleted: msg.is_deleted || false,
              readAt: msg.read_at ? new Date(msg.read_at) : undefined,
            });
          });

          setAllMessages(organized);
          localStorage.setItem(msgKey, JSON.stringify(organized));
          console.log("✅ Messages loaded from Supabase DB");
        } else {
          console.log("📭 No messages found in DB");
        }
      } catch (err) {
        console.error("Error loading messages:", err);
      }

      const storedUnread = localStorage.getItem(unreadKey);
      if (storedUnread) {
        try {
          setUnreadCounts(JSON.parse(storedUnread));
        } catch (error) {
          console.error("Failed to parse unread counts:", error);
        }
      }
    };

    loadMessagesFromDB();
  }, [user?.email]); // 🔥 user?.email dependency - jab user load ho tab fetch karo

  // 🔥 Load user preferences from database
  useEffect(() => {
    const loadPreferencesFromDB = async () => {
      if (!user?.email) return;

      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", user.email)
          .single();

        if (error && error.code !== "PGRST116") { // PGRST116 = no rows found
          console.error("Error loading preferences:", error);
          return;
        }

        if (data) {
          setPreferences((prev) => ({
            ...prev,
            blocked: new Set(data.blocked || []),
            favorites: new Set(data.favorites || []),
            muted: new Set(data.muted || []),
            pinned: new Set(data.pinned || []),
            backgrounds: data.backgrounds || {},
            online_visible: data.online_visible ?? true,
            read_receipts_enabled: data.read_receipts_enabled ?? true,
            typing_indicator: data.typing_indicator ?? true,
            notifications_enabled: data.notifications_enabled ?? true,
          }));
        }
      } catch (err) {
        console.error("Error loading preferences:", err);
      }
    };

    loadPreferencesFromDB();
  }, [user?.email]);

  // 🔥 Persist unread counts to localStorage
  useEffect(() => {
    const unreadKey = `chat_unread_counts_${user?.email || ""}`; // 🔥
    localStorage.setItem(unreadKey, JSON.stringify(unreadCounts)); // 🔥
  }, [unreadCounts, user?.email]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000); // 🔥 every 15 sec refresh — memo lagne ke baad bhi input lag na ho isliye interval badhaya

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (user?.uid) {
      setUid(user.uid);
    } else if (!isAuthenticated) {
      setUid("");
    }
  }, [isAuthenticated, user?.uid]);

  // 🔥 Mark messages as read when contact becomes active
  // activeContact mark as read useEffect
  useEffect(() => {
    if (activeContact && allMessages) {
      const contactKey = getContactKey(activeContact);
      const messages = allMessages[contactKey] || [];

      const msgKey = `chat_messages_${user?.email || ""}`;
      const unreadKey = `chat_unread_counts_${user?.email || ""}`;

      const unreadMessageIds = messages
        .filter((msg) => !msg.isOwn && msg.status !== "read" && !msg.isDeleted && !msg.id.startsWith("m")) // 🔥 temp client IDs skip karo
        .map((msg) => msg.id);

      if (unreadMessageIds.length > 0) {
        const readTimestamp = new Date();
        const readReceiptsEnabled = preferences.read_receipts_enabled !== false;

        // 🔥 Unread count hamesha reset karo
        setUnreadCounts((prev) => {
          const updated = { ...prev, [contactKey]: 0 };
          localStorage.setItem(unreadKey, JSON.stringify(updated));
          return updated;
        });

        if (readReceiptsEnabled) {
          // 🔥 Receipts ON - sender ko batao
          markMessagesAsRead(contactKey, unreadMessageIds);

          setAllMessages((prev) => {
            const updated = { ...prev };
            updated[contactKey] = updated[contactKey]?.map((msg) =>
              unreadMessageIds.includes(msg.id)
                ? { ...msg, status: "read" as const, readAt: readTimestamp }
                : msg
            ) || [];
            localStorage.setItem(msgKey, JSON.stringify(updated));
            return updated;
          });

          if (requestSentMessagesStatus) {
            setTimeout(() => {
              requestSentMessagesStatus();
            }, 500);
          }
        }
        // 🔥 Receipts OFF - sender ko "seen" nahi dikhega but count clear ho gaya
        // 🔥 Receipts OFF - unread count rahega, sender ko "seen" nahi dikhega
      }
    }
  }, [activeContact, allMessages, markMessagesAsRead, requestSentMessagesStatus]);
  const updateProfile = async (data: { name: string; email: string; avatar: string }) => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user?.id) throw new Error("Not authenticated");

    await supabase
      .from("profiles")
      .update({
        name: data.name,
        avatar: data.avatar, // 🔥 avatar bhi
      })
      .eq("id", authData.user.id);

    // 🔥 Yahi real-time update karega
    await updateAuthProfile({
      name: data.name,
      avatar: data.avatar,
    });
  };
  const isRealMobileDevice = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;

    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";

    // 🔥 User-agent based detection - Android, iOS, aur baaki mobile OS cover karta hai
    const mobileRegex = /android|iphone|ipad|ipod|iemobile|blackberry|bada|windows phone|mobile/i;
    const isUAMobile = mobileRegex.test(ua);

    // 🔥 Touch capability check - extra safety, kuch edge-case devices ke liye
    const isTouchDevice =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0;

    // 🔥 Combine both - agar UA mobile bataye YA touch + chhoti/medium width ho, toh mobile maano
    return isUAMobile || (isTouchDevice && window.innerWidth <= 1024);
  };
  const handleForwardTo = (targetContact: any, text: string) => {
    const contactKey = targetContact.id === "self"
      ? "self"
      : getContactKey(targetContact);

    // 🔥 Image/Audio forward - sirf original content bhejo, "↪ Forwarded:" prefix nahi
    const isImage = text.includes("[IMAGE]");
    const isAudio = text.includes("[AUDIO]");

    // 🔥 Normal text ke liye forwarded prefix, media ke liye original rakhو
    const forwardText = (isImage || isAudio) ? text : text;

    const conversationId = buildConversationId(getUserKey(), contactKey);

    const newMsg: Message = {
      id: `m${Date.now()}`,
      senderId: getUserKey(),
      text: forwardText,
      timestamp: Date.now(),
      time: formatMessageDateTime(Date.now()),
      isOwn: true,
      status: "sent" as const,
    };

    const msgKey = `chat_messages_${user?.email || ""}`;

    setAllMessages((prev) => {
      const updated = {
        ...prev,
        [contactKey]: [...(prev[contactKey] || []), newMsg],
      };
      localStorage.setItem(msgKey, JSON.stringify(updated));
      return updated;
    });
    updateContactOrder(contactKey, newMsg.timestamp);

    if (targetContact.id !== "self") {
      sendMessage(
        conversationId,
        JSON.stringify({ text: forwardText }),
        getContactKey(targetContact),
        newMsg.id,
        undefined
      );
    }
  };
  const handleSelectContact = (contact: Contact) => {
    
    if (isRealMobileDevice()) {
      window.history.pushState({ chatOpen: true }, "", window.location.pathname);
    }
    if (activeContact) {
      const prevContactKey = getContactKey(activeContact);
      setLocalTyping((prev) => ({ ...prev, [prevContactKey]: false }));
      if (activeContact.id !== "self") {
        sendTyping(prevContactKey, false);
      }
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    const msgKey = `chat_messages_${user?.email || ""}`;     // 🔥
    const unreadKey = `chat_unread_counts_${user?.email || ""}`; // 🔥

    setActiveContact(contact);
    const contactKey = getContactKey(contact);
  if ((contact as any)?.isGroup) {
  setGroupActivityCount((prev) => {
    const updated = { ...prev, [contact.id]: 0 };
    localStorage.setItem(`group_activity_${user?.email || ""}`, JSON.stringify(updated)); // 🔥
    return updated;
  });
}
    if (!allMessages[contactKey]) {
      setAllMessages((prev) => {
        const updated = { ...prev, [contactKey]: [] };
        localStorage.setItem(msgKey, JSON.stringify(updated)); // 🔥
        return updated;
      });
    }

    // 🔥 Unread count hamesha reset karo - chahe receipts ON ho ya OFF
    if (contact.id !== "self") {
      setUnreadCounts((prev) => {
        const updated = { ...prev, [contactKey]: 0 };
        localStorage.setItem(unreadKey, JSON.stringify(updated));
        return updated;
      });
    }
  };
    // 🔥 Ref banaya taaki notification click pe hamesha latest handleSelectContact use ho, stale closure na ho
    // 🔥 handleSelectContact ka latest reference update karo (ref upar already declared hai)
  useEffect(() => {
    handleSelectContactRef.current = handleSelectContact;
  });

  // 🔥 Message action handlers
  // Delete for Me - completely remove message from view (only for this user)
  const handleDeleteForMe = async (messageId: string) => {
    if (!activeContact) return;
    const contactKey = getContactKey(activeContact);

    const msgKey = `chat_messages_${user?.email || ""}`;
    const pinnedKey = `pinned_messages_${user?.email || ""}`;

    const { data: userData } = await supabase.auth.getUser();
    const myEmail = (userData.user?.email || "").toLowerCase().trim();

    if (myEmail) {
      // 🔥 Agar main SENDER hoon - sirf sender-side flag set karo (row delete NAHI karo)
      const { error: err1 } = await supabase
        .from("messages")
        .update({ deleted_for_sender: true })
        .eq("id", messageId)
        .ilike("sender_email", myEmail);
      if (err1) console.error("[v0] delete_for_sender failed:", err1);

      // 🔥 Agar main RECEIVER hoon - sirf receiver-side flag set karo (correct column name)
      const { error: err2 } = await supabase
        .from("messages")
        .update({ deleted_for_receiver: true })
        .eq("id", messageId)
        .ilike("receiver_email", myEmail);
      if (err2) console.error("[v0] delete_for_receiver failed:", err2);
    }

    setAllMessages((prev) => {
      const updated = {
        ...prev,
        [contactKey]: prev[contactKey]?.filter((msg) => msg.id !== messageId) || [],
      };
      localStorage.setItem(msgKey, JSON.stringify(updated));
      return updated;
    });

    setPinnedMessages((prev) => {
      const newMap = new Map(prev);
      const contactPinned = newMap.get(contactKey) || new Set();
      contactPinned.delete(messageId);
      newMap.set(contactKey, contactPinned);
      localStorage.setItem(pinnedKey, JSON.stringify(Array.from(newMap.entries())));
      if (user?.email) {
        savePrefs(user.email, "pinned_messages", Array.from(newMap.entries()));
      }
      return newMap;
    });
  };
  const handleDeleteForEveryone = async (messageId: string) => {
    if (!activeContact) return;
    const contactKey = getContactKey(activeContact);
    const msgKey = `chat_messages_${user?.email || ""}`;

    setAllMessages((prev) => {
      const updated = {
        ...prev,
        [contactKey]: prev[contactKey]?.map((msg) =>
          msg.id === messageId
            ? { ...msg, isDeleted: true, status: "deleted-for-everyone" as const, text: "message deleted" }
            : msg
        ) || [],
      };
      localStorage.setItem(msgKey, JSON.stringify(updated));
      return updated;
    });

    // 🔥 YE MISSING THA
    const { error } = await supabase
      .from("messages")
      .update({ is_deleted: true, content: JSON.stringify({ text: "message deleted" }) })
      .eq("id", messageId);
    if (error) console.error("delete-for-everyone DB update failed:", error);

    const recipient = activeContact?.email || activeContact?.uid;
    if (recipient) {
      deleteMessageForEveryone(recipient, messageId);
    }
  };
  const handlePinMessage = (messageId: string) => {
    if (!activeContact) return;
    const contactKey = getContactKey(activeContact);
    const userEmail = user?.email;
    if (!userEmail) return;

    const pinnedKey = `pinned_messages_${userEmail}`; // 🔥

    setPinnedMessages((prev) => {
      const newMap = new Map(prev);
      const contactPinned = new Set(newMap.get(contactKey) || []);
      const isPinned = !contactPinned.has(messageId);

      if (contactPinned.has(messageId)) {
        contactPinned.delete(messageId);
      } else {
        contactPinned.add(messageId);
      }

      newMap.set(contactKey, contactPinned);

      const serializable = Array.from(newMap.entries()).map(([key, set]) => [key, Array.from(set)]);
      localStorage.setItem(pinnedKey, JSON.stringify(serializable)); // 🔥
      savePrefs(userEmail, "pinned_messages", serializable);

      const recipientId = activeContact.email || activeContact.id;
      pinMessage(recipientId, messageId, isPinned, userEmail);

      return newMap;
    });
  };
  const handleReplyMessage = (messageId: string) => {
    // Reply is handled in ChatArea component - just close menu
  };

  const handleForwardMessage = (messageId: string) => {
    // Forward is handled in ChatArea component - just close menu
  };

  const handleClearAllChats = async () => {
    if (!activeContact) return;
    const contactKey = getContactKey(activeContact);

    const msgKey = `chat_messages_${user?.email || ""}`;     // 🔥
    const pinnedKey = `pinned_messages_${user?.email || ""}`; // 🔥

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.email) return;
    const currentEmail = userData.user.email;
    const contactEmail = activeContact.id === "self" ? currentEmail : activeContact.email;

    await supabase
      .from("messages")
      .delete()
      .or(
        `and(sender_email.eq.${currentEmail},receiver_email.eq.${contactEmail}),` +
        `and(sender_email.eq.${contactEmail},receiver_email.eq.${currentEmail})`
      );

    setAllMessages((prev) => {
      const updated = { ...prev, [contactKey]: [] };
      localStorage.setItem(msgKey, JSON.stringify(updated)); // 🔥
      return updated;
    });

    setPinnedMessages((prev) => {
      const newMap = new Map(prev);
      newMap.delete(contactKey);
      localStorage.setItem(pinnedKey, JSON.stringify(Array.from(newMap.entries()))); // 🔥
      return newMap;
    });
  };

const handleTyping = (typing: boolean) => {
  if (!activeContact) return;
  const contactKey = getContactKey(activeContact);

  setLocalTyping((prev) => ({
    ...prev,
    [contactKey]: typing,
  }));

  const typingEnabled = preferences.typing_indicator !== false;
  const isGroup = (activeContact as any)?.isGroup;

  if (isGroup) {
    if (typingEnabled) sendGroupTyping(typing);
  } else if (activeContact.id !== "self" && typingEnabled) {
    sendTyping(contactKey, typing);
  }

  if (typingTimeoutRef.current) {
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;
  }

  if (typing) {
    typingTimeoutRef.current = setTimeout(() => {
      setLocalTyping((prev) => ({
        ...prev,
        [contactKey]: false,
      }));
      if (isGroup) {
        if (typingEnabled) sendGroupTyping(false);
      } else if (activeContact.id !== "self" && typingEnabled) {
        sendTyping(contactKey, false);
      }
      typingTimeoutRef.current = null;
    }, 2000);
  }
};
const sendGroupTyping = (isTyping: boolean) => {
  if (!activeContact || !(activeContact as any)?.isGroup) return;
  const payload = {
    type: "broadcast",
    event: "typing",
    payload: { email: user?.email, isTyping },
  };
  groupChannelRef.current?.send(payload);          // dots ke liye (untouched, jaisa tha)
  groupTypingBroadcastRef.current?.send(payload);   // 🔥 NEW — sidebar ke liye
};
  const handleSend = async (text: string, replyToMsg?: Message | null) => {
    if (!activeContact) return;

    // 🔥 GROUP MESSAGE — alag path, socket wala normal flow skip
        if ((activeContact as any)?.isGroup) {
      const { error } = await supabase.from("group_messages").insert({
        group_id: activeContact.id,
        sender_email: user?.email,
        content: text,
      });
      if (error) {
        console.error("Error sending group message:", error);
      } else {
        updateContactOrder(activeContact.id, Date.now());
      }
      return;
    }

    if (!isConnected) {
      console.warn("❌ Socket not connected. Message not sent.");
      return;
    }

    const msgKey = `chat_messages_${user?.email || ""}`;
    const contactKey = getContactKey(activeContact);
    const conversationId = buildConversationId(getUserKey(), contactKey);
    const isSelfChat = activeContact.id === "self";

    const payload = {
      text,
      replyTo: replyToMsg
        ? {
          id: replyToMsg.id,
          text: replyToMsg.isDeleted ? "message deleted" : replyToMsg.text,
          senderName: replyToMsg.isOwn ? "You" : activeContact.name,
        }
        : null,
    };

    const newMsg: Message = {
      id: `m${Date.now()}`,
      senderId: getUserKey(),
      text: payload.text,
      timestamp: Date.now(),
      time: formatMessageDateTime(Date.now()),
      isOwn: true,
      replyTo: payload.replyTo || undefined,
      status: isSelfChat ? "read" as const : "sent" as const,
      readAt: isSelfChat ? new Date() : undefined,
    };

    setAllMessages((prev) => {
      const updated = {
        ...prev,
        [contactKey]: [...(prev[contactKey] || []), newMsg],
      };
      localStorage.setItem(msgKey, JSON.stringify(updated));
      return updated;
    });
    updateContactOrder(contactKey, newMsg.timestamp);

    if (isSelfChat) {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      supabase.from("messages").insert({
        sender_id: userId,
        sender_email: user?.email,
        receiver_email: user?.email,
        conversation_id: userId,
        content: JSON.stringify(payload),
        status: "read",
        read_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.error("Self message save error:", error);
      });
      return;
    }

    sendTyping(contactKey, false);
    sendMessage(
      conversationId,
      JSON.stringify(payload),
      contactKey,
      newMsg.id,
      payload.replyTo || undefined
    );

    if (requestSentMessagesStatus) {
      setTimeout(() => {
        requestSentMessagesStatus();
      }, 100);
    }
  };

  const handleLogout = () => {
    setLogoutLoading(true);
    setTimeout(async () => {
      await logout();
      navigate("/auth", { replace: true });
    }, 2500);
  };
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (activeContact) {
        setActiveContact(null);
        if (isRealMobileDevice()) {
          window.history.pushState({ chatOpen: false }, "", window.location.pathname);
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeContact]);
  useEffect(() => {
    if (!activeContact) return;

    const updated = friends.find(f => f.id === activeContact.id);

    if (updated) {
      setActiveContact(prev => ({
        ...prev,
        ...updated,
        // 🔥 last_seen null ko respect karo - overwrite mat karo
        last_seen: updated.last_seen ?? null,
      }));
    }
  }, [friends]);


  const currentMessages = activeContact ? allMessages[getContactKey(activeContact)] || [] : [];

if (isLoading) {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
        <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

  return (
    <div className="flex overflow-y-auto bg-background app-height">

               <div
        className={`h-full ${isMobile ? "w-full" : ""}`}
        style={{ display: isMobile && activeContact ? "none" : "flex" }}
      >
        <ChatSidebar
          activeContact={activeContact}
          groupTypingUsers={groupTypingUsers}
          typingProfilesCache={typingProfilesCache}
          onSelect={handleSelectContact}
          setContactOrderIfMissing={setContactOrderIfMissing}  
          filter={filter}
          setFilter={setFilter}
          searchQuery={searchQuery}
          setUnreadCounts={setUnreadCounts}
          groupActivityCount={groupActivityCount}  
          setGroupTypingUsers={setGroupTypingUsers}
          setTypingProfilesCache={setTypingProfilesCache}
          setSearchQuery={setSearchQuery}
          user={user}
          uid={uid}
          contactOrder={contactOrder}
          onLogout={handleLogout}
          dialogOpen={dialogOpen}
          setFriends={setFriends}
          setDialogOpen={setDialogOpen}
          updateContactOrder={updateContactOrder}
          logoutLoading={logoutLoading}
          friends={friends}
          previewImage={previewImage}
          previewTitle={previewTitle}
          setPreviewImage={setPreviewImage}
          setPreviewTitle={setPreviewTitle}
          typingStatus={typingStatus}
          unreadCounts={unreadCounts}
          allMessages={allMessages}
          preferences={preferences}
          setPreferences={setPreferences}
          onSettingsOpen={() => setSettingsOpen(true)}
        />
      </div>

      

      {(!isMobile || activeContact) && (
        <ChatArea
          contact={activeContact}
          groupTypingUsers={activeContact && (activeContact as any)?.isGroup ? (groupTypingUsers[activeContact.id] || []) : []}
  typingProfilesCache={typingProfilesCache}
          messages={currentMessages}
          onSend={handleSend}
          onTyping={handleTyping}
          isTyping={activeContact ? !!typingStatus[getContactKey(activeContact)] : false}
          user={user}
          groupReads={groupReads}
          tick={tick}
          friends={friends}
          preferences={preferences}
          setPreferences={setPreferences}
          setPreviewImage={setPreviewImage}
          setPreviewTitle={setPreviewTitle}
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          pinnedMessages={activeContact ? (pinnedMessages.get(getContactKey(activeContact)) || new Set()) : new Set()}
          onDeleteForMe={handleDeleteForMe}
          onDeleteForEveryone={handleDeleteForEveryone}
          onPinMessage={handlePinMessage}
          onReplyMessage={handleReplyMessage}
          onForwardMessage={handleForwardMessage}
          onClearAllChats={handleClearAllChats}
          setAllMessages={setAllMessages}
          onForwardTo={handleForwardTo}
          isMobile={isMobile}
          onLeaveGroup={async () => {
  if (!activeContact) return;
  const leavingName = user?.name || user?.email || "Someone";

  await supabase.from("group_messages").insert({
    group_id: activeContact.id,
    sender_email: user?.email,
    content: `[SYSTEM]${leavingName} left the group`,
  });

  await supabase
    .from("group_members")
    .delete()
    .eq("group_id", activeContact.id)
    .eq("member_email", user?.email);
  setActiveContact(null);
}}
          onBack={() => setActiveContact(null)}
          onSendAudio={async (audioUrl: string, clientId: string) => {
            if (!activeContact) return;
            const contactKey = getContactKey(activeContact);

            // 🔥 GROUP AUDIO — group_messages table mein insert karo
            if ((activeContact as any)?.isGroup) {
              const { error } = await supabase
                .from("group_messages")
                .insert({
                  group_id: activeContact.id,
                  sender_email: user?.email,
                  content: audioUrl,
                });

              if (error) {
                console.error("Error sending group audio:", error);
                return;
              }

              // 🔥 temp optimistic message hatao, realtime listener asli row add kar dega
              setAllMessages((prev) => ({
                ...prev,
                [contactKey]: (prev[contactKey] || []).filter((m) => m.id !== clientId),
              }));

              return;
            }

            // 🔥 EXISTING 1-to-1 AUDIO FLOW (unchanged)
            const conversationId = buildConversationId(getUserKey(), contactKey);
            const msgKey = `chat_messages_${user?.email || ""}`;

            setAllMessages(prev => {
              const updated = {
                ...prev,
                [contactKey]: (prev[contactKey] || []).map(m =>
                  m.id === clientId ? { ...m, text: audioUrl } : m
                ),
              };
              localStorage.setItem(msgKey, JSON.stringify(updated));
              return updated;
            });

            sendMessage(conversationId, audioUrl, contactKey, clientId, undefined);
          }}
        />
      )}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        preferences={preferences}
        setPreferences={setPreferences}
        updateProfile={updateProfile}
        logout={logout}
      />

      {previewTitle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="relative w-full max-w-xl rounded-3xl bg-card p-6 shadow-2xl border border-border">
            <button
              type="button"
              onClick={() => {
                setPreviewImage(null);
                setPreviewTitle(null);
              }}
              className="absolute right-4 top-4 group rounded-md p-1.5 transition-colors hover:bg-red-500"
              aria-label="Close profile preview"
            >
              <X className="h-5 w-5 text-muted-foreground group-hover:text-white transition-colors" />
            </button>
            <div className="flex flex-col items-center gap-4">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt={previewTitle || "Profile preview"}
                  className="h-64 w-64 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="flex h-64 w-64 items-center justify-center rounded-full bg-muted text-5xl font-bold text-muted-foreground">
                  {previewTitle?.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="text-center">
                <h2 className="text-2xl font-semibold">{previewTitle}</h2>
                <p className="text-sm text-muted-foreground">Profile preview</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Chat;

