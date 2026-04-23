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
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
sendMessage: (
  conversationId: string,
  content: string,
  recipientId: string,
  messageId: string
) => void;
  sendTyping: (recipientId: string, isTyping: boolean) => void;
  deleteMessageForEveryone: (recipientId: string, messageId: string) => void;
  markMessagesAsRead: (recipientId: string, messageIds: string[]) => void;
  blockUser: (recipientId: string) => void;
  unblockUser: (recipientId: string) => void;
  blockedUsers: Record<string, string[]>;
  setBlockedUsers: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  onMessageReceived: (callback: (message: Message) => void) => (() => void) | void;
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
      
      try {
        const response = await fetch(`http://localhost:5000/get-blocked-users?email=${encodeURIComponent(user.email)}`);
        if (response.ok) {
          const data = await response.json();
          setBlockedUsers(data.blockedUsers || {});
          console.log("✅ Loaded blocked users from DB:", data.blockedUsers);
        }
      } catch (err) {
        console.error("❌ Error loading blocked users:", err);
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
  useEffect(() => {
  localStorage.setItem("chat_blocked_users", JSON.stringify(blockedUsers));
}, [blockedUsers]);

  const sendMessage = (conversationId: string, content: string, recipientId: string, messageId?: string) => {
    if (socket?.connected) {
      socket.emit("send_message", {
        conversationId,
        content,
        recipientId,
        messageId,
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
    const myEmail = user?.email || "";
    setBlockedUsers((prev) => {
      const updated = {
        ...prev,
        [myEmail]: [...new Set([...(prev[myEmail] || []), recipientId])],
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
    // Update local state immediately: remove from blockedUsers[myEmail]
    const myEmail = user?.email || "";
    setBlockedUsers((prev) => {
      const updated = {
        ...prev,
        [myEmail]: (prev[myEmail] || []).filter((email) => email !== recipientId),
      };
      return updated;
    });
  };

  const onMessageReceived = (callback: (message: Message) => void) => {
    socket?.on("receive_message", callback);
    return () => socket?.off("receive_message", callback);
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
      // When someone blocks us, update state: they now have us in their blocked list
      // This means blockedUsers[blocker.email] should include my email
      const blockerEmail = data.blockerUserId;
      const myEmail = user?.email || "";
      
      setBlockedUsers((prev) => {
        const updated = {
          ...prev,
          [blockerEmail]: [...new Set([...(prev[blockerEmail] || []), myEmail])],
        };
        return updated;
      });
      callback(data);
    };
    socket?.on("user_blocked", wrappedCallback);
    return () => socket?.off("user_blocked", wrappedCallback);
  };

const onUserUnblocked = (callback: (data: { blockerUserId: string; recipientId: string }) => void) => {
   const wrappedCallback = (data: { blockerUserId: string; recipientId: string }) => {
      // When someone unblocks us, remove from their blocked list
      // blockedUsers[blocker.email] no longer contains my email
      const unblockerEmail = data.blockerUserId;
      const myEmail = user?.email || "";
      
      setBlockedUsers((prev) => {
        const updated = {
          ...prev,
          [unblockerEmail]: (prev[unblockerEmail] || []).filter(
            (email) => email !== myEmail
          ),
        };
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

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        sendMessage,
        sendTyping,
        deleteMessageForEveryone,
        markMessagesAsRead,
        blockUser,
        unblockUser,
        onMessageReceived,
        onMessageDeletedForEveryone,
        onMessageRead,
        onUserTyping,
        onUserOnline,
        onUserOffline,
        onUserBlocked,
        onUserUnblocked,
        onMessageBlocked,
        blockedUsers,
        setBlockedUsers,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

