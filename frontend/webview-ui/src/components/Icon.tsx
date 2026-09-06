// Minimal hand-drawn icon set (no external icon font/library needed).
// Deliberately plain/geometric to match VS Code's codicon aesthetic.

import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "search"
  | "workspace"
  | "index"
  | "history"
  | "settings"
  | "file"
  | "chevronRight"
  | "close"
  | "openExternal"
  | "check"
  | "circle"
  | "clock"
  | "folder"
  | "admin";

const paths: Record<IconName, JSX.Element> = {
  home: (
    <path d="M2 8.5 8 3l6 5.5M4 7v6h8V7M6.5 13v-4h3v4" />
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.3 10.3 14 14" />
    </>
  ),
  workspace: (
    <>
      <path d="M2 4.5 8 2l6 2.5v7L8 14l-6-2.5z" />
      <path d="M2 4.5 8 7l6-2.5M8 7v7" />
    </>
  ),
  index: (
    <>
      <ellipse cx="8" cy="3.5" rx="5.5" ry="2" />
      <path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9" />
      <path d="M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" />
    </>
  ),
  history: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8l3 1.8" />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2.2" />
      <path d="M8 1.8v1.6M8 12.6v1.6M14.2 8h-1.6M3.4 8H1.8M12.3 3.7l-1.1 1.1M4.8 11.2l-1.1 1.1M12.3 12.3l-1.1-1.1M4.8 4.8 3.7 3.7" />
    </>
  ),
  file: (
    <path d="M4 1.5h5.5L12.5 4.5V14.5H4z M9.5 1.5v3h3" />
  ),
  chevronRight: <path d="M6 3.5 10.5 8 6 12.5" />,
  close: <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />,
  openExternal: (
    <>
      <path d="M6.5 2.5H13.5V9.5" />
      <path d="M13.5 2.5 7 9" />
      <path d="M11 8.5V13H2.5V4.5H7" />
    </>
  ),
  check: <path d="M3 8.5 6.5 12 13 4" />,
  circle: <circle cx="8" cy="8" r="5.5" />,
  clock: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.5V8.3L10.5 10" />
    </>
  ),
  folder: <path d="M2 4h4l1.3 1.6H14V13H2z" />,
  admin: (
    <>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
    </>
  ),
};

export function Icon({
  name,
  size = 14,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
