import { openUrl } from '@tauri-apps/plugin-opener';

const UpdateBanner = ({
  updateInfo,
}: {
  updateInfo: { available: boolean; newVersion: string; apkUrl: string };
  onDismiss?: () => void; // 🔥 ab use nahi hota — force update hai, dismiss allowed nahi
}) => {
  if (!updateInfo?.available) return null;

  const handleUpdateClick = async () => {
    try {
      await openUrl(updateInfo.apkUrl);
    } catch (err) {
      console.error("Failed to open update link:", err);
      window.open(updateInfo.apkUrl, "_blank");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      // 🔥 backdrop pe koi onClick nahi diya — bahar click karne se kuch nahi hoga
    >
      <div
        className="w-[90vw] max-w-sm rounded-2xl bg-card p-6 shadow-2xl border border-border flex flex-col items-center text-center gap-4"
        onClick={(e) => e.stopPropagation()} // 🔥 andar click se backdrop tak event bubble na ho
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>

        <div>
          <h2 className="text-lg font-bold">Updates Available</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A new version ({updateInfo.newVersion}) is available. Please update to continue using the app.
          </p>
        </div>

        <button
          onClick={handleUpdateClick}
          className="w-full h-12 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors"
        >
          Update Now
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;