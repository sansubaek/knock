// 베타: 테마 투표. 끝나면 VOTE_OPEN을 false로 바꾸고, public/home.html의 노란 띠(id=voteBar)와 메뉴(.nav-vote)를 지우면 된다.
// 관리자 통계(/admin/votes)는 표가 남아 있는 동안 계속 보인다. 나중에 '이달의 테마'로 쓸 수도 있게 테마 목록은 여기 한 곳에만 둔다.

export const VOTE_OPEN = true
export const MAX_PICKS = 5

export type Line = 'bang' | 'dot'
export type Theme = { no: number; name: string; desc: string; h: number }

export const THEMES: Record<Line, Theme[]> = {
  bang: [
  { no: 1, name: "클린 타일", desc: "칸을 골라 쌓는 기본형, 기분이 맨 위", h: 1339 },
  { no: 2, name: "미니룸", desc: "작은 방 그림 속에 내 소식", h: 1086 },
  { no: 3, name: "포스트잇 보드", desc: "코르크 판에 붙인 메모들", h: 1606 },
  { no: 4, name: "위젯 홈", desc: "폰 홈 화면 위젯처럼", h: 1375 },
  { no: 5, name: "레트로 두 칸 방", desc: "왼쪽은 나, 오른쪽은 내 방. 그 시절 두 칸 화면", h: 1059 },
  { no: 6, name: "프로필 피드", desc: "사진 피드형 프로필", h: 1207 },
  { no: 7, name: "다꾸 다이어리", desc: "스티커·마스킹테이프 다이어리", h: 1428 },
  { no: 8, name: "채팅방", desc: "말풍선으로 주고받는 소개", h: 1773 },
  { no: 9, name: "음악 플레이어", desc: "재생 화면처럼 꾸민 방", h: 1685 },
  { no: 10, name: "Y2K 밤하늘", desc: "별·반짝이 Y2K 밤 테마", h: 1586 },
  { no: 11, name: "감열지 영수증", desc: "영수증처럼 뽑힌 소개", h: 1810 },
  { no: 12, name: "RPG 상태창", desc: "게임 캐릭터 스탯 화면", h: 1624 },
  { no: 13, name: "패션 잡지 커버", desc: "잡지 표지 같은 첫 화면", h: 1812 },
  { no: 14, name: "레트로 데스크톱", desc: "옛날 컴퓨터 창들", h: 1860 },
  { no: 15, name: "빈티지 엽서", desc: "엽서와 우표", h: 1686 },
  { no: 16, name: "오늘의 날씨", desc: "날씨 앱 형식", h: 2216 },
  { no: 17, name: "컷아웃 진", desc: "오려 붙인 진 콜라주", h: 1938 },
  { no: 18, name: "포켓 게임기", desc: "휴대용 게임기 화면", h: 1829 },
  { no: 19, name: "지우 일보", desc: "신문 1면처럼", h: 1796 },
  { no: 20, name: "냉장고 문", desc: "자석·메모 붙은 냉장고", h: 1521 },
  { no: 21, name: "아이소 미니룸", desc: "입체 방 안에 내 캐릭터", h: 1838 },
  { no: 22, name: "아바타 프로필", desc: "캐릭터가 주인공인 프로필", h: 1895 },
  { no: 23, name: "TMI 자기소개", desc: "나에 대한 문답 템플릿", h: 2006 },
  { no: 24, name: "네컷 포토부스", desc: "네 컷 사진 띠 형식", h: 1521 },
  { no: 25, name: "포카 바인더", desc: "포토카드 바인더 넘기기", h: 1746 },
  { no: 26, name: "백꾸 키링", desc: "가방에 단 키링들", h: 1340 },
  { no: 27, name: "취향 무드보드", desc: "좋아하는 것 모음 보드", h: 1703 },
  { no: 28, name: "비밀 일기장", desc: "자물쇠 달린 일기장", h: 1702 },
  { no: 29, name: "말랑 젤리", desc: "말랑한 젤리 버튼과 카드", h: 1584 },
  { no: 30, name: "그 방 2.0", desc: "그때 그 방을 요즘 감성으로 다시", h: 1515 },
  { no: 31, name: "최애존", desc: "내 방 덕질 코너, 탑로더와 응원 배너", h: 1801 },
  { no: 32, name: "앨범 선반", desc: "CD 선반, 취향이 앨범 등에 적힘", h: 2463 },
  { no: 33, name: "데스크테리어", desc: "위에서 본 꾸민 책상, 노크는 탁상 벨", h: 1304 },
  { no: 34, name: "아바타 옷장", desc: "옷장 앞 내 캐릭터와 오늘의 코디", h: 2412 },
  { no: 35, name: "필름 롤 갤러리", desc: "필름 띠와 현상소 봉투", h: 1958 },
  { no: 36, name: "일촌 파도타기", desc: "나를 둘러싼 친구들과 친구평", h: 2185 },
  { no: 37, name: "로파이 창가방", desc: "비 오는 창가에서 커피 마시는 내 방", h: 1689 },
  { no: 38, name: "크롬 Y2K", desc: "크롬 글씨와 홀로그램 스티커", h: 1784 },
  { no: 39, name: "오라 그라데이션", desc: "버터 옐로 오라와 유리 카드", h: 2099 },
  { no: 40, name: "미니미 펫 방", desc: "내 방에 사는 펫 보리, 노크는 쓰다듬기", h: 1963 },
  ],
  dot: [
  { no: 1, name: "명함 카드", desc: "실물 명함 같은 카드가 맨 위, 바로 아래 저장 버튼", h: 1178 },
  { no: 2, name: "모노 미니멀", desc: "아주 큰 이름과 가는 선, 흑백 타이포", h: 1304 },
  { no: 3, name: "아이보리 클래식", desc: "종이 질감, 명조체, 금색 테두리", h: 1350 },
  { no: 4, name: "블랙 프리미엄", desc: "메탈 카드와 샴페인 골드", h: 1296 },
  { no: 5, name: "커리어 프로필", desc: "커버 배너와 경력 타임라인", h: 1547 },
  { no: 6, name: "이력서 한 장", desc: "PDF 문서처럼 보이는 한 장짜리 이력서", h: 948 },
  { no: 7, name: "포트폴리오 갤러리", desc: "작업물 칸을 크게, 잡지 느낌", h: 2091 },
  { no: 8, name: "링크 모음", desc: "큰 버튼을 세로로 쌓은 파스텔 화면", h: 1200 },
  { no: 9, name: "월렛 패스", desc: "디지털 지갑에 넣는 카드처럼", h: 1310 },
  { no: 10, name: "개발자 터미널", desc: "코드 편집기 속 const 주건우", h: 1265 },
  { no: 11, name: "스위스 포스터", desc: "주홍 색면에 세로로 잘린 이름", h: 1516 },
  { no: 12, name: "명함첩", desc: "앞뒷면 명함과 비닐 포켓 속 소개·경력", h: 1401 },
  { no: 13, name: "사원증", desc: "목걸이 끈에 걸린 사원증, 뒷면에 연락처", h: 1653 },
  { no: 14, name: "편지지 레터헤드", desc: "“안녕하세요, 주건우입니다”로 시작하는 편지", h: 1455 },
  { no: 15, name: "문서 위키형", desc: "속성 표와 접히는 목록이 있는 문서 페이지", h: 1525 },
  { no: 16, name: "슬라이드 덱", desc: "표지부터 연락처까지 발표 자료처럼", h: 1474 },
  { no: 17, name: "한지와 낙관", desc: "한지 위 세로쓰기 이름과 붉은 도장", h: 1473 },
  { no: 18, name: "브루탈리즘", desc: "굵은 테두리와 형광 라임 블록", h: 1498 },
  { no: 19, name: "지하철 노선도", desc: "경력이 역, 다음 역은 “당신과의 미팅”", h: 1498 },
  { no: 20, name: "크래프트 스탬프", desc: "크래프트지 꼬리표와 고무도장 이름", h: 1480 },
  ],
}

export const AGE_BANDS = [
  { key: '10s', label: '10대' },
  { key: '20a', label: '20대 초반' },
  { key: '20b', label: '20대 후반' },
  { key: '30p', label: '30대 이상' },
] as const
export type AgeBand = (typeof AGE_BANDS)[number]['key']

export const pad2 = (n: number) => String(n).padStart(2, '0')
export const themeSrc = (line: Line, no: number) => `/themes/${line}/${pad2(no)}.html`
export const themeThumb = (line: Line, no: number) => `/themes/thumb/${line}-${pad2(no)}.webp`
