import { eventNameZh, unitLabelZh } from "@/lib/results/eventNames";
import { stageLabel, type ResultHighlight, type SportSummary } from "@/lib/results/highlights";
import { ResultBadge } from "./ResultBadge";
import { displayTpe, formatResultTime } from "./resultDisplay";

/** 一行成果摘要（獎牌、勝負、進行中／待賽）；showStages 時沒有下一場才顯示已賽階段。 */
export function SportHighlights({ summary, period = false, showStages = false }: { summary: SportSummary; period?: boolean; showStages?: boolean }) {
  const badges: ResultHighlight[] = [];
  for (const [key, label] of [["gold", "金牌"], ["silver", "銀牌"], ["bronze", "銅牌"]] as const) {
    if (summary.medals[key]) badges.push({ tone: key, label: `${label} ${summary.medals[key]}` });
  }
  if (summary.wins) badges.push({ tone: "win", label: `${summary.wins} 勝` });
  if (summary.losses) badges.push({ tone: "loss", label: `${summary.losses} 負` });
  if (summary.draws) badges.push({ tone: "draw", label: `${summary.draws} 平` });
  if (summary.bestRank !== null && !Object.values(summary.medals).some(Boolean)) badges.push({ tone: "rank", label: `最佳最終名次 第 ${summary.bestRank} 名` });
  const featured = summary.featured;
  const stage = featured ? unitLabelZh(stageLabel(featured.unit)) : "";
  const time = featured?.timeKnown && featured.unit.startsAt ? formatResultTime(featured.unit.startsAt).split(" ").pop() : "";
  const timeNote = featured && !featured.timeKnown ? (/時間待定|\btbd\b/i.test(featured.unit.timeNote) ? "時間待定" : "接續前場") : "";

  return <>
    {badges.length > 0 && <span className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="sr-only">{period ? "本期間" : "本日"}已確認成果：</span>
      {badges.map((badge) => <ResultBadge key={badge.tone} {...badge} />)}
    </span>}
    {featured ? <span className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-xs font-normal leading-relaxed text-slate-600">
      <span className={`inline-flex items-center gap-1 font-semibold ${featured.kind === "running" ? "text-sky-900" : "text-blue-900"}`}>{featured.kind === "running" && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-sky-500" />}{featured.kind === "running" ? "進行中" : "待賽"}</span>
      {period && featured.unit.scheduleDate && <span className="font-mono tabular-nums">{featured.unit.scheduleDate.slice(5).replace("-", "/")}</span>}
      {time && <span className="font-mono tabular-nums">{time}{featured.unit.timeNote === "預估時間" ? "（預估）" : ""}</span>}
      {timeNote && featured.kind === "next" && <span>{timeNote}</span>}
      <span className="min-w-0 [overflow-wrap:anywhere]">{eventNameZh(featured.unit.event) ?? displayTpe(featured.unit.event)}{stage ? ` · ${displayTpe(stage)}` : ""}</span>
    </span> : showStages && summary.stages.length > 0 && <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-normal text-slate-500">
      <span>已賽階段</span>{summary.stages.map((label) => <ResultBadge key={label} tone="stage" label={displayTpe(label)} />)}
    </span>}
  </>;
}
