"use client";

import { useEffect, useRef, useState } from "react";
import {
  Reply,
  Forward,
  Pin,
  Trash2,
  Users,
  Copy,
  Check,
  Edit3Icon,
  Download
} from "lucide-react";

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
  onSelect: () => void;
  onEdit: () => void;
  isOwn: boolean;
  isPinned: boolean;
  isSelfChat: boolean;
  isImage?: boolean;
  onDownloadImage?: () => void;
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
  onSelect,
  onEdit,
  isOwn,
  isPinned,
  isSelfChat,
   isImage = false,
  onDownloadImage, 
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const menuWidth = 240;
      const menuHeight = 350;

      let newX = position.x;
      let newY = position.y;

      if (position.x + menuWidth > viewportWidth - 20) {
        newX = viewportWidth - menuWidth - 20;
      }
      if (newX < 20) newX = 20;

      if (position.y + menuHeight > viewportHeight - 20) {
        newY = viewportHeight - menuHeight - 20;
      }
      if (newY < 20) newY = 20;

      setAdjustedPosition({ x: newX, y: newY });
    }
  }, [isOpen, position]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

const menuItems = [
  // IMAGE ONLY
  

  {
    label: "Download",
    icon: Download,
    action: () => onDownloadImage?.(),
    show: isImage,
  },

  // NORMAL COPY
  {
    label: copied ? "Copied!" : "Copy",
    icon: copied ? Check : Copy,
    action: handleCopy,
    show: !isImage,
  },

  {
    label: "Select",
    icon: Check,
    action: onSelect,
    show: true,
  },

  // 🔥 IMAGE PAR EDIT HIDE
  {
    label: "Edit",
    icon: Edit3Icon,
    action: onEdit,
    show: isOwn && !isImage,
  },

  {
    label: "Forward",
    icon: Forward,
    action: onForward,
    show: isSelfChat,
  },

  {
    label: "Reply",
    icon: Reply,
    action: onReply,
    show: !isSelfChat,
  },

  {
    label: "Forward",
    icon: Forward,
    action: onForward,
    show: !isSelfChat,
  },

  {
    label: isPinned ? "Unpin" : "Pin",
    icon: Pin,
    action: onPin,
    show: true,
  },

  {
    label: "Delete",
    icon: Trash2,
    action: onDeleteForMe,
    show: isSelfChat,
    className: "text-destructive",
  },

  {
    label: "Delete for Me",
    icon: Trash2,
    action: onDeleteForMe,
    show: !isSelfChat,
    className: "text-destructive",
  },

  {
    label: "Delete for Everyone",
    icon: Users,
    action: onDeleteForEveryone,
    show: !isSelfChat && isOwn,
    className: "text-destructive",
  },
];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-[240px] rounded-xl border bg-card p-1.5 shadow-xl"
      style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
    >
      {menuItems
        .filter((i) => i.show)
        .map((item) => (
          <button
            key={item.label}
            onClick={(e) => {
              e.stopPropagation();
              item.action();
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-muted ${
              item.className || ""
            }`}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
    </div>
  );
}