"use client";

import { ArrowLeft, ChevronRight } from "@/components/icons";

/** Ligne de menu : icône, libellé, valeur ou badge à droite. */
export function ListRow({
  icon,
  label,
  value,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  badge?: boolean;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-5 py-5 border-b border-line text-left hover:opacity-80 transition-opacity">
      <span className="text-muted">{icon}</span>
      <span className="flex-1 text-[15px]">{label}</span>
      {badge !== undefined && (
        <span className={`eyebrow text-[10px] px-3 py-1.5 rounded-full ${badge ? "bg-accent/15 text-accent" : "bg-bg-soft text-muted"}`}>
          {badge ? "Activé" : "Désactivé"}
        </span>
      )}
      {value && <span className="text-xs text-muted truncate max-w-[40%]">{value}</span>}
      <ChevronRight className="w-4 h-4 text-muted" />
    </button>
  );
}

export function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <button onClick={onBack} className="icon-btn -ml-2" aria-label="Retour">
        <ArrowLeft />
      </button>
      <h2 className="display text-2xl sm:text-3xl">{title}</h2>
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-4 py-4 border-b border-line cursor-pointer">
      <span className="flex-1">
        <span className="block text-[15px]">{label}</span>
        {hint && <span className="block text-xs text-muted mt-1 leading-relaxed">{hint}</span>}
      </span>
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative mt-0.5 w-11 h-6 rounded-full bg-line peer-checked:bg-emerald-500 transition-colors after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export function OptionCard({ selected, onClick, children, label }: { selected: boolean; onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className="text-left group">
      <div className={`border transition-colors ${selected ? "border-ink" : "border-line group-hover:border-muted"}`}>{children}</div>
      <p className={`mt-2 text-xs ${selected ? "text-ink" : "text-muted"}`}>{selected ? "✓ " : ""}{label}</p>
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="flex border border-line">
      {(Object.keys(options) as T[]).map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={`flex-1 py-3 text-xs tracking-wider uppercase transition-colors ${value === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}
        >
          {options[k]}
        </button>
      ))}
    </div>
  );
}
