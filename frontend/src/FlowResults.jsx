import { useRef, useState } from "react"
import { Check, Download, X } from "lucide-react"

import FlowDetail from "./FlowDetail"
import Insights from "./Insights"
import { MODELS, hasLabel, pct } from "./models"

const filters = [
  { id: "all", label: "All flows", test: () => true },
  {
    id: "wrong",
    label: "Misclassified",
    test: flow => !flow.error && flow.correct.some(value => value === false)
  },
  {
    id: "split",
    label: "Models disagree",
    test: flow => !flow.error && flow.votes < MODELS.length
  },
  { id: "errors", label: "Errors", test: flow => Boolean(flow.error) }
]

// Shared results view: insights, the filterable flow table, CSV export and the
// selected flow's breakdown. Remount it (new key) per run to reset the selection.
function FlowResults({ flows, title = "Results", summary, note, reference, csvName = "flowlens-results.csv" }) {
  const [filter, setFilter] = useState("all")
  const [selectedId, setSelectedId] = useState(() => flows.find(flow => !flow.error)?.id ?? null)
  // Only scroll to the detail when the user picked a row, not on the automatic first pick.
  const userSelected = useRef(false)

  const scored = flows.filter(flow => !flow.error)
  const labelled = scored.filter(hasLabel)
  const errorCount = flows.length - scored.length

  const visibleFilters = filters.filter(item => {
    if (item.id === "wrong") return labelled.length > 0
    if (item.id === "errors") return errorCount > 0
    return true
  })

  const active = filters.find(item => item.id === filter) || filters[0]
  const rows = flows.filter(active.test)

  const unanimous = scored.filter(flow => flow.votes === MODELS.length).length
  const selected = flows.find(flow => flow.id === selectedId) || null

  const select = id => {
    userSelected.current = true
    setSelectedId(current => (current === id ? null : id))
  }

  if (!flows.length) {
    return (
      <section className="results">
        <p className="results-empty">No flows were classified.</p>
      </section>
    )
  }

  return (
    <>
    <section className="results" aria-label={title}>
      <div className="results-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">
            {summary ?? `${scored.length} ${scored.length === 1 ? "flow" : "flows"} classified.`}{" "}
            {scored.length > 0 &&
              `All four models agree on ${unanimous} of ${scored.length}.`}
            {errorCount > 0 && ` ${errorCount} could not be classified.`}
          </p>
          {note && <p className="muted">{note}</p>}
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => downloadCsv(scored, csvName)}
          disabled={!scored.length}
        >
          <Download size={16} aria-hidden="true" />
          Download CSV
        </button>
      </div>

      {scored.length > 0 && <Insights flows={scored} reference={reference} />}

      <div className="section-title">
        <h3>Every flow</h3>
        <p className="muted">Select a row to open its full breakdown below the table.</p>
      </div>

      <div className="filters" role="group" aria-label="Filter flows">
        {visibleFilters.map(item => (
          <button
            key={item.id}
            type="button"
            className="chip"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            <span className="chip-count">{flows.filter(item.test).length}</span>
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="flows">
          <thead>
            <tr>
              <th scope="col">Flow</th>
              <th scope="col">True label</th>
              {MODELS.map(model => (
                <th scope="col" key={model.name}>
                  <span className="swatch" style={{ background: model.color }} />
                  {model.name}
                </th>
              ))}
              <th scope="col">Agreement</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(flow => (
              <FlowRow
                key={flow.id}
                flow={flow}
                selected={flow.id === selectedId}
                onSelect={() => select(flow.id)}
              />
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="results-empty">No flows match this filter.</p>
        )}
      </div>
    </section>

    {selected && (
      <FlowDetail
        key={selected.id}
        flow={selected}
        scrollOnOpen={userSelected.current}
        onClose={() => setSelectedId(null)}
      />
    )}
    </>
  )
}

// One table row: flow name and source, true label, each model's prediction and
// confidence, and agreement. Rows are clickable and keyboard selectable.
function FlowRow({ flow, selected, onSelect }) {

  const name = flow.flow?.flow_id || `Row ${flow.row + 1}`
  const source = `${flow.file_name}, row ${flow.row + 1}`

  if (flow.error) {
    return (
      <tr className="row-error">
        <td>
          <span className="flow-name">{name}</span>
          <span className="flow-source">{source}</span>
        </td>
        <td colSpan={MODELS.length + 2} className="status-error">
          {flow.error}
        </td>
      </tr>
    )
  }

  const label = flow.flow.true_label

  return (
    <tr
      className="row"
      tabIndex={0}
      aria-selected={selected}
      onClick={onSelect}
      onKeyDown={event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <td>
        <span className="flow-name">{name}</span>
        <span className="flow-source">{source}</span>
      </td>

      <td className={label ? "" : "muted"}>{label || "Not given"}</td>

      {MODELS.map((model, index) => {
        const output = flow.outputs[model.name]
        const correct = flow.correct[index]

        return (
          <td key={model.name}>
            <span
              className={`pred ${correct === true ? "pred-right" : ""} ${correct === false ? "pred-wrong" : ""}`}
              style={{ "--model": model.color }}
            >
              {correct === true && <Check size={13} aria-label="Correct" />}
              {correct === false && <X size={13} aria-label="Wrong" />}
              {output.class}
            </span>
            <span className="pred-conf">{pct(output.confidence)}</span>
          </td>
        )
      })}

      <td>
        <Agreement flow={flow} />
      </td>
    </tr>
  )
}

// Four pips coloured for the models that agree with the majority class, plus the count.
function Agreement({ flow }) {
  return (
    <span className="agreement" title={`${flow.votes} of 4 models predict ${flow.majority}`}>
      <span className="pips" aria-hidden="true">
        {MODELS.map(model => {
          const agrees = flow.outputs[model.name].class === flow.majority
          return (
            <span
              key={model.name}
              className="pip"
              style={agrees ? { background: model.color, borderColor: model.color } : undefined}
            />
          )
        })}
      </span>
      {flow.votes} of 4
    </span>
  )
}

// Builds a CSV of every classified flow's predictions and confidences and starts
// a download in the browser.
function downloadCsv(flows, fileName) {
  const header = [
    "file",
    "row",
    "flow_id",
    "true_label",
    ...MODELS.flatMap(model => [`${model.name} class`, `${model.name} confidence`]),
    "models_agreeing"
  ]

  const escape = value => {
    const text = String(value ?? "")
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const lines = flows.map(flow =>
    [
      flow.file_name,
      flow.row + 1,
      flow.flow.flow_id,
      flow.flow.true_label,
      ...MODELS.flatMap(model => [
        flow.outputs[model.name].class,
        flow.outputs[model.name].confidence.toFixed(4)
      ]),
      flow.votes
    ]
      .map(escape)
      .join(",")
  )

  const blob = new Blob([[header.map(escape).join(","), ...lines].join("\n")], {
    type: "text/csv"
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export default FlowResults
