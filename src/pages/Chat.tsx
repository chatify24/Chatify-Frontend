import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "react-router-dom";
import { contacts, generateMessages, type Contact, type Message } from "@/lib/chat-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "../supabaseClient";
import {
  Search, Send, Paperclip, Smile, MoreVertical, Phone, Video,
  MessageCircle, Settings, LogOut, Star, Users, Bell, ChevronDown,
  ImageIcon, Mic, Clock, Check, X, Ban,
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

const ChatSidebar = ({
  activeContact,
  onSelect,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  user,
  uid, // 🔥 YE ADD KAR
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
}) => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

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
  const [pinnedContacts, setPinnedContacts] = useState<Set<string>>(new Set());
  const [mutedContacts, setMutedContacts] = useState<Set<string>>(new Set());
  const [favoriteContacts, setFavoriteContacts] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    contactId: string;
    contactName: string;
    contactEmail: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  
  // Fetch pending friend requests
  
 const isOnline = (lastSeen?: string) => {
  if (!lastSeen) return false;

  const diff = Date.now() - new Date(lastSeen + "Z").getTime();

  return diff < 60000; // 🔥 1 min
};

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

      const friends: any[] = (friendProfiles || [])
        .map((profile: any) => ({
          id: profile.id,
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

      // Update request status
      await supabase
        .from("friend_requests")
        .update({ status: "accepted" })
        .eq("id", requestId);

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
  id: senderData.id,
  name: senderData.name || "Unknown",
  avatar: senderData.avatar || "",
  lastMessage: "Connected as friends",
  time: "",
  unread: 0,
  last_seen: senderData.last_seen, // ✅ ADD THIS
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
    ...acceptedFriends,
  ];

  const filteredByType = filter === "Favorites" 
    ? baseContacts.filter(c => c.id !== "self" && favoriteContacts.has(c.id))
    : baseContacts;

  const pinnedList = filteredByType.filter(c => c.id !== "self" && pinnedContacts.has(c.id));
  const unpinnedList = filteredByType.filter(c => c.id === "self" || !pinnedContacts.has(c.id));
  
  const filtered = filter === "Favorites"
    ? [...pinnedList, ...filteredByType.filter(c => !pinnedContacts.has(c.id))]
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

        setLoadingUser(true);
        setSearchDelayActive(true);

        // Add 3 second delay
        await new Promise(resolve => setTimeout(resolve, 3000));

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

              if (!currentUser) return;

              // ❌ self request
              if (currentUser.id === foundUser.id) {
                setRequestDialogOpen(false);
                setInfoDialog({
                  open: true,
                  message: "You cannot send request to yourself",
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
            className={`w-full rounded-full px-2 py-1.5 text-[11px] font-medium transition-all ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f}
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
                  setContextMenu({
                    contactId: contact.id,
                    contactName: contact.name,
                    x: e.clientX,
                    y: e.clientY,
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
                  {(contact.id === "self" || isOnline(contact.last_seen)) && (
                    <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-orange-500" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {contact.name}
                      {pinnedContacts.has(contact.id) && " 📌"}
                      {favoriteContacts.has(contact.id) && " ⭐"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{contact.time}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    {(contact.id === "self" || isOnline(
                      friends.find(f => f.id === contact.id)?.last_seen
                    ))}
                    <p className="truncate text-xs text-muted-foreground">
                      {mutedContacts.has(contact.id) 
                        ? "🔇 Muted" 
                        : contact.id === "self" 
                        ? "Active now"
                        : isOnline(
                            friends.find(f => f.id === contact.id)?.last_seen
                          )
                        ? "Active now"
                        : "Not Active"}
                    </p>
                  </div>
                </div>
                {contact.unread > 0 && (
                  <div className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {contact.unread}
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
          className="fixed w-44 rounded-2xl border border-border bg-card shadow-2xl z-50"
          style={{
            left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px`,
            top: `${Math.min(contextMenu.y, window.innerHeight - 220)}px`,
          }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button
            onClick={() => {
              setPinnedContacts((prev) => {
                const newSet = new Set(prev);
                if (newSet.has(contextMenu.contactId)) {
                  newSet.delete(contextMenu.contactId);
                } else {
                  newSet.add(contextMenu.contactId);
                }
                return newSet;
              });
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-muted/70 transition-colors rounded-t-2xl"
          >
            {pinnedContacts.has(contextMenu.contactId) ? "Unpin" : "Pin"}
          </button>
          <button
            onClick={() => {
              setMutedContacts((prev) => {
                const newSet = new Set(prev);
                if (newSet.has(contextMenu.contactId)) {
                  newSet.delete(contextMenu.contactId);
                } else {
                  newSet.add(contextMenu.contactId);
                }
                return newSet;
              });
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-muted/70 transition-colors border-t border-border"
          >
            {mutedContacts.has(contextMenu.contactId) ? "Unmute" : "Mute"}
          </button>
          <button
            onClick={() => {
              setFavoriteContacts((prev) => {
                const newSet = new Set(prev);
                if (newSet.has(contextMenu.contactId)) {
                  newSet.delete(contextMenu.contactId);
                } else {
                  newSet.add(contextMenu.contactId);
                }
                return newSet;
              });
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-muted/70 transition-colors border-t border-border"
          >
            {favoriteContacts.has(contextMenu.contactId) ? "Remove from Favorites" : "Add to Favorites"}
          </button>
          <button
            onClick={() => {
              setDeleteConfirm({
                contactId: contextMenu.contactId,
                contactName: contextMenu.contactName,
                contactEmail: friends.find((f) => f.id === contextMenu.contactId)?.email || "",
              });
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-3 text-sm text-destructive hover:bg-destructive/20 transition-colors border-t border-border rounded-b-2xl"
          >
            Delete
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
  user,
  tick,
  friends,
  setPreviewImage,
  setPreviewTitle,
}: {
  contact: Contact | null;
  messages: Message[];
  onSend: (text: string) => void;
  user: any;
  tick: number;
  friends: any[];   // 🔥 ADD THIS
  setPreviewImage: (url: string | null) => void;
  setPreviewTitle: (value: string | null) => void;
}) => {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };
const isOnline = (lastSeen?: string) => {
  if (!lastSeen) return false;

  const diff = Date.now() - new Date(lastSeen + "Z").getTime();
  return diff < 60000; // 🔥 1 min
};
  console.log("CONTACT:", contact);
console.log("LAST SEEN:", contact?.last_seen);

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
            <div className="flex items-center gap-1">
              {(contact.id === "self" || isOnline(
                friends.find(f => f.id === contact.id)?.last_seen
              )) && (
                <div className="h-2 w-2 rounded-full bg-orange-500"></div>
              )}
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
          </div>
        </div>
        <div className="flex items-center gap-1">
  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
    <Star className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
    <MoreVertical className="h-4 w-4" />
  </Button>
</div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-6 py-4">
  <div className="space-y-4">
    {messages.map((msg) => (
      <div key={msg.id} className={`flex ${msg.isOwn ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
            msg.isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          }`}
        >
          {msg.image && (
            <img
              src={msg.image}
              alt="Shared"
              className="mb-2 rounded-xl"
            />
          )}
          <p className="text-sm">{msg.text}</p>
          <p className={`mt-1 text-[10px] ${msg.isOwn ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {msg.time}
          </p>
        </div>
      </div>
    ))}

    <div ref={bottomRef} />
  </div>
</ScrollArea>

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
              placeholder="Type a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="h-12 rounded-xl border-none bg-muted pr-12 text-sm"
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
            size="icon"
            className="h-12 w-12 shrink-0 rounded-xl bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const Chat = () => {
  const { user, isAuthenticated, isProfileComplete, logout } = useAuth();
  const [tick, setTick] = useState(0);
  const navigate = useNavigate();
  const [friends, setFriends] = useState<any[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>({});
  const [filter, setFilter] = useState("All messages");
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uid, setUid] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  useEffect(() => {
    if (!isAuthenticated) navigate("/");
    else if (!isProfileComplete) navigate("/profile", { replace: true });
  }, [isAuthenticated, isProfileComplete, navigate]);
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
  const interval = setInterval(() => {
    setTick(t => t + 1);
  }, 3000); // 🔥 every 3 sec refresh

  return () => clearInterval(interval);
}, []);
useEffect(() => {
  const getUID = async () => {
    const { data: authData } = await supabase.auth.getUser();
    const realUser = authData.user;

    if (!realUser?.id) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("uid")
      .eq("id", realUser.id)
      .single();

    console.log(data, error);

    if (data?.uid) {
      setUid(data.uid);
    }
  };

  getUID();
}, []);

  const handleSelectContact = (contact: Contact) => {
    setActiveContact(contact);
    if (!allMessages[contact.id]) {
  setAllMessages((prev) => ({
    ...prev,
    [contact.id]: [],
  }));
}
  };
const handleSend = (text: string) => {
  if (!activeContact) return;

  const newMsg: Message = {
    id: `m${Date.now()}`,
    senderId: "me",
    text,
    time: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    isOwn: true,
  };

  setAllMessages((prev) => ({
    ...prev,
    [activeContact.id]: [...(prev[activeContact.id] || []), newMsg],
  }));
};

 const handleLogout = () => {

setLogoutLoading(true);

setTimeout(() => {

logout();
setDialogOpen(false);
navigate("/");

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

  const currentMessages = activeContact ? allMessages[activeContact.id] || [] : [];

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
/>
<ChatArea
  contact={activeContact}
  messages={currentMessages}
  onSend={handleSend}
  user={user}
  tick={tick}
  friends={friends}
  setPreviewImage={setPreviewImage}
  setPreviewTitle={setPreviewTitle}
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
