import { useEffect, useRef, useState } from "react"
import {
  Check,
  CircleStop,
  FolderOpen,
  Loader2,
  Play,
  RotateCcw,
  Timer,
  X
} from "lucide-react"

import FlowResults from "./FlowResults"
import { BackendNotice } from "./Layout"
import PacketStream from "./PacketStream"
import results from "./data/results.json"
import { API, MODELS, START_COMMAND, describeFlow, hasLabel, pct } from "./models"

const SCENARIOS = [
  { id: "all", label: "All prepared flows", test: () => true },
  { id: "all_correct", label: "All four correct", test: sample => sample.group === "all_correct" },
  { id: "gcd_only", label: "Only GCD models correct", test: sample => sample.group === "gcd_only" }
]

const SPEEDS = [
  { id: "realtime", label: "Real time", stageMs: 300 },
  { id: "fast", label: "Fast", stageMs: 70 },
  { id: "instant", label: "Instant", stageMs: 0 }
]

// The inference stages the backend runs for every flow, shown as the flow passes through.
const STAGES = ["Read flow", "Scale 21 features", "Fuzzy-GCD", "Build 5 × 5 maps", "Run 4 models"]

const GROUP_TAGS = {
  all_correct: "All four correct",
  gcd_only: "GCD models only",
  other: "Prepared flow"
}

const PROTOCOLS = { 6: "TCP", 17: "UDP", 1: "ICMP" }

const REFERENCE = {
  label: `Full test set (${results.test_set.flows.toLocaleString()} flows)`,
  accuracy: results.test_set.accuracy
}

// Resolves after ms milliseconds; paces the real-time simulation.
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

// Dashboard page: hero plus the simulation, which replays the prepared test flows
// through the backend one at a time and then shows the full results.
function DashboardPage({ backend, classCount, onBackendError, onBackendOk }) {
  const [samples, setSamples] = useState(null)
  const [directory, setDirectory] = useState("")
  const [loadError, setLoadError] = useState("")
  const [scenario, setScenario] = useState("all")
  const [speed, setSpeed] = useState("realtime")
  const [run, setRun] = useState(null)
  const runRef = useRef(0)
  const consoleRef = useRef(null)

  useEffect(() => {
    if (backend !== "online" || samples) return

    fetch(`${API}/samples`)
      .then(response => response.json())
      .then(data => {
        setSamples(data.samples)
        setDirectory(data.directory)
        setLoadError("")
      })
      .catch(() => setLoadError(`Couldn't load the prepared flows from ${API}/samples.`))
  }, [backend, samples])

  // Stop any running simulation when leaving the page.
  useEffect(() => () => {
    runRef.current += 1
  }, [])

  const chosen = (samples || []).filter(SCENARIOS.find(item => item.id === scenario).test)
  const running = run?.status === "running"

  const classifySample = async (sample, index) => {
    const response = await fetch(
      `${API}/samples/${encodeURIComponent(sample.file_name)}/classify`,
      { method: "POST" }
    )
    const data = await response.json()

    if (!response.ok) {
      throw new Error(typeof data.detail === "string" ? data.detail : `The backend returned ${response.status}.`)
    }

    return data.flows.map((flow, row) => describeFlow(flow, index * 1000 + row))
  }

  const start = async () => {
    if (!chosen.length || running) return

    const id = runRef.current + 1
    runRef.current = id
    const active = () => runRef.current === id
    const stageMs = SPEEDS.find(item => item.id === speed).stageMs

    setRun({ id, status: "running", total: chosen.length, done: 0, flows: [], current: null, startedAt: Date.now() })
    consoleRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    })

    try {
      if (stageMs === 0) {
        const batches = await Promise.all(chosen.map(classifySample))
        if (!active()) return
        // Newest first, like the step-by-step modes.
        setRun(current => ({ ...current, flows: batches.flat().reverse(), done: chosen.length }))
      } else {
        for (const [index, sample] of chosen.entries()) {
          if (!active()) return

          const request = classifySample(sample, index)
          request.catch(() => {})

          for (let stage = 0; stage < STAGES.length; stage += 1) {
            if (!active()) return
            setRun(current => ({ ...current, current: { sample, stage, index } }))
            await wait(stageMs)
          }

          const flows = await request
          if (!active()) return
          setRun(current => ({ ...current, flows: [...flows, ...current.flows], done: index + 1 }))
        }
      }

      onBackendOk()
      setRun(current => ({ ...current, status: "done", current: null, finishedAt: Date.now() }))
    } catch (err) {
      if (!active()) return
      if (err instanceof TypeError) onBackendError()
      setRun(current => ({
        ...current,
        status: "error",
        current: null,
        error:
          err instanceof TypeError
            ? `Couldn't reach the backend at ${API}. Start it with: ${START_COMMAND}`
            : err.message
      }))
    }
  }

  const stop = () => {
    runRef.current += 1
    setRun(current => ({ ...current, status: "stopped", current: null, finishedAt: Date.now() }))
  }

  const reset = () => {
    runRef.current += 1
    setRun(null)
  }

  const finished = run && run.status !== "running" && run.flows.length > 0
  // Show flows in the order they were run, not newest first.
  const orderedFlows = finished ? [...run.flows].reverse() : []

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
            the application. Run the simulation to replay real test flows
            through all four models and watch how each one decides.
          </p>

          <div className="hero-actions">
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={start}
              disabled={running || !chosen.length}
            >
              <Play size={18} aria-hidden="true" />
              Run simulation
            </button>
            <a className="btn btn-lg" href="#/project">
              How it works
            </a>
          </div>

          <dl className="hero-stats">
            <div>
              <dt>Best test accuracy</dt>
              <dd>{pct(Math.max(...Object.values(results.test_set.accuracy)))}</dd>
            </div>
            <div>
              <dt>Test flows</dt>
              <dd>{results.test_set.flows.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Application classes</dt>
              <dd>{classCount ?? results.dataset.classes}</dd>
            </div>
          </dl>
        </div>

        <PacketStream />
      </section>

      {backend === "offline" && <BackendNotice />}

      <section className={`sim ${running ? "is-running" : ""}`} ref={consoleRef} aria-label="Simulation">
        {running && <div className="progress" aria-hidden="true" />}

        <header className="sim-head">
          <div>
            <h2>Simulation</h2>
            <p className="muted">
              Replays prepared test flows from the dataset through the live
              backend, one flow at a time, exactly as an uploaded file would be
              classified.
            </p>
          </div>

          {directory && (
            <span className="sim-source">
              <FolderOpen size={15} aria-hidden="true" />
              {directory}, {samples?.length ?? 0} files
            </span>
          )}
        </header>

        <div className="sim-controls">
          <div className="control">
            <span className="control-label">Scenario</span>
            <div className="segmented" role="group" aria-label="Scenario">
              {SCENARIOS.map(item => {
                const count = (samples || []).filter(item.test).length
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={scenario === item.id}
                    disabled={running}
                    onClick={() => setScenario(item.id)}
                  >
                    {item.label}
                    <span className="chip-count">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="control">
            <span className="control-label">Speed</span>
            <div className="segmented" role="group" aria-label="Speed">
              {SPEEDS.map(item => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={speed === item.id}
                  disabled={running}
                  onClick={() => setSpeed(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sim-buttons">
            {running ? (
              <button type="button" className="btn" onClick={stop}>
                <CircleStop size={16} aria-hidden="true" />
                Stop
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={start}
                disabled={!chosen.length || backend === "offline"}
              >
                <Play size={16} aria-hidden="true" />
                {run ? "Run again" : `Run ${chosen.length} flows`}
              </button>
            )}
            {run && !running && (
              <button type="button" className="btn btn-quiet" onClick={reset}>
                <RotateCcw size={16} aria-hidden="true" />
                Reset
              </button>
            )}
          </div>
        </div>

        {loadError && <p className="form-error">{loadError}</p>}
        {samples && samples.length === 0 && (
          <p className="empty-note">
            No prepared flows found in {directory}. Run <code>python analyse.py</code> or
            copy single-flow .parquet files into that folder.
          </p>
        )}
        {run?.error && <p className="form-error" role="alert">{run.error}</p>}

        <div className="sim-status">
          <Progress run={run} total={chosen.length} />
          <NowClassifying run={run} />
          <LiveScores flows={run?.flows || []} />
        </div>

        <Feed run={run} chosen={chosen} />
      </section>

      {finished && (
        <FlowResults
          key={run.id}
          title="Simulation results"
          flows={orderedFlows}
          summary={`${orderedFlows.length} prepared test flows classified${run.status === "stopped" ? " before the run was stopped" : ""}.`}
          note="Each scorecard also shows the model's accuracy on the full test set, for comparison with this sample."
          reference={REFERENCE}
          csvName="flowlens-simulation.csv"
        />
      )}

      <SampleContext />
    </>
  )
}

// Simulation progress: flows done out of total, run state and elapsed time.
function Progress({ run, total }) {
  const done = run?.done ?? 0
  const count = run?.total ?? total
  const seconds = run?.finishedAt ? ((run.finishedAt - run.startedAt) / 1000).toFixed(1) : null

  const status = {
    running: "Running",
    done: "Complete",
    stopped: "Stopped",
    error: "Failed"
  }[run?.status] ?? "Ready"

  return (
    <div className="sim-card">
      <span className="sim-card-label">Progress</span>
      <div className="sim-count">
        <strong>{done}</strong>
        <span>/ {count} flows</span>
      </div>
      <div className="meter meter-grad" aria-hidden="true">
        <div style={{ width: `${count ? (done / count) * 100 : 0}%` }} />
      </div>
      <span className={`sim-state sim-state-${run?.status ?? "idle"}`}>
        {run?.status === "running" && <Loader2 size={14} className="spin" aria-hidden="true" />}
        {run?.status === "done" && <Check size={14} aria-hidden="true" />}
        {status}
        {seconds && (
          <span className="muted">
            <Timer size={13} aria-hidden="true" /> {seconds} s
          </span>
        )}
      </span>
    </div>
  )
}

// The flow currently in the pipeline and which inference stage it has reached.
function NowClassifying({ run }) {
  const current = run?.current

  return (
    <div className="sim-card sim-now">
      <span className="sim-card-label">Now classifying</span>
      {current ? (
        <>
          <strong className="sim-now-label">{current.sample.label || current.sample.file_name}</strong>
          <span className="muted sim-now-file" title={current.sample.file_name}>
            Test flow #{current.sample.test_position ?? "–"}, {GROUP_TAGS[current.sample.group]}
          </span>
          <ol className="stages">
            {STAGES.map((stage, index) => (
              <li
                key={stage}
                className={index < current.stage ? "is-done" : index === current.stage ? "is-active" : ""}
              >
                <span aria-hidden="true" />
                {stage}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="muted sim-idle">
          {run?.status === "done"
            ? "All flows classified. Scroll down for the insights."
            : "Choose a scenario and run the simulation."}
        </p>
      )}
    </div>
  )
}

// Running accuracy of each model over the labelled flows classified so far.
function LiveScores({ flows }) {
  const labelled = flows.filter(flow => !flow.error && hasLabel(flow))

  return (
    <div className="sim-card">
      <span className="sim-card-label">Live accuracy</span>
      <ul className="live-scores">
        {MODELS.map((model, index) => {
          const correct = labelled.filter(flow => flow.correct[index]).length
          const share = labelled.length ? correct / labelled.length : 0

          return (
            <li key={model.name} style={{ "--model": model.color }}>
              <span className="live-name">
                <i />
                {model.name}
              </span>
              <span className="live-bar" aria-hidden="true">
                <span style={{ width: `${share * 100}%` }} />
              </span>
              <b>{labelled.length ? pct(share, 0) : "–"}</b>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Before a run, the flows queued for the chosen scenario; during and after it, the
// live feed of classified flows, newest first.
function Feed({ run, chosen }) {
  if (!run) {
    return (
      <div className="queue-preview">
        <span className="sim-card-label">Up next</span>
        <ul>
          {chosen.map(sample => (
            <li key={sample.file_name} className={`tag tag-${sample.group}`} title={sample.file_name}>
              {sample.label || sample.file_name}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="feed-wrap">
      <span className="sim-card-label">Live feed</span>
      {run.flows.length === 0 ? (
        <p className="muted feed-empty">Classified flows appear here as they finish.</p>
      ) : (
        <ol className="feed" aria-live="polite">
          {run.flows.map(flow => (
            <FeedItem key={flow.id} flow={flow} />
          ))}
        </ol>
      )}
    </div>
  )
}

// One classified flow in the feed: true label, group, connection details and
// each model's prediction marked right or wrong.
function FeedItem({ flow }) {
  if (flow.error) {
    return (
      <li className="feed-item">
        <span className="status-error">{flow.file_name}: {flow.error}</span>
      </li>
    )
  }

  const context = flow.context || {}
  const endpoint = context.dst_ip ? `${context.dst_ip}:${context.dst_port}` : ""
  const protocol = PROTOCOLS[context.protocol] || (context.protocol ? `Protocol ${context.protocol}` : "")

  return (
    <li className="feed-item">
      <div className="feed-main">
        <div className="feed-title">
          <strong>{flow.flow.true_label || "Unlabelled flow"}</strong>
          <span className={`tag tag-${flow.group}`}>{GROUP_TAGS[flow.group]}</span>
        </div>
        <span className="feed-meta">
          {[context.requested_server_name, endpoint, protocol, context.bidirectional_packets && `${context.bidirectional_packets} packets`]
            .filter(Boolean)
            .join(", ")}
        </span>
      </div>

      <div className="feed-models">
        {MODELS.map((model, index) => {
          const correct = flow.correct[index]
          return (
            <span
              key={model.name}
              className={`pred ${correct === true ? "pred-right" : ""} ${correct === false ? "pred-wrong" : ""}`}
              style={{ "--model": model.color }}
              title={`${model.name}: ${flow.outputs[model.name].class}, ${pct(flow.outputs[model.name].confidence)}`}
            >
              {correct === true && <Check size={13} aria-label="Correct" />}
              {correct === false && <X size={13} aria-label="Wrong" />}
              {flow.outputs[model.name].class}
            </span>
          )
        })}
      </div>
    </li>
  )
}

// Explains where the prepared flows come from, with the full test set's split
// into all-correct, GCD-only, baseline-only and all-wrong flows.
function SampleContext() {
  const test = results.test_set
  const share = value => pct(value / test.flows)

  return (
    <section className="context-band" aria-label="About the prepared flows">
      <div>
        <h3>Where these flows come from</h3>
        <p className="muted">
          The prepared files are single flows taken from the {test.flows.toLocaleString()}-flow
          test split. They are grouped by how the four models did on them in the
          full evaluation.
        </p>
      </div>

      <dl className="context-stats">
        <div>
          <dt>All four models correct</dt>
          <dd>{test.all_four_correct.toLocaleString()}</dd>
          <span>{share(test.all_four_correct)} of test flows</span>
        </div>
        <div>
          <dt>Only the GCD models correct</dt>
          <dd>{test.gcd_only_correct.toLocaleString()}</dd>
          <span>{share(test.gcd_only_correct)}, where Fuzzy-GCD helps</span>
        </div>
        <div>
          <dt>Only the baselines correct</dt>
          <dd>{test.baseline_only_correct.toLocaleString()}</dd>
          <span>{share(test.baseline_only_correct)}, where it hurts</span>
        </div>
        <div>
          <dt>All four wrong</dt>
          <dd>{test.all_four_wrong.toLocaleString()}</dd>
          <span>{share(test.all_four_wrong)} of test flows</span>
        </div>
      </dl>
    </section>
  )
}

export default DashboardPage
