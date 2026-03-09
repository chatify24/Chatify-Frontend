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

const ChatSidebar = ({
  activeContact,
  onSelect,
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  user,
  onLogout,
}: {
  activeContact: Contact | null;
  onSelect: (c: Contact) => void;
  filter: string;
  setFilter: (f: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  user: any;
  onLogout: () => void;
}) => {
  const filters = ["All messages", "Unread", "Favorites", "Work", "Friends"];
  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
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
                  <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                    {contact.avatar}
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
            <p className="text-sm font-semibold">{user?.name || "User"}</p>
            <p className="text-[11px] text-muted-foreground">Online</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const ChatArea = ({
  contact,
  messages,
  onSend,
}: {
  contact: Contact | null;
  messages: Message[];
  onSend: (text: string) => void;
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

  if (!contact) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-muted/20">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <MessageCircle className="h-10 w-10 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold">Chat with Sunday AI!</h2>
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
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
                {contact.avatar}
              </AvatarFallback>
            </Avatar>
            {contact.online && (
              <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-[hsl(var(--online))]" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold">{contact.name}</h3>
            <p className="text-xs text-muted-foreground">
              {contact.online ? "Online" : "Offline"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
            <Video className="h-4 w-4" />
          </Button>
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
  const navigate = useNavigate();
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [allMessages, setAllMessages] = useState<Record<string, Message[]>>({});
  const [filter, setFilter] = useState("All messages");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isAuthenticated) navigate("/");
    else if (!isProfileComplete) navigate("/profile");
  }, [isAuthenticated, isProfileComplete, navigate]);

  const handleSelectContact = (contact: Contact) => {
    setActiveContact(contact);
    if (!allMessages[contact.id]) {
      setAllMessages((prev) => ({
        ...prev,
        [contact.id]: generateMessages(contact.id),
      }));
    }
  };

  const handleSend = (text: string) => {
    if (!activeContact) return;
    const newMsg: Message = {
      id: `m${Date.now()}`,
      senderId: "me",
      text,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isOwn: true,
    };
    setAllMessages((prev) => ({
      ...prev,
      [activeContact.id]: [...(prev[activeContact.id] || []), newMsg],
    }));
  };

  const handleLogout = () => {
    logout();
    navigate("/");
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
      />
      <ChatArea contact={activeContact} messages={currentMessages} onSend={handleSend} />
    </div>
  );
};

export default Chat;
