export const API = import.meta.env.VITE_API_URL || "http://localhost:8000"

export const START_COMMAND = "python -m uvicorn backend.app:app --port 8000"

// Each model keeps one colour everywhere it appears in the UI.
export const MODELS = [
  {
    name: "No-IBNN",
    color: "var(--m-base)",
    input: "Baseline input",
    description: "Convolutional classifier on the 21 scaled flow features."
  },
  {
    name: "IBNN",
    color: "var(--m-ib)",
    input: "Baseline input",
    description: "The same encoder followed by a stochastic information bottleneck."
  },
  {
    name: "Fuzzy-GCD",
    color: "var(--m-gcd)",
    input: "Fuzzy-GCD input",
    description: "Four flow features swapped for fuzzy-GCD packet-size features."
  },
  {
    name: "Fuzzy-GCD + IBNN",
    color: "var(--m-gcdib)",
    input: "Fuzzy-GCD input",
    description: "Fuzzy-GCD input followed by the information bottleneck."
  }
]

export const GCD_FEATURES = [
  "k",
  "Mean residual",
  "Normalized residual",
  "Within tolerance"
]

export const GCD_TOLERANCE = 4

const directions = { in: "inbound", out: "outbound" }
const stats = { min: "Min", mean: "Mean", stddev: "Std. dev.", max: "Max" }

const plainNames = {
  outer_bytes: "Total bytes",
  outer_duration_ms: "Duration (ms)",
  outer_first_matched_time_ms: "First matched time (ms)",
  outer_last_matched_time_ms: "Last matched time (ms)",
  outer_capture_duration_ms: "Capture duration (ms)",
  outer_packet_rate: "Packet rate",
  outer_byte_rate: "Byte rate",
  outer_bytes_in: "Bytes inbound",
  outer_bytes_out: "Bytes outbound"
}

// Turns a feature column name such as outer_mean_piat_ms_in into a readable label.
export function featureLabel(name) {
  if (plainNames[name]) return plainNames[name]

  const match = name.match(/^outer_(min|mean|stddev|max)_piat_ms(?:_(in|out))?$/)

  if (!match) return name

  const [, stat, direction] = match
  const suffix = direction ? `, ${directions[direction]}` : ""

  return `${stats[stat]} inter-arrival${suffix} (ms)`
}

// Formats a 0-1 fraction as a percentage string.
export function pct(value, digits = 1) {
  return `${(Number(value) * 100).toFixed(digits)}%`
}

// Formats a number compactly: thousands separators for large values, four
// significant digits for small ones.
export function formatNumber(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) return "–"
  if (number === 0) return "0"

  if (Math.abs(number) >= 1000) {
    return number.toLocaleString(undefined, { maximumFractionDigits: 0 })
  }

  return number.toLocaleString(undefined, { maximumSignificantDigits: 4 })
}

// True when the flow came with a true application label.
export function hasLabel(flow) {
  return Boolean(flow.flow?.true_label)
}

// Returns a model output's most likely classes as [name, probability] pairs.
export function topPredictions(output, count = 3) {
  return Object.entries(output.probabilities || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
}

// Adds a stable id, the majority class, its vote count and per-model correctness to a
// flow returned by the backend.
export function describeFlow(flow, index) {
  const id = `${flow.file_name}#${flow.row}#${index}`

  if (flow.error) return { ...flow, id }

  const label = flow.flow?.true_label
  const predictions = MODELS.map(model => flow.outputs[model.name].class)

  const tally = {}
  predictions.forEach(name => {
    tally[name] = (tally[name] || 0) + 1
  })

  const [majority, votes] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]

  return {
    ...flow,
    id,
    majority,
    votes,
    correct: predictions.map(name => (label ? name === label : null))
  }
}

// Arithmetic mean, or 0 for an empty list.
export function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

// How decided a model is: the gap between its top two classes, and normalised
// entropy (0 is certain, 1 is a uniform guess).
export function uncertainty(output) {
  const probabilities = Object.values(output.probabilities || {}).sort((a, b) => b - a)
  const margin = (probabilities[0] ?? 0) - (probabilities[1] ?? 0)
  const entropy = -probabilities
    .filter(p => p > 0)
    .reduce((sum, p) => sum + p * Math.log(p), 0)

  return {
    margin,
    entropy: probabilities.length > 1 ? entropy / Math.log(probabilities.length) : 0
  }
}

// Raw value of one named input feature for a flow.
export function featureValue(flow, name) {
  return flow.features?.find(feature => feature.name === name)?.raw ?? 0
}

// Formats a byte count with B, KB, MB, GB or TB units.
export function formatBytes(bytes) {
  const value = Number(bytes)
  if (!Number.isFinite(value)) return "–"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let index = 0
  let scaled = value
  while (Math.abs(scaled) >= 1024 && index < units.length - 1) {
    scaled /= 1024
    index += 1
  }
  return `${scaled.toLocaleString(undefined, { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`
}

// Formats milliseconds as ms, s, min or h.
export function formatDuration(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value)) return "–"
  if (value < 1000) return `${value.toFixed(0)} ms`
  if (value < 60000) return `${(value / 1000).toFixed(1)} s`
  if (value < 3600000) return `${(value / 60000).toFixed(1)} min`
  return `${(value / 3600000).toFixed(1)} h`
}
