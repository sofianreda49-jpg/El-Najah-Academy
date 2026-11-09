const PATHS = {
  home: (<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>),
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18.5 14.4c1.9.7 3 2.6 3 5.6" /></>),
  academy: (<><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" /></>),
  audit: (<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h4" /></>),
  logout: (<><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>),
  moon: (<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  menu: (<path d="M4 6h16M4 12h16M4 18h16" />),
  eye: (<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  eyeOff: (<><path d="M3 3l18 18" /><path d="M10.6 6.2A9.8 9.8 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.6 6.7C3.7 8.6 2 12 2 12s3.5 6 10 6c1.6 0 3-.4 4.3-1" /></>),
  layers: (<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>),
  book: (<><path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z" /><path d="M4 16a4 4 0 0 1 4-4h10" /></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
  sparkle: (<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />),
  close: (<path d="M6 6l12 12M18 6L6 18" />),
  plus: (<path d="M12 5v14M5 12h14" />),
  edit: (<><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M13 7l4 4" /></>),
  trash: (<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></>),
  key: (<><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></>),
  ban: (<><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></>),
  check: (<path d="M5 12l5 5 9-10" />),
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>),
  chevronLeft: (<path d="M15 5l-7 7 7 7" />),
  chevronRight: (<path d="M9 5l7 7-7 7" />),
  folder: (<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />),
  play: (<><circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5z" /></>),
  file: (<><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></>),
  chevronDown: (<path d="M6 9l6 6 6-6" />),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>),
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  trophy: (<><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" /></>),
  chart: (<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />),
  arrowRight: (<path d="M5 12h14M13 6l6 6-6 6" />),
}

export default function Icon({ name, size = 20 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`icon icon-${name}`}
    >
      {PATHS[name]}
    </svg>
  )
}
