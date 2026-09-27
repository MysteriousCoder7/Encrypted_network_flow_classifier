import { Brain, Calculator, Gauge, Layers, Scale, Target } from "lucide-react"

import gcdImage from "./assets/GCD.png"
import metricsImage from "./assets/all_models_metrics.png"
import gcdLabelsImage from "./assets/highest_gcd_labels.png"

function PageHead({ icon: Icon, title, children }) {
  return (
    <header className="page-head">
      <span className="page-icon" aria-hidden="true">
        <Icon size={26} />
      </span>
      <div>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
    </header>
  )
}

export function GcdTab() {
  return (
    <article className="explain">
      <PageHead icon={Calculator} title="Fuzzy-GCD">
        Encrypted payloads hide content, but packet sizes still follow the
        block and record sizes of the protocol underneath. Fuzzy-GCD looks for
        a size unit k so that packet sizes sit close to whole multiples of k,
        allowing a small residual instead of an exact greatest common divisor.
      </PageHead>

      <p className="formula">
        <span className="formula-text">packet size ≈ n × k + residual</span>
      </p>

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
        <figcaption>Each packet is read as a whole number of k-byte units plus a leftover, the residual shown in red.</figcaption>
      </figure>
    </article>
  )
}

export function IbTab() {
  const notes = [
    {
      icon: Layers,
      title: "Compression",
      text: "The bottleneck discourages the latent representation from keeping information about the input that the label doesn't need."
    },
    {
      icon: Target,
      title: "Prediction",
      text: "Cross-entropy makes the latent representation keep what is useful for predicting the application class."
    },
    {
      icon: Scale,
      title: "The β trade-off",
      text: "β balances compression against prediction. A larger β puts more pressure on the information term."
    },
    {
      icon: Gauge,
      title: "A fair comparison",
      text: "No-IBNN and IBNN share the same convolutional encoder and classifier sizes. The only difference is the stochastic layer and the MI term."
    }
  ]

  return (
    <article className="explain">
      <PageHead icon={Brain} title="Information bottleneck">
        The IBNN adds a stochastic latent layer between the encoder and the
        classifier, and adds a mutual-information estimate to the loss. The
        model is pushed to keep only what helps predict the application.
      </PageHead>

      <p className="formula">
        <span className="formula-text">Loss = cross-entropy + β × MI + L2</span>
      </p>

      <div className="notes">
        {notes.map(({ icon: Icon, title, text }) => (
          <section className="note" key={title}>
            <span className="note-icon" aria-hidden="true">
              <Icon size={20} />
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </section>
        ))}
      </div>
    </article>
  )
}

export function EvaluationTab() {
  return (
    <article className="explain">
      <PageHead icon={Gauge} title="Evaluation">
        All four models were evaluated on the same stratified 30% test split
        of the VPN-nonVPN sessions, after removing classes with fewer than 100
        flows.
      </PageHead>

      <figure className="figure">
        <div className="figure-frame">
          <img src={metricsImage} alt="Accuracy, precision, recall and F1 for No-IBNN, IBNN, Fuzzy-GCD and Fuzzy-GCD + IBNN" />
        </div>
        <figcaption>
          Accuracy, precision, recall and F1 for each model. The two Fuzzy-GCD
          models score highest on every metric.
        </figcaption>
      </figure>

      <figure className="figure">
        <div className="figure-frame">
          <img src={gcdLabelsImage} alt="Applications with the largest F1 change when fuzzy-GCD features are added" />
        </div>
        <figcaption>
          Applications whose F1 score changes most when fuzzy-GCD features are
          added, compared with the matching model without them.
        </figcaption>
      </figure>
    </article>
  )
}
