const UpdateBanner = ({
  updateInfo,
  onDismiss,
}: {
  updateInfo: { available: boolean; newVersion: string; apkUrl: string };
  onDismiss: () => void;
}) => {
  if (!updateInfo?.available) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white px-4 py-3 flex items-center justify-between">
      <span className="text-sm font-medium">
        New version {updateInfo.newVersion} available!
      </span>
      <div className="flex gap-2">
        <button
          onClick={() => window.open(updateInfo.apkUrl, "_blank")}
          className="bg-white text-orange-600 px-3 py-1 rounded-lg text-sm font-semibold"
        >
          Update Now
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;