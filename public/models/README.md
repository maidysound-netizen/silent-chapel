# 아바타 GLB 모델 넣는 곳

Wands King Bride 등 캐릭터 GLB가 준비되면 이 폴더에 넣고 `src/lib/game/avatarConfig.ts` 의 `AVATAR_MODEL` 만 바꾸면 됩니다.
다른 코드는 고칠 필요가 없습니다. 파일이 없거나 불러오지 못하면 자동으로 임시 캐릭터를 씁니다.

```ts
export const AVATAR_MODEL = {
  url: "/models/wands-king-bride.glb", // ← 이 폴더의 파일
  heightM: 1.65,      // 화면에서의 키 (m). 모델 원래 크기와 상관없이 이 높이로 맞춤
  yOffset: 0,         // 발이 바닥에 뜨거나 묻히면 조정
  rotationY: Math.PI, // 모델이 뒤를 보고 걸으면 0 으로
  clips: { idle: "Idle", walk: "Walk", run: "Run", sit: "Sit", kneel: "Kneel", pray: "Pray", bow: "Bow" },
  fadeSec: 0.3,       // 동작 전환 크로스페이드 (초)
  clipSpeed: { walk: 2.3, run: 4.4 }, // 클립이 이 속도로 걸을 때 발이 안 미끄러짐
};
```

## 모델 준비 체크리스트
- **형식**: glTF 2.0 바이너리(`.glb`), 스킨드 메시 + 애니메이션 클립이 한 파일에
- **클립 이름**: `clips` 에 적은 이름과 같게 (대소문자 무시, 일부 일치도 찾음). 없는 클립은 대체됨: Run→Walk→Idle, Pray→Kneel→Idle, Sit→Idle
- **정면**: glTF 기본은 +Z 정면 → `rotationY: Math.PI` 로 앱의 앞(-Z)에 맞춤
- **모바일 성능**: 삼각형 1만~2만 개 이하, 텍스처 1024px 이하, 뼈 60개 이하 권장. Draco/Meshopt 압축 가능(drei `useGLTF` 가 처리)
- **라이선스**: 모델·텍스처의 사용 허락을 확인하고 `CREDITS.md` 에 적기
- **앉기(Sit) 클립**: 엉덩이가 장의자 좌판 높이(0.49m)에 오도록. 클립이 없으면 GLB 캐릭터는 앉은 자리에서 서 있는 Idle로 보입니다

이 폴더의 파일은 `public/` 아래라서 누구나 내려받을 수 있습니다. 공개하면 안 되는 모델은 넣지 마세요.

## 성당 성상 (chapel/)

`chapel/crucifix.glb`, `chapel/mary.glb` 는 Meshy AI 원본(`object/` 폴더, 각 40~56MB, 63만·116만 삼각형)을
모바일용으로 줄인 사본입니다 (각 1MB 이하, 약 6~7만 삼각형, 1024px WebP 텍스처, meshopt 압축).
원본은 수정하지 않았습니다. 다시 만들 때 (프로젝트 밖 임시 폴더에 도구 설치):

```bash
npx @gltf-transform/cli@4 optimize object/Meshy_AI_crucifix_statue_….glb public/models/chapel/crucifix.glb \
  --compress meshopt --texture-compress webp --texture-size 1024 --simplify-ratio 0.1 --simplify-error 0.0005
npx @gltf-transform/cli@4 optimize object/Meshy_AI_virgin_mary_statue_….glb public/models/chapel/mary.glb \
  --compress meshopt --texture-compress webp --texture-size 1024 --simplify-ratio 0.06 --simplify-error 0.0005
```

배치·크기는 `src/lib/game/chapelLayout.ts` 의 `CRUCIFIX`(받침이 제단 단 바닥에, 높이 6.4m)와
`MARY_SHRINE`(받침대 0.7m + 성모상 1.7m)에서, 불러오기·재질 보정은 `src/components/scene/StatueModel.tsx` 에서 합니다.
