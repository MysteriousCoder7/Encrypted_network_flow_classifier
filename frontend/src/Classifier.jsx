import { useRef, useState } from "react"
import { Check, Download, FileSpreadsheet, Loader2, Trash2, TriangleAlert, UploadCloud, X } from "lucide-react"

import FlowDetail from "./FlowDetail"
import Insights from "./Insights"
import PacketStream from "./PacketStream"
import {
  API,
  MODELS,
  START_COMMAND,
  describeFlow,
  hasLabel,
  pct
} from "./models"

const ACCEPTED = [".parquet", ".csv"]

function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function isAccepted(file) {
  const name = file.name.toLowerCase()
  return ACCEPTED.some(extension => name.endsWith(extension))
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function Classifier({ backend, classCount, onBackendError, onBackendOk }) {
  const [queue, setQueue] = useState([])
  const [rejected, setRejected] = useState([])
  const [batch, setBatch] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  // Only scroll to the detail when the user picked a row, not on the automatic first pick.
  const userSelected = useRef(false)
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const addFiles = fileList => {
    const files = Array.from(fileList || [])
    if (!files.length) return

    setRejected(files.filter(file => !isAccepted(file)).map(file => file.name))

    setQueue(current => {
      const known = new Set(current.map(item => item.key))
      const additions = files
        .filter(isAccepted)
        .filter(file => !known.has(fileKey(file)))
        .map(file => ({ key: fileKey(file), file, report: null }))

      return [...current, ...additions]
    })
  }

  const removeFile = key => {
    setQueue(current => current.filter(item => item.key !== key))
  }

  const clearAll = () => {
    setQueue([])
    setRejected([])
    setBatch(null)
    setSelectedId(null)
    setError("")
  }

  const classify = async () => {
    if (!queue.length) return

    setLoading(true)
    setError("")
    setSelectedId(null)

    const sent = queue.map(item => item.key)
    const formData = new FormData()
    queue.forEach(item => formData.append("files", item.file))

    try {
      const response = await fetch(`${API}/predict-batch`, {
        method: "POST",
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        const detail = data.detail
        throw new Error(
          typeof detail === "string"
            ? detail
            : detail?.message || `The backend returned ${response.status}.`
        )
      }

      onBackendOk()

      // Reports come back in upload order, one per file sent.
      setQueue(current =>
        current.map(item => {
          const position = sent.indexOf(item.key)
          return position === -1 ? item : { ...item, report: data.files[position] }
        })
      )

      const flows = data.flows.map(describeFlow)
      setBatch({ ...data, flows })
      setFilter("all")

      // Open the first flow straight away so its full breakdown is visible.
      const first = flows.find(flow => !flow.error)
      userSelected.current = false
      if (first) setSelectedId(first.id)
    } catch (err) {
      if (err instanceof TypeError) {
        onBackendError()
        setError(
          `Couldn't reach the backend at ${API}. Start it from the project root with: ${START_COMMAND}`
        )
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const selected = batch?.flows.find(flow => flow.id === selectedId) || null

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-badge">
            <span className="pulse" aria-hidden="true" />
            Four-model ensemble with Fuzzy-GCD and IBNN
          </span>

          <h1>
            See what encrypted traffic <span className="grad-text">gives away</span>
          </h1>

          <p>
            Payloads are encrypted, but packet sizes and timing still reveal
            the application. Drop in flow files and compare four models side
            by side.
          </p>

          <dl className="hero-stats">
            <div>
              <dt>Models</dt>
              <dd>4</dd>
            </div>
            <div>
              <dt>Application classes</dt>
              <dd>{classCount ?? 35}</dd>
            </div>
            <div>
              <dt>Flow features</dt>
              <dd>21</dd>
            </div>
          </dl>
        </div>

        <PacketStream />
      </section>

      {backend === "offline" && (
        <div className="notice" role="alert">
          <TriangleAlert size={18} aria-hidden="true" />
          <div>
            <strong>The backend isn't running.</strong> Start it from the
            project root, then check again from the top bar:
            <code>{START_COMMAND}</code>
          </div>
        </div>
      )}

      <section className={`intake ${loading ? "is-loading" : ""}`} aria-label="Files to classify">
        {loading && <div className="progress" aria-hidden="true" />}

        <DropArea onFiles={addFiles} />

        <div className="queue">
          <div className="queue-head">
            <h2>Queue</h2>
            <span className="muted">
              {queue.length === 0
                ? "No files yet"
                : `${queue.length} ${queue.length === 1 ? "file" : "files"}`}
            </span>
          </div>

          {queue.length === 0 ? (
            <p className="queue-empty">
              Files you add appear here. Nothing is sent until you classify.
            </p>
          ) : (
            <ul className="queue-list">
              {queue.map(item => (
                <QueueItem
                  key={item.key}
                  item={item}
                  disabled={loading}
                  onRemove={() => removeFile(item.key)}
                />
              ))}
            </ul>
          )}

          {rejected.length > 0 && (
            <p className="queue-rejected">
              Not added, because only .parquet and .csv files can be
              classified: {rejected.join(", ")}
            </p>
          )}

          <div className="queue-actions">
            <button
              type="button"
              className="btn btn-quiet"
              onClick={clearAll}
              disabled={loading || (!queue.length && !batch)}
            >
              Clear
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={classify}
              disabled={loading || !queue.length}
            >
              {loading && <Loader2 size={16} className="spin" aria-hidden="true" />}
              {loading
                ? "Classifying…"
                : queue.length > 1
                  ? `Classify ${queue.length} files`
                  : "Classify"}
            </button>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>

      {batch && (
        <Results
          batch={batch}
          filter={filter}
          onFilter={setFilter}
          selectedId={selectedId}
          onSelect={id => {
            userSelected.current = true
            setSelectedId(id)
          }}
        />
      )}

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

function DropArea({ onFiles }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const openPicker = () => inputRef.current?.click()

  return (
    <div
      className={`drop ${dragging ? "is-dragging" : ""}`}
      onClick={openPicker}
      onDragOver={event => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setDragging(false)
        }
      }}
      onDrop={event => {
        event.preventDefault()
        setDragging(false)
        onFiles(event.dataTransfer.files)
      }}
    >
      <span className="drop-icon" aria-hidden="true">
        <UploadCloud size={30} />
      </span>

      <p className="drop-title">Drop flow files here</p>
      <p className="drop-hint">
        .parquet or .csv, one flow per row. Add as many files as you like.
      </p>

      <button
        type="button"
        className="btn"
        onClick={event => {
          event.stopPropagation()
          openPicker()
        }}
      >
        Choose files
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".parquet,.csv"
        hidden
        onChange={event => {
          onFiles(event.target.files)
          // Clear the input so choosing the same file again still fires onChange.
          event.target.value = ""
        }}
      />
    </div>
  )
}

function QueueItem({ item, disabled, onRemove }) {
  const { file, report } = item

  let status = <span className="muted">Ready</span>

  if (report?.error) {
    status = <span className="status-error">{report.error}</span>
  } else if (report) {
    status = (
      <span className="status-done">
        {report.rows} {report.rows === 1 ? "flow" : "flows"} read
      </span>
    )
  }

  return (
    <li className="queue-item">
      <span className={`queue-icon ${file.name.toLowerCase().endsWith(".csv") ? "is-csv" : ""}`} aria-hidden="true">
        <FileSpreadsheet size={17} />
      </span>

      <div className="queue-file">
        <span className="queue-name" title={file.name}>
          {file.name}
        </span>
        <span className="queue-meta">
          {formatSize(file.size)}, {status}
        </span>
      </div>

      <button
        type="button"
        className="icon-btn"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${file.name}`}
        title="Remove"
      >
        <Trash2 size={15} />
      </button>
    </li>
  )
}

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

function Results({ batch, filter, onFilter, selectedId, onSelect }) {
  const flows = batch.flows
  const scored = flows.filter(flow => !flow.error)
  const labelled = scored.filter(hasLabel)
  const errorCount = flows.length - scored.length
  const fileCount = batch.files.filter(file => !file.error).length

  const visibleFilters = filters.filter(item => {
    if (item.id === "wrong") return labelled.length > 0
    if (item.id === "errors") return errorCount > 0
    return true
  })

  const active = filters.find(item => item.id === filter) || filters[0]
  const rows = flows.filter(active.test)

  const unanimous = scored.filter(flow => flow.votes === MODELS.length).length

  if (!flows.length) {
    return (
      <section className="results">
        <p className="results-empty">
          No flows were classified. Check the errors next to each file in the
          queue.
        </p>
      </section>
    )
  }

  return (
    <section className="results" aria-label="Results">
      <div className="results-head">
        <div>
          <h2>Results</h2>
          <p className="muted">
            {scored.length} {scored.length === 1 ? "flow" : "flows"} classified
            from {fileCount} {fileCount === 1 ? "file" : "files"}.{" "}
            {scored.length > 0 &&
              `All four models agree on ${unanimous} of ${scored.length}.`}
            {errorCount > 0 && ` ${errorCount} could not be classified.`}
          </p>
          {batch.skipped > 0 && (
            <p className="muted">
              Only the first {batch.limit} flows are classified per run;{" "}
              {batch.skipped} more were skipped.
            </p>
          )}
        </div>

        <button
          type="button"
          className="btn"
          onClick={() => downloadCsv(scored)}
          disabled={!scored.length}
        >
          <Download size={16} aria-hidden="true" />
          Download CSV
        </button>
      </div>

      {scored.length > 0 && <Insights flows={scored} />}

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
            onClick={() => onFilter(item.id)}
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
                onSelect={() => onSelect(flow.id === selectedId ? null : flow.id)}
              />
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="results-empty">No flows match this filter.</p>
        )}
      </div>

    </section>
  )
}

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

function downloadCsv(flows) {
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
  link.download = "flowlens-results.csv"
  link.click()
  URL.revokeObjectURL(url)
}

export default Classifier
