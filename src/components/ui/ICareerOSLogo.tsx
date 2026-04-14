import React from 'react';

interface ICareerOSLogoProps {
  size?: number;
  className?: string;
}

/**
 * iCareerOS orbital logo — RGB three-ring design
 *
 * Ring meanings:
 *   Red   (outer, dashed) — Discovery: jobs being found and surfaced
 *   Green (mid,   solid)  — Matching:  fit scored and confirmed
 *   Blue  (inner, dashed) — Apply:     submissions in flight
 *
 * Core: deep navy with green person silhouette — you are at the centre,
 *       the AI orbits around you
 */
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
      {/* ── Outer ring: RED — Discovery (dashed, always scanning) ── */}
      <ellipse
        cx="22" cy="22" rx="19" ry="19"
        stroke="#EF4444" strokeWidth="1"
        strokeDasharray="4 3" opacity="0.6"
      />

      {/* ── Mid ring: GREEN — Matching (solid, confirmed fit) ── */}
      <ellipse
        cx="22" cy="22" rx="14" ry="14"
        stroke="#22C55E" strokeWidth="2"
      />

      {/* ── Inner ring: BLUE — Apply (dashed, in flight) ── */}
      <ellipse
        cx="22" cy="22" rx="8" ry="8"
        stroke="#3B82F6" strokeWidth="1"
        strokeDasharray="2.5 2" opacity="0.85"
      />

      {/* ── Core ── */}
      <circle cx="22" cy="22" r="5.5" fill="#1E2340" />
      <circle cx="22" cy="22" r="5"   fill="#2D3A5E" />

      {/* ── Person silhouette — you are at the centre ── */}
      {/* Head */}
      <circle cx="22" cy="19.5" r="1.8" fill="#22C55E" />
      {/* Shoulders */}
      <path
        d="M18.5 25.5 C18.5 23 19.5 22 22 22 C24.5 22 25.5 23 25.5 25.5"
        fill="#22C55E"
      />

      {/* ── RED nodes — cardinal points on outer ring ── */}
      <circle cx="22" cy="3"  r="2.5" fill="#EF4444" />
      <circle cx="41" cy="22" r="2.5" fill="#EF4444" />
      <circle cx="22" cy="41" r="2"   fill="#EF4444" opacity="0.7" />
      <circle cx="3"  cy="22" r="2"   fill="#EF4444" opacity="0.7" />

      {/* ── GREEN nodes — diagonal on mid ring ── */}
      <circle cx="32" cy="12" r="2"   fill="#22C55E" />
      <circle cx="12" cy="32" r="1.8" fill="#22C55E" opacity="0.75" />
      <circle cx="32" cy="32" r="1.5" fill="#22C55E" opacity="0.55" />
      <circle cx="12" cy="12" r="1.5" fill="#22C55E" opacity="0.45" />

      {/* ── BLUE nodes — inner ring ── */}
      <circle cx="22" cy="14" r="1.8" fill="#3B82F6" />
      <circle cx="30" cy="22" r="1.8" fill="#3B82F6" />
      <circle cx="14" cy="22" r="1.4" fill="#3B82F6" opacity="0.7" />
      <circle cx="22" cy="30" r="1.4" fill="#3B82F6" opacity="0.7" />
    </svg>
  );
}
