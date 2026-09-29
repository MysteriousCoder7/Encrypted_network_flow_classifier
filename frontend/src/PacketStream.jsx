import { MODELS } from "./models"

const WIDTH = 520
const HEIGHT = 230
const BASE = HEIGHT - 26
const K = 22
const BAR_STEP = 13
const BAR_COUNT = 40

// Deterministic pseudo-random packet sizes: mostly whole multiples of K, with about
// one in five off the lattice, like a real encrypted flow.
function makeBars() {
  let seed = 7
  const random = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }

  return Array.from({ length: BAR_COUNT }, () => {
    const units = 1 + Math.floor(random() * 8)
    const offLattice = random() < 0.2
    const height = units * K + (offLattice ? 6 + random() * 8 : 0)
    return { height, offLattice }
  })
}

const bars = makeBars()
const setWidth = BAR_COUNT * BAR_STEP

// One copy of the bar sequence starting at x = offset; two copies make the loop seamless.
function BarSet({ offset }) {
  return bars.map((bar, i) => (
    <rect
      key={`${offset}-${i}`}
      x={offset + i * BAR_STEP}
      y={BASE - bar.height}
      width={BAR_STEP - 4}
      height={bar.height}
      rx="2"
      fill={bar.offLattice ? "url(#stream-off)" : "url(#stream-on)"}
    />
  ))
}

// Decorative hero visual: packet sizes scrolling past the fuzzy-GCD lattice.
// Hidden from screen readers and still when reduced motion is on.
function PacketStream() {
  return (
    <figure className="stream" aria-hidden="true">
      <div className="stream-head">
        <span className="stream-title">
          <span className="pulse" />
          Packet-size rhythm
        </span>
        <span className="stream-chip">k = {K} B</span>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="stream-svg">
        <defs>
          <linearGradient id="stream-on" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--on-1)" }} />
            <stop offset="1" style={{ stopColor: "var(--on-2)" }} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="stream-off" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--off-1)" }} />
            <stop offset="1" style={{ stopColor: "var(--off-2)" }} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="stream-scan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: "var(--accent)" }} stopOpacity="0" />
            <stop offset="1" style={{ stopColor: "var(--accent)" }} stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="stream-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset="0.08" stopColor="white" />
            <stop offset="0.92" stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="stream-mask">
            <rect width={WIDTH} height={HEIGHT} fill="url(#stream-fade)" />
          </mask>
        </defs>

        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={i}
            className="stream-lattice"
            x1="0"
            x2={WIDTH}
            y1={BASE - (i + 1) * K}
            y2={BASE - (i + 1) * K}
          />
        ))}

        <g mask="url(#stream-mask)">
          <g className="stream-track" style={{ "--shift": `-${setWidth}px` }}>
            <BarSet offset={0} />
            <BarSet offset={setWidth} />
          </g>
        </g>

        <rect className="stream-scan" x="0" y="0" width="70" height={BASE} fill="url(#stream-scan)" />
        <line className="stream-base" x1="0" x2={WIDTH} y1={BASE} y2={BASE} />
      </svg>

      <figcaption className="stream-legend">
        <span><i className="dot-on" /> On a multiple of k</span>
        <span><i className="dot-off" /> Residual beyond tolerance</span>
      </figcaption>

      <div className="stream-models">
        {MODELS.map(model => (
          <span key={model.name} style={{ "--model": model.color }}>
            {model.name}
          </span>
        ))}
      </div>
    </figure>
  )
}

export default PacketStream
