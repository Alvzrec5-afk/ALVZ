"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatTime, monthGrid, type CalendarEntry, type CalendarEvent } from "@/lib/calendar";
import { ChevronLeft, ChevronRight, PlusIcon } from "@/components/icons";
import { EventEditor } from "./event-editor";
import { SyncButton } from "./sync-button";

const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const WEEK = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Pastille d'un élément du calendrier : style selon ce qu'il représente (toujours avec un libellé, jamais la couleur seule). */
const TONE: Record<CalendarEntry["tone"], string> = {
  event: "bg-ink text-bg",
  option: "border border-dashed border-muted text-ink",
  project: "bg-bg-soft text-ink",
  due: "bg-warn/15 text-warn",
  overdue: "bg-danger/15 text-danger",
  cancelled: "text-muted line-through",
};
const LEGEND: [CalendarEntry["tone"], string][] = [
  ["event", "Confirmé"],
  ["option", "Option (pas sûr)"],
  ["project", "Galerie, vidéo, rendez-vous"],
  ["due", "Solde à recevoir"],
];

const longDay = (d: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export function CalendarView({
  today,
  entries,
  events,
  openId,
  initialMonth,
}: {
  today: string;
  entries: CalendarEntry[];
  events: CalendarEvent[];
  openId: string | null;
  initialMonth: string;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth); // « 2026-10 »
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<{ event?: CalendarEvent; date?: string } | null>(() => {
    const ev = openId ? events.find((e) => e.id === openId) : undefined;
    return ev ? { event: ev } : null;
  });
  // Après un enregistrement, la fenêtre se rouvre sur l'événement avec les données fraîches (projets créés…).
  const [follow, setFollow] = useState<string | null>(null);
  useEffect(() => {
    setEditing((cur) => {
      const id = follow ?? cur?.event?.id;
      const ev = id ? events.find((e) => e.id === id) : undefined;
      return ev && cur ? { event: ev } : cur;
    });
  }, [events, follow]);

  const [y, m] = month.split("-").map(Number);
  const days = useMemo(() => monthGrid(y, m - 1), [y, m]);
  // Un événement sur plusieurs jours apparaît chaque jour.
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      let d = e.date;
      const end = e.endDate && e.endDate > e.date ? e.endDate : e.date;
      for (let i = 0; i < 62 && d <= end; i++) {
        map.set(d, [...(map.get(d) ?? []), e]);
        const next = new Date(`${d}T12:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        d = next.toISOString().slice(0, 10);
      }
    }
    for (const list of map.values()) list.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
    return map;
  }, [entries]);
  const upcoming = useMemo(
    () => entries.filter((e) => (e.endDate ?? e.date) >= today && e.tone !== "cancelled").sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99")).slice(0, 12),
    [entries, today],
  );

  function shift(n: number) {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(d.toISOString().slice(0, 7));
  }
  function open(e: CalendarEntry) {
    if (e.eventId) {
      const ev = events.find((x) => x.id === e.eventId);
      if (ev) setEditing({ event: ev });
    } else if (e.href) router.push(e.href);
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mois précédent"><ChevronLeft className="w-5 h-5" /></button>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Mois suivant"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <h2 className="display text-2xl sm:text-3xl min-w-40">{MONTHS[m - 1]} {y}</h2>
        {month !== today.slice(0, 7) && (
          <button className="text-xs text-muted hover:text-ink" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}>Aujourd&apos;hui</button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <SyncButton />
          <button className="btn" onClick={() => setEditing({ date: selected >= today ? selected : today })}>
            <PlusIcon className="w-4 h-4" /> Événement
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted">
        {LEGEND.map(([t, label]) => (
          <span key={t} className="flex items-center gap-2"><i className={`inline-block w-3 h-3 rounded-sm ${TONE[t]}`} /> {label}</span>
        ))}
      </div>

      {/* Grille du mois : pastilles sur ordinateur, points sur téléphone. */}
      <div className="mt-5 grid grid-cols-7 border-l border-t border-line">
        {WEEK.map((w) => (
          <div key={w} className="border-r border-b border-line px-2 py-2 text-[11px] text-muted text-center sm:text-left">{w}</div>
        ))}
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          const inMonth = d.slice(0, 7) === month;
          const isToday = d === today;
          return (
            <div
              key={d}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(d)}
              onDoubleClick={() => setEditing({ date: d })}
              onKeyDown={(e) => e.key === "Enter" && setSelected(d)}
              className={`relative border-r border-b border-line min-h-14 sm:min-h-28 p-1 sm:p-1.5 cursor-pointer transition-colors ${inMonth ? "" : "bg-bg-soft/50"} ${selected === d ? "bg-bg-soft" : "hover:bg-bg-soft/60"}`}
            >
              <span className={`inline-flex items-center justify-center w-6 h-6 text-xs rounded-full ${isToday ? "bg-ink text-bg" : inMonth ? "" : "text-muted"}`}>{Number(d.slice(8))}</span>
              <div className="hidden sm:block mt-1 space-y-1">
                {list.slice(0, 3).map((e) => (
                  <button
                    key={e.key}
                    onClick={(ev) => { ev.stopPropagation(); open(e); }}
                    title={`${e.title}${e.sub ? ` · ${e.sub}` : ""}`}
                    className={`block w-full text-left truncate rounded-sm px-1.5 py-0.5 text-[11px] leading-tight ${TONE[e.tone]}`}
                  >
                    {e.time && <span className="opacity-70 mr-1">{formatTime(e.time)}</span>}
                    {e.title}
                  </button>
                ))}
                {list.length > 3 && <span className="block text-[10px] text-muted px-1">+{list.length - 3}</span>}
              </div>
              {list.length > 0 && (
                <div className="sm:hidden flex flex-wrap gap-0.5 mt-1 justify-center">
                  {list.slice(0, 4).map((e) => (
                    <i key={e.key} className={`block w-1.5 h-1.5 rounded-full ${e.tone === "option" ? "border border-muted" : e.tone === "due" ? "bg-warn" : e.tone === "overdue" ? "bg-danger" : e.tone === "event" ? "bg-ink" : "bg-muted"}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-10 grid lg:grid-cols-2 gap-10">
        <section>
          <div className="flex items-center justify-between gap-4 mb-3">
            <h3 className="eyebrow text-muted">{longDay(selected)}</h3>
            <button className="text-xs text-muted hover:text-ink flex items-center gap-1" onClick={() => setEditing({ date: selected })}>
              <PlusIcon className="w-3.5 h-3.5" /> Ajouter ce jour-là
            </button>
          </div>
          <EntryList list={byDay.get(selected) ?? []} onOpen={open} empty="Rien ce jour-là." />
        </section>
        <section>
          <h3 className="eyebrow text-muted mb-3">À venir</h3>
          <EntryList list={upcoming} onOpen={open} withDate empty="Rien de prévu pour l'instant." />
        </section>
      </div>

      {editing && (
        <EventEditor
          key={editing.event?.id ?? `new-${editing.date}`}
          event={editing.event}
          date={editing.date ?? today}
          onClose={() => {
            setFollow(null);
            setEditing(null);
          }}
          onSaved={(id) => {
            setFollow(id ?? null);
            router.refresh();
            if (!id) setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EntryList({ list, onOpen, withDate, empty }: { list: CalendarEntry[]; onOpen: (e: CalendarEntry) => void; withDate?: boolean; empty: string }) {
  if (list.length === 0) return <p className="text-sm text-muted py-4 border-t border-line">{empty}</p>;
  return (
    <ul>
      {list.map((e) => (
        <li key={e.key}>
          <button onClick={() => onOpen(e)} className="w-full flex items-center gap-4 py-3 border-b border-line text-left hover:opacity-80">
            {withDate && (
              <span className="w-12 shrink-0 text-center">
                <span className="block display text-2xl leading-none">{Number(e.date.slice(8))}</span>
                <span className="block text-[10px] text-muted">{SHORT[Number(e.date.slice(5, 7)) - 1]}</span>
              </span>
            )}
            <span className={`shrink-0 w-2 self-stretch rounded-full ${e.tone === "event" ? "bg-ink" : e.tone === "option" ? "border border-dashed border-muted" : e.tone === "due" ? "bg-warn" : e.tone === "overdue" ? "bg-danger" : "bg-line"}`} />
            <span className="flex-1 min-w-0">
              <span className={`block text-[15px] truncate ${e.tone === "cancelled" ? "line-through text-muted" : ""}`}>{e.title}</span>
              <span className="block text-xs text-muted truncate">
                {[e.time && formatTime(e.time), e.tone === "option" ? "Option" : null, e.sub].filter(Boolean).join(" · ")}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
