export function generateUID(email) {
  if (!email) return "user_fallback";
  return "user_" + btoa(email).replace(/=/g, "").slice(0, 10);
}