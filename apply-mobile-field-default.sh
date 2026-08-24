#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"

if [[ ! -f "$ROOT/frontend/src/App.tsx" ]]; then
  echo "Run this script from the Vizow repo root." >&2
  exit 1
fi

mkdir -p "$ROOT/frontend/src/utils"
cat > "$ROOT/frontend/src/utils/appEntry.ts" <<'TS'
export const MOBILE_FIELD_MODE_MAX_WIDTH = 760;

export function shouldDefaultToFieldMode(): boolean {
  if (typeof window === "undefined") return false;

  const mediaQuery = `(max-width: ${MOBILE_FIELD_MODE_MAX_WIDTH}px)`;

  if (typeof window.matchMedia === "function") {
    return window.matchMedia(mediaQuery).matches;
  }

  return window.innerWidth <= MOBILE_FIELD_MODE_MAX_WIDTH;
}

export function defaultAppEntryPath(): "/app" | "/app/field" {
  return shouldDefaultToFieldMode() ? "/app/field" : "/app";
}
TS

python3 <<'PY'
from pathlib import Path


def replace_required(text: str, old: str, new: str, label: str) -> str:
    if old in text:
        return text.replace(old, new)
    if new in text:
        return text
    raise SystemExit(f"Could not find expected {label}; stopping without guessing.")

# App entry route: bare /app is device-aware; /app/inbox is explicit Site Mode.
p = Path("frontend/src/App.tsx")
s = p.read_text()
if 'import { shouldDefaultToFieldMode } from "./utils/appEntry";' not in s:
    marker = 'import { fetchVows } from "./api/vows";\n'
    if marker not in s:
        raise SystemExit("Could not find App.tsx import insertion point.")
    s = s.replace(marker, marker + 'import { shouldDefaultToFieldMode } from "./utils/appEntry";\n')

if "function AppEntryPage()" not in s:
    marker = "function App() {\n"
    if marker not in s:
        raise SystemExit("Could not find App() insertion point.")
    component = '''function AppEntryPage() {\n  const location = useLocation();\n\n  // Bare /app is the device-aware product entry. Query-string actions are\n  // explicit Site Mode actions (for example /app?compose=request).\n  if (location.search) {\n    return <InboxPage />;\n  }\n\n  return shouldDefaultToFieldMode() ? (\n    <Navigate to="/app/field" replace />\n  ) : (\n    <InboxPage />\n  );\n}\n\n'''
    s = s.replace(marker, component + marker)

s = replace_required(
    s,
    '<Route path="/app" element={<InboxPage />} />',
    '<Route path="/app" element={<AppEntryPage />} />',
    "/app route",
)
s = replace_required(
    s,
    '<Route path="/app/inbox" element={<Navigate to="/app" replace />} />',
    '<Route path="/app/inbox" element={<InboxPage />} />',
    "/app/inbox route",
)
# Explicit Site Mode links should not bounce back into Field Mode on phones.
s = s.replace(
    'className="btn btn-primary clients-findbar-add"\n                to="/app"',
    'className="btn btn-primary clients-findbar-add"\n                to="/app/inbox"',
)
s = s.replace(
    '<Link className="btn btn-primary" to="/app">\n              Return to Inbox',
    '<Link className="btn btn-primary" to="/app/inbox">\n              Return to Inbox',
)
p.write_text(s)

# Both /demo entry experiences should go straight to Field Mode on phones.
for filename in ["frontend/src/pages/Eli5Page.tsx", "frontend/src/pages/DemoPage.tsx"]:
    p = Path(filename)
    s = p.read_text()
    if 'defaultAppEntryPath' not in s:
        style_marker = 'import "../styles/eli5-workday.css";\n' if filename.endswith("Eli5Page.tsx") else 'import "../styles/demo.css";\n'
        if style_marker not in s:
            raise SystemExit(f"Could not find import insertion point in {filename}.")
        s = s.replace(style_marker, 'import { defaultAppEntryPath } from "../utils/appEntry";\n' + style_marker)
    s = replace_required(
        s,
        'window.location.assign("/app");',
        'window.location.assign(defaultAppEntryPath());',
        f"private demo destination in {filename}",
    )
    p.write_text(s)

# Field Mode's requests alert deliberately opens Site Mode Inbox.
p = Path("frontend/src/pages/FieldModePage.tsx")
s = p.read_text()
s = replace_required(
    s,
    'onClick={() => navigate("/app")}',
    'onClick={() => navigate("/app/inbox")}',
    "Field Mode Inbox destination",
)
p.write_text(s)

# Once a user explicitly enters Site Mode, its own Home/Inbox links stay there.
p = Path("frontend/src/layouts/AppLayout.tsx")
s = p.read_text()
s = replace_required(
    s,
    'to="/app" aria-label="VIZOW Home"',
    'to="/app/inbox" aria-label="VIZOW Home"',
    "Site Mode brand destination",
)
s = replace_required(
    s,
    '              to="/app"\n              end',
    '              to="/app/inbox"\n              end',
    "Site Mode Inbox nav destination",
)
p.write_text(s)

p = Path("frontend/src/pages/Today.tsx")
s = p.read_text()
s = replace_required(s, 'className="today-mark" to="/app"', 'className="today-mark" to="/app/inbox"', "Today brand destination")
s = replace_required(s, '<Link to="/app">Inbox</Link>', '<Link to="/app/inbox">Inbox</Link>', "Today Inbox nav destination")
s = replace_required(s, '<Link to="/app"><span>New in Inbox</span>', '<Link to="/app/inbox"><span>New in Inbox</span>', "Today Inbox metric destination")
p.write_text(s)
PY

echo "Mobile app entry updated:"
echo "  phone /demo → /app/field"
echo "  phone /app  → /app/field"
echo "  desktop /app → Site Mode Inbox"
echo "  explicit Site Mode Inbox → /app/inbox"
