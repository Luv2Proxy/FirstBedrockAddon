import { system } from "@minecraft/server";
import { GenerationQueue } from "./generationQueue.js";

export class GenerationScheduler {
  constructor(generator) {
    this.generator = generator;
    this.queue = new GenerationQueue();
    this.active = null;
  }

  requestRegion(rx, rz, priority = 0) {
    this.queue.enqueue({ rx, rz }, priority);
  }

  start() {
    system.runInterval(() => this.tick(), 1);
  }

  tick() {
    if (!this.active) this.active = this.queue.dequeue();
    if (!this.active) return;

    try {
      const result = this.generator.generateRegion(this.active.rx, this.active.rz);
      if (result.partial) return;
      this.active = null;
    } catch (error) {
      console.warn(`[SkyArchipelago] Generation failed for ${this.active.rx},${this.active.rz}: ${error}`);
      this.active = null;
    }
  }
}
