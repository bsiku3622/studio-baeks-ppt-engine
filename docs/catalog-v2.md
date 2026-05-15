---
title: 슬라이드 카탈로그 v2
status: 구현 완료 (Phase 1, 2026-05-15). v1 directive는 backward-compat alias로 유지.
supersedes: docs/Skills.md (v1), docs/templates.md (v1)
---

# 슬라이드 카탈로그 v2

`engine/convert.ts`에 구현된 directive 카탈로그. v1(12종)을 **Layout 5 + Element 6 + md 표준 재사용 + Chrome 시스템**으로 재편.

---

## 설계 원칙

1. **Layout = 슬라이드 레이아웃만 정의** — 내부 콘텐츠 종류를 하드코딩하지 않음.
2. **Element = 콘텐츠 블록** — 어느 layout에도 자유롭게 들어갈 수 있는 block-level directive.
3. **md 표준이 이미 표현하는 것은 element로 만들지 않음** — 제목·불릿·문단·이미지·인용·코드·표·LaTeX는 그대로 md 문법.
4. **자유 배치는 슬롯 *내부*에만** — 컬럼 수는 layout이 결정. `split`은 항상 2-col, `single`은 항상 1-col. 3+ 컬럼 layout 없음.

---

## Layouts (5종)

### `:::cover`
표지. 데크의 시작 또는 끝. 기본 chrome 숨김.

| attribute | 값 | 설명 |
|---|---|---|
| `variant` | `open` (기본) / `close` | 시작 표지 / 닫는 표지 |
| `label` | string | 썸네일 라벨 |
| `chrome` | `true`/`false` | chrome 강제 노출/숨김 |

```md
:::cover{label="01 표지"}
# 발표 제목

한 줄 부제
:::

:::cover{variant=close}
# 감사합니다
:::
```

### `:::divider`
섹션 구분. 기본 chrome 숨김. `{section}` 토큰은 가장 가까운 직전 divider의 제목을 추적.

| attribute | 값 | 설명 |
|---|---|---|
| `n` | number | 섹션 번호 (선택) |
| `primary` | boolean | primary 색상 배경 |
| `label` | string | 썸네일 라벨 |

```md
:::divider{n=2 primary label="03 전환점"}
# 결정적 전환 — 다음 장의 한 줄 요약
:::
```

### `:::index`
목차. 1차는 수동 작성 (md `- item` 리스트). 자동 번호 매김 (`01 02 03 …`).

```md
:::index{label="00 목차"}
# 오늘의 발표

- 1929 — 대공황의 시작
- 1933 — 뉴딜과 회복
- 2008 — 금융위기 재림
:::
```

### `:::single` (구 `:::bullets`)
1-col 레이아웃. 위→아래 element/md 자유 배치. 텍스트 중심 슬라이드의 기본.

| attribute | 값 | 설명 |
|---|---|---|
| `align` | `left` (기본) / `center` / `right` | 가로 정렬 |
| `valign` | `top` / `center` / `bottom` | 세로 정렬 |
| `chrome` | `true`/`false` | chrome override |
| `label` | string | 썸네일 라벨 |

> `:::bullets`는 backward-compat alias. 새 코드는 `:::single` 사용 권장.

```md
:::single{label="05 본문"}
# 텍스트 중심 슬라이드

- 풀폭 사용 시 한 불릿당 글자 수를 늘려도 됨
- 논리 전개가 길거나 인용문이 들어갈 때 적합
- :key 마지막 불릿은 이 슬라이드의 단 하나의 메시지
:::
```

### `:::split`
2-col 레이아웃. 좌·우 슬롯은 `---` (thematicBreak) 으로 구분. 컬럼 비율 고정. 순서만 바꾸면 미디어 좌측도 가능 (별도 attribute 불필요).

| attribute | 값 | 설명 |
|---|---|---|
| `align` / `valign` | 위와 동일 | |
| `chrome` / `label` | 위와 동일 | |

```md
:::split{label="04 차트 비교"}
# 두 자료의 대조

- 좌측: 핵심 메시지
- 우측: 시각화
- :key 비교 결론

---

:::chart{type=line caption="실업률 추이"}
| 연도 | 실업률 |
|------|--------|
| 1929 | 3.2 |
| 1933 | 24.9 |
:::
:::
```

---

## Elements (6종)

block-level directive. layout 내부에 자유 배치.

### `:::chart` (container)
표 → SVG 차트. 엔진이 직접 그림.

| attribute | 값 | 설명 |
|---|---|---|
| `type` | `bar` / `line` / `pie` | 차트 종류 |
| `caption` | string | 캡션 |

데이터는 컨테이너 내부의 markdown table:

```md
:::chart{type=bar caption="미국 실업률"}
| 연도 | 실업률 |
|------|--------|
| 1929 | 3.2 |
| 1933 | 24.9 |
:::
```

> 외부에서 만든 차트 이미지를 넣고 싶으면 그냥 md 이미지(`![alt](path)`) 사용. chart는 "데이터에서 그린다"는 의미를 보장.

### `:::plot` (container) — 카르테시안 그래프
함수 또는 산점도 → XY 좌표계 SVG. 자체 수식 토크나이저로 `y = sin(x)` 같은 식을 평가.

| attribute | 값 | 설명 |
|---|---|---|
| `x` | `"[min, max]"` | x-range (기본 `[-5, 5]`) |
| `y` | `"[min, max]"` | y-range (선택, 미지정 시 자동) |
| `caption` | string | 캡션 |

함수형:
```md
:::plot{x="[-3.14, 3.14]" caption="삼각함수"}
y = sin(x)
y = cos(x)
:::
```

산점도 (table):
```md
:::plot{caption="가상 데이터셋"}
| x | A | B |
|---|---|---|
| 1 | 2 | 5 |
| 2 | 3 | 6 |
:::
```

함수에서 사용 가능한 식: `+ - * / ^`, `sin/cos/tan/asin/acos/atan/sinh/cosh/tanh/log/ln/sqrt/abs/exp`, 상수 `pi`, `e`.

### `::video`
mp4 또는 유튜브 임베드. 16:9 비율 고정, 높이 600px.

| attribute | 값 | 설명 |
|---|---|---|
| `src` | path/URL | mp4 경로 또는 유튜브 URL |
| `caption` | string | 캡션 |
| `autoplay` | boolean | 자동재생 (라이브 발표용) |

```md
::video{src="../assets/demo.mp4" caption="제품 데모"}
::video{src="https://youtu.be/XXXX" caption="참고 영상"}
```

### `::callout`
큰 단일 메시지 강조. 본문 + optional 부연.

| attribute | 값 | 설명 |
|---|---|---|
| `detail` | string | 본문 아래 부연 한 줄 |

```md
::callout[이 데크의 핵심 메시지는 단 하나입니다]
::callout[핵심 메시지]{detail="부연 설명 한 줄"}
```

> `align=center`와 함께 쓸 때 가장 자연스러움.

### `::stat` + `:::stats`
큰 숫자 + 라벨 (수직 스택: 라벨 위 / 숫자 아래). `:::stats` 컨테이너로 묶어 가로/세로 배열 결정.

**`::stat` attribute**

| attribute | 값 | 설명 |
|---|---|---|
| `label` | string | 숫자 아래 라벨 |
| `primary` | boolean | 숫자 primary 색상 |
| `reverse` | boolean | 좌측 정렬 → 우측 정렬로 뒤집기 |

**`:::stats` attribute (그룹 컨테이너)**

| attribute | 값 | 설명 |
|---|---|---|
| (없음) | — | 가로 row 배치 (기본) |
| `column` | boolean | 세로 column 배치 |

```md
:::stats
::stat[−88.88%]{label="다우지수 낙폭" primary}
::stat[약 −60%]{label="2008 금융위기"}
::stat[9,000+]{label="파산 은행 수"}
:::

:::stats{column}
::stat[−88.88%]{label="다우지수 낙폭" primary}
::stat[약 −60%]{label="2008 금융위기" reverse}    <!-- 좌우 혼합 가능 -->
::stat[9,000+]{label="파산 은행 수"}
:::
```

> 단일 `::stat`을 그냥 `:::single`/`:::split` 슬롯 안에 놓으면 세로 스택으로 흐름. 다수 stat을 묶어 정돈하려면 `:::stats`로 감싸기.

### `::note`
작은 부연·면책 톤 (회색). 기존 `:::disclaimer` 슬라이드를 흡수.

```md
::note[본 슬라이드의 내용은 학술적으로 검증되지 않았습니다]
```

---

## md 표준 (그대로 사용)

| 용도 | md 문법 |
|---|---|
| 제목 | `# heading` (h1=슬라이드 제목, h2~h6=인라인) |
| 불릿 | `- item` (li 시작 `:muted`/`:key` 마커 지원) |
| 문단 | 그냥 텍스트 |
| 이미지 | `![alt](url)` |
| 인용 | `> blockquote` (출처는 `> — 저자` 관용) |
| 코드 | ` ```lang ` 펜스 — highlight.js로 자동 문법 하이라이트 (라인 하이라이트는 미지원) |
| 표 | `\| ... \|` (chart 데이터로도 사용) |
| 인라인 수식 | `$e^{i\pi}+1=0$` — KaTeX |
| 블록 수식 | `$$\int e^{-x^2}dx$$` — KaTeX displayMode |
| 인라인 강조 | `**bold**`, `*italic*`, `` `code` `` |

---

## Inline directive

- `:primary[강조 텍스트]` — primary 색상 (굵게)
- `:muted` — li 시작 마커, 회색 부연 톤
- `:key` — li 시작 마커, 핵심 결론 (굵게)

---

## Chrome — 전역 메타데이터 슬롯

모든 슬라이드의 네 모서리에 표시되는 메타 텍스트. frontmatter `chrome:` 키로 설정.

### 슬롯 (4개)

`topLeft` / `topRight` / `bottomLeft` / `bottomRight`

### 값 지정

```yaml
chrome:
  topLeft:     "{title}"
  topRight:    "{section}"
  bottomLeft:  "{author} · {date}"
  bottomRight: "{n} / {total}"
```

리터럴 + 토큰 혼합 가능: `"발표 #{id} — {title}"`.
빈 문자열이거나 토큰이 비어 있으면 슬롯 미표시.

### 지원 토큰

- **frontmatter 키**: `{title}` `{subtitle}` `{author}` `{date}` `{venue}` `{id}` 등 frontmatter에 정의된 모든 키
- **빌트인 변수**:
  - `{n}` — 현재 슬라이드 번호 (1-base)
  - `{total}` — 전체 슬라이드 수
  - `{section}` — 가장 가까운 직전 `:::divider`의 제목. divider 이전 슬라이드에서는 빈 문자열

### 기본 노출 정책

- `cover` / `divider` — chrome **숨김**
- 그 외 모든 layout — chrome **표시**

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

## v1 → v2 마이그레이션

| v1 directive | v2 |
|---|---|
| `:::cover` | 유지 (open/close variant 추가) |
| `:::divider` | 유지 |
| `:::split` | 유지 (내부 구조 자유, `---` 슬롯 구분) |
| `:::bullets` | `:::single`로 rename (bullets는 alias로 유지, deprecated) |
| `:::stats` (v1 layout) | `:::single` + `:::stats` element wrapper로 분리 |
| `:::charts` (v1 layout) | `:::split` 또는 `:::single` + `:::chart` 여러 개 |
| `:::disclaimer` | `:::single` + `::note[]` |
| `:::thanks` | `:::cover{variant=close}` |
| `:::image` | md `![]()` 그대로 사용 (또는 split/single에 임베드) |
| `:::stack` | `:::single` (자유 배치라 stack과 동등) |
| `:::chart` (v1 slide) | `:::chart` element (single/split 내부에 임베드) |
| `:::plot` (v1 slide) | `:::plot` element (single/split 내부에 임베드) |

> v1 slide-level directive (`stats`/`charts`/`disclaimer`/`thanks`/`image`/`stack` + `chart`/`plot` 슬라이드 형태)는 Phase 3에서 코드에서 제거됨. `:::bullets`는 `:::single` alias로 잔존 (deprecated, 추후 제거 가능).

---

## 구현 상태 (Phase 1 완료, 2026-05-15)

- [x] `:::single` layout (bullets alias 동시 지원)
- [x] `:::index` layout (자동 번호 매김 카운터)
- [x] `cover variant=close`
- [x] `::video` / `::callout` / `::note` element
- [x] `:::stats` wrapper (default row, `column` opt-in)
- [x] `::stat` `reverse` attribute
- [x] `:::chart` element-level embed (block 안 어디든)
- [x] `:::plot` element-level embed (카르테시안 그래프)
- [x] Chrome 시스템 (4슬롯 + 토큰 치환 + section 추적 + per-slide override)
- [x] 코드 펜스 + highlight.js 문법 하이라이트
- [x] LaTeX 인라인/블록 (KaTeX) — 기존 코드 그대로 동작
- [x] 한글 단어 깨짐 방지 (`word-break: keep-all`)
- [x] h1 weight 900 (Pretendard 최대)

## Phase 진행 상황 (2026-05-15)

- [x] **Phase 1** — 카탈로그 신규 directive 구현 + 시각 검증
- [x] **Phase 2** — `example/sample.md` (33슬라이드 대공황 데크), `docs/templates.md` (28슬라이드 카탈로그 시연) v2로 재작성
- [x] **Phase 3** — v1 slide-level directive 코드에서 제거 (`convert.ts` 256줄 감축)
- [x] **Phase 4** — `docs/Skills.md` (LLM 프롬프트), `docs/how-to-use.md` (사용자 가이드), `README.md` v2 기준 재작성
