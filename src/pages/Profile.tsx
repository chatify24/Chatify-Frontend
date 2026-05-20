import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "../supabaseClient";

const getInitials = (name?: string) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const Profile = () => {
  const { user, isAuthenticated, isLoading, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || "");
  const [loading, setLoading] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || "");
  const [uploading, setUploading] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch("http://localhost:5000/upload-profile", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setSelectedAvatar(data.imageUrl);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({ title: "Failed to upload image", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleContinue = async () => {
    if (!name.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }

    setLoading(true);

    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;

    if (!userId) {
      toast({ title: "User not found", variant: "destructive" });
      setLoading(false);
      return;
    }

    const delay = new Promise(res => setTimeout(res, 2500));

    const dbProcess = supabase.from("profiles").upsert([
      {
        id: userId,
        email: data.user.email,
        name: name.trim(),
        avatar: selectedAvatar || "",
      },
    ]);

    await Promise.all([delay, dbProcess]);

    await updateProfile({
      name: name.trim(),
      avatar: selectedAvatar || "",
    });

    navigate("/chat", { replace: true });
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-8">

        {/* Loading state */}
        {isLoading && (
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
          </div>
        )}

        {!isLoading && (
          <>
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
                  <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-orange-500/20 bg-muted flex items-center justify-center">
                    {selectedAvatar ? (
                      <img src={selectedAvatar} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-3xl font-bold text-muted-foreground">
                        {getInitials(name) || "?"}
                      </div>
                    )}
                  </div>

                  {selectedAvatar && (
                    <button
                      onClick={() => setSelectedAvatar("")}
                      className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />

              <button
  type="button"
  onClick={() => !uploading && inputRef.current?.click()}
  className={`text-sm font-medium transition-colors ${
    uploading 
      ? "text-orange-500" 
      : "text-orange-500 hover:text-orange-600"
  }`}
>
  {uploading ? "Uploading..." : selectedAvatar ? "Change Profile Photo" : "Add Profile Photo"}
</button>
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
                style={loading ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                className="h-12 w-full rounded-xl text-base font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                Continue
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
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;