import "./MediaNavMenu.css";
import { Link, useLocation } from "react-router";

export function MediaNavMenu() {
  const location = useLocation();
  const active =
    location.pathname.startsWith("/media") ||
    location.pathname.startsWith("/vows") ||
    location.pathname.startsWith("/reporting") ||
    location.pathname.startsWith("/data") ||
    location.pathname.includes("/vow");

  return (
    <details className={`media-nav-menu${active ? " is-active" : ""}`}>
      <summary className="site-nav-link">Media</summary>
      <div className="media-nav-popover">
        <Link to="/media">Library</Link>
        <Link to="/vows">Visual of Work (VOWs)</Link>
        <Link to="/reporting">Reporting</Link>
        <Link to="/data">Data</Link>
      </div>
    </details>
  );
}
