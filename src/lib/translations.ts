// src/lib/translations.ts

export type Language =
  | "English"
  | "Hindi"
  | "Arabic"
  | "Spanish"
  | "French"
  | "German";

type TranslationKeys =
  | "settings"
  | "profile"
  | "account"
  | "appearance"
  | "notifications"
  | "privacy"
  | "security"
  | "storage"
  | "help"
  | "dangerZone"

  // profile
  | "displayName"
  | "emailAddress"
  | "bio"
  | "bioPlaceholder"
  | "yourName"
  | "yourEmail"
  | "saveChanges"
  | "discard"
  | "profileSaved"
  | "updating"

  // validation
  | "nameEmpty"
  | "emailEmpty"
  | "invalidEmail"
  | "notLoggedIn"

  // account
  | "changePassword"
  | "lastChanged"
  | "currentPassword"
  | "newPassword"
  | "confirmPassword"
  | "updatePassword"
  | "cancel"
  | "passwordChanged"
  | "enterCurrentPassword"
  | "enterNewPassword"
  | "min6Chars"
  | "passwordMismatch"
  | "weak"
  | "fair"
  | "good"
  | "strong"

  // appearance
  | "darkMode"
  | "lightMode"
  | "changeTheme"
  | "enabled"
  | "language"
  | "chooseLanguage"

  // notifications
  | "pushNotifications"
  | "receiveAlerts"
  | "soundAlerts"
  | "playSoundNotifications"

  // privacy
  | "readReceipts"
  | "letOthersSee"
  | "onlineStatus"
  | "showActive"
  | "privacyPolicy"
  | "termsOfService"

  // security
  | "twoFA"
  | "twoFAEnabled"
  | "twoFADisabled"
  | "addExtraLayer"
  | "activeSessions"
  | "thisDevice"
  | "sessionTerminated"
  | "end"
  | "endAllOtherSessions"
  | "allSessionsEnded";

type TranslationMap = Record<Language, Record<TranslationKeys, string>>;

export const translations: TranslationMap = {
  English: {
    settings: "Settings",
    profile: "Profile",
    account: "Account",
    appearance: "Appearance",
    notifications: "Notifications",
    privacy: "Privacy",
    security: "Security",
    storage: "Storage",
    help: "Help",
    dangerZone: "Danger Zone",

    displayName: "Display Name",
    emailAddress: "Email Address",
    bio: "Bio",
    bioPlaceholder: "Tell something about yourself...",
    yourName: "Your Name",
    yourEmail: "Your Email",
    saveChanges: "Save Changes",
    discard: "Discard",
    profileSaved: "Profile saved successfully!",
    updating: "Updating...",

    nameEmpty: "Name cannot be empty",
    emailEmpty: "Email cannot be empty",
    invalidEmail: "Invalid email address",
    notLoggedIn: "You are not logged in",

    changePassword: "Change Password",
    lastChanged: "Last changed recently",
    currentPassword: "Current Password",
    newPassword: "New Password",
    confirmPassword: "Confirm Password",
    updatePassword: "Update Password",
    cancel: "Cancel",
    passwordChanged: "Password changed successfully",
    enterCurrentPassword: "Enter current password",
    enterNewPassword: "Enter new password",
    min6Chars: "Minimum 6 characters required",
    passwordMismatch: "Passwords do not match",
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",

    darkMode: "Dark Mode",
    lightMode: "Light Mode",
    changeTheme: "Switch theme",
    enabled: "enabled",
    language: "Language",
    chooseLanguage: "Choose your preferred language",

    pushNotifications: "Push Notifications",
    receiveAlerts: "Receive alerts",
    soundAlerts: "Sound Alerts",
    playSoundNotifications: "Play notification sounds",

    readReceipts: "Read Receipts",
    letOthersSee: "Let others see when you read messages",
    onlineStatus: "Online Status",
    showActive: "Show when you're active",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",

    twoFA: "Two-Factor Authentication",
    twoFAEnabled: "2FA Enabled",
    twoFADisabled: "2FA Disabled",
    addExtraLayer: "Add extra layer of security",
    activeSessions: "Active Sessions",
    thisDevice: "This Device",
    sessionTerminated: "Session terminated",
    end: "End",
    endAllOtherSessions: "End all other sessions",
    allSessionsEnded: "All sessions ended",
  },

  // 👇 baaki languages fallback ke liye English copy use kar rahe hain
  Hindi: {} as any,
  Arabic: {} as any,
  Spanish: {} as any,
  French: {} as any,
  German: {} as any,
};

// fallback fill
(["Hindi", "Arabic", "Spanish", "French", "German"] as Language[]).forEach(
  (lang) => {
    translations[lang] = { ...translations.English };
  }
);

export const getTranslation = (lang: Language, key: TranslationKeys) => {
  return translations[lang]?.[key] || translations.English[key] || key;
};