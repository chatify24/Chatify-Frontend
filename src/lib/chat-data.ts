export interface Contact {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  last_seen?: string;
  email?: string;
  uid?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
  isOwn: boolean;
  
  // Optional media
  
  image?: string;
  edited?: boolean;

  // 🔥 NEW FEATURES SUPPORT
  isDeleted?: boolean;
  isPinned?: boolean;

  status?: "sent" | "delivered" | "read" | "deleted-for-everyone";

  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };

  // 🔥 READ RECEIPT SUPPORT
  readAt?: Date;
}

export const contacts: Contact[] = [
  { id: "1", name: "Anna Johnson", avatar: "AJ", lastMessage: "Hey! How's it going today? I've been...", time: "09:15 AM", unread: 2, online: true },
  { id: "2", name: "Brian Carter", avatar: "BC", lastMessage: "Can you help me figure this out? I've bee...", time: "09:22 AM", unread: 0, online: true },
  { id: "3", name: "Clara Smith", avatar: "CS", lastMessage: "Here's your image!", time: "09:30 AM", unread: 1, online: false },
  { id: "4", name: "David Brown", avatar: "DB", lastMessage: "Do you have a minute to talk? I've be...", time: "09:45 AM", unread: 0, online: true },
  { id: "5", name: "Henry Moore", avatar: "HM", lastMessage: "Just checking in—how's everything..", time: "10:35 AM", unread: 0, online: false },
  { id: "6", name: "Isabella Taylor", avatar: "IT", lastMessage: "Is there anything else you'd like to adjust or add?", time: "12:30 PM", unread: 3, online: true },
  { id: "7", name: "Rachel Carter", avatar: "RC", lastMessage: "Can you double-check this for me? I wan..", time: "01:00 PM", unread: 0, online: false },
  { id: "8", name: "Steve Evans", avatar: "SE", lastMessage: "I've been meaning to ask—how's the.", time: "01:15 PM", unread: 0, online: true },
];

export const generateMessages = (contactId: string): Message[] => {
  const msgs: Record<string, Message[]> = {
    "1": [
      { id: "m1", senderId: "1", text: "Hey! How's it going today?", time: "09:10 AM", isOwn: false },
      { id: "m2", senderId: "me", text: "Hey Anna! Doing great, thanks! 😊", time: "09:12 AM", isOwn: true, status: "read" },
      { id: "m3", senderId: "1", text: "I've been working on the new design. Want to take a look?", time: "09:14 AM", isOwn: false },
      { id: "m4", senderId: "me", text: "Sure, send it over!", time: "09:15 AM", isOwn: true, isPinned: true },
      { id: "m5", senderId: "1", text: "Let's go with semi-illustrative. Also, add some small birds in the sky.", time: "09:15 AM", isOwn: false },
    ],

    "2": [
      { id: "m1", senderId: "2", text: "Can you help me figure this out?", time: "09:20 AM", isOwn: false },
      {
        id: "m2",
        senderId: "me",
        text: "Of course! What do you need help with?",
        time: "09:21 AM",
        isOwn: true,
        replyTo: {
          id: "m1",
          senderName: "Brian Carter",
          text: "Can you help me figure this out?"
        }
      },
      { id: "m3", senderId: "2", text: "I've been stuck on this bug for hours 😩", time: "09:22 AM", isOwn: false },
    ],

    "3": [
      {
        id: "m1",
        senderId: "3",
        text: "Here's your image!",
        time: "09:28 AM",
        isOwn: false,
        image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&h=300&fit=crop"
      },
      {
        id: "m2",
        senderId: "me",
        text: "Wow, that looks amazing! 🎨",
        time: "09:30 AM",
        isOwn: true
      },
      {
        id: "m3",
        senderId: "me",
        text: "This message was deleted",
        time: "09:32 AM",
        isOwn: true,
        isDeleted: true,
        status: "deleted-for-everyone"
      }
    ],
  };

  return msgs[contactId] || [
    { id: "m1", senderId: contactId, text: "Hey there! How are you?", time: "10:00 AM", isOwn: false },
    { id: "m2", senderId: "me", text: "I'm good, thanks for asking!", time: "10:05 AM", isOwn: true },
  ];
};