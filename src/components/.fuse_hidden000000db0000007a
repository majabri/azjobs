import { useState, useEffect, useRef } from "react";

interface AnimatedBarProps {
  value: number; // 0–100
  className?: string;
  height?: string;
}

export function AnimatedBar({ value, className = "", height = "h-2.5" }: AnimatedBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), 120);
    return () => clearTimeout(timer);
  }, [value]);

  const colorClass =
    value >= 70 ? "score-bar-high" : value >= 40 ? "score-bar-mid" : "score-bar-low";

  return (
    <div className={`w-full bg-secondary rounded-full overflow-hidden ${height}`}>
      <div
        className={`${height} rounded-full transition-all duration-1000 ease-out ${colorClass} ${className}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

interface ScoreRingProps {
  score: number;
  size?: number;
}

export function ScoreRing({ score, size = 140 }: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const circumference = 2 * Math.PI * 50;
  const offset = circumference - (displayScore / 100) * circumference;

  const color =
    score >= 70 ? "#2dd4a8" : score >= 40 ? "#f59e0b" : "#ef4444";

  const label =
    score >= 80 ? "Strong Fit" : score >= 60 ? "Good Fit" : score >= 40 ? "Partial Fit" : "Low Fit";

  useEffect(() => {
    const timer = setTimeout(() => {
      let start = 0;
      const step = () => {
        start += 2;
        if (start <= score) {
          setDisplayScore(start);
          requestAnimationFrame(step);
        } else {
          setDisplayScore(score);
        }
      };
      requestAnimationFrame(step);
    }, 300);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(220 15% 90%)" strokeWidth="10" />
        <circle
          cx="60" cy="60" r="50"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-display font-bold" style={{ color }}>{displayScore}%</span>
      </div>
      <div className="text-center -mt-2">
        <div className="text-3xl font-display font-bold" style={{ color }}>{displayScore}%</div>
        <div className="text-sm font-semibold mt-0.5" style={{ color }}>{label}</div>
      </div>
    </div>
  );
}

// Re-export ScoreRing with the ring rendered inline (not using SVG absolute)
export function ScoreRingInline({ score, size = 140 }: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(0);
  const circumference = 2 * Math.PI * 50;
  const offset = circumference - (displayScore / 100) * circumference;

  const color =
    score >= 70 ? "#2dd4a8" : score >= 40 ? "#f59e0b" : "#ef4444";
  const bgColor =
    score >= 70 ? "hsl(172 70% 95%)" : score >= 40 ? "hsl(38 92% 95%)" : "hsl(4 86% 95%)";

  const label =
    score >= 80 ? "Strong Fit" : score >= 60 ? "Good Fit" : score >= 40 ? "Partial Fit" : "Low Fit";

  useEffect(() => {
    const timer = setTimeout(() => {
      let start = 0;
      const step = () => {
        start += 2;
        if (start <= score) {
          setDisplayScore(start);
          requestAnimationFrame(step);
        } else {
          setDisplayScore(score);
        }
      };
      requestAnimationFrame(step);
    }, 300);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 120 120" className="-rotate-90">
          <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(220 15% 90%)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="50"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-display font-bold leading-none" style={{ color }}>{displayScore}%</span>
          <span className="text-xs font-semibold mt-1" style={{ color }}>{label}</span>
        </div>
      </div>
    </div>
  );
}
