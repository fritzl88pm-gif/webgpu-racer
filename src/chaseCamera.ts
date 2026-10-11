import { PerspectiveCamera, Vector3 } from "three/webgpu";
import { sampleGround } from "./world";
import { Vehicle } from "./vehicle";
export class ChaseCamera {
  readonly camera = new PerspectiveCamera(64, 1, 0.1, 1000); private readonly position = new Vector3(); private readonly target = new Vector3(); private readonly behind = new Vector3(); private readonly desiredPosition = new Vector3(); private readonly desiredTarget = new Vector3();
  update(vehicle: Vehicle, aspect: number, dt: number): void { this.camera.aspect = aspect; this.camera.fov = 60 + Math.min(12, Math.abs(vehicle.speed) * 0.24); this.camera.updateProjectionMatrix(); const distance = aspect < 0.8 ? 13 : 10; this.behind.set(-Math.sin(vehicle.heading) * distance, 5.8, -Math.cos(vehicle.heading) * distance); this.desiredPosition.copy(vehicle.position).add(this.behind); this.position.lerp(this.desiredPosition, Math.min(1, dt * 4)); const ground = sampleGround(this.position.x, this.position.z); this.position.y = Math.max(this.position.y, ground.height + 2.2); this.camera.position.copy(this.position); this.desiredTarget.set(Math.sin(vehicle.heading) * 3, 1, Math.cos(vehicle.heading) * 3).add(vehicle.position); this.target.lerp(this.desiredTarget, Math.min(1, dt * 6)); this.camera.lookAt(this.target); }
}
