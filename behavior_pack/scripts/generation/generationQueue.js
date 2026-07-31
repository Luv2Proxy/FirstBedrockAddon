export class GenerationQueue {
  constructor() {
    this.items = [];
    this.keys = new Set();
  }

  enqueue(item, priority = 0) {
    const key = item.key ?? `${item.rx},${item.rz}`;
    if (this.keys.has(key)) return;
    this.keys.add(key);
    this.items.push({ item, priority, key });
    this.items.sort((a, b) => b.priority - a.priority);
  }

  dequeue() {
    const entry = this.items.shift();
    if (!entry) return undefined;
    this.keys.delete(entry.key);
    return entry.item;
  }

  get size() {
    return this.items.length;
  }
}
