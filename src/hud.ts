import { Input } from "./input";
export class Hud { readonly element = document.createElement("div"); private readonly speed = document.createElement("div"); private readonly debug = document.createElement("div");
  constructor(private readonly input: Input) { this.element.className = "hud"; this.speed.className = "speed"; this.debug.className = "debug"; this.element.append(this.speed, this.debug); document.body.append(this.element); if (matchMedia("(pointer: coarse)").matches) this.addTouch(); }
  update(speed: number, fps: number, backend: string, debug: boolean): void { this.speed.textContent = `${Math.round(Math.abs(speed) * 3.6)} km/h`; this.debug.textContent = debug ? `${Math.round(fps)} FPS · ${backend}` : ""; }
  private addTouch(): void {
    const controls = document.createElement("div"); controls.className = "controls";
    const steerPad = document.createElement("div"); steerPad.className = "pad steer-pad";
    const drivePad = document.createElement("div"); drivePad.className = "pad drive-pad";
    const make = (parent: HTMLElement, label: string, action: () => void, end: () => void) => { const button = document.createElement("button"); button.textContent = label; button.addEventListener("pointerdown", (e) => { button.setPointerCapture(e.pointerId); action(); }); ["pointerup", "pointercancel", "pointerleave"].forEach((type) => button.addEventListener(type, end)); parent.append(button); };
    make(steerPad, "◀", () => this.input.setAnalog({ steer: -1 }), () => this.input.setAnalog({ steer: 0 }));
    make(steerPad, "▶", () => this.input.setAnalog({ steer: 1 }), () => this.input.setAnalog({ steer: 0 }));
    make(drivePad, "RESET", () => this.input.setAnalog({ reset: true }), () => undefined);
    make(drivePad, "BRAKE", () => this.input.setAnalog({ brake: 1 }), () => this.input.setAnalog({ brake: 0 }));
    make(drivePad, "DRIFT", () => this.input.setAnalog({ handbrake: 1 }), () => this.input.setAnalog({ handbrake: 0 }));
    make(drivePad, "GO", () => this.input.setAnalog({ throttle: 1 }), () => this.input.setAnalog({ throttle: 0 }));
    controls.append(steerPad, drivePad);
    document.body.append(controls);
  }
}
