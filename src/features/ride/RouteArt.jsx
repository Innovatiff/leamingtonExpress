import { useId } from "react";

/** Night map with a glowing route — echoes the brand ads. */
export default function RouteArt({ className = "", animated = true }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={`route-art ${className}`} viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id={`bg${id}`} cx="0.7" cy="0.25" r="0.9">
          <stop offset="0" stopColor="#13235a" />
          <stop offset="0.6" stopColor="#080d1d" />
          <stop offset="1" stopColor="#05070d" />
        </radialGradient>
        <filter id={`glow${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="400" height="300" fill={`url(#bg${id})`} />
      <g stroke="#3b5bdb" strokeOpacity="0.22" strokeWidth="1.2" fill="none">
        {Array.from({ length: 14 }, (_, i) => (
          <path key={`v${i}`} d={`M${-40 + i * 34} 0l${60} 300`} />
        ))}
        {Array.from({ length: 10 }, (_, i) => (
          <path key={`h${i}`} d={`M0 ${i * 34}l400 ${-40}`} />
        ))}
      </g>
      <g fill="#4f7dff" opacity="0.08">
        <rect x="40" y="60" width="60" height="40" transform="skewX(11)" />
        <rect x="240" y="170" width="80" height="50" transform="skewX(11)" />
        <rect x="150" y="20" width="50" height="34" transform="skewX(11)" />
      </g>
      <path
        className={animated ? "route-art__path" : ""}
        d="M70 236 L120 196 L118 150 L196 130 L214 92 L300 72"
        fill="none"
        stroke="#4f7dff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#glow${id})`}
      />
      <circle cx="70" cy="236" r="16" fill="#4f7dff" opacity="0.18" />
      <circle cx="70" cy="236" r="8" fill="#05070d" stroke="#4f7dff" strokeWidth="4" filter={`url(#glow${id})`} />
      <g transform="translate(288 26) scale(0.34)">
        <path fill="#2f63ff" fillRule="evenodd" d="M25.6 94.7C14 80 8 63 8 46 8 22.8 26.8 4 50 4s42 18.8 42 42c0 5.5-.3 10.6-.8 15.4Q60 86 25.6 94.7ZM50 28a17 17 0 1 0 0 34 17 17 0 1 0 0-34Z" />
        <path fill="#fff" d="M32.4 105.6Q63 93 90 63.4C85 85 70 103 50.4 124 45 116 39 110 32.4 105.6Z" />
      </g>
      <g className={animated ? "route-art__car" : ""} transform="translate(176 126)">
        <rect x="-15" y="-9" width="30" height="18" rx="6" fill="#ffffff" />
        <rect x="-8" y="-6" width="14" height="12" rx="3" fill="#1f4fe6" />
      </g>
    </svg>
  );
}
