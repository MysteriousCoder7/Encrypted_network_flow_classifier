import { TriangleAlert } from "lucide-react"

import { START_COMMAND } from "./models"

// Page title block with an icon tile and an intro paragraph.
export function PageHeader({ icon: Icon, title, text, children }) {
  return (
    <header className="page-head">
      {Icon && (
        <span className="page-icon" aria-hidden="true">
          <Icon size={26} />
        </span>
      )}
      <div>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
        {children}
      </div>
    </header>
  )
}

// Warning shown when the backend is unreachable, with the command to start it.
export function BackendNotice() {
  return (
    <div className="notice" role="alert">
      <TriangleAlert size={18} aria-hidden="true" />
      <div>
        <strong>The backend isn't running.</strong> Start it from the project
        root, then check again from the top bar:
        <code>{START_COMMAND}</code>
      </div>
    </div>
  )
}
