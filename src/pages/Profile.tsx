import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const avatarOptions = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1544725176-7c40e128e81b?w=100&h=100&fit=crop&crop=face",
];

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState(user?.name || "");
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || "");

  const handleContinue = () => {
    if (!name.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!selectedAvatar) {
      toast({ title: "Please select a profile picture", variant: "destructive" });
      return;
    }
    updateProfile({ name: name.trim(), avatar: selectedAvatar });
    navigate("/chat");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Set Up Your Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">Choose a photo and display name</p>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          {/* Selected Avatar Preview */}
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-primary/20 bg-muted">
                {selectedAvatar ? (
                  <img src={selectedAvatar} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                <Camera className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Avatar Options */}
          <div className="mb-6">
            <label className="mb-3 block text-sm font-medium">Choose your avatar</label>
            <div className="grid grid-cols-6 gap-3">
              {avatarOptions.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedAvatar(url)}
                  className={`h-12 w-12 overflow-hidden rounded-full border-2 transition-all ${
                    selectedAvatar === url
                      ? "border-primary ring-2 ring-primary/30 scale-110"
                      : "border-transparent hover:border-primary/40"
                  }`}
                >
                  <img src={url} alt={`Avatar ${i + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
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

          <Button onClick={handleContinue} className="h-12 w-full rounded-xl text-base font-semibold">
            Continue to Chat
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
