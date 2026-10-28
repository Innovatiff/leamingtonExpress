import { useId } from "react";
import { CITY } from "@/config/site";

/** The Express map-pin. tone="dark" → for dark backgrounds (white tail). */
export function Pin({ size = 30, tone = "dark", className = "" }) {
  const gid = useId().replace(/:/g, "");
  return (
    <svg
      className={`pin ${className}`}
      width={(size * 100) / 128}
      height={size}
      viewBox="0 0 100 128"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`pg${gid}`} x1="0.1" y1="0.9" x2="0.95" y2="0.1">
          <stop offset="0" stopColor="#0a2bb8" />
          <stop offset="0.5" stopColor="#1f5cff" />
          <stop offset="1" stopColor="#5294ff" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#pg${gid})`}
        fillRule="evenodd"
        d="M25.6 94.7C14 80 8 63 8 46 8 22.8 26.8 4 50 4s42 18.8 42 42c0 5.5-.3 10.6-.8 15.4Q60 86 25.6 94.7ZM50 28a17 17 0 1 0 0 34 17 17 0 1 0 0-34Z"
      />
      <path fill={tone === "dark" ? "#ffffff" : "#363b47"} d="M32.4 105.6Q63 93 90 63.4C85 85 70 103 50.4 124 45 116 39 110 32.4 105.6Z" />
    </svg>
  );
}

/** Pin + "LEAMINGTON / EXPRESS" wordmark (the city name follows the site's city). */
export default function Logo({ tone = "dark", size = "md", className = "" }) {
  return (
    <span className={`brandmark brandmark--${tone} brandmark--${size} ${className}`}>
      <Pin size={size === "lg" ? 46 : size === "sm" ? 26 : 34} tone={tone} />
      <span className="brandmark__text">
        <span className="brandmark__city">{CITY.name}</span>
        <span className="brandmark__express">Express</span>
      </span>
    </span>
  );
}
