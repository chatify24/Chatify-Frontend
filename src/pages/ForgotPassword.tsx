import { useState ,useEffect} from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "../supabaseClient";

const ForgotPassword = () => {
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOtpPopup, setShowOtpPopup] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
const [canResend, setCanResend] = useState(false);
const [showResetPopup, setShowResetPopup] = useState(false);
const [confirmPassword, setConfirmPassword] = useState("");
const [showPassword, setShowPassword] = useState(false);
const [resetLoading, setResetLoading] = useState(false);
const [otp, setOtp] = useState("");
const [newPassword, setNewPassword] = useState("");
const [verifying, setVerifying] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
useEffect(() => {

  if (!showOtpPopup) return;

  if (resendTimer === 0) {
    setCanResend(true);
    return;
  }

  const timer = setTimeout(() => {
    setResendTimer(resendTimer - 1);
  }, 1000);

  return () => clearTimeout(timer);

}, [resendTimer, showOtpPopup]);

const handleReset = async (e) => {
  e.preventDefault();

  if (loading) return;

  if (!email) {
    toast({ title: "Please enter your email", variant: "destructive" });
    return;
  }

  setLoading(true);

  const { data: accountData, error: accountError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (accountError) {
    toast({ title: "Unable to verify account", variant: "destructive" });
    setLoading(false);
    return;
  }

  if (!accountData) {
    toast({
      title: "Account not found",
      description: "Please sign up first",
      variant: "destructive",
    });
    setLoading(false);
    return;
  }

  setTimeout(async () => {

    try {
      const res = await fetch("http://localhost:5000/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "OTP Sent",
          description: "Check your email for the verification code."
        });

        setShowOtpPopup(true);
      } else {
        toast({
          title: data.error || "Failed to send OTP",
          variant: "destructive"
        });
      }

    } catch (error) {
      toast({
        title: "Server error",
        variant: "destructive"
      });
    }

    setLoading(false);

  }, 3000);
};
const resendOtp = async () => {

  if (!canResend) return;

  // UI instantly update karo
  setResendTimer(30);
  setCanResend(false);

  try {

    const res = await fetch("http://localhost:5000/resend-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (data.success) {

      toast({
        title: "OTP Resent"
      });

    } else {

      toast({
        title: data.error,
        variant: "destructive"
      });

    }

  } catch {

    toast({
      title: "Server error",
      variant: "destructive"
    });

  }

};
const verifyOtp = () => {

  if (verifying) return;

  if (!otp) {
    toast({
      title: "Please enter OTP",
      variant: "destructive"
    });
    return;
  }

  setVerifying(true);

  setTimeout(async () => {

    try {
      const res = await fetch("http://localhost:5000/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, otp })
      });

      const data = await res.json();

      if (data.success) {

        toast({
          title: "OTP Verified"
        });

        setShowOtpPopup(false);
        setShowResetPopup(true);

      } else {

        toast({
          title: data.error,
          variant: "destructive"
        });

      }

    } catch (error) {

      toast({
        title: "Server error",
        variant: "destructive"
      });

    }

    setVerifying(false);

  }, 3000); // 3 sec delay
};
const resetPassword = () => {

  if (!newPassword || !confirmPassword) {
    toast({
      title: "Please fill all fields",
      variant: "destructive"
    });
    return;
  }

  if (newPassword !== confirmPassword) {
    toast({
      title: "Passwords do not match",
      variant: "destructive"
    });
    return;
  }

  setResetLoading(true);

  setTimeout(async () => {

    try {

      const res = await fetch("http://localhost:5000/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password: newPassword
        })
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: "Password reset successful"
        });

        setShowResetPopup(false);

        navigate("/", { replace: true });

      } else {

        toast({
          title: data.error || "Reset failed",
          variant: "destructive"
        });

      }

    } catch (err) {

      toast({
        title: "Server error",
        variant: "destructive"
      });

    }

    setResetLoading(false);

  }, 3000);

};
  return (
  <>
    <div className="flex min-h-screen justify-center bg-muted/30 px-4 py-2">
      <div className="w-full max-w-md space-y-6 mt-10">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <MessageCircle className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Chatify</h1>
        </div>

        {/* Card */}
        <div className="rounded-2xl border bg-card p-8 shadow-sm">

          <h2 className="text-xl font-semibold mb-2">
            Reset Password
          </h2>

          <p className="text-sm text-muted-foreground mb-6">
            Enter your email and we'll send you a password reset link.
          </p>

          <form onSubmit={handleReset} className="space-y-4">

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

            <Button
              type="submit"
              className={`h-12 w-full rounded-xl text-base font-semibold flex items-center justify-center gap-2
              ${loading ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
            >
              {loading && (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}

              {loading ? "Processing..." : "Send Reset Link"}
            </Button>

            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="text-sm text-primary hover:underline w-full text-center"
            >
              Back to Sign In
            </button>

          </form>
        </div>
      </div>
    </div>

    {/* OTP POPUP */}
    {showOtpPopup && (
      <div className="fixed inset-0 flex items-center justify-center bg-black/75">
        <div className="bg-card p-6 rounded-xl w-80 space-y-4">
          <h2 className="text-lg font-semibold text-center">
            Verify OTP
          </h2>

        <Input
  type="text"
  placeholder="Enter OTP"
  value={otp}
  maxLength={6}
  onChange={(e) => {
    const value = e.target.value.replace(/\D/g, ""); // only numbers
    if (value.length <= 6) {
      setOtp(value);
    }
  }}
/>
          <div className="text-center text-sm">

  {canResend ? (
    <button
      onClick={resendOtp}
      className="text-primary hover:underline"
    >
      Resend OTP
    </button>
  ) : (
    <span className="text-muted-foreground">
      Resend OTP in {resendTimer}s
    </span>
  )}

</div>
          <Button
            onClick={verifyOtp}
            className={`w-full flex items-center justify-center gap-2
            ${verifying ? "opacity-70 cursor-not-allowed" : ""}`}
          >

            {verifying && (
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}

            {verifying ? "Verifying..." : "Verify OTP"}

          </Button>

        </div>
      </div>
    )}

    {/* RESET PASSWORD POPUP */}
{showResetPopup && (
  <div className="fixed inset-0 flex items-center justify-center bg-black/75">
    <div className="bg-card p-6 rounded-xl w-80 space-y-4">

      <h2 className="text-lg font-semibold text-center">
        Reset Password
      </h2>

      {/* New Password */}
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <span
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-3 cursor-pointer"
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </span>
      </div>

      {/* Confirm Password */}
      <div className="relative">
        <Input
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <span
          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          className="absolute right-3 top-3 cursor-pointer"
        >
          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </span>
      </div>

      <Button
        onClick={resetPassword}
        className={`w-full flex items-center justify-center gap-2
        ${resetLoading ? "opacity-70 cursor-not-allowed" : ""}`}
      >

        {resetLoading && (
          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        )}

        {resetLoading ? "Resetting..." : "Reset Password"}

      </Button>

    </div>
  </div>
)}

  </>
);
};

export default ForgotPassword;