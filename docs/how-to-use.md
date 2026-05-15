# Studio Baeks PPT Engine — 사용 가이드 (v2)

Markdown으로 작성하는 1920×1080 HTML 슬라이드 데크 빌더. 정형화된 directive로 MD를 작성하면 엔진이 `deck-stage.js` 호환 HTML로 변환한다.

**두 가지 사용 방법:**
- **사이트** — [studio-baeks-ppt-engine.vercel.app](https://studio-baeks-ppt-engine.vercel.app) 에서 MD 붙여넣고 즉시 미리보기 → HTML 다운로드
- **로컬 CLI** — repo clone 후 `cd engine && bun run build`

---

## 0. 이게 뭔가

- **Source**: `*.md` (Markdown + directive)
- **Engine**: `engine/build.ts` (bun + remark/unified)
- **Output**: `*.built.html` (1920×1080 HTML 데크 — `deck-stage.js`로 재생)
- 슬라이드 1장 = MD 안의 컨테이너 directive 1개 (`:::cover`, `:::split`, …)

**카탈로그 v2**:
- **Layout 5종** — `cover` / `divider` / `index` / `single` / `split`
- **Element 6종** — `chart` / `plot` / `video` / `callout` / `stat` / `note`
- **md 표준 재사용** — 제목·불릿·문단·이미지·인용·코드·표·LaTeX·인라인 강조
- **Chrome** — 4코너 메타데이터 슬롯 (frontmatter 설정)

**Repo 구조:**
```
studio-baeks-ppt-engine/
├── README.md
├── deck-stage.js               슬라이드 플레이어
├── image-slot.js               드래그앤드롭 이미지 헬퍼 (선택)
├── index.html / editor.js / style.css   웹 편집기 프론트엔드
├── api/
│   └── convert.ts              POST /api/convert (Vercel)
├── engine/                     변환 라이브러리
│   ├── convert.ts              순수 함수 — CLI + API 공용
│   ├── build.ts                CLI 래퍼
│   ├── palette.ts              8색 OKLCH 팔레트
│   ├── template.html           HTML/CSS 래퍼
│   └── package.json
├── docs/
│   ├── how-to-use.md           ← 지금 이 문서
│   ├── Skills.md               AI Skill (Claude Code 호환 + 일반 시스템 프롬프트)
│   ├── catalog-v2.md           v2 카탈로그 명세
│   └── templates.md            directive 시연 MD
└── example/
    ├── sample.md               실제 발표 예시
    └── assets/                 이미지·차트
```

---

## 1. 로컬 빌드 (CLI)

```sh
cd engine
bun install              # 최초 1회
bun run build            # example/sample.md → example/sample.built.html
bun run build:templates  # docs/templates.md → docs/templates.built.html
```

임의 경로:

```sh
bun run build.ts path/to/source.md path/to/output.html
```

`deck-stage.js`로의 상대 경로는 출력 위치에 맞춰 엔진이 자동 계산한다.

---

## 1½. 웹 에디터 (사이트)

[studio-baeks-ppt-engine.vercel.app](https://studio-baeks-ppt-engine.vercel.app) 또는 로컬 `npx vercel dev`.

### 화면 구성

- **왼쪽**: MD 에디터 (Pretendard + JetBrains Mono, 자체 syntax highlight)
- **오른쪽 상단**: 프리뷰 iframe — 실시간 변환 (400ms 디바운스)
- **오른쪽 하단**: 발표자 노트 박스 — 현재 슬라이드의 `:::speaker-note` 블록과 양방향 동기화

### Toolbar

| 버튼 | 동작 |
|---|---|
| **PRIMARY** 스와치 8개 + 리셋 | 클릭하면 MD frontmatter의 `primary: ...` 갱신 |
| 이미지 관리 | 모달 — 업로드된 이미지 목록 + 새 업로드 (드래그앤드롭도 가능) |
| Sample | 예시 MD(`example/sample.md`) 로드 |
| 📊 PPT 뷰 | 새 창에 깨끗한 deck를 띄움 (1280×720) — 발표 시 청중 화면용 |
| 📝 발표자 뷰 | 새 창에 노트/타이머/다음 슬라이드 프리뷰 UI (1100×720) |
| HTML ↓ | 자체완결 HTML 다운로드 (업로드 이미지 base64 자동 임베드) |

프리뷰 iframe + PPT 뷰 윈도우 + 발표자 뷰 윈도우, 세 곳의 슬라이드 위치는 **3-way 양방향 자동 동기화**.

### 발표자 노트 박스

- 프리뷰에서 슬라이드 N으로 이동 → 박스가 슬라이드 N의 `:::speaker-note` 본문으로 자동 교체
- 박스에 텍스트 입력 → 250ms 디바운스 후 MD 텍스트에리어로 splice
- 박스를 비우면 MD에서 해당 블록 자동 제거
- **MD가 SoT** — 박스 편집 ↔ MD 편집 어느 쪽이든 즉시 다른 쪽에 반영

---

## 2. Preamble (Frontmatter)

파일 맨 위에 YAML 한 번 선언.

```yaml
---
title:    세계 대공황                          # <title> + 표지 H1 fallback
subtitle: 자본주의를 뒤흔든 가장 큰 비상사태   # 표지 부제 (선택)
author:   백재원                               # 표지 발표자명
id:       25-059                               # 학번/식별자
date:     2026-05-10                           # 발표 일자 (선택)
venue:    KSA 정경 발표                        # 장소·수업명 (선택)
primary:  terracotta                           # 8색 named OR hex
primaryDark: "#A8331E"                         # (선택) hex 모드일 때만 직접 지정
chrome:                                        # (선택) 4코너 메타데이터
  topLeft:    "{title}"
  topRight:   "{section}"
  bottomLeft: "{author} · {date}"
  bottomRight: "{n} / {total}"
---
```

| 필드 | 작동 |
|---|---|
| `title` | 브라우저 탭 타이틀. cover 슬라이드에 H1이 없으면 fallback |
| `subtitle` | cover 슬라이드 부제 (frontmatter 우선, 본문 paragraph는 fallback) |
| `author` | cover 슬라이드의 발표자명 |
| `id` | 학번/식별자 — monospace로 author 옆에 |
| `date` | cover meta 줄에 표시 |
| `venue` | cover meta 줄에 `date · venue`로 연결 |
| `primary` | 강조 색 — 8색 named 또는 hex |
| `primaryDark` | hex 모드일 때 어두운 변형 직접 지정 |
| `chrome` | 4코너 메타 슬롯 (§3 참고) |

### 8색 팔레트

| name | H | C500 | 정체성 |
|---|---|---|---|
| `terracotta` | 30  | 0.165 | 토기 — **default primary** |
| `rust`       | 18  | 0.155 | 녹슨 적 — error |
| `mustard`    | 75  | 0.140 | 황토 — warning |
| `sage`       | 130 | 0.110 | 세이지 — success |
| `mauve`      | 340 | 0.115 | 빛바랜 장미 |
| `teal`       | 200 | 0.115 | 청동 |
| `sky`        | 235 | 0.080 | 슬레이트 — info |
| `stone`      | 75  | 0.010 | 종이 그림자 — neutral |

런타임 색은 `oklch(L C H)`로 계산되며, slot 500/600 두 단계가 데크 강조 색으로 들어간다.

---

## 3. Chrome — 4코너 메타데이터

`chrome` frontmatter 키로 모든 본문 슬라이드의 네 모서리에 작은 메타 텍스트를 표시. 슬라이드 번호·섹션명·발표자 정보 등 반복적으로 들어가는 정보를 한 곳에서 관리.

### 슬롯 (4개)

`topLeft` / `topRight` / `bottomLeft` / `bottomRight` 각각 한 줄 문자열.

### 토큰

값 안에 `{토큰}` 형태로 동적 값 삽입:

| 토큰 | 의미 |
|---|---|
| `{title}` `{subtitle}` `{author}` `{id}` `{date}` `{venue}` | frontmatter 키 |
| `{n}` | 현재 슬라이드 번호 (1-base) |
| `{total}` | 전체 슬라이드 수 |
| `{section}` | 가장 가까운 직전 `:::divider`의 제목 (자동 추적). 슬라이드 attribute `section="이름"`로 명시적 override 가능 |

리터럴과 혼합 가능: `"발표 #{id} — {title}"`.

빈 문자열이거나 토큰이 비어 있으면 해당 슬롯 미표시.

### 기본 노출 정책

- `cover` (open/close) / `divider` → chrome **숨김** (표지는 깔끔하게)
- 그 외 layout → chrome **표시**

### Per-slide override

```md
:::single{chrome=false}
# 이 슬라이드만 chrome 숨김
:::

:::cover{chrome=true}
# cover에 chrome 강제 노출
:::
```

---

## 4. Directive 문법 — 3종

| 종류 | 문법 | 예시 | 쓰임 |
|---|---|---|---|
| **Container** | `:::name{attrs}` ··· `:::` (여닫음) | `:::split{...} ... :::` | Layout 5종 + 일부 Element (`chart`/`plot`/`stats`) + `:::speaker-note` |
| **Leaf** | `::name[content]{attrs}` (한 줄) | `::stat[88%]{label="..." primary}` | 단발성 Element (`::video`/`::callout`/`::stat`/`::note`) |
| **Text** | `:name[content]` (인라인) | `:primary[강조어]` | 본문 안의 강조 |

**규칙:**
- Container는 **반드시 빈 줄로 둘러싼다** — 앞뒤로 빈 줄이 없으면 파서가 혼동.
- Container를 Container 안에 직접 넣지 않는다 — **예외**: `:::chart` / `:::plot` / `:::stats` element 컨테이너는 layout 안에 자유 배치, `:::speaker-note`는 layout의 직접 자식으로 허용.
- Frontmatter (`---` YAML 블록)는 파일 **맨 위 한 번만**.

**Escape:**
- 달러 기호 리터럴: `\$859` (안 escape하면 `$...$` 사이가 KaTeX 수식으로 해석)
- 백슬래시 자체: `\\`
- 콜론을 directive로 안 잡히게 하려면 `\:`

---

## 5. Layout 5종

### 5.1 `:::cover` — 표지

데크의 첫 슬라이드(또는 마지막 슬라이드 닫기).

```md
:::cover{label="01 표지"}
# 세계 대공황

자본주의를 뒤흔든 가장 큰 비상사태
:::
```

H1 → 거대 제목, 다음 단락 → 부제, 발표자/학번은 frontmatter에서 자동.

| attribute | 값 | 설명 |
|---|---|---|
| `variant` | `open` (기본) / `close` | open=시작 표지 / close=닫는 표지 |
| `label` | string | 썸네일 라벨 |
| `chrome` | `true`/`false` | chrome override |

닫는 표지:
```md
:::cover{variant=close}
# 감사합니다
:::
```

긴 제목은 heading 깊이를 낮춰 폰트 크기 줄임 — 한국어 7자 이내 `#`(200px), 7~15자 `##`(140px), 15자+ `###`(96px).

### 5.2 `:::divider` — 섹션 구분

장(章) 구분 슬라이드. 제목은 `{section}` chrome 토큰에 자동 반영됨.

```md
:::divider{n=1 label="§ 진행과정"}
# 대공황의 전개
:::

:::divider{n=4 primary label="§ 해결"}
# 대공황은 어떻게 수습되었는가
:::
```

| attribute | 값 | 설명 |
|---|---|---|
| `n` | number | 섹션 번호 (Section 0N 라벨) |
| `primary` | boolean | primary 색상 배경 (검정 대신) |
| `label` | string | 썸네일 라벨 |

### 5.3 `:::index` — 목차

자동 번호 매김 (`01 02 03 …`) TOC.

```md
:::index{label="00 목차"}
# 오늘의 발표

- 1929 — 대공황의 시작
- 1933 — 뉴딜과 회복
- 2008 — 금융위기 재림
:::
```

내부는 md 리스트. 엔진이 자동으로 `01` `02` `03` 카운터 매김.

### 5.4 `:::single` — 1-col 자유 배치

데크의 본문 대부분. 텍스트 중심이거나 element를 자유 배치하는 슬라이드.

```md
:::single{label="04 본문"}
# 텍스트 중심 슬라이드

- 풀폭 1-col, 한 불릿당 글자 수 자유롭게
- :primary[키워드 강조]는 inline directive
- :muted 회색 부연 마커
- :key 마지막 불릿은 결론
:::
```

| attribute | 값 | 설명 |
|---|---|---|
| `align` | `left` (기본) / `center` / `right` | 가로 정렬 |
| `valign` | `top` / `center` / `bottom` | 세로 정렬 |
| `chrome` | `true`/`false` | chrome override |
| `label` | string | 썸네일 라벨 |

Element와 자유 조합:
```md
:::single{label="05 element 조합"}
# 차트 + 통계

:::chart{type=bar caption="GDP 추이"}
| 연도 | GDP |
|------|-----|
| 1929 | 100 |
| 1933 | 70 |
:::

::note[가상 데이터셋]
:::
```

> `:::bullets`는 v1 시절 이름. v2에서는 `:::single`이 정식. 코드는 backward-compat alias로 `bullets`도 받지만, 새 데크는 `single` 사용.

### 5.5 `:::split` — 2-col

좌·우 2-col 자유 배치. `---` (thematic break)가 슬롯 구분자.

```md
:::split{label="06 텍스트 + 이미지"}
# 좌측 텍스트

- 불릿 1
- 불릿 2
- :key 결론

---

![](./assets/right.png)
:::
```

순서를 뒤집으면 좌·우도 뒤집힘 (별도 attribute 없음):

```md
:::split{label="07 이미지 + 텍스트"}
![](./assets/left.png)

---

# 우측 텍스트
- 불릿
:::
```

차트와 함께:
```md
:::split{label="08 텍스트 + 차트"}
# 자료 분석
- 좌측은 메시지

---

:::chart{type=line caption="..."}
| ... | ... |
:::
:::
```

`align` `valign`도 받음.

---

## 6. Element 6종

block-level 콘텐츠 블록. 어느 layout 안에든 자유 배치.

### 6.1 `:::chart` — 데이터 차트 (container)

표 → SVG. `type` ∈ `{bar, line, pie}`.

```md
:::chart{type=bar caption="미국 실업률 (%)"}
| 연도 | 실업률 |
|------|--------|
| 1929 | 3.2 |
| 1933 | 24.9 |
:::
```

엔진이 직접 SVG를 그림 — 외부 차트 라이브러리 없음. 색은 primary 팔레트에서 자동 추출.

> 외부에서 만든 차트 이미지는 md `![](./assets/chart.png)`로. `:::chart`는 "데이터에서 그린다"는 의미.

### 6.2 `:::plot` — 카르테시안 그래프 (container)

함수 그래프 + 산점도. 자체 수식 토크나이저.

```md
:::plot{x="[-3.14, 3.14]" caption="삼각함수"}
y = sin(x)
y = cos(x)
:::
```

산점도 (markdown table):
```md
:::plot{caption="가상 데이터"}
| x | A | B |
|---|---|---|
| 1 | 2 | 5 |
| 5 | 8 | 3 |
:::
```

| attribute | 값 | 설명 |
|---|---|---|
| `x` | `"[min, max]"` | x-range (기본 `[-5, 5]`) |
| `y` | `"[min, max]"` | y-range (선택, 미지정 시 자동) |
| `caption` | string | 캡션 |

함수에서 사용 가능: `+ - * / ^`, `sin/cos/tan/asin/acos/atan/sinh/cosh/tanh/log/ln/sqrt/abs/exp`, 상수 `pi`/`e`, 변수 `x`만.

### 6.3 `::video` — 영상 임베드 (leaf)

mp4 또는 유튜브 URL. 16:9, 높이 600px.

```md
::video{src="https://youtu.be/dQw4w9WgXcQ" caption="..."}
::video{src="./assets/demo.mp4" caption="제품 데모"}
::video{src="./assets/auto.mp4" autoplay}
```

`autoplay`는 라이브 발표용 (음소거됨).

### 6.4 `::callout` — 큰 단일 메시지 (leaf)

```md
::callout[이 데크의 핵심 메시지는 단 하나입니다]
::callout[핵심 메시지]{detail="부연 설명 한 줄"}
```

`align=center` layout과 함께 쓰는 게 가장 자연스러움.

### 6.5 `::stat` + `:::stats` — 통계

`::stat`은 라벨 위 + 숫자 아래 수직 스택. 여러 개를 `:::stats`로 묶어 배치 결정.

**기본 (가로 row):**
```md
:::stats
::stat[−88.88%]{label="다우지수 낙폭" primary}
::stat[약 −60%]{label="2008 금융위기"}
::stat[9,000+]{label="파산 은행 수"}
:::
```

**세로 column:**
```md
:::stats{column}
::stat[−88.88%]{label="다우지수 낙폭" primary}
::stat[약 −60%]{label="2008 금융위기" reverse}    ← 우측 정렬로 뒤집기
:::
```

**`::stat` attribute:**

| attribute | 값 | 설명 |
|---|---|---|
| `label` | string | 숫자 아래 라벨 (필수) |
| `primary` | boolean | 숫자 primary 색상 |
| `reverse` | boolean | 좌측 정렬 → 우측 정렬 |

**`:::stats` attribute:**

| attribute | 값 | 설명 |
|---|---|---|
| (없음) | — | 가로 row (기본) |
| `column` | boolean | 세로 column |

### 6.6 `::note` — 작은 면책·부연 (leaf)

```md
::note[본 슬라이드의 통계는 가상 데이터로, 학술적 근거가 없습니다]
```

회색 톤, 슬라이드 하단에 자연스럽게 흐름.

---

## 7. md 표준 — 그대로 사용

| 용도 | md 문법 | 비고 |
|---|---|---|
| 제목 | `# heading` | h1은 슬라이드 제목으로 hoist, h2~h6은 인라인 |
| 불릿 | `- item` | 첫 토큰 `:muted` / `:key`는 마커로 처리 |
| 문단 | 그냥 텍스트 | |
| 이미지 | `![alt](./assets/x.png)` | 외부 차트 이미지도 여기 |
| 인용 | `> blockquote` | 출처는 `> — 저자` 관용 |
| 코드 | ` ```lang ` 펜스 | highlight.js GitHub Light 테마 자동 적용 |
| 표 | `\| ... \|` | chart 데이터로도 사용 |
| 인라인 수식 | `$e^{i\pi}+1=0$` | KaTeX |
| 블록 수식 | `$$\int e^{-x^2}dx$$` | KaTeX displayMode |
| 인라인 강조 | `**bold**` `*italic*` `` `code` `` | |

### 코드 펜스 예시
```md
:::single{label="코드"}
# Code Fence

```ts
function fib(n: number): number {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
```

- 문법 하이라이트 자동 (highlight.js)
- 라인 하이라이트는 미지원
:::
```

---

## 8. Inline directive

### `:primary[텍스트]` — primary 색 강조

```md
- 약 :primary[10년간 지속]된 장기 불황
```

### 불릿 마커 — `:muted` / `:key`

```md
- 일반 불릿
- :muted 톤다운된 보조 불릿
- :key 결론·요약 (굵게)
```

`:muted`/`:key`는 불릿의 **첫 토큰**일 때만 마커로 작동. 본문 중간에서는 일반 텍스트로 처리됨.

---

## 9. 두 축 정렬 — `align` / `valign`

모든 layout이 받는 정렬 속성 (선택):

| Attr | 값 | 의미 |
|---|---|---|
| `align` | `left` / `center` / `right` | 텍스트 가로 정렬 |
| `valign` | `top` / `center` / `bottom` | 슬라이드 내용 세로 정렬 |

기본값은 layout별 디자인 따름. 명시적 override 가능.

```md
:::single{align=center valign=center}
# 한가운데 정렬

::callout[이 슬라이드의 단일 메시지]
:::
```

> 중앙·우측 정렬 시 불릿 마커는 자동 숨김 — 옆에 dash가 떠 있으면 어색하므로.

---

## 10. `:::speaker-note` (모든 layout 내부)

발표자에게만 보이는 노트. 슬라이드 화면에는 안 나오고, 빌드된 HTML 안에 JSON으로 임베드되어 발표자 뷰 popup에서 표시.

```md
:::split{label="02 대공황이란?"}
# 대공황이란?

- 1929년 미국에서 시작
- 약 10년간 지속

:::speaker-note
**핵심**: 단순 주가 폭락이 아니라 시스템 붕괴.

예상 질문:
- "왜 5일 만에 23%?" → 마진콜 연쇄
- "한국 영향?" → 식민지라 직접 영향 제한적
:::
:::
```

규칙:
- **layout의 직접 자식**으로 둔다. Container 중첩 금지의 예외.
- 본문과 같은 md 문법 지원 (단락, 불릿, 강조, 수식 등).
- 한 슬라이드에 여러 개 둬도 됨 (자동 concat). 비우거나 생략하면 그 슬라이드는 노트 없음.

---

## 11. AI로 슬라이드 만들기

[`docs/Skills.md`](./Skills.md)를 두 가지 방법으로 사용:

- **Claude Code Skill**: `~/.claude/skills/studio-baeks-deck/SKILL.md`에 떨어뜨려 `/studio-baeks-deck`으로 호출
- **일반 시스템 프롬프트**: ChatGPT/Cursor/Claude.ai 등에 본문 통째로 붙여넣기 (Studio Baeks 사이트의 header에 `AI Prompt 복사` 버튼)

요청 후 출력된 MD를 사이트에 붙이거나 `*.md`로 저장 후 빌드.

---

## 12. 디자인 토큰 레퍼런스

### 색상

| 토큰 | 용도 |
|---|---|
| `--sb-color-primary-s500` | 강조 색상 (primary slot 500) |
| `--sb-color-primary-s600` | 어두운 변형 (primary slot 600) |
| `--fg` (`#1A1A1A`) | 본문 텍스트 |
| `--fg-muted` (`#8A8580`) | 보조 텍스트 |
| `--fg-subtle` (`#BFBAB3`) | 더 약한 톤 |
| `--bg-canvas` (`#FAF9F7`) | 슬라이드 기본 배경 |
| `--bg-panel` (`#F2EFEA`) | 코드 블록·표 등 패널 배경 |
| `--rule` (`#E5E1DA`) | 구분선 |

### 타입 스케일 (1920×1080 기준)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--type-display` | 96px | 표지 제목 (스케일은 #/##/### 깊이에 따라 자동 조정) |
| `--type-h1` | 72px | 슬라이드 제목 (weight 900) |
| `--type-h2` | 44px | 부제 |
| `--type-body` | 32px | 본문/불릿 |
| `--type-caption` | 24px | 캡션 |
| `--type-eyebrow` | 22px | 모노스페이스 라벨 |

### 스페이싱

| 토큰 | 값 | 용도 |
|---|---|---|
| `--pad-x` | 120px | 좌우 패딩 |
| `--pad-top`/`--pad-bottom` | 100px | 상하 패딩 |
| `--gap-title` | 56px | 제목과 본문 사이 |
| `--gap-bullet` | 28px | 불릿 사이 |
| `--gap-col` | 80px | 2-col 사이 |

---

## 13. 이미지 가이드

- **로컬 CLI**: `example/assets/` 폴더에 두고 MD에서 `./assets/파일명.png`로 참조
- **웹 에디터**: [이미지 관리] 모달 또는 드래그앤드롭으로 업로드
- 권장 비율: split 슬라이드는 4:3 또는 16:9
- 사용 가능 형식: PNG, JPG, SVG
- 톤 매핑은 엔진이 자동 — `filter: grayscale(0.15) contrast(1.02)` (사진), `contrast(1.05)` (차트)

### HTML 다운로드 시 자동 임베드

[HTML ↓] 클릭 시 업로드한 이미지가 **base64로 자동 임베드**되어 단일 HTML 파일이 됨. assets/ 폴더 따로 들고다닐 필요 없음.

---

## 14. deck-stage 동작

빌드된 `*.built.html`을 브라우저로 열면 `deck-stage.js`가 자동 활성화.

### 키보드 단축키

| 키 | 동작 |
|---|---|
| `→` `Space` `PgDn` | 다음 슬라이드 |
| `←` `PgUp` | 이전 슬라이드 |
| `Home` `End` | 처음 / 끝 |
| 숫자키 (`1`~`9`, `0`=10) | 해당 번호 슬라이드 |
| `R` | 처음으로 리셋 |
| `V` | 📊 PPT 뷰 새 창 띄움 |
| `P` | 📝 발표자 뷰 새 창 띄움 |

### 발표자 뷰

`📝` 또는 `P` 키로 새 창. 구성:
- **상단**: deck 제목 + 타이머 (클릭해서 시작/리셋, MM:SS)
- **중앙 좌**: 현재 슬라이드 미니 프리뷰
- **중앙 우**: 다음 슬라이드 미니 프리뷰
- **노트 패널**: 현재 슬라이드의 `:::speaker-note` 본문
- **푸터**: ← Prev / N / M / Next →

### 3-way 윈도우 동기화

메인 deck + PPT 뷰 popup + 발표자 뷰 popup, 셋 다 슬라이드 위치 자동 동기화.

### PDF 출력

1. 브라우저 `Cmd+P` / `Ctrl+P`
2. **"배경 그래픽 인쇄"** 체크 — 안 켜면 색 빠짐
3. 가로 방향, 여백 없음

---

## 15. 자주 하는 실수

- **HTML을 직접 편집** — `*.built.html`은 빌드 산출물. 수정은 `*.md`에서.
- **`$` 리터럴 escape 안 함** — `$859` 처럼 쓰면 수식으로 해석됨. `\$859`로.
- **`:::speaker-note` 닫고 슬라이드 닫는 `:::` 빠뜨림** — 흔한 실수. 엔진은 lenient하지만 명시적으로 두 번 닫는 게 가독성 좋음.
- **`:muted`/`:key`를 본문 중간에** — 불릿의 *첫 토큰*일 때만 마커.
- **raw HTML 끼워넣기** — 비허용. 막히는 케이스 생기면 directive 추가로 해결.
- **AI가 만든 `:::chart` 데이터를 검증 없이 사용** — AI는 수치를 자주 헛친다. 표 데이터는 직접 출처 확인 필수.
- **v1 directive 잔존 사용** — `:::bullets`/`:::stats`/`:::charts`/`:::disclaimer`/`:::thanks`/`:::image`/`:::stack`은 v1 시절 이름이고 backward-compat로 일부 받지만 deprecated. 새 데크는 v2 directive로.
