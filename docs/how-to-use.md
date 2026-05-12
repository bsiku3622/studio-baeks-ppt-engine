# Studio Baeks PPT Engine — 사용 가이드

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
│   ├── templates.md            directive 시연 MD
│   └── templates.html          테마 피커 + show-source 카탈로그
└── example/
    ├── sample.md               실제 발표 예시 (대공황)
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

프리뷰 iframe + PPT 뷰 윈도우 + 발표자 뷰 윈도우, 세 곳의 슬라이드 위치는 **3-way 양방향 자동 동기화**. 어디서든 ←/→ 누르면 셋 다 같이 이동.

### 발표자 노트 박스

- 프리뷰에서 슬라이드 N으로 이동 → 박스가 슬라이드 N의 `:::speaker-note` 본문으로 자동 교체
- 박스에 텍스트 입력 → 250ms 디바운스 후 MD 텍스트에리어로 splice (없는 슬라이드에는 새 `:::speaker-note ... :::` 블록 삽입)
- 박스를 비우면 MD에서 해당 블록 자동 제거
- **MD가 SoT** — 박스 편집 ↔ MD 편집 어느 쪽이든 즉시 다른 쪽에 반영

박스가 회색·비활성화 상태로 보이면 MD에 슬라이드 directive(`:::cover` 등)가 하나도 없다는 뜻. Sample 버튼 또는 직접 작성 후 다시 시도.

---

## 2. Preamble (Frontmatter)

LaTeX의 `\title{} \author{} \date{}`에 대응하는 설정 블록. 파일 맨 위에 YAML 한 번 선언.

```yaml
---
title:    세계 대공황                          # <title> + 표지 H1 fallback
subtitle: 자본주의를 뒤흔든 가장 큰 비상사태   # 표지 부제 (선택)
author:   백재원                               # 표지·thanks의 발표자명
id:       25-059                               # 학번/식별자
date:     2026-05-10                           # 발표 일자 (선택)
venue:    KSA 정경 발표                        # 장소·수업명 (선택)
primary:  terracotta                           # 8색 named OR hex
primaryDark: "#A8331E"                         # (선택) hex 모드일 때만 직접 지정
---
```

| 필드 | 작동 |
|---|---|
| `title` | 브라우저 탭 타이틀. cover 슬라이드에 H1이 없으면 fallback |
| `subtitle` | cover 슬라이드 부제 (frontmatter 우선, 본문 paragraph는 fallback) |
| `author` | cover · thanks 슬라이드의 발표자명 |
| `id` | 학번/식별자 — monospace로 author 옆에 |
| `date` | cover meta 줄에 표시 |
| `venue` | cover meta 줄에 `date · venue`로 연결 |
| `primary` | 강조 색 — 8색 named 또는 hex |
| `primaryDark` | hex 모드일 때 어두운 변형 직접 지정 |

`primary`에 named 색을 쓰면 `primaryDark`는 slot 600에서 자동 산출. hex 직접 지정 시 두 값 다 권장.

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

런타임 색은 `oklch(L C H)`로 계산되며, slot 500/600 두 단계가 데크의 강조 색으로 들어간다. 풀 슬롯 시스템은 v1+ 로드맵 — 지금은 500/600만 노출.

---

## 3. Directive 문법 개관

3종의 directive 형태가 있다 — 시각적 구별이 분명함:

| 종류 | 문법 | 예시 | 쓰임 |
|---|---|---|---|
| **Container** (블록) | `:::name{attrs}` ··· `:::` (여닫음) | `:::split{label="..."} ... :::` | 슬라이드 전체 (12종) + `:::speaker-note` (중첩 전용) |
| **Leaf** (블록) | `::name[content]{attrs}` (한 줄) | `::stat[88%]{label="GDP" primary}` | 슬라이드 내부의 구조화된 항목 |
| **Text** (인라인) | `:name[content]` (인라인) | `:primary[강조어]` | 본문 안의 강조 |

**규칙:**
- Container directive는 **반드시 빈 줄로 둘러싼다** — 앞뒤로 빈 줄이 없으면 파서가 혼동.
- Container 안에 Container를 넣지 않는다 (슬라이드는 중첩 안 됨) — **예외**: `:::speaker-note`는 모든 슬라이드 directive 안에 둘 수 있다 (그것이 유일한 자리).
- Leaf directive는 자기 슬라이드 타입 안에서만 의미를 가진다 (`::stat`은 `:::stats` 안, `::chart`는 `:::charts` 안, `::note`는 `:::disclaimer` 안).
- Frontmatter (`---` YAML 블록)는 파일 **맨 위 한 번만**.

**Escape:**
- 달러 기호 리터럴: `\$859` (안 쓰면 `$`/`$$` 사이가 KaTeX 수식으로 해석)
- 백슬래시 자체: `\\`
- 콜론을 directive로 안 잡히게 하려면 `\:`

---

## 4. 슬라이드 directive — 12 종

각 슬라이드는 컨테이너 directive `:::name{attrs} ... :::` 형태.
모든 슬라이드 공통 속성: `label="..."` (썸네일 레일에 뜨는 라벨).

전체 목록: `cover`, `split`, `bullets`, `divider`, `stats`, `charts`, `disclaimer`, `thanks`, `image`, `stack`, `chart`, `plot`. 별도로 `:::speaker-note`는 모든 슬라이드 directive 안에 중첩 가능 (§4.13 참고).

### 4.1 `:::cover`

표지. 첫 슬라이드.

```md
:::cover{label="01 표지"}
# 세계 대공황

자본주의를 뒤흔든 가장 큰 비상사태
:::
```

H1 → 거대 제목, 다음 단락 → 부제, 발표자/학번은 frontmatter에서.

### 4.2 `:::split`

제목 + 불릿 + 우측 이미지. **데크의 70%가 이 형태.**

```md
:::split{label="02 대공황이란?"}
# 대공황이란?

- :primary[1929년 미국]에서 시작되어 전세계를 뒤흔든 경제 위기
- 약 :primary[10년간 지속]된 장기 불황
- :key 이후 현대 경제학의 패러다임을 바꾼 사건

![1929 Stock Market Crash](./assets/stock-crash.png)
:::
```

### 4.3 `:::bullets`

풀폭 텍스트 슬라이드. 이미지 없음.

```md
:::bullets{label="진행과정 · 시기"}
# 대공황 시대 — 언제까지인가

- 통상적으로 :primary[1929–1939년]
- 미국 참전 기준 :primary[1929–1941년]으로 보기도
- :key 완전 회복은 전쟁 없이는 불가능했다는 평가
:::
```

### 4.4 `:::divider`

장(章) 구분 슬라이드.

```md
:::divider{n=1 label="§ 진행과정"}
# 대공황의 전개
:::

:::divider{n=4 primary label="§ 해결"}
# 대공황은 어떻게 수습되었는가
:::
```

`n=숫자` → "Section 0N" 라벨, `primary` 플래그 → primary 배경(검정 대신).

### 4.5 `:::stats`

좌측 불릿 + 우측 통계 사이드바.

```md
:::stats{label="11 여파 · 경제"}
# 대공황의 여파 — 경제

- 4년 만에 미국 1인당 GDP 반토막
- 주식 시가총액의 :primary[88.88%]가 3년 새 증발
- :key 독일은 실업률 44%를 찍음

::stat[−88.88%]{label="미국 시가총액" primary}
::stat[약 −60%]{label="세계 무역"}
::stat[9,000+]{label="은행 파산 (US)"}
:::
```

leaf directive `::stat[값]{label="..." primary}` — `primary` 플래그를 한 stat에만 붙여 가장 강한 숫자 강조.

### 4.6 `:::charts`

제목 + 불릿 + 우측 2-col 차트 그리드.

```md
:::charts{label="18 현재와의 비교"}
# 역사는 반복되는가

- 2025년 미국 실효 관세율이 :primary[2.5% → 27%]로 급등
- :key 1930년 스무트-홀리 수준을 이미 넘어섰다

::chart{src="./assets/tariff-history-1821-2016.png" caption="관세율 추이 (1821–2016)" alt="US Tariff History"}
::chart{src="./assets/tariff-2025-timeline.png" caption="2025년 타임라인" alt="2025 Timeline"}
:::
```

### 4.7 `:::disclaimer`

회색 불릿 + 하단 면책. 검증 안 된 가설/여담용.

```md
:::disclaimer{label="10 음모론"}
# 대공황의 '진짜' 원인?

- 프리메이슨이 세계 경제를 의도적으로 붕괴시켰다는 설
- 로스차일드 가문 배후설
- 소련의 자본주의 붕괴 공작설

::note[학술적으로 검증된 내용이 아닙니다]
:::
```

`disclaimer` 안의 모든 불릿은 자동으로 muted 톤. `::note[...]` leaf directive가 하단 면책 문구.

### 4.8 `:::thanks`

마지막 슬라이드. 본문 비워두면 frontmatter의 author/id로 채워짐.

```md
:::thanks
:::
```

커스텀 메시지를 쓰려면 H1 추가:

```md
:::thanks
# 질문 환영합니다
:::
```

### 4.9 `:::image`

큰 이미지 한 장 + 옵션 캡션. `---`로 캡션-이미지 순서 결정.

```md
:::image{label="..."}

![Alt text](./assets/big.png)

---

이것은 캡션 — 위/아래 위치는 문서 순서로 결정됨

:::
```

캡션 없이 이미지만:

```md
:::image{label="..."}

![](./assets/big.png)

:::
```

### 4.10 `:::stack`

자유 컴포지션. 블록 N개를 세로로 쌓음. `align` / `valign` / `gap=small|medium|large` 사용 가능.

```md
:::stack{label="..." align=center valign=center gap=large}

# 큰 제목

---

본문 또는 부가 설명

---

- 불릿

:::
```

`:::cover` `:::divider`로 부족하거나 변형 디자인이 필요할 때.

### 4.11 `:::chart`

마크다운 테이블을 그대로 그려주는 차트. `type=bar | line | pie`.

```md
:::chart{type=line title="다우존스 — 1928~1933" label="02-1 다우 폭락"}
| 연도 | Dow |
|---|---|
| 1928 | 300 |
| 1929 | 380 |
| 1930 | 165 |
| 1932 | 60  |
| 1933 | 99  |
:::
```

엔진이 SVG로 렌더 — 외부 차트 라이브러리 없음. 색은 primary 팔레트에서 자동 추출.

### 4.12 `:::plot`

함수 그래프 + 산점도. `x="[min, max]"` 도메인 지정, 본문에 `y = ...` 표현식 줄 단위로 나열.

```md
:::plot{x="[-5, 5]" title="이차/삼각함수" label="13 plot"}
y = x^2
y = sin(x) * 3
:::
```

산점도(scatter)는 마크다운 테이블로:

```md
:::plot{x="[0, 10]"}
| x | y1 | y2 |
|---|----|----|
| 1 | 2  | 5  |
| 5 | 8  | 3  |
:::
```

함수 + 산점도 동시 사용 가능. 자체 토크나이저 — `pi`, `e`, `x`, `sin`/`cos`/`tan`/`log`/`sqrt` 등 기본 함수 지원.

### 4.13 `:::speaker-note` (모든 슬라이드 내부)

발표자에게만 보이는 노트. **슬라이드 화면에는 안 나옴.** 빌드된 HTML 안에 JSON으로 임베드되고, 발표자 뷰 popup이 열릴 때 표시됨.

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
- **슬라이드 directive 안**에 들어간다. Container 중첩 금지의 유일한 예외.
- 본문과 같은 마크다운 문법 지원 — 단락, 불릿, **bold**, *italic*, `code`, 수식 등.
- 한 슬라이드에 여러 개 둬도 됨 (자동 concat). 비우거나 생략하면 그 슬라이드는 노트 없음.
- **에디터 사이트**: 프리뷰 하단 박스로 양방향 편집 — MD가 SoT (§1½ 참고).
- **빌드된 HTML**: 우하단 overlay의 **📝 발표자 뷰** 버튼(또는 `P` 키)을 누르면 별도 윈도우에 표시 (§9 참고).
- 슬라이드 닫는 `:::`를 깜빡해도 엔진과 에디터가 자동 처리(lenient) — 그래도 명시적으로 두 번 닫는 게 가독성 좋음.

---

## 4½. 두 축 정렬 — `align` / `valign`

모든 슬라이드 directive는 이 두 속성을 받음 (선택). LaTeX `\begin{minipage}[c][...]` 처럼 가로/세로 정렬을 직접 지정.

| Attr | 값 | 의미 |
|---|---|---|
| `align`  | `left` `center` `right` | 텍스트 가로 정렬 |
| `valign` | `top` `center` `bottom` | 슬라이드 내용 세로 정렬 |

기본값은 directive별 디자인 따름. 명시적 override 가능:

```md
:::bullets{label="..." align=center valign=center}
# 한가운데 정렬
- 불릿 마커는 자동으로 숨겨짐
:::
```

> 중앙·우측 정렬 시 불릿 마커는 자동 숨김 — 옆에 dash가 떠 있으면 어색하므로.

---

## 4¾. 컴포지션 — `---` 블록 구분자

`:::split` `:::image` `:::stack`은 본문 안의 `---` (thematic break)로 컨텐츠 블록을 구분한다. **문서 순서가 곧 화면 배치 순서**.

```md
:::split{label="..."}

# 좌측 텍스트
- 불릿

---

![](./assets/right.png)

:::
```

순서를 바꾸면 좌우가 뒤집힘:

```md
:::split{label="..."}

![](./assets/left.png)

---

# 우측 텍스트
- 불릿

:::
```

> `:::split`은 정확히 2 블록 필요. `:::image`는 1~3 블록 (image + 옵션 caption 1~2). `:::stack`은 N 블록.
> 기존 split의 `H1 + UL + IMG` 패턴 (`---` 없음)도 그대로 작동 — backward compatible.

---

## 5. 인라인 문법

### `:primary[텍스트]` — 강조

```md
- 약 :primary[10년간 지속]된 장기 불황
```

→ `<span class="primary" style="font-weight: 700;">10년간 지속</span>`

### 불릿 마커

```md
- 일반 불릿
- :muted 톤다운된 보조 불릿
- :key 결론·요약 (굵게)
```

`:muted`/`:key`는 불릿의 **첫 토큰**일 때만 마커로 작동. 본문 중간에서는 일반 텍스트로 처리됨.

### 수식 (KaTeX)

- 인라인: `$\Delta M / \Delta H$`
- 블록: `$$M = \int_a^b f(x)\,dx$$`

> ⚠ 본문에 달러 기호를 리터럴로 쓰려면 escape — `\$859 → \$455`. 안 escape하면 `$...$` 사이가 수식으로 해석된다.

### 이미지 (split 슬라이드 안에서만 의미)

```md
![alt text](./assets/photo.png)
```

자동으로 `filter: grayscale(0.15) contrast(1.02)` 톤 매핑이 들어간다.

### 표준 MD

`**굵게**`, `*기울임*`, ``` `inline code` ```, `[링크](url)` 모두 지원.

---

## 6. AI로 딸깍 만들기

[`docs/Skills.md`](./Skills.md)를 두 가지 방법으로 사용:

- **Claude Code Skill**: `~/.claude/skills/studio-baeks-deck/SKILL.md`에 떨어뜨려 `/studio-baeks-deck`으로 호출
- **일반 시스템 프롬프트**: ChatGPT/Cursor/Claude.ai 등에 본문 통째 붙여넣기 (Studio Baeks 사이트의 header에 `AI Prompt 복사` 버튼도 있음)

그 후 "○○ 주제로 ○슬라이드짜리 발표 만들어줘" 같이 요청. `:::speaker-note`까지 자동으로 채워주는 가이드라인이 포함되어 있다. 출력된 MD를 사이트에 붙이거나 `*.md` 파일로 저장 후 빌드.

---

## 7. 디자인 토큰 레퍼런스

### 색상

| 토큰 | 용도 |
|---|---|
| `--sb-color-primary-s500` | 강조 색상 (primary slot 500) |
| `--sb-color-primary-s600` | 어두운 변형 (primary slot 600) |
| `--fg` (`#1A1A1A`) | 본문 텍스트 |
| `--fg-muted` (`#8A8580`) | 보조 텍스트 |
| `--fg-subtle` (`#BFBAB3`) | 더 약한 톤 |
| `--bg-canvas` (`#FAF9F7`) | 슬라이드 기본 배경 |
| `--rule` (`#E5E1DA`) | 구분선 |

### 타입 스케일 (1920×1080 기준)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--type-display` | 96px | 표지 제목 |
| `--type-h1` | 72px | 슬라이드 제목 |
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

## 8. 이미지 가이드

- **로컬 CLI**: `example/assets/` 폴더에 두고 MD에서 `./assets/파일명.png`로 참조
- **웹 에디터**: [이미지 관리] 모달 또는 드래그앤드롭으로 업로드 (이름이 같으면 자동 매칭)
- 권장 비율: split 슬라이드는 4:3
- 사용 가능 형식: PNG, JPG, SVG
- 톤 매핑은 엔진이 자동 적용 — `filter: grayscale(0.15) contrast(1.02)` (사진), `contrast(1.05)` (차트)

### HTML 다운로드 시 자동 임베드

[HTML ↓] 클릭 시 업로드한 이미지가 **base64로 자동 임베드**되어 단일 HTML 파일이 됨. assets/ 폴더 따로 들고다닐 필요 없음.

- 외부 URL 참조 이미지도 CORS 허용 시 fetch해서 함께 임베드
- 다운로드 진행 중 버튼이 "이미지 임베드 중…"으로 표시됐다가 끝나면 원복
- MD가 참조하는 파일을 업로드 안 한 경우 → HTML 안에서 `./assets/X.png` 그대로 남고 파일이 같이 있어야 보임

---

## 9. deck-stage 동작

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

### 하단 overlay 버튼

마우스 호버 또는 슬라이드 이동 시 잠깐 노출되는 컨트롤 바:

| 버튼 | 동작 |
|---|---|
| `←` / `→` | 이전/다음 슬라이드 |
| `N/M` | 현재/전체 슬라이드 번호 |
| Reset | 처음으로 (`R` 키와 동일) |
| 📊 PPT 뷰 | 동일 deck를 새 창에 띄움 — 발표 시 청중 화면 (`V` 키와 동일) |
| 📝 발표자 뷰 | 별도 창에 KeyNote 스타일 UI (`P` 키와 동일) |

### 발표자 뷰 (Presenter view)

`📝` 버튼 또는 `P` 키로 새 창이 열림. 구성:

- **상단**: deck 제목 + 타이머(클릭 시 시작/리셋, MM:SS)
- **중앙 좌**: 현재 슬라이드 미니 프리뷰 (~2/3 가로)
- **중앙 우**: 다음 슬라이드 미니 프리뷰 (~1/3 가로)
- **노트 패널**: 현재 슬라이드의 `:::speaker-note` 본문 (markdown 렌더링, 작은 폰트)
- **푸터**: ← Prev / N / M / Next →

발표자 윈도우 안에서 ←/→/Space/Home/End로 메인 deck 네비게이션도 가능.

### 3-way 윈도우 동기화

메인 deck + PPT 뷰 popup + 발표자 뷰 popup, 셋 다 슬라이드 위치 자동 동기화. 어디서든 슬라이드 넘기면 셋 다 같이 이동. 메인이 닫히면 popup도 자동 종료.

### 워터마크

마지막 슬라이드 하단 중앙에 `POWERED BY STUDIO BAEKS PPT ENGINE` 자동 표시 (배경 톤에 따라 자동 색상 분기).

### PDF 출력

1. 브라우저 `Cmd+P`(Mac) / `Ctrl+P`(Win)
2. **"배경 그래픽 인쇄"** 체크 — 안 켜면 색 빠짐
3. 가로 방향, 여백 없음
4. 한 페이지당 한 슬라이드

---

## 10. 자주 하는 실수

- **HTML을 직접 편집** — `*.built.html`은 빌드 산출물. 수정은 `*.md`에서.
- **`$` 리터럴 escape 안 함** — `$859` 처럼 쓰면 수식으로 해석됨. `\$859`로.
- **`:::speaker-note` 닫고 슬라이드 닫는 `:::` 빠뜨림** — 흔한 실수. 엔진과 에디터 모두 다음 슬라이드 directive를 만나면 auto-close하지만, 명시적으로 두 번 닫는 게 가독성 좋음.
- **`:muted`/`:key`를 본문 중간에** — 불릿의 *첫 토큰*일 때만 마커로 작동.
- **raw HTML 끼워넣기** — 현재는 비허용. 막히는 케이스 생기면 directive 추가로 해결.
- **AI가 만든 `:::chart` 데이터를 검증 없이 사용** — AI는 수치를 자주 헛친다. 표 데이터는 직접 출처 확인 필수.
