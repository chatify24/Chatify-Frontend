import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [confirmPassword, setConfirmPassword] = useState("");
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

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!email || !password) {
    toast({ title: "Please fill all fields", variant: "destructive" });
    return;
  }

  setLoading(true);

  setTimeout(() => {
    if (isLogin) {
const stored = localStorage.getItem("chat_accounts");
const accounts = stored ? JSON.parse(stored) : {};

if (!accounts[email]) {
  toast({
    title: "Account not found. Please sign up.",
    variant: "destructive"
  });
  setLoading(false);
  return;
}

if (accounts[email].password !== password) {
  toast({
    title: "Incorrect password",
    variant: "destructive"
  });
  setLoading(false);
  return;
}

login(email, password);
navigate("/profile", { replace: true });
    } else {
      if (password !== confirmPassword) {
        toast({ title: "Passwords do not match", variant: "destructive" });
        setLoading(false);
        return;
      }

      const success = signup(email, password);

if (success) {
  toast({
    title: "Account created successfully",
    description: "Please sign in to continue"
  });

 setIsLogin(true); // Sign In tab switch
  navigate("/", { replace: true }); // history replace

  setPassword("");
  setConfirmPassword("");
}
else {
  toast({
    title: "Account already exists. Please sign in.",
    variant: "destructive"
  });
}
    }

    setLoading(false);
  }, 3000);
};

  return (
<div className="flex min-h-screen justify-center bg-muted/30 px-4 py-2 overflow-y-auto">
  <div className="w-full max-w-md space-y-6 mt-0">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <MessageCircle className="h-8 w-8 text-primary-foreground" />
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
      onChange={(e) => setEmail(e.target.value)}
      className="h-12 rounded-xl"
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
        className="h-12 rounded-xl pr-12"
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
          className="h-12 rounded-xl pr-12"
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
  className={`h-12 w-full rounded-xl text-base font-semibold flex items-center justify-center gap-2
  hover:opacity-90
  ${loading ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
>
  {loading && (
    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
  )}

  {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
</Button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
            <Button
variant="outline"
className="h-14 rounded-xl font-semibold text-lg w-full border border-gray-300 
transition flex items-center justify-center gap-2 
text-gray-800 dark:text-white
hover:bg-black hover:text-white
dark:hover:bg-orange-100 dark:hover:text-gray-800"
onClick={() => {
  const mode = isLogin ? "login" : "signup";
  window.location.href = `http://localhost:5000/auth/google?mode=${mode}`;
}}
>
              <svg className="mr-0 !h-7 !w-8" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Google
            </Button>
            
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
