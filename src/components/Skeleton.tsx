function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-gray-800 rounded-xl ${className}`} />;
}

export function StatCardSkeleton() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between">
        <Pulse className="w-10 h-10 rounded-xl" />
        <Pulse className="w-14 h-5 rounded-full" />
      </div>
      <Pulse className="w-28 h-7" />
      <Pulse className="w-20 h-4" />
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      <div className="flex items-end gap-2" style={{ height }}>
        {[60, 80, 45, 90, 55, 70, 40, 85, 65, 75, 50, 95].map((h, i) => (
          <div
            key={i}
            className="flex-1 bg-gray-200 dark:bg-gray-800 rounded-t-lg"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <div className="flex gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-3 bg-gray-200 dark:bg-gray-800 rounded flex-1" />
        ))}
      </div>
    </div>
  );
}

export function TransactionRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2.5 animate-pulse">
      <Pulse className="w-9 h-9 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Pulse className="h-3.5 w-36 rounded-lg" />
        <Pulse className="h-3 w-24 rounded-lg" />
      </div>
      <Pulse className="h-4 w-16 rounded-lg flex-shrink-0" />
    </div>
  );
}

export function BudgetRowSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="flex justify-between">
        <Pulse className="h-3.5 w-24 rounded-lg" />
        <Pulse className="h-3.5 w-20 rounded-lg" />
      </div>
      <Pulse className="h-2 w-full rounded-full" />
    </div>
  );
}

export function DonutSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 animate-pulse">
      <div className="relative w-36 h-36">
        <div className="absolute inset-0 rounded-full bg-gray-200 dark:bg-gray-800" />
        <div className="absolute inset-6 rounded-full bg-white dark:bg-gray-900" />
      </div>
      <div className="space-y-2 w-full">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-800 flex-shrink-0" />
            <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded-lg flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
