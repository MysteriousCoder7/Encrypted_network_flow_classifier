import { useCallback, useEffect, useState } from "react"
import { LayoutDashboard, Moon, Presentation, RefreshCw, Sun, UploadCloud } from "lucide-react"

import DashboardPage from "./DashboardPage"
import ProjectPage from "./ProjectPage"
import UploadPage from "./UploadPage"
import { API } from "./models"

// Pages live in the URL hash (#/dashboard, #/classify, #/project) so links and Back work.
const tabs = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "classify", label: "Classify files", icon: UploadCloud },
  { id: "project", label: "Project", icon: Presentation }
]

// Reads the current page from the URL hash (#/dashboard, #/classify, #/project),
// falling back to the dashboard for anything unknown.
function pageFromHash() {
  const id = window.location.hash.replace(/^#\/?/, "")
  return tabs.some(tab => tab.id === id) ? id : "dashboard"
}

// Returns the theme saved in this browser, or dark when nothing is saved or storage is blocked.
function savedTheme() {
  try {
    return localStorage.getItem("flowlens-theme") === "light" ? "light" : "dark"
  } catch {
    return "dark"
  }
}

// Top-level shell: header with page tabs, backend status and theme toggle, and the
// current page. Checks the backend on load and keeps the theme in sync.
function App() {
  const [tab, setTab] = useState(pageFromHash)
  const [theme, setTheme] = useState(savedTheme)
  const [backend, setBackend] = useState("checking")
  const [classCount, setClassCount] = useState(null)

  const checkBackend = useCallback(async () => {
    setBackend("checking")

    try {
      const response = await fetch(`${API}/health`)
      const data = await response.json()
      setBackend(response.ok ? "online" : "offline")
      setClassCount(data.classes?.length ?? null)
    } catch {
      setBackend("offline")
    }
  }, [])

  useEffect(() => {
    checkBackend()
  }, [checkBackend])

  useEffect(() => {
    const onHash = () => {
      setTab(pageFromHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener("hashchange", onHash)
    return () => window.removeEventListener("hashchange", onHash)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#eef2fb" : "#050914")
    try {
      localStorage.setItem("flowlens-theme", theme)
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for this visit.
    }
  }, [theme])

  return (
    <div className="app">
      <div className="backdrop" aria-hidden="true" />

      <header className="bar">
        <div className="bar-inner">
          <a className="brand" href="#/dashboard" aria-label="FlowLens dashboard">
            <span className="brand-tile">
              <BrandMark />
            </span>
            <span className="brand-text">
              <span className="brand-name">FlowLens</span>
              <span className="brand-sub">Encrypted traffic classifier</span>
            </span>
          </a>

          <nav className="tabs" aria-label="Sections">
            {tabs.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#/${id}`}
                className="tab"
                aria-current={tab === id ? "page" : undefined}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </a>
            ))}
          </nav>

          <div className="bar-end">
            <BackendStatus state={backend} onRetry={checkBackend} />
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      <main className="page">
        {tab === "dashboard" && (
          <DashboardPage
            backend={backend}
            classCount={classCount}
            onBackendError={() => setBackend("offline")}
            onBackendOk={() => setBackend("online")}
          />
        )}
        {tab === "classify" && (
          <UploadPage
            backend={backend}
            onBackendError={() => setBackend("offline")}
            onBackendOk={() => setBackend("online")}
          />
        )}
        {tab === "project" && <ProjectPage />}
      </main>

      <footer className="footer">
        FlowLens compares No-IBNN, IBNN, Fuzzy-GCD and Fuzzy-GCD + IBNN on
        encrypted network flows.
      </footer>
    </div>
  )
}

// Pill in the top bar showing whether the backend answers /health, with a retry
// button when it is offline.
function BackendStatus({ state, onRetry }) {
  const text = {
    checking: "Checking backend",
    online: "Backend connected",
    offline: "Backend offline"
  }[state]

  return (
    <div className={`backend backend-${state}`} role="status">
      <span className="backend-dot" aria-hidden="true" />
      <span className="backend-text">{text}</span>
      {state === "offline" && (
        <button
          type="button"
          className="icon-btn"
          onClick={onRetry}
          aria-label="Check the backend again"
          title="Check again"
        >
          <RefreshCw size={14} />
        </button>
      )}
    </div>
  )
}

// Logo: four packet-size bars, one in each model's colour.
function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="12" width="3.5" height="10" rx="1.2" fill="var(--m-base)" />
      <rect x="7.5" y="4" width="3.5" height="18" rx="1.2" fill="var(--m-ib)" />
      <rect x="13" y="14" width="3.5" height="8" rx="1.2" fill="var(--m-gcd)" />
      <rect x="18.5" y="8" width="3.5" height="14" rx="1.2" fill="var(--m-gcdib)" />
    </svg>
  )
}

export default App
