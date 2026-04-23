"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { useNavigate } from "react-router-dom";
import { contacts, generateMessages, type Contact, type Message } from "@/lib/chat-data";
import { MessageContextMenu } from "@/components/message-context-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/supabaseClient";
import { Trash2 } from "lucide-react";
import { savePrefs } from "@/lib/savePrefs";
import {
  Search, Send, Paperclip, Smile, MoreVertical, Phone, Video,
  MessageCircle, Settings, LogOut, Star, Users, VolumeX,Bell, ChevronDown,
  ImageIcon, Mic, Clock, Check, X, Ban, Pin, Reply, Forward,
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

  const contactKey = contact.email || contact.id;

  // ✅ ONLY DB (TRUTH)
  const blockedByMe = preferences.blocked.has(contactKey);

  // ✅ SOCKET (OTHER USER ACTION)
  const blockedByThem =
    blockedUsers[contactKey]?.includes(userEmail);

  return blockedByMe || blockedByThem;
};

type PreferencesType = {
  favorites: Set<string>;
  blocked: Set<string>;
  muted: Set<string>;
  pinned: Set<string>;
  backgrounds: Record<string, string>;
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

const getFirstName = (name?: string) => {
  const normalized = normalizeName(name);
  if (!normalized) return "";
  const parts = normalized.split(/\s+/).filter(Boolean);
  return parts[0]?.replace(/[^a-zA-Z0-9]/g, "") || "";
};

const getContactKey = (contact: any): string => {
  return contact.email || contact.uid || contact.id || "";
};

const ChatSidebar = ({
  
  activeContact,
  onSelect,
  filter,
  setFilter,
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
  preferences,
  setPreferences,
}: {
  activeContact: Contact | null;
  onSelect: (c: Contact) => void;
  friends: any[];
  setFriends: (f: any[]) => void;
  filter: string;
  setFilter: (f: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  user: any;
  uid: string;
  onLogout: () => void;
  dialogOpen: boolean;
  setDialogOpen: (v: boolean) => void;
  logoutLoading: boolean;
  previewImage: string | null;
  previewTitle: string | null;
  setPreviewImage: (url: string | null) => void;
  setPreviewTitle: (value: string | null) => void;
  typingStatus: Record<string, boolean>;
  unreadCounts: Record<string, number>;
  preferences: PreferencesType;
  setPreferences: React.Dispatch<React.SetStateAction<PreferencesType>>;
}) => {
  
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { blockedUsers } = useSocket();
const userEmail = authUser?.email;

if (!userEmail) return null;

  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [searchUID, setSearchUID] = useState("");
  const [foundUser, setFoundUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [searchDelayActive, setSearchDelayActive] = useState(false);
  const [infoDialog, setInfoDialog] = useState({
    open: false,
    message: "",
  });
  
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});
  const [acceptedFriends, setAcceptedFriends] = useState<any[]>([]);
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
useEffect(() => {
  const loadBlockedFromDB = async () => {
    if (!userEmail) return;

    const { data, error } = await supabase
      .from("blocks")
      .select("blocked_email")
      .eq("blocker_email", userEmail); // ✅ FIXED

    if (error) {
      console.error("Error loading blocked:", error);
      return;
    }

    setPreferences((prev) => ({
      ...prev,
      blocked: new Set(
        data?.map((item) => item.blocked_email) || []
      ),
    }));
  };

  loadBlockedFromDB();
}, [userEmail]);
  const isOnline = (lastSeen?: string) => {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen + "Z").getTime();
    return diff < 60000;
  };
  
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
          .eq("status", "pending");

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

        console.log("Pending requests for receiverEmail", receiverEmail, {
          authUserEmail: authUser?.email,
          requests: requestsWithProfiles,
        });
        setPendingRequests(requestsWithProfiles);
      } catch (error) {
        console.error("Error fetching requests:", error);
        setPendingRequests([]);
      }
    };

    fetchPendingRequests();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel("friend_requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        () => {
          fetchPendingRequests();
        }
      )
      .subscribe();

    const interval = setInterval(fetchPendingRequests, 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [authUser]);

  // Fetch accepted friends
useEffect(() => {
  const fetchAcceptedFriends = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userEmail = data.session?.user?.email;
      if (!userEmail) return;

      const { data: sentRequests, error: sentError } = await supabase
        .from("friend_requests")
        .select("id,receiver_email")
        .eq("sender_email", userEmail)
        .eq("status", "accepted");

      const { data: receivedRequests, error: receivedError } = await supabase
        .from("friend_requests")
        .select("id,sender_email")
        .eq("receiver_email", userEmail)
        .eq("status", "accepted");

      if (sentError || receivedError) {
        console.error("Error fetching accepted friend requests:", sentError || receivedError);
        return;
      }

      const receiverEmails = sentRequests?.map((r: any) => r.receiver_email).filter(Boolean) || [];
      const senderEmails = receivedRequests?.map((r: any) => r.sender_email).filter(Boolean) || [];
      // Deduplicate: use Set to remove duplicate emails
      const friendEmails = Array.from(new Set([...receiverEmails, ...senderEmails]));

      const { data: friendProfiles, error: profileError } = friendEmails.length
        ? await supabase
            .from("profiles")
            .select("id, name, email, avatar, uid, last_seen")
            .in("email", friendEmails)
        : { data: [], error: null };

      if (profileError) {
        console.error("Error fetching friend profiles:", profileError);
        return;
      }

      // Deduplicate by email before mapping
      const uniqueProfiles = Array.from(
        new Map(
          (friendProfiles || []).map((profile: any) => [profile.email, profile])
        ).values()
      );

      const friends: any[] = uniqueProfiles
        .map((profile: any) => ({
          id: profile.email || profile.uid || profile.id,
          name: profile.name || "Unknown",
          avatar: profile.avatar || "",
          lastMessage: "Connected as friends",
          time: "",
          unread: 0,
          last_seen: profile.last_seen,
          email: profile.email,
          uid: profile.uid,
        }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      setAcceptedFriends(friends);
      setFriends(friends);
    } catch (error) {
      console.error("Error fetching accepted friends:", error);
    }
  };

  // 🔥 initial load
  fetchAcceptedFriends();

  // 🔥 realtime friend_requests changes
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

  // 🔥 realtime profile last_seen updates
  const profileSubscription = supabase
    .channel("profile_online_status")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles" },
      (payload) => {
        if (payload.new?.last_seen) {
          setAcceptedFriends((prev) => {
            const updated = prev.map((friend) =>
              friend.id === payload.new.id
                ? { ...friend, last_seen: payload.new.last_seen }
                : friend
            );

            setFriends(updated);
            return updated;
          });
        }
      }
    )
    .subscribe();

  // 🔥🔥🔥 MOST IMPORTANT (auto refresh fallback)
  const interval = setInterval(fetchAcceptedFriends, 3000);

  return () => {
    subscription.unsubscribe();
    profileSubscription.unsubscribe();
    clearInterval(interval);
  };
}, [authUser]);

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
      const { data: userData } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", authUser?.email)
        .single();

      if (!userData) return;

      // 🔥 Call API to accept & add to user_references
      const backendResponse = await fetch("/api/accept-friend-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          senderEmail,
          receiverEmail: authUser?.email,
        }),
      });

      if (!backendResponse.ok) {
        const errorData = await backendResponse.json();
        throw new Error(errorData.error || "Failed to accept request");
      }

      // Fetch the sender's details to add to chat list
      const { data: senderData } = await supabase
        .from("profiles")
        .select("id, name, email, avatar, uid, last_seen")
        .eq("email", senderEmail)
        .single() as {
          data: {
            id: string;
            name: string;
            email: string;
            avatar: string;
            uid: string;
            last_seen: string;
          } | null;
        };

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
      unread: unreadCounts[f.id] || 0, // 🔥 Add unread count to each friend
    })),
  ];

  const filteredByType = (() => {
  if (filter === "Unread") {
    return baseContacts.filter(
      (c) => c.id !== "self" && (unreadCounts[c.id] || 0) > 0
    );
  } else if (filter === "Favorites") {
    return baseContacts.filter(
      (c) =>
        c.id !== "self" && preferences.favorites.has(c.id)
    );
  }
  return baseContacts;
})();

  const pinnedList = filteredByType.filter(c => c.id !== "self" && preferences.pinned.has(c.id));
  const unpinnedList = filteredByType.filter(c => c.id === "self" || !preferences.pinned.has(c.id));
  
  const filtered = filter === "Favorites"
    ? [...pinnedList, ...filteredByType.filter(c => !preferences.pinned.has(c.id))]
    : [...unpinnedList.slice(0, 1), ...pinnedList, ...unpinnedList.slice(1)];

  return (
    <div className="flex h-full w-80 flex-col border-r bg-card relative">
      {/* Notification Popup - Positioned over sidebar */}
      {notificationOpen && (
        <div 
          data-notification-popup
          className="absolute top-16 left-2 right-2 bg-card border border-border rounded-lg shadow-lg z-50 flex flex-col max-h-96 overflow-y-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center p-3 border-b border-border sticky top-0 bg-card">
            <span className="text-sm font-semibold">Friend Requests</span>
            <button
              onClick={() => setNotificationOpen(false)}
              className="text-muted-foreground hover:text-foreground p-1"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1">
            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
                <Clock size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No requests pending</p>
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
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
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
            onClick={() => navigate("/settings")}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
<div className="px-4 pb-1 mt-3">
  <div className="flex gap-2">
    <Input
  placeholder="Search by UID..."
  value={searchUID}
  onChange={(e) => setSearchUID(e.target.value)}
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

        const { data, error } = await supabase
          .from("profiles")
          .select("id, name, email, uid")
          .eq("uid", searchUID)
          .single();

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
  <div className="mx-auto mt-3 w-full max-w-[19rem] rounded-2xl border border-border bg-muted/70 px-4 py-3 shadow-sm flex items-center gap-3">
    <div className="h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
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
        onClick={() => setFoundUser(null)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:text-destructive transition"
        aria-label="Clear search result"
      >
        <X size={16} />
      </button>
    </div>

    <AlertDialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
      <AlertDialogTrigger asChild>
        <Button className="mt-2 w-full">
          Send Request
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Send Friend Request
          </AlertDialogTitle>

          <AlertDialogDescription>
            Do you want to send request to {foundUser?.name || "this user"}?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel className="hover:bg-red-500 hover:text-white transition-colors">
            Cancel
          </AlertDialogCancel>

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

              // 🔥 Extra safety check - Prevent self request
              if (currentUser.id === foundUser?.id) {
                setRequestDialogOpen(false);
                setInfoDialog({
                  open: true,
                  message: "You cannot send a request to yourself",
                });
                return;
              }

              setRequestLoading(true);

              // Add 2-3 second delay
              await new Promise(resolve => setTimeout(resolve, 2500));

              // ✅ CHECK existing request
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

                setInfoDialog({
                  open: true,
                  message,
                });

                return;
              }

              // ✅ INSERT
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
                setInfoDialog({
                  open: true,
                  message: "Something went wrong",
                });
              } else {
                setInfoDialog({
                  open: true,
                  message: "Request sent successfully!",
                });
                setFoundUser(null); // 🔥 Clear search after successful send
                setSearchUID(""); // 🔥 Clear search input
              }
            }}
            disabled={requestLoading}
            className={`${requestLoading ? 'cursor-not-allowed opacity-60 disabled:pointer-events-auto disabled:cursor-not-allowed' : ''}`}
          >
            <div className="w-full flex items-center justify-center">
              {requestLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </div>
              ) : (
                "Confirm"
              )}
            </div>
          </AlertDialogAction>
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
  className="
    h-10 rounded-xl
    border border-gray-300
    bg-muted pl-10 text-sm
    focus:border-orange-600
    focus:ring-0 focus-visible:ring-0
    ring-offset-0 focus:ring-offset-0
    outline-none
    shadow-none focus:shadow-none
    transition-colors
  "
/>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-3">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`relative w-full rounded-full px-2 py-1.5 text-[11px] font-medium transition-all ${
              filter === f
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

      {/* Contacts */}
      <ScrollArea className="flex-1">
        <div className="px-2">
          {filtered.map((contact) => (
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
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                  activeContact?.id === contact.id
                    ? "bg-primary/10"
                    : "hover:bg-muted"
                }`}
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (contact.avatar) {
                        setPreviewImage(contact.avatar);
                        setPreviewTitle(contact.name || "Profile");
                      }
                    }}
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${contact.avatar ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={contact.avatar} />
                      <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                        {getInitials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  {/* 🔥 Hide online status if blocked - but ALWAYS show for self */}
{(contact.id === "self" || 
  (!isUserBlocked(contact, userEmail, preferences, blockedUsers) &&
   isOnline(contact.last_seen))) && (
  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-orange-500" />
)}
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
{(() => {
  const contactKey = contact.email || contact.id;

  // ✅ ONLY DB = maine block kiya
  const blockedByMe = preferences.blocked.has(contactKey);

  // ✅ SOCKET = usne mujhe block kiya
  const blockedByThem =
    blockedUsers[contactKey]?.includes(userEmail);

  const isBlocked =
    contact.id !== "self" && (blockedByMe || blockedByThem);

  // 🔥 If blocked - show nothing
  if (isBlocked) {
    return null;
  }

  // 🔥 TYPING
  if (typingStatus[getContactKey(contact)]) {
    return (
      <p className="truncate text-xs font-medium text-orange-500 animate-pulse">
        typing...
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs flex-wrap text-muted-foreground">

      {/* 🟠 STATUS */}
      <span>
        {contact.id === "self"
          ? "Active now"
          : isOnline(
              friends.find((f) => f.id === contact.id)?.last_seen
            )
          ? "Active now"
          : "Not Active"}
      </span>

      {/* 🔇 MUTED */}
      {contact.id !== "self" && preferences.muted.has(contact.id) && (
        <div className="flex items-center gap-1">
          <VolumeX className="h-3.5 w-3.5" />
          <span>Muted</span>
        </div>
      )}

    </div>
  );
})()}
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
      top: `${Math.min(contextMenu.y, window.innerHeight - 260)}px`,
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
      <Star size={16} />
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
                    await supabase
                      .from("messages")
                      .delete()
                      .or(
                        `and(sender_email.eq.${currentEmail},receiver_email.eq.${deleteConfirm.contactEmail}),` +
                        `and(sender_email.eq.${deleteConfirm.contactEmail},receiver_email.eq.${currentEmail})`
                      );

                    // Delete friend requests (both directions)
                    await supabase
                      .from("friend_requests")
                      .delete()
                      .match({
                        sender_email: currentEmail,
                        receiver_email: deleteConfirm.contactEmail,
                        status: "accepted",
                      });

                    await supabase
                      .from("friend_requests")
                      .delete()
                      .match({
                        sender_email: deleteConfirm.contactEmail,
                        receiver_email: currentEmail,
                        status: "accepted",
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
              className={`bg-red-500 hover:bg-red-600 text-white ${deleteLoading ? 'cursor-not-allowed opacity-60 disabled:pointer-events-auto disabled:cursor-not-allowed' : ''}`}
            >
              <div className="w-full flex items-center justify-center">
                {deleteLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </div>
                ) : (
                  'Delete'
                )}
              </div>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* User Footer */}
      <div className="border-t p-3">
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
className={`flex items-center gap-2 ${
logoutLoading
? "cursor-not-allowed opacity-70"
: ""
}`}
style={{ cursor: logoutLoading ? "not-allowed" : "pointer" }}
>

{logoutLoading && (
<div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
)}

Confirm

</AlertDialogAction>

</AlertDialogFooter>

</AlertDialogContent>

</AlertDialog>
        </div>
      </div>
    </div>
  );
};

const ChatArea = ({
  contact,
  messages,
  onSend,
  onTyping,
  isTyping,
  user,
  tick,
  friends,
  setPreviewImage,
  setPreviewTitle,
  contextMenu,
  setContextMenu,
  pinnedMessages,
  onDeleteForMe,
  onDeleteForEveryone,
  onPinMessage,
  onReplyMessage,
  onForwardMessage,
  onClearAllChats,
  preferences,
  setPreferences,
}: {
  contact: Contact | null;
  messages: Message[];
  onSend: (text: string, replyTo?: Message | null) => void;
  onTyping: (isTyping: boolean) => void;
  isTyping: boolean;
  user: any;
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

  preferences: PreferencesType;
  setPreferences: React.Dispatch<React.SetStateAction<PreferencesType>>;
}) => {
 
  const { blockUser, unblockUser, onUserBlocked, onUserUnblocked, blockedUsers, setBlockedUsers } = useSocket();
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [bgChangeOpen, setBgChangeOpen] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>(messages);
  
  
  // 🔥 Per-contact background colors (persisted)
  
  
  // 🔥 Per-contact favourites (persisted)

  
const [blockedDialogOpen, setBlockedDialogOpen] = useState<
  false | "blockedByMe" | "blockedByThem"
>(false);
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

const menuRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [isTypingLocal, setIsTypingLocal] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [forwardSearchQuery, setForwardSearchQuery] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clearConfirm, setClearConfirm] = useState<{ contactId: string; contactName: string; contactEmail: string } | null>(null);
  const [clearLoading, setClearLoading] = useState(false);


  // 🔥 Get current contact's bg color
const userEmail = user?.email || "";

const contactKey = contact?.email || contact?.id || "";

const blockedByMe = preferences.blocked.has(contactKey);

const blockedByThem =
  !blockedByMe && blockedUsers[contactKey]?.includes(userEmail);

const isBlocked = blockedByMe || blockedByThem;
  
  const bgColor = preferences.backgrounds[contactKey] || "white";
  
  // 🔥 Check if current contact is favourite
 const favorite = preferences.favorites.has(contactKey);
  
  // 🔥 Check if current user blocked this contact OR this contact blocked current user
  
  // Only check preferences.blocked for "blocked by me" - this is the source of truth after unblock
  const isBlockedByMe = contact?.id !== "self" && preferences.blocked.has(contactKey);
  // For "blocked by them", check the socket state and make sure we're not blocked by them
  // If they unblocked us, blockedUsers[contactKey] won't include our email
  // 🔥 FIXED: After unblock, immediately clear the blockedByThem status for both UI and messaging
  const isBlockedByThem = contact?.id !== "self" && !isBlockedByMe && (blockedUsers[contactKey]?.includes(userEmail) || false);
  const blocked = isBlockedByMe || isBlockedByThem;

  // 🔥 State for forcing re-render to update timestamps
  const [refreshKey, setRefreshKey] = useState(0);
  
  // 🔥 Persist bgColors to localStorage





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

  // 🔥 Auto-refresh timestamps every 30 seconds for "seen" messages
  useEffect(() => {
    const hasReadMessages = messages.some(msg => msg.status === "read" && msg.readAt);
    if (!hasReadMessages) return;

    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [messages]);
  

  // Sync local messages with prop messages
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

useEffect(() => {
  onUserBlocked((data) => {
    setPreferences((prev) => {
      const next = new Set(prev.blocked);
      next.add(data.recipientId); // ✅ now works
      return { ...prev, blocked: next };
    });
  });

  onUserUnblocked((data) => {
    setPreferences((prev) => {
      const next = new Set(prev.blocked);
      next.delete(data.recipientId); // ✅ now works
      return { ...prev, blocked: next };
    });
  });
}, []);

  // Cleanup typing timeout on unmount
  useEffect(() => {
  const handleClick = (e: any) => {
    if (menuRef.current && !menuRef.current.contains(e.target)) {
      setMenuOpen(false);
    }
  };

  if (menuOpen) document.addEventListener("click", handleClick);
  return () => document.removeEventListener("click", handleClick);
}, [menuOpen]);
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

const handleSend = () => {
  const contactKey = contact?.email || contact?.id || "";

  // Only check preferences.blocked for "blocked by me" - this is the source of truth
  const isBlockedByMe = preferences.blocked.has(contactKey);
  
  // For "blocked by them", check socket state but not if we just unblocked them
  const isBlockedByThem = !isBlockedByMe && (blockedUsers[contactKey]?.includes(userEmail) || false);

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
      // Forward the message text
      onSend(`↪ Forwarded: ${forwardMessage.text}`);
    }
    setForwardDialogOpen(false);
    setForwardMessage(null);
  };
const isOnline = (lastSeen?: string) => {
  if (!lastSeen) return false;

  const diff = Date.now() - new Date(lastSeen + "Z").getTime();
  return diff < 60000; // 🔥 1 min
};


  if (!contact) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/20">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <MessageCircle className="h-8 w-8 text-primary-foreground" />
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
    <div className="flex flex-1 flex-col">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (contact.avatar) {
                  setPreviewImage(contact.avatar);
                  setPreviewTitle(getFirstName(contact.name) || "Profile");
                }
              }}
              className={`flex h-10 w-10 items-center justify-center rounded-full ${contact.avatar ? "cursor-pointer" : "cursor-default"}`}
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={contact.avatar} />
                <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                  {getInitials(contact.name)}
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
              {/* 🔥 Show online/offline status with orange dot */}
              {!blocked && (
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-orange-500" />
                  <p className="text-xs text-muted-foreground">
                    {contact.id === "self"
                      ? "Active now"
                      : isOnline(
                          friends.find(f => f.id === contact.id)?.last_seen
                        )
                      ? "Active now"
                      : "Not Active"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
       <div className="flex items-center gap-1">

  {/* 🔍 Search Button */}
  <Button 
    variant="ghost" 
    size="icon" 
    className="h-9 w-9 rounded-xl"
    onClick={() => setSearchOpen(!searchOpen)}
  >
    <Search className="h-4 w-4" />
  </Button>

  {/* 🔥 MENU (Button ke bahar) */}
  <div className="relative" ref={menuRef}>

    {/* 3 dots trigger */}
    <button
      onClick={() => setMenuOpen(!menuOpen)}
      className="
        h-9 w-9 rounded-xl flex items-center justify-center
        hover:bg-muted
      "
    >
      <MoreVertical className="h-5 w-5" />
    </button>

    {/* Dropdown menu */}
    {menuOpen && (
      <div className="absolute right-0 top-12 z-50">
        <div className="bg-card rounded-2xl shadow-lg w-60 py-2 border border-border">

          <button
            onClick={() => {
              setContactInfoOpen(true);
              setMenuOpen(false);
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted rounded-xl transition-colors"
          >
            <Users size={18} />
            <span className="text-sm">Contact info</span>
          </button>

          <button
            onClick={() => {
              setClearConfirm({
                contactId: contact.id,
                contactName: contact.name,
                contactEmail: contact.email || "",
              });
              setMenuOpen(false);
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted rounded-xl transition-colors"
          >
            <Trash2 size={18} />
            <span className="text-sm">Clear all chats</span>
          </button>

          {/* 🔥 Block button - only show for non-self contacts */}
          {contact?.id !== "self" && (
<button
  onClick={async () => {
  const id = contactKey;

  if (blockedByThem) return;

  setPreferences((prev) => {
    const next = new Set(prev.blocked);

    if (next.has(id)) {
      next.delete(id);

      fetch("http://localhost:5000/unblock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocker_email: userEmail,
          blocked_email: id,
        }),
      });

      unblockUser(id);
      setUnblockDialogOpen(true);
    } else {
      next.add(id);

      fetch("http://localhost:5000/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocker_email: userEmail,
          blocked_email: id,
        }),
      });

      blockUser(id);
      setBlockedDialogOpen("blockedByMe");
    }

    return { ...prev, blocked: next };
  });

  setMenuOpen(false);
}}
>
  <Ban size={18} />
  <span>
    {blockedByMe ? "Unblock" : "Block"}
  </span>
</button>
          )}

          <button
            onClick={() => {
              setBgChangeOpen(true);
              setMenuOpen(false);
            }}
            className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted rounded-xl transition-colors"
          >
            <ImageIcon size={18} />
            <span className="text-sm">Change background</span>
          </button>
<button
  onClick={async () => {
    const id = contactKey;

    let updatedFavorites: string[] = [];

    setPreferences((prev) => {
      const next = new Set<string>(prev.favorites || []);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      updatedFavorites = [...next]; // ✅ store latest

      return {
        ...prev,
        favorites: next
      };
    });

    // ✅ use updated value (NOT preferences)
    await savePrefs(user?.email || "", "favorites", updatedFavorites);

    setMenuOpen(false);
  }}
  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-muted rounded-xl transition-colors"
>
  <Star size={18} />
  <span className="text-sm">
    {new Set(preferences.favorites || []).has(contactKey)
      ? "Remove from favourite"
      : "Add to favourite"}
  </span>
</button>

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
                      msgElement.classList.add("ring-2", "ring-primary");
                      setTimeout(() => {
                        msgElement.classList.remove("ring-2", "ring-primary");
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
className={`flex-1 px-6 py-4 transition-colors ${
  bgColor === "dark" ? "bg-slate-900" :

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

  bgColor === "glass" ? "bg-white/70 backdrop-blur-md" :

  "bg-white"
}`}
>
  <div className="space-y-4 min-w-0">
    {localMessages.map((msg) => (
      <div 
        key={msg.id}
        id={`msg-${msg.id}`}
        className={`flex flex-col ${msg.isOwn ? "items-end" : "items-start"} transition-all duration-300`}
     onContextMenu={(e) => {
  e.preventDefault();

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    setContextMenu({
      isOpen: true,
      position: {
        x: e.pageX,
        y: e.pageY,
      },
      messageId: msg.id,
    });
  });
});
}}
      >
        <div
          className={`max-w-[70%] min-w-[120px] break-words rounded-2xl px-3 py-1.5 cursor-context-menu relative group ${
  msg.isOwn
    ? "bg-primary text-primary-foreground rounded-br-md"
    : "bg-muted rounded-bl-md"
}`}
        >
          {/* Pin indicator */}
          {pinnedMessages.has(msg.id) && (
            <div className={`mb-1 text-xs font-semibold flex items-center gap-1 ${msg.isOwn ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              <Pin size={12} />
              Pinned
            </div>
          )}
          
          {/* Reply preview */}
          {msg.replyTo && (
            <div 
              className={`mb-2 pl-2 border-l-2 ${msg.isOwn ? "border-primary-foreground/50" : "border-muted-foreground/50"} text-xs opacity-75 cursor-pointer hover:opacity-100 transition-opacity`}
              onClick={() => {
                const element = document.getElementById(`msg-${msg.replyTo.id}`);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Add a temporary highlight
                  element.classList.add('bg-amber-50', 'dark:bg-amber-950/30');
                  setTimeout(() => {
                    element.classList.remove('bg-amber-50', 'dark:bg-amber-950/30');
                  }, 2000);
                }
              }}
            >
              <div className="font-semibold">{msg.replyTo.senderName}</div>
              <div className="truncate">{msg.replyTo.text}</div>
            </div>
          )}
          
          {msg.image && (
            <img
              src={msg.image}
              alt="Shared"
              className="mb-2 rounded-xl"
            />
          )}
          
          {/* Show "message deleted" for deleted messages */}
          {msg.isDeleted ? (
<p className="text-sm italic opacity-60 break-words whitespace-pre-wrap leading-5 min-h-[20px]">
  message deleted
</p>
          ) : (
   <p className="text-sm break-words whitespace-pre-wrap leading-5 min-h-[20px]">
  {msg.isDeleted ? "message deleted" : msg.text}
</p>
          )}
        </div>

        {/* 🔥 Message time & status - BELOW the bubble */}
        {msg.isOwn && (
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
            <span>{msg.time}</span>
            <span>•</span>
            {msg.status === "read" && msg.readAt ? (
              <span key={refreshKey}>
                {formatReadTime(new Date(msg.readAt))}
              </span>
            ) : msg.status === "sent" ? (
              <span>Delivered</span>
            ) : null}
          </div>
        )}
      </div>
    ))}

    {/* Typing indicator - ONLY shown to receiver when other person is typing */}
    {isTyping && (
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

    <div ref={bottomRef} />
  </div>
</ScrollArea>

      {/* Reply Preview Bar */}
      {replyTo && (
        <div className="border-t border-b bg-muted/50 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1 h-10 bg-primary rounded-full" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-primary">
                  Replying to {replyTo.isOwn ? "yourself" : contact?.name}
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
      <div className="border-t px-6 py-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl">
            <ImageIcon className="h-5 w-5" />
          </Button>
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              placeholder={blocked 
                ? (isBlockedByThem ? "You have been blocked by this user" : "You blocked this user")
                : "Type a message..."}
              value={input}
              disabled={blocked}
              
              onChange={(e) => {
                const newValue = e.target.value;
                setInput(newValue);

                const shouldBeTyping = !!newValue.trim();
                
                // Clear existing timeout
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }
                
                // If user is typing, show indicator
                if (shouldBeTyping) {
                  if (!isTypingLocal) {
                    setIsTypingLocal(true);
                    onTyping(true);
                  }
                  
                  // Set timeout to hide typing indicator after 3 seconds of inactivity
                  typingTimeoutRef.current = setTimeout(() => {
                    setIsTypingLocal(false);
                    onTyping(false);
                  }, 3000);
                }
              }}
              onBlur={() => {
                setIsTypingLocal(false);
                onTyping(false);
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSend();
                  setIsTypingLocal(false);
                  onTyping(false);
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                  }
                }
              }}
              className={`h-12 rounded-xl border-none bg-muted pr-12 text-sm ${
  blocked ? "cursor-not-allowed" : ""
}`}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded-lg"
            >
              <Smile className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-xl">
            <Mic className="h-5 w-5" />
          </Button>
          <Button
            onClick={handleSend}
            disabled={blocked}
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
              if (message && message.text) {
                navigator.clipboard.writeText(message.text);
              }
            }
            setContextMenu({ ...contextMenu, isOpen: false });
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
          isOwn={messages.find((m) => m.id === contextMenu.messageId)?.isOwn || false}
          isPinned={contextMenu.messageId ? pinnedMessages.has(contextMenu.messageId) : false}
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
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No contacts available</p>
            ) : (
              friends
                .filter((friend) => 
                  friend.name.toLowerCase().includes(forwardSearchQuery.toLowerCase())
                )
                .map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => handleForwardTo(friend)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={friend.avatar} />
                      <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(friend.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium">{friend.name}</p>
                    </div>
                  </button>
                ))
            )}
            {friends.length > 0 && friends.filter((f) => f.name.toLowerCase().includes(forwardSearchQuery.toLowerCase())).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No contacts found</p>
            )}
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
              className={`bg-red-500 hover:bg-red-600 text-white ${clearLoading ? 'cursor-not-allowed opacity-60 disabled:pointer-events-auto disabled:cursor-not-allowed' : ''}`}
            >
              <div className="w-full flex items-center justify-center">
                {clearLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Clearing...
                  </div>
                ) : (
                  'Clear'
                )}
              </div>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Contact Info Dialog */}
{contactInfoOpen && contact && (() => {

  // 🔥 BLOCK CHECK (use isUserBlocked function for consistency)
  const isBlocked = isUserBlocked(contact, userEmail, preferences, blockedUsers);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl p-6 w-[380px] shadow-xl border border-border">
        
        <h2 className="text-lg font-semibold mb-4">Contact Info</h2>
        
        <div className="space-y-4">
          
          {/* Avatar + Name */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={contact.avatar} />
              <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>

            <div>
              <p className="font-semibold text-lg">{contact.name}</p>
              <p className="text-xs text-muted-foreground">
                ID: {contact.id}
              </p>
            </div>
          </div>

          {/* 🔥 STATUS (ONLY if NOT BLOCKED) */}
          {!isUserBlocked(contact, userEmail, preferences, blockedUsers) && (
  <div className="border-t pt-4">
    <p className="text-xs font-medium text-muted-foreground mb-1">
      Status
    </p>

    <div className="flex items-center gap-2">
      {(contact.id === "self" ||
        isOnline(
          friends.find((f) => f.id === contact.id)?.last_seen
        )) && (
        <div className="h-2 w-2 rounded-full bg-orange-500" />
      )}

      <span className="text-sm font-medium">
        {contact.id === "self"
          ? "Active now"
          : isOnline(
              friends.find((f) => f.id === contact.id)?.last_seen
            )
          ? "Active now"
          : "Not Active"}
      </span>
    </div>
  </div>
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
            
            <div className="grid grid-cols-3 gap-3">
  {[
    { name: 'Dark', key: 'dark', color: 'bg-slate-900' },

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

    { name: 'Glass', key: 'glass', color: 'bg-white/70 backdrop-blur-md' },
  ].map((bg) => (
    <button
  key={bg.key}
  onClick={() => {
    setPreferences((prev) => {
      const updatedBg = {
        ...prev.backgrounds,
        [contactKey]: bg.key
      };

      // ✅ FIXED SAVE
      savePrefs(user?.email || "", "backgrounds", updatedBg);

      return {
        ...prev,
        backgrounds: updatedBg
      };
    });

    setBgChangeOpen(false);
  }}
  className={`
    h-20 rounded-lg transition-all duration-200 hover:scale-105
    ${bg.color}
    border-2
    ${bg.key === "white" || bg.key === "glass"
      ? "border-gray-300"
      : "border-transparent"}
    ${preferences.backgrounds[contactKey] === bg.key
      ? "ring-2 ring-orange-500 border-transparent"
      : ""}
    hover:border-primary
  `}
  title={bg.name}
/>
  ))}
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
                      element.classList.add(
                        "bg-amber-50",
                        "dark:bg-amber-950/30"
                      );
                      setTimeout(() => {
                        element.classList.remove(
                          "bg-amber-50",
                          "dark:bg-amber-950/30"
                        );
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
                <Search size={24} className="mb-2 opacity-50" />
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
      
      {/* Show blocked message banner when blocked by the other person */}
      
    </div>
  );
};

const Chat = () => {
  const { user, isAuthenticated, isProfileComplete, isLoading, logout } = useAuth();
  const { isConnected, sendMessage, sendTyping, deleteMessageForEveryone, markMessagesAsRead, onMessageReceived, onMessageDeletedForEveryone, onMessageRead, onUserTyping, onUserOnline, onUserOffline, onUserBlocked, onUserUnblocked } = useSocket();
  const [tick, setTick] = useState(0);
  const navigate = useNavigate();
  const [friends, setFriends] = useState<any[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({}); // 🔥 Track unread messages per contact
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; position: { x: number; y: number }; messageId: string | null }>({ isOpen: false, position: { x: 0, y: 0 }, messageId: null }); // 🔥 Context menu state
  const [replyTo, setReplyTo] = useState<Message | null>(null); // 🔥 Reply to message context
  const [pinnedMessages, setPinnedMessages] = useState<Map<string, Set<string>>>(new Map()); // 🔥 Contact-specific pinned messages
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({}); // Only for received typing events
  const [localTyping, setLocalTyping] = useState<Record<string, boolean>>({}); // For local typing state
  const [filter, setFilter] = useState("All messages");
  const [logoutLoading, setLogoutLoading] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uid, setUid] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [preferences, setPreferences] = useState<PreferencesType>({
    favorites: new Set(),
    muted: new Set(),
    pinned: new Set(),
    blocked: new Set(),
    backgrounds: {}
  });

  const getContactKey = (contact: any) => contact?.email || contact?.uid || contact?.id || "";
  const getUserKey = () => user?.email || user?.uid || "";
  const buildConversationId = (a: string, b: string) => [a, b].sort().join(":");
useEffect(() => {
  const unsubscribe = onMessageReceived((message: any) => {
    console.log("📨 New message received:", message);

    const myKey = getUserKey();
    const sender = message.senderId;
    const receiver = message.recipientId;

    const conversationKey =
      sender === myKey ? receiver : sender;

    // ✅ Parse message content properly
    let parsedContent: any = null;

    if (typeof message.content === "string") {
      try {
        parsedContent = JSON.parse(message.content);
      } catch {
        parsedContent = { text: message.content };
      }
    }

    // 🔴 DELETE FOR EVERYONE HANDLE (same as before)
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
        localStorage.setItem("chat_messages", JSON.stringify(updated));
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

    // ✅ 🔥 MAIN FIX HERE
    const payload: Message = {
      id: message.id,
      senderId: message.senderId,
      text: parsedContent?.text || message.content,
      replyTo: parsedContent?.replyTo || null, // 🔥 THIS FIXES YOUR ISSUE
      time: new Date(message.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isOwn: false,
      status: message.status || ("delivered" as const), // 🔥 Use status from server if available
      readAt: message.readAt ? new Date(message.readAt) : undefined,
    };

    // ✅ Save message
    setAllMessages((prev) => {
      const updated = {
        ...prev,
        [conversationKey]: [...(prev[conversationKey] || []), payload],
      };
      localStorage.setItem("chat_messages", JSON.stringify(updated));
      return updated;
    });

    // ✅ Unread count logic
    setUnreadCounts((prev) => {
      if (
        activeContact &&
        getContactKey(activeContact) === conversationKey
      ) {
        return prev;
      }
      return {
        ...prev,
        [conversationKey]: (prev[conversationKey] || 0) + 1,
      };
    });
  });

  return () => {
    if (typeof unsubscribe === "function") unsubscribe();
  };
}, [onMessageReceived, activeContact]);

  // 🔌 Socket.IO: Listen for typing events
  useEffect(() => {
    const unsubscribe = onUserTyping((payload: { userId: string; isTyping: boolean; senderEmail?: string }) => {
      // Use email if provided, otherwise fall back to userId
      const key = payload.senderEmail || payload.userId;
      setTypingStatus((prev) => ({
        ...prev,
        [key]: payload.isTyping,
      }));
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
      // Update preferences to add this user to the blocked list
      setPreferences((prev) => {
        const next = new Set(prev.blocked);
        next.add(data.blockerUserId);
        // Save to database
        savePrefs(user?.email || "", "blocked", [...next]);
        return { ...prev, blocked: next };
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [onUserBlocked, user?.email]);

  // 🔌 Socket.IO: Listen for unblock events
  useEffect(() => {
    const unsubscribe = onUserUnblocked((data: { blockerUserId: string }) => {
      console.log(`✅ You have been unblocked by: ${data.blockerUserId}`);
      // Update preferences to remove this user from the blocked list
      setPreferences((prev) => {
        const next = new Set(prev.blocked);
        next.delete(data.blockerUserId);
        // Save to database
        savePrefs(user?.email || "", "blocked", [...next]);
        return { ...prev, blocked: next };
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [onUserUnblocked, user?.email]);

  // 🔌 Socket.IO: Listen for delete-for-everyone messages
useEffect(() => {
  const unsubscribe = onMessageDeletedForEveryone((data: { messageId: string }) => {
    console.log("🗑️ MESSAGE DELETED FOR EVERYONE - messageId:", data.messageId);

    setAllMessages((prev) => {
      const updated = { ...prev };
      let messageFound = false;

      for (const key in updated) {
        const newMessages = updated[key]?.map((msg) => {
          
          // 🔍 DEBUG (IMPORTANT)
          console.log("🧪 checking:", msg.id, "vs", data.messageId);

          if (msg.id === data.messageId) {
            console.log(`✅ MATCH FOUND → Deleting message ${data.messageId} in ${key}`);
            messageFound = true;

            return {
  ...msg,
  isDeleted: true,
  text: "message deleted",
  status: "deleted-for-everyone" as const
};
          }

          return msg;
        }) || [];

        updated[key] = newMessages;
      }

      if (!messageFound) {
        console.log(`❌ Message ${data.messageId} NOT FOUND in any conversation`);
      }

      localStorage.setItem("chat_messages", JSON.stringify(updated));
      return updated;
    });
  });

  return () => {
    if (typeof unsubscribe === "function") unsubscribe();
  };
}, []);

  // 🔌 Socket.IO: Listen for read receipts
  useEffect(() => {
    const unsubscribe = onMessageRead((data: { messageIds: string[]; readerId: string; timestamp?: string }) => {
      console.log("[v0] Read receipt received:", data);

      setAllMessages((prev) => {
        const updated = { ...prev };
        const readTimestamp = data.timestamp ? new Date(data.timestamp) : new Date();

        for (const key in updated) {
          updated[key] = updated[key]?.map((msg) =>
            data.messageIds.includes(msg.id)
              ? { ...msg, status: "read" as const, readAt: readTimestamp }
              : msg
          ) || [];
        }

        localStorage.setItem("chat_messages", JSON.stringify(updated));
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

    await supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", userId);
  };

  updateLastSeen();

  const interval = setInterval(updateLastSeen, 5000); // 🔥 every 5 sec

  return () => clearInterval(interval);
}, []);
useEffect(() => {
  const stored = localStorage.getItem("chat_messages");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // 🔥 Convert readAt strings back to Date objects
      const processed = Object.keys(parsed).reduce((acc, key) => {
        acc[key] = parsed[key].map((msg: any) => ({
          ...msg,
          readAt: msg.readAt ? new Date(msg.readAt) : undefined,
        }));
        return acc;
      }, {} as Record<string, Message[]>);
      setAllMessages(processed);
    } catch (error) {
      console.error("Failed to parse saved chats:", error);
    }
  }
  
  // 🔥 Load unread counts from localStorage
  const storedUnread = localStorage.getItem("chat_unread_counts");
  if (storedUnread) {
    try {
      setUnreadCounts(JSON.parse(storedUnread));
    } catch (error) {
      console.error("Failed to parse unread counts:", error);
    }
  }
  
  // 🔥 Load pinned messages from localStorage
  const storedPinned = localStorage.getItem("pinned_messages");
  if (storedPinned) {
    try {
      const parsed: [string, string[]][] = JSON.parse(storedPinned);

const newMap: Map<string, Set<string>> = new Map(
  parsed.map(([key, value]) => [
    key,
    new Set<string>(value),
  ])
);

setPinnedMessages(newMap);
    } catch (error) {
      console.error("Failed to parse pinned messages:", error);
    }
  }
}, []);

// 🔥 Load user preferences from database
useEffect(() => {
  const loadPreferencesFromDB = async () => {
    if (!user?.email) return;

    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("email", user.email)
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
  localStorage.setItem("chat_unread_counts", JSON.stringify(unreadCounts));
}, [unreadCounts]);

useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 3000); // 🔥 every 3 sec refresh

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
  useEffect(() => {
    if (activeContact && allMessages) {
      const contactKey = getContactKey(activeContact);
      const messages = allMessages[contactKey] || [];
      const unreadMessageIds = messages
        .filter((msg) => !msg.isOwn && msg.status !== "read" && !msg.isDeleted)
        .map((msg) => msg.id);

      if (unreadMessageIds.length > 0) {
        console.log("[v0] Marking messages as read:", unreadMessageIds);
        const readTimestamp = new Date();
        markMessagesAsRead(contactKey, unreadMessageIds);

        // Update local state immediately (with proper timestamp)
        setAllMessages((prev) => {
          const updated = { ...prev };
          updated[contactKey] = updated[contactKey]?.map((msg) =>
            unreadMessageIds.includes(msg.id)
              ? { ...msg, status: "read" as const, readAt: readTimestamp }
              : msg
          ) || [];
          console.log("[v0] Local state updated with readAt timestamp:", readTimestamp);
          localStorage.setItem("chat_messages", JSON.stringify(updated));
          return updated;
        });

        // Clear unread count
        setUnreadCounts((prev) => ({
          ...prev,
          [contactKey]: 0,
        }));
      }
    }
  }, [activeContact, allMessages, markMessagesAsRead]);

  const handleSelectContact = (contact: Contact) => {
    // Stop typing for previous contact
    if (activeContact) {
      const prevContactKey = getContactKey(activeContact);
      setLocalTyping((prev) => ({
        ...prev,
        [prevContactKey]: false,
      }));
      if (activeContact.id !== "self") {
        sendTyping(prevContactKey, false);
      }
    }

    // Clear any existing typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    setActiveContact(contact);
    const contactKey = getContactKey(contact);
    if (!allMessages[contactKey]) {
      setAllMessages((prev) => {
        const updated = {
          ...prev,
          [contactKey]: [],
        };
        localStorage.setItem("chat_messages", JSON.stringify(updated));
        return updated;
      });
    }

    // 🔥 Mark messages as read - set unread count to 0 for this contact
    if (contact.id !== "self") {
      setUnreadCounts((prev) => ({
        ...prev,
        [contactKey]: 0,
      }));
    }
  };

  // 🔥 Message action handlers
  // Delete for Me - completely remove message from view (only for this user)
  const handleDeleteForMe = (messageId: string) => {
    if (!activeContact) return;
    const contactKey = getContactKey(activeContact);
    
    setAllMessages((prev) => {
      const updated = {
        ...prev,
        [contactKey]: prev[contactKey]?.filter((msg) => msg.id !== messageId) || [],
      };
      localStorage.setItem("chat_messages", JSON.stringify(updated));
      return updated;
    });
    
    // Also remove from pinned messages if it was pinned
    setPinnedMessages((prev) => {
      const newMap = new Map(prev);
      const contactPinned = newMap.get(contactKey) || new Set();
      contactPinned.delete(messageId);
      newMap.set(contactKey, contactPinned);
      localStorage.setItem("pinned_messages", JSON.stringify(Array.from(newMap.entries())));
      return newMap;
    });
  };

  const handleDeleteForEveryone = (messageId: string) => {
    if (!activeContact) return;
    const contactKey = getContactKey(activeContact);
    
    console.log("🗑️ DELETE FOR EVERYONE START");
    console.log("🗑️ activeContact:", activeContact);
    console.log("🗑️ contactKey:", contactKey);
    console.log("🗑️ messageId:", messageId);
    
    // Mark as deleted locally
    setAllMessages((prev) => {
      const updated = {
        ...prev,
        [contactKey]: prev[contactKey]?.map((msg) => {
          if (msg.id === messageId) {
            console.log("🗑️ Marking message as deleted locally:", msg);
            return { ...msg, isDeleted: true, status: "deleted-for-everyone", text: "message deleted" };
          }
          return msg;
        }) || [],
      };
      console.log("🗑️ Updated messages for", contactKey, ":", updated[contactKey]);
      localStorage.setItem("chat_messages", JSON.stringify(updated));
      return updated;
    });
    
    // Emit socket event to notify recipient
    const recipient = activeContact?.email || activeContact?.uid;
    console.log("🗑️ DELETE FOR EVERYONE - recipient:", recipient);
    if (recipient) {
      console.log("🗑️ Calling deleteMessageForEveryone with recipient:", recipient);
      deleteMessageForEveryone(recipient, messageId);
    } else {
      console.error("🗑️ NO RECIPIENT FOUND - activeContact:", activeContact);
    }
  };

  const handlePinMessage = (messageId: string) => {
    if (!activeContact) return;
    const contactKey = getContactKey(activeContact);
    
    setPinnedMessages((prev) => {
      const newMap = new Map(prev);
      const contactPinned = new Set(newMap.get(contactKey) || []);
      
      if (contactPinned.has(messageId)) {
        contactPinned.delete(messageId);
      } else {
        contactPinned.add(messageId);
      }
      
      newMap.set(contactKey, contactPinned);
      localStorage.setItem("pinned_messages", JSON.stringify(Array.from(newMap.entries())));
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
    
    // Get current user
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.email) return;
    const currentEmail = userData.user.email;
    const contactEmail = activeContact.id === "self" ? currentEmail : activeContact.email;

    // Delete all messages between the two users from database
    await supabase
      .from("messages")
      .delete()
      .or(
        `and(sender_email.eq.${currentEmail},receiver_email.eq.${contactEmail}),` +
        `and(sender_email.eq.${contactEmail},receiver_email.eq.${currentEmail})`
      );

    // Clear from local state
    setAllMessages((prev) => {
      const updated = {
        ...prev,
        [contactKey]: [],
      };
      localStorage.setItem("chat_messages", JSON.stringify(updated));
      return updated;
    });
    
    // Also clear pinned messages for this contact
    setPinnedMessages((prev) => {
      const newMap = new Map(prev);
      newMap.delete(contactKey);
      localStorage.setItem("pinned_messages", JSON.stringify(Array.from(newMap.entries())));
      return newMap;
    });
  };

  const handleTyping = (typing: boolean) => {
    if (!activeContact) return;
    const contactKey = getContactKey(activeContact);

    // Update local typing state (only affects UI, not what others see)
    setLocalTyping((prev) => ({
      ...prev,
      [contactKey]: typing,
    }));

    // Only send typing events to other users, not to self
    if (activeContact.id !== "self") {
      sendTyping(contactKey, typing);
    }

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // Only set timeout if typing is true
    if (typing) {
      typingTimeoutRef.current = setTimeout(() => {
        setLocalTyping((prev) => ({
          ...prev,
          [contactKey]: false,
        }));
        // Only send stop typing to other users
        if (activeContact.id !== "self") {
          sendTyping(contactKey, false);
        }
        typingTimeoutRef.current = null;
      }, 3000); // WhatsApp uses ~3 seconds
    }
  };

const handleSend = (text: string, replyToMsg?: Message | null) => {
  if (!activeContact) return;
  if (!isConnected) {
    console.warn("❌ Socket not connected. Message not sent.");
    return;
  }

  const contactKey = getContactKey(activeContact);
  const conversationId = buildConversationId(getUserKey(), contactKey);

  // ✅ Create payload (IMPORTANT)
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

  // ✅ Local message (sender side)
  const newMsg: Message = {
    id: `m${Date.now()}`,
    senderId: getUserKey(),
    text: payload.text,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    isOwn: true,
    replyTo: payload.replyTo || undefined, // 🔥 important
    status: "sent" as const, // 🔥 Messages start as sent when created
  };

  // ✅ Save locally
  setAllMessages((prev) => {
    const updated = {
      ...prev,
      [contactKey]: [...(prev[contactKey] || []), newMsg],
    };
    localStorage.setItem("chat_messages", JSON.stringify(updated));
    return updated;
  });

  sendTyping(contactKey, false);

  // 🔥🔥 MAIN FIX — send JSON instead of plain text
  sendMessage(
    conversationId,
    JSON.stringify(payload), // 🔥 THIS FIXES EVERYTHING
    contactKey,
    newMsg.id
  );
};

 const handleLogout = () => {

setLogoutLoading(true);

setTimeout(() => {

logout();
setDialogOpen(false);
navigate("/settings");;

},2500);

};
useEffect(() => {
  if (!activeContact) return;

  const updated = friends.find(f => f.id === activeContact.id);

  if (updated) {
  setActiveContact({ ...updated }); // 🔥 FORCE NEW OBJECT
}
}, [friends]);
useEffect(() => {
  if (!activeContact && friends.length > 0) {
    setActiveContact(friends[0]); // 🔥 auto select first friend
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
    <div className="flex h-screen overflow-hidden bg-background">
      
      <ChatSidebar
  activeContact={activeContact}
  onSelect={handleSelectContact}
  filter={filter}
  setFilter={setFilter}
  searchQuery={searchQuery}
  setSearchQuery={setSearchQuery}
  user={user}
  uid={uid}
  onLogout={handleLogout}
  dialogOpen={dialogOpen}
  setFriends={setFriends}
  setDialogOpen={setDialogOpen}
  logoutLoading={logoutLoading}
  friends={friends}
  previewImage={previewImage}
  previewTitle={previewTitle}
  setPreviewImage={setPreviewImage}
  setPreviewTitle={setPreviewTitle}
  typingStatus={typingStatus}
  unreadCounts={unreadCounts}
  preferences={preferences}
  setPreferences={setPreferences}
/>

<ChatArea
  contact={activeContact}
  messages={currentMessages}
  onSend={handleSend}
  onTyping={handleTyping}
  isTyping={activeContact ? !!typingStatus[getContactKey(activeContact)] : false}
  user={user}
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
              className="absolute right-4 top-4 rounded-full border border-border bg-background p-2 text-muted-foreground hover:bg-muted/80 hover:text-foreground transition"
              aria-label="Close profile preview"
            >
              <X className="h-4 w-4" />
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

