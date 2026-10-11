import {
  BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry,
  InstancedMesh, Mesh, MeshLambertMaterial, Object3D, Vector3,
} from "three/webgpu";
import { CONFIG, type Ramp } from "./config";

export type GroundSample = { height: number; normal: Vector3 };
export type SurfaceType = "sand" | "grass" | "rock";
type Chunk = { group: Group; key: string; triangles: number };

const rampsByChunk = new Map<string, Ramp[]>();
const tempNormal = new Vector3();
const tempObject = new Object3D();

function hash(ix: number, iz: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function smooth(t: number): number { return t * t * (3 - 2 * t); }
function noise(x: number, z: number): number {
  const ix = Math.floor(x); const iz = Math.floor(z); const fx = smooth(x - ix); const fz = smooth(z - iz);
  const a = hash(ix, iz); const b = hash(ix + 1, iz); const c = hash(ix, iz + 1); const d = hash(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}
function terrainHeight(x: number, z: number): number {
  let value = 0; let amplitude = 1; let frequency = 0.012; let total = 0;
  for (let octave = 0; octave < 3; octave += 1) {
    value += noise(x * frequency, z * frequency) * amplitude; total += amplitude;
    amplitude *= 0.5; frequency *= 2;
  }
  return (value / total - 0.5) * 26;
}
function terrainGridHeight(x: number, z: number): number {
  const size = CONFIG.chunkSize; const segments = CONFIG.terrainSegments; const step = size / segments;
  const chunkX = Math.floor((x + size / 2) / size); const chunkZ = Math.floor((z + size / 2) / size);
  const originX = chunkX * size - size / 2; const originZ = chunkZ * size - size / 2;
  const gridX = Math.min(segments - 1, Math.max(0, Math.floor((x - originX) / step)));
  const gridZ = Math.min(segments - 1, Math.max(0, Math.floor((z - originZ) / step)));
  const tx = Math.min(1, Math.max(0, (x - (originX + gridX * step)) / step));
  const tz = Math.min(1, Math.max(0, (z - (originZ + gridZ * step)) / step));
  const x0 = originX + gridX * step; const z0 = originZ + gridZ * step;
  const h00 = terrainHeight(x0, z0); const h10 = terrainHeight(x0 + step, z0);
  const h11 = terrainHeight(x0 + step, z0 + step); const h01 = terrainHeight(x0, z0 + step);
  return tz <= tx ? h00 + tx * (h10 - h00) + tz * (h11 - h10) : h00 + tz * (h01 - h00) + tx * (h11 - h01);
}
function analyticNormal(x: number, z: number): Vector3 {
  const e = 1.2; const dx = terrainHeight(x + e, z) - terrainHeight(x - e, z); const dz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  return new Vector3(-dx / (2 * e), 1, -dz / (2 * e)).normalize();
}
function rampAt(x: number, z: number): GroundSample | undefined {
  for (const ramps of rampsByChunk.values()) for (let i = 0; i < ramps.length; i += 1) {
    const ramp = ramps[i]; const dx = x - ramp.centerX; const dz = z - ramp.centerZ;
    const c = Math.cos(ramp.yaw); const s = Math.sin(ramp.yaw);
    const localX = dx * c - dz * s; const localZ = dx * s + dz * c;
    if (Math.abs(localX) <= ramp.width * 0.5 && Math.abs(localZ) <= ramp.length * 0.5) {
      const slope = ramp.height / ramp.length; const h = ramp.height * (localZ / ramp.length + 0.5);
      tempNormal.set(-slope * s, 1, -slope * c).normalize();
      return { height: terrainGridHeight(ramp.centerX, ramp.centerZ) + h, normal: tempNormal.clone() };
    }
  }
  return undefined;
}
export function sampleGround(x: number, z: number): GroundSample {
  const ramp = rampAt(x, z); if (ramp) return ramp;
  return { height: terrainGridHeight(x, z), normal: analyticNormal(x, z) };
}
export function surfaceType(ground: GroundSample): SurfaceType {
  return ground.height < -1 ? "sand" : 1 - ground.normal.y > 0.3 ? "rock" : "grass";
}
export function surfaceSpeedLimit(ground: GroundSample): number {
  return surfaceType(ground) === "grass" ? CONFIG.maxSpeed : CONFIG.offRoadSpeed;
}

function makeTerrain(cx: number, cz: number): { mesh: Mesh; triangles: number } {
  const size = CONFIG.chunkSize; const segments = CONFIG.terrainSegments; const step = size / segments;
  const positions: number[] = []; const colors: number[] = []; const normals: number[] = [];
  const color = new Color(); const a = new Vector3(); const b = new Vector3(); const n = new Vector3();
  for (let iz = 0; iz < segments; iz += 1) for (let ix = 0; ix < segments; ix += 1) {
    const x0 = cx * size + ix * step - size / 2; const z0 = cz * size + iz * step - size / 2;
    const p = [[x0, z0], [x0 + step, z0], [x0 + step, z0 + step], [x0, z0 + step]];
    for (const tri of [[0, 2, 1], [0, 3, 2]]) {
      const vs = tri.map((index) => { const q = p[index]; return new Vector3(q[0], terrainGridHeight(q[0], q[1]), q[1]); });
      a.copy(vs[1]).sub(vs[0]); b.copy(vs[2]).sub(vs[0]); n.crossVectors(a, b).normalize();
      const h = (vs[0].y + vs[1].y + vs[2].y) / 3; const slope = 1 - n.y;
      color.setHex(h < -1 ? CONFIG.colors.sand : slope > 0.3 ? CONFIG.colors.rock : CONFIG.colors.grass);
      for (const v of vs) { positions.push(v.x, v.y, v.z); normals.push(n.x, n.y, n.z); colors.push(color.r, color.g, color.b); }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  const mesh = new Mesh(geometry, new MeshLambertMaterial({ vertexColors: true }));
  return { mesh, triangles: positions.length / 9 };
}
export class World {
  readonly group = new Group(); private chunks = new Map<string, Chunk>(); private lastCX = 999999; private lastCZ = 999999;
  private readonly treeTrunk = new CylinderGeometry(0.35, 0.5, 3, 6);
  private readonly treeCrown = new ConeGeometry(2.2, 5, 7);
  private readonly rockGeometry = new IcosahedronGeometry(1, 0);
  private readonly trunkMaterial = new MeshLambertMaterial({ color: CONFIG.colors.trunk });
  private readonly foliageMaterial = new MeshLambertMaterial({ color: CONFIG.colors.foliage });
  private readonly rockMaterial = new MeshLambertMaterial({ color: CONFIG.colors.rock });
  private readonly rampMaterial = new MeshLambertMaterial({ color: CONFIG.colors.rock });
  update(position: Vector3): void {
    const cx = Math.floor(position.x / CONFIG.chunkSize); const cz = Math.floor(position.z / CONFIG.chunkSize);
    if (cx === this.lastCX && cz === this.lastCZ) return; this.lastCX = cx; this.lastCZ = cz;
    const wanted = new Set<string>();
    for (let z = -CONFIG.chunkRadius; z <= CONFIG.chunkRadius; z += 1) for (let x = -CONFIG.chunkRadius; x <= CONFIG.chunkRadius; x += 1) {
      const key = `${cx + x},${cz + z}`; wanted.add(key); if (!this.chunks.has(key)) this.addChunk(cx + x, cz + z, key);
    }
    for (const [key, chunk] of this.chunks) if (!wanted.has(key)) { this.group.remove(chunk.group); rampsByChunk.delete(key); chunk.group.traverse((o) => { const m = o as Mesh; if (m.geometry && m.geometry !== this.treeTrunk && m.geometry !== this.treeCrown && m.geometry !== this.rockGeometry) m.geometry.dispose(); }); this.chunks.delete(key); }
  }
  private addChunk(cx: number, cz: number, key: string): void {
    const group = new Group();
    const ramps: Ramp[] = [];
    for (let i = 0; i < 2; i += 1) ramps.push({ centerX: cx * CONFIG.chunkSize + (i * 67 - 50), centerZ: cz * CONFIG.chunkSize + (i * 43 - 55), yaw: hash(cx + i, cz - i) * 6.28, length: 18, width: 8, height: 4 });
    rampsByChunk.set(key, ramps);
    const terrain = makeTerrain(cx, cz); group.add(terrain.mesh);
    const count = 16; const trunks = new InstancedMesh(this.treeTrunk, this.trunkMaterial, count); const crowns = new InstancedMesh(this.treeCrown, this.foliageMaterial, count); const rocks = new InstancedMesh(this.rockGeometry, this.rockMaterial, 10);
    let treeIndex = 0; let rockIndex = 0;
    for (let i = 0; i < 36; i += 1) { const x = (cx * 37 + i * 53) % 180 - 90 + cx * CONFIG.chunkSize; const z = (cz * 41 + i * 29) % 180 - 90 + cz * CONFIG.chunkSize; const ground = sampleGround(x, z); const r = hash(cx * 71 + i, cz * 31 - i); if (surfaceType(ground) !== "sand" && ground.normal.y > 0.82 && r > 0.42 && treeIndex < count) { tempObject.position.set(x, ground.height + 1.5, z); tempObject.scale.setScalar(0.7 + r * 0.7); tempObject.rotation.y = r * 6; tempObject.updateMatrix(); trunks.setMatrixAt(treeIndex, tempObject.matrix); tempObject.position.y += 3.8; tempObject.scale.setScalar(0.75 + r * 0.5); tempObject.updateMatrix(); crowns.setMatrixAt(treeIndex, tempObject.matrix); treeIndex += 1; } else if (r < 0.22 && rockIndex < 10) { tempObject.position.set(x, ground.height + 0.6, z); tempObject.scale.set(1 + r, 0.6 + r, 0.8 + r); tempObject.rotation.set(r * 3, r * 6, r * 2); tempObject.updateMatrix(); rocks.setMatrixAt(rockIndex, tempObject.matrix); rockIndex += 1; } }
    trunks.count = treeIndex; crowns.count = treeIndex; rocks.count = rockIndex; group.add(trunks, crowns, rocks);
    for (const ramp of ramps) { const box = new Mesh(new BoxGeometry(ramp.width, ramp.height, ramp.length), this.rampMaterial); box.position.set(ramp.centerX, terrainGridHeight(ramp.centerX, ramp.centerZ) + ramp.height / 2, ramp.centerZ); box.rotation.set(-Math.atan(ramp.height / ramp.length), ramp.yaw, 0); group.add(box); }
    this.chunks.set(key, { group, key, triangles: terrain.triangles }); this.group.add(group);
  }
  get chunkCount(): number { return this.chunks.size; }
  get triangleCount(): number { let total = 0; for (const chunk of this.chunks.values()) total += chunk.triangles; return total; }
}
