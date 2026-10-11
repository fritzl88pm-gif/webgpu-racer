export const CONFIG = {
  chunkSize: 200,
  chunkRadius: 2,
  terrainSegments: 32,
  fixedStep: 1 / 120,
  maxPhysicsSteps: 60,
  maxSpeed: 50,
  offRoadSpeed: 34,
  acceleration: 22,
  reverseAcceleration: 13,
  braking: 34,
  drag: 0.7,
  steeringRate: 1.8,
  grip: 8.5,
  handbrakeGrip: 1.5,
  gravity: 24,
  carHeight: 0.65,
  fogNear: 260,
  fogFar: 720,
  colors: {
    sky: 0x9bc3d5,
    grass: 0x5f8f4b,
    rock: 0x777b73,
    sand: 0xc9ae70,
    trunk: 0x65452c,
    foliage: 0x346542,
    car: 0xd34a35,
    cabin: 0x263d4c,
    tire: 0x1b1d1c,
    light: 0xfff0bb,
  },
} as const;

export type Ramp = {
  centerX: number;
  centerZ: number;
  yaw: number;
  length: number;
  width: number;
  height: number;
};
