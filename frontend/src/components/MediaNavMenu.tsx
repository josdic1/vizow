import "./MediaNavMenu.css";
import { useRef } from "react";
import { Link, useLocation } from "react-router";

export function MediaNavMenu() {
  const location = useLocation();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const active =
    location.pathname.startsWith("/app/media") ||
    location.pathname.startsWith("/app/vows") ||
    location.pathname.startsWith("/app/reporting") ||
    location.pathname.startsWith("/app/data") ||
    location.pathname.includes("/vow");

  function closeOtherHeaderMenus() {
    document.querySelectorAll<HTMLDetailsElement>("details.site-dropdown[open]").forEach((details) => {
      if (details !== detailsRef.current) details.open = false;
    });
  }

  return (
    <details
      ref={detailsRef}
      className={`media-nav-menu site-dropdown${active ? " is-active" : ""}`}
      onToggle={() => { if (detailsRef.current?.open) closeOtherHeaderMenus(); }}
    >
      <summary className="site-nav-link">Media</summary>
      <div className="media-nav-popover">
        <Link to="/app/media">Library</Link>
        <Link to="/app/vows">Visual of Work (VOWs)</Link>
        <Link to="/app/reporting">Reporting</Link>
        <Link to="/app/data">Data</Link>
      </div>
    </details>
  );
}
