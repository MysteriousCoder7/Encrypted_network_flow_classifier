import { useEffect, useRef } from "react"
import {
  ArrowDownUp,
  BarChart3,
  Check,
  ChevronRight,
  Crosshair,
  Gauge,
  Handshake,
  Package,
  Timer,
  Workflow,
  X
} from "lucide-react"

import { GroupedBars, ModelLegend, Panel, StatTile } from "./Charts"
import {
  GCD_FEATURES,
  GCD_TOLERANCE,
  MODELS,
  featureLabel,
  featureValue,
  formatBytes,
  formatDuration,
  formatNumber,
  mean,
  pct,
  topPredictions,
  uncertainty
} from "./models"

// Full breakdown of one flow: summary, pipeline, each model's vote, probability
// comparison, traffic profile, packet sizes with Fuzzy-GCD, and the model inputs.
function FlowDetail({ flow, onClose, scrollOnOpen }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!scrollOnOpen) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
  }, [scrollOnOpen])

  const label = flow.flow.true_label
  const name = flow.flow.flow_id || `Row ${flow.row + 1}`
  const meanConfidence = mean(MODELS.map(model => flow.outputs[model.name].confidence))
  const majorityRight = label ? flow.majority === label : null

  return (
    <section className="detail" ref={ref} aria-label={`Flow ${name}`}>
      <div className="detail-head">
        <div>
          <h2>{name}</h2>
          <p className="muted">
            {flow.file_name}, row {flow.row + 1}
            {label ? `. True label: ` : ". No true label in the file."}
            {label && <strong className="detail-label">{label}</strong>}
          </p>
        </div>

        <button type="button" className="btn btn-quiet" onClick={onClose}>
          <X size={16} aria-hidden="true" />
          Close
        </button>
      </div>

      <div className="kpis kpis-4">
        <StatTile
          icon={Handshake}
          label="Consensus"
          value={flow.majority}
          note={`${flow.votes} of 4 models agree`}
          tone="accent"
        />
        <StatTile icon={Gauge} label="Mean confidence" value={pct(meanConfidence, 0)} note="Across the four models" />
        <StatTile
          icon={Crosshair}
          label="Against true label"
          value={majorityRight === null ? "No label" : majorityRight ? "Correct" : "Wrong"}
          note={
            label
              ? `${flow.correct.filter(Boolean).length} of 4 models correct`
              : "Add application_name to check"
          }
          tone={majorityRight === null ? undefined : majorityRight ? "good" : "bad"}
        />
        <StatTile
          icon={Package}
          label="Packets observed"
          value={flow.packet_sizes.length}
          note={`k = ${formatNumber(flow.gcd.raw.best_k)} bytes`}
        />
      </div>

      <Pipeline flow={flow} />

      <div className="votes">
        {MODELS.map((model, index) => (
          <ModelVote
            key={model.name}
            model={model}
            output={flow.outputs[model.name]}
            correct={flow.correct[index]}
          />
        ))}
      </div>

      <div className="detail-grid">
        <Panel
          icon={BarChart3}
          title="How the models split their probability"
          subtitle="Every class that appears in any model's top three"
        >
          <ModelLegend />
          <ProbabilityComparison flow={flow} />
        </Panel>

        <Panel icon={ArrowDownUp} title="Traffic profile" subtitle="Raw flow statistics from the file">
          <TrafficProfile flow={flow} />
        </Panel>
      </div>

      <div className="block">
        <div className="block-head">
          <h3>Packet sizes and fuzzy-GCD</h3>
          <p className="muted">
            Each bar is one packet. Fuzzy-GCD looks for the unit k that packet
            sizes cluster around. Teal bars sit within {GCD_TOLERANCE} bytes of a
            multiple of k; violet bars fall outside that tolerance.
          </p>
        </div>

        <PacketRhythm sizes={flow.packet_sizes} k={flow.gcd.raw.best_k} />
        <GcdStats raw={flow.gcd.raw} />
      </div>

      <div className="block">
        <div className="block-head">
          <h3>What the models received</h3>
          <p className="muted">
            The 21 flow features are scaled and laid out on a 5 × 5 grid
            (the last four cells are padding). The Fuzzy-GCD models get the
            same grid with four cells swapped for the GCD features.
          </p>
        </div>

        <div className="inputs">
          <FeatureTable flow={flow} />

          <div className="maps">
            <FeatureMap title="Baseline input" subtitle="No-IBNN and IBNN" matrix={flow.maps.normal} />
            <FeatureMap
              title="Fuzzy-GCD input"
              subtitle="Fuzzy-GCD and Fuzzy-GCD + IBNN"
              matrix={flow.maps.gcd}
              replaced={flow.gcd.replacement_indices}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

// One model's card: predicted class, verdict against the true label, top three
// classes, margin and uncertainty.
function ModelVote({ model, output, correct }) {
  const { margin, entropy } = uncertainty(output)

  return (
    <article className="vote" style={{ "--model": model.color }}>
      <div className="vote-top">
        <h3 className="vote-model">{model.name}</h3>
        {correct === true && (
          <span className="verdict verdict-right">
            <Check size={14} aria-hidden="true" /> Correct
          </span>
        )}
        {correct === false && (
          <span className="verdict verdict-wrong">
            <X size={14} aria-hidden="true" /> Wrong
          </span>
        )}
      </div>

      <p className="vote-class">{output.class}</p>

      <ol className="odds" aria-label="Top predictions">
        {topPredictions(output).map(([name, probability]) => (
          <li key={name}>
            <span className="odds-name">{name}</span>
            <span className="odds-value">{pct(probability)}</span>
            <span className="odds-bar" aria-hidden="true">
              <span style={{ width: `${probability * 100}%` }} />
            </span>
          </li>
        ))}
      </ol>

      <dl className="vote-stats">
        <div>
          <dt>Margin</dt>
          <dd title="Gap between the top two classes">{pct(margin, 0)}</dd>
        </div>
        <div>
          <dt>Uncertainty</dt>
          <dd title="Normalised entropy: 0% is certain, 100% is a uniform guess">{pct(entropy, 0)}</dd>
        </div>
      </dl>

      <p className="vote-note">{model.description}</p>
    </article>
  )
}

// The five inference stages, filled in with this flow's values.
function Pipeline({ flow }) {
  const steps = [
    { title: "Flow file", detail: `${flow.file_name}, row ${flow.row + 1}` },
    { title: "StandardScaler", detail: "21 features scaled" },
    { title: "Fuzzy-GCD", detail: `k = ${formatNumber(flow.gcd.raw.best_k)} B, ${pct(flow.gcd.raw.within_tolerance_fraction, 0)} on lattice` },
    { title: "5 × 5 maps", detail: "Baseline and GCD inputs" },
    { title: "4 models", detail: `Consensus ${flow.majority}` }
  ]

  return (
    <ol className="pipeline" aria-label="Inference pipeline">
      {steps.map((step, index) => (
        <li key={step.title}>
          <span className="pipeline-num">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <strong>{step.title}</strong>
            <small title={step.detail}>{step.detail}</small>
          </div>
          {index < steps.length - 1 && <ChevronRight size={16} className="pipeline-arrow" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  )
}

// Grouped bars of each model's probability for every class that appears in
// any model's top three.
function ProbabilityComparison({ flow }) {
  const classes = new Set()
  MODELS.forEach(model => {
    topPredictions(flow.outputs[model.name]).forEach(([name]) => classes.add(name))
  })

  const rows = [...classes]
    .map(name => ({
      label: name,
      values: MODELS.map(model => flow.outputs[model.name].probabilities[name] ?? 0)
    }))
    .sort((a, b) => Math.max(...b.values) - Math.max(...a.values))

  return <GroupedBars rows={rows} max={1} format={value => pct(value)} />
}

// Raw flow statistics: duration, bytes, rates, inter-arrival time, packet sizes and
// the inbound/outbound byte split.
function TrafficProfile({ flow }) {
  const bytesIn = featureValue(flow, "outer_bytes_in")
  const bytesOut = featureValue(flow, "outer_bytes_out")
  const total = bytesIn + bytesOut
  const sizes = flow.packet_sizes

  const items = [
    { icon: Timer, label: "Duration", value: formatDuration(featureValue(flow, "outer_duration_ms")) },
    { icon: Package, label: "Total bytes", value: formatBytes(featureValue(flow, "outer_bytes")) },
    { icon: Gauge, label: "Packet rate", value: formatNumber(featureValue(flow, "outer_packet_rate")) },
    { icon: Workflow, label: "Byte rate", value: formatNumber(featureValue(flow, "outer_byte_rate")) },
    { icon: Timer, label: "Mean inter-arrival", value: formatDuration(featureValue(flow, "outer_mean_piat_ms")) },
    {
      icon: BarChart3,
      label: "Packet size",
      value: sizes.length ? `${formatNumber(mean(sizes))} B` : "–",
      note: sizes.length ? `${Math.min(...sizes)}–${Math.max(...sizes)} B, ${new Set(sizes).size} distinct` : ""
    }
  ]

  return (
    <div className="profile">
      <div className="profile-grid">
        {items.map(item => (
          <div className="profile-item" key={item.label}>
            <span>
              <item.icon size={14} aria-hidden="true" />
              {item.label}
            </span>
            <strong>{item.value}</strong>
            {item.note && <small>{item.note}</small>}
          </div>
        ))}
      </div>

      <div className="direction">
        <div className="direction-labels">
          <span>Inbound {formatBytes(bytesIn)}</span>
          <span>Outbound {formatBytes(bytesOut)}</span>
        </div>
        <div className="direction-bar" role="img" aria-label={`Inbound ${pct(total ? bytesIn / total : 0, 0)} of bytes`}>
          <span className="dir-in" style={{ width: `${total ? (bytesIn / total) * 100 : 50}%` }} />
          <span className="dir-out" />
        </div>
        <div className="direction-labels muted">
          <span>{pct(total ? bytesIn / total : 0, 0)}</span>
          <span>{pct(total ? bytesOut / total : 0, 0)}</span>
        </div>
      </div>
    </div>
  )
}

// Rounds a value up to a readable axis maximum (1, 1.5, 2, 2.5, 3, 4, 5, 6 or 8 x 10^n).
function niceMax(value) {
  if (value <= 0) return 100
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
  return steps.map(step => step * magnitude).find(step => step >= value)
}

// Bar chart of every packet size, coloured by whether it lies within the tolerance
// of a multiple of k, with the multiples of k drawn when they aren't too dense.
function PacketRhythm({ sizes, k }) {
  if (!sizes?.length) {
    return <p className="empty-note">This flow has no packet sizes, so all GCD features are zero.</p>
  }

  const width = 760
  const height = 220
  const pad = { top: 12, right: 12, bottom: 26, left: 48 }
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom

  const top = niceMax(Math.max(...sizes))
  const y = value => pad.top + plotHeight - (value / top) * plotHeight
  const step = plotWidth / sizes.length
  const barWidth = Math.max(1, step * 0.72)

  const multiples = k > 0 ? Math.floor(top / k) : 0
  const drawLattice = multiples > 0 && multiples <= 48

  const onLattice = sizes.map(size => {
    const nearest = Math.max(1, Math.round(size / k)) * k
    return Math.abs(size - nearest) <= GCD_TOLERANCE
  })
  const within = onLattice.filter(Boolean).length

  return (
    <figure className="rhythm">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${sizes.length} packet sizes, largest ${Math.max(...sizes)} bytes; ${within} within ${GCD_TOLERANCE} bytes of a multiple of ${k}`}
      >
        <defs>
          <linearGradient id="rhythm-on" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--on-1)" }} />
            <stop offset="1" style={{ stopColor: "var(--on-2)" }} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="rhythm-off" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--off-1)" }} />
            <stop offset="1" style={{ stopColor: "var(--off-2)" }} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {drawLattice &&
          Array.from({ length: multiples }, (_, i) => (
            <line
              key={i}
              className="lattice"
              x1={pad.left}
              x2={width - pad.right}
              y1={y((i + 1) * k)}
              y2={y((i + 1) * k)}
            />
          ))}

        {[0, top / 2, top].map(tick => (
          <g key={tick}>
            <line className="axis" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} />
            <text className="tick" x={pad.left - 8} y={y(tick) + 4} textAnchor="end">
              {Math.round(tick)}
            </text>
          </g>
        ))}

        {sizes.map((size, i) => (
          <rect
            key={i}
            fill={onLattice[i] ? "url(#rhythm-on)" : "url(#rhythm-off)"}
            rx={Math.min(2, barWidth / 3)}
            x={pad.left + i * step + (step - barWidth) / 2}
            y={y(size)}
            width={barWidth}
            height={Math.max(1, pad.top + plotHeight - y(size))}
          >
            <title>{`Packet ${i + 1}: ${size} bytes`}</title>
          </rect>
        ))}

        <text className="tick" x={pad.left} y={height - 6}>
          Packet 1
        </text>
        <text className="tick" x={width - pad.right} y={height - 6} textAnchor="end">
          Packet {sizes.length}
        </text>
      </svg>

      <figcaption className="muted">
        {within} of {sizes.length} packets are within {GCD_TOLERANCE} bytes of
        a multiple of k = {k} bytes.
        {drawLattice
          ? " Faint lines mark each multiple of k."
          : " The multiples of k are too close together to draw."}
      </figcaption>
    </figure>
  )
}

// The four raw Fuzzy-GCD features with a short explanation of each.
function GcdStats({ raw }) {
  const items = [
    ["k", `${formatNumber(raw.best_k)} bytes`, "Unit the packet sizes cluster around"],
    ["Mean residual", `${formatNumber(raw.mean_residual)} bytes`, "Average distance to the nearest multiple"],
    ["Normalized residual", formatNumber(raw.normalized_residual), "Mean residual divided by k"],
    ["Within tolerance", pct(raw.within_tolerance_fraction), `Packets within ${GCD_TOLERANCE} bytes of a multiple`]
  ]

  return (
    <dl className="gcd-stats">
      {items.map(([term, value, note]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
          <dd className="gcd-note">{note}</dd>
        </div>
      ))}
    </dl>
  )
}

// All 21 input features, raw and scaled, marking the cells the Fuzzy-GCD input
// replaces and the value it uses instead.
function FeatureTable({ flow }) {
  const replacedBy = {}
  flow.gcd.replacement_indices.forEach((featureIndex, gcdIndex) => {
    replacedBy[featureIndex] = gcdIndex
  })

  return (
    <div className="table-wrap">
      <table className="features">
        <thead>
          <tr>
            <th scope="col">Cell</th>
            <th scope="col">Feature</th>
            <th scope="col" className="num">Raw</th>
            <th scope="col" className="num">Scaled</th>
          </tr>
        </thead>
        <tbody>
          {flow.features.map((feature, index) => {
            const gcdIndex = replacedBy[index]
            const swapped = gcdIndex !== undefined

            return (
              <tr key={feature.name} className={swapped ? "swapped" : ""}>
                <td className="num muted">{index}</td>
                <td>
                  <span title={feature.name}>{featureLabel(feature.name)}</span>
                  {swapped && (
                    <span className="swap-note">
                      Fuzzy-GCD input uses {GCD_FEATURES[gcdIndex].toLowerCase()} here:{" "}
                      {formatNumber(flow.gcd.scaled[gcdIndex])}
                    </span>
                  )}
                </td>
                <td className="num">{formatNumber(feature.raw)}</td>
                <td className="num">{formatNumber(feature.scaled)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Colour saturates at ±3 standard deviations, so both maps share one scale and a
// single outlier doesn't wash out every other cell.
const HEAT_LIMIT = 3

// One 5x5 model input as a heatmap: colour diverges around zero (the training
// mean), padding cells are hatched and swapped GCD cells outlined.
function FeatureMap({ title, subtitle, matrix, replaced = [] }) {
  const values = matrix.flat().map(Number)

  return (
    <figure className="map">
      <figcaption>
        <strong>{title}</strong>
        <span className="muted">{subtitle}</span>
      </figcaption>

      <div className="grid5">
        {values.map((value, index) => {
          const padding = index >= 21
          const strength = Math.round(Math.min(1, Math.abs(value) / HEAT_LIMIT) * 85)
          const tone = value >= 0 ? "var(--heat-pos)" : "var(--heat-neg)"

          return (
            <div
              key={index}
              className={`cell ${padding ? "cell-pad" : ""} ${replaced.includes(index) ? "cell-swapped" : ""} ${strength > 45 ? "cell-strong" : ""}`}
              style={padding ? undefined : { background: `color-mix(in srgb, ${tone} ${strength}%, var(--panel-solid))` }}
              title={padding ? "Padding" : `Cell ${index}: ${value.toFixed(4)}`}
            >
              {padding ? "" : value.toFixed(2)}
            </div>
          )
        })}
      </div>

      <div className="map-legend muted">
        <span><i style={{ background: "var(--heat-neg)" }} /> below training mean</span>
        <span><i style={{ background: "var(--heat-pos)" }} /> above (full colour at ±{HEAT_LIMIT} SD)</span>
        {replaced.length > 0 && <span><i className="legend-swapped" /> GCD feature</span>}
      </div>
    </figure>
  )
}

export default FlowDetail
