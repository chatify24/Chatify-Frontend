import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import cloudinary from "cloudinary";
import multer from "multer";
dotenv.config();
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});
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
src="https://res.cloudinary.com/dpaiyfwdu/image/upload/v1773241177/chattix_bdffhv.png"
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
app.post("/reset-password", (req, res) => {

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password required"
    });
  }

  // Abhi DB nahi hai, to sirf success return karenge
  console.log("Password reset request for:", email);

  res.json({
    success: true
  });

});
app.listen(5000, () => {
  console.log("Server running on port 5000");
});