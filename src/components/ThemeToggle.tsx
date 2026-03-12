import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

export const ThemeToggle = () => {

  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-4 right-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700"
    >
      {theme === "light" ? <Moon size={20}/> : <Sun size={20}/>}
    </button>
  );
};