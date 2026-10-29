"use client";
// 성당 건축: 바닥, 벽, 기둥, 첨두아치, 볼트 천장, 스테인드글라스, 장미창, 제단 단
import { useMemo } from "react";
import * as THREE from "three";
import {
  APSE_Z,
  CEILING_Y,
  COLUMN_X,
  COLUMN_ZS,
  FRONT_Z,
  SANCTUARY_Y,
  SANCTUARY_Z,
  WALL_X,
} from "@/lib/game/chapelLayout";
import { lancetPath, lancetShape, normalizeUVs, pointedArchPoints, roseWindowTexture, stainedGlassTexture, stoneFloorTexture } from "./shapes";
import type { Quality } from "@/store/useAppStore";

const STONE = "#b9ab95";
const STONE_DARK = "#8d806d";
const VAULT = "#6f6656"; // 돌 볼트 천장

const NAVE_LEN_MIN = APSE_Z; // -22
const NAVE_LEN_MAX = FRONT_Z; // 16
const ARCADE_SPRING = 6.2;
const ARCADE_RISE = 3.2;
const AISLE_TOP = 9.6;
const GABLE_RISE = 4;

/** 벽 하나 = 구멍(아치/창) 뚫린 Shape를 두께만큼 돌출 */
function holedWall(width: [number, number], height: [number, number], holes: THREE.Path[], depth: number) {
  const s = new THREE.Shape();
  s.moveTo(width[0], height[0]);
  s.lineTo(width[1], height[0]);
  s.lineTo(width[1], height[1]);
  s.lineTo(width[0], height[1]);
  s.lineTo(width[0], height[0]);
  s.holes.push(...holes);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 });
}

// 기둥 사이 구간(bay)
const BAY_EDGES = [-20, ...COLUMN_ZS, 15];

/** 신랑(nave) 양쪽 아케이드 벽: 기둥 사이 아치 개구부 + 고창(clerestory) 창 */
function useArcadeWall() {
  return useMemo(() => {
    const holes: THREE.Path[] = [];
    const windows: { u: number; y: number }[] = [];
    for (let i = 0; i < BAY_EDGES.length - 1; i++) {
      const a = BAY_EDGES[i];
      const b = BAY_EDGES[i + 1];
      const span = b - a - 1.1;
      const c = -(a + b) / 2; // u = -z
      holes.push(lancetPath(c, -0.2, span, ARCADE_SPRING, Math.min(ARCADE_RISE, span * 0.75)));
      windows.push({ u: c, y: 10.6 });
      holes.push(lancetPath(c, 10.6, 1.6, 12.8, 1.3));
    }
    const geo = holedWall([-NAVE_LEN_MAX, -NAVE_LEN_MIN], [-0.3, CEILING_Y], holes, 0.6);
    return { geo, windows };
  }, []);
}

/** 바깥 벽: 아래쪽 키 큰 스테인드글라스 창 */
function useOuterWall() {
  return useMemo(() => {
    const holes: THREE.Path[] = [];
    const windows: number[] = [];
    for (let i = 0; i < BAY_EDGES.length - 1; i++) {
      const c = -(BAY_EDGES[i] + BAY_EDGES[i + 1]) / 2;
      holes.push(lancetPath(c, 2.6, 1.8, 7.2, 1.4));
      windows.push(c);
    }
    const geo = holedWall([-NAVE_LEN_MAX, -NAVE_LEN_MIN], [-0.3, AISLE_TOP], holes, 0.5);
    return { geo, windows };
  }, []);
}

function Glass({ width, height, rise, seed, position, rotationY, intensity }: {
  width: number;
  height: number;
  rise: number;
  seed: number;
  position: [number, number, number];
  rotationY: number;
  intensity: number;
}) {
  const geo = useMemo(() => normalizeUVs(new THREE.ShapeGeometry(lancetShape(width, height, rise), 6)), [width, height, rise]);
  const tex = useMemo(() => stainedGlassTexture(seed), [seed]);
  return (
    <mesh geometry={geo} position={position} rotation={[0, rotationY, 0]}>
      <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={intensity} side={THREE.DoubleSide} roughness={0.4} />
    </mesh>
  );
}

function Column({ x, z, height }: { x: number; z: number; height: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.5, 1.2]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.9} />
      </mesh>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.48, height, 16]} />
        <meshStandardMaterial color={STONE} roughness={0.85} />
      </mesh>
      {/* 다발 기둥 느낌의 가는 기둥 */}
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[Math.cos((k * Math.PI) / 2) * 0.46, height / 2, Math.sin((k * Math.PI) / 2) * 0.46]}>
          <cylinderGeometry args={[0.1, 0.1, height, 8]} />
          <meshStandardMaterial color={STONE} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, height + 0.15, 0]}>
        <boxGeometry args={[1.15, 0.3, 1.15]} />
        <meshStandardMaterial color={STONE_DARK} roughness={0.9} />
      </mesh>
    </group>
  );
}

/** 천장을 가로지르는 첨두아치 리브 */
function Rib({ z, span, base, rise }: { z: number; span: number; base: number; rise: number }) {
  const geo = useMemo(() => {
    const outer = pointedArchPoints(0, base, span, rise, 14);
    const inner = pointedArchPoints(0, base, span - 0.5, rise - 0.3, 14).reverse();
    const s = new THREE.Shape([...outer, ...inner]);
    return new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: false });
  }, [span, base, rise]);
  return (
    <mesh geometry={geo} position={[0, 0, z - 0.175]}>
      <meshStandardMaterial color={STONE_DARK} roughness={0.9} />
    </mesh>
  );
}

export function Architecture({ quality }: { quality: Quality }) {
  const floorTex = useMemo(() => {
    const t = stoneFloorTexture();
    t.repeat.set(5, 10);
    return t;
  }, []);
  const roseTex = useMemo(() => roseWindowTexture(), []);
  const arcade = useArcadeWall();
  const outer = useOuterWall();
  const length = NAVE_LEN_MAX - NAVE_LEN_MIN;
  const midZ = (NAVE_LEN_MAX + NAVE_LEN_MIN) / 2;
  const glassGlow = quality === "low" ? 0.9 : 0.75;

  // 천장 경사면(박공) — 아케이드 벽 위에서 가운데로 올라감
  const slope = Math.hypot(COLUMN_X, GABLE_RISE);
  const slopeAngle = Math.atan2(GABLE_RISE, COLUMN_X);

  const frontWall = useMemo(() => {
    const door = lancetPath(0, -0.2, 3.2, 3.6, 1.8);
    const rose = new THREE.Path();
    rose.absarc(0, 10.4, 2.6, 0, Math.PI * 2, true);
    return holedWall([-WALL_X, WALL_X], [-0.3, CEILING_Y + GABLE_RISE], [door, rose], 0.6);
  }, []);

  const apseWall = useMemo(() => {
    const holes = [-2.6, 0, 2.6].map((x, i) => lancetPath(x, 6.6 + (i === 1 ? 0.8 : 0), 1.4, 10.6 + (i === 1 ? 0.8 : 0), 1.3));
    return { geo: holedWall([-WALL_X, WALL_X], [-0.3, CEILING_Y + GABLE_RISE], holes, 0.6), xs: [-2.6, 0, 2.6] };
  }, []);

  return (
    <group>
      {/* 바닥 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]} receiveShadow>
        <planeGeometry args={[WALL_X * 2, length]} />
        <meshStandardMaterial map={floorTex} roughness={0.75} metalness={0.05} />
      </mesh>
      {/* 가운데 통로 카펫 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, (SANCTUARY_Z + 15) / 2 - 0.3]} receiveShadow>
        <planeGeometry args={[1.5, 15 - SANCTUARY_Z - 0.6]} />
        <meshStandardMaterial color="#5a1a1c" roughness={1} />
      </mesh>

      {/* 제단 영역 단(계단 2개) */}
      <mesh position={[0, SANCTUARY_Y / 4, SANCTUARY_Z - 0.15]} receiveShadow castShadow>
        <boxGeometry args={[12, SANCTUARY_Y / 2, 0.3]} />
        <meshStandardMaterial color="#c9bba3" roughness={0.7} />
      </mesh>
      <mesh position={[0, SANCTUARY_Y / 2, (SANCTUARY_Z - 0.3 + APSE_Z) / 2]} receiveShadow>
        <boxGeometry args={[12, SANCTUARY_Y, APSE_Z - (SANCTUARY_Z - 0.3)]} />
        <meshStandardMaterial color="#d2c5ad" roughness={0.6} />
      </mesh>

      {/* 아케이드 벽 (좌/우) */}
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={arcade.geo} position={[side * COLUMN_X - 0.3, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={STONE} roughness={0.9} />
        </mesh>
      ))}
      {/* 고창 스테인드글라스 */}
      {[-1, 1].map((side) =>
        arcade.windows.map((w, i) => (
          <Glass
            key={`${side}-${i}`}
            width={1.6}
            height={3.5}
            rise={1.3}
            seed={i * 3 + (side > 0 ? 11 : 0)}
            position={[side * COLUMN_X, w.y, -w.u]}
            rotationY={side > 0 ? -Math.PI / 2 : Math.PI / 2}
            intensity={glassGlow}
          />
        )),
      )}

      {/* 바깥 벽 + 아래 창 */}
      {[-1, 1].map((side) => (
        <mesh key={side} geometry={outer.geo} position={[side * (WALL_X + 0.25) - 0.25, 0, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
          <meshStandardMaterial color={STONE} roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((side) =>
        outer.windows.map((u, i) => (
          <Glass
            key={`o${side}-${i}`}
            width={1.8}
            height={6}
            rise={1.4}
            seed={i * 5 + (side > 0 ? 3 : 1)}
            position={[side * (WALL_X + 0.25), 2.6, -u]}
            rotationY={side > 0 ? -Math.PI / 2 : Math.PI / 2}
            intensity={glassGlow}
          />
        )),
      )}
      {/* 측랑 천장 */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (COLUMN_X + WALL_X) / 2, AISLE_TOP, midZ]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[WALL_X - COLUMN_X + 0.6, length]} />
          <meshStandardMaterial color={STONE_DARK} side={THREE.DoubleSide} roughness={1} />
        </mesh>
      ))}

      {/* 기둥 */}
      {COLUMN_ZS.map((z) => [-1, 1].map((side) => <Column key={`${z}-${side}`} x={side * COLUMN_X} z={z} height={ARCADE_SPRING} />))}

      {/* 신랑 천장(목재 박공) + 리브 */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[(side * COLUMN_X) / 2, CEILING_Y + GABLE_RISE / 2, midZ]}
          rotation={[0, 0, -side * slopeAngle]}
        >
          <boxGeometry args={[slope + 0.2, 0.2, length]} />
          <meshStandardMaterial color={VAULT} roughness={0.95} />
        </mesh>
      ))}
      {[...COLUMN_ZS, -20].map((z) => (
        <Rib key={z} z={z} span={COLUMN_X * 2} base={CEILING_Y - 2.4} rise={GABLE_RISE + 2.2} />
      ))}

      {/* 정면(입구) 벽 + 문 + 장미창 */}
      <mesh geometry={frontWall} position={[0, 0, FRONT_Z]} receiveShadow>
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      <mesh position={[0, 10.4, FRONT_Z + 0.25]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[2.6, 48]} />
        <meshStandardMaterial map={roseTex} emissiveMap={roseTex} emissive="#ffffff" emissiveIntensity={glassGlow} />
      </mesh>
      <mesh position={[0, 2.4, FRONT_Z + 0.35]}>
        <planeGeometry args={[3.4, 5.6]} />
        <meshStandardMaterial color="#4a3020" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* 제단 뒤 벽 + 세 개의 창 */}
      <mesh geometry={apseWall.geo} position={[0, 0, APSE_Z - 0.6]} receiveShadow>
        <meshStandardMaterial color={STONE} roughness={0.9} />
      </mesh>
      {apseWall.xs.map((x, i) => (
        <Glass
          key={x}
          width={1.4}
          height={5.3}
          rise={1.3}
          seed={40 + i}
          position={[x, 6.6 + (i === 1 ? 0.8 : 0), APSE_Z - 0.3]}
          rotationY={0}
          intensity={glassGlow + 0.15}
        />
      ))}
    </group>
  );
}
