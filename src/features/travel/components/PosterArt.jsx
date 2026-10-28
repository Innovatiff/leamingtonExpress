import { useId } from "react";

/*
 * Retro travel-poster illustrations, drawn in SVG so every trip has artwork
 * even before real photos are uploaded (Admin → Viajes → image URL).
 * <PosterArt scene="falls" palette="sunset" />
 */

export const PALETTES = {
  sunset: { sky: ["#241a57", "#b8406c", "#ff9a5a"], sun: "#ffd27a", far: "#7d3a6e", mid: "#55285f", near: "#271541", water: ["#ef8a62", "#4c2763"], land: "#3a1f52" },
  day: { sky: ["#2f7fd1", "#86c3f0", "#e3f4ff"], sun: "#fff4c6", far: "#8fc0a0", mid: "#4f9566", near: "#2b6446", water: ["#58b2e6", "#1b6aa5"], land: "#3d7a52" },
  golden: { sky: ["#f29e5c", "#f7b46b", "#ffe1a1"], sun: "#fff3c4", far: "#d58a57", mid: "#a8603f", near: "#5e3530", water: ["#f2a46b", "#9b4f3a"], land: "#7a4636" },
  dusk: { sky: ["#0e1b47", "#46408f", "#f28a5f"], sun: "#ffd27a", far: "#403c7e", mid: "#2b285f", near: "#14123a", water: ["#6c5aa8", "#1b1846"], land: "#211d4f" },
  night: { sky: ["#040a22", "#0f2258", "#2d55ad"], sun: "#f3f0cf", far: "#1b2e66", mid: "#13204a", near: "#080f2c", water: ["#1d3b82", "#060c26"], land: "#0b1433" },
  autumn: { sky: ["#f3b06b", "#f6c98d", "#fdebc8"], sun: "#fff6d6", far: "#c9744a", mid: "#9c4a33", near: "#5a2a22", water: ["#5b8fb0", "#23506f"], land: "#6b3426" },
  winter: { sky: ["#8fbbea", "#cfe5fb", "#f5faff"], sun: "#ffffff", far: "#c7d9ee", mid: "#9db8d8", near: "#e9f2fc", water: ["#9cc4e8", "#5b8cc0"], land: "#f4f8fd" },
  teal: { sky: ["#2fb2cf", "#9fe0ec", "#effcfd"], sun: "#fffbe0", far: "#8bc9b7", mid: "#4f9e86", near: "#2a6b5a", water: ["#21c1c7", "#07738f"], land: "#3a7a5f" },
};

// deterministic pseudo-random so drawings are stable
const rng = (seed) => () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

function Skyline({ y, color, count = 16, maxH = 70, x0 = 0, x1 = 400, seed = 7, windows }) {
  const r = rng(seed);
  const w = (x1 - x0) / count;
  return (
    <g fill={color}>
      {Array.from({ length: count }, (_, i) => {
        const h = 18 + r() * maxH;
        const bw = w * (0.7 + r() * 0.5);
        const x = x0 + i * w;
        return (
          <g key={i}>
            <rect x={x} y={y - h} width={bw} height={h + 2} />
            {windows &&
              Array.from({ length: Math.floor(h / 9) }, (_, j) =>
                r() > 0.55 ? <rect key={j} x={x + 3 + (j % 2) * (bw / 2 - 2)} y={y - h + 5 + j * 8} width={2.4} height={3} fill={windows} opacity="0.85" /> : null,
              )}
          </g>
        );
      })}
    </g>
  );
}

function Trees({ y, color, count = 18, x0 = 0, x1 = 400, size = 16, seed = 3, kind = "pine", colors }) {
  const r = rng(seed);
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const x = x0 + (i + r() * 0.6) * ((x1 - x0) / count);
        const s = size * (0.7 + r() * 0.6);
        const c = colors ? colors[Math.floor(r() * colors.length)] : color;
        return kind === "round" ? (
          <g key={i}>
            <rect x={x - 1} y={y - s * 0.5} width="2" height={s * 0.6} fill="#3b2418" />
            <circle cx={x} cy={y - s * 0.75} r={s * 0.55} fill={c} />
          </g>
        ) : (
          <path key={i} d={`M${x} ${y - s * 1.6}L${x + s * 0.55} ${y}H${x - s * 0.55}Z`} fill={c} />
        );
      })}
    </g>
  );
}

const Birds = ({ x, y, n = 4, color = "#1c1c2e" }) => (
  <g fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.75">
    {Array.from({ length: n }, (_, i) => {
      const bx = x + i * 13 + (i % 2) * 4;
      const by = y + (i % 3) * 6;
      return <path key={i} d={`M${bx - 5} ${by}q5 -5 5 0q0 -5 5 0`} />;
    })}
  </g>
);

const Waves = ({ y, color, n = 6, opacity = 0.35 }) => (
  <g stroke={color} strokeWidth="1.6" fill="none" opacity={opacity} strokeLinecap="round">
    {Array.from({ length: n }, (_, i) => (
      <path key={i} d={`M${20 + ((i * 67) % 340)} ${y + i * 9}q8 -4 16 0t16 0`} />
    ))}
  </g>
);

/* --------------------------------- scenes -------------------------------- */
const SCENES = {
  falls: (p, id) => (
    <>
      <Skyline y={150} color={p.far} count={12} maxH={30} x0={210} x1={400} seed={4} />
      <g fill={p.far}>
        <rect x="318" y="58" width="5" height="92" />
        <ellipse cx="320.5" cy="64" rx="12" ry="7" />
        <rect x="319.5" y="40" width="2" height="20" />
      </g>
      <path d="M0 150h120q80 26 160 0h120v60H0z" fill={p.mid} />
      <path d={`M118 152q82 30 164 0v58q-82 26-164 0z`} fill={`url(#fallw${id})`} />
      <g stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.4">
        {Array.from({ length: 22 }, (_, i) => (
          <path key={i} d={`M${124 + i * 7.3} ${157 + Math.sin(i / 3.4) * 8}v${42 + (i % 4) * 4}`} />
        ))}
      </g>
      <g fill="#ffffff" opacity="0.65">
        <ellipse cx="160" cy="212" rx="70" ry="14" />
        <ellipse cx="245" cy="214" rx="60" ry="12" />
        <ellipse cx="200" cy="206" rx="40" ry="9" opacity="0.6" />
      </g>
      <rect y="214" width="400" height="86" fill={`url(#water${id})`} />
      <Waves y={232} color="#ffffff" />
      <g transform="translate(250 252)">
        <path d="M0 0h46l-7 11H6z" fill="#1d3557" />
        <rect x="9" y="-9" width="26" height="9" rx="2" fill="#e63946" />
        <rect x="14" y="-15" width="14" height="6" rx="1.5" fill="#f1faee" />
      </g>
      <path d="M0 214h40q20 6 30 30v56H0z" fill={p.near} />
      <path d="M400 214h-34q-24 10-30 40v46h64z" fill={p.near} />
    </>
  ),

  skyline: (p, id) => (
    <>
      <Skyline y={208} color={p.far} count={18} maxH={56} seed={11} />
      <Skyline y={210} color={p.mid} count={13} maxH={72} x0={20} x1={380} seed={21} windows="#ffd98a" />
      <g fill={p.near}>
        <path d="M268 210V96h4l2-26 2 26h4v114z" />
        <ellipse cx="274" cy="100" rx="13" ry="7" />
        <ellipse cx="274" cy="118" rx="8" ry="4" />
        <rect x="273" y="22" width="2" height="50" />
      </g>
      <rect y="210" width="400" height="90" fill={`url(#water${id})`} />
      <g opacity="0.22" transform="matrix(1 0 0 -1 0 420)">
        <Skyline y={210} color={p.mid} count={13} maxH={72} x0={20} x1={380} seed={21} />
        <path d="M268 210V96h4l2-26 2 26h4v114z" fill={p.near} />
      </g>
      <Waves y={238} color="#ffffff" n={5} opacity={0.3} />
      <g transform="translate(60 250)">
        <path d="M0 0h50l-6 10H5z" fill="#ffffff" />
        <path d="M24 -26v26M24 -26l16 22H24z" stroke="#ffffff" strokeWidth="1.5" fill="#ffffff" />
      </g>
    </>
  ),

  vineyard: (p) => (
    <>
      <path d="M0 150q100-40 200-6t200-10v166H0z" fill={p.far} />
      <path d="M0 178q120-36 230 0t170-8v130H0z" fill={p.mid} />
      <g stroke={p.near} strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" fill="none">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M${-20 + i * 10} 300Q${120 + i * 18} ${200 + i * 4} ${430} ${186 + i * 12}`} />
        ))}
      </g>
      <g transform="translate(286 150)">
        <rect width="54" height="30" fill="#f6e7cf" />
        <path d="M-6 2L27-18 60 2z" fill="#8c3b2f" />
        <rect x="22" y="12" width="10" height="18" fill="#6b3a2a" />
        <rect x="6" y="9" width="8" height="7" fill="#6b3a2a" />
        <rect x="40" y="9" width="8" height="7" fill="#6b3a2a" />
      </g>
      <Trees y={162} color={p.near} count={5} x0={230} x1={280} size={12} kind="round" seed={8} />
      <g transform="translate(70 210) rotate(-8)">
        <path d="M0 0h22l-2 20q-9 8-18 0z" fill="#ffffff" opacity="0.9" />
        <path d="M2 8h18l-1 11q-8 6-16 0z" fill="#8e1b3a" />
        <rect x="10" y="26" width="2" height="22" fill="#ffffff" opacity="0.9" />
        <ellipse cx="11" cy="49" rx="9" ry="2.5" fill="#ffffff" opacity="0.9" />
      </g>
    </>
  ),

  island: (p, id) => (
    <>
      <rect y="170" width="400" height="130" fill={`url(#water${id})`} />
      <path d="M210 172q30-24 70-16t80 6q20 2 40 10z" fill={p.mid} />
      <Trees y={168} color={p.near} count={9} x0={230} x1={370} size={11} kind="round" seed={2} />
      <g transform="translate(70 92)">
        <path d="M8 0h14l6 84H2z" fill="#ffffff" />
        <rect x="2" y="26" width="26" height="9" fill="#d62839" />
        <rect x="2" y="55" width="26" height="9" fill="#d62839" />
        <rect x="6" y="-12" width="18" height="12" fill="#ffd166" />
        <path d="M4 -12L15 -26 26 -12z" fill="#d62839" />
      </g>
      <path d="M0 176h120q-10 20-40 26t-80 4z" fill={p.near} />
      <g transform="translate(150 214)">
        <path d="M0 0h96l-12 18H8z" fill="#ffffff" />
        <rect x="18" y="-14" width="56" height="14" fill="#ffffff" />
        <rect x="18" y="-6" width="56" height="3" fill="#2a6fdb" />
        <rect x="40" y="-24" width="10" height="10" fill="#e63946" />
        <path d="M-2 18h104" stroke="#ffffff" strokeOpacity="0.5" />
      </g>
      <Waves y={240} color="#ffffff" />
      <Birds x={160} y={70} />
    </>
  ),

  beach: (p, id) => (
    <>
      <rect y="150" width="400" height="80" fill={`url(#water${id})`} />
      <Waves y={162} color="#ffffff" n={5} />
      <path d="M0 214q100-22 200-6t200-8v100H0z" fill="#f4d9a6" />
      <path d="M0 238q120-16 230 0t170-6v68H0z" fill="#efcb8c" />
      <g transform="translate(250 176)">
        <rect x="-1.5" y="0" width="3" height="66" fill="#6b4f2a" />
        <path d="M-52 4q52-46 104 0z" fill="#ff6b6b" />
        <path d="M-35 4q35-46 0 0zM0 4q35-46 0 0" fill="#ffffff" opacity="0.9" />
        <path d="M17 4q20-30 35 0z" fill="#ffd166" opacity="0.9" />
      </g>
      <rect x="110" y="246" width="70" height="18" rx="3" fill="#4cc9f0" transform="rotate(-6 145 255)" />
      <rect x="110" y="250" width="70" height="4" fill="#ffffff" opacity="0.8" transform="rotate(-6 145 255)" />
      <g transform="translate(330 120)">
        <path d="M0 0q8 -18 2 -40" stroke="#5c4033" strokeWidth="3" fill="none" />
        <path d="M2 -40q-16 -2 -26 8M2 -40q14 -6 26 4M2 -40q-6 -12 -18 -14M2 -40q10 -12 22 -10" stroke="#2d6a4f" strokeWidth="5" strokeLinecap="round" fill="none" />
      </g>
    </>
  ),

  theatre: (p, id) => (
    <>
      <path d="M0 172q100-20 200-4t200 0v132H0z" fill={p.mid} />
      <Trees y={176} color={p.near} count={7} x0={0} x1={150} size={22} kind="round" seed={5} />
      <g transform="translate(200 120)">
        <rect x="0" y="22" width="150" height="48" fill="#f3e9dc" />
        <path d="M-8 24L18 0l18 18L56 -4l19 20L94 -4l20 22L132 0l26 24z" fill="#3f7d6b" />
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x={10 + i * 20} y="34" width="8" height="36" fill="#c9b79c" />
        ))}
      </g>
      <rect y="196" width="400" height="104" fill={`url(#water${id})`} />
      <g fill="#ffffff">
        <path d="M120 236q-12 0-14-12q8 6 14 2q4-14-4-18q-4 4-6 0q6-8 12 0q8 12-2 24q14 2 22-6q4 10-22 10z" />
        <path d="M206 254q-9 0-11-9q6 4 11 1q3-10-3-13q-3 3-4 0q4-6 9 0q6 9-2 18q10 1 16-4q3 7-16 7z" opacity="0.9" />
      </g>
      <Waves y={262} color="#ffffff" n={4} opacity={0.25} />
    </>
  ),

  forest: (p, id) => (
    <>
      <path d="M0 130q60-30 130-10t140-6 130 10v176H0z" fill={p.far} />
      <Trees y={176} count={22} size={20} kind="round" seed={13} colors={["#e2552c", "#f2a33a", "#c7362f", "#f5c84b", "#b5462a"]} />
      <Trees y={190} count={16} size={26} kind="pine" seed={9} colors={["#2d4a32", "#3b5d3a"]} />
      <rect y="196" width="400" height="104" fill={`url(#water${id})`} />
      <g transform="translate(160 236)">
        <path d="M0 0q50 14 100 0q-10 10-50 12Q10 10 0 0z" fill="#d62828" />
        <circle cx="52" cy="-10" r="5" fill="#2b2d42" />
        <path d="M52 -6v8" stroke="#2b2d42" strokeWidth="5" strokeLinecap="round" />
        <path d="M36 -16l34 26" stroke="#8d5524" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <Waves y={252} color="#ffffff" n={4} opacity={0.3} />
    </>
  ),

  ski: (p) => (
    <>
      <path d="M-10 230L90 80l70 90 60-110 90 120 60-70 60 120z" fill={p.mid} />
      <path d="M90 80l22 28-12-4-10 10-10-12-12 8zM220 60l26 36-14-6-12 12-12-14-14 10zM370 120l18 24-12-6-8 8z" fill="#ffffff" />
      <path d="M220 60l-40 70 30 20-40 70" stroke="#ffffff" strokeWidth="9" fill="none" strokeLinecap="round" opacity="0.85" />
      <path d="M60 120L330 40" stroke="#2b2d42" strokeWidth="1.2" />
      {Array.from({ length: 6 }, (_, i) => (
        <g key={i} transform={`translate(${86 + i * 44} ${112 - i * 13})`}>
          <path d="M0 0v8" stroke="#2b2d42" strokeWidth="1.2" />
          <rect x="-5" y="8" width="10" height="5" rx="1" fill="#e63946" />
        </g>
      ))}
      <path d="M0 236q200-30 400 0v64H0z" fill={p.near} />
      <Trees y={250} count={16} size={18} kind="pine" seed={6} colors={["#1d3b2a", "#28513a"]} />
      <g transform="translate(250 232)">
        <rect width="40" height="22" fill="#8c5a3c" />
        <path d="M-6 2L20-14 46 2z" fill="#ffffff" />
        <rect x="16" y="9" width="8" height="13" fill="#ffd166" />
      </g>
    </>
  ),

  chateau: (p, id) => (
    <>
      <path d="M0 196q80-60 180-62t220 30v136H0z" fill={p.mid} />
      <g transform="translate(150 70)" fill={p.near}>
        <rect x="20" y="50" width="120" height="80" />
        <rect x="58" y="10" width="40" height="70" />
        <path d="M54 12l24-34 24 34z" fill="#3e8e7e" />
        <path d="M14 52l13-24 13 24zM122 52l13-24 13 24zM38 52l10-18 10 18zM102 52l10-18 10 18z" fill="#3e8e7e" />
        {Array.from({ length: 5 }, (_, r) =>
          Array.from({ length: 8 }, (_, c) => <rect key={`${r}-${c}`} x={28 + c * 14} y={60 + r * 13} width="5" height="7" fill="#ffd98a" opacity="0.8" />),
        )}
      </g>
      <Skyline y={210} color={p.far} count={14} maxH={22} x0={0} x1={160} seed={31} windows="#ffd98a" />
      <rect y="210" width="400" height="90" fill={`url(#water${id})`} />
      <Waves y={236} color="#ffffff" n={5} opacity={0.25} />
    </>
  ),

  capital: (p, id) => (
    <>
      <path d="M0 190q100-40 200-30t200 20v120H0z" fill={p.mid} />
      <g transform="translate(110 70)" fill="#e9d8b8">
        <rect x="0" y="80" width="180" height="50" />
        <rect x="74" y="10" width="32" height="120" />
        <path d="M70 12L90-30 110 12z" fill="#3e8e7e" />
        <circle cx="90" cy="34" r="8" fill="#fff8e7" stroke="#8a6a3c" strokeWidth="1.5" />
        <path d="M-4 82L20 66l24 16zM136 82l24-16 24 16z" fill="#3e8e7e" />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d={`M${8 + i * 14.5} 128v-30q4-6 8 0v30z`} fill="#8a6a3c" opacity="0.55" />
        ))}
      </g>
      <rect y="200" width="400" height="100" fill={`url(#water${id})`} />
      <Trees y={204} color={p.near} count={10} x0={0} x1={110} size={14} kind="round" seed={41} />
      <Trees y={204} color={p.near} count={9} x0={300} x1={400} size={14} kind="round" seed={42} />
      <Waves y={228} color="#ffffff" n={5} opacity={0.25} />
    </>
  ),

  detroit: (p, id) => (
    <>
      <Skyline y={200} color={p.far} count={20} maxH={50} seed={51} windows="#ffd98a" />
      <g fill={p.mid}>
        <rect x="236" y="64" width="34" height="140" rx="15" />
        <rect x="214" y="104" width="22" height="100" rx="10" />
        <rect x="270" y="104" width="22" height="100" rx="10" />
        <rect x="200" y="124" width="18" height="80" rx="8" />
        <rect x="288" y="124" width="18" height="80" rx="8" />
      </g>
      <g fill="#ffd98a" opacity="0.8">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={242 + (i % 3) * 8} y={74 + Math.floor(i / 3) * 26} width="3" height="5" />
        ))}
      </g>
      <g stroke="#9db7ff" strokeWidth="2" fill="none" opacity="0.9">
        <path d="M0 160h12v50M70 160v50M12 162q29 30 58 0" />
        <path d="M0 196h120" />
      </g>
      <rect y="204" width="400" height="96" fill={`url(#water${id})`} />
      <g opacity="0.25" transform="matrix(1 0 0 -1 0 408)">
        <rect x="236" y="64" width="34" height="140" rx="15" fill={p.mid} />
      </g>
      <Waves y={232} color="#9db7ff" n={6} opacity={0.35} />
    </>
  ),

  bavarian: () => (
    <>
      <path d="M0 214q200-18 400 0v86H0z" fill="#f4f8fd" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${30 + i * 92} ${118 + (i % 2) * 14})`}>
          <rect x="0" y="34" width="74" height={62 - (i % 2) * 14} fill="#f6ead2" />
          <path d="M-8 38L37 -2l45 40z" fill="#7a3b2e" />
          <path d="M-8 38L37 -2l45 40" stroke="#ffffff" strokeWidth="6" fill="none" />
          <g stroke="#6b4226" strokeWidth="2.4">
            <path d="M0 52h74M24 34v62M50 34v62M0 34l24 18M74 34L50 52" />
          </g>
          <rect x="30" y={68 - (i % 2) * 14} width="14" height="28" fill="#6b4226" />
          <rect x="6" y="58" width="12" height="10" fill="#ffd166" />
          <rect x="56" y="58" width="12" height="10" fill="#ffd166" />
        </g>
      ))}
      <path d="M0 110q50 14 100 0t100 0 100 0 100 0" stroke="#2b2d42" strokeWidth="1" fill="none" />
      {Array.from({ length: 24 }, (_, i) => (
        <circle key={i} cx={8 + i * 16.5} cy={113 + Math.sin(i / 1.6) * 6} r="2.6" fill={["#ff6b6b", "#ffd166", "#06d6a0", "#4cc9f0"][i % 4]} />
      ))}
      <g fill="#ffffff" opacity="0.9">
        {Array.from({ length: 30 }, (_, i) => (
          <circle key={i} cx={(i * 53) % 400} cy={(i * 37) % 120} r={1 + (i % 3) * 0.6} />
        ))}
      </g>
    </>
  ),

  cliffs: (p, id) => (
    <>
      <rect y="150" width="400" height="150" fill={`url(#water${id})`} />
      <path d="M0 90q40-10 90 6l20 40-10 60 20 104H0z" fill="#ece6d4" />
      <path d="M0 90q40-10 90 6l8 18q-40-10-98-6z" fill={p.near} />
      <Trees y={100} color={p.near} count={6} x0={0} x1={90} size={12} kind="pine" seed={61} />
      <g transform="translate(250 120)">
        <path d="M12 96q-6-40 2-60-14-4-12-18 18-10 40-4 4 14-8 22 8 26 2 60z" fill="#e7dcc0" />
        <Trees y={18} color={p.near} count={4} x0={6} x1={46} size={10} kind="pine" seed={62} />
      </g>
      <Waves y={196} color="#ffffff" n={6} opacity={0.4} />
      <g transform="translate(140 238) rotate(-4)">
        <path d="M0 0q40 10 80 0q-6 8-40 9Q6 9 0 0z" fill="#ffd166" />
        <circle cx="40" cy="-7" r="4.5" fill="#2b2d42" />
        <path d="M20 -16l40 22" stroke="#2b2d42" strokeWidth="2" />
      </g>
    </>
  ),

  marsh: (p, id) => (
    <>
      <rect y="168" width="400" height="132" fill={`url(#water${id})`} />
      <path d="M0 190q80-14 150 0t120-4 130 8v106H0z" fill="#b7a35c" />
      <g stroke="#7d6b2f" strokeWidth="1.6" opacity="0.8">
        {Array.from({ length: 70 }, (_, i) => (
          <path key={i} d={`M${(i * 5.9) % 400} ${210 + (i % 5) * 16}v-${10 + (i % 4) * 5}`} />
        ))}
      </g>
      <path d="M40 300l60-40 80 20 70-34 60 14" stroke="#8b5a2b" strokeWidth="9" fill="none" strokeLinejoin="round" />
      <path d="M40 300l60-40 80 20 70-34 60 14" stroke="#c08552" strokeWidth="5" fill="none" strokeLinejoin="round" />
      <Birds x={60} y={60} n={5} />
      <Birds x={250} y={90} n={3} />
      <g transform="translate(300 130) rotate(-12)">
        <path d="M0 0q-14 -14 -18 2q8 8 18 -2q14 -14 18 2q-8 8 -18 -2" fill="#f28c28" stroke="#2b2d42" strokeWidth="1" />
      </g>
    </>
  ),

  stadium: (p) => (
    <>
      <g fill="#ffffff" opacity="0.18">
        <path d="M60 40l40 120H20zM340 40l40 120h-80z" />
      </g>
      <g fill={p.far}>
        <rect x="56" y="34" width="8" height="120" />
        <rect x="336" y="34" width="8" height="120" />
        <rect x="40" y="26" width="40" height="14" rx="2" fill="#fff6d6" />
        <rect x="320" y="26" width="40" height="14" rx="2" fill="#fff6d6" />
      </g>
      <path d="M0 150q200-60 400 0v40H0z" fill={p.mid} />
      <g fill="#ffffff" opacity="0.35">
        {Array.from({ length: 90 }, (_, i) => (
          <circle key={i} cx={(i * 9.3) % 400} cy={152 + ((i * 7) % 26) - Math.abs(200 - ((i * 9.3) % 400)) / 14} r="1.3" />
        ))}
      </g>
      <path d="M0 190h400v110H0z" fill="#2f8f4e" />
      <path d="M200 300L120 214h160z" fill="#c88a4a" />
      <path d="M200 236l20 20-20 20-20-20z" fill="#3fa65f" />
      <path d="M0 190h400" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" />
    </>
  ),

  basilica: (p, id) => (
    <>
      <Skyline y={206} color={p.far} count={16} maxH={40} seed={71} windows="#ffd98a" />
      <g transform="translate(150 50)" fill={p.near}>
        <rect x="0" y="40" width="30" height="120" />
        <rect x="70" y="40" width="30" height="120" />
        <path d="M-2 42L15 0l17 42zM68 42L85 0l17 42z" />
        <rect x="26" y="90" width="48" height="70" />
        <path d="M40 160v-34q10-14 20 0v34z" fill="#ffd98a" opacity="0.7" />
        <circle cx="50" cy="104" r="8" fill="#ffd98a" opacity="0.7" />
      </g>
      <rect y="210" width="400" height="90" fill={`url(#water${id})`} />
      <g stroke="#bcd0ff" strokeWidth="2" fill="none" opacity="0.7">
        <path d="M260 186h140M280 186v24M330 186v24M380 186v24M270 186q30-24 50 0t50 0 30 0" />
      </g>
      <Waves y={236} color="#ffffff" n={5} opacity={0.25} />
    </>
  ),

  coaster: (p) => (
    <>
      <path d="M-10 230L60 120l50 60 40-70 60 120z" fill={p.far} />
      <path d="M40 160l14-20 10 14-8-2-6 8z" fill="#ffffff" opacity="0.9" />
      <g transform="translate(300 130)">
        <circle r="62" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.9" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <g key={i}>
              <path d={`M0 0L${Math.cos(a) * 62} ${Math.sin(a) * 62}`} stroke="#ffffff" strokeWidth="1.2" opacity="0.6" />
              <rect x={Math.cos(a) * 62 - 5} y={Math.sin(a) * 62 - 4} width="10" height="8" rx="2" fill={["#ff6b6b", "#ffd166", "#4cc9f0"][i % 3]} />
            </g>
          );
        })}
        <path d="M-30 100L0 0l30 100" stroke="#ffffff" strokeWidth="3" fill="none" />
      </g>
      <g stroke="#e63946" strokeWidth="5" fill="none" strokeLinecap="round">
        <path d="M-10 200q40-150 90-40t90-60 70 80 60-30 120 60" />
      </g>
      <g stroke="#ffffff" strokeWidth="1.4" opacity="0.6">
        {Array.from({ length: 22 }, (_, i) => (
          <path key={i} d={`M${i * 19} 300V${150 + Math.abs(Math.sin(i / 2.2)) * 60}`} />
        ))}
      </g>
      <path d="M0 250q200-24 400 0v50H0z" fill={p.near} />
      <Trees y={262} count={14} size={14} kind="round" seed={91} colors={["#2d6a4f", "#40916c"]} />
    </>
  ),

  bean: (p, id) => (
    <>
      <Skyline y={180} color={p.far} count={20} maxH={70} seed={81} windows="#ffd98a" />
      <g fill={p.mid}>
        <rect x="290" y="30" width="34" height="152" />
        <rect x="298" y="12" width="3" height="20" />
        <rect x="313" y="12" width="3" height="20" />
        <rect x="80" y="60" width="26" height="122" />
      </g>
      <rect y="180" width="400" height="120" fill="#cfd6e2" />
      <path d="M0 180h400" stroke="#ffffff" strokeOpacity="0.6" />
      <g>
        <path d="M110 250q-20-48 40-56 50-8 100 0 60 8 40 56-10 16-36 6-54-14-108 0-26 10-36-6z" fill={`url(#chrome${id})`} />
        <ellipse cx="200" cy="258" rx="80" ry="7" fill="#000" opacity="0.15" />
      </g>
    </>
  ),
};

export const SCENE_NAMES = Object.keys(SCENES);

export default function PosterArt({ scene = "falls", palette = "sunset", className = "", label }) {
  const raw = useId().replace(/:/g, "");
  const p = PALETTES[palette] || PALETTES.sunset;
  const draw = SCENES[scene] || SCENES.falls;
  const night = palette === "night" || palette === "dusk";
  return (
    <svg
      className={`poster ${className}`}
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={`sky${raw}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.55" stopColor={p.sky[1]} />
          <stop offset="1" stopColor={p.sky[2]} />
        </linearGradient>
        <linearGradient id={`water${raw}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.water[0]} />
          <stop offset="1" stopColor={p.water[1]} />
        </linearGradient>
        <linearGradient id={`fallw${raw}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8f6ff" />
          <stop offset="1" stopColor="#9fd3f2" />
        </linearGradient>
        <linearGradient id={`chrome${raw}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5f7fa" />
          <stop offset="0.4" stopColor="#9aa7b8" />
          <stop offset="0.6" stopColor="#e9eef5" />
          <stop offset="1" stopColor="#7c8899" />
        </linearGradient>
        <radialGradient id={`sun${raw}`}>
          <stop offset="0" stopColor={p.sun} stopOpacity="0.95" />
          <stop offset="0.45" stopColor={p.sun} stopOpacity="0.35" />
          <stop offset="1" stopColor={p.sun} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#sky${raw})`} />
      {night && (
        <g fill="#ffffff">
          {Array.from({ length: 40 }, (_, i) => (
            <circle key={i} cx={(i * 97) % 400} cy={(i * 41) % 130} r={(i % 3) * 0.45 + 0.4} opacity={0.4 + (i % 4) * 0.15} />
          ))}
        </g>
      )}
      <circle cx="300" cy="86" r="70" fill={`url(#sun${raw})`} />
      <circle cx="300" cy="86" r="24" fill={p.sun} />
      {draw(p, raw)}
    </svg>
  );
}
