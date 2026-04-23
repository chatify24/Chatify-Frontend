import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import cloudinary from "cloudinary";
import multer from "multer";
import { createClient } from '@supabase/supabase-js';
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

dotenv.config();
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
}); 
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const app = express();
const storage = multer.memoryStorage();
const upload = multer({ storage });
app.use(cors());
app.use(express.json());
app.use(session({
  secret: "chatifysecret",
  resave: false,
  saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

const otpStore = {}; 
// Format:
// otpStore[email] = {
//   otp: "123456",
//   expiresAt: timestamp
// }
const generateOtpTemplate = (otp) => {
return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Chatify OTP</title>
</head>

<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px 10px;">
<tr>
<td align="center">

<table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;">

<tr>
<td style="text-align:center;padding-bottom:20px;">

<img
src="https://res.cloudinary.com/dpaiyfwdu/image/upload/v1776595107/chatify_gzok1x.png"
width="150"
style="display:block;margin:auto;margin-bottom:10px;"
alt="Chatify"
/>

<div style="font-size:28px;font-weight:700;color:#ff6a00;">
Chatify Security Verification
</div>

</td>
</tr>

<tr>
<td style="text-align:center;padding:0 35px 30px 35px;">

<div style="font-size:16px;color:#555;line-height:26px;margin-bottom:30px;">
Security verification is required to protect your Chatify account.<br>
Please use the code below to confirm your identity and continue securely.
</div>

<div style="
display:inline-block;
background:#ff6a00;
padding:18px 60px;
border-radius:8px;
font-size:34px;
font-weight:700;
letter-spacing:8px;
color:#ffffff;
margin-bottom:25px;
">
${otp}
</div>

<div style="font-size:15px;color:#e53935;font-weight:600;margin-bottom:25px;">
⚠ Do NOT share this OTP with anyone
</div>

<hr style="border:none;border-top:1px solid #eee;margin:25px 0;">

<div style="font-size:14px;color:#777;line-height:22px;">
If this wasn't you, you can safely ignore this email.<br><br>
© ${new Date().getFullYear()} Chatify. All rights reserved.
</div>

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;
};

// Gmail transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send OTP
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000);
  otpStore[email] = {
  otp: otp.toString(),
  expiresAt: Date.now() + 5 * 60 * 1000 // 5 min expiry
};
// Reusable OTP Email Template

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Chatify OTP Code",
      html: generateOtpTemplate(otp)
    });

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// Verify OTP
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const record = otpStore[email];

  if (!record) {
    return res.status(400).json({ error: "OTP not found" });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ error: "OTP expired" });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  delete otpStore[email];
  res.json({ success: true });
});
app.post("/resend-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[email] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your New Chatify OTP Code",
       html: generateOtpTemplate(otp)

    
    });

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Failed to resend OTP" });
  }
});
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    return done(null, profile);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

app.get("/auth/google", (req, res, next) => {
  const mode = req.query.mode || "login";

  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
    state: mode   // 🔥 IMPORTANT
  })(req, res, next);
});

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    const mode = req.query.state; // login या signup
    const email = req.user.emails[0].value; // Google से selected email

    // frontend को भेज दो
    res.redirect(`http://localhost:8080/google-auth?email=${encodeURIComponent(email)}&mode=${mode}`);
  }
);
app.post("/upload-profile", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const result = await new Promise((resolve, reject) => {
      cloudinary.v2.uploader
        .upload_stream(
          { folder: "chatify_profiles" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(req.file.buffer);
    });

    res.json({ imageUrl: result.secure_url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});
app.post("/reset-password", async (req, res) => {

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password required"
    });
  }

  try {
    // Get user ID from profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      return res.status(400).json({
        error: "User not found"
      });
    }

    // Update password using Supabase admin
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: password
    });

    if (updateError) {
      console.log("Password update error:", updateError);
      return res.status(500).json({
        error: "Failed to update password"
      });
    }

    res.json({
      success: true
    });

  } catch (err) {
    console.log("Reset password error:", err);
    res.status(500).json({
      error: "Server error"
    });
  }

});

// 🔌 SOCKET.IO SETUP
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Store online users
const onlineUsers = new Map();
const conversationRooms = new Map();

io.on("connection", (socket) => {
  console.log("✅ New Socket.IO connection:", socket.id);

  // User comes online
  const userId = socket.handshake.auth.userId?.toLowerCase().trim();
  const userName = socket.handshake.auth.userName;
  const userAvatar = socket.handshake.auth.userAvatar;

  if (userId) {
    onlineUsers.set(userId, {
      socketId: socket.id,
      name: userName,
      avatar: userAvatar,
    });

    // Notify others that user is online
    socket.broadcast.emit("user_online", userId);
    console.log(`👤 ${userName} (${userId}) is now online`);
  }

  // Send message
  socket.on("send_message", async (data) => {
    try {
      const { conversationId, content, recipientId, timestamp, messageId } = data;
      const senderId = userId;
      const senderName = userName;
      const senderAvatar = userAvatar;

      // 🔥 CHECK IF BLOCKED - Query blocks table
      const { data: blockData, error: blockError } = await supabaseAdmin
        .from("blocks")
        .select("id")
        .eq("blocker_email", recipientId)
        .eq("blocked_email", senderId)
        .single();

      if (blockData) {
        console.log(`🚫 Cannot send message: ${recipientId} blocked ${senderId}`);
        socket.emit("message_blocked", { error: "User has blocked you" });
        return; // Don't send or save the message
      }

      // Save message to database with status "sent"
      const { error, data: insertedData } = await supabaseAdmin
        .from("messages")
        .insert([
          {
            conversation_id: conversationId,
            sender_id: senderId,
            sender_email: senderId,
            sender_name: senderName,
            sender_avatar: senderAvatar,
            receiver_email: recipientId,
            content: content,
            created_at: new Date(timestamp).toISOString(),
            status: "sent", // 🔥 Add delivery status
            read_at: null, // 🔥 Will be updated when recipient reads
          },
        ])
        .select();

      if (error) {
        console.error("❌ Error saving message:", error);
      }

      // Send message to recipient
      const normalizedRecipient = recipientId?.toLowerCase().trim();
      const recipient = onlineUsers.get(normalizedRecipient);
      if (recipient) {
        io.to(recipient.socketId).emit("receive_message", {
          id: messageId, // 🔥 ALWAYS SAME ID
          senderId,
          senderName,
          recipientId, 
          senderAvatar,
          content,
          timestamp: new Date(timestamp),
          conversationId,
          status: "sent", // 🔥 Mark as delivered to recipient
        });
        console.log(`💬 Message sent from ${senderName} to ${recipientId}`);
      } else {
        console.log(`⚠️ Recipient ${recipientId} is offline`);
      }
    } catch (err) {
      console.error("❌ Error handling message:", err);
      socket.emit("message_error", { error: "Failed to send message" });
    }
  });
       
  app.post("/block", async (req, res) => {
  const { blocker_email, blocked_email } = req.body;

  const { error } = await supabaseAdmin
    .from("blocks")
    .insert([{ blocker_email, blocked_email }]);

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});
  // Typing indicator
  socket.on("user_typing", (data) => {
    const { recipientId, isTyping } = data;
    const normalizedRecipient = recipientId?.toLowerCase().trim();
const recipient = onlineUsers.get(normalizedRecipient);

console.log("🎯 Looking for:", normalizedRecipient);
console.log("📡 Available users:", Array.from(onlineUsers.keys()));
    if (recipient) {
      io.to(recipient.socketId).emit("user_typing", {
        userId,
        isTyping,
      });
    }
  });

  // Delete message for everyone
 socket.on("delete_message_for_everyone", async (data) => {
    try {
      const { recipientId, messageId } = data;
      const senderId = userId;
      
      console.log(`🗑️ BACKEND: Received delete event - senderId: ${senderId}, recipientId: ${recipientId}, messageId: ${messageId}`);
      console.log(`🗑️ BACKEND: onlineUsers keys:`, Array.from(onlineUsers.keys()));
      
      // Emit delete event to both sender and recipient
      const deletePayload = { messageId };
      
      // Send confirmation to sender
      socket.emit("message_deleted_for_everyone", deletePayload);
      console.log(`✅ BACKEND: Delete confirmation sent to sender ${senderId}`);
      
      // Send delete event to recipient if online
      const recipient = onlineUsers.get(recipientId);
      if (recipient) {
        io.to(recipient.socketId).emit("message_deleted_for_everyone", deletePayload);
        console.log(`✅ BACKEND: Delete event forwarded to ${recipientId} on socket ${recipient.socketId}`);
      } else {
        console.log(`⚠️ BACKEND: Recipient ${recipientId} is offline`);
      }
      
      // Store delete action in database so offline users see it when they come online
      const { error } = await supabaseAdmin
        .from("message_deletes")
        .insert([
          {
            message_id: messageId,
            deleted_by: senderId,
            deleted_at: new Date().toISOString(),
          },
        ]);

      if (error) {
        console.error("❌ Error saving delete action:", error);
      } else {
        console.log(`✅ BACKEND: Delete action stored in database for messageId: ${messageId}`);
      }
    } catch (err) {
      console.error("❌ Error handling delete message:", err);
      socket.emit("delete_error", { error: "Failed to delete message" });
    }
  });

  // Mark messages as read
  socket.on("mark_messages_read", async (data) => {
    try {
      const { recipientId, messageIds, timestamp } = data;
      const readerId = userId;

      console.log(`👁️ BACKEND: Received read receipt - readerId: ${readerId}, messageIds:`, messageIds);

      // Update messages in database with read_at timestamp and status "read"
      const readTimestamp = new Date(timestamp).toISOString();
      const { error } = await supabaseAdmin
        .from("messages")
        .update({ 
          read_at: readTimestamp,
          status: "read" // 🔥 Update status to "read"
        })
        .in("id", messageIds);

      if (error) {
        console.error("❌ Error updating read status:", error);
      } else {
        console.log(`✅ BACKEND: Updated read status for ${messageIds.length} messages`);
      }

      // Send read receipt to sender with timestamp
      const normalizedRecipient = recipientId?.toLowerCase().trim();
      const recipient = onlineUsers.get(normalizedRecipient);
      console.log("[v0] BACKEND: Looking for recipient:", recipientId, "Normalized:", normalizedRecipient, "Found:", !!recipient);
      if (recipient) {
        io.to(recipient.socketId).emit("messages_read", {
          messageIds,
          readerId,
          timestamp: readTimestamp,
          status: "read",
        });
        console.log(`[v0] 📤 BACKEND: Read receipt sent to ${recipientId} with timestamp ${readTimestamp}`);
      } else {
        console.log(`[v0] ⚠️ BACKEND: Sender ${recipientId} is offline`);
      }
    } catch (err) {
      console.error("❌ Error handling read receipt:", err);
    }
  });

  // Block user event
  socket.on("block_user", async (data) => {
    try {
      const { recipientId } = data;
      const blockerUserId = userId;
      
      console.log(`🚫 ${blockerUserId} blocked ${recipientId}`);
      
      // 🔥 Save block to database
      const { error: blockError } = await supabaseAdmin
        .from("blocks")
        .insert([
          {
            blocker_email: blockerUserId,
            blocked_email: recipientId,
            created_at: new Date().toISOString(),
          }
        ]);

      if (blockError) {
        console.error("❌ Error saving block:", blockError);
      } else {
        console.log(`✅ Block saved to database: ${blockerUserId} blocked ${recipientId}`);
      }
      
      // Notify the blocked user
      const normalizedRecipient = recipientId?.toLowerCase().trim();
      const recipient = onlineUsers.get(normalizedRecipient);
      if (recipient) {
        io.to(recipient.socketId).emit("user_blocked", {
  blockerUserId,
  recipientId, // ✅ ADD THIS
});
        console.log(`📤 Block notification sent to ${recipientId}`);
      }
    } catch (err) {
      console.error("❌ Error handling block user:", err);
    }
  });
  app.post("/unblock", async (req, res) => {
  const { blocker_email, blocked_email } = req.body;

  const { error } = await supabaseAdmin
    .from("blocks")
    .delete()
    .eq("blocker_email", blocker_email)
    .eq("blocked_email", blocked_email);

  if (error) return res.status(500).json({ error });

  res.json({ success: true });
});

  // Unblock user event
  socket.on("unblock_user", async (data) => {
    try {
      const { recipientId } = data;
      const unblockerUserId = userId;
      
      console.log(`✅ ${unblockerUserId} unblocked ${recipientId}`);
      
      // 🔥 Delete block from database
      const { error: unblockError } = await supabaseAdmin
        .from("blocks")
        .delete()
        .eq("blocker_email", unblockerUserId)
        .eq("blocked_email", recipientId);

      if (unblockError) {
        console.error("❌ Error removing block:", unblockError);
      } else {
        console.log(`✅ Block removed from database: ${unblockerUserId} unblocked ${recipientId}`);
      }
      
      // Notify the unblocked user
      const normalizedRecipient = recipientId?.toLowerCase().trim();
      const recipient = onlineUsers.get(normalizedRecipient);
      if (recipient) {
        io.to(recipient.socketId).emit("user_unblocked", {
  blockerUserId: unblockerUserId,
  recipientId, // ✅ ADD THIS
});
        console.log(`📤 Unblock notification sent to ${recipientId}`);
      }
    } catch (err) {
      console.error("❌ Error handling unblock user:", err);
    }
  });

  // User disconnects
  socket.on("disconnect", () => {
    if (userId && onlineUsers.has(userId)) {
      onlineUsers.delete(userId);
      socket.broadcast.emit("user_offline", userId);
      console.log(`👋 ${userName} (${userId}) is now offline`);
    }
  });

  socket.on("error", (error) => {
    console.error("❌ Socket error:", error);
  });
});

// 🔥 GET BLOCKED USERS - Load blocks on initial page load
app.get("/get-blocked-users", async (req, res) => {
  try {
    const email = req.query.email;
    
    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    // Get all blocks where this user is the blocker
    const { data: blocksData, error: blocksError } = await supabaseAdmin
      .from("blocks")
      .select("blocker_email, blocked_email")
      .or(`blocker_email.eq.${email},blocked_email.eq.${email}`);

    if (blocksError) {
      console.error("❌ Error fetching blocks:", blocksError);
      return res.status(500).json({ error: "Failed to fetch blocks" });
    }

    // Structure the response:
    // blockedUsers[myEmail] = emails I blocked
    // blockedUsers[theirEmail] = emails they blocked (includes me)
    const blockedUsers = {};

    (blocksData || []).forEach((block) => {
      // If I'm the blocker
      if (block.blocker_email === email) {
        if (!blockedUsers[email]) blockedUsers[email] = [];
        blockedUsers[email].push(block.blocked_email);
      }
      // If I'm blocked by someone
      if (block.blocked_email === email) {
        if (!blockedUsers[block.blocker_email]) blockedUsers[block.blocker_email] = [];
        blockedUsers[block.blocker_email].push(email);
      }
    });

    console.log(`✅ Loaded blocked users for ${email}:`, blockedUsers);
    res.json({ blockedUsers });
  } catch (err) {
    console.error("❌ Error in get-blocked-users:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔥 ACCEPT FRIEND REQUEST & ADD TO user_references
app.post("/accept-friend-request", async (req, res) => {
  try {
    const { requestId, senderEmail, receiverEmail } = req.body;

    if (!requestId || !senderEmail || !receiverEmail) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    console.log(`🤝 Accepting friend request: ${senderEmail} <-> ${receiverEmail}`);

    // Update request status
    const { error: updateError } = await supabaseAdmin
      .from("friend_requests")
      .update({ status: "accepted" })
      .eq("id", requestId);

    if (updateError) {
      console.error("❌ Error updating request:", updateError);
      return res.status(500).json({ error: "Failed to update request" });
    }

    // INSERT BOTH DIRECTIONS IN user_references
    const { error: insertError } = await supabaseAdmin
      .from("user_references")
      .insert([
        {
          user_id: senderEmail,
          referred_user_id: receiverEmail,
          relationship: "friend",
          created_at: new Date().toISOString(),
        },
        {
          user_id: receiverEmail,
          referred_user_id: senderEmail,
          relationship: "friend",
          created_at: new Date().toISOString(),
        },
      ]);

    if (insertError) {
      console.error("❌ Error inserting references:", insertError);
      return res.status(500).json({ error: "Failed to add friend reference" });
    }

    console.log(`✅ Friend reference added for both users`);
    res.json({ success: true, message: "Friend request accepted and references added" });
  } catch (err) {
    console.error("❌ Error in accept-friend-request:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔥 GET BLOCKED USERS - Load blocks on initial page load
app.get("/get-blocked-users", async (req, res) => {
  try {
    const email = req.query.email;
    
    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    // Get all blocks where this user is the blocker or blocked
    const { data: blocksData, error: blocksError } = await supabaseAdmin
      .from("blocks")
      .select("blocker_email, blocked_email");

    if (blocksError) {
      console.error("❌ Error fetching blocks:", blocksError);
      return res.status(500).json({ error: "Failed to fetch blocks" });
    }

    // Structure the response:
    // blockedUsers[myEmail] = emails I blocked
    // blockedUsers[theirEmail] = emails they blocked (includes me)
    const blockedUsers = {};

    (blocksData || []).forEach((block) => {
      // If I'm the blocker
      if (block.blocker_email === email) {
        if (!blockedUsers[email]) blockedUsers[email] = [];
        blockedUsers[email].push(block.blocked_email);
      }
      // If I'm blocked by someone
      if (block.blocked_email === email) {
        if (!blockedUsers[block.blocker_email]) blockedUsers[block.blocker_email] = [];
        blockedUsers[block.blocker_email].push(email);
      }
    });

    console.log(`✅ Loaded blocked users for ${email}:`, blockedUsers);
    res.json({ blockedUsers });
  } catch (err) {
    console.error("❌ Error in get-blocked-users:", err);
    res.status(500).json({ error: "Server error" });
  }
});

httpServer.listen(5000, () => {
  console.log("🚀 Server running on port 5000 with Socket.IO support");
});

