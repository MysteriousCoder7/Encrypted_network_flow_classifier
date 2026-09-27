import { useState } from "react"

import { MODELS } from "./models"

// One hover/focus tooltip per chart. `bind(tip)` returns the handlers for a mark;
// a tip is { title, rows: [{ color, label, value }] }.
export function useTooltip() {
  const [tip, setTip] = useState(null)

  const bind = content => ({
    tabIndex: 0,
    onMouseEnter: event => setTip({ content, x: event.clientX, y: event.clientY }),
    onMouseMove: event => setTip({ content, x: event.clientX, y: event.clientY }),
    onMouseLeave: () => setTip(null),
    onFocus: event => {
      const box = event.currentTarget.getBoundingClientRect()
      setTip({ content, x: box.left + box.width / 2, y: box.top })
    },
    onBlur: () => setTip(null)
  })

  const node = tip && (
    <div className="tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.content.title && <strong className="tooltip-title">{tip.content.title}</strong>}
      {tip.content.rows?.map(row => (
        <span className="tooltip-row" key={row.label}>
          {row.color && <i style={{ background: row.color }} />}
          <span>{row.label}</span>
          <b>{row.value}</b>
        </span>
      ))}
    </div>
  )

  return [bind, node]
}

export function ModelLegend() {
  return (
    <div className="legend" aria-label="Models">
      {MODELS.map(model => (
        <span key={model.name}>
          <i style={{ background: model.color }} />
          {model.name}
        </span>
      ))}
    </div>
  )
}

export function Panel({ title, subtitle, icon: Icon, className = "", children }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        {Icon && (
          <span className="panel-icon" aria-hidden="true">
            <Icon size={17} />
          </span>
        )}
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  )
}

export function StatTile({ label, value, note, tone, icon: Icon }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <span className="stat-label">
        {Icon && <Icon size={15} aria-hidden="true" />}
        {label}
      </span>
      <strong className="stat-value">{value}</strong>
      {note && <span className="stat-note">{note}</span>}
    </div>
  )
}

// Horizontal grouped bars: one row per category, one thin bar per model.
// rows: [{ label, values: [number per model] }]
export function GroupedBars({ rows, max, format, unit }) {
  const [bind, tooltip] = useTooltip()
  const top = max ?? Math.max(1e-9, ...rows.flatMap(row => row.values))

  return (
    <div className="gbars">
      {rows.map(row => (
        <div className="gbar-row" key={row.label}>
          <span className="gbar-label" title={row.label}>
            {row.label}
          </span>

          <div className="gbar-group">
            {MODELS.map((model, index) => {
              const value = row.values[index]
              return (
                <div
                  className="gbar-track"
                  key={model.name}
                  aria-label={`${row.label}, ${model.name}: ${format(value)}${unit ? ` ${unit}` : ""}`}
                  {...bind({
                    title: row.label,
                    rows: MODELS.map((m, i) => ({
                      color: m.color,
                      label: m.name,
                      value: format(row.values[i])
                    }))
                  })}
                >
                  <div
                    className="gbar"
                    style={{
                      width: `${(value / top) * 100}%`,
                      background: model.color
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {tooltip}
    </div>
  )
}
