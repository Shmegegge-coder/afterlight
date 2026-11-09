// Stylised glowing wings + soul light, drawn as fanned feather ellipses.
export default function Wings({ className = "" }: { className?: string }) {
  const feathers = Array.from({ length: 9 }, (_, i) => i);
  const wing = (side: 1 | -1) =>
    feathers.map((i) => {
      const angle = side * (-82 + i * 11);
      const ry = 120 - i * 9;
      return (
        <ellipse
          key={`${side}-${i}`}
          cx={200 + side * 22}
          cy={200 - ry}
          rx={15 - i * 0.6}
          ry={ry}
          transform={`rotate(${angle} ${200 + side * 22} 200)`}
          fill="url(#feather)"
          opacity={0.55 + i * 0.04}
        />
      );
    });
  return (
    <svg viewBox="0 0 400 320" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="feather" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="60%" stopColor="#FEF3C7" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.15" />
        </linearGradient>
        <radialGradient id="soul" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#FDE68A" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
        <filter id="wing-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#wing-glow)">
        {wing(-1)}
        {wing(1)}
        <circle cx="200" cy="205" r="42" fill="url(#soul)" />
      </g>
    </svg>
  );
}
