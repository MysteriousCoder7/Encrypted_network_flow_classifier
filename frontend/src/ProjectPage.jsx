import { useEffect, useRef, useState } from "react"
import { ArrowRight, ChevronDown, ChevronUp, Eye, EyeOff, Play, UploadCloud } from "lucide-react"

import { DivergingBars, GroupedBars, SeriesLegend, useTooltip } from "./Charts"
import gcdImage from "./assets/GCD.png"
import metricsImage from "./assets/all_models_metrics.png"
import gcdLabelsImage from "./assets/highest_gcd_labels.png"
import results from "./data/results.json"
import { MODELS, featureLabel, pct } from "./models"

const FEATURE_NAMES = [
  "outer_bytes", "outer_duration_ms", "outer_first_matched_time_ms", "outer_last_matched_time_ms",
  "outer_capture_duration_ms", "outer_packet_rate", "outer_byte_rate", "outer_bytes_in", "outer_bytes_out",
  "outer_min_piat_ms_in", "outer_mean_piat_ms_in", "outer_stddev_piat_ms_in", "outer_max_piat_ms_in",
  "outer_min_piat_ms_out", "outer_mean_piat_ms_out", "outer_stddev_piat_ms_out", "outer_max_piat_ms_out",
  "outer_min_piat_ms", "outer_mean_piat_ms", "outer_stddev_piat_ms", "outer_max_piat_ms"
]

const GCD_NAMES = ["k", "mean residual", "normalized residual", "share within tolerance"]

const { dataset, training, overall, test_set: testSet } = results
const accuracy = testSet.accuracy
// Difference between two fractions in percentage points, e.g. "7.2 pp".
const points = (a, b) => `${((a - b) * 100).toFixed(1)} pp`
const best = overall.reduce((a, b) => (b.accuracy > a.accuracy ? b : a))

const SLIDES = [
  { id: "overview", title: "Overview", Component: Cover },
  { id: "problem", title: "The problem", Component: Problem },
  { id: "dataset", title: "Dataset", Component: Dataset },
  { id: "pipeline", title: "Pipeline", Component: Pipeline },
  { id: "fuzzy-gcd", title: "Fuzzy-GCD", Component: FuzzyGcd },
  { id: "architecture", title: "Architecture", Component: Architecture },
  { id: "bottleneck", title: "Information bottleneck", Component: Bottleneck },
  { id: "experiments", title: "Experiments", Component: Experiments },
  { id: "results", title: "Overall results", Component: OverallResults },
  { id: "per-class", title: "Per-class accuracy", Component: PerClass },
  { id: "gcd-gains", title: "Where Fuzzy-GCD helps", Component: GcdGains },
  { id: "errors", title: "Agreement and errors", Component: Errors },
  { id: "conclusions", title: "Conclusions", Component: Conclusions }
]

// Project presentation: a column of slides with a side index that tracks the visible
// slide, floating previous/next controls and left/right arrow-key navigation.
function ProjectPage() {
  const [active, setActive] = useState(0)
  const refs = useRef([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActive(Number(entry.target.dataset.index))
        })
      },
      { rootMargin: "-45% 0px -45% 0px" }
    )
    refs.current.forEach(node => node && observer.observe(node))
    return () => observer.disconnect()
  }, [])

  const go = index => {
    const target = refs.current[Math.max(0, Math.min(SLIDES.length - 1, index))]
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    target?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
  }

  // Left and right arrows move between slides like a presentation.
  useEffect(() => {
    const onKey = event => {
      if (event.target.closest("input, textarea, select, [contenteditable]")) return
      if (event.key === "ArrowRight") go(active + 1)
      if (event.key === "ArrowLeft") go(active - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className="deck">
      <nav className="deck-nav" aria-label="Slides">
        {SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            aria-current={active === index ? "step" : undefined}
            onClick={() => go(index)}
          >
            <span className="deck-dot" aria-hidden="true" />
            <span className="deck-nav-label">{slide.title}</span>
          </button>
        ))}
      </nav>

      <div className="deck-slides">
        {SLIDES.map(({ id, title, Component }, index) => (
          <section
            key={id}
            id={id}
            className={`slide slide-${id}`}
            data-index={index}
            ref={node => {
              refs.current[index] = node
            }}
            aria-labelledby={`${id}-title`}
          >
            <span className="slide-number">
              {String(index + 1).padStart(2, "0")} / {SLIDES.length}
            </span>
            <Component titleId={`${id}-title`} title={title} />
          </section>
        ))}
      </div>

      <div className="deck-controls">
        <button type="button" className="icon-btn" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous slide">
          <ChevronUp size={18} />
        </button>
        <span>{active + 1} / {SLIDES.length}</span>
        <button type="button" className="icon-btn" onClick={() => go(active + 1)} disabled={active === SLIDES.length - 1} aria-label="Next slide">
          <ChevronDown size={18} />
        </button>
      </div>
    </div>
  )
}

// Slide heading with an optional small kicker above it.
function SlideTitle({ id, kicker, children }) {
  return (
    <header className="slide-head">
      {kicker && <span className="slide-kicker">{kicker}</span>}
      <h2 id={id}>{children}</h2>
    </header>
  )
}

// Title slide with the project summary and headline results.
function Cover({ titleId }) {
  const baseline = accuracy["No-IBNN"]

  return (
    <div className="cover">
      <span className="hero-badge">
        <span className="pulse" aria-hidden="true" />
        Encrypted network flow classification
      </span>
      <h1 id={titleId}>
        Classifying encrypted VPN traffic <span className="grad-text">by its shape</span>
      </h1>
      <p className="cover-lede">
        Four controlled experiments test whether fuzzy-GCD packet-size features
        and an information-bottleneck neural network help identify the
        application behind WireGuard-encrypted flows.
      </p>

      <dl className="cover-facts">
        <div>
          <dt>Best test accuracy</dt>
          <dd>{pct(best.accuracy)}</dd>
          <span>{best.model}</span>
        </div>
        <div>
          <dt>Gain over the baseline</dt>
          <dd>+{points(best.accuracy, baseline)}</dd>
          <span>vs No-IBNN at {pct(baseline)}</span>
        </div>
        <div>
          <dt>Test flows</dt>
          <dd>{dataset.test_flows.toLocaleString()}</dd>
          <span>30% stratified split</span>
        </div>
        <div>
          <dt>Applications</dt>
          <dd>{dataset.classes}</dd>
          <span>classes with at least {dataset.min_class_count} flows</span>
        </div>
      </dl>
    </div>
  )
}

// What encryption hides, what stays visible on the outer flow, and the goal.
function Problem({ titleId, title }) {
  return (
    <>
      <SlideTitle id={titleId} kicker="Motivation">{title}</SlideTitle>
      <p className="slide-lede">
        Inside a VPN tunnel the payload and the inner headers are encrypted, so
        classic deep packet inspection sees nothing useful. The traffic still has
        a shape: how long a flow lasts, how many bytes move each way, how often
        packets arrive, and how large they are.
      </p>

      <div className="compare">
        <div className="compare-card compare-hidden">
          <span className="compare-icon" aria-hidden="true"><EyeOff size={20} /></span>
          <h3>Hidden by encryption</h3>
          <ul>
            <li>Payload contents</li>
            <li>Inner IP and transport headers</li>
            <li>Application protocol messages</li>
          </ul>
        </div>
        <div className="compare-card compare-visible">
          <span className="compare-icon" aria-hidden="true"><Eye size={20} /></span>
          <h3>Still visible on the outer flow</h3>
          <ul>
            <li>Duration, byte and packet counts in each direction</li>
            <li>Packet and byte rates</li>
            <li>Packet inter-arrival times (min, mean, std. dev., max)</li>
            <li>The sequence of the first {dataset.packet_sizes_per_flow} packet sizes</li>
          </ul>
        </div>
      </div>

      <p className="slide-note">
        Goal: predict the application label (for example TLS.Facebook, QUIC or
        STUN.WhatsAppCall) from the encrypted-side features alone.
      </p>
    </>
  )
}

// Dataset size and split, with the test set's class distribution.
function Dataset({ titleId, title }) {
  const classes = results.per_class
  const top = classes.slice(0, 10)
  const rest = classes.slice(10).reduce((sum, row) => sum + row.support, 0)
  const rows = [...top, { label: `Other ${classes.length - 10} classes`, support: rest }]
  const largestTwo = (classes[0].support + classes[1].support) / testSet.flows

  return (
    <>
      <SlideTitle id={titleId} kicker="Data">{title}</SlideTitle>

      <div className="slide-split">
        <div>
          <dl className="fact-grid">
            <div><dt>Flows in two capture sessions</dt><dd>{dataset.raw_flows.toLocaleString()}</dd></div>
            <div><dt>Columns per flow</dt><dd>{dataset.columns}</dd></div>
            <div><dt>Flows after dropping rare classes</dt><dd>{dataset.flows_after_filter.toLocaleString()}</dd></div>
            <div><dt>Application classes</dt><dd>{dataset.classes}</dd></div>
            <div><dt>Training flows (70%)</dt><dd>{dataset.train_flows.toLocaleString()}</dd></div>
            <div><dt>Test flows (30%)</dt><dd>{dataset.test_flows.toLocaleString()}</dd></div>
          </dl>
          <p className="slide-note">
            Classes with fewer than {dataset.min_class_count} flows are removed, and
            the split is stratified with seed {training.seed}. The data is heavily
            imbalanced: {classes[0].label} and {classes[1].label} alone make up{" "}
            {pct(largestTwo, 0)} of the test set.
          </p>
        </div>

        <figure className="panel chart-panel">
          <figcaption>
            <h3>Test-set flows per class</h3>
            <p className="muted">The ten largest classes, then everything else</p>
          </figcaption>
          <SingleBars rows={rows.map(row => ({ label: row.label, value: row.support }))} format={value => value.toLocaleString()} />
        </figure>
      </div>
    </>
  )
}

// The six preprocessing and modelling steps, and which features the Fuzzy-GCD
// models replace.
function Pipeline({ titleId, title }) {
  const replaced = training.replaced_feature_indices

  const steps = [
    { title: "Flow record", text: `${dataset.columns} columns from the flow exporter` },
    { title: "21 outer features", text: "Encrypted-side statistics only; identifiers and labels are excluded" },
    { title: "StandardScaler", text: "Fitted on the training split only" },
    { title: "Fuzzy-GCD swap", text: "GCD models replace four low-variance features with four packet-size features" },
    { title: "5 × 5 map", text: "21 values zero-padded to 25 and reshaped into one channel" },
    { title: "CNN classifier", text: `Softmax over ${dataset.classes} applications` }
  ]

  return (
    <>
      <SlideTitle id={titleId} kicker="Method">{title}</SlideTitle>

      <ol className="flow-steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="flow-step-num">{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            {index < steps.length - 1 && <ArrowRight size={18} className="flow-step-arrow" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <div className="panel">
        <h3>Which features the Fuzzy-GCD models give up</h3>
        <p className="muted">
          The four features with the lowest training variance are replaced, so the
          input stays 21 values and the architecture is unchanged.
        </p>
        <ul className="swap-list">
          {replaced.map((index, position) => (
            <li key={index}>
              <span className="swap-from">
                Cell {index}: {featureLabel(FEATURE_NAMES[index])}
              </span>
              <ArrowRight size={15} aria-hidden="true" />
              <span className="swap-to">GCD {GCD_NAMES[position]}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

// How Fuzzy-GCD finds the packet-size unit k and the four features it produces.
function FuzzyGcd({ titleId, title }) {
  return (
    <>
      <SlideTitle id={titleId} kicker="Feature engineering">{title}</SlideTitle>
      <p className="slide-lede">
        Encrypted records are built from fixed-size blocks, so packet sizes tend
        to sit near whole multiples of some unit. Fuzzy-GCD finds that unit while
        tolerating the padding and headers that make an exact greatest common
        divisor useless.
      </p>

      <p className="formula">
        <span className="formula-text">packet size ≈ n × k + residual</span>
      </p>

      <div className="slide-split">
        <ol className="steps">
          <li>
            <h3>Search k</h3>
            <p>For k from 8 to 256, compare each packet size with its nearest positive multiple of k.</p>
          </li>
          <li>
            <h3>Measure the residual</h3>
            <p>Take the absolute difference between each packet size and that nearest multiple.</p>
          </li>
          <li>
            <h3>Pick the best k</h3>
            <p>The k with the smallest mean residual becomes the flow's fuzzy common divisor.</p>
          </li>
          <li>
            <h3>Build four features</h3>
            <p>k, the mean residual, the residual divided by k, and the share of packets within 4 bytes of a multiple.</p>
          </li>
        </ol>

        <figure className="figure">
          <div className="figure-frame">
            <img src={gcdImage} alt="Packets split into k-byte units with a leftover residual" />
          </div>
          <figcaption>Each packet is read as whole k-byte units plus a leftover, the residual shown in red.</figcaption>
        </figure>
      </div>
    </>
  )
}

// The shared CNN layer stack, with the IB layer marked as IBNN-only, and parameter counts.
function Architecture({ titleId, title }) {
  const layers = [
    { name: "Input", detail: "1 × 5 × 5 feature map" },
    { name: "Conv 5 × 5", detail: "32 channels, ReLU" },
    { name: "Conv 5 × 5", detail: "32 channels, ReLU" },
    { name: "Conv 3 × 3", detail: "64 channels, ReLU" },
    { name: "Conv 3 × 3", detail: "64 channels, ReLU" },
    { name: "Concatenate", detail: "outputs of the two 3 × 3 layers" },
    { name: "Fully connected", detail: "128 units, dropout 0.1" },
    { name: "IB layer", detail: `Stochastic z, ${training.z_dim} dimensions (μ, σ)`, ib: true },
    { name: "Fully connected", detail: "128 then 256 units" },
    { name: "Output", detail: `${dataset.classes}-way softmax` }
  ]

  return (
    <>
      <SlideTitle id={titleId} kicker="Model">{title}</SlideTitle>

      <div className="slide-split">
        <ol className="layers">
          {layers.map((layer, index) => (
            <li key={index} className={layer.ib ? "layer-ib" : ""}>
              <strong>{layer.name}</strong>
              <span>{layer.detail}</span>
              {layer.ib && <em>IBNN models only</em>}
            </li>
          ))}
        </ol>

        <div>
          <p className="slide-lede">
            All four models share the convolutional extractor and fully connected
            layers from Lin and Chen's IBNN. The No-IBNN models remove only the
            stochastic bottleneck layer and its mutual-information loss, so any
            difference comes from the bottleneck itself.
          </p>
          <dl className="fact-grid fact-grid-2">
            <div><dt>IBNN parameters</dt><dd>{training.parameters.IBNN.toLocaleString()}</dd></div>
            <div><dt>No-IBNN parameters</dt><dd>{training.parameters["No-IBNN"].toLocaleString()}</dd></div>
          </dl>
        </div>
      </div>
    </>
  )
}

// The information-bottleneck loss, what each term does, and the beta sweep.
function Bottleneck({ titleId, title }) {
  const notes = [
    ["Compression", "The bottleneck discourages the latent representation from keeping information about the input that the label doesn't need."],
    ["Prediction", "Cross-entropy makes the latent representation keep what is useful for predicting the application class."],
    ["The β trade-off", "β balances compression against prediction. A larger β puts more pressure on the information term."],
    ["Choosing β", `Each IBNN is trained with β in {${training.betas.join(", ")}} and the best β by macro-F1 is kept.`]
  ]

  return (
    <>
      <SlideTitle id={titleId} kicker="Regularisation">{title}</SlideTitle>
      <p className="slide-lede">
        The IBNN adds a stochastic latent layer between the encoder and the
        classifier and penalises an estimate of the mutual information between
        the input and that layer.
      </p>

      <p className="formula">
        <span className="formula-text">Loss = cross-entropy + β × I(X; T) + L2</span>
      </p>

      <div className="notes">
        {notes.map(([heading, text]) => (
          <section className="note" key={heading}>
            <h3>{heading}</h3>
            <p>{text}</p>
          </section>
        ))}
      </div>
    </>
  )
}

// The four controlled experiments and the shared training setup.
function Experiments({ titleId, title }) {
  const rows = [
    ["No-IBNN", "21 flow features", "No", "The baseline"],
    ["IBNN", "21 flow features", "Yes", "Effect of the bottleneck"],
    ["Fuzzy-GCD", "17 flow + 4 GCD features", "No", "Effect of the GCD features"],
    ["Fuzzy-GCD + IBNN", "17 flow + 4 GCD features", "Yes", "Both together"]
  ]

  const setup = [
    ["Epochs", training.epochs],
    ["Optimiser", `${training.optimizer}, learning rate ${training.learning_rate}`],
    ["Schedule", training.schedule],
    ["Batch size", training.batch_size],
    ["Dropout", training.dropout],
    ["L2 weight", training.l2],
    ["Split", "70 / 30 stratified"],
    ["Seed", training.seed]
  ]

  return (
    <>
      <SlideTitle id={titleId} kicker="Design">{title}</SlideTitle>
      <p className="slide-lede">
        Four models differ in exactly two switches, so each comparison isolates
        one idea. Everything else, including the split, preprocessing, optimiser
        and schedule, is identical.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Input</th>
              <th scope="col">IB layer</th>
              <th scope="col">What it tests</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, input, ib, purpose], index) => (
              <tr key={name}>
                <td>
                  <span className="swatch" style={{ background: MODELS[index].color }} />
                  <strong>{name}</strong>
                </td>
                <td>{input}</td>
                <td>{ib}</td>
                <td className="muted">{purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="setup-chips">
        {setup.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

// Test-set accuracy, precision, recall and F1 per model, as a chart and a table,
// with the main takeaways.
function OverallResults({ titleId, title }) {
  const metrics = [
    ["Accuracy", "accuracy"],
    ["Precision", "precision"],
    ["Recall", "recall"],
    ["F1", "f1"]
  ]

  return (
    <>
      <SlideTitle id={titleId} kicker="Results">{title}</SlideTitle>

      <div className="slide-split">
        <figure className="panel chart-panel">
          <figcaption>
            <h3>Test-set metrics by model</h3>
            <p className="muted">Weighted averages over {dataset.classes} classes, {dataset.test_flows.toLocaleString()} flows</p>
          </figcaption>
          <SeriesLegend series={MODELS} />
          <GroupedBars
            rows={metrics.map(([label, key]) => ({ label, values: overall.map(row => row[key]) }))}
            max={1}
            format={value => pct(value)}
            showValues
          />
        </figure>

        <div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  {metrics.map(([label]) => (
                    <th scope="col" className="num" key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overall.map((row, index) => (
                  <tr key={row.model} className={row.model === best.model ? "row-best" : ""}>
                    <td>
                      <span className="swatch" style={{ background: MODELS[index].color }} />
                      {row.model}
                    </td>
                    {metrics.map(([label, key]) => (
                      <td className="num" key={label}>{pct(row[key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="takeaways">
            <li>
              Fuzzy-GCD adds <b>+{points(accuracy["Fuzzy-GCD"], accuracy["No-IBNN"])}</b> accuracy
              over the baseline with the same architecture.
            </li>
            <li>
              The bottleneck adds <b>+{points(accuracy.IBNN, accuracy["No-IBNN"])}</b> on the
              baseline features but only <b>+{points(accuracy["Fuzzy-GCD + IBNN"], accuracy["Fuzzy-GCD"])}</b> on
              top of Fuzzy-GCD.
            </li>
          </ul>
        </div>
      </div>

      <details className="figure-details">
        <summary>Show the original plot from plot.py</summary>
        <div className="figure-frame">
          <img src={metricsImage} alt="Accuracy, precision, recall and F1 for the four models" />
        </div>
      </details>
    </>
  )
}

// Heat table of per-class accuracy for the largest classes, outlining the best model.
function PerClass({ titleId, title }) {
  const [bind, tooltip] = useTooltip()
  const rows = results.per_class.slice(0, 14)
  const bestModel = MODELS.length - 1
  const weak = results.per_class.filter(row => row.accuracy[MODELS[bestModel].name] < 0.1).length

  return (
    <>
      <SlideTitle id={titleId} kicker="Results">{title}</SlideTitle>
      <p className="slide-lede">
        Accuracy per application for the {rows.length} largest classes. Darker
        cells are higher. The large classes are learned well; many small ones
        are not: {weak} of {results.per_class.length} classes stay below 10%
        even with {MODELS[bestModel].name}.
      </p>

      <div className="table-wrap">
        <table className="heat-table">
          <thead>
            <tr>
              <th scope="col">Application</th>
              <th scope="col" className="num">Test flows</th>
              {MODELS.map(model => (
                <th scope="col" key={model.name}>
                  <span className="swatch" style={{ background: model.color }} />
                  {model.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const top = Math.max(...MODELS.map(model => row.accuracy[model.name]))
              return (
                <tr key={row.label}>
                  <td><strong>{row.label}</strong></td>
                  <td className="num">{row.support.toLocaleString()}</td>
                  {MODELS.map(model => {
                    const value = row.accuracy[model.name]
                    return (
                      <td
                        key={model.name}
                        className={`heat-cell ${value > 0.55 ? "is-strong" : ""} ${value === top && value > 0 ? "is-top" : ""}`}
                        style={{ background: `color-mix(in srgb, var(--seq) ${Math.round(value * 85)}%, transparent)` }}
                        {...bind({
                          title: `${row.label}, ${model.name}`,
                          rows: [
                            { label: "Accuracy", value: pct(value) },
                            { label: "Test flows", value: row.support.toLocaleString() }
                          ]
                        })}
                      >
                        {pct(value)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {tooltip}
      <p className="slide-note">The best model for each class is outlined.</p>
    </>
  )
}

// Per-class F1 change from adding Fuzzy-GCD features, for the classes that gain most.
function GcdGains({ titleId, title }) {
  const series = [
    { name: "Fuzzy-GCD vs No-IBNN", color: "var(--m-gcd)" },
    { name: "Fuzzy-GCD + IBNN vs IBNN", color: "var(--m-gcdib)" }
  ]
  const top = results.gcd_improvement[0]

  return (
    <>
      <SlideTitle id={titleId} kicker="Results">{title}</SlideTitle>
      <p className="slide-lede">
        Change in per-class F1 when the four GCD features are added, for the ten
        classes that gain the most. {top.label} benefits most: F1 rises by{" "}
        {top.vs_no_ibnn.toFixed(2)} over No-IBNN and {top.vs_ibnn.toFixed(2)} over IBNN.
      </p>

      <div className="slide-split">
        <figure className="panel chart-panel">
          <figcaption>
            <h3>F1 change from Fuzzy-GCD features</h3>
            <p className="muted">Bars right of zero are gains, left are losses</p>
          </figcaption>
          <SeriesLegend series={series} />
          <DivergingBars
            rows={results.gcd_improvement.map(row => ({ label: row.label, values: [row.vs_no_ibnn, row.vs_ibnn] }))}
            series={series}
            format={value => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}`}
          />
        </figure>

        <figure className="figure">
          <div className="figure-frame">
            <img src={gcdLabelsImage} alt="Applications with the largest F1 change from Fuzzy-GCD features" />
          </div>
          <figcaption>The same comparison as plotted by plot.py.</figcaption>
        </figure>
      </div>
    </>
  )
}

// How the four models agree across the test set and their most common mistakes.
function Errors({ titleId, title }) {
  const share = value => pct(value / testSet.flows)
  const net = testSet.gcd_only_correct - testSet.baseline_only_correct

  return (
    <>
      <SlideTitle id={titleId} kicker="Analysis">{title}</SlideTitle>

      <dl className="cover-facts">
        <div>
          <dt>All four models correct</dt>
          <dd>{testSet.all_four_correct.toLocaleString()}</dd>
          <span>{share(testSet.all_four_correct)} of test flows</span>
        </div>
        <div>
          <dt>Fixed by Fuzzy-GCD</dt>
          <dd>{testSet.gcd_only_correct.toLocaleString()}</dd>
          <span>both GCD models right, both baselines wrong</span>
        </div>
        <div>
          <dt>Broken by Fuzzy-GCD</dt>
          <dd>{testSet.baseline_only_correct.toLocaleString()}</dd>
          <span>net gain of {net.toLocaleString()} flows</span>
        </div>
        <div>
          <dt>All four wrong</dt>
          <dd>{testSet.all_four_wrong.toLocaleString()}</dd>
          <span>{share(testSet.all_four_wrong)} of test flows</span>
        </div>
      </dl>

      <div className="slide-split">
        {["No-IBNN", "Fuzzy-GCD + IBNN"].map(model => (
          <div className="panel" key={model}>
            <h3>Most common mistakes, {model}</h3>
            <ul className="mixups">
              {results.confusions[model].slice(0, 6).map(item => (
                <li key={`${item.true}-${item.predicted}`}>
                  <span className="mix-true">{item.true}</span>
                  <ArrowRight size={14} aria-label="predicted as" />
                  <span className="mix-pred">{item.predicted}</span>
                  <b>{item.count.toLocaleString()}</b>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  )
}

// Key findings computed from the results, and links to the other two pages.
function Conclusions({ titleId, title }) {
  const weak = results.per_class.filter(row => row.accuracy["Fuzzy-GCD + IBNN"] < 0.1).length
  const top = results.gcd_improvement[0]
  const confusion = results.confusions["Fuzzy-GCD + IBNN"][0]

  const findings = [
    `Fuzzy-GCD packet-size features give the largest gain: accuracy rises from ${pct(accuracy["No-IBNN"])} to ${pct(accuracy["Fuzzy-GCD"])} with no change to the network.`,
    `The information bottleneck helps the baseline (+${points(accuracy.IBNN, accuracy["No-IBNN"])}) but adds little once GCD features are present (+${points(accuracy["Fuzzy-GCD + IBNN"], accuracy["Fuzzy-GCD"])}).`,
    `GCD features fix ${testSet.gcd_only_correct.toLocaleString()} test flows that both baselines miss, against ${testSet.baseline_only_correct.toLocaleString()} they break.`,
    `The biggest per-class gain is ${top.label}, whose F1 improves by ${top.vs_ibnn.toFixed(2)} over IBNN.`,
    `The most common remaining error is ${confusion.true} predicted as ${confusion.predicted} (${confusion.count.toLocaleString()} flows), and ${weak} of ${results.per_class.length} classes stay below 10% accuracy.`
  ]

  return (
    <>
      <SlideTitle id={titleId} kicker="Summary">{title}</SlideTitle>

      <ol className="findings">
        {findings.map(text => (
          <li key={text}>{text}</li>
        ))}
      </ol>

      <div className="cta-row">
        <a className="btn btn-primary btn-lg" href="#/dashboard">
          <Play size={18} aria-hidden="true" />
          Run the simulation
        </a>
        <a className="btn btn-lg" href="#/classify">
          <UploadCloud size={18} aria-hidden="true" />
          Classify your own flows
        </a>
      </div>
    </>
  )
}

// Single-series horizontal bars with direct value labels.
function SingleBars({ rows, format }) {
  const [bind, tooltip] = useTooltip()
  const top = Math.max(...rows.map(row => row.value))

  return (
    <div className="sbars">
      {rows.map(row => (
        <div className="sbar-row" key={row.label} {...bind({ title: row.label, rows: [{ label: "Flows", value: format(row.value) }] })}>
          <span className="gbar-label" title={row.label}>{row.label}</span>
          <span className="sbar-track">
            <span className="sbar" style={{ width: `${(row.value / top) * 100}%` }} />
          </span>
          <span className="sbar-value">{format(row.value)}</span>
        </div>
      ))}
      {tooltip}
    </div>
  )
}

export default ProjectPage
