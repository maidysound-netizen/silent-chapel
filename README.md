# Silent Chapel

방문자가 조용히 앉아 개인 묵상을 하고, 실제 가톨릭 묵주기도를 단계별로 바칠 수 있는 **3D 가상 성당**입니다.
한 방에 10명까지 같은 공간에서 서로의 움직임을 볼 수 있는 실시간 멀티플레이를 Supabase Realtime으로 구현했습니다. 방이 가득 차면 다음 방(제2경당 … 제10경당)으로 자동 입장해 최대 100명까지 받습니다.

> 이 공간은 미사·고해성사·성체성사 등 실제 성당의 성사를 대신하지 않는 개인 묵상 도구입니다.
> 점수·랭킹·보상 같은 경쟁 요소는 없습니다.

---

## 1. 빠른 시작 (Supabase 없이 — Phase 1)

```bash
npm install
```

```bash
npm run dev
```

브라우저에서 http://localhost:3100 을 엽니다. 환경 변수가 없으면 **혼자 머무는 모드**로 실행되며 화면에 그렇게 표시됩니다.

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (포트 3100) |
| `npm run build` | 프로덕션 빌드 (TypeScript 검사 포함) |
| `npm start` | 빌드 결과 실행 |
| `npm run typecheck` | TypeScript 검사만 |
| `npm test` | 단위 테스트 + 멀티플레이 로직 시뮬레이션 테스트 |

> **외장 exFAT 드라이브에서 설치하는 경우**: exFAT는 심볼릭 링크를 지원하지 않아 `npm install`이 실패할 수 있습니다.
> `npm install --no-bin-links` 로 설치하세요. `package.json` 스크립트는 `node node_modules/...` 를 직접 호출하므로 그대로 동작합니다.

## 2. 멀티플레이 켜기 (Phase 2)

1. [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) 대로 **개발용** Supabase 프로젝트를 만들고 SQL 마이그레이션을 실행합니다.
2. `.env.example` 을 `.env.local` 로 복사하고 URL과 publishable(anon) 키를 넣습니다.
3. `npm run dev` 를 다시 시작하고, 브라우저 두 개(일반 창 + 시크릿 창)로 접속합니다.
4. 설정(⚙) → "네트워크 정보 표시"를 켜면 초당 메시지 수, 전송 주기, 지연을 볼 수 있습니다.

`?room=다른-방-id` 로 다른 방에 들어갈 수 있습니다(해당 id가 `rooms` 테이블에 있어야 함).

## 3. 조작

| 동작 | PC | 모바일 |
| --- | --- | --- |
| 이동 | W A S D / 방향키 | 왼쪽 아래 조이스틱 |
| 달리기 | 이동하면서 **Shift** | 오른쪽 아래 **달리기** 버튼을 누르고 있기 |
| 시점 | 마우스 드래그, 휠로 거리 | 화면 드래그 |
| 묵주 집기 | 가까이 가서 **E** 또는 클릭 | 화면의 버튼 또는 탭 |
| 앉기/일어나기 | 장의자 근처에서 **F** | 버튼 |
| 묵상 시점 (드래그로 주변 둘러보기) | 앉은 상태에서 **M** | 버튼 |
| 절하기 — 어디서든 바라보는 방향으로 (성모상 근처는 성모님, 제단 앞은 예수님(십자가)을 향해) | **B** | 버튼 |
| 언어 바꾸기 | 화면 위 **한 / EN / 日** 탭 | 같음 |
| 묵주기도 진행 | → / Space 다음, ← 이전, P 멈춤, Esc 닫기 | 버튼 |

화면에 고정된 버튼은 없고, **필요할 때만 물체 위에 글씨가 떠오릅니다**(묵주 받침대 → 묵주 집어 들기, 성모상 → 성모님께 절하기, 제단 앞 → 예수님께 절하기,
장의자 → 앉기). 그 밖의 곳에서는 아래 가운데에 흐린 절하기 버튼만 있고, 앉아 있을 때는 묵주기도 · 묵상 시점 · 절하기 · 일어나기가 나타납니다.
묵주기도를 시작하면 글씨 없이 3D 묵주만 창 가득 보이며, 탭하거나 아래로 끌면 한 알씩 넘어갑니다. 글씨를 누르거나 표시된 키를 누르면 됩니다.
기도 화면에는 **3D 묵주만** 보입니다. 묵주를 탭하거나 아래로 끌면 다음 알, 위로 끌면 이전 알로 넘어갑니다(마우스 휠·방향키도 가능).
소리(🔈)를 켜면 그레고리오 성가가 잔잔히 흐르고, 묵주알을 굴릴 때 작은 나무 소리가 납니다.
성경 기능은 다음 업데이트를 위해 잠시 꺼 두었습니다(`src/lib/features.ts` 의 `bible`).
3D가 무거운 기기에서는 입장 화면의 **2D 기도 모드**를 사용하세요.

### 아바타와 애니메이션
- 캐릭터는 이동 방향으로 부드럽게 돌고, Three.js **AnimationMixer** 로 Idle · Walk · Run 클립을 0.3초 크로스페이드로 전환합니다.
  걷기·달리기 클립 재생 속도는 실제 이동 속도에 맞춰 조절됩니다.
- 지금은 코드로 만든 **임시 캐릭터**와 임시 클립을 씁니다. GLB(예: Wands King Bride)는
  [public/models/README.md](public/models/README.md) 대로 `src/lib/game/avatarConfig.ts` 의 `AVATAR_MODEL.url` 만 바꾸면 교체됩니다.
- 이동 속도(걷기 2.3m/s, 달리기 4.4m/s)와 모델 키·클립 이름은 같은 파일에서 따로 관리합니다.
- 애니메이션 상태는 `idle · walk · run · sit · kneel · pray` 로 정해 두었고, kneel · pray 는 클립·자세를 넣을 자리만 마련되어 있습니다.
- 카메라는 캐릭터와 같은 충돌 데이터로 기둥·장의자·제단 등을 뚫지 않고 그 앞에서 멈춥니다(낮은 장의자 위로는 넘어감).
- 다른 사람에게는 애니메이션 상태가 함께 전송됩니다(`StateMessage.k`, 예전 버전과 호환).

## 4. 폴더 구조

```
silent-chapel/
├─ src/
│  ├─ app/                     Next.js App Router (layout, page, globals.css)
│  ├─ components/
│  │  ├─ ChapelApp.tsx         최상위: 입장/성당/2D 전환, 키보드, 네트워크 수명 관리
│  │  ├─ scene/                3D (React Three Fiber)
│  │  │  ├─ Architecture.tsx   벽·기둥·첨두아치·볼트·스테인드글라스·장미창
│  │  │  ├─ Furnishings.tsx    장의자(Instanced)·제단·십자가상·성모상·촛대
│  │  │  ├─ Interactables.tsx  클릭 가능한 묵주·성경
│  │  │  ├─ LocalPlayer.tsx    입력 → 이동 → 상호작용 → 네트워크 전송
│  │  │  ├─ RemoteAvatars.tsx  다른 방문자 (보간 렌더링)
│  │  │  ├─ CameraRig.tsx      3인칭 카메라 / 묵상 시점
│  │  │  ├─ Avatar.tsx         아바타(모델 선택 + 이름표)
│  │  │  ├─ avatar/            임시 캐릭터 · GLB 캐릭터 · AnimationMixer 상태 기계 · 임시 클립
│  │  │  ├─ Lighting.tsx       품질별 조명·그림자
│  │  │  └─ shapes.ts          아치 모양, 절차적 텍스처(직접 생성)
│  │  └─ ui/                   입장 화면, HUD, 묵주기도·성경·설정 패널, 조이스틱
│  ├─ lib/
│  │  ├─ rosary/               묵주기도 순서·상태 (순수 함수) + 로컬 저장
│  │  ├─ i18n/                 UI 문구, 기도 데이터 (ko / en / ja 구조)
│  │  ├─ game/                 PlayerState, PlayerController, InteractionSystem, 배치 데이터, avatarConfig(속도·모델·애니메이션), cameraCollision
│  │  └─ net/                  NetworkManager, RoomManager, PresenceManager,
│  │                           PositionInterpolation, ReconnectionHandler, protocol
│  └─ store/                   UI 상태(zustand), 로컬 플레이어 가변 상태
├─ supabase/migrations/        SQL 마이그레이션
├─ tests/                      node:test 단위·시뮬레이션 테스트
└─ docs/                       설정 가이드, 사용량 주의, 테스트 결과, FPS 학습 문서
```

FPS 개발에 재사용하기 쉬운 모듈(요청 사항 10번)은 `src/lib/game`, `src/lib/net` 에 있으며 React/Three.js에 의존하지 않습니다.

## 5. 묵주기도와 저작권

- 기도 순서는 「동정 마리아의 묵주기도」(교황 요한 바오로 2세, 2002)와 한국 교회 관습을 따릅니다.
  `src/lib/rosary/sequence.ts` 와 `tests/rosary.test.ts` 에서 순서를 확인할 수 있습니다.
- 한국어 공식 기도문(한국천주교주교회의)은 저작권이 명시되어 있어 **전문을 싣지 않았습니다**.
  각 단계에 기도 이름·짧은 안내·공식 출처 링크를 보여 줍니다.
- 사용 허가를 받으면 `src/lib/i18n/rosary.ko.ts` 의 각 `text: null` 에 정식 문구를 넣기만 하면 화면에 표시됩니다.
- 신비 제목은 「가톨릭 기도서」 표기를 따랐으며 **배포 전 최신 기도서와 다시 대조**가 필요합니다.
- 3D 모델·텍스처·효과음은 코드로 직접 만들었고, 배경 성가 5곡(Ave Maria, Salve Regina, 팔레스트리나 Agnus Dei·Sicut lilium, 알레그리 Miserere — 퍼블릭 도메인·CC BY·CC BY-SA 녹음)을 이어서 반복 재생하며 출처를 함께 표시합니다 → [CREDITS.md](CREDITS.md)

## 6. 문서

- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) — 개발용 Supabase 설정, 보안 설정
- [docs/FREE_PLAN_NOTES.md](docs/FREE_PLAN_NOTES.md) — 무료 플랜 한도와 메시지 사용량 계산
- [docs/TEST_RESULTS.md](docs/TEST_RESULTS.md) — 테스트 결과(실행한 것 / 못 한 것), 수동 테스트 절차
- [docs/FPS_MULTIPLAYER_GUIDE.md](docs/FPS_MULTIPLAYER_GUIDE.md) — 초보자를 위한 FPS 멀티플레이 학습 정리
- [docs/NOT_IMPLEMENTED.md](docs/NOT_IMPLEMENTED.md) — 미구현 기능과 알려진 한계

## 7. 배포 (Vercel)

Vercel에 그대로 배포할 수 있는 구조입니다. 다만 **외부 배포, GitHub Push, 유료 플랜 전환은 프로젝트 소유자가 직접 결정**해야 하며
이 저장소 작업 과정에서는 실행하지 않았습니다. 배포 시 Vercel 환경 변수에 `.env.example` 의 `NEXT_PUBLIC_*` 값을 넣으세요.
