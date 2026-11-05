// js-aruco2 ships plain CommonJS without types; only what marker-detect.ts uses (D-120).
declare module "js-aruco2" {
  export type ArucoPoint = { x: number; y: number };
  export type ArucoMarker = { id: number; corners: ArucoPoint[]; hammingDistance: number };
  export type ArucoImage = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };
  type Detector = new (config: { dictionaryName: string; maxHammingDistance?: number }) => {
    detect(image: ArucoImage): ArucoMarker[];
  };
  const aruco: { AR: { Detector: Detector } };
  export default aruco;
}
declare module "js-aruco2/src/dictionaries/aruco_4x4_1000.js";
