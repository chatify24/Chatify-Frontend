import { useEffect, useState, useRef } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { writeTextFile, readTextFile, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";

type State = "checking" | "available" | "updating" | "installing";

interface Props {
  onDone: () => void;
}

const SplashScreen = ({ onDone }: Props) => {
  const [state, setState] = useState<State | null>(null);
  const [newVersion, setNewVersion] = useState("");
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      const currentVersion = await getVersion();

      try {
        await mkdir("", { baseDir: BaseDirectory.AppData, recursive: true });
      } catch {}

      let lastVersion = "";
      let isJustUpdated = false;
      try {
        lastVersion = await readTextFile("last_version.txt", {
          baseDir: BaseDirectory.AppData,
        });
      } catch {}

      // Agar version change hua hai (update complete) toh immediately close kar do splash
      if (lastVersion && lastVersion !== currentVersion) {
        isJustUpdated = true;
        try {
          await writeTextFile("last_version.txt", currentVersion, {
            baseDir: BaseDirectory.AppData,
          });
        } catch (e) {
          console.error("Write failed:", e);
        }
        onDone();
        return;
      }

      // Version record kar do
      try {
        await writeTextFile("last_version.txt", currentVersion, {
          baseDir: BaseDirectory.AppData,
        });
      } catch (e) {
        console.error("Write failed:", e);
      }

      setState("checking");

      const isDev = import.meta.env.DEV;
      const [update] = await Promise.all([
        isDev ? Promise.resolve(null) : check(),
        new Promise((res) => setTimeout(res, 2500)),
      ]);

      if (update?.available) {
        setNewVersion(update.version);
        setState("available");
      } else {
        onDone();
      }
    } catch (e) {
      console.error("Update check failed:", e);
      onDone();
    }
  };

  const startUpdate = async () => {
    try {
      setState("updating");
      const update = await check();
      if (!update?.available) {
        onDone();
        return;
      }

      // Download aur install kar
      setState("installing");
      await update.downloadAndInstall();

      // Installer complete after download, ab relaunch karo
      // Tauri automatically handles NSIS and restart
      await relaunch();
    } catch (e) {
      console.error("Update error:", e);
      setState(null);
      onDone();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen w-screen bg-background">

      {(state === "checking" || state === "updating" || state === "installing") && (
        <div className="h-8 w-8 border-4 border-muted border-t-primary rounded-full animate-spin mb-3"></div>
      )}

      {state === "checking" && (
        <p className="text-sm text-muted-foreground m-0">
          Checking for updates...
        </p>
      )}

      {state === "available" && (
        <div className="flex flex-col items-center text-center gap-3">
          <p className="text-base text-muted-foreground m-0">
            Updates available — v{newVersion}
          </p>
          <button
            onClick={startUpdate}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-xl text-base font-semibold cursor-pointer border-none hover:opacity-75 transition-all duration-300"
          >
            Update Now
          </button>
        </div>
      )}

      {state === "updating" && (
        <p className="text-sm text-muted-foreground m-0">
          Downloading update...
        </p>
      )}

      {state === "installing" && (
        <p className="text-sm text-muted-foreground m-0">
          Installing... App will restart automatically
        </p>
      )}

    </div>
  );
};

export default SplashScreen;
