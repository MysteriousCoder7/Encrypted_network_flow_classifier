import { useState } from "react"
import {
  Activity,
  Brain,
  Calculator,
  CheckCircle2,
  ChevronRight,
  FileArchive,
  Gauge,
  Info,
  Network,
  Upload,
  Zap
} from "lucide-react"

const API = "http://localhost:8000"

const modelInfo = {
  "No-IBNN": {
    description: "Baseline convolutional classifier without the information bottleneck."
  },
  "IBNN": {
    description: "Convolutional encoder followed by the stochastic information bottleneck."
  },
  "Fuzzy-GCD": {
    description: "Baseline classifier using fuzzy-GCD packet-size features."
  },
  "Fuzzy-GCD + IBNN": {
    description: "Fuzzy-GCD preprocessing followed by the information bottleneck classifier."
  }
}

function App() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState("classifier")
  const [dragging, setDragging] = useState(false)

  const selectFile = selectedFile => {
    if (!selectedFile) return

    if (!selectedFile.name.toLowerCase().endsWith(".parquet")) {
      setError("Please select a .parquet file.")
      return
    }

    setFile(selectedFile)
    setResult(null)
    setError("")
  }

  const handleFileInput = event => {
    selectFile(event.target.files?.[0])
  }

  const handleDrop = event => {
    event.preventDefault()
    setDragging(false)
    selectFile(event.dataTransfer.files?.[0])
  }

  const classify = async () => {
    if (!file) {
      setError("Select a parquet flow file first.")
      return
    }

    setLoading(true)
    setError("")
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch(`${API}/predict-file`, {
        method: "POST",
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        if (typeof data.detail === "string") {
          throw new Error(data.detail)
        }

        if (data.detail?.message) {
          throw new Error(data.detail.message)
        }

        throw new Error("Prediction failed.")
      }

      setResult(data)
    } catch (err) {
      setError(
        err.message ||
        "Cannot connect to the backend. Start FastAPI on port 8000."
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">
            <Network size={22} />
          </div>

          <div>
            <div className="brandTitle">
              FlowLens
              <span className="version-tag">v2.4</span>
            </div>
            <div className="brandSub">
              Encrypted Traffic Classification
            </div>
          </div>
        </div>

        <div className="status">
          <span></span>
          Model ensemble ready
        </div>
      </header>

      <main>
        <section className="hero">
          <div>
            <div className="eyebrow">NETWORK INTELLIGENCE</div>

            <h1>Encrypted traffic classifier</h1>

            <p>
              Upload a trained-format network flow and inspect the predictions
              from No-IBNN, IBNN, Fuzzy-GCD, and Fuzzy-GCD + IBNN.
            </p>
          </div>

          <div className="heroIcon">
            <Gauge size={44} />
          </div>
        </section>

        <nav className="tabs">
          <button
            className={tab === "classifier" ? "active" : ""}
            onClick={() => setTab("classifier")}
          >
            <Activity size={17} />
            Classifier
          </button>

          <button
            className={tab === "gcd" ? "active" : ""}
            onClick={() => setTab("gcd")}
          >
            <Calculator size={17} />
            Fuzzy-GCD
          </button>

          <button
            className={tab === "ib" ? "active" : ""}
            onClick={() => setTab("ib")}
          >
            <Brain size={17} />
            Information Bottleneck
          </button>
        </nav>

        {tab === "classifier" && (
          <>
            <section className="uploadSection">
              <div
                className={`dropZone ${dragging ? "dragging" : ""} ${
                  file ? "hasFile" : ""
                }`}
                onDragOver={event => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <div className="dropIcon">
                  {file ? (
                    <FileArchive size={30} />
                  ) : (
                    <Upload size={30} />
                  )}
                </div>

                <div className="dropContent">
                  {file ? (
                    <>
                      <strong>{file.name}</strong>
                      <span>
                        {(file.size / 1024).toFixed(1)} KB · Parquet flow
                        selected
                      </span>
                    </>
                  ) : (
                    <>
                      <strong>Drop a Parquet flow here</strong>
                      <span>
                        Upload one flow exported from the test dataset
                      </span>
                    </>
                  )}
                </div>

                <div className="uploadActionsRow">
                  <label className="uploadBtn">
                    <Upload size={16} />
                    Browse
                    <input
                      type="file"
                      accept=".parquet"
                      onChange={handleFileInput}
                    />
                  </label>
                </div>
              </div>

              <button
                className="classifyBtn"
                onClick={classify}
                disabled={loading || !file}
              >
                {loading ? "Running inference..." : "Run classification"}
                <ChevronRight size={18} />
              </button>

              {error && (
                <div className="error">
                  <Info size={17} />
                  {error}
                </div>
              )}
            </section>

            {!result && (
              <section className="panel emptyPanel">
                <div className="empty">
                  <Zap size={28} />
                  <strong>No prediction yet</strong>
                  <span>
                    Select a parquet flow and run the four-model inference
                    pipeline.
                  </span>
                </div>
              </section>
            )}

            {result && <PredictionDashboard result={result} />}
          </>
        )}

        {tab === "gcd" && <GcdTab />}

        {tab === "ib" && <IbTab />}
      </main>
    </div>
  )
}

function PredictionDashboard({ result }) {
  const flowId = result.flow?.flow_id ?? "Unknown"
  const trueLabel = result.flow?.true_label ?? "Unknown"

  const gcd = result.gcd || {}
  const raw = gcd.raw || {}
  const scaled = gcd.scaled || []
  const replacementIndices = gcd.replacement_indices || []

  return (
    <div className="dashboard">
      <section className="flowBanner">
        <div>
          <div className="panelKicker">FLOW IDENTIFIER</div>
          <div className="flowId">{flowId}</div>
        </div>

        <div className="trueLabel">
          <span>TRUE LABEL</span>
          <strong>{trueLabel}</strong>
        </div>

        <div className="flowStatus">
          <CheckCircle2 size={18} />
          Inference complete
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">MODEL ENSEMBLE</div>
            <h2>Classification results</h2>
          </div>

          <div className="resultBadge">4 MODELS</div>
        </div>

        <div className="modelGrid">
          {Object.entries(result.outputs || {}).map(([name, output]) => {
            const matches = output.class === trueLabel

            return (
              <div
                className={`modelCard ${matches ? "modelMatch" : ""}`}
                key={name}
              >
                <div className="modelCardTop">
                  <div className="modelName">{name}</div>

                  <div className="confidence">
                    {pct(output.confidence)}
                  </div>
                </div>

                <div className="prediction">
                  {output.class}
                </div>

                <div className="bar">
                  <div
                    style={{
                      width: `${output.confidence * 100}%`
                    }}
                  />
                </div>

                <div className="modelBottom">
                  <span>{modelInfo[name]?.description}</span>

                  <strong className={matches ? "match" : "mismatch"}>
                    {matches ? "MATCH" : "DIFFERENT"}
                  </strong>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="dataGrid">
        <GcdMetrics raw={raw} />

        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">TRANSFORMATION</div>
              <h2>Replacement indices</h2>
            </div>
          </div>

          <div className="replacementList">
            {replacementIndices.map((index, position) => (
              <div className="replacementItem" key={`${index}-${position}`}>
                <span>GCD feature {position + 1}</span>
                <strong>
                  outer feature index {index}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="dataGrid">
        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">GCD FEATURE VECTOR</div>
              <h2>Scaled representation</h2>
            </div>
          </div>

          <div className="vector">
            {scaled.map((value, index) => (
              <div className="vectorCell" key={index}>
                <span>{index}</span>
                <strong>{Number(value).toFixed(5)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelKicker">FEATURE MAP</div>
              <h2>GCD 5 × 5 input</h2>
            </div>
          </div>

          <Heatmap matrix={result.maps?.gcd} />
        </section>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <div className="panelKicker">INPUT REPRESENTATION</div>
            <h2>Normal 5 × 5 feature map</h2>
          </div>
        </div>

        <Heatmap matrix={result.maps?.normal} />
      </section>

      <section className="pipeline">
        <div className="pipelineStep">
          <span>01</span>
          <strong>Parquet flow</strong>
          <small>Original test flow</small>
        </div>

        <ChevronRight size={18} />

        <div className="pipelineStep">
          <span>02</span>
          <strong>StandardScaler</strong>
          <small>21 trained features</small>
        </div>

        <ChevronRight size={18} />

        <div className="pipelineStep">
          <span>03</span>
          <strong>Fuzzy-GCD</strong>
          <small>4 packet-size features</small>
        </div>

        <ChevronRight size={18} />

        <div className="pipelineStep">
          <span>04</span>
          <strong>5 × 5 maps</strong>
          <small>Zero-padded representation</small>
        </div>

        <ChevronRight size={18} />

        <div className="pipelineStep">
          <span>05</span>
          <strong>4 models</strong>
          <small>Final classification</small>
        </div>
      </section>
    </div>
  )
}

function GcdMetrics({ raw }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <div>
          <div className="panelKicker">FUZZY-GCD ANALYSIS</div>
          <h2>Raw GCD features</h2>
        </div>

        <Calculator size={21} />
      </div>

      <div className="gcdSummary">
        <div>
          <span>Best k</span>
          <strong>{Number(raw.best_k ?? 0).toFixed(0)}</strong>
        </div>

        <div>
          <span>Mean residual</span>
          <strong>
            {Number(raw.mean_residual ?? 0).toFixed(4)}
          </strong>
        </div>

        <div>
          <span>Normalized residual</span>
          <strong>
            {Number(raw.normalized_residual ?? 0).toFixed(4)}
          </strong>
        </div>

        <div>
          <span>Within tolerance</span>
          <strong>
            {pct(raw.within_tolerance_fraction ?? 0)}
          </strong>
        </div>
      </div>
    </section>
  )
}

function Heatmap({ matrix }) {
  if (!matrix || !matrix.length) {
    return (
      <div className="mapEmpty">
        No feature map returned by backend.
      </div>
    )
  }

  const flat = matrix.flat().map(Number)
  const min = Math.min(...flat)
  const max = Math.max(...flat)

  return (
    <div className="heatmap">
      {matrix.map((row, rowIndex) =>
        row.map((value, columnIndex) => {
          const numeric = Number(value)
          const normalized =
            max === min ? 0.5 : (numeric - min) / (max - min)

          return (
            <div
              className="heatCell"
              key={`${rowIndex}-${columnIndex}`}
              style={{
                opacity: 0.25 + normalized * 0.75
              }}
              title={`[${rowIndex}, ${columnIndex}] ${numeric.toFixed(5)}`}
            >
              {numeric.toFixed(2)}
            </div>
          )
        })
      )}
    </div>
  )
}

function GcdTab() {
  return (
    <section className="explain">
      <div className="explainHero">
        <div className="explainIcon">
          <Calculator size={30} />
        </div>

        <div>
          <div className="eyebrow">FUZZY-GCD</div>

          <h2>Approximate repeated packet-size structure</h2>

          <p>
            The transformation searches for a k such that packet sizes are
            close to integer multiples of k, allowing a small residual instead
            of requiring an exact mathematical GCD.
          </p>
        </div>
      </div>

      <div className="formula">
        packet size ≈ n × k + residual
      </div>

      <div className="explainGrid">
        <InfoCard
          title="1. Search k"
          text="For k from 8 through 256, each packet size is compared with its nearest positive integer multiple of k."
        />

        <InfoCard
          title="2. Measure residual"
          text="The absolute difference between each observed packet size and its nearest multiple is calculated."
        />

        <InfoCard
          title="3. Select best k"
          text="The k with the smallest mean residual is selected as the fuzzy common divisor."
        />

        <InfoCard
          title="4. Build features"
          text="The model receives k, mean residual, normalized residual, and the fraction within a tolerance of 4 bytes."
        />
      </div>
    </section>
  )
}

function IbTab() {
  return (
    <section className="explain">
      <div className="explainHero">
        <div className="explainIcon">
          <Brain size={30} />
        </div>

        <div>
          <div className="eyebrow">INFORMATION BOTTLENECK</div>

          <h2>Keep information useful for the label</h2>

          <p>
            The IBNN introduces a stochastic latent representation and adds a
            mutual-information estimate to the classification objective.
          </p>
        </div>
      </div>

      <div className="formula">
        Loss = Cross-Entropy + β × MI + L2
      </div>

      <div className="explainGrid">
        <InfoCard
          title="Compression"
          text="The bottleneck discourages the latent representation from retaining unnecessary information from the input."
        />

        <InfoCard
          title="Prediction"
          text="Cross-entropy forces the latent representation to preserve information useful for predicting the application class."
        />

        <InfoCard
          title="Trade-off β"
          text="β controls the compression-versus-prediction trade-off. Larger β puts more pressure on the information term."
        />

        <InfoCard
          title="Model comparison"
          text="No-IBNN and IBNN use the same convolutional encoder and classifier dimensions; the substantive difference is the stochastic IB layer and MI term."
        />
      </div>
    </section>
  )
}

function InfoCard({ title, text }) {
  return (
    <div className="infoCard">
      <div className="infoTitle">{title}</div>
      <p>{text}</p>
    </div>
  )
}

function pct(value) {
  return `${(Number(value) * 100).toFixed(1)}%`
}

export default App
