// Pizza X Copilot Mascot — abstract 'X' from two crossing pizza peels with
// glowing tomato red, molten cheese orange, and basil green accents on a
// dark base. Pure SVG for crisp rendering at any size.
export function CopilotMascot({
  className,
  title = "Pizza X Copilot",
}: {
  className?: string;
  title?: string;
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
        <radialGradient id="pxc-bg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#1a0e0a" />
          <stop offset="100%" stopColor="#070302" />
        </radialGradient>
        <linearGradient id="pxc-tomato" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff5a3c" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
        <linearGradient id="pxc-cheese" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffb347" />
          <stop offset="100%" stopColor="#e8731c" />
        </linearGradient>
        <filter id="pxc-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dark token base */}
      <circle cx="32" cy="32" r="30" fill="url(#pxc-bg)" stroke="#2a1410" strokeWidth="1.5" />

      {/* Crossed pizza peels forming the X (back layer = cheese orange, front = tomato red) */}
      <g filter="url(#pxc-glow)">
        {/* Peel 1 (\) — handle + paddle */}
        <g transform="rotate(45 32 32)">
          <rect x="30" y="6" width="4" height="30" rx="2" fill="url(#pxc-cheese)" />
          <ellipse cx="32" cy="44" rx="11" ry="8" fill="url(#pxc-cheese)" />
        </g>
        {/* Peel 2 (/) */}
        <g transform="rotate(-45 32 32)">
          <rect x="30" y="6" width="4" height="30" rx="2" fill="url(#pxc-tomato)" />
          <ellipse cx="32" cy="44" rx="11" ry="8" fill="url(#pxc-tomato)" />
        </g>
      </g>

      {/* Central pizza slice token */}
      <g filter="url(#pxc-glow)">
        <polygon
          points="32,22 42,40 22,40"
          fill="#ffcf5c"
          stroke="#8a4a0e"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* Basil green accents (toppings) */}
        <circle cx="30" cy="34" r="1.6" fill="#4ade80" />
        <circle cx="35" cy="36" r="1.4" fill="#22c55e" />
        <circle cx="32" cy="30" r="1.2" fill="#86efac" />
        {/* Tomato accent */}
        <circle cx="33.5" cy="33.5" r="1.2" fill="#ef4444" />
      </g>

      {/* Outer glow ring */}
      <circle
        cx="32"
        cy="32"
        r="29"
        fill="none"
        stroke="#ff5a3c"
        strokeOpacity="0.35"
        strokeWidth="0.8"
      />
    </svg>
  );
}
