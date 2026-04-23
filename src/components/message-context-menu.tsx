"use client";

import { useEffect, useRef, useState } from "react";
import { Reply, Forward, Pin, Trash2, Users, Copy, Check } from "lucide-react";

interface MessageContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onCopy: () => void;
  onReply: () => void;
  onForward: () => void;
  onPin: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  isOwn: boolean;
  isPinned: boolean;
}

export function MessageContextMenu({
  isOpen,
  position,
  onClose,
  onCopy,
  onReply,
  onForward,
  onPin,
  onDeleteForMe,
  onDeleteForEveryone,
  isOwn,
  isPinned,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [copied, setCopied] = useState(false);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Menu dimensions (approximate if not yet rendered)
     const menuWidth = 240; // 🔥 FIXED WIDTH
const menuHeight = 310; // approx with copy option

      let newX = position.x;
      let newY = position.y;

      // Adjust horizontal position - check if menu goes off right edge
      if (position.x + menuWidth > viewportWidth - 20) {
        newX = viewportWidth - menuWidth - 20;
      }
      // Check left edge
      if (newX < 20) {
        newX = 20;
      }

      // Adjust vertical position - check if menu goes off bottom edge
      if (position.y + menuHeight > viewportHeight - 20) {
        newY = viewportHeight - menuHeight - 20;
      }
      // Check top edge
      if (newY < 20) {
        newY = 20;
      }

      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [isOpen, position]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    // Delay to prevent immediate close
    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }, 0);

    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const menuItems = [
    {
      label: copied ? "Copied!" : "Copy",
      icon: copied ? Check : Copy,
      action: handleCopy,
      show: true,
    },
    {
      label: "Reply",
      icon: Reply,
      action: onReply,
      show: true,
    },
    {
      label: "Forward",
      icon: Forward,
      action: onForward,
      show: true,
    },
    {
      label: isPinned ? "Unpin" : "Pin",
      icon: Pin,
      action: onPin,
      show: true,
    },
    {
      label: "Delete for Me",
      icon: Trash2,
      action: onDeleteForMe,
      show: true,
      className: "text-destructive hover:text-destructive",
    },
    {
      label: "Delete for Everyone",
      icon: Users,
      action: onDeleteForEveryone,
      show: isOwn, // Only show for own messages like WhatsApp
      className: "text-destructive hover:text-destructive",
    },
  ];

  return (
    <div
      ref={menuRef}
className="fixed z-50 w-[240px] min-w-[240px] rounded-xl border border-border bg-card p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {menuItems
        .filter((item) => item.show)
        .map((item, index) => (
          <button
            key={item.label}
            onClick={(e) => {
              e.stopPropagation();
              item.action();
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-muted ${
              item.className || ""
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        ))}
    </div>
  );
}
