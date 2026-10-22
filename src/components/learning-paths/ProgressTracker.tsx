import { useLearningProgress } from "../../hooks/useLearningProgress";

export default function ProgressTracker({
  pathId,
  totalLessons,
}: Readonly<{
  pathId: string;
  totalLessons?: number;
}>) {
  const { completed } = useLearningProgress(pathId);
  const pct =
    totalLessons && totalLessons > 0
      ? Math.round((completed.length / totalLessons) * 100)
      : 0;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <div className="text-sm text-gray-700">
          Progress: {completed.length}
          {totalLessons ? ` / ${totalLessons}` : ""}
        </div>
        {totalLessons ? <div className="text-xs text-muted">{pct}%</div> : null}
      </div>
    </div>
  );
}
