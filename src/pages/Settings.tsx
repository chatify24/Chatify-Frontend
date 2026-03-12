import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/lib/theme-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Trash2, LogOut } from "lucide-react";
import {
AlertDialog,
AlertDialogAction,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
AlertDialogTrigger
} from "@/components/ui/alert-dialog";

const Settings = () => {
  const { user, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || "");
  const [notifications, setNotifications] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleSave = () => {
    updateProfile({ name });
    navigate("/chat", { replace: true });
  };

  const clearChats = () => {
    localStorage.removeItem("chat_messages");
    alert("All chats cleared");
  };

const handleLogout = () => {

setLogoutLoading(true);

setTimeout(() => {

logout();
setDialogOpen(false);
navigate("/");

},2500);

};

  return (
    <div className="flex min-h-screen justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chat")}>
            <ArrowLeft />
          </Button>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>

        {/* Profile */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold">Profile</h2>

          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback>
                {user?.name?.charAt(0)}
              </AvatarFallback>
            </Avatar>

            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <Button onClick={handleSave} className="w-full">
            Save Changes
          </Button>
        </div>

        {/* Preferences */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold">Preferences</h2>

          <div className="flex items-center justify-between">
            <span>Notifications</span>
            <Switch
              checked={notifications}
              onCheckedChange={setNotifications}
            />
          </div>

          <div className="flex items-center justify-between">
            <span>Dark Mode</span>
            <Switch
  checked={theme === "dark"}
  onCheckedChange={toggleTheme}
/>
          </div>
        </div>

        {/* Danger zone */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-red-500">Danger Zone</h2>

          <Button
            variant="destructive"
            className="w-full flex gap-2"
            onClick={clearChats}
          >
            <Trash2 size={16} />
            Clear All Chats
          </Button>

         <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>

<AlertDialogTrigger asChild>
<Button
variant="outline"
className="w-full flex gap-2"
>
<LogOut size={16} />
Logout
</Button>
</AlertDialogTrigger>

<AlertDialogContent className="data-[state=open]:duration-500 data-[state=closed]:duration-500">

<AlertDialogHeader>
<AlertDialogTitle>
Confirm Logout
</AlertDialogTitle>

<AlertDialogDescription>
Are you sure you want to logout from Chatify?
</AlertDialogDescription>
</AlertDialogHeader>

<AlertDialogFooter>

<AlertDialogCancel
className="hover:bg-red-500 hover:text-white transition-colors"
>
Cancel
</AlertDialogCancel>

<AlertDialogAction
onClick={(e) => {
e.preventDefault();

if (!logoutLoading) {
handleLogout();
}
}}
className={`flex items-center gap-2 ${
logoutLoading
? "cursor-not-allowed opacity-70"
: ""
}`}
>

{logoutLoading && (
<div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
)}

Confirm

</AlertDialogAction>

</AlertDialogFooter>

</AlertDialogContent>

</AlertDialog>
        </div>

      </div>
    </div>
  );
};

export default Settings;