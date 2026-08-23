/**
 * MeshSim — a headless multi-hop broadcast simulator.
 *
 * Deliberately not a general MANET simulator. It models exactly the four
 * strategies the lesson compares, in the regime that makes LoRa mesh weird:
 * airtime is enormous (a 16-byte LongFast packet occupies the channel for
 * ~354 ms), so the channel, not the routing table, is the scarce resource.
 *
 *   naive       every reception triggers a rebroadcast. The 1999 broadcast storm.
 *   dedupe      drop a packet you have already seen. One rebroadcast per node.
 *   counter     dedupe + wait a random back-off, and cancel if you hear someone
 *               else rebroadcast it first — the counter-based scheme.
 *   meshtastic  dedupe + cancel, but the back-off is *ordered by SNR*: the
 *               node that heard the weakest signal (i.e. is furthest away)
 *               waits least and rebroadcasts first, because its rebroadcast
 *               reaches the most new ground. That is the distance-based scheme
 *               from the same 1999 paper, using SNR as a proxy for distance —
 *               which is what Meshtastic actually ships.
 *
 * Collision model: half duplex, and a reception is destroyed if any other
 * transmission the receiver can hear overlaps it at any point. No capture
 * effect — real LoRa often *can* decode the stronger of two overlapping
 * signals, so the collision counts here are pessimistic, and the page says so.
 */
import { mulberry32 } from './radio';

export type MeshMode = 'naive' | 'dedupe' | 'counter' | 'meshtastic';

export const MESH_MODES: { id: MeshMode; label: string; blurb: string }[] = [
  { id: 'naive', label: '天真氾濫', blurb: '收到就轉，不管收過沒有。1999 年那篇論文在講的災難。' },
  { id: 'dedupe', label: '＋重複抑制', blurb: '同一個封包只轉一次。最基本、也最有效的一招。' },
  { id: 'counter', label: '＋轉送前先聽', blurb: '隨機退避，聽到別人轉了就取消自己的。counter-based。' },
  { id: 'meshtastic', label: 'Meshtastic 實際做法', blurb: 'SNR 越差（越遠）退避越短、越優先轉送。distance-based。' },
];

export interface MeshConfig {
  nodeCount: number;
  /** field is FIELD × FIELD units; range is in the same units */
  range: number;
  hopLimit: number;
  airtimeMs: number;
  contentionWindowMs: number;
  mode: MeshMode;
}

export const FIELD = 100;

export interface MeshNodeView {
  x: number;
  y: number;
  reached: boolean;
  transmitting: boolean;
  pending: boolean;
  txCount: number;
  collisions: number;
  hop: number;
}

export interface MeshStats {
  mode: MeshMode;
  nodes: number;
  reached: number;
  deliveryRatio: number;
  transmissions: number;
  collisions: number;
  totalAirtimeMs: number;
  completionMs: number;
  maxHop: number;
  finished: boolean;
  timeMs: number;
}

interface Pending {
  fireAt: number;
  hopsLeft: number;
  cancelled: boolean;
}

interface Node {
  x: number;
  y: number;
  seen: boolean;
  reached: boolean;
  hop: number;
  txCount: number;
  collisions: number;
  transmitting: boolean;
  pending: Pending[];
}

interface Transmission {
  from: number;
  start: number;
  end: number;
  hopsLeft: number;
  corrupted: Set<number>;
}

export class MeshSim {
  public readonly nodes: Node[] = [];
  private readonly neighbours: number[][] = [];
  private active: Transmission[] = [];
  private rnd: () => number;

  private time = 0;
  private transmissions = 0;
  private collisions = 0;
  private completionMs = 0;
  private finished = false;

  constructor(private config: MeshConfig, seed: number) {
    this.rnd = mulberry32(seed);
    const rnd = mulberry32(seed ^ 0x5f3759df);
    for (let i = 0; i < config.nodeCount; i++) {
      this.nodes.push({
        // node 0 is pinned to the left edge so the broadcast has somewhere to go
        x: i === 0 ? 8 : 6 + rnd() * (FIELD - 12),
        y: i === 0 ? FIELD / 2 : 6 + rnd() * (FIELD - 12),
        seen: false, reached: false, hop: -1, txCount: 0, collisions: 0,
        transmitting: false, pending: [],
      });
    }
    for (let i = 0; i < this.nodes.length; i++) {
      const list: number[] = [];
      for (let j = 0; j < this.nodes.length; j++) {
        if (i === j) continue;
        if (this.distance(i, j) <= config.range) list.push(j);
      }
      this.neighbours.push(list);
    }
    this.start();
  }

  private distance(a: number, b: number): number {
    return Math.hypot(this.nodes[a].x - this.nodes[b].x, this.nodes[a].y - this.nodes[b].y);
  }

  /** Kick the source off immediately. */
  private start(): void {
    const src = this.nodes[0];
    src.seen = true;
    src.reached = true;
    src.hop = 0;
    src.pending.push({ fireAt: 0, hopsLeft: this.config.hopLimit, cancelled: false });
  }

  private get cancelsOnOverhear(): boolean {
    return this.config.mode === 'counter' || this.config.mode === 'meshtastic';
  }

  private get dedupes(): boolean {
    return this.config.mode !== 'naive';
  }

  private backoffMs(receiver: number, sender: number): number {
    const cw = this.config.contentionWindowMs;
    switch (this.config.mode) {
      case 'naive':
      case 'dedupe':
        // essentially "transmit as soon as the radio is free". Expressed as a
        // fraction of airtime rather than a fixed 20 ms so that scaling airtime
        // and the contention window together leaves the results unchanged —
        // what matters is the *ratio*, and a sim that broke that invariance
        // would make "pretend this is Wi-Fi" experiments meaningless.
        return this.rnd() * this.config.airtimeMs * 0.06;
      case 'counter':
        return this.rnd() * cw;
      case 'meshtastic': {
        // SNR stands in for distance: near neighbours (strong signal) wait the
        // full window, distant ones go almost immediately
        const d = Math.min(1, this.distance(receiver, sender) / this.config.range);
        return cw * (1 - d) + this.rnd() * cw * 0.12;
      }
    }
  }

  private beginTransmission(from: number, hopsLeft: number): void {
    const node = this.nodes[from];
    node.transmitting = true;
    node.txCount++;
    this.transmissions++;
    const tx: Transmission = {
      from,
      start: this.time,
      end: this.time + this.config.airtimeMs,
      hopsLeft,
      corrupted: new Set([from]),
    };

    // half duplex: this node cannot hear anything while it talks
    for (const other of this.active) {
      if (other.corrupted.has(from)) continue;
      if (this.neighbours[other.from].includes(from)) {
        other.corrupted.add(from);
        this.collisions++;
        this.nodes[from].collisions++;
      }
    }

    // anyone who can hear both this and an in-flight transmission loses both
    for (const n of this.neighbours[from]) {
      for (const other of this.active) {
        if (other.from === n) continue;
        if (!this.neighbours[other.from].includes(n)) continue;
        if (!other.corrupted.has(n)) {
          other.corrupted.add(n);
          this.collisions++;
          this.nodes[n].collisions++;
        }
        tx.corrupted.add(n);
      }
      // carrier sense: hearing the packet cancels your own queued rebroadcast
      if (this.cancelsOnOverhear) {
        for (const p of this.nodes[n].pending) p.cancelled = true;
      }
    }

    this.active.push(tx);
  }

  private deliver(to: number, hopsLeft: number, from: number): void {
    const node = this.nodes[to];
    if (this.dedupes && node.seen) return;
    const firstTime = !node.seen;
    node.seen = true;
    if (firstTime) {
      node.reached = true;
      node.hop = this.nodes[from].hop + 1;
      this.completionMs = this.time;
    }
    if (hopsLeft <= 0) return;
    // one queued rebroadcast per node is plenty; naive is allowed a few so the
    // storm can actually build up
    const cap = this.config.mode === 'naive' ? 3 : 1;
    const live = node.pending.filter((p) => !p.cancelled).length;
    if (live >= cap) return;
    node.pending.push({
      fireAt: this.time + this.backoffMs(to, from),
      hopsLeft: hopsLeft - 1,
      cancelled: false,
    });
  }

  /** Advance the simulation by `dt` milliseconds. */
  public step(dt: number): void {
    if (this.finished) return;
    this.time += dt;

    // finish transmissions
    const stillActive: Transmission[] = [];
    for (const tx of this.active) {
      if (tx.end > this.time) { stillActive.push(tx); continue; }
      this.nodes[tx.from].transmitting = false;
      for (const n of this.neighbours[tx.from]) {
        if (tx.corrupted.has(n)) continue;
        this.deliver(n, tx.hopsLeft, tx.from);
      }
    }
    this.active = stillActive;

    // fire due rebroadcasts
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      if (node.pending.length === 0) continue;
      const remaining: Pending[] = [];
      for (const p of node.pending) {
        if (p.cancelled) continue;
        if (p.fireAt > this.time) { remaining.push(p); continue; }
        if (node.transmitting) { remaining.push(p); continue; }
        this.beginTransmission(i, p.hopsLeft);
      }
      node.pending = remaining;
    }

    if (this.active.length === 0 && this.nodes.every((n) => n.pending.every((p) => p.cancelled))) {
      this.finished = true;
    }
  }

  /** Run to completion (or a hard cap) and return the result. */
  public runToCompletion(maxMs = 600_000): MeshStats {
    const dt = 5;
    while (!this.finished && this.time < maxMs) this.step(dt);
    return this.stats();
  }

  public stats(): MeshStats {
    const reached = this.nodes.filter((n) => n.reached).length;
    return {
      mode: this.config.mode,
      nodes: this.nodes.length,
      reached,
      deliveryRatio: reached / this.nodes.length,
      transmissions: this.transmissions,
      collisions: this.collisions,
      totalAirtimeMs: this.transmissions * this.config.airtimeMs,
      completionMs: this.completionMs,
      maxHop: Math.max(0, ...this.nodes.map((n) => n.hop)),
      finished: this.finished,
      timeMs: this.time,
    };
  }

  public view(): MeshNodeView[] {
    return this.nodes.map((n) => ({
      x: n.x, y: n.y,
      reached: n.reached,
      transmitting: n.transmitting,
      pending: n.pending.some((p) => !p.cancelled),
      txCount: n.txCount,
      collisions: n.collisions,
      hop: n.hop,
    }));
  }

  public get isFinished(): boolean { return this.finished; }
  public get neighbourList(): number[][] { return this.neighbours; }
}

export interface ModeComparison {
  mode: MeshMode;
  deliveryRatio: number;
  transmissions: number;
  collisions: number;
  airtimeMs: number;
  completionMs: number;
}

/** Average each strategy over `runs` different node layouts. */
export function compareModes(config: Omit<MeshConfig, 'mode'>, runs: number, baseSeed: number): ModeComparison[] {
  return MESH_MODES.map(({ id }) => {
    const acc = { deliveryRatio: 0, transmissions: 0, collisions: 0, airtimeMs: 0, completionMs: 0 };
    for (let r = 0; r < runs; r++) {
      // every mode sees the identical set of layouts, so the comparison is fair
      const s = new MeshSim({ ...config, mode: id }, baseSeed + r * 7919);
      const st = s.runToCompletion();
      acc.deliveryRatio += st.deliveryRatio;
      acc.transmissions += st.transmissions;
      acc.collisions += st.collisions;
      acc.airtimeMs += st.totalAirtimeMs;
      acc.completionMs += st.completionMs;
    }
    return {
      mode: id,
      deliveryRatio: acc.deliveryRatio / runs,
      transmissions: acc.transmissions / runs,
      collisions: acc.collisions / runs,
      airtimeMs: acc.airtimeMs / runs,
      completionMs: acc.completionMs / runs,
    };
  });
}
