export interface DisposableImage { close(): void }

/** Bounded requests and LRU; decoded images are released, not merely dereferenced. */
export class TileCache<T extends DisposableImage> {
  private readonly images = new Map<string, T>();
  private readonly pending = new Map<string, AbortController>();
  private readonly failed = new Set<string>();
  private wanted = new Set<string>();
  private disposed = false;
  private readonly load: (key: string, signal: AbortSignal) => Promise<T>;
  private readonly changed: () => void;
  private readonly capacity: number;
  private readonly concurrency: number;
  constructor(load: (key: string, signal: AbortSignal) => Promise<T>, changed: () => void, capacity = 24, concurrency = 4) {
    this.load = load; this.changed = changed; this.capacity = capacity; this.concurrency = concurrency;
  }
  get loadedCount(): number { return this.images.size; }
  get failedCount(): number { return [...this.wanted].filter((key) => this.failed.has(key)).length; }
  setWanted(keys: readonly string[]): void {
    // Huge viewports fall back to the overview outside this bounded working set.
    this.wanted = new Set(keys.slice(0, this.capacity));
    for (const [key, controller] of this.pending) if (!this.wanted.has(key)) controller.abort();
    this.pump();
  }
  get(key: string): T | undefined {
    const image = this.images.get(key);
    if (image) { this.images.delete(key); this.images.set(key, image); }
    return image;
  }
  retry(): void { this.failed.clear(); this.pump(); this.changed(); }
  private pump(): void {
    if (this.disposed) return;
    for (const key of this.wanted) {
      if (this.pending.size >= this.concurrency) break;
      if (this.images.has(key) || this.pending.has(key) || this.failed.has(key)) continue;
      const controller = new AbortController();
      this.pending.set(key, controller);
      void this.load(key, controller.signal).then((image) => {
        if (this.disposed || controller.signal.aborted || !this.wanted.has(key)) { image.close(); return; }
        while (this.images.size >= this.capacity) {
          const oldest = [...this.images.keys()].find((item) => !this.wanted.has(item)) ?? this.images.keys().next().value;
          if (oldest === undefined) break;
          this.images.get(oldest)?.close(); this.images.delete(oldest);
        }
        this.images.set(key, image);
      }, () => { if (!controller.signal.aborted && !this.disposed) this.failed.add(key); }).finally(() => {
        this.pending.delete(key);
        if (!this.disposed) { this.changed(); this.pump(); }
      });
    }
  }
  dispose(): void {
    this.disposed = true;
    for (const controller of this.pending.values()) controller.abort();
    for (const image of this.images.values()) image.close();
    this.images.clear(); this.wanted.clear(); this.failed.clear();
  }
}
