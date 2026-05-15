# Studio Baeks PPT Engine

Markdown으로 작성하는 1920×1080 HTML 슬라이드 데크 빌더.

Layout 5종 + Element 6종으로 구조화된 MD를 작성하면, bun + remark/unified 기반 엔진이 deck-stage 호환 HTML로 변환한다. PDF 출력, 키보드 네비게이션, 자동 스케일링, 발표자 뷰 빌트인.

**라이브 사이트:** [studio-baeks-ppt-engine.vercel.app](https://studio-baeks-ppt-engine.vercel.app)

---

## 빠른 시작

### 사이트 사용 (일반 사용자)

1. [라이브 사이트](https://studio-baeks-ppt-engine.vercel.app) 접속
2. 텍스트 영역에 MD 붙여넣기 (또는 `Sample` 버튼) → 우측에 미리보기 자동 생성
3. 이미지가 있으면 드래그앤드롭으로 업로드
4. `[HTML ↓]` 다운로드 → 업로드한 이미지는 base64로 자동 임베드되어 **HTML 한 파일만 들고다니면 끝**

### 로컬 CLI (개발자)

```sh
git clone https://github.com/bsiku3622/studio-baeks-ppt-engine
cd studio-baeks-ppt-engine/engine
bun install
bun run build              # example/sample.md → example/sample.built.html
bun run build:templates    # docs/templates.md → docs/templates.built.html
```

### 사이트 로컬 실행

```sh
cd studio-baeks-ppt-engine
npm install
npx vercel dev   # http://localhost:3000
```

---

## 카탈로그 v2

### Layout 5종 — 슬라이드 레이아웃

| Layout | 용도 |
|---|---|
| `:::cover` | 표지 (`variant=close`로 닫는 표지) |
| `:::divider{n=N [primary]}` | 장 구분 (검정 또는 primary 색상) |
| `:::index` | 목차 (자동 번호 매김) |
| `:::single` | 1-col 자유 배치 — **본문 대부분** |
| `:::split` | 2-col, `---`로 좌·우 슬롯 구분 |

### Element 6종 — 콘텐츠 블록 (layout 안에 자유 배치)

| Element | 용도 |
|---|---|
| `:::chart{type=bar\|line\|pie}` | 표 → SVG 데이터 차트 |
| `:::plot{x=...}` | 카르테시안 그래프 (함수·산점도) |
| `::video{src=...}` | mp4 또는 YouTube 임베드 |
| `::callout[메시지]{detail=...}` | 큰 단일 메시지 강조 |
| `::stat[값]{label=...}` + `:::stats` | 통계 (가로 row 기본, `column` opt) |
| `::note[...]` | 회색 면책·부연 |

### md 표준 그대로

`# heading`, `- list`, `![]()`, `> quote`, ` ```lang `(highlight.js), `\| ... \|`, `$inline$`/`$$block$$`(KaTeX), `**bold**` 등 — md 표준이 표현 가능한 건 element로 만들지 않음.

### Inline directive

- `:primary[강조]` — primary 색상
- `:muted` / `:key` — 불릿 시작 마커

### Chrome — 4코너 메타데이터

frontmatter `chrome:` 키로 슬라이드 4모서리에 자동 메타 표시. `{n}` `{total}` `{section}` `{title}` 같은 토큰 지원.

### 발표자 노트

슬라이드 안에 `:::speaker-note ... :::`를 넣으면 됨 — 화면엔 안 보이고 전체화면 발표 시 별도 윈도우에 표시 (KeyNote 스타일: 현재/다음 슬라이드 프리뷰 + 노트 + 타이머).

자세한 명세는 [`docs/catalog-v2.md`](./docs/catalog-v2.md), 사용 가이드는 [`docs/how-to-use.md`](./docs/how-to-use.md), AI Skill은 [`docs/Skills.md`](./docs/Skills.md).

---

## 8색 팔레트

OKLCH 기반. frontmatter `primary: terracotta` 식으로 지정.

| name | 정체성 |
|---|---|
| `terracotta` | 토기 — **default primary** |
| `rust` | 녹슨 적 — error |
| `mustard` | 황토 — warning |
| `sage` | 세이지 — success |
| `mauve` | 빛바랜 장미 |
| `teal` | 청동 |
| `sky` | 슬레이트 — info |
| `stone` | 종이 그림자 — neutral |

---

## AI로 슬라이드 생성

[`docs/Skills.md`](./docs/Skills.md)는 두 가지 방법으로 사용 가능:

- **Claude Code Skill**: `~/.claude/skills/studio-baeks-deck/SKILL.md`에 떨어뜨려 `/studio-baeks-deck` 호출
- **일반 시스템 프롬프트**: ChatGPT/Cursor/Claude.ai 등에 본문 통째로 붙여넣기

그 후 "○○ 주제로 ○슬라이드짜리 발표 만들어줘" 같이 요청하면 MD를 뽑아준다. 사이트에 붙여 넣어 바로 빌드.

---

## Preamble (Frontmatter)

```yaml
---
title:    세계 대공황
subtitle: 자본주의를 뒤흔든 가장 큰 비상사태
author:   백재원
id:       25-059
date:     2026-05-10
venue:    KSA 정경 발표
primary:  terracotta
chrome:
  topLeft:    "{title}"
  topRight:   "{section}"
  bottomLeft: "{author} · {date}"
  bottomRight: "{n} / {total}"
---
```

모든 필드는 선택. `chrome`은 4코너 메타데이터.

---

## 작성 예시

```md
:::cover{label="01 표지"}
# 세계 대공황

자본주의를 뒤흔든 가장 큰 비상사태
:::

:::index{label="02 목차"}
# 오늘의 발표

- 1929 — 검은 화요일
- 1933 — 뉴딜
- 2008 — 금융위기 재림
:::

:::divider{n=1 label="03 섹션 1"}
# 1929, 무너진 세계
:::

:::split{label="04 대공황이란?"}
# 대공황이란?

- :primary[1929년 미국]에서 시작된 경제 위기
- 약 :primary[10년간 지속]된 장기 불황
- :key 현대 경제학의 패러다임을 바꾼 사건

---

![](./assets/stock-crash.png)
:::

:::single{align=center label="05 핵심"}
# 단 하나의 숫자

::callout[다우지수 −88.88%]{detail="1929 9월 → 1932 7월"}
:::

:::cover{variant=close}
# 감사합니다
:::
```

---

## 디렉터리 구조

```
studio-baeks-ppt-engine/
├── index.html / editor.js / style.css   웹 편집기 프론트엔드
├── deck-stage.js / image-slot.js        슬라이드 플레이어
├── api/convert.ts                       POST /api/convert (Vercel)
├── engine/                              변환 라이브러리
├── docs/                                catalog-v2 / how-to-use / Skills / templates
└── example/                             실제 발표 예시 + assets
```

## Stack

- [bun](https://bun.sh) (로컬 CLI) / Node 20+ (Vercel)
- [unified](https://unifiedjs.com) / remark — MD AST 파이프라인
- [remark-directive](https://github.com/remarkjs/remark-directive) — `:::name{}` 문법
- [KaTeX](https://katex.org) — `$...$` 수식
- [highlight.js](https://highlightjs.org) — 코드 펜스 문법 하이라이트
- 디자인 시스템: Studio Baeks 8색 OKLCH 팔레트

## License

MIT
