import React from 'react';

interface ICareerOSLogoProps {
  size?: number;
  className?: string;
}

export function ICareerOSLogo({ size = 32, className }: ICareerOSLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="iCareerOS logo"
    >
      {/* Outermost dashed orbit ring */}
      <ellipse
        cx="22" cy="22" rx="19" ry="19"
        stroke="#748FFC" strokeWidth="0.8"
        strokeDasharray="3 2.5" opacity="0.5"
      />
      {/* Main solid orbit ring — uses CSS variable so it adapts to theme */}
      <ellipse
        cx="22" cy="22" rx="14" ry="14"
        stroke="hsl(var(--primary))" strokeWidth="2"
      />
      {/* Inner dashed orbit */}
      <ellipse
        cx="22" cy="22" rx="8" ry="8"
        stroke="#748FFC" strokeWidth="1"
        strokeDasharray="2.5 2" opacity="0.7"
      />
      {/* Core circle */}
      <circle cx="22" cy="22" r="5" fill="hsl(var(--primary))" />
      {/* Upward arrow inside core */}
      <path
        d="M22 25 L22 19"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="1.5" strokeLinecap="round"
      />
      <path
        d="M19.5 21.5 L22 19 L24.5 21.5"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
      {/* Orbit nodes — opportunities being surfaced */}
      <circle cx="22" cy="8"  r="2.5" fill="hsl(var(--primary))" />
      <circle cx="36" cy="22" r="2.5" fill="hsl(var(--primary))" />
      <circle cx="22" cy="36" r="2"   fill="#4DABF7" opacity="0.8" />
      <circle cx="8"  cy="22" r="2"   fill="#4DABF7" opacity="0.8" />
      <circle cx="33" cy="11" r="1.5" fill="#4DABF7" />
      <circle cx="11" cy="33" r="1.2" fill="#4DABF7" opacity="0.7" />
    </svg>
  );
}
