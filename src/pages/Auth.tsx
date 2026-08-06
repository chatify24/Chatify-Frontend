import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "../supabaseClient";
import { generateUID } from "@/utils/uid";
const Auth = () => {
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updateAvailable, setUpdateAvailable] = useState(false);
const [apkUrl, setApkUrl] = useState('');
const CURRENT_VERSION = '1.2.2';
  const [loading, setLoading] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  useEffect(() => {
  setEmail("");
  setPassword("");
  setConfirmPassword("");
}, [isLogin]);
useEffect(() => {
  const checkUpdate = async () => {
    try {
      const isAndroid = navigator.userAgent.toLowerCase().includes('android');
      if (!isAndroid) return;
      const res = await fetch('https://chatify-backend-mrlh.onrender.com/app-version');
      const data = await res.json();
      if (data.version !== CURRENT_VERSION) {
        setUpdateAvailable(true);
        setApkUrl(data.apk_url);
      }
    } catch (err) {
      console.log('Update check failed');
    }
  };
  checkUpdate();
}, []);
useEffect(() => {
  const checkUpdate = async () => {
    try {
      const res = await fetch('https://chatify-backend-mrlh.onrender.com/app-version');
      const data = await res.json();
      if (data.version !== CURRENT_VERSION) {
        setUpdateAvailable(true);
        setApkUrl(data.apk_url);
      }
    } catch (err) {
      console.log('Update check failed');
    }
  };
  checkUpdate();
}, []);



const commonTLDs = [
  "com", "net", "org", "edu", "gov", "co", "in", "io", "info",
  "biz", "me", "app", "dev", "xyz", "us", "uk", "ca", "au",
  "co.in", "edu.in", "gov.in", "ac.in", "org.in"
];

const validateEmailFormat = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z.]{2,}$/;
  if (!emailRegex.test(email)) return false;

  const domainPart = email.split("@")[1] || "";
  const tld = domainPart.split(".").slice(1).join(".").toLowerCase();

  return commonTLDs.includes(tld);
};

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!email || !password) {
    toast({ title: "Please fill all fields", variant: "destructive" });
    return;
  }
  const normalizedEmail = email.toLowerCase().trim();

  if (!validateEmailFormat(normalizedEmail)) {
    toast({ title: "Invalid email format", description: "Please enter a valid email", variant: "destructive" });
    setLoading(false);
    return;
  }

  setLoading(true);

  const delay = new Promise(res => setTimeout(res, 1500));

  // 🔐 LOGIN
  if (isLogin) {
    const [res] = await Promise.all([login(email, password), delay]);

    if (typeof res === "string") {
      let description = "";

      if (res.toLowerCase().includes("not")) {
        description = "Please sign up first";
      } else if (res.toLowerCase().includes("exist")) {
        description = "Please sign in";
      }

      toast({
        title: res,
        description,
        variant: "destructive",
      });

      setLoading(false);
      return;
    }

    toast({ title: "Login successful" });
    navigate(res.profileComplete ? "/chat" : "/profile");
    setLoading(false);
    return;
  }

  // 📝 SIGNUP
  else {
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      setLoading(false);
      return;
    }

    const [res] = await Promise.all([signup(normalizedEmail, password), delay]);

    if (typeof res === "string") {
      let description = "";

      if (res.toLowerCase().includes("exist")) {
        description = "Please sign in";
      } else if (res.toLowerCase().includes("not")) {
        description = "Please sign up first";
      }

      toast({
        title: res,
        description,
        variant: "destructive",
      });

      setLoading(false);
      return;
    }

    const loginResult = await login(normalizedEmail, password);

    if (typeof loginResult === "string") {
      toast({
        title: "Login failed after signup",
        description: loginResult,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    toast({
      title: "Account created",
    });

    navigate(loginResult.profileComplete ? "/chat" : "/profile");
    setLoading(false);
  }
};


  return (
<div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-19 overflow-y-auto">

  <div className="w-full max-w-md space-y-6 mt-0">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
<MessageCircle className="h-7 w-7 text-primary-foreground -translate-y-0.5" strokeWidth={1.4} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Chatify</h1>
         
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          {/* Tabs */}
          <div className="mb-6 flex rounded-xl bg-muted p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                isLogin ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                !isLogin ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>
          

<form
  key={isLogin ? "login" : "signup"}
  onSubmit={handleSubmit}
  className="space-y-4"
>

  {/* Email */}
  <div className="space-y-2">
    <label className="text-sm font-medium">Email</label>
 <Input
  type="email"
  placeholder="Enter your email"
  value={email}
  onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
  className="h-12 rounded-xl"
  autoComplete="email"
  autoCapitalize="none"
  autoCorrect="off"
  spellCheck={false}
/>
  </div>

  {/* Password */}
  <div className="space-y-2">
    <label className="text-sm font-medium">Password</label>

    <div className="relative">
  <Input
  type={showPassword ? "text" : "password"}
  placeholder="Enter your password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  className="h-12 rounded-xl pr-12 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
/>

      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  </div>

  {/* Confirm Password */}
  {!isLogin && (
    <div className="space-y-2">
      <label className="text-sm font-medium">Confirm Password</label>

      <div className="relative">
<Input
  type={showConfirmPassword ? "text" : "password"}
  placeholder="Confirm your password"
  value={confirmPassword}
  onChange={(e) => setConfirmPassword(e.target.value)}
  className="h-12 rounded-xl pr-12 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden"
/>

        <button
          type="button"
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  )}

  {isLogin && (
    <button
  type="button"
  onClick={() => navigate("/forgot-password")}
  className="text-sm font-medium text-primary hover:underline"
>
  Forgot password?
</button>
  )}



<Button
  type="submit"
  style={loading ? { opacity: 0.4, cursor: "not-allowed" } : {}}
  className="h-12 w-full rounded-xl text-base font-semibold flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer"
>
  {isLogin ? "Sign In" : "Create Account"}
</Button>
<div className="mt-3 text-center">
  
</div>
          </form>

                 </div>
      </div>
    </div>
  );
};

export default Auth;
