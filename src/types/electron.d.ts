export {};

declare global {
  interface Window {
    electronAPI: {
      onStatus: (callback: (status: string) => void) => void;
      onProgress: (callback: (progress: number) => void) => void;
      installUpdate: () => void;
    };
  }
}