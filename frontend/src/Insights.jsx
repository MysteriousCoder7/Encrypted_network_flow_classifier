import {
  ArrowRight,
  Boxes,
  Crosshair,
  Gauge,
  GitCompareArrows,
  Handshake,
  Layers,
  Sparkles,
  Split,
  Trophy
} from "lucide-react"

import { GroupedBars, ModelLegend, Panel, StatTile, useTooltip } from "./Charts"
import { MODELS, hasLabel, mean, pct } from "./models"

const TOP_CLASSES = 8
const BINS = 10

// Batch-level insights: headline figures, model scorecards and the analysis panels.
// reference optionally adds each model's full-test-set accuracy to its scorecard.
function Insights({ flows, reference }) {
  const labelled = flows.filter(hasLabel)
  const hasLabels = labelled.length > 0

  const confidences = flows.flatMap(flow => MODELS.map(model => flow.outputs[model.name].confidence))
  const unanimous = flows.filter(flow => flow.votes === MODELS.length).length
  const majorityRight = labelled.filter(flow => flow.majority === flow.flow.true_label).length
  const distinct = new Set(flows.flatMap(flow => MODELS.map(model => flow.outputs[model.name].class))).size

  const accuracies = MODELS.map((_, index) =>
    hasLabels ? labelled.filter(flow => flow.correct[index]).length / labelled.length : null
  )
  const bestIndex = hasLabels ? accuracies.indexOf(Math.max(...accuracies)) : -1

  return (
    <div className="insights">
      <div className="kpis">
        <StatTile icon={Boxes} label="Flows classified" value={flows.length} note={`${distinct} different classes predicted`} />
        <StatTile
          icon={Handshake}
          label="All four agree"
          value={pct(unanimous / flows.length, 0)}
          note={`${unanimous} of ${flows.length} flows`}
        />
        <StatTile
          icon={Gauge}
          label="Mean confidence"
          value={pct(mean(confidences), 0)}
          note="Averaged over every model and flow"
        />
        {hasLabels ? (
          <>
            <StatTile
              icon={Trophy}
              label="Best model"
              value={MODELS[bestIndex].name}
              note={`${pct(accuracies[bestIndex])} accuracy`}
              tone="accent"
            />
            <StatTile
              icon={Crosshair}
              label="Majority vote accuracy"
              value={pct(majorityRight / labelled.length, 0)}
              note={`${majorityRight} of ${labelled.length} labelled flows`}
            />
          </>
        ) : (
          <StatTile
            icon={Crosshair}
            label="True labels"
            value="None"
            note="Add an application_name column to score accuracy"
          />
        )}
      </div>

      <ModelScorecards flows={flows} labelled={labelled} accuracies={accuracies} reference={reference} />

      <div className="insight-grid">
        <Panel
          icon={Layers}
          title="What each model predicts"
          subtitle={`Share of flows given each class, top ${TOP_CLASSES} classes`}
          className="span-2"
        >
          <ModelLegend />
          <ClassDistribution flows={flows} />
        </Panel>

        <Panel icon={GitCompareArrows} title="Model agreement" subtitle="Share of flows where two models predict the same class">
          <AgreementMatrix flows={flows} />
        </Panel>

        <Panel icon={Gauge} title="Confidence distribution" subtitle="How sure each model is across all flows">
          <ConfidenceHistograms flows={flows} />
        </Panel>

        <Panel
          icon={Sparkles}
          title="Fuzzy-GCD across flows"
          subtitle="The size unit k found for each flow"
          className={hasLabels ? "" : "span-2"}
        >
          <GcdSummary flows={flows} />
        </Panel>

        {hasLabels && (
          <Panel icon={Split} title="Effect of Fuzzy-GCD features" subtitle="Flows each GCD model gets right where its baseline is wrong, and the reverse">
            <GcdEffect flows={labelled} />
          </Panel>
        )}

        {hasLabels && (
          <Panel icon={ArrowRight} title="Most common mix-ups" subtitle="True label and the class most models chose instead" className="span-3">
            <MixUps flows={labelled} />
          </Panel>
        )}
      </div>
    </div>
  )
}

// One card per model: accuracy (or mean confidence without labels), classes
// predicted, low-confidence count and confidence when right versus wrong.
function ModelScorecards({ flows, labelled, accuracies, reference }) {
  return (
    <div className="scorecards">
      {MODELS.map((model, index) => {
        const outputs = flows.map(flow => flow.outputs[model.name])
        const meanConfidence = mean(outputs.map(output => output.confidence))
        const classes = new Set(outputs.map(output => output.class)).size
        const unsure = outputs.filter(output => output.confidence < 0.5).length
        const accuracy = accuracies[index]
        const headline = accuracy ?? meanConfidence

        const correctConf = mean(labelled.filter(flow => flow.correct[index]).map(flow => flow.outputs[model.name].confidence))
        const wrongConf = mean(labelled.filter(flow => flow.correct[index] === false).map(flow => flow.outputs[model.name].confidence))

        return (
          <article className="scorecard" key={model.name} style={{ "--model": model.color }}>
            <header className="scorecard-head">
              <span className="swatch" style={{ background: model.color }} />
              <h4>{model.name}</h4>
              <span className="scorecard-input">{model.input}</span>
            </header>

            <div className="scorecard-main">
              <strong>{pct(headline)}</strong>
              <span>{accuracy === null ? "mean confidence" : "accuracy"}</span>
            </div>

            <div className="meter" aria-hidden="true">
              <div style={{ width: `${headline * 100}%` }} />
            </div>

            {reference?.accuracy?.[model.name] !== undefined && (
              <p className="scorecard-ref">
                {reference.label}: <b>{pct(reference.accuracy[model.name])}</b>
              </p>
            )}

            <dl className="scorecard-stats">
              {accuracy !== null && (
                <div>
                  <dt>Correct</dt>
                  <dd>
                    {labelled.filter(flow => flow.correct[index]).length} / {labelled.length}
                  </dd>
                </div>
              )}
              {accuracy !== null && (
                <div>
                  <dt>Mean confidence</dt>
                  <dd>{pct(meanConfidence, 0)}</dd>
                </div>
              )}
              <div>
                <dt>Classes predicted</dt>
                <dd>{classes}</dd>
              </div>
              <div>
                <dt>Below 50% sure</dt>
                <dd>{unsure}</dd>
              </div>
              {accuracy !== null && (
                <div className="wide">
                  <dt>Confidence when right / wrong</dt>
                  <dd>
                    {labelled.some(flow => flow.correct[index]) ? pct(correctConf, 0) : "–"} /{" "}
                    {labelled.some(flow => flow.correct[index] === false) ? pct(wrongConf, 0) : "–"}
                  </dd>
                </div>
              )}
            </dl>
          </article>
        )
      })}
    </div>
  )
}

// Share of flows each model assigns to the most common classes, with the rest
// folded into Other.
function ClassDistribution({ flows }) {
  const counts = {}

  flows.forEach(flow => {
    MODELS.forEach((model, index) => {
      const name = flow.outputs[model.name].class
      counts[name] = counts[name] || [0, 0, 0, 0]
      counts[name][index] += 1
    })
  })

  const sorted = Object.entries(counts).sort(
    (a, b) => b[1].reduce((x, y) => x + y) - a[1].reduce((x, y) => x + y)
  )

  const rows = sorted.slice(0, TOP_CLASSES).map(([label, values]) => ({
    label,
    values: values.map(value => value / flows.length)
  }))

  const rest = sorted.slice(TOP_CLASSES)
  if (rest.length) {
    rows.push({
      label: `Other (${rest.length} classes)`,
      values: MODELS.map((_, index) => rest.reduce((sum, [, values]) => sum + values[index], 0) / flows.length)
    })
  }

  return <GroupedBars rows={rows} format={value => pct(value, 0)} />
}

// Pairwise matrix of how often two models predict the same class.
function AgreementMatrix({ flows }) {
  const [bind, tooltip] = useTooltip()

  const share = (a, b) =>
    flows.filter(flow => flow.outputs[a.name].class === flow.outputs[b.name].class).length / flows.length

  return (
    <div className="matrix-wrap">
      <div className="matrix" role="table" aria-label="Pairwise agreement">
        <span role="columnheader" />
        {MODELS.map(model => (
          <span className="matrix-head" role="columnheader" key={model.name}>
            <i style={{ background: model.color }} />
            {model.name}
          </span>
        ))}

        {MODELS.map(row => (
          <div className="matrix-row" role="row" key={row.name}>
            <span className="matrix-side" role="rowheader">
              <i style={{ background: row.color }} />
              {row.name}
            </span>
            {MODELS.map(column => {
              const value = share(row, column)
              const self = row.name === column.name

              return (
                <span
                  key={column.name}
                  role="cell"
                  className={`matrix-cell ${self ? "is-self" : ""} ${value > 0.6 ? "is-strong" : ""}`}
                  style={self ? undefined : { background: `color-mix(in srgb, var(--seq) ${Math.round(12 + value * 78)}%, var(--panel-solid))` }}
                  {...(self
                    ? {}
                    : bind({
                        title: `${row.name} and ${column.name}`,
                        rows: [{ label: "Same prediction", value: pct(value, 0) }]
                      }))}
                >
                  {self ? "–" : pct(value, 0)}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      {tooltip}
    </div>
  )
}

// Histogram of each model's confidence across all flows, in 10% bins.
function ConfidenceHistograms({ flows }) {
  const [bind, tooltip] = useTooltip()

  return (
    <div className="hists">
      {MODELS.map(model => {
        const values = flows.map(flow => flow.outputs[model.name].confidence)
        const bins = Array(BINS).fill(0)
        values.forEach(value => {
          bins[Math.min(BINS - 1, Math.floor(value * BINS))] += 1
        })
        const top = Math.max(1, ...bins)

        return (
          <figure className="hist" key={model.name}>
            <figcaption>
              <span>
                <i style={{ background: model.color }} />
                {model.name}
              </span>
              <b>{pct(mean(values), 0)}</b>
            </figcaption>

            <div className="hist-bars">
              {bins.map((count, index) => (
                <span
                  key={index}
                  className="hist-slot"
                  aria-label={`${model.name}, ${index * 10}–${index * 10 + 10}% confidence: ${count} flows`}
                  {...bind({
                    title: `${model.name}, ${index * 10}–${index * 10 + 10}% sure`,
                    rows: [{ color: model.color, label: "Flows", value: count }]
                  })}
                >
                  <span className="hist-bar" style={{ height: `${(count / top) * 100}%`, background: model.color }} />
                </span>
              ))}
            </div>

            <div className="hist-axis">
              <span>0%</span>
              <span>100%</span>
            </div>
          </figure>
        )
      })}
      {tooltip}
    </div>
  )
}

// Fuzzy-GCD across the batch: average share of packets on the lattice, mean
// residual and the most common values of k.
function GcdSummary({ flows }) {
  const [bind, tooltip] = useTooltip()

  const counts = {}
  flows.forEach(flow => {
    const k = flow.gcd.raw.best_k
    counts[k] = (counts[k] || 0) + 1
  })

  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
  const most = Math.max(1, ...top.map(([, count]) => count))

  const within = mean(flows.map(flow => flow.gcd.raw.within_tolerance_fraction))
  const residual = mean(flows.map(flow => flow.gcd.raw.mean_residual))

  return (
    <div className="gcd-summary">
      <div className="mini-stats">
        <div>
          <span>Packets on a multiple of k</span>
          <strong>{pct(within, 0)}</strong>
        </div>
        <div>
          <span>Mean residual</span>
          <strong>{residual.toFixed(2)} B</strong>
        </div>
      </div>

      <p className="list-title">Most common k</p>
      <ul className="bar-list">
        {top.map(([k, count]) => (
          <li
            key={k}
            {...bind({
              title: `k = ${k} bytes`,
              rows: [{ label: "Flows", value: `${count} (${pct(count / flows.length, 0)})` }]
            })}
          >
            <span className="bar-list-label">{k} B</span>
            <span className="bar-list-track">
              <span style={{ width: `${(count / most) * 100}%` }} />
            </span>
            <span className="bar-list-value">{count}</span>
          </li>
        ))}
      </ul>
      {tooltip}
    </div>
  )
}

// Flows each GCD model gets right where its baseline is wrong (fixed) and the
// reverse (broken), plus flows only both GCD models get right.
function GcdEffect({ flows }) {
  const [base, ib, gcd, gcdIb] = [0, 1, 2, 3]

  const compare = (withGcd, without) => ({
    fixes: flows.filter(flow => flow.correct[withGcd] && !flow.correct[without]).length,
    breaks: flows.filter(flow => !flow.correct[withGcd] && flow.correct[without]).length
  })

  const pairs = [
    { label: "Fuzzy-GCD vs No-IBNN", ...compare(gcd, base) },
    { label: "Fuzzy-GCD + IBNN vs IBNN", ...compare(gcdIb, ib) }
  ]

  const both = flows.filter(
    flow => flow.correct[gcd] && flow.correct[gcdIb] && !flow.correct[base] && !flow.correct[ib]
  ).length

  return (
    <div className="effect">
      {pairs.map(pair => (
        <div className="effect-row" key={pair.label}>
          <span className="effect-label">{pair.label}</span>
          <span className="effect-chip effect-good">
            <b>+{pair.fixes}</b> fixed
          </span>
          <span className="effect-chip effect-bad">
            <b>−{pair.breaks}</b> broken
          </span>
        </div>
      ))}

      <div className="effect-callout">
        <strong>{both}</strong>
        <span>
          {both === 1 ? "flow is" : "flows are"} classified correctly by both GCD models
          while both baselines get {both === 1 ? "it" : "them"} wrong.
        </span>
      </div>
    </div>
  )
}

// Most frequent pairs of true label and the wrong class the majority chose.
function MixUps({ flows }) {
  const counts = {}
  flows
    .filter(flow => flow.majority !== flow.flow.true_label)
    .forEach(flow => {
      const key = `${flow.flow.true_label}\u0000${flow.majority}`
      counts[key] = (counts[key] || 0) + 1
    })

  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  if (!top.length) {
    return <p className="empty-note">The majority vote matches the true label on every flow.</p>
  }

  return (
    <ul className="mixups">
      {top.map(([key, count]) => {
        const [truth, predicted] = key.split("\u0000")
        return (
          <li key={key}>
            <span className="mix-true" title={truth}>{truth}</span>
            <ArrowRight size={14} aria-label="predicted as" />
            <span className="mix-pred" title={predicted}>{predicted}</span>
            <b>{count}×</b>
          </li>
        )
      })}
    </ul>
  )
}

export default Insights
