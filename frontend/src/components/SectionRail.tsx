import {
  Briefcase,
  CalendarDays,
  ClipboardList,
  Contact,
  FileImage,
  Filter,
  History,
  Images,
  Inbox,
  LayoutDashboard,
  MapPin,
  Route,
  StickyNote,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type SectionRailItem = {
  id: string;
  label: string;
};

type SectionRailProps = {
  items?: SectionRailItem[];
  label?: string;
};

function iconForSection(label: string) {
  const value = label.trim().toLowerCase();

  if (value.includes("overview")) return LayoutDashboard;
  if (value.includes("note")) return StickyNote;
  if (value.includes("journey") || value.includes("timeline")) return Route;
  if (value.includes("scope")) return ClipboardList;
  if (value.includes("visit") || value.includes("schedule")) return CalendarDays;
  if (value.includes("photo") || value.includes("media")) return Images;
  if (value.includes("vow") || value.includes("view") || value.includes("output")) return FileImage;
  if (value.includes("inbox") || value.includes("new")) return Inbox;
  if (value.includes("contact")) return Contact;
  if (value.includes("propert")) return MapPin;
  if (value.includes("client")) return Users;
  if (value.includes("work") || value.includes("job")) return Briefcase;
  if (value.includes("histor")) return History;
  if (value.includes("filter")) return Filter;

  return LayoutDashboard;
}

export function SectionRail({
  items = [],
  label = "On this page",
}: SectionRailProps) {
  const cleanItems = useMemo(
    () => items.filter((item) => item.id && item.label),
    [items],
  );
  const [activeId, setActiveId] = useState("page-top");

  useEffect(() => {
    function syncActiveSection(): void {
      if (window.scrollY < 120) {
        setActiveId("page-top");
        return;
      }

      const offset = 170;
      let currentId = "page-top";

      for (const item of cleanItems) {
        const element = document.getElementById(item.id);
        if (!element) continue;

        if (element.getBoundingClientRect().top <= offset) {
          currentId = item.id;
        } else {
          break;
        }
      }

      setActiveId(currentId);
    }

    syncActiveSection();
    window.addEventListener("scroll", syncActiveSection, { passive: true });
    window.addEventListener("resize", syncActiveSection);

    return () => {
      window.removeEventListener("scroll", syncActiveSection);
      window.removeEventListener("resize", syncActiveSection);
    };
  }, [cleanItems]);

  function goTo(id: string): void {
    if (id === "page-top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setActiveId("page-top");
      return;
    }

    const element = document.getElementById(id);
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  }

  return (
    <aside className="section-rail" aria-label={label}>
      <span className="section-rail-label">{label}</span>
      <nav>
        <button
          aria-current={activeId === "page-top" ? "location" : undefined}
          data-label="Top"
          aria-label="Go to top"
          type="button"
          onClick={() => goTo("page-top")}
        >
          Top
        </button>
        {cleanItems.map((item) => {
          const Icon = iconForSection(item.label);

          return (
            <button
              aria-current={activeId === item.id ? "location" : undefined}
              data-label={item.label}
              aria-label={`Go to ${item.label}`}
              key={item.id}
              type="button"
              onClick={() => goTo(item.id)}
            >
              <Icon className="section-rail-icon" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
