// 3D 캔버스 밖(HTML)에서 3D 좌표를 화면 좌표로 바꿀 때 쓰는 공유 참조
import type * as THREE from "three";

export const sceneRefs: { camera: THREE.Camera | null; canvas: HTMLCanvasElement | null } = {
  camera: null,
  canvas: null,
};
