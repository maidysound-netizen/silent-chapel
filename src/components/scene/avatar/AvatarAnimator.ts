// AnimationMixer 를 감싼 상태 기계. 상태(idle/walk/run/…)를 바꾸면 이전 동작과 부드럽게 크로스페이드합니다.
// 임시 캐릭터와 GLB 모델이 같은 클래스를 씁니다. 없는 클립은 ANIM_FALLBACK 순서로 대신합니다.
import * as THREE from "three";
import { ANIM_STATES, resolveAnimState, type AnimState } from "@/lib/game/avatarConfig";

export type AnimClips = Partial<Record<AnimState, THREE.AnimationClip>>;

export class AvatarAnimator {
  readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<AnimState, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  /** 지금 재생 중인 상태 (대체된 결과) */
  state: AnimState | null = null;

  constructor(
    root: THREE.Object3D,
    clips: AnimClips,
    private readonly fadeSec: number,
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const s of ANIM_STATES) {
      const clip = clips[s];
      if (clip) this.actions.set(s, this.mixer.clipAction(clip));
    }
  }

  has(s: AnimState): boolean {
    return this.actions.has(s);
  }

  /** 원하는 상태로 전환 (같으면 아무것도 안 함). 실제로 재생하는 상태를 돌려줍니다 */
  setState(want: AnimState): AnimState | null {
    const s = resolveAnimState(want, (x) => this.actions.has(x));
    if (!s || s === this.state) return this.state;
    const next = this.actions.get(s)!;
    next.reset();
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.play();
    // 처음 한 번은 바로, 그 뒤로는 이전 동작에서 크로스페이드
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, this.fadeSec, false);
    this.current = next;
    this.state = s;
    return s;
  }

  /** 걷기·달리기 재생 속도를 실제 이동 속도에 맞춤 (발 미끄러짐 줄이기) */
  setTimeScale(t: number) {
    this.current?.setEffectiveTimeScale(t);
  }

  update(dt: number) {
    this.mixer.update(dt);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }
}
