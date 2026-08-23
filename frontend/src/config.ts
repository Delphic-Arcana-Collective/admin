// API_BASE should include the protocol (http:// or https://) and the full host:port
// Example: "http://localhost:8080" or "https://api.example.com"
// For production build: leave empty to use relative paths, or set absolute URL
const raw = process.env.NEXT_PUBLIC_API_BASE ?? "";
export const API_BASE = raw;

function getBaseUrl(): string {
  if (process.env.NODE_ENV === "production" && !raw) {
    return "";
  }
  return raw;
}

export { getBaseUrl };