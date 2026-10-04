# knock DB 구축 가이드

Supabase(Postgres) 기준. 같이 있는 `schema.sql`을 Supabase SQL Editor에 붙여넣고 실행하면 테이블, 보안 규칙, 함수가 한 번에 만들어진다.
로컬 Postgres 16에서 실행과 기본 동작을 테스트했다 (활성화 전 → 페이지, 암호 잠금, 분실 모드, 남의 데이터 차단, 권한 상승 차단).

---

## 1. 큰 그림

```
auth.users (Supabase 로그인)
   └ profiles  ← 가입하면 자동 생성. role = user / admin
        ├ pages ── blocks (프로필, 링크, 사진, 기분 …)
        │     ├ decor_items (스티커·가구 위치)
        │     ├ guestbook_entries (방명록)
        │     ├ knocks (노크)
        │     └ received_cards (knock. 받은 명함)
        └ qr_codes ── scan_logs (스캔 기록)
              └ lost_messages (분실 메시지)

orders     (베타 신청 / 사전예약 / 주문)
inquiries  (문의, 코드 재발급, 신고)
admin_logs (관리자가 한 일)
```

**핵심 원칙 세 가지**
1. **QR과 페이지는 분리.** QR은 "입구", 페이지는 "방". 케이스를 새로 사면 QR만 추가해서 같은 방에 연결할 수 있다 (소지품 태그 확장 대비).
2. **내용과 디자인은 분리.** 내용은 `blocks`, 디자인은 `pages.template` + `pages.theme` + `decor_items`. 템플릿을 바꿔도 내용은 그대로 남는다.
3. **방문자는 테이블에 직접 접근하지 않는다.** QR을 찍은 사람은 `get_public_page()` 함수 하나로만 페이지를 본다. 공개범위, 암호, 분실 모드 판단은 전부 DB 안에서 한다.

---

## 2. 테이블 설명

| 테이블 | 하는 일 | 꼭 알아둘 칸 |
|---|---|---|
| profiles | 회원 | `role` (admin이면 관리자), `is_over_14` |
| pages | 개인 페이지 | `line` (bang/dot), `template`, `theme`(색·폰트 JSON), `visibility`, `lock_pin_hash` |
| blocks | 페이지 안의 블록 | `type`, `position`(순서), `is_visible`, `data`(JSON: 링크 주소, 문구 등) |
| decor_items | 데코 아이템 배치 | `item_key`, `x`, `y`, `rotation`, `scale`, `z` |
| qr_codes | QR 발급 장부 | `id`(케이스에 인쇄되는 ID), `status`, `lost_mode`, `code_hmac`, `owner_id`, `page_id` |
| scan_logs | 스캔 기록 | `is_owner`, `result` (activate / page / locked / private / lost) |
| guestbook_entries | 방명록 | `status` (visible / pending / hidden) |
| knocks | 노크 버튼 기록 | 개수 = 노크 수 |
| received_cards | knock. 명함 교환 | 이름, 소속, 연락처, 만난 곳 |
| lost_messages | 분실 모드에서 습득자가 남긴 메시지 | 위치 메모, 습득자 연락처(선택) |
| orders | 신청·주문 | `kind` (beta / preorder / order), `status` |
| inquiries | 문의 | `type`, `status`, `reply` |
| admin_logs | 관리자 작업 기록 | 누가, 무엇을 |

**QR 상태 흐름**
`issued`(발급) → `printed`(인쇄 넘김) → `active`(주인 등록) → `retired`(폐기)
분실 모드는 상태가 아니라 `lost_mode` 켜기/끄기로 따로 둔다.

**주문 상태 흐름**
`received`(접수) → `requested`(제작 요청) → `producing`(제작 중) → `shipped`(발송) → `activated`(활성화 완료) / `canceled`

---

## 3. 누가 무엇을 할 수 있나 (RLS)

| | 방문자 (로그인 X) | 회원 | 관리자 |
|---|---|---|---|
| 남의 페이지 보기 | `get_public_page()`로만 | 같음 | 전체 |
| 내 페이지·블록·데코 | - | 읽기/쓰기 | 전체 |
| 방명록 | 쓰기는 서버 경유 | 내 페이지 것 보기·숨기기·삭제 | 전체 |
| 내 QR | - | 보기, 분실 모드 켜고 끄기만 | 전체 |
| QR 코드 해시 | - | **못 읽음** (컬럼 권한으로 차단) | 서버에서만 |
| 스캔 기록·분실 메시지 | - | 내 QR 것만 보기 | 전체 |
| 주문·문의 | 쓰기는 서버 경유 | 내가 낸 것만 보기 | 전체 |
| role 바꾸기 | - | **못 바꿈** (컬럼 권한으로 차단) | SQL Editor에서 직접 |

관리자 지정: Supabase SQL Editor에서
```sql
update public.profiles set role = 'admin' where id = '내 계정 uuid';
```

---

## 4. 서버 라우트에서 할 일 (Next.js, service_role 키 사용)

아래는 브라우저에서 바로 DB에 쓰지 않고, **Next.js 서버(Route Handler / Server Action)** 에서 `service_role` 키로 처리한다. 스팸, 무차별 대입, 위조를 막기 위해서다.

**① QR 진입 `/c/[id]`**
1. `get_public_page(id, pin)` 호출해서 `state`에 따라 화면 분기
   - `activate` → 코드 입력 화면
   - `page` → 템플릿으로 렌더링
   - `locked` → 암호 입력
   - `private` → "비공개 페이지예요"
   - `lost` → 분실 화면
   - `not_found` → 없는 QR
2. `scan_logs`에 한 줄 기록 (방문자 해시 = IP+UA를 해시한 값. 원본 IP는 저장 안 함)
3. 암호 입력은 QR별로 5회 틀리면 잠시 막기

**② 활성화 `/c/[id]/activate`**
1. 로그인 확인 (안 되어 있으면 카카오·이메일 로그인 먼저)
2. `locked_until`이 지금보다 뒤면 거절
3. `HMAC_SHA256(KNOCK_CODE_SECRET, 입력한 6자리)` 를 `code_hmac`과 비교
4. 틀리면 `failed_attempts + 1`, 5회째면 `locked_until = now + 15분`, 하루 20회 넘으면 다음 날까지
5. 맞으면 한 번에 처리
   - 내 페이지가 없으면 `pages` 생성 (+ 기본 블록 몇 개)
   - `qr_codes`: `status='active'`, `owner_id`, `page_id`, `code_used_at=now()`, `failed_attempts=0`
6. 이미 `code_used_at`이 있으면 "이미 등록된 케이스예요"

**③ 방명록·노크·명함 교환·분실 메시지 쓰기**
- 길이 검사, 같은 방문자 해시로 1분에 N회 제한
- 방명록 승인제를 켠 페이지면 `status='pending'`으로 저장

**④ 베타 신청·문의 폼** → `orders`, `inquiries`에 저장

**⑤ 관리자 "제작 요청"**
1. 주문마다 QR ID 생성 (중복 검사, 헷갈리는 글자 0 O 1 I L 제외)
2. 6자리 코드 생성 (000000, 123456 같은 쉬운 번호 제외) → HMAC으로 저장. **원문 코드는 저장하지 않고**, 인쇄용 목록에만 한 번 내보낸다.
3. QR 이미지 생성 (qr-code-styling, 오류 복원 H) + 인쇄용 파일·주문 목록 내보내기
4. `status='printed'`, `orders.status='requested'`, `admin_logs` 기록

---

## 5. 환경 변수

| 이름 | 어디서 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 브라우저 + 서버 | 공개돼도 됨 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저 + 서버 | 공개돼도 됨 (RLS가 지켜줌) |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버만** | 절대 `NEXT_PUBLIC_` 붙이지 말 것 |
| `KNOCK_CODE_SECRET` | **서버만** | 활성화 코드 HMAC 키. 바꾸면 기존 코드 전부 무효 |
| `VISITOR_HASH_SALT` | 서버만 | 방문자 해시용 |

---

## 6. 사진 저장소

- 버킷 `page-media`: jpg/png/webp, 5MB 제한
- 경로 규칙: `{내 user id}/파일명` → 남의 폴더에는 못 올림
- 지금은 공개 버킷이라 주소를 알면 누구나 볼 수 있다. 암호 잠금·비공개 페이지의 사진까지 막아야 할 때가 오면 비공개 버킷 + 서명된 URL로 바꾼다.

---

## 7. 탈퇴·삭제

- 회원 탈퇴 → `auth.users` 삭제 → `profiles`, `pages`, `blocks`, 방명록 등이 연쇄 삭제
- QR은 `owner_id`가 비워진다. 관리자가 `retired` 처리하거나 재발급
- 사진 파일은 탈퇴 처리 서버 코드에서 `page-media/{user id}/` 폴더를 같이 지울 것

---

## 8. 백업·운영

- 도메인 자동 갱신, Supabase 정기 백업은 필수. 무료 플랜은 백업 기능이 제한적이니 베타 전에 플랜별 백업 범위를 확인하고, 필요하면 `pg_dump`로 주기적으로 직접 백업
- Supabase 대시보드의 Security Advisor로 RLS 빠진 테이블이 없는지 확인
- 베타 기간에는 Supabase 표 편집 화면을 관리자 페이지 대신 써도 충분

---

## 9. 출시 전 체크

- [ ] 모든 테이블 RLS 켜짐
- [ ] 다른 계정으로 남의 페이지·QR·방명록 수정 시도 → 막힘
- [ ] 브라우저 코드에 service_role 키 없음
- [ ] 활성화 코드 5회 오답 → 잠김
- [ ] 이미 등록된 QR에 다른 사람이 코드 입력 → 거절
- [ ] 분실 모드 켜면 공개범위와 상관없이 분실 화면
- [ ] 탈퇴하면 데이터·사진 실제 삭제
- [ ] 외부 개발자 보안 리뷰 1회

---

## 10. Claude Code에 줄 때

> 이 프로젝트는 Next.js(App Router) + Supabase야. `schema.sql`을 이미 Supabase에 적용했어. `knock-DB-가이드.md`의 4번 "서버 라우트에서 할 일" 순서대로 만들어줘. 먼저 ① `/c/[id]` 진입 분기와 스캔 기록, ② 활성화부터. service_role 키는 서버 코드에서만 쓰고, 활성화 코드는 `KNOCK_CODE_SECRET`으로 HMAC 비교해줘.
