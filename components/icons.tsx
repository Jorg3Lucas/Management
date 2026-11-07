import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export function IconDashboard(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function IconRanking(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" strokeWidth="2.6" />
    </svg>
  );
}

export function IconSwords(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="m13 19 6-6" />
      <path d="m16 16 4 4" />
      <path d="m19 21 2-2" />
      <path d="M9.5 6.5 21 18v3h-3L6.5 9.5" />
      <path d="m5 14 4 4" />
      <path d="m2 22 3-3" />
    </svg>
  );
}

export function IconServer(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" strokeWidth="2.6" />
    </svg>
  );
}

export function IconUsers(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconRefresh(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
      <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
      <path d="M3 21v-5h5M21 3v5h-5" />
    </svg>
  );
}

export function IconArrowRight(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconClock(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconPlus(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconFlag(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 21V4" />
      <path d="M5 5h10l-1.7 3.5L15 12H5" />
    </svg>
  );
}

export function IconCastle(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 21V9h4V5h3v4h4V5h3v4h4v12" />
      <path d="M10 21v-5a2 2 0 0 1 4 0v5" />
      <path d="M2 21h20" />
    </svg>
  );
}

export function IconGift(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11h16v10H4z" />
      <path d="M2 7h20v4H2z" />
      <path d="M12 7v14" />
      <path d="M12 7c-1.2-2.4-2.5-4-4.5-4a2.5 2.5 0 0 0 0 5H12Zm0 0c1.2-2.4 2.5-4 4.5-4a2.5 2.5 0 0 1 0 5H12Z" />
    </svg>
  );
}

export function IconShield(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 4 6v5c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function IconCoins(props: Props) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
      <path d="M3 12v5c0 1.7 2.7 3 6 3 1.1 0 2.2-.1 3.1-.4" />
      <circle cx="17.5" cy="15.5" r="4.5" />
      <path d="M17.5 13.5v4M16.2 14.4h2.2a.9.9 0 0 1 0 1.8h-1.8a.9.9 0 0 0 0 1.8h2.2" />
    </svg>
  );
}

export function IconExpedition(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="m3 20 6.5-11 4 6 2.5-4L21 20Z" />
      <path d="M16 4v6M16 4l4 1.5L16 7" />
    </svg>
  );
}

export function IconHistory(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}
