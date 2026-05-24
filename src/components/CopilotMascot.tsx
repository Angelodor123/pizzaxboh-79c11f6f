// Johnny — Pizza X operations manager avatar.
// Head-only stylized vector character with a modern chef's cap and an
// operations headset. Dark base, neon-pink + electric-green accents to
// match the Urban Jungle theme.
export function CopilotMascot({
  className,
  title = "Johnny — Pizza X",
  glow = false,
}: {
  className?: string;
  title?: string;
  glow?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="jx-bg" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#1f1f24" />
          <stop offset="100%" stopColor="#08080a" />
        </radialGradient>
        <linearGradient id="jx-cap" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fafafa" />
          <stop offset="100%" stopColor="#c7c7cc" />
        </linearGradient>
        <linearGradient id="jx-skin" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3a3a40" />
          <stop offset="100%" stopColor="#1f1f24" />
        </linearGradient>
        <linearGradient id="jx-pink" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff3d8a" />
          <stop offset="100%" stopColor="#e6007a" />
        </linearGradient>
        <filter id="jx-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation={glow ? "1.6" : "0.6"} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dark base */}
      <circle cx="32" cy="32" r="30" fill="url(#jx-bg)" stroke="#2a2a30" strokeWidth="1.5" />

      {/* Chef cap puff */}
      <g filter="url(#jx-glow)">
        <ellipse cx="22" cy="18" rx="7" ry="6" fill="url(#jx-cap)" />
        <ellipse cx="32" cy="14" rx="8" ry="7" fill="url(#jx-cap)" />
        <ellipse cx="42" cy="18" rx="7" ry="6" fill="url(#jx-cap)" />
        {/* Cap band with electric green accent */}
        <rect x="17" y="22" width="30" height="5" rx="1.5" fill="#0f0f12" stroke="#39ff88" strokeWidth="0.8" />
        <line x1="20" y1="24.5" x2="44" y2="24.5" stroke="#39ff88" strokeOpacity="0.7" strokeWidth="0.6" strokeDasharray="1.5 1.5" />
      </g>

      {/* Face */}
      <g>
        <path
          d="M19 30 Q19 44 32 49 Q45 44 45 30 Z"
          fill="url(#jx-skin)"
          stroke="#0a0a0a"
          strokeWidth="0.8"
        />
        {/* Brow line */}
        <path d="M22 32 Q26 30 30 32" stroke="#fafafa" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        <path d="M34 32 Q38 30 42 32" stroke="#fafafa" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        {/* Eyes */}
        <circle cx="26" cy="35" r="1.7" fill="#fafafa" />
        <circle cx="38" cy="35" r="1.7" fill="#fafafa" />
        <circle cx="26.4" cy="35.2" r="0.8" fill="#0a0a0a" />
        <circle cx="38.4" cy="35.2" r="0.8" fill="#0a0a0a" />
        {/* Confident smile */}
        <path d="M27 42 Q32 45 37 42" stroke="#fafafa" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>

      {/* Headset band */}
      <g filter="url(#jx-glow)">
        <path
          d="M16 30 Q16 18 32 18 Q48 18 48 30"
          stroke="#0f0f12"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M16 30 Q16 18 32 18 Q48 18 48 30"
          stroke="#39ff88"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />
        {/* Ear cups */}
        <rect x="13" y="29" width="6" height="9" rx="2" fill="#0f0f12" stroke="#39ff88" strokeWidth="0.7" />
        <rect x="45" y="29" width="6" height="9" rx="2" fill="#0f0f12" stroke="url(#jx-pink)" strokeWidth="0.9" />
        <circle cx="48" cy="33.5" r="1" fill="url(#jx-pink)" />
        {/* Mic boom */}
        <path d="M45 36 Q38 44 33 46" stroke="#0f0f12" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M45 36 Q38 44 33 46" stroke="#39ff88" strokeWidth="0.7" fill="none" strokeLinecap="round" strokeOpacity="0.8" />
        <circle cx="32.5" cy="46.4" r="1.8" fill="url(#jx-pink)" />
      </g>

      {/* Outer glow ring */}
      <circle
        cx="32"
        cy="32"
        r="29"
        fill="none"
        stroke={glow ? "#39ff88" : "url(#jx-pink)"}
        strokeOpacity={glow ? 0.9 : 0.45}
        strokeWidth={glow ? 1.4 : 0.8}
      />
    </svg>
  );
}
