export const MASTERY_FORMULA_VERSION = "mastery-v1-weighted-recent-8";

export type MasteryEvidence = {
  score: number;
  maximumScore: number;
  difficulty: number;
};

export function deriveMasterySignal(evidence: MasteryEvidence[]): number {
  const recent = evidence.slice(0, 8);
  if (recent.length === 0) return 0;
  let weightedScore = 0;
  let totalWeight = 0;
  recent.forEach((item, index) => {
    const normalized = clamp(item.score / Math.max(item.maximumScore, 0.0001));
    const difficultyWeight = 0.75 + clamp(item.difficulty) * 0.5;
    const recencyWeight = 1 / (1 + index * 0.15);
    const weight = difficultyWeight * recencyWeight;
    weightedScore += normalized * weight;
    totalWeight += weight;
  });
  return Number((weightedScore / totalWeight).toFixed(4));
}

export type RecommendationCandidate = {
  id: string;
  name: string;
  position: number;
  completed: boolean;
  mastery: number | null;
  lastStudiedAt: Date | null;
  plannedFor: string | null;
};

export type TopicRecommendation = RecommendationCandidate & {
  reason: string;
};

export function recommendNextTopic(
  candidates: RecommendationCandidate[],
  targetDate: string | null,
  now = new Date(),
): TopicRecommendation | null {
  if (candidates.length === 0) return null;
  const today = now.toISOString().slice(0, 10);
  const targetDays = targetDate ? daysBetween(today, targetDate) : null;
  const deadlinePressure = targetDays !== null && targetDays <= 14;

  const ranked = candidates
    .map((candidate) => {
      const plannedDays = candidate.plannedFor
        ? daysBetween(today, candidate.plannedFor)
        : null;
      const schedulePriority =
        plannedDays === null
          ? 0
          : plannedDays < 0
            ? 4
            : plannedDays === 0
              ? 3.5
              : plannedDays <= 3
                ? 2
                : 0;
      const masteryNeed =
        candidate.mastery === null ? 0.8 : 1 - candidate.mastery;
      const uncompletedPriority = candidate.completed ? 0 : 0.8;
      const neverStudiedPriority = candidate.lastStudiedAt === null ? 0.4 : 0;
      const deadlineSequencePriority = deadlinePressure
        ? 0.5 / (1 + Math.max(candidate.position, 0))
        : 0;
      return {
        candidate,
        score:
          schedulePriority +
          masteryNeed +
          uncompletedPriority +
          neverStudiedPriority +
          deadlineSequencePriority,
        schedulePriority,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.candidate.position - b.candidate.position ||
        a.candidate.name.localeCompare(b.candidate.name),
    );
  const selected = ranked[0];
  let reason = "This topic has the greatest current mastery need.";
  if (selected.schedulePriority >= 3.5) {
    reason =
      selected.candidate.plannedFor! < today
        ? "This topic is overdue on your study schedule."
        : "This topic is due on your study schedule today.";
  } else if (selected.schedulePriority > 0) {
    reason = "This topic is coming up soon on your study schedule.";
  } else if (selected.candidate.mastery === null) {
    reason = "There is no system assessment evidence for this topic yet.";
  } else if (deadlinePressure) {
    reason =
      "Your target date is approaching, so the next unfinished topic is prioritized.";
  }
  return { ...selected.candidate, reason };
}

function daysBetween(from: string, to: string): number {
  return Math.floor(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
