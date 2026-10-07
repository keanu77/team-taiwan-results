import { countryName, isCountryTeamName } from "@/lib/results/countries";
import { competitorHighlights, rankContext } from "@/lib/results/highlights";
import type { TpeCompetitor, TpeResultUnit } from "@/lib/results/types";
import { AthleteName } from "./AthleteName";
import { ResultBadge } from "./ResultBadge";
import { displayTpe, formatResultTime } from "./resultDisplay";
import { CONFIG } from "@/config";
import { TEAM } from "@/lib/results/team";

function Competitor({ competitor, unit }: { competitor: TpeCompetitor; unit: TpeResultUnit }) {
  const organisation = displayTpe(competitor.organisation);
  const isTpe = organisation.toUpperCase() === TEAM;
  const decided = ["OFFICIAL", "UNOFFICIAL"].includes(unit.status);
  const badges = competitorHighlights(unit, competitor);
  const pendingMedal = ({ GOLD: "金牌", ME_GOLD: "金牌", SILVER: "銀牌", ME_SILVER: "銀牌", BRONZE: "銅牌", ME_BRONZE: "銅牌" } as Record<string, string>)[competitor.medal.trim().toUpperCase()] ?? displayTpe(competitor.medal);
  const outcome = ({ W: "勝", L: "敗", T: "平", D: "平" } as Record<string, string>)[competitor.outcome] ?? competitor.outcome;
  const qualification = ({ Q: "晉級", q: "依成績晉級" } as Record<string, string>)[competitor.qualification] ?? competitor.qualification;
  const irm = ({ OK: "", DNF: "未完成比賽", DNS: "未出賽", DSQ: "取消資格" } as Record<string, string>)[competitor.irm] ?? competitor.irm;
  const details = [
    [`${rankContext(unit).label}名次${unit.status === "UNOFFICIAL" ? "（待確認）" : ""}`, competitor.rank], [unit.status === "UNOFFICIAL" ? "勝負（待確認）" : "勝負", decided ? outcome : ""],
    ["晉級", qualification], ["比賽註記", irm],
  ].filter(([, value]) => value);

  return (
    <li className={`min-w-0 rounded-xl bg-white px-3 py-3 ring-1 ring-inset ${isTpe ? "ring-blue-200" : "ring-gray-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 basis-28">
          {!isCountryTeamName(competitor.name, competitor.organisation) && <p className="text-xs font-semibold text-gray-600 [overflow-wrap:anywhere]">{countryName(organisation)}</p>}
          <p className="mt-0.5 font-semibold text-gray-900 [overflow-wrap:anywhere]"><AthleteName competitor={competitor} discipline={unit.discipline} /></p>
        </div>
        {competitor.result && <p className="max-w-full font-mono text-xl font-semibold text-brand-950 [overflow-wrap:anywhere]"><span className="sr-only">成績／比分：</span>{displayTpe(competitor.result)}</p>}
      </div>
      {details.length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          {details.map(([label, value]) => <div key={label} className="max-w-full [overflow-wrap:anywhere]"><dt className="inline">{label}：</dt><dd className="inline font-medium text-gray-800">{displayTpe(value)}</dd></div>)}
        </dl>
      )}
      {badges.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{badges.map((badge) => <ResultBadge key={badge.tone} {...badge} />)}</div>}
      {competitor.medal && unit.status === "OFFICIAL" && !badges.some((badge) => ["gold", "silver", "bronze"].includes(badge.tone)) && <p className="mt-2 text-xs text-gray-600">官方獎牌註記：{displayTpe(competitor.medal)}</p>}
      {competitor.medal && unit.status !== "OFFICIAL" && <p className="mt-2 text-xs text-gray-600">獎牌註記：{pendingMedal}（待官方確認）</p>}
    </li>
  );
}

export function ResultDetails({ unit }: { unit: TpeResultUnit }) {
  // A FOLLOWED BY note describes order, even if a source also sends a placeholder timestamp.
  const followsPrevious = /FOLLOW(?:ED)?\s*BY|接續前場/i.test(unit.timeNote);
  const hasFixedTime = Boolean(unit.startsAt) && !followsPrevious;
  const sourceHref = /^https:\/\//i.test(unit.sourceUrl) ? unit.sourceUrl : null;

  return (
    <div className="px-3 pb-4 sm:px-4">
      <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
        {hasFixedTime && unit.startsAt ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
            <p className="font-medium text-gray-900">{CONFIG.timeZoneLabel} <time dateTime={unit.startsAt}>{formatResultTime(unit.startsAt)}</time></p>
            {CONFIG.viewerTimeZone !== CONFIG.timeZone && <p className="text-gray-600">{CONFIG.viewerTimeZoneLabel} <time dateTime={unit.startsAt}>{formatResultTime(unit.startsAt, CONFIG.viewerTimeZone)}</time></p>}
          </div>
        ) : <p className="font-medium text-gray-700">{followsPrevious ? "接續前場，官方未列開賽時間" : "開賽時間待確認"}</p>}
        {unit.timeNote && <p className="mt-1 text-xs text-gray-600 [overflow-wrap:anywhere]">時間註記：{displayTpe(unit.timeNote)}</p>}
        <p className="mt-1 text-xs text-gray-500 [overflow-wrap:anywhere]">場館：{displayTpe(unit.venue) || "待公布"}</p>
      </div>
      {unit.competitors.length > 0 ? (
        <ul className="mt-3 space-y-2" aria-label={unit.headToHead ? "對戰雙方與成績" : `${TEAM} 參賽者與成績`}>
          {unit.competitors.map((competitor, index) => <Competitor key={`${competitor.id}-${index}`} competitor={competitor} unit={unit} />)}
        </ul>
      ) : <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-500">參賽名單待公布</p>}
      {!unit.detailAvailable && <p className="mt-3 text-xs text-gray-500">目前僅有賽程，詳細結果待官方提供。</p>}
      {unit.status === "OFFICIAL" && <p className="mt-3 text-xs text-gray-500">{rankContext(unit).final
        ? "此為該項目的正式最終名次；獎牌僅依官方明示紀錄顯示。"
        : "此為本場次／階段的正式成績，不代表該項目的最終排名；分組與階段名次不納入最終名次摘要。"}</p>}
      {sourceHref && <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center text-sm font-medium text-brand-700 underline underline-offset-4 hover:text-brand-900">查看官方原始資料<span className="sr-only">（另開視窗）</span><span className="ml-1" aria-hidden="true">↗</span></a>}
    </div>
  );
}
