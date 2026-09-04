'use client';

import { useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  Download,
  Users,
  Video,
  FolderOpen,
  Cloud,
  Apple,
  Globe,
  PlaySquare,
  Laptop,
  Smartphone,
} from 'lucide-react';

type DownloadType = 'windows' | 'android' | 'mac' | 'web' | 'playstore';


function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M3 5.5L10.5 4.4V11.3H3V5.5Z" />
      <path d="M11.4 4.3L21 3V11.2H11.4V4.3Z" />
      <path d="M3 12.2H10.5V19.1L3 18V12.2Z" />
      <path d="M11.4 12.2H21V20.5L11.4 19.2V12.2Z" />
    </svg>
  );
}

function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M17.6 9.48l1.84-3.18a.5.5 0 00-.87-.5l-1.86 3.22a10.6 10.6 0 00-8.94 0L5.91 5.8a.5.5 0 10-.87.5l1.84 3.18C4.24 11.14 2.5 13.9 2.5 17h19c0-3.1-1.74-5.86-3.9-7.52zM8 14.5a1 1 0 110-2 1 1 0 010 2zm8 0a1 1 0 110-2 1 1 0 010 2z" />
    </svg>
  );
}
function DeviceMockup() {
  const contacts = [
    { name: 'Aman', active: true },
    { name: 'Riya', active: false },
    { name: 'Dev Team', active: false },
  ];

const laptopMessages = [
  { from: 'them', text: 'How fast is file uploading on Chatify?' },
  { from: 'me', text: 'Fast uploads with no compression — full quality every time' },
];

 const phoneMessages = [
  { from: 'them', text: 'Can I create group chats?' },
  { from: 'me', text: 'Yes, create unlimited group chats' },
  { from: 'them', text: 'Perfect, let’s add the team!' },
];

  return (
<div className="relative mx-auto w-full max-w-lg mb-14 select-none device-mockup" aria-hidden="true">
      {/* Laptop */}
      <div className="rounded-xl border-[10px] border-neutral-900 bg-white shadow-2xl overflow-hidden" style={{ aspectRatio: '16 / 9' }}>
        <div className="flex h-full flex-col">
          <div className="flex h-6 shrink-0 items-center gap-1.5 bg-neutral-100 px-3 border-b border-neutral-200">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            <span className="h-2 w-2 rounded-full bg-yellow-400" />
            <span className="h-2 w-2 rounded-full bg-green-400" />
          </div>
          <div className="flex flex-1 min-h-0">
            {/* Sidebar */}
            <div className="w-[38%] shrink-0 border-r border-neutral-200 bg-neutral-50 p-2.5 space-y-1">
              {contacts.map((c) => (
                <div key={c.name} className={`rounded-lg px-2 py-1.5 ${c.active ? 'bg-primary/10' : ''}`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="h-4 w-4 rounded-full bg-primary/30 shrink-0" />
                    <div className="text-[9px] font-semibold text-neutral-700 truncate">{c.name}</div>
                  </div>
                  <div className="text-[8px] text-neutral-400 truncate pl-5.5">{c.preview}</div>
                </div>
              ))}
            </div>
            {/* Chat window */}
            <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-end gap-1.5 overflow-hidden">
              {laptopMessages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.from === 'me'
                      ? 'self-end max-w-[68%] rounded-lg rounded-br-none bg-primary px-2 py-1 text-[9px] text-white break-words'
                      : 'self-start max-w-[68%] rounded-lg rounded-bl-none bg-neutral-100 px-2 py-1 text-[9px] text-neutral-600 break-words'
                  }
                >
                  {m.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Laptop base / keyboard deck */}
      <div className="relative mx-auto" style={{ width: '113%', marginLeft: '-7%' }}>
        {/* hinge strip, sits right under the screen */}
        <div className="mx-auto h-1 w-[50%] rounded-t-sm bg-neutral-950" />
        {/* wedge-shaped deck body, wider at the bottom for perspective */}
        <div
          className="h-5 bg-gradient-to-b from-neutral-600 via-neutral-800 to-neutral-950 relative shadow-xl"
          style={{ clipPath: 'polygon(7% 0, 93% 0, 100% 100%, 0% 100%)' }}
        >
          {/* top highlight catching the light along the front edge of the keyboard deck */}
          <div className="absolute inset-x-[7%] top-0 h-[3px] bg-white/25 rounded-full" />
          {/* subtle keyboard texture lines */}
          <div className="absolute inset-x-[14%] top-2.5 h-[1px] bg-white/5" />
          <div className="absolute inset-x-[10%] top-4.5 h-[1px] bg-white/5" />
        </div>
        {/* front lip with trackpad notch */}
        <div className="h-1.5 bg-neutral-950 rounded-b-sm shadow-inner" />
        <div className="mx-auto -mt-1.5 h-1.5 w-28 rounded-b-xl bg-neutral-700/80" />
      </div>

      {/* Phone — sits in front of the laptop's bottom-right corner */}
<div className="absolute -bottom-8 left-5 w-[92px] sm:w-[108px] rounded-[20px] border-[6px] border-neutral-900 bg-neutral-900 shadow-xl overflow-hidden" style={{ aspectRatio: '9 / 18.5' }}>
               <div className="flex h-full flex-col bg-white">
          <div className="flex h-2.5 shrink-0 items-center justify-center bg-neutral-900">
            <div className="h-0.5 w-4 rounded-full bg-neutral-700" />
          </div>
                    <div className="shrink-0 flex items-center gap-1.5 px-1.5 pt-1 pb-1">
            <div className="h-3.5 w-3.5 rounded-full bg-primary/30 shrink-0" />
            <div className="text-[8px] font-semibold text-neutral-700 truncate">Group</div>
          </div>
          <div className="h-px bg-neutral-200 shrink-0" />
                             <div className="flex-1 min-h-0 p-1.5 flex flex-col justify-end gap-2 overflow-hidden">
            {phoneMessages.map((m, i) => (
              <div
                key={i}
                className={
                  m.from === 'me'
                    ? 'self-end max-w-[85%] rounded-md rounded-br-none bg-primary px-1.5 py-1 text-[7px] leading-[1.2] text-white break-words'
                    : 'self-start max-w-[85%] rounded-md rounded-bl-none bg-neutral-100 px-1.5 py-1 text-[7px] leading-[1.2] text-neutral-600 break-words'
                }
              >
                {m.text}
              </div>
            ))}
          </div>
        </div>  </div>
    </div>
  );
}

export default function Welcome() {
  
  const [contactError, setContactError] = useState('');
 const [showPopup, setShowPopup] = useState(false);
  const [showNavDropdown, setShowNavDropdown] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactSent, setContactSent] = useState(false);
    const [isSendingContact, setIsSendingContact] = useState(false);
  const [activeNav, setActiveNav] = useState('home');
  const navDropdownRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<'confirm' | 'downloading' | 'ready' | 'comingSoon' | 'androidUnavailable'>('confirm');
  const [isDownloading, setIsDownloading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [downloadType, setDownloadType] = useState<DownloadType>('windows');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileDownload, setShowMobileDownload] = useState(false);
  useEffect(() => {
    if (!showNavDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (navDropdownRef.current && !navDropdownRef.current.contains(e.target as Node)) {
        setShowNavDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNavDropdown]);
  useEffect(() => {
  const sectionIds = ['home', 'features', 'support'];
  const sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean) as HTMLElement[];

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveNav(entry.target.id);
        }
      });
    },
    {
      rootMargin: '-40% 0px -50% 0px',
      threshold: 0,
    }
  );

  sections.forEach((section) => observer.observe(section));

  return () => {
    sections.forEach((section) => observer.unobserve(section));
  };
}, [mounted]);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDeviceClick = (type: DownloadType) => {
    setDownloadType(type);
    if (type === 'windows') {
      setStep('confirm');
    } else if (type === 'android') {
      setStep('androidUnavailable');
    } else {
      setStep('comingSoon');
    }
    setShowPopup(true);
  };

  const startDownload = () => {
    setIsDownloading(true);
    setTimeout(() => {
      const link = document.createElement('a');
      link.href =
        'https://github.com/chatify24/Chatify/releases/download/v1.3.8/Chatify_1.3.8_x64-setup.exe';
      link.download = 'Chatify.exe';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowPopup(false);
      setIsDownloading(false);
    }, 3000);
  };

  const startAndroidDownload = () => {
    setIsDownloading(true);
    setTimeout(() => {
      const link = document.createElement('a');
      link.href =
        'https://github.com/chatify24/chatify_android/releases/download/v2.9.8/Chatify.apk';
      link.download = 'Chatify.apk';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowPopup(false);
      setIsDownloading(false);
    }, 3000);
  };
const handleContactSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setContactError('');

  const emailRegex = /^[^\s@]+@[^\s@]+(\.[a-zA-Z]{2,6})+$/;
  if (!emailRegex.test(contactForm.email.trim())) {
    setContactError('Please enter a valid email address');
    return;
  }

  setIsSendingContact(true);
  try {
    const [res] = await Promise.all([
      fetch('https://chatify-backend-mrlh.onrender.com/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      }),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    const data = await res.json();
    if (!res.ok) {
      setContactError(data.error || 'Failed to send message');
      return;
    }
    setContactSent(true);
    setContactForm({ name: '', email: '', message: '' });
  } catch (err) {
    console.error('Contact form error:', err);
    setContactError('Failed to send message. Please try again.');
  } finally {
    setIsSendingContact(false);
  }
};

  if (!mounted) return null;

  const devices = [
    {
      type: 'windows' as DownloadType,
      label: 'Download for',
      title: 'Windows',
      sub: 'Secure .exe installer',
      icon: WindowsIcon,
      style: 'bg-primary text-white',
    },
    {
      type: 'android' as DownloadType,
      label: 'Download for',
      title: 'Android',
      sub: 'Verified APK file',
      icon: AndroidIcon,
      style: 'bg-neutral-900 text-white',
    },
  ];



  const features = [
    { icon: Users, title: 'Group Chats', desc: 'Group chats and instant replies.' },
    { icon: FolderOpen, title: 'File Sharing', desc: 'Share files without compression.' },
    { icon: Cloud, title: 'Cloud Sync', desc: 'Your chats stay in sync across every device.' },
  ];

 

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-neutral-900">
            <style>{`
  html {
    scroll-behavior: smooth;
  }
  .device-mockup, .device-mockup * {
    -webkit-text-size-adjust: 100% !important;
    -moz-text-size-adjust: 100% !important;
    text-size-adjust: 100% !important;
  }
`}</style>
      {/* Top Nav */}
<header className="border-b border-neutral-200/70 bg-white/90 backdrop-blur-sm sticky top-0 z-40">
  <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
        <MessageCircle className="h-4 w-4 text-white" strokeWidth={1.6} />
      </div>
      <span className="font-semibold text-lg">Chatify</span>
    </div>

    {/* Desktop nav — same as before */}
    <nav className="hidden sm:flex items-center gap-8 text-sm text-neutral-600">
      <a href="#home"
        onClick={() => setActiveNav('home')}
        className={`transition-colors ${activeNav === 'home' ? 'text-primary font-medium' : 'hover:text-neutral-900'}`}
      >
        Home
      </a>

      <a href="#features"
        onClick={() => setActiveNav('features')}
        className={`transition-colors ${activeNav === 'features' ? 'text-primary font-medium' : 'hover:text-neutral-900'}`}
      >
        Features
      </a>
      <div className="relative" ref={navDropdownRef}>
        <button
          onClick={() => setShowNavDropdown((v) => !v)}
          className="hover:text-neutral-900 transition-colors"
        >
          Download
        </button>
        {showNavDropdown && (
          <div className="absolute right-0 mt-3 w-48 rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden z-50">
            <button
              onClick={() => {
                setShowNavDropdown(false);
                handleDeviceClick('windows');
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-neutral-50 transition-colors"
            >
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 shrink-0">
                <WindowsIcon className="h-4 w-4 text-primary" />
              </span>
              Download for Windows
            </button>
            <button
              onClick={() => {
                setShowNavDropdown(false);
                handleDeviceClick('android');
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-neutral-50 transition-colors border-t border-neutral-100"
            >
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-[#3DDC84]/10 shrink-0">
                <AndroidIcon className="h-4 w-4 text-[#3DDC84]" />
              </span>
              Download for Android
            </button>
          </div>
        )}
      </div>
      <a href="#support"
        onClick={() => setActiveNav('support')}
        className={`transition-colors ${activeNav === 'support' ? 'text-primary font-medium' : 'hover:text-neutral-900'}`}
      >
        Support
      </a>
    </nav>

    {/* Mobile hamburger button */}
    <button
      onClick={() => setShowMobileMenu((v) => !v)}
      className="sm:hidden flex h-9 w-9 items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors"
      aria-label="Toggle menu"
    >
      {showMobileMenu ? (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      )}
    </button>
  </div>

  
<div
  className={`sm:hidden absolute top-full left-0 right-0 overflow-hidden border-t border-neutral-200/70 bg-white shadow-lg transition-all duration-300 ease-in-out ${
    showMobileMenu ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 border-t-0'
  }`}
>
  <div className="px-6 py-4 space-y-1">
    <a href="#home"
      onClick={() => { setActiveNav('home'); setShowMobileMenu(false); }}
      className={`block px-3 py-2.5 rounded-lg text-sm transition-colors ${activeNav === 'home' ? 'text-primary font-medium bg-primary/5' : 'text-neutral-600 hover:bg-neutral-50'}`}
    >
      Home
    </a>
    <a href="#features"
      onClick={() => { setActiveNav('features'); setShowMobileMenu(false); }}
      className={`block px-3 py-2.5 rounded-lg text-sm transition-colors ${activeNav === 'features' ? 'text-primary font-medium bg-primary/5' : 'text-neutral-600 hover:bg-neutral-50'}`}
    >
      Features
    </a>

    {/* Download collapsible */}
    <div>
      <button
        onClick={() => setShowMobileDownload((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
      >
        <span>Download</span>
        <svg
          className={`h-4 w-4 transition-transform duration-200 ${showMobileDownload ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showMobileDownload ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="pl-3 pt-1 space-y-1">
          <button
            onClick={() => {
              setShowMobileMenu(false);
              setShowMobileDownload(false);
              handleDeviceClick('windows');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 shrink-0">
              <WindowsIcon className="h-3.5 w-3.5 text-primary" />
            </span>
            Download for Windows
          </button>
          <button
            onClick={() => {
              setShowMobileMenu(false);
              setShowMobileDownload(false);
              handleDeviceClick('android');
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left text-neutral-600 hover:bg-neutral-50 transition-colors"
          >
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-[#3DDC84]/10 shrink-0">
              <AndroidIcon className="h-3.5 w-3.5 text-[#3DDC84]" />
            </span>
            Download for Android
          </button>
        </div>
      </div>
    </div>

    <a href="#support"
      onClick={() => { setActiveNav('support'); setShowMobileMenu(false); }}
      className={`block px-3 py-2.5 rounded-lg text-sm transition-colors ${activeNav === 'support' ? 'text-primary font-medium bg-primary/5' : 'text-neutral-600 hover:bg-neutral-50'}`}
    >
      Support
    </a>
  </div>
</div>
</header>

      {/* Hero */}
<section id="home" className="mx-auto max-w-6xl px-6 pt-20 pb-10 text-center scroll-mt-32">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">Chatify</h1>
        <p className="text-neutral-500 max-w-xl mx-auto mb-10">Your global communication hub.</p>
        <DeviceMockup />
      </section>

      {/* Choose your device card */}
      <section id="download" className="mx-auto max-w-2xl px-6 pb-16">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold mb-1">Choose your device</h2>
            <p className="text-sm text-neutral-500">Download Chatify and start connecting instantly.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {devices.map((d) => (
              <button
                key={d.type}
                onClick={() => handleDeviceClick(d.type)}
                className={`rounded-xl px-5 py-4 text-left font-semibold transition-opacity hover:opacity-90 active:scale-[0.98] ${d.style}`}
              >
                   <div className="flex items-center gap-4">
                  <d.icon className={`h-8 w-8 shrink-0 ${d.type === 'android' ? 'text-[#3DDC84]' : ''}`} />
                  <div>
                    <div className="text-xs font-normal opacity-80">{d.label}</div>
                    <div>{d.title}</div>
                    <div className="text-xs font-normal opacity-70 mt-0.5">{d.sub}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

      
        </div>
      </section>

      {/* Key Features + Testimonials */}
<section id="features" className="mx-auto max-w-6xl px-6 pb-24 scroll-mt-24">
  <div>
          <h3 className="text-lg font-semibold mb-5">Key features</h3>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-y-6">
            {features.map((f) => (
              <div key={f.title} className="flex gap-3">
                <f.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" strokeWidth={1.6} />
                <div>
                  <div className="font-medium text-sm mb-0.5">{f.title}</div>
                  <p className="text-sm text-neutral-500 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

       
       </section>

      {/* Support */}
      <section id="support" className="bg-white py-20 border-t border-neutral-200">
  <div className="mx-auto max-w-xl px-6">
        <div className="text-center mb-10">
          <h3 className="text-2xl font-semibold mb-2">Get in touch</h3>
          <p className="text-sm text-neutral-500">
            Have a question or facing an issue? Send us a message.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-8">
        <form onSubmit={handleContactSubmit} className="space-y-4">
  <div>
    <label className="block text-sm font-medium mb-1.5">Name</label>
    <input
      type="text"
      required
      value={contactForm.name}
      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      placeholder="Your name"
    />
  </div>
  <div>
    <label className="block text-sm font-medium mb-1.5">Email</label>
    <input
      type="email"
      required
      value={contactForm.email}
      onChange={(e) => {
        setContactForm({ ...contactForm, email: e.target.value });
        if (contactError) setContactError('');
      }}
      className={`w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 ${
        contactError ? 'border-red-400 focus:ring-red-200' : 'border-neutral-200 focus:ring-primary/30'
      }`}
      placeholder="Your email"
    />
    {contactError && (
      <p className="text-xs text-red-500 mt-1.5">{contactError}</p>
    )}
  </div>
  <div>
    <label className="block text-sm font-medium mb-1.5">Message</label>
    <textarea
      required
      rows={4}
      value={contactForm.message}
      onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
      className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
      placeholder="How can we help?"
    />
  </div>

  <button
  type="submit"
  disabled={isSendingContact}
  className="w-full px-6 py-3 rounded-xl bg-primary text-white font-semibold transition-opacity hover:opacity-90 disabled:opacity-45 disabled:cursor-not-allowed"
>
  Send Message
</button>
</form>
        </div>
        </div>
      </section>

      {/* Modal */}
      {showPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden border border-neutral-200">
            {step === 'confirm' && (
              <div className="p-8 text-center space-y-6">
                                                 <div
                  className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl mx-auto ${
                    downloadType === 'android' ? 'bg-[#3DDC84]/10' : 'bg-primary/10'
                  }`}
                >
                  {downloadType === 'android' ? (
                    <AndroidIcon className="h-7 w-7 text-[#3DDC84]" />
                  ) : (
                    <WindowsIcon className="h-7 w-7 text-primary" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">
                    {downloadType === 'android' ? 'Download for Android?' : 'Download for Windows?'}
                  </h3>
                  <p className="text-sm text-neutral-500">
                    {downloadType === 'android'
                      ? 'Stay connected wherever you go — simple install, smooth performance, and your chats always within reach.'
                      : 'Enjoy a smoother chatting experience on your PC — quick and effortless setup.'}
                  </p>
                </div>
                <div className="space-y-3">
                      <button
                    onClick={downloadType === 'android' ? startAndroidDownload : startDownload}
                    disabled={isDownloading}
                    className={`w-full px-6 py-3 rounded-xl text-white font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 ${
                      downloadType === 'android' ? 'bg-neutral-900' : 'bg-primary'
                    }`}
                  >
                    {isDownloading ? 'Downloading…' : 'Download now'}
                  </button>
                  <button
                    onClick={() => setShowPopup(false)}
                    className="w-full px-6 py-3 rounded-xl border border-neutral-200 bg-neutral-50 font-semibold hover:bg-neutral-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {step === 'comingSoon' && (
              <div className="p-8 text-center space-y-6">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-neutral-900 text-white mx-auto">
                  <Cloud className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">This isn't ready yet</h3>
                  <p className="text-sm text-neutral-500">
                    We're still building this version of Chatify. Thanks for checking back.
                  </p>
                </div>
                <button
                  onClick={() => setShowPopup(false)}
                  className="w-full px-6 py-3 rounded-xl border border-neutral-200 font-semibold hover:bg-neutral-50 transition-colors"
                >
                  Got it
                </button>
              </div>
            )}

            {step === 'androidUnavailable' && (
              <div className="p-8 text-center space-y-6">
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#3DDC84]/10 mx-auto">
                  <AndroidIcon className="h-7 w-7 text-[#3DDC84]" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">This app is currently unavailable</h3>
                  <p className="text-sm text-neutral-500">
                    Our team is working on making Chatify better for Android. Thanks for your patience!
                  </p>
                </div>
                <button
                  onClick={() => setShowPopup(false)}
                  className="w-full px-6 py-3 rounded-xl border border-neutral-200 font-semibold hover:bg-neutral-50 transition-colors"
                >
                  Got it
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {contactSent && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
    <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden border border-neutral-200">
      <div className="p-8 text-center space-y-6">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 mx-auto">
          <svg
            className="h-7 w-7 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-2">Message sent!</h3>
          <p className="text-sm text-neutral-500">We'll get back to you soon.</p>
        </div>
        <button
          onClick={() => setContactSent(false)}
          className="w-full px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
        >
          Got it
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}