export type InputState = { throttle: number; brake: number; steer: number; handbrake: number; reset: boolean };
export class Input {
  readonly state: InputState = { throttle: 0, brake: 0, steer: 0, handbrake: 0, reset: false };
  private readonly keys = new Set<string>(); private readonly analog = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
  constructor() {
    window.addEventListener("keydown", (event) => { this.keys.add(event.code); if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault(); if (event.code === "KeyR") this.state.reset = true; });
    window.addEventListener("keyup", (event) => this.keys.delete(event.code));
  }
  setAnalog(value: Partial<typeof this.analog> & { reset?: boolean }): void {
    const { reset, ...analog } = value;
    Object.assign(this.analog, analog);
    if (reset) this.state.reset = true;
  }
  update(): void {
    const key = (codes: string[]) => codes.some((code) => this.keys.has(code)) ? 1 : 0;
    this.state.throttle = Math.max(this.analog.throttle, key(["KeyW", "ArrowUp"])); this.state.brake = Math.max(this.analog.brake, key(["KeyS", "ArrowDown"]));
    this.state.steer = this.analog.steer || key(["KeyD", "ArrowRight"]) - key(["KeyA", "ArrowLeft"]); this.state.handbrake = Math.max(this.analog.handbrake, key(["Space"]));
  }
  consumeReset(): boolean { const reset = this.state.reset; this.state.reset = false; return reset; }
}
