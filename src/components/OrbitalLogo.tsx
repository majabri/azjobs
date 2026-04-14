/**
 * OrbitalLogo â The iCareerOS orbital icon.
 * A filled circle core with a solid mid-ring, dashed outer ring,
 * and 4 orbit nodes at cardinal points.
 * Automatically adapts to the current theme via CSS variables.
 */

interface OrbitalLogoProps {
  size?: number;
  className?: string;
}

export default function OrbitalLogo({ size = 32, className = "" }: OrbitalLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-label="iCareerOS logo"
      role="img"
    >
      {/* Dashed outer ring */}
      <circle
        cx="32" cy="32" r="29"
        fill="none"
        stroke="var(--brand, #3B5BDB)"
        strokeWidth="1.5"
        strokeDasharray="6 4"
        opacity="0.5"
      />
      {/* Solid mid ring */}
      <circle
        cx="32" cy="32" r="21"
        fill="none"
        stroke="var(--brand, #3B5BDB)"
        strokeWidth="2"
        opacity="0.7"
      />
      {/* Core filled circle */}
      <circle cx="32" cy="32" r="10" fill="var(--brand, #3B5BDB)" />
      {/* Orbit nodes at cardinal points */}
      <circle cx="32" cy="3"  r="3" fill="var(--brand, #3B5BDB)" />
      <circle cx="61" cy="32" r="3" fill="var(--brand, #3B5BDB)" />
      <circle cx="32" cy="61" r="3" fill="var(--brand, #3B5BDB)" />
      <circle cx="3"  cy="32" r="3" fill="var(--brand, #3B5BDB)" />
    </svg>
  );
}
