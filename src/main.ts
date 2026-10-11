import { Color, DirectionalLight, Fog, HemisphereLight, Scene } from "three/webgpu";
import { WebGPURenderer } from "three/webgpu";
import { CONFIG } from "./config";
import { ChaseCamera } from "./chaseCamera";
import { Hud } from "./hud";
import { Input } from "./input";
import { Vehicle } from "./vehicle";
import { World } from "./world";

declare global { interface Window { __RACER__: RacerDebug; } }
type RacerDebug = { ready: boolean; backend: "webgpu" | "webgl2"; fps: number; position: { x: number; y: number; z: number }; speedKmh: number; grounded: boolean; chunksAlive: number; triangles: number; heading: number; slipSpeed: number; timeScale: number; reset: () => void };

const scene = new Scene(); scene.background = new Color(CONFIG.colors.sky); scene.fog = new Fog(CONFIG.colors.sky, CONFIG.fogNear, CONFIG.fogFar);
scene.add(new HemisphereLight(0xe7f5ff, 0x4c5a38, 1.8)); const sun = new DirectionalLight(0xfff2d5, 2.2); sun.position.set(-120, 180, 80); scene.add(sun);
const input = new Input(); const world = new World(); const vehicle = new Vehicle(); const camera = new ChaseCamera(); const hud = new Hud(input); scene.add(world.group, vehicle.group);
const renderer = new WebGPURenderer({ antialias: true, powerPreference: "high-performance" }); document.body.append(renderer.domElement);
const debug: RacerDebug = { ready: false, backend: "webgl2", fps: 0, position: { x: 0, y: 0, z: 0 }, speedKmh: 0, grounded: true, chunksAlive: 0, triangles: 0, heading: 0, slipSpeed: 0, timeScale: 1, reset: () => vehicle.reset() }; window.__RACER__ = debug;
let paused = false; let accumulator = 0; let previous = performance.now(); let fps = 0; let fpsWindowTime = 0; let fpsWindowFrames = 0;
document.addEventListener("visibilitychange", () => { paused = document.hidden; previous = performance.now(); accumulator = 0; fpsWindowTime = 0; fpsWindowFrames = 0; });
function resize(): void { const coarse = matchMedia("(pointer: coarse)").matches; renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2)); renderer.setSize(window.innerWidth, window.innerHeight, false); }
window.addEventListener("resize", resize); resize();
async function start(): Promise<void> {
  await renderer.init(); const backend = renderer.backend as typeof renderer.backend & { isWebGPUBackend: boolean }; debug.backend = backend.isWebGPUBackend ? "webgpu" : "webgl2"; vehicle.reset(); world.update(vehicle.position);
  let first = true;
  renderer.setAnimationLoop((time: number) => { const realDelta = Math.max(0, (time - previous) / 1000); previous = time; if (realDelta > 0) { fpsWindowTime += realDelta; fpsWindowFrames += 1; if (fpsWindowTime >= 0.5) { fps = fpsWindowFrames / fpsWindowTime; fpsWindowTime = 0; fpsWindowFrames = 0; } } if (!paused) { input.update(); if (input.consumeReset()) vehicle.reset(); const delta = Math.min(0.5, realDelta); accumulator += delta; let steps = 0; while (accumulator >= CONFIG.fixedStep && steps < CONFIG.maxPhysicsSteps) { vehicle.step(input.state, CONFIG.fixedStep); accumulator -= CONFIG.fixedStep; steps += 1; } world.update(vehicle.position); camera.update(vehicle, window.innerWidth / window.innerHeight, delta); renderer.render(scene, camera.camera); debug.ready = first ? true : debug.ready; first = false; debug.fps = fps; debug.timeScale = realDelta > 0 ? (steps * CONFIG.fixedStep) / realDelta : 1; debug.position.x = vehicle.position.x; debug.position.y = vehicle.position.y; debug.position.z = vehicle.position.z; debug.speedKmh = vehicle.speed * 3.6; debug.grounded = vehicle.grounded; debug.heading = vehicle.heading; debug.slipSpeed = vehicle.lateralSpeed; debug.chunksAlive = world.chunkCount; debug.triangles = world.triangleCount; hud.update(vehicle.speed, fps, debug.backend, new URLSearchParams(location.search).has("debug")); } });
}
void start();
