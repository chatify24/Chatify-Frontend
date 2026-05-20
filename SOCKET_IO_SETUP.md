# Socket.IO Real-Time Messaging Setup ✨

Your chat application is now configured for **real-time messaging** with Socket.IO!

## 🚀 What's Been Implemented

### ✅ Backend (Backend/server.js)
- Socket.IO server initialized on port 5000
- Real-time message handling with `send_message` event
- Online/offline user tracking
- Typing indicator support
- Automatic message persistence to Supabase (messages table)
- CORS enabled for client connections

### ✅ Frontend (src/lib/socket-context.tsx)
- Socket.IO client context for React
- Connection management with auth integration
- Methods:
  - `sendMessage()` - Send messages in real-time
  - `onMessageReceived()` - Listen for incoming messages
  - `onUserOnline()` - Track when users come online
  - `onUserOffline()` - Track when users go offline
- Automatic reconnection handling

### ✅ App Setup (src/App.tsx)
- SocketProvider wrapped around the entire app
- Works seamlessly with existing AuthProvider
- Ready to use in any component

## 🔧 Installation & Setup

### 1. Install Dependencies

**Backend:**
```bash
cd Backend
npm install socket.io
```

**Frontend:**
```bash
npm install socket.io-client
```

### 2. Database Setup (Supabase)

Create a `messages` table in Supabase:

```sql
CREATE TABLE messages (
  id BIGINT PRIMARY KEY DEFAULT nextval('messages_id_seq'),
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  sender_avatar TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for faster queries
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

### 3. Start the Servers

**Backend:**
```bash
cd Backend
npm start
# or
node server.js
```

**Frontend (in another terminal):**
```bash
npm run dev
```

## 📝 How to Use in Your Chat Component

### Import the Socket Hook
```tsx
import { useSocket } from "@/lib/socket-context";
```

### Initialize in Chat Component
```tsx
const Chat = () => {
  const { socket, isConnected, sendMessage, onMessageReceived, onUserOnline, onUserOffline } = useSocket();
  
  // Listen for messages
  useEffect(() => {
    const unsubscribe = onMessageReceived((message) => {
      console.log("New message:", message);
      // Update your UI with the new message
      setMessages(prev => [...prev, message]);
    });
    
    return () => unsubscribe?.();
  }, [onMessageReceived]);
  
  // Send message
  const handleSendMessage = (content: string) => {
    if (isConnected && selectedContact) {
      sendMessage(
        selectedContact.id,  // conversationId
        content,             // message content
        selectedContact.email // recipientId
      );
    }
  };
  
  return (
    // Your chat UI
  );
};
```

## 🎯 Key Features

### Real-Time Messaging
Messages are delivered instantly between online users

### Online Status Tracking
- Users automatically appear online when they log in
- Users appear offline when they disconnect
- Typing indicators (ready to use)

### Message Persistence
- Messages are automatically saved to Supabase
- Users can see chat history even if they were offline

### Auto-Reconnection
- Client automatically reconnects if connection drops
- Max 5 reconnection attempts with exponential backoff

## 📊 Event Flow

```
User A sends message
    ↓
Message emitted via socket.emit("send_message", data)
    ↓
Backend receives on "send_message"
    ↓
Message saved to Supabase database
    ↓
Backend checks if recipient is online
    ↓
If online: Emit "receive_message" to recipient's socket
If offline: Message waits in database
    ↓
User B receives message and UI updates
```

## 🔌 Socket Events Reference

### Frontend to Backend
- `send_message` - Send a message
- `user_typing` - Send typing indicator

### Backend to Frontend
- `receive_message` - Receive a message
- `user_online` - User came online
- `user_offline` - User went offline
- `user_typing` - Receive typing indicator
- `message_error` - Error sending message
- `connect_error` - Connection error

## ⚙️ Configuration

### Port
- Backend: `5000` (can be changed in Backend/server.js and socket-context.tsx)
- Frontend connects to: `https://chatify-backend-mrlh.onrender.com`

### CORS
Currently allows all origins. For production, update in Backend/server.js:
```javascript
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "https://yourdomain.com",
    methods: ["GET", "POST"],
  },
});
```

## 🐛 Troubleshooting

### Messages not sending?
- ✅ Check if both servers are running
- ✅ Check if socket is connected: `isConnected` should be true
- ✅ Check browser console for errors
- ✅ Verify recipient is online

### Socket not connecting?
- ✅ Ensure Backend is running on port 5000
- ✅ Check CORS settings in Backend/server.js
- ✅ Check browser Network tab for connection attempts
- ✅ Look for "Connection error" messages in console

### Messages not saving to database?
- ✅ Ensure `messages` table exists in Supabase
- ✅ Check Supabase auth keys are correct in Backend
- ✅ Check table structure matches what we're inserting

## 📚 Example: Complete Chat Integration

See `SOCKET_IO_GUIDE.ts` for detailed examples including:
- Typing indicators
- Online status display
- Error handling
- Optimistic UI updates

## 🎉 You're All Set!

Your real-time messaging is ready to use. Start by:
1. Running both servers
2. Updating Chat.tsx to use the `useSocket` hook
3. Testing with multiple users

Happy coding! 🚀
