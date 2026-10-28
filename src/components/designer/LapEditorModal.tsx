"use client";

import { createPortal } from "react-dom";
import {
  useCourseStore,
  getRouteParts,
  getFinishMidpoint,
  getBuoySide,
  getBuoyLapRule,
  getBuoysForLap,
  getGates,
  getGateLapProblem,
  getLapLoop,
  computeLapRouteKm,
  getRaceTotalKm,
  isGateActiveOnLap,
  getBuoyNumbers,
  buoyName as nameOfBuoy,
  START_ID,
  FINISH_ID,
  BuoySide,
  LapRule,
} from "@/store/courseStore";
import { IconClose } from "@/components/ui/icons";

const SIDE_LABEL: Record<BuoySide, string> = {
  left: "← Left",
  directional: "↑ Turn",
  right: "Right →",
};

const MAX_LAPS = 20;

interface Props {
  onClose: () => void;
}

/**
 * Edit course: a grid of buoys × laps (swim each buoy as set, skip it, or swim
 * it on another side) and of gates × laps (pass or not), where each gate is set
 * between two route marks.
 */
export function LapEditorModal({ onClose }: Props) {
  const { courseData, setLaps, setBuoyLapRule, setGateBetween } = useCourseStore();
  const laps = courseData.laps ?? 1;
  const parts = getRouteParts(courseData.elements);
  const buoys = parts.buoys;
  const gates = getGates(courseData.elements);
  const numbers = getBuoyNumbers(courseData.elements);
  const buoyName = (id: string) => {
    const b = buoys.find((x) => x.id === id);
    return b ? nameOfBuoy(b, numbers, buoys) : "?";
  };
  const fromOptions = [
    ...(parts.start ? [{ id: START_ID, name: "Start" }] : []),
    ...buoys.map((b) => ({ id: b.id, name: buoyName(b.id) })),
  ];
  const toOptions = [
    ...buoys.map((b) => ({ id: b.id, name: buoyName(b.id) })),
    ...(getFinishMidpoint(parts) ? [{ id: FINISH_ID, name: "Finish" }] : []),
  ];
  const lapNumbers = Array.from({ length: laps }, (_, i) => i + 1);
  const { totalKm } = getRaceTotalKm(courseData);

  const resetLap = (lap: number) =>
    buoys.forEach((b) => {
      if (getBuoyLapRule(b.metadata, lap) !== "default") setBuoyLapRule(b.id, lap, "default");
    });

  // Portal: the map toolbar that opens this is translated, which would trap a fixed overlay
  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lap-editor-title"
    >
      <div className="bg-base-100 text-base-content rounded-2xl shadow-2xl ring-1 ring-black/5 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 pt-5 pb-3">
          <h3 id="lap-editor-title" className="text-lg font-semibold">Edit course</h3>
          <div className="flex items-center gap-1.5" role="group" aria-label="Number of laps">
            <button
              onClick={() => setLaps(Math.max(1, laps - 1))}
              disabled={laps <= 1}
              className="btn btn-sm btn-ghost btn-circle"
              aria-label="One lap less"
            >
              −
            </button>
            <span className="w-14 text-center text-sm font-medium tabular-nums">
              {laps} lap{laps > 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setLaps(Math.min(MAX_LAPS, laps + 1))}
              disabled={laps >= MAX_LAPS}
              className="btn btn-sm btn-ghost btn-circle"
              aria-label="One lap more"
            >
              +
            </button>
          </div>
          <span className="flex-1 text-sm text-base-content/60 text-right">
            {totalKm > 0 && <>Total {totalKm.toFixed(2)} km</>}
          </span>
          <button onClick={onClose} className="btn btn-sm btn-ghost btn-circle text-base-content/50 hover:text-base-content" aria-label="Close" autoFocus>
            <IconClose />
          </button>
        </div>

        <p className="px-6 pb-3 text-sm text-base-content/60">
          For every lap, choose whether each buoy is swum as placed, skipped, or rounded on the other side.
          A skipped buoy is simply left out: the swimmers go on to the next buoy swum on that lap.
          {gates.length > 0 && " Set each gate between two marks and the laps it must be passed on."}
        </p>

        {buoys.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-base-content/60">Place some buoys first.</p>
        ) : (
          <div className="overflow-y-auto overflow-x-hidden px-6 pb-5">
            <table className="w-full table-fixed text-sm border-separate border-spacing-0">
              <colgroup>
                {/* The names (and gate dropdowns) give way on narrow screens so the laps never scroll sideways */}
                <col className={gates.length > 0 ? "w-[17rem] lg:w-[23rem]" : "w-[9rem] lg:w-[13rem]"} />
                {lapNumbers.map((lap) => <col key={lap} />)}
              </colgroup>
              <thead>
                <tr>
                  <th className="sticky top-0 z-20 bg-base-100 text-left font-medium text-base-content/60 py-2 pr-4">Buoy</th>
                  {lapNumbers.map((lap) => (
                    <th key={lap} className="sticky top-0 z-10 bg-base-100 px-1 py-2 font-medium">
                      <div className="flex flex-wrap items-center justify-center gap-x-1">
                        Lap {lap}
                        {buoys.some((b) => getBuoyLapRule(b.metadata, lap) !== "default") && (
                          <button
                            onClick={() => resetLap(lap)}
                            className="text-xs font-normal text-sky-700 hover:underline"
                            title={`Swim every buoy as placed on lap ${lap}`}
                          >
                            reset
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buoys.map((b) => {
                  const baseSide = getBuoySide(b.metadata);
                  return (
                    <tr key={b.id}>
                      <th scope="row" className="text-left font-normal py-1 pr-4 truncate">
                        <span className="font-medium">{buoyName(b.id)}</span>
                        <span className="ml-2 text-xs text-base-content/50">{SIDE_LABEL[baseSide]}</span>
                      </th>
                      {lapNumbers.map((lap) => {
                        const rule = getBuoyLapRule(b.metadata, lap);
                        const tone =
                          rule === "skip"
                            ? "bg-gray-100 text-gray-500 line-through"
                            : rule === "default"
                              ? "bg-white"
                              : "bg-amber-50 text-amber-900 ring-1 ring-amber-300";
                        return (
                          <td key={lap} className="px-1 py-1">
                            <select
                              value={rule}
                              onChange={(e) => setBuoyLapRule(b.id, lap, e.target.value as LapRule)}
                              className={`w-full h-8 rounded-lg border border-gray-200 px-1.5 text-xs ${tone}`}
                              aria-label={`${buoyName(b.id)}, lap ${lap}`}
                            >
                              <option value="default">✓ {SIDE_LABEL[baseSide]}</option>
                              <option value="skip">Skip</option>
                              {(Object.keys(SIDE_LABEL) as BuoySide[])
                                .filter((s) => s !== baseSide)
                                .map((s) => (
                                  <option key={s} value={s}>{SIDE_LABEL[s]}</option>
                                ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              {gates.length > 0 && (
                <tbody>
                  {gates.map((g, gi) => (
                    <tr key={g.id}>
                      <th scope="row" className={`text-left font-normal py-1 pr-4 align-top ${gi === 0 ? "pt-4" : ""}`}>
                        <div className="flex items-center gap-1.5 text-xs">
                          <select
                            value={g.from ?? ""}
                            onChange={(e) => setGateBetween(g.id, e.target.value || null, g.to)}
                            className="h-8 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white text-gray-900 px-1 text-xs"
                            aria-label={`Gate ${gi + 1}: after`}
                            title="The mark swum just before the gate"
                          >
                            <option value="">after…</option>
                            {fromOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                          <span className="shrink-0 whitespace-nowrap text-sm text-base-content/60">
                            → <span className="font-medium text-base-content">{g.left.label || `Gate ${gi + 1}`}</span> →
                          </span>
                          <select
                            value={g.to ?? ""}
                            onChange={(e) => setGateBetween(g.id, g.from, e.target.value || null)}
                            className="h-8 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white text-gray-900 px-1 text-xs"
                            aria-label={`Gate ${gi + 1}: before`}
                            title="The mark swum just after the gate: after the lap's last buoy, the next lap's first buoy ends the lap at the gate"
                          >
                            <option value="">before…</option>
                            {toOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                          </select>
                        </div>
                      </th>
                      {lapNumbers.map((lap) => {
                        const active = isGateActiveOnLap(g, lap);
                        const problem = active ? getGateLapProblem(courseData.elements, g, lap, laps) : null;
                        const tone = !active
                          ? "bg-gray-100 text-gray-500"
                          : problem
                            ? "bg-red-50 text-red-800 ring-1 ring-red-300"
                            : "bg-indigo-50 text-indigo-900 ring-1 ring-indigo-300";
                        return (
                          <td key={lap} className={`px-1 py-1 align-top ${gi === 0 ? "pt-4" : ""}`}>
                            <select
                              value={active ? "default" : "skip"}
                              onChange={(e) => setBuoyLapRule(g.id, lap, e.target.value as LapRule)}
                              className={`w-full h-8 rounded-lg border border-gray-200 px-1.5 text-xs ${tone}`}
                              aria-label={`${g.left.label || `Gate ${gi + 1}`}, lap ${lap}`}
                              title={problem ?? undefined}
                            >
                              <option value="default">✓ Mandatory</option>
                              <option value="skip">Not swum</option>
                            </select>
                            {problem && <div className="mt-0.5 text-[11px] leading-tight text-error">{problem}</div>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              )}
              <tfoot>
                <tr>
                  <th className="text-left font-medium text-base-content/60 pt-3 pr-4">Lap distance</th>
                  {lapNumbers.map((lap) => {
                    const count = getBuoysForLap(buoys, lap).length;
                    const gateCount = getLapLoop(courseData.elements, lap, laps).filter((p) => p.kind === "gate").length;
                    return (
                      <td key={lap} className="pt-3 px-1 text-center text-xs tabular-nums">
                        {count < 2 ? (
                          <span className="text-error">Needs 2+ buoys</span>
                        ) : (
                          <>
                            <div className="font-medium">{computeLapRouteKm(courseData.elements, lap, laps).toFixed(2)} km</div>
                            <div className="text-base-content/50">
                              {count} buoys{gateCount > 0 && ` · ${gateCount} gate${gateCount > 1 ? "s" : ""}`}
                            </div>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-base-200">
          <p className="text-xs text-base-content/50">
            Laps that differ get their own colour on the map. A gate between two buoys is only passed on laps
            where they follow each other; set after a lap&apos;s last buoy and before the first buoy of the next lap,
            it ends the lap. Ctrl+Z undoes a change.
          </p>
          <button onClick={onClose} className="btn btn-primary btn-sm">Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
