import { Link } from "react-router";

import { AppLayout } from "../layouts/AppLayout";

export function HomePage() {
  return (
    <AppLayout
      object="VIZOW"
      tool="Home"
      action="Choose where to work"
      result="Ready"
      message="Open the part of VIZOW you need."
      activeStep="action"
      resultTone="success"
    >
      <div className="shell">
        <section className="panel stack">
          <p className="eyebrow">Home</p>
          <h1>VIZOW</h1>

          <div className="cluster">
            <Link className="btn btn-primary" to="/requests">
              Requests
            </Link>

            <Link className="btn" to="/field">
              Field
            </Link>

            <Link className="btn" to="/jobs">
              Jobs
            </Link>

            <Link className="btn" to="/clients">
              Clients
            </Link>

            <Link className="btn" to="/vows">
              Visual of Work
            </Link>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
