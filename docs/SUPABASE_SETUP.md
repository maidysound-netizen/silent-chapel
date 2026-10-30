# Supabase 설정 가이드 (개발용)

> ⚠ **운영 중인 Supabase 프로젝트(예: takakoworld-web이 쓰는 DB)를 사용하지 마세요.**
> 이 프로젝트 전용 **새 개발 프로젝트**를 만듭니다. 무료 플랜은 활성 프로젝트 2개까지 가능합니다.

## 1. 프로젝트 만들기

1. https://supabase.com/dashboard → **New project**
2. 이름 예: `silent-chapel-dev`, 지역은 사용자와 가까운 곳(예: Northeast Asia (Seoul))
3. 데이터베이스 비밀번호는 비밀번호 관리자에 보관 (코드나 Git에 넣지 않음)

## 2. 익명 로그인 켜기

방문자는 계정 없이 들어오지만, 서버가 발급한 **고유 user id**로 구별해야 사칭을 막을 수 있습니다.

1. **Authentication → Sign In / Providers** (또는 Settings)에서 **Allow anonymous sign-ins** 를 켭니다.
2. 권장: **Attack Protection → CAPTCHA**(Cloudflare Turnstile 또는 hCaptcha) 활성화.
   익명 로그인은 봇이 대량으로 계정을 만들 수 있어 공식 문서도 CAPTCHA를 권장합니다.
   (현재 MVP 코드는 CAPTCHA 토큰 전달을 구현하지 않았습니다 → [NOT_IMPLEMENTED.md](NOT_IMPLEMENTED.md))
3. 익명 사용자는 DB에서 `authenticated` 역할을 가지며 JWT에 `is_anonymous: true` 가 들어 있습니다.
   익명 사용자도 월간 활성 사용자(MAU)에 포함됩니다.

## 3. SQL 마이그레이션 실행

**SQL Editor** 에서 [`supabase/migrations/20261029000000_silent_chapel_init.sql`](../supabase/migrations/20261029000000_silent_chapel_init.sql) 내용을 붙여 넣고 실행합니다.
(Supabase CLI를 쓰는 경우 `supabase link` 후 `supabase db push` — 반드시 개발 프로젝트에 link 되었는지 확인)

만들어지는 것:

| 이름 | 종류 | 용도 |
| --- | --- | --- |
| `public.rooms` | 테이블 | 방 목록 (기본 `main-chapel` 1개) |
| `public.visitor_sessions` | 테이블 | 방에 들어온 익명 방문자 (rooms 1:N) |
| `public.join_room(room, nickname)` | 함수(트랜잭션) | 방 존재·정원 확인 후 세션 기록 |
| `realtime.messages` 정책 2개 | RLS | `room:<id>` 채널은 그 방에 입장한 사람만 송수신 |

### 3-1. 방 나누기 (100명) — 두 번째 마이그레이션

이어서 [`supabase/migrations/20261030000000_overflow_rooms.sql`](../supabase/migrations/20261030000000_overflow_rooms.sql) 도 같은 방법으로 실행합니다.
여러 번 실행해도 안전합니다.

| 이름 | 종류 | 용도 |
| --- | --- | --- |
| `chapel-2` … `chapel-10` | `rooms` 행 | 방 9개 추가 → 10명 × 10개 = 100명 |
| `public.join_room` (교체) | 함수 | 최근 90초 안에 신호가 있는 사람만 정원으로 셈 |
| `public.touch_session()` | 함수 | 앱이 30초마다 "아직 있음"을 알림 |
| `public.leave_room()` | 함수 | 나갈 때 자리를 바로 비움 |

앱은 `main-chapel` 이 가득 차면 `chapel-2`, `chapel-3` … 순서로 자동 입장하고, 화면 위 표시에 "제2경당"처럼 방 번호를 보여 줍니다.
이 마이그레이션을 실행하기 전에도 앱은 그대로 동작합니다(추가 방이 없으면 건너뜀). 다만 그때는 정원 계산이 예전 방식이라 사실상 한 방에 모두 들어갑니다.

## 4. Realtime 설정

1. **Realtime → Settings** 에서 **Allow public access** 를 **끕니다** (Private 채널만 허용).
   이렇게 해야 위 RLS 정책이 적용됩니다.
2. 빠르게 테스트만 하고 싶다면 `.env.local` 에 `NEXT_PUBLIC_REALTIME_PRIVATE=false` 를 넣고 public access를 켜 둔 상태로
   공개 채널을 쓸 수 있습니다. 이 경우 **누구나 채널에 들어올 수 있으므로 개발 중에만** 사용하세요.

## 5. 환경 변수

**Project Settings → API Keys** (또는 상단 **Connect**)에서 값을 복사합니다.

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_REALTIME_PRIVATE=true
NEXT_PUBLIC_REALTIME_MSG_BUDGET=80
```

- publishable/anon 키는 브라우저에 노출되어도 되는 키입니다. 데이터 보호는 **RLS**가 담당합니다.
- `service_role` / `sb_secret_...` 키는 **절대** 프런트엔드 코드나 `.env.local` 의 `NEXT_PUBLIC_*` 에 넣지 마세요.
- `.env.local` 은 `.gitignore` 에 포함되어 Git에 올라가지 않습니다.

## 6. 동작 확인

1. `npm run dev` 재시작 → 입장 화면 아래에 **● 함께 머무는 방** 이 보이면 환경 변수 인식 성공
2. 입장 후 왼쪽 위 칩이 `연결 중…` → `함께 머무는 사람 1명` 으로 바뀌면 연결 성공
3. 실패 시 칩에 마우스를 올리면 오류 메시지가 보입니다. 자주 나오는 원인:

| 오류 | 원인 |
| --- | --- |
| `익명 로그인 실패: Anonymous sign-ins are disabled` | 2단계 미설정 |
| `방 입장 실패(join_room): Could not find the function` | 3단계 SQL 미실행 |
| 채널 `CHANNEL_ERROR` / unauthorized | 4단계 정책 누락 또는 `join_room` 실패 |
| `room is full` | 최근 2분 안에 활동한 방문자가 `max_players` 이상 |

### 같은 컴퓨터에서 2명 테스트하기
같은 브라우저의 탭들은 로그인 정보를 공유해 한 사람으로 취급됩니다. 주소 뒤에 `?profile=a`, `?profile=b` 를 붙이면
탭마다 다른 익명 방문자가 됩니다. (예: `http://localhost:3100/?profile=a`)

## 7. 보안 설계 요약

| 위협 | 대응 |
| --- | --- |
| 닉네임으로 다른 사람 사칭 | 이름 옆에 서버 발급 user id 기반 태그(`#1B4E`) 표시. 같은 닉네임이라도 태그가 다름 |
| 아무나 채널 접속 | Private 채널 + `realtime.messages` RLS (입장한 방의 topic만 허용) |
| 다른 방문자 세션 조회 | `visitor_sessions` RLS: 자기 행만 조회 가능 |
| 이상한 메시지 주입 | `protocol.ts` 에서 버전·형식·범위·좌석 id·크기·시간·순번 검증 후 사용 |
| XSS (닉네임) | 클라이언트 정리 + DB CHECK 제약 + React 자동 이스케이프 |
| 개인정보 노출 | 실명 입력 금지 안내, 기도 진행은 서버로 전송하지 않음(로컬 저장만) |

**알려진 한계:** Supabase Broadcast는 메시지마다 보낸 사람을 서버가 검증하지 않습니다(정책은 채널 입장 시 1회 검사).
악의적인 참가자가 다른 사람의 user id를 넣어 위치 메시지를 보낼 수 있습니다. 이 앱은 Presence 목록에 있는 id만 받아들이지만
완전히 막지는 못합니다. 경쟁 게임에서는 서버 권위형 구조가 필요한 이유입니다 → [FPS_MULTIPLAYER_GUIDE.md](FPS_MULTIPLAYER_GUIDE.md)
