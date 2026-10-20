/**
 * Google Maps settings shared by the admin's maps. Client-safe: public values
 * only. The BROWSER key is restricted in Google Cloud by HTTP referrer to the
 * admin's domain and to the Maps JavaScript API — it is not the server key
 * the API holds, and it must never be. Address and place lookups go through
 * the API (`/places/*`, `/admin/areas/search`), never to Google from here.
 */
export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
/** A Map ID from Google Cloud → Maps Management is required for AdvancedMarker; the demo id works with a console warning. */
export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

export const ROOME_BLUE = "#2563a8";
export const ROOME_BLUE_DARK = "#16365c";
export const INACTIVE_GREY = "#94a3b8";

/** The teardrop pin both admin maps draw, as inline SVG for an AdvancedMarker. */
export function PinGlyph({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      stroke="white"
      strokeWidth={1.5}
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,.35))", display: "block" }}
      aria-hidden="true"
    >
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.6" fill="white" />
    </svg>
  );
}
