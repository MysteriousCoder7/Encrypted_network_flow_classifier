import { useState } from "react"

import { MODELS } from "./models"

// Shared hover and focus tooltip for chart marks. bind(tip) returns the handlers for a
// mark; the returned node renders the tip { title, rows: [{ color, label, value }] }.
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

// Legend with one swatch per model, in the fixed model order.
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

// Card with an icon, title and subtitle, used for every insight and chart.
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

// Headline number with a label and a short note; tone highlights it as accent, good or bad.
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

// Horizontal grouped bars: one row per category and one thin bar per series (the four
// models by default), with a tooltip comparing all series.
export function GroupedBars({ rows, max, format, unit, series = MODELS, showValues = false }) {
  const [bind, tooltip] = useTooltip()
  const top = max ?? Math.max(1e-9, ...rows.flatMap(row => row.values))

  return (
    <div className={`gbars ${showValues ? "gbars-values" : ""}`}>
      {rows.map(row => (
        <div className="gbar-row" key={row.label}>
          <span className="gbar-label" title={row.label}>
            {row.label}
          </span>

          <div className="gbar-group">
            {series.map((item, index) => {
              const value = row.values[index]
              return (
                <div
                  className="gbar-track"
                  key={item.name}
                  aria-label={`${row.label}, ${item.name}: ${format(value)}${unit ? ` ${unit}` : ""}`}
                  {...bind({
                    title: row.label,
                    rows: series.map((s, i) => ({
                      color: s.color,
                      label: s.name,
                      value: format(row.values[i])
                    }))
                  })}
                >
                  <div
                    className="gbar"
                    style={{
                      width: `${(Math.max(0, value) / top) * 100}%`,
                      background: item.color
                    }}
                  />
                  {showValues && <span className="gbar-value">{format(value)}</span>}
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

// Bars that extend left or right of a zero line, for gains and losses per category.
export function DivergingBars({ rows, series, format }) {
  const [bind, tooltip] = useTooltip()
  const limit = Math.max(1e-9, ...rows.flatMap(row => row.values.map(Math.abs)))

  return (
    <div className="dbars">
      {rows.map(row => (
        <div className="gbar-row" key={row.label}>
          <span className="gbar-label" title={row.label}>
            {row.label}
          </span>

          <div className="gbar-group">
            {series.map((item, index) => {
              const value = row.values[index]
              const width = `${(Math.abs(value) / limit) * 50}%`

              return (
                <div
                  className="dbar-track"
                  key={item.name}
                  aria-label={`${row.label}, ${item.name}: ${format(value)}`}
                  {...bind({
                    title: row.label,
                    rows: series.map((s, i) => ({
                      color: s.color,
                      label: s.name,
                      value: format(row.values[i])
                    }))
                  })}
                >
                  <div
                    className={`dbar ${value < 0 ? "dbar-neg" : ""}`}
                    style={{ width, background: item.color }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div className="gbar-row dbar-axis" aria-hidden="true">
        <span />
        <div className="dbar-ticks">
          <span>{format(-limit)}</span>
          <span>0</span>
          <span>{format(limit)}</span>
        </div>
      </div>
      {tooltip}
    </div>
  )
}

// Legend for an arbitrary list of { name, color } series.
export function SeriesLegend({ series }) {
  return (
    <div className="legend">
      {series.map(item => (
        <span key={item.name}>
          <i style={{ background: item.color }} />
          {item.name}
        </span>
      ))}
    </div>
  )
}
