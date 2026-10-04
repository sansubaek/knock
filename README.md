# knock 웹앱

케이스 QR → 개인 페이지(knock! / knock.), 로그인, 케이스 등록, 분실 모드, 관리자 페이지까지 들어 있는 Next.js + Supabase 코드입니다.

## 지금 상태 (2026-10-04)
- Supabase 프로젝트 `knock` (서울) 생성, `schema.sql`과 `002_보강.sql` 적용 완료. `003_save_page.sql`만 SQL Editor에서 직접 실행 필요
- Vercel 프로젝트 `knock` 배포: https://knock-sansubaek.vercel.app (GitHub main에 올리면 자동 배포되려면 Vercel GitHub 앱 설치 필요)
- 남은 설정: Vercel 환경변수 `SUPABASE_SERVICE_ROLE_KEY`, Supabase 로그인 주소·메일 템플릿 (아래 1-2, 1-3)

## 처음 한 번 하는 일 (순서대로)

### 1. Supabase
1. SQL Editor에서 `db/schema.sql` 실행 → 이어서 `db/002_보강.sql` 실행
2. Authentication → URL Configuration
   - Site URL: 실제 도메인 (예: `https://knock.im`)
   - Redirect URLs: `https://knock.im/auth/callback`, `http://localhost:3000/auth/callback`
3. Authentication → Email Templates → **Confirm signup**(처음 가입)과 **Magic Link**(재로그인) 두 템플릿 본문에 숫자 코드를 넣기
   ```html
   <h2>knock 로그인</h2>
   <p>아래 숫자를 입력하거나 버튼을 눌러주세요.</p>
   <p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   <p><a href="{{ .ConfirmationURL }}">로그인하기</a></p>
   ```
   (카톡·인스타 안에서 메일 링크를 열면 다른 브라우저가 떠서 로그인이 풀릴 수 있어요. 숫자 입력이 그 문제를 피합니다.)
4. **메일 발송 설정 (베타 전에 꼭)**: Supabase 기본 메일은 시간당 몇 통만 보내고, 팀원 주소에만 가는 제한이 있습니다. Authentication → SMTP Settings에 Resend 같은 메일 서비스를 연결하세요.
5. 내 계정을 관리자로: 사이트에서 한 번 로그인한 뒤 SQL Editor에서
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = '내 이메일');
   ```

### 2. Vercel
1. 이 폴더를 GitHub 저장소에 올리고 Vercel에서 Import
2. Settings → Environment Variables에 `.env.example`의 값 7개 입력
   - `SUPABASE_SERVICE_ROLE_KEY`, `KNOCK_CODE_SECRET`, `VISITOR_HASH_SALT`는 절대 공개하지 않기
   - `KNOCK_CODE_SECRET`은 한 번 정하면 바꾸지 않기 (바꾸면 인쇄된 카드 코드가 전부 무효)
3. `vercel.json`이 서버를 서울(icn1)에 두도록 설정되어 있습니다. Supabase 프로젝트도 서울(Northeast Asia, Seoul) 지역이면 빠릅니다.

### 3. 카카오 로그인 (나중에)
Supabase Authentication → Providers → Kakao 켜고 키 입력 → Vercel 환경변수 `NEXT_PUBLIC_KAKAO_LOGIN=on`

## 주소 구조
| 주소 | 하는 일 |
|---|---|
| `/` | 홈페이지 (`public/home.html`) |
| `/c/ID` | QR이 여는 곳: 등록 전이면 코드 입력, 등록 후면 페이지 / 잠금 / 비공개 / 분실 화면 |
| `/login`, `/onboarding` | 로그인, 첫 설정(닉네임·만 14세·약관) |
| `/my` | 내 페이지·케이스·분실 모드·문의 답변·탈퇴 |
| `/my/page/ID` | 꾸미기 (블록, 템플릿, 색, 스티커, 공개 범위, 방명록 관리, 받은 명함) |
| `/beta`, `/support` | 베타 신청, 문의·신고 |
| `/admin` | 관리자: 신청·주문, QR 발급(웰컴 카드 인쇄), 문의 답변, 회원 |
| `/terms`, `/privacy` | 약관, 개인정보처리방침 (`content/*.md`) |

## 새 템플릿·블록 추가
`lib/content.ts`의 `TEMPLATES`나 `BLOCK_DEFS`에 한 줄 추가하고 `app/globals.css`에 `.t-이름` 스타일을 넣으면 됩니다. DB는 바꿀 필요 없습니다.

## 로컬 실행
```
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```
