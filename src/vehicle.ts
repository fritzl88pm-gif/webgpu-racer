import { BoxGeometry, CircleGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, Vector3 } from "three/webgpu";
import { CONFIG } from "./config";
import { sampleGround, surfaceSpeedLimit } from "./world";
import type { InputState } from "./input";

export class Vehicle {
  readonly group = new Group(); readonly position = new Vector3(0, 0, 75); heading = 0; speed = 0; lateralSpeed = 0; verticalVelocity = 0; grounded = true;
  private readonly body = new Group(); private readonly wheelSpinners: Mesh[] = []; private readonly velocity = new Vector3(); private readonly targetNormal = new Vector3(0, 1, 0); private readonly normal = new Vector3(0, 1, 0); private readonly forward = new Vector3(); private readonly right = new Vector3(); private readonly oldForward = new Vector3(); private readonly oldRight = new Vector3(); private readonly shadow = new Mesh(new CircleGeometry(1.45, 16), new MeshBasicMaterial({ color: 0x101510, transparent: true, opacity: 0.34, depthWrite: false }));
  constructor() {
    const red = new MeshLambertMaterial({ color: CONFIG.colors.car }); const dark = new MeshLambertMaterial({ color: CONFIG.colors.cabin }); const tire = new MeshLambertMaterial({ color: CONFIG.colors.tire });
    const chassis = new Mesh(new BoxGeometry(2.1, 0.55, 4.1), red); chassis.position.y = 0.65; this.body.add(chassis);
    const cabin = new Mesh(new BoxGeometry(1.55, 0.7, 1.8), dark); cabin.position.set(0, 1.15, -0.15); this.body.add(cabin);
    for (const x of [-1.05, 1.05]) for (const z of [-1.35, 1.35]) { const wheel = new Mesh(new CylinderGeometry(0.42, 0.42, 0.28, 10), tire); wheel.rotation.z = Math.PI / 2; wheel.position.set(x, 0.45, z); this.body.add(wheel); this.wheelSpinners.push(wheel); }
    const light = new MeshLambertMaterial({ color: CONFIG.colors.light }); const head = new Mesh(new BoxGeometry(1.45, 0.16, 0.12), light); head.position.set(0, 0.76, 2.08); this.body.add(head); this.group.add(this.body);
    this.shadow.rotation.x = -Math.PI / 2; this.group.add(this.shadow);
  }
  reset(): void { this.position.set(0, 0, 75); this.speed = 0; this.lateralSpeed = 0; this.velocity.set(0, 0, 0); this.verticalVelocity = 0; this.heading = 0; const ground = sampleGround(this.position.x, this.position.z); this.position.y = ground.height + CONFIG.carHeight; this.grounded = true; this.targetNormal.copy(ground.normal); this.normal.copy(ground.normal); this.group.position.copy(this.position); this.shadow.position.y = ground.height - this.position.y + 0.02; }
  step(input: InputState, dt: number): void {
    const ground = sampleGround(this.position.x, this.position.z); const throttle = input.throttle - input.brake;
    this.oldForward.set(Math.sin(this.heading), 0, Math.cos(this.heading)); this.oldRight.set(this.oldForward.z, 0, -this.oldForward.x);
    let longitudinal = this.velocity.dot(this.oldForward); let lateral = this.velocity.dot(this.oldRight);
    if (input.handbrake) longitudinal = longitudinal > 0 ? Math.max(0, longitudinal - CONFIG.braking * dt) : Math.min(0, longitudinal + CONFIG.braking * dt);
    else if (throttle > 0) longitudinal += CONFIG.acceleration * throttle * dt;
    else if (throttle < 0) longitudinal -= (longitudinal > 0 ? CONFIG.braking : CONFIG.reverseAcceleration) * -throttle * dt;
    else longitudinal *= Math.max(0, 1 - CONFIG.drag * dt);
    longitudinal = Math.max(-14, Math.min(surfaceSpeedLimit(ground), longitudinal));
    const yawRate = input.steer * CONFIG.steeringRate * (0.25 + Math.min(1, Math.abs(longitudinal) / 12)) * (this.grounded ? 1 : 0.3) * (longitudinal >= 0 ? 1 : -1);
    this.heading += yawRate * dt;
    this.forward.set(Math.sin(this.heading), 0, Math.cos(this.heading)); this.right.set(this.forward.z, 0, -this.forward.x);
    this.velocity.copy(this.oldForward).multiplyScalar(longitudinal).addScaledVector(this.oldRight, lateral);
    lateral = this.velocity.dot(this.right) - longitudinal * yawRate * dt * 0.7;
    lateral *= Math.max(0, 1 - (input.handbrake ? CONFIG.handbrakeGrip : CONFIG.grip) * dt);
    this.velocity.copy(this.forward).multiplyScalar(longitudinal).addScaledVector(this.right, lateral);
    this.speed = longitudinal; this.lateralSpeed = lateral; this.position.addScaledVector(this.velocity, dt);
    const nextGround = sampleGround(this.position.x, this.position.z); const targetY = nextGround.height + CONFIG.carHeight;
    if (this.position.y <= targetY + 0.25 && this.verticalVelocity <= 0) { this.position.y = targetY; this.verticalVelocity = 0; this.grounded = true; this.targetNormal.copy(nextGround.normal); } else { this.grounded = false; this.verticalVelocity -= CONFIG.gravity * dt; this.position.y += this.verticalVelocity * dt; }
    if (this.position.y < -100) this.reset(); this.normal.lerp(this.targetNormal, Math.min(1, dt * 8)); this.group.position.copy(this.position); this.body.rotation.y = this.heading; this.body.rotation.x = Math.atan2(-this.normal.z, this.normal.y); this.body.rotation.z = Math.atan2(this.normal.x, this.normal.y) - input.steer * Math.min(0.12, Math.abs(this.speed) * 0.003);
    this.shadow.position.y = nextGround.height - this.position.y + 0.02;
    for (let i = 0; i < this.wheelSpinners.length; i += 1) { const wheel = this.wheelSpinners[i]; wheel.rotation.x -= this.speed * dt / 0.42; if (i === 1 || i === 3) wheel.rotation.y = input.steer * 0.35; }
  }
}
