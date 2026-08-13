import { useDemo } from "./useDemo";

export function DemoAdminMenu() {
  const { view, setView, reset } = useDemo();

  return (
    <details className="admin-menu demo-admin-menu">
      <summary className="site-nav-link">Admin</summary>
      <div className="admin-menu-popover">
        <div className="admin-menu-heading">
          <strong>Demo controls</strong>
          <span>Public sandbox only. Nothing here changes production data.</span>
        </div>
        <button className="admin-menu-item" type="button" disabled={view === "problems"} onClick={() => setView("problems")}>What Vizow Fixes</button>
        <button className="admin-menu-item" type="button" disabled={view === "contractor"} onClick={() => setView("contractor")}>Contractor Simulator</button>
        <button className="admin-menu-item" type="button" disabled={view === "client"} onClick={() => setView("client")}>Client Simulator</button>
        <button className="admin-menu-item" type="button" disabled={view === "walkthrough"} onClick={() => setView("walkthrough")}>Guided Walkthrough</button>
        <div className="admin-menu-divider" />
        <button className="admin-menu-item" type="button" onClick={reset}>Reset Demo Progress</button>
      </div>
    </details>
  );
}
