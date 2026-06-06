interface Props {
  value: number;
  max: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  showSegments?: boolean;
}

export function ProgressBar({ value, max, color = '#1e3a8a', size = 'md', showSegments = false }: Props) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const rawPct = max > 0 ? (value / max) * 100 : 0;
  const isOver = value > max;
  const isWarning = !isOver && rawPct >= 75;

  const barColor = isOver ? '#ef4444' : isWarning ? '#f59e0b' : color;
  const height = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3.5' : 'h-2.5';

  return (
    <div className={`w-full bg-gray-100 dark:bg-gray-800 rounded-full ${height} overflow-hidden relative`}>
      {showSegments && max > 0 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-300/70 dark:bg-amber-600/50 z-10"
          style={{ left: '75%' }}
        />
      )}
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${isOver ? 'opacity-90' : ''}`}
        style={{ width: `${pct}%`, backgroundColor: barColor }}
      />
    </div>
  );
}
