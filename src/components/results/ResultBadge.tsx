import type { ResultHighlight, ResultTone } from "@/lib/results/highlights";
import { MedalIcon } from "./ResultIcons";

const PALETTE: Record<ResultTone, string> = {
  win: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  loss: "bg-rose-100 text-rose-900 ring-rose-200",
  draw: "bg-gray-100 text-gray-800 ring-gray-300",
  gold: "bg-amber-100 text-amber-950 ring-amber-400",
  silver: "bg-slate-200 text-slate-900 ring-slate-400",
  bronze: "bg-orange-100 text-orange-950 ring-orange-300",
  rank: "bg-sky-50 text-sky-900 ring-sky-300",
  qualified: "bg-teal-50 text-teal-900 ring-teal-300",
  stage: "bg-indigo-50 text-indigo-900 ring-indigo-200",
};
const SYMBOL: Partial<Record<ResultTone, string>> = { win: "✓" };

export function ResultBadge({ label, tone }: ResultHighlight) {
  return <span className={`inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold leading-5 ring-1 ring-inset ${PALETTE[tone]}`}>
    {(tone === "gold" || tone === "silver" || tone === "bronze") && <MedalIcon medal={tone} />}
    {SYMBOL[tone] && <span aria-hidden="true">{SYMBOL[tone]}</span>}
    <span className="[overflow-wrap:anywhere]">{label}</span>
  </span>;
}
