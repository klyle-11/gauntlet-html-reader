export type Canonical =
  | 'lead'
  | 'story'
  | 'briefing'
  | 'trap'
  | 'feature'
  | 'decisions'
  | 'research'
  | 'fence'
  | 'measure'
  | 'hints'
  | 'slowwalk'
  | 'prove'
  | 'extra';

export interface VolumeConfig {
  id: string;
  title: string;
  subtitle?: string;
  note?: string;
  file: string;
  /** Exact heading line where this volume starts inside `file` (inclusive). */
  from?: string;
  /** Exact heading line where this volume stops inside `file` (exclusive). */
  to?: string;
  idPrefix: string;
  moduleLevel: number;
  schema: string;
  expectModules: number;
}

export interface Manifest {
  volumes: VolumeConfig[];
  stackIndex: { file: string; volumes: string[]; groupLevel: number; moduleLevel: number };
}

export interface Section {
  canonical: Canonical;
  /** The heading text exactly as written in the source. */
  heading: string;
  md: string;
}

export interface Module {
  /** `<volume>-<id>`, e.g. `VI-M60`. The only identifier work is stored under. */
  key: string;
  volume: string;
  id: string;
  title: string;
  stack?: string;
  size?: string;
  meta?: string;
  /** Explicit anchors / heading slugs in the source that point at this module. */
  anchors: string[];
  sections: Section[];
  sourceLine: number;
}

export interface Page {
  /** File-safe slug, unique across the site. */
  slug: string;
  volume: string;
  title: string;
  md: string;
  anchors: string[];
  sourceLine: number;
}

export type Entry =
  | { kind: 'group'; title: string; md: string }
  | { kind: 'module'; key: string }
  | { kind: 'page'; slug: string };

export interface Volume {
  config: VolumeConfig;
  entries: Entry[];
}

export interface StackGroup {
  title: string;
  keys: string[];
}

export interface Corpus {
  volumes: Volume[];
  modules: Map<string, Module>;
  pages: Map<string, Page>;
  stacks: StackGroup[];
  /** Section headings that fell through to `extra`, for the report. */
  unmapped: { key: string; heading: string }[];
}
