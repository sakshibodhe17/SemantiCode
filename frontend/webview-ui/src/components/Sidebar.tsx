import type { ScreenId } from "../data/types";
import { Icon, type IconName } from "./Icon";

const NAV_ITEMS: { id: ScreenId; label: string; icon: IconName }[] = [
  { id: "welcome", label: "Home", icon: "home" },
  { id: "search", label: "Search", icon: "search" },
  { id: "workspace", label: "Workspace", icon: "workspace" },
  { id: "indexing", label: "Index", icon: "index" },
  { id: "history", label: "History", icon: "history" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export function Sidebar({
  active,
  onSelect,
}: {
  active: ScreenId;
  onSelect: (screen: ScreenId) => void;
}) {
  return (
    <nav className="sc-rail" aria-label="SemantiCode panels">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`sc-rail__item ${active === item.id ? "is-active" : ""}`}
          title={item.label}
          aria-current={active === item.id}
          onClick={() => onSelect(item.id)}
        >
          <Icon name={item.icon} size={16} />
          <span className="sc-rail__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
