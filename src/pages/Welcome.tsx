'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, CheckCircle2, Download, Zap, Lock, Clock } from 'lucide-react';

export default function Welcome() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [step, setStep] = useState<'confirm' | 'downloading' | 'ready'>('confirm');
  const [isDownloading, setIsDownloading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [downloadType, setDownloadType] = useState<'windows' | 'android'>('windows');

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleInstallClick = () => {
    setStep('confirm');
    setShowPopup(true);
  };

 const startDownload = () => {
  setIsDownloading(true);

  // 3 sec delay (fake loading feel)
  setTimeout(() => {
    // Real download trigger
    const link = document.createElement('a');
    link.href = 'https://github.com/chatify24/Chatify/releases/download/v1.3.6/Chatify_1.3.6_x64-setup.exe';
    link.download = 'Chatify.exe';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Popup band
    setShowPopup(false);

    // Spinner off
    setIsDownloading(false);
  }, 5000);
};
  const startAndroidDownload = () => {
  setIsDownloading(true);
  setTimeout(() => {
    const link = document.createElement('a');
    link.href = 'https://github.com/chatify24/chatify_android/releases/download/v1.3.6/Chatify.apk';
    link.download = 'Chatify.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowPopup(false);
    setIsDownloading(false);
  }, 5000);
};

  const handleFinalInstall = async () => {
    setShowPopup(false);
    // Simulate app launch
    setTimeout(() => {
      window.location.href = '/auth';
    }, 300);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-background to-orange-100 overflow-x-hidden relative">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-20">
        <div className="w-full max-w-2xl">
          {/* Header Section */}
          <div className="mb-12 text-center animate-fade-in">
            <div className="inline-flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-3xl blur-2xl opacity-30 animate-pulse"></div>
<div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg">
  <MessageCircle className="h-10 w-10 text-primary-foreground -translate-y-0.5" strokeWidth={1.4} />
</div>
            </div>
            <h1 className="text-5xl md:text-6xl font-semibold mb-4 text-foreground">
  Chatify
</h1>
            <p className="text-xl text-muted-foreground mb-2 font-medium">
              Lightning-fast messaging. Secure. Real-time.
            </p>
            <p className="text-sm text-muted-foreground/80 max-w-md mx-auto">
              Join millions chatting on the fastest messaging platform. Download now and stay connected.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 animate-fade-in animation-delay-200">
            {[
              { icon: Zap, title: 'Lightning Fast', desc: 'Instant message delivery' },
              { icon: Lock, title: 'End-to-End Encrypted', desc: 'Your privacy matters' },
              { icon: Clock, title: 'Always Available', desc: '24/7 reliability' }
            ].map((feature, i) => (
              <div key={i} className="group relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-card/40 backdrop-blur-sm p-5 hover:border-primary/40 hover:bg-card/60 transition-all duration-300 shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-primary/10 transition-all duration-300"></div>
                <div className="relative">
                  <feature.icon className="h-6 w-6 text-primary mb-3 group-hover:scale-110 transition-transform" />
                  <h3 className="font-semibold text-sm text-foreground mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Main CTA Card */}
          <div className="relative animate-fade-in animation-delay-300">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-xl opacity-50"></div>
            <div className="relative rounded-3xl border border-primary/30 bg-white/95 backdrop-blur-xl p-10 shadow-2xl">
              <div className="text-center space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-foreground mb-2">Ready to join?</h2>
                  <p className="text-muted-foreground">Download Chatify and start chatting instantly</p>
                </div>

             
                 <button
  onClick={() => { setDownloadType('windows'); handleInstallClick(); }}
className="w-full px-8 py-4 rounded-xl bg-primary text-white font-semibold text-lg transition-all duration-300 hover:opacity-85 active:scale-95"
>
  <div className="flex items-center justify-center gap-2">
    <Download className="h-5 w-5" />
    Download for Windows
  </div>
</button>
<button
  onClick={() => { setDownloadType('android'); handleInstallClick(); }}
  className="w-full px-8 py-4 rounded-xl bg-[#3DDC84] text-white font-semibold text-lg transition-all duration-300 hover:opacity-85 active:scale-95"
>
  <div className="flex items-center justify-center gap-2">
    <Download className="h-5 w-5" />
    Download for Android
  </div>
</button>
                

                <p className="text-sm text-muted-foreground/60">
                  No credit needed • Instant setup • 100% free
                </p>
              </div>
            </div>
          </div>


        </div>
      </div>

      {/* Modal Overlay */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          {/* Animated background blobs in modal */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-20 left-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl animate-blob"></div>
            <div className="absolute bottom-20 right-10 w-32 h-32 bg-accent/10 rounded-full blur-2xl animate-blob animation-delay-2000"></div>
          </div>

          <div className="relative w-full max-w-sm">
            {step === 'confirm' && (
              <div className="animate-scale-in rounded-3xl bg-white shadow-2xl overflow-hidden border border-border/30">
                <div className="relative bg-gradient-to-br from-primary/5 to-accent/5 p-8">
                  <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl"></div>
                  <div className="relative text-center space-y-6">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-orange-600 text-white mx-auto">
                      <Download className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-foreground mb-2">
  {downloadType === 'android' ? 'Download for Android?' : 'Download for Windows?'}
</h3>
<p className="text-muted-foreground text-sm">
  {downloadType === 'android' 
    ? 'Install Chatify APK on your Android device. Enable unknown sources to install.' 
    : 'Get instant messaging with end-to-end encryption. Installation takes less than a minute.'}
</p>
                    </div>
                    <div className="space-y-3">
<button
  onClick={downloadType === 'android' ? startAndroidDownload : startDownload}
  disabled={isDownloading}
  className={`w-full px-6 py-3 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-all duration-300 hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer ${
    downloadType === 'android' ? 'bg-[#3DDC84]' : 'bg-primary'
  }`}
>
  {isDownloading ? "Downloading..." : "Yes, Download Now"}
</button>
                      <button
                        onClick={() => setShowPopup(false)}
                        className="w-full px-6 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-secondary/50 text-foreground font-semibold hover:bg-secondary/80 transition-colors shadow-sm"
                      >
                        Maybe Later
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

           

            
          </div>
        </div>
      )}
      {/* @ts-ignore */}
      <style jsx global>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .animation-delay-200 {
          animation-delay: 200ms;
        }

        .animation-delay-300 {
          animation-delay: 300ms;
        }

        .animation-delay-400 {
          animation-delay: 400ms;
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
          opacity: 0;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out forwards;
        }

        body {
          overflow-x: hidden;
        }
      `}</style>
    </div>
  );
}
