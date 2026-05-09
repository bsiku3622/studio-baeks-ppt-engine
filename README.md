# Studio Baeks PPT Engine

Markdown으로 작성하는 1920×1080 HTML 슬라이드 데크 빌더.

8가지 directive로 구조화된 MD를 작성하면, bun + remark/unified 기반 엔진이 deck-stage 호환 HTML로 변환한다. PDF 출력, 키보드 네비게이션, 자동 스케일링이 빌트인.

**라이브 사이트:** [studio-baeks-ppt-engine.vercel.app](https://studio-baeks-ppt-engine.vercel.app)

---

## 빠른 시작

### 사이트 사용 (일반 사용자)

1. [라이브 사이트](https://studio-baeks-ppt-engine.vercel.app) 접속
2. 텍스트 영역에 MD 붙여넣기 (또는 `Sample` 버튼) → 우측에 미리보기 자동 생성
3. 이미지가 있으면 드래그앤드롭으로 업로드
4. `[HTML ↓]` 다운로드 → 받은 HTML 옆에 `assets/` 폴더 두면 끝

### 로컬 CLI (개발자)

```sh
git clone https://github.com/<owner>/studio-baeks-ppt-engine
cd studio-baeks-ppt-engine/engine
bun install
bun run build              # example/발표.md → example/발표.built.html
bun run build:templates    # docs/templates.md → docs/templates.built.html
```

### 사이트 로컬 실행

```sh
cd studio-baeks-ppt-engine
npm install
npx vercel dev   # http://localhost:3000
```

---

## 8 directive

| Directive | 용도 |
|---|---|
| `:::cover` | 표지 (다크) |
| `:::divider{n=N [primary]}` | 장 구분 (검정 또는 primary 색상) |
| `:::split` | 제목 + 불릿 + 우측 이미지. 데크의 70% 이상 |
| `:::bullets` | 풀폭 텍스트 슬라이드 |
| `:::stats` | 좌측 불릿 + 우측 통계 사이드바 |
| `:::charts` | 좌측 불릿 + 우측 2-col 차트 그리드 |
| `:::disclaimer` | 회색 불릿 + 하단 면책 |
| `:::thanks` | 마지막 인사 |

자세한 사용법은 [`docs/how-to-use.md`](./docs/how-to-use.md). 빌드된 카탈로그는 [`docs/templates.html`](./docs/templates.html) (테마 피커 포함) 또는 [`docs/templates.md`](./docs/templates.md)를 빌드한 결과 참고.

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

## AI로 슬라이드 생성

[`docs/Skills.md`](./docs/Skills.md)는 두 가지 방법으로 사용 가능:

- **Claude Code Skill**: `~/.claude/skills/studio-baeks-deck/SKILL.md`에 떨어뜨려 `/studio-baeks-deck` 호출
- **일반 시스템 프롬프트**: ChatGPT/Cursor/Claude.ai 등에 본문 통째로 붙여넣기

그 후 "○○ 주제로 ○슬라이드짜리 발표 만들어줘" 같이 요청하면 MD를 뽑아준다. 사이트에 붙여 넣어 바로 빌드.

## Preamble (LaTeX-style)

```yaml
---
title:    세계 대공황
subtitle: 자본주의를 뒤흔든 가장 큰 비상사태
author:   백재원
id:       25-059
date:     2026-05-10
venue:    KSA 정경 발표
primary:  terracotta
---
```

LaTeX의 `\title{} \author{} \date{}`에 대응. 모든 필드는 선택.

## 작성 예시

```md
:::cover{label="01 표지"}
# 세계 대공황
:::

:::split{label="02 대공황이란?"}
# 대공황이란?

- :primary[1929년 미국]에서 시작된 경제 위기
- 약 :primary[10년간 지속]된 장기 불황
- :key 현대 경제학의 패러다임을 바꾼 사건

![](./assets/stock-crash.png)
:::

:::thanks
:::
```

## 디렉터리 구조

```
studio-baeks-ppt-engine/
├── index.html / editor.js / style.css   웹 편집기 프론트엔드
├── deck-stage.js / image-slot.js        슬라이드 플레이어
├── api/convert.ts                       POST /api/convert (Vercel)
├── engine/                              변환 라이브러리
├── docs/                                작성 가이드 + AI Skill + 템플릿 카탈로그
└── example/                             실제 발표 예시 (대공황) + assets
```

## Stack

- [bun](https://bun.sh) (로컬 CLI) / Node 20+ (Vercel)
- [unified](https://unifiedjs.com) / remark / rehype — MD AST 파이프라인
- [remark-directive](https://github.com/remarkjs/remark-directive) — `:::name{}` 문법
- [KaTeX](https://katex.org) — `$...$` 수식
- 디자인 시스템: Studio Baeks 8색 OKLCH 팔레트

## License

MIT
