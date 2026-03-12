import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "react-router-dom";
import { contacts, generateMessages, type Contact, type Message } from "@/lib/chat-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Send, Paperclip, Smile, MoreVertical, Phone, Video,
  MessageCircle, Settings, LogOut, Star, Users, Bell, ChevronDown,
  ImageIcon, Mic,
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

const ChatSidebar = ({
  activeContact,
  onSelect,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  user,
onLogout,
dialogOpen,
setDialogOpen,
logoutLoading,
}: {
  activeContact: Contact | null;
  onSelect: (c: Contact) => void;
  filter: string;
  setFilter: (f: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  user: any;
  onLogout: () => void;
dialogOpen: boolean;
setDialogOpen: (v: boolean) => void;
logoutLoading: boolean;
}) => {
  const filters = ["All messages", "Unread", "Favorites", "Work", "Friends"];
const filtered = [
  {
    id: "self",
    name: `${user?.name} (You)`,
    avatar: user?.avatar,
    lastMessage: "Send a message to yourself",
    time: "",
    unread: 0,
    online: true,
  },
  {
    id: "bot",
    name: "Chattix AI",
    avatar: "/chattix-ai.png",
    lastMessage: "Ask me anything!",
    time: "",
    unread: 0,
    online: true,
  },
];

  return (
    <div className="flex h-full w-80 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">Messages</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
  variant="ghost"
  size="icon"
  className="h-9 w-9 rounded-xl"
  onClick={() => window.location.href = "/settings"}
>
  <Settings className="h-4 w-4" />
</Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 rounded-xl border-none bg-muted pl-10 text-sm"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
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
            <button
              key={contact.id}
              onClick={() => onSelect(contact)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                activeContact?.id === contact.id
                  ? "bg-primary/10"
                  : "hover:bg-muted"
              }`}
            >
              <div className="relative">
                <Avatar className="h-11 w-11">
  <AvatarImage src={contact.avatar} />
  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
    {contact.name?.charAt(0)}
  </AvatarFallback>
</Avatar>
                {contact.online && (
                  <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-[hsl(var(--online))]" />
                )}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{contact.name}</span>
                  <span className="text-[11px] text-muted-foreground">{contact.time}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {contact.lastMessage}
                </p>
              </div>
              {contact.unread > 0 && (
                <div className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                  {contact.unread}
                </div>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* User Footer */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-xl p-2">
         <Avatar className="h-9 w-9">
  <AvatarImage src={user?.avatar} />
  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
    {user?.name?.charAt(0) || "U"}
  </AvatarFallback>
</Avatar>
          <div className="flex-1">
  <p className="text-sm font-semibold">
    {user?.name || "User"} <span className="text-green-500">(You)</span>
  </p>

  <div className="flex items-center gap-1">
    <div className="h-2 w-2 rounded-full bg-green-500"></div>
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
Are you sure you want to logout from Chattix?
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
  botTyping,
}: {
  contact: Contact | null;
  messages: Message[];
  onSend: (text: string) => void;
  user: any;
  botTyping: boolean;
})=> {
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

  if (!contact) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/20">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <MessageCircle className="h-10 w-10 text-primary" />
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
            <Avatar className="h-10 w-10">
  <AvatarImage src={contact.avatar || user?.avatar} />
  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
    {contact.name?.charAt(0)}
  </AvatarFallback>
</Avatar>
            {contact.online && (
              <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-[hsl(var(--online))]" />
            )}
          </div>
          <div>
           <h3 className="text-sm font-semibold">
{contact.name}
{contact.id === user?.id && " (You)"}
</h3>
            <p className="text-xs text-muted-foreground">
              {contact.online ? "Active now" : "Offline"}
            </p>
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

    {/* 🤖 Bot typing animation */}
    {botTyping && (
      <div className="flex justify-start">
        <div className="bg-muted px-4 py-2 rounded-2xl flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
        </div>
      </div>
    )}

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
  const navigate = useNavigate();
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>({});
  const [filter, setFilter] = useState("All messages");
  const [botTyping, setBotTyping] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isAuthenticated) navigate("/");
    else if (!isProfileComplete) navigate("/profile", { replace: true });
  }, [isAuthenticated, isProfileComplete, navigate]);

  const handleSelectContact = (contact: Contact) => {
    setActiveContact(contact);
    if (!allMessages[contact.id]) {
  setAllMessages((prev) => ({
    ...prev,
    [contact.id]: [],
  }));
}
  };
const getBotReply = (msg: string) => {
  const text = msg.toLowerCase();

  const replies: Record<string, string> = {
    "hi": "hello 👋",
    "hello": "hi there 😊",
    "how are you": "I am doing great 😄",
    "what is your name": "My name is Chattix AI 🤖",
    "who made you": "I was created inside the Chattix app 😎",
    "what are you doing": "Just chatting with you!",
    "good morning": "Good morning ☀️",
    "good night": "Good night 🌙",
    "thank you": "You're welcome 👍",
    "bye": "Bye! Have a great day 👋"
  };

  return replies[text] || "Hmm... interesting 🤔";
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

  if (activeContact.id === "bot") {
    setBotTyping(true);

    setTimeout(() => {
      const botMsg: Message = {
        id: `b${Date.now()}`,
        senderId: "bot",
        text: getBotReply(text),
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isOwn: false,
      };

      setAllMessages((prev) => ({
        ...prev,
        [activeContact.id]: [...(prev[activeContact.id] || []), botMsg],
      }));

      setBotTyping(false);
    }, 2500);
  }
};

 const handleLogout = () => {

setLogoutLoading(true);

setTimeout(() => {

logout();
setDialogOpen(false);
navigate("/");

},2500);

};

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
onLogout={handleLogout}
dialogOpen={dialogOpen}
setDialogOpen={setDialogOpen}
logoutLoading={logoutLoading}
/>
<ChatArea
  contact={activeContact}
  messages={currentMessages}
  onSend={handleSend}
  user={user}
  botTyping={botTyping}
/>
    </div>
  );
};

export default Chat;
