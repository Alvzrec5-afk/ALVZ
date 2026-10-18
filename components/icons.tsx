type P = { className?: string; filled?: boolean };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const HeartIcon = ({ className = "w-5 h-5", filled }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} fill={filled ? "currentColor" : "none"} aria-hidden>
    <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
  </svg>
);
export const DownloadIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14" />
  </svg>
);
export const CloseIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const ChevronLeft = ({ className = "w-6 h-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const ChevronRight = ({ className = "w-6 h-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const ChevronDown = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M5 9l7 7 7-7" />
  </svg>
);
export const MoonIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />
  </svg>
);
export const SunIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);
export const LockIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <rect x="5" y="10.5" width="14" height="10" rx="1" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);
export const ImageIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M4 17l5-4.5 3.5 3 3-2.5L20 17" />
  </svg>
);
export const BrushIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M19.5 4.5 11 13" />
    <path d="M11 13c-2.5-1-5 .5-5 3.5 0 1.5-1 2.5-2.5 3 3 .8 6.5.3 7.8-2.2.7-1.4.6-3.2-.3-4.3Z" />
  </svg>
);
export const GearIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
  </svg>
);
export const ArrowLeft = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const WrenchIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M14.5 6.5a4 4 0 0 0 5 5l-8.8 8.8a2 2 0 0 1-2.8-2.8l8.8-8.8a4 4 0 0 1-2.2-2.2Z" />
  </svg>
);
export const TypeIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M5 6.5V5h14v1.5M12 5v14M9.5 19h5" />
  </svg>
);
export const PaletteIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.5 1.7-1.5h2a4 4 0 0 0 4-4c0-4-3.8-7.2-8.5-7.2Z" />
    <circle cx="7.8" cy="11" r=".9" />
    <circle cx="10.5" cy="7.6" r=".9" />
    <circle cx="14.8" cy="7.8" r=".9" />
  </svg>
);
export const GridIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <rect x="4" y="4" width="6.5" height="6.5" rx=".8" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx=".8" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx=".8" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx=".8" />
  </svg>
);
export const DotsIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </svg>
);
export const PencilIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M16.5 4.5l3 3L8 19l-4 1 1-4L16.5 4.5Z" />
    <path d="M14.5 6.5l3 3" />
  </svg>
);
export const MenuIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const PlusCircleIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
export const MegaphoneIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1Z" />
    <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
);
export const CardIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1" />
    <circle cx="9" cy="11" r="2" />
    <path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14.5 10h3.5M14.5 13h2.5" />
  </svg>
);
export const LogoutIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14M10 12h10M17 8.5l3.5 3.5-3.5 3.5" />
  </svg>
);
export const SortIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M7 4v16m0 0-3-3m3 3 3-3M13 6h7M13 11h5M13 16h3" />
  </svg>
);
export const SearchIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);
export const DragIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M6 9.5h12M6 14.5h12" />
  </svg>
);
export const FilmIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.5" />
    <path d="M10 9.5v5l4.5-2.5L10 9.5Z" />
  </svg>
);
export const BoardIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <rect x="3.5" y="4.5" width="7" height="9" rx="1" />
    <rect x="13.5" y="4.5" width="7" height="5" rx="1" />
    <rect x="13.5" y="12.5" width="7" height="7" rx="1" />
    <rect x="3.5" y="16.5" width="7" height="3" rx="1" />
  </svg>
);
export const NoteIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M5 4.5h14v10l-5 5H5z" />
    <path d="M14 19.5v-5h5M8.5 9h7M8.5 12h4" />
  </svg>
);
export const ChecklistIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M4 6.5l1.5 1.5 3-3M4 12.5l1.5 1.5 3-3M4 18.5l1.5 1.5 3-3M11.5 7h8.5M11.5 13h8.5M11.5 19h8.5" />
  </svg>
);
export const ColumnIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <rect x="6" y="3.5" width="12" height="17" rx="1" />
    <path d="M8.5 7.5h7M8.5 11h7M8.5 14.5h7" />
  </svg>
);
export const ConnectorIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <circle cx="5.5" cy="18.5" r="2" />
    <path d="M7 17 18.5 5.5M13 5.5h5.5V11" />
  </svg>
);
export const TrashIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13h9l1-13M10 10v6.5M14 10v6.5" />
  </svg>
);
export const PlusIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const MinusIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M5 12h14" />
  </svg>
);
export const FitIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M4 9V4.5h4.5M15.5 4.5H20V9M20 15v4.5h-4.5M8.5 19.5H4V15" />
  </svg>
);
export const ImportIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M12 3.5v10m0 0-4-4m4 4 4-4M4.5 14v5.5h15V14" />
  </svg>
);
export const LinkIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <path d="M10 14a4 4 0 0 0 5.66 0l3.17-3.17a4 4 0 0 0-5.66-5.66L12 6.34M14 10a4 4 0 0 0-5.66 0l-3.17 3.17a4 4 0 0 0 5.66 5.66L12 17.66" />
  </svg>
);
export const TableIcon = ({ className = "w-5 h-5" }: P) => (
  <svg viewBox="0 0 24 24" className={className} {...base} aria-hidden>
    <rect x="3.5" y="5" width="17" height="14" rx="1" />
    <path d="M3.5 9.5h17M3.5 14.25h17M9.25 5v14M14.75 5v14" />
  </svg>
);
