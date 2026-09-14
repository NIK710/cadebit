import { notFound } from "next/navigation";

import { getAdaptiveStudyView } from "@/lib/db/adaptive-study";
import { requireSession } from "@/lib/session";

import { AdaptiveStudyFlow } from "./study-flow";

export default async function AdaptiveStudyPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const [{ courseId }, session] = await Promise.all([params, requireSession()]);
  const view = await getAdaptiveStudyView(session.userId, courseId);
  if (!view) notFound();
  return <AdaptiveStudyFlow initialView={view} />;
}
