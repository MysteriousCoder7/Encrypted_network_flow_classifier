import { useRef, useState } from "react"
import { FileSpreadsheet, Loader2, Trash2, UploadCloud } from "lucide-react"

import FlowResults from "./FlowResults"
import { BackendNotice, PageHeader } from "./Layout"
import { API, START_COMMAND, describeFlow } from "./models"

const ACCEPTED = [".parquet", ".csv"]

// Identifies a file by name, size and modification time so the same file isn't queued twice.
function fileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

// True for .parquet and .csv files, the formats the backend can read.
function isAccepted(file) {
  const name = file.name.toLowerCase()
  return ACCEPTED.some(extension => name.endsWith(extension))
}

// Formats a file size in B, KB or MB.
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Upload page: queue Parquet or CSV files, send them to /predict-batch in one
// request, and show the shared results view.
function UploadPage({ backend, onBackendError, onBackendOk }) {
  const [queue, setQueue] = useState([])
  const [rejected, setRejected] = useState([])
  const [batch, setBatch] = useState(null)
  const [runs, setRuns] = useState(0)
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
    setError("")
  }

  const classify = async () => {
    if (!queue.length) return

    setLoading(true)
    setError("")

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

      setBatch({ ...data, flows: data.flows.map(describeFlow) })
      setRuns(count => count + 1)
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

  const fileCount = batch?.files.filter(file => !file.error).length ?? 0

  return (
    <>
      <PageHeader
        icon={UploadCloud}
        title="Classify your own flows"
        text="Upload Parquet or CSV flow files. Every row is one flow, and each flow is scored by all four models with the same insights as the dashboard."
      />

      {backend === "offline" && <BackendNotice />}

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
        <FlowResults
          key={runs}
          flows={batch.flows}
          summary={`${batch.flows.filter(flow => !flow.error).length} flows classified from ${fileCount} ${fileCount === 1 ? "file" : "files"}.`}
          note={
            batch.skipped > 0
              ? `Only the first ${batch.limit} flows are classified per run; ${batch.skipped} more were skipped.`
              : undefined
          }
        />
      )}
    </>
  )
}

// Drop zone and file picker. The whole area is clickable, and the input is reset
// after each pick so choosing the same file again still works.
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

// One queued file with its size, read status or error, and a remove button.
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

export default UploadPage
