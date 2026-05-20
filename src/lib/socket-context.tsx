import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./auth-context";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: Date;
  conversationId: string;
  status?: "sent" | "delivered" | "read";
  readAt?: Date;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
sendMessage: (
  conversationId: string,
  content: string,
  recipientId: string,
  messageId: string,
  replyTo?: { id: string; text: string; senderName: string } | undefined
) => void;
pinMessage: (recipientId: string, messageId: string, isPinned: boolean, senderKey: string) => void;
onMessageIdConfirmed: (callback: (data: { clientId: string; serverId: string }) => void) => (() => void) | void;
onMessagePinned: (callback: (data: { messageId: string; isPinned: boolean; contactKey: string }) => void) => (() => void) | void;
  sendTyping: (recipientId: string, isTyping: boolean) => void;
  deleteMessageForEveryone: (recipientId: string, messageId: string) => void;
  markMessagesAsRead: (recipientId: string, messageIds: string[]) => void;
  blockUser: (recipientId: string) => void;
  unblockUser: (recipientId: string) => void;
  blockedUsers: Record<string, string[]>;
  setBlockedUsers: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  onMessageReceived: (callback: (message: Message) => void) => (() => void) | void;
  onMessageEdited: (callback: (data: { messageId: string; content: string }) => void) => (() => void) | void;
  onMessageDeletedForEveryone: (callback: (data: { messageId: string }) => void) => (() => void) | void;
  onMessageRead: (callback: (data: { messageIds: string[]; readerId: string }) => void) => (() => void) | void;
  onUserTyping: (callback: (payload: { userId: string; isTyping: boolean }) => void) => (() => void) | void;
  onUserOnline: (callback: (userId: string) => void) => (() => void) | void;
  onUserOffline: (callback: (userId: string) => void) => (() => void) | void;
onUserBlocked: (
  callback: (data: { blockerUserId: string; recipientId: string }) => void
) => (() => void) | void;

onUserUnblocked: (
  callback: (data: { blockerUserId: string; recipientId: string }) => void
) => (() => void) | void;
  onMessageBlocked: (callback: (data: { error: string }) => void) => (() => void) | void;
  onPendingMessagesReceived: (callback: (messages: Message[]) => void) => (() => void) | void;
  onSentMessagesStatusReceived: (callback: (messages: Message[]) => void) => (() => void) | void;
  requestPendingMessages: () => void;
  requestSentMessagesStatus: () => void;
  acknowledgeOfflineMessages: (messageIds: string[]) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Record<string, string[]>>({});
  const { user, isAuthenticated } = useAuth();

  // 🔥 Load blocked users from database on component mount
  useEffect(() => {
    const loadBlockedUsers = async () => {
      if (!user?.email) return;
      
      // First, try to load from localStorage as fallback
      try {
        const cached = localStorage.getItem("chat_blocked_users");
        if (cached) {
          setBlockedUsers(JSON.parse(cached));
          console.log("✅ Loaded blocked users from localStorage (cache)");
        }
      } catch (err) {
        console.error("❌ Error loading cached blocked users:", err);
      }

      // Then try to fetch from DB
      try {
        const response = await fetch(`http://localhost:5000/get-blocked-users?email=${encodeURIComponent(user.email)}`);
        if (response.ok) {
          const data = await response.json();
          setBlockedUsers(data.blockedUsers || {});
          console.log("✅ Loaded blocked users from DB:", data.blockedUsers);
        }
      } catch (err) {
        console.error("❌ Error loading blocked users from DB:", err);
      }
    };

    loadBlockedUsers();
  }, [user?.email]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Initialize Socket.IO connection
    const newSocket = io("http://localhost:5000", {
      auth: {
        userId: user.email,
        userName: user.name,
        userAvatar: user.avatar,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection events
    newSocket.on("connect", () => {
      console.log("✅ Connected to Socket.IO server");
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Disconnected from Socket.IO server");
      setIsConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated, user]);
  // 🔥 Same account ke doosre browser/tab se block sync
useEffect(() => {
  if (!socket) return;
  const handleBlockSynced = (data: { blockedUserId: string; action: "block" | "unblock" }) => {
    const { blockedUserId, action } = data;
    const myEmail = (user?.email || "").toLowerCase().trim();
    console.log(`🔄 Block synced from another tab - action: ${action}, user: ${blockedUserId}`);
    setBlockedUsers((prev) => {
      const updated = { ...prev };
      if (action === "block") {
        if (!updated[myEmail]) updated[myEmail] = [];
        if (!updated[myEmail].includes(blockedUserId)) {
          updated[myEmail].push(blockedUserId);
        }
      } else {
        if (updated[myEmail]) {
          updated[myEmail] = updated[myEmail].filter(
            (email) => email.toLowerCase().trim() !== blockedUserId
          );
        }
      }
      localStorage.setItem("chat_blocked_users", JSON.stringify(updated));
      return updated;
    });
  };
  socket.on("block_synced", handleBlockSynced);
  return () => {
    socket.off("block_synced", handleBlockSynced);
  };
}, [socket, user?.email]);
  useEffect(() => {
  localStorage.setItem("chat_blocked_users", JSON.stringify(blockedUsers));
}, [blockedUsers]);

  const pinMessage = (recipientId: string, messageId: string, isPinned: boolean, senderKey: string) => {
  if (socket?.connected) {
    socket.emit("pin_message", { recipientId, messageId, isPinned, senderKey });
  }
};
const onMessageIdConfirmed = (callback: (data: { clientId: string; serverId: string }) => void) => {
  socket?.on("message_id_confirmed", callback);
  return () => socket?.off("message_id_confirmed", callback);
};

const onMessagePinned = (callback: (data: { messageId: string; isPinned: boolean; contactKey: string }) => void) => {
  socket?.on("message_pinned", callback);
  return () => socket?.off("message_pinned", callback);
};
const sendMessage = (
  conversationId: string,
  content: string,
  recipientId: string,
  messageId?: string,
  replyTo?: { id: string; text: string; senderName: string }
) => {
    if (socket?.connected) {
      socket.emit("send_message", {
        conversationId,
        content,
        recipientId,
        messageId,
        replyTo,
        timestamp: new Date(),
      });
    } else {
      console.warn("Socket not connected. Message not sent.");
    }
  };

  const sendTyping = (recipientId: string, isTyping: boolean) => {
    if (socket?.connected) {
      socket.emit("user_typing", { recipientId, isTyping });
    }
  };

  const deleteMessageForEveryone = (recipientId: string, messageId: string) => {
    console.log("🔌 Socket connected:", socket?.connected);
    console.log("🔌 Socket id:", socket?.id);
    if (socket?.connected) {
      console.log("📤 Sending delete event - recipientId:", recipientId, "messageId:", messageId);
      socket.emit("delete_message_for_everyone", { recipientId, messageId });
      console.log("📤 Delete event emitted successfully");
    } else {
      console.warn("Socket not connected. Delete message not sent.");
    }
  };

  const markMessagesAsRead = (recipientId: string, messageIds: string[]) => {
    if (socket?.connected) {
      socket.emit("mark_messages_read", { recipientId, messageIds, timestamp: new Date() });
    } else {
      console.warn("Socket not connected. Read receipt not sent.");
    }
  };

  const blockUser = (recipientId: string) => {
    if (socket?.connected) {
      socket.emit("block_user", { recipientId });
    } else {
      console.warn("Socket not connected. Block event not sent.");
    }
    // Update local state immediately: blockedUsers[myEmail] contains emails I blocked
    const myEmail = (user?.email || "").toLowerCase().trim();
const recipient = (recipientId || "").toLowerCase().trim();
    setBlockedUsers((prev) => {
      const updated = {
        ...prev,
       [myEmail]: [...new Set([...(prev[myEmail] || []), recipient])],
      };
      return updated;
    });
  };

const unblockUser = (recipientId: string) => {
  if (socket?.connected) {
    socket.emit("unblock_user", { recipientId });
  } else {
    console.warn("Socket not connected. Unblock event not sent.");
  }

  // 🔥 FIX: normalize both
  const myEmail = (user?.email || "").toLowerCase().trim();
  const recipient = (recipientId || "").toLowerCase().trim();

  setBlockedUsers((prev) => {
    return {
      ...prev,
      [myEmail]: (prev[myEmail] || []).filter(
        (email) => email.toLowerCase().trim() !== recipient
      ),
    };
  });
};

  const onMessageReceived = (callback: (message: Message) => void) => {
    socket?.on("receive_message", callback);
    return () => socket?.off("receive_message", callback);
  };

  const onMessageEdited = (callback: (data: { messageId: string; content: string }) => void) => {
    socket?.on("message_edited", callback);
    return () => socket?.off("message_edited", callback);
  };

  const onMessageDeletedForEveryone = (callback: (data: { messageId: string }) => void) => {
    socket?.on("message_deleted_for_everyone", callback);
    return () => socket?.off("message_deleted_for_everyone", callback);
  };

  const onMessageRead = (callback: (data: { messageIds: string[]; readerId: string }) => void) => {
    socket?.on("messages_read", callback);
    return () => socket?.off("messages_read", callback);
  };

  const onUserTyping = (callback: (payload: { userId: string; isTyping: boolean }) => void) => {
    socket?.on("user_typing", callback);
    return () => socket?.off("user_typing", callback);
  };

  const onUserOnline = (callback: (userId: string) => void) => {
    socket?.on("user_online", callback);
    return () => socket?.off("user_online", callback);
  };

  const onUserOffline = (callback: (userId: string) => void) => {
    socket?.on("user_offline", callback);
    return () => socket?.off("user_offline", callback);
  };

const onUserBlocked = (callback: (data: { blockerUserId: string; recipientId: string }) => void) => {
  const wrappedCallback = (data: { blockerUserId: string; recipientId: string }) => {
    const blockerEmail = (data.blockerUserId || "").toLowerCase().trim();
    const myEmail = (user?.email || "").toLowerCase().trim();

    // 🔥 YAHI FIX HAI - setBlockedUsers update karo real-time
    setBlockedUsers((prev) => {
      const updated = { ...prev };
      if (!updated[blockerEmail]) {
        updated[blockerEmail] = [];
      }
      if (!updated[blockerEmail].includes(myEmail)) {
        updated[blockerEmail].push(myEmail);
      }
      return updated;
    });

    callback(data);
  };
  socket?.on("user_blocked", wrappedCallback);
  return () => socket?.off("user_blocked", wrappedCallback);
};

const onUserUnblocked = (callback: (data: { blockerUserId: string; recipientId: string }) => void) => {
  const wrappedCallback = (data: { blockerUserId: string; recipientId: string }) => {
    const unblockerEmail = (data.blockerUserId || "").toLowerCase().trim();
    const myEmail = (user?.email || "").toLowerCase().trim();

    // 🔥 YAHI FIX HAI - setBlockedUsers se remove karo real-time
    setBlockedUsers((prev) => {
      const updated = { ...prev };
      if (updated[unblockerEmail]) {
        updated[unblockerEmail] = updated[unblockerEmail].filter(
          (email) => email.toLowerCase().trim() !== myEmail
        );
      }
      return updated;
    });

    callback(data);
  };
  socket?.on("user_unblocked", wrappedCallback);
  return () => socket?.off("user_unblocked", wrappedCallback);
};

  const onMessageBlocked = (callback: (data: { error: string }) => void) => {
    socket?.on("message_blocked", callback);
    return () => socket?.off("message_blocked", callback);
  };

  const onPendingMessagesReceived = (callback: (messages: Message[]) => void) => {
    // This handles pending messages when user comes back online
    // Listen for a specific event from the server for pending messages
    socket?.on("pending_messages_batch", (messages: Message[]) => {
      console.log(`📬 Received ${messages.length} pending messages on reconnect`);
      callback(messages);
    });
    
    return () => {
      socket?.off("pending_messages_batch");
    };
  };

  const onSentMessagesStatusReceived = (callback: (messages: Message[]) => void) => {
    // This handles read status updates for messages sent by user
    socket?.on("sent_messages_status_batch", (messages: Message[]) => {
      console.log(`👁️ Received ${messages.length} sent messages with status`);
      callback(messages);
    });
    
    return () => {
      socket?.off("sent_messages_status_batch");
    };
  };

  const acknowledgeOfflineMessages = (messageIds: string[]) => {
    if (socket?.connected) {
      socket.emit("acknowledge_offline_messages", { messageIds });
      console.log(`✅ Acknowledged ${messageIds.length} offline messages`);
    }
  };

  const requestPendingMessages = () => {
    if (socket?.connected) {
      socket.emit("request_pending_messages");
      console.log("📤 Requested pending messages from server");
    } else {
      console.warn("Socket not connected. Cannot request pending messages.");
    }
  };

  const requestSentMessagesStatus = () => {
    if (socket?.connected) {
      socket.emit("request_sent_messages_status");
      console.log("📤 Requested sent messages status from server");
    } else {
      console.warn("Socket not connected. Cannot request sent messages status.");
    }
  };

  return (
    <SocketContext.Provider
      value={{
        onMessageIdConfirmed,
        pinMessage,
        onMessagePinned,
        socket,
        isConnected,
        sendMessage,
        sendTyping,
        deleteMessageForEveryone,
        markMessagesAsRead,
        blockUser,
        unblockUser,
        onMessageReceived,
        onMessageEdited,
        onMessageDeletedForEveryone,
        onMessageRead,
        onUserTyping,
        onUserOnline,
        onUserOffline,
        onUserBlocked,
        onUserUnblocked,
        onMessageBlocked,
        onPendingMessagesReceived,
        onSentMessagesStatusReceived,
        requestPendingMessages,
        requestSentMessagesStatus,
        acknowledgeOfflineMessages,
        blockedUsers,
        setBlockedUsers,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

