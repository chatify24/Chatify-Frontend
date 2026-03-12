import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || "");
  const [loading, setLoading] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || "");

  const inputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const imageUrl = URL.createObjectURL(file);
    setSelectedAvatar(imageUrl);
  };

const handleContinue = () => {
  if (loading) return;

  if (!name.trim()) {
    toast({ title: "Please enter your name", variant: "destructive" });
    return;
  }

  setLoading(true);

  setTimeout(() => {
    updateProfile({
      name: name.trim(),
      avatar: selectedAvatar || "",
    });
    setName(""); // 👈 input clear
    navigate("/chat", { replace: true });
    setLoading(false);
  }, 3000);
};

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">

        <div className="text-center">
          <h1 className="text-2xl font-bold">Set Up Your Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a photo and display name
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-sm">

          {/* Avatar Preview */}
          <div className="mb-6 flex flex-col items-center gap-4">

            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-primary/20 bg-muted">

                {selectedAvatar ? (
                  <img
                    src={selectedAvatar}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-12 w-12 text-muted-foreground" />
                )}

              </div>

              {/* Cross delete button */}
              {selectedAvatar && (
                <button
                  onClick={() => setSelectedAvatar("")}
                  className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black text-white hover:bg-black/80"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />

            {/* Choose Photo Button */}
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => inputRef.current.click()}
            >
              {selectedAvatar ? "Change Photo" : "Choose Photo"}
            </Button>

          </div>

          {/* Name Input */}
          <div className="mb-6 space-y-2">
            <label className="text-sm font-medium">Display Name</label>

            <Input
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 rounded-xl"
            />
          </div>

          <Button
  onClick={handleContinue}
  className={`h-12 w-full rounded-xl text-base font-semibold flex items-center justify-center gap-2
  ${loading ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
>
  {loading && (
    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
  )}

  {loading ? "Processing..." : "Continue to Chat"}
</Button>
<button
  type="button"
  onClick={() => {
    logout();
    navigate("/", { replace: true });
  }}
  className="mt-4 text-sm text-primary hover:underline w-full text-center"
>
  Back to Sign In
</button>

        </div>
      </div>
    </div>
  );
};

export default Profile;