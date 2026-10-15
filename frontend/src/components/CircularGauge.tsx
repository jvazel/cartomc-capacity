import React from 'react';

interface CircularGaugeProps {
  value: number; // 0 to 100+
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  unit?: string;
  max?: number;
}

export const CircularGauge: React.FC<CircularGaugeProps> = ({
  value,
  size = 62,
  strokeWidth = 5.5,
  color,
  label,
  unit = '%',
  max = 100
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedValue = Math.min(Math.max(0, value), max);
  const strokeDashoffset = circumference - (clampedValue / max) * circumference;

  // Auto-color if not provided
  const resolvedColor =
    color ||
    (value > 100
      ? '#ef4444' // Rouge critique
      : value >= 90
      ? '#f59e0b' // Ambre / Orange
      : '#10b981'); // Vert succès

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Value circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease',
            filter: `drop-shadow(0 0 6px ${resolvedColor}66)`
          }}
        />
      </svg>
      {/* Label central */}
      <div
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: size < 55 ? '0.75rem' : '0.85rem',
            fontWeight: 800,
            color: '#f8fafc'
          }}
        >
          {label !== undefined ? label : `${Math.round(value)}${unit}`}
        </span>
      </div>
    </div>
  );
};
