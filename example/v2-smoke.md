---
title: v2 Catalog Smoke Test
subtitle: 모든 layout · element · md 표준 통합 검증
author: Studio Baeks
id: 25-v2-smoke
date: 2026-05-15
venue: Internal QA
primary: teal
chrome:
  topLeft:  "{title}"
  topRight: "{section}"
  bottomLeft: "{author} · {date}"
  bottomRight: "{n} / {total}"
---

:::cover{label="01 cover open"}
# v2 Catalog Smoke

5 layouts + 5 elements + md 표준 통합 검증
:::

:::index{label="02 index"}
# 검증 항목

- Layouts — cover · divider · index · split · bullets
- Elements — chart · video · callout · stat · note
- md 표준 — heading · list · image · quote · code · table
- Inline — :primary · :muted · :key
- Chrome — frontmatter 4슬롯 + per-slide override
:::

:::divider{n=1 label="03 divider default"}
# Section 1 — Layouts
:::

:::divider{n=2 primary label="04 divider primary"}
# Primary 변형도 OK
:::

:::split{label="05 split — text+media"}
# Split layout

- 좌측은 :primary[텍스트 블록]
- 우측은 미디어 블록
- 좌·우 구분은 :primary[---]
- :key 슬롯 내부는 자유 배치

---

![대공황 차트](./assets/stock-crash.png)
:::

:::split{label="05b split — media+text (역순)"}
![루즈벨트](./assets/roosevelt.png)

---

# 역순도 가능

- :primary[---] 앞을 미디어로 작성
- 뒤를 텍스트로 작성
- 별도 attribute 없이 source 순서만 바꿈
- :key 좌·우 슬롯은 자동 감지
:::

:::single{label="06 bullets — text-only"}
# Bullets layout

- 1-col 풀폭 텍스트 슬라이드
- 한 불릿당 글자 수 더 늘려도 됨 — 폭이 자연스럽게 잡힘
- :muted 회색 부연 불릿
- :key 핵심 결론은 굵게
:::

:::divider{n=3 label="07 divider — elements"}
# Section 2 — Elements
:::

:::single{align=center label="08 callout"}
# ::callout

::callout[Callout은 슬라이드의 단 하나의 메시지]{detail="부연 한 줄로 톤 보강"}
:::

:::single{label="09 stat — 가로 (기본)"}
# :::stats — 가로 (기본)

:::stats
::stat[−88.88%]{label="다우지수 낙폭" primary}
::stat[약 −60%]{label="2008 금융위기"}
::stat[9,000+]{label="파산 은행 수"}
:::
:::

:::single{label="09b stat — 세로 (column opt-in)"}
# :::stats{column} — 세로

:::stats{column}
::stat[−88.88%]{label="다우지수 낙폭" primary}
::stat[약 −60%]{label="2008 금융위기"}
::stat[9,000+]{label="파산 은행 수"}
:::
:::

:::single{label="09c stat — 세로 + 좌우 혼합"}
# :::stats{column} + reverse 혼합

:::stats{column}
::stat[−88.88%]{label="다우지수 낙폭" primary}
::stat[약 −60%]{label="2008 금융위기" reverse}
::stat[9,000+]{label="파산 은행 수"}
:::
:::

:::single{label="10 chart bar"}
# :::chart{type=bar}

:::chart{type=bar caption="미국 실업률 (%)"}
| 연도 | 실업률 |
|------|--------|
| 1929 | 3.2 |
| 1931 | 15.9 |
| 1933 | 24.9 |
| 1937 | 14.3 |
| 1941 | 9.9 |
:::
:::

:::single{label="11 chart line"}
# :::chart{type=line}

:::chart{type=line caption="다우존스 산업평균지수"}
| 연도 | 다우지수 |
|------|----------|
| 1929 | 381 |
| 1930 | 240 |
| 1931 | 78 |
| 1932 | 41 |
| 1933 | 99 |
:::
:::

:::single{label="12 chart pie"}
# :::chart{type=pie}

:::chart{type=pie caption="1933 부문별 실업 분포 (가상)"}
| 부문 | 비율 |
|------|------|
| 공업 | 38 |
| 농업 | 22 |
| 서비스 | 18 |
| 건설 | 14 |
| 기타 | 8 |
:::
:::

:::single{label="12b plot — 함수"}
# :::plot — 카르테시안 그래프 (함수)

:::plot{x="[-3.14, 3.14]" caption="삼각함수"}
y = sin(x)
y = cos(x)
:::
:::

:::single{label="12c plot — scatter"}
# :::plot — 카르테시안 그래프 (산점도)

:::plot{caption="가상 데이터셋"}
| x | A | B |
|---|---|---|
| 1 | 2 | 5 |
| 2 | 3 | 6 |
| 3 | 5 | 4 |
| 4 | 7 | 3 |
| 5 | 8 | 5 |
:::
:::

:::single{align=center label="13 video — youtube"}
# ::video

::video{src="https://youtu.be/dQw4w9WgXcQ" caption="유튜브 임베드 (16:9)"}
:::

:::single{label="14 note"}
# ::note

- 본문 내용은 평범한 불릿으로 채우고
- 슬라이드 하단에 회색 면책·부연 한 줄

::note[본 슬라이드의 통계는 가상 데이터로, 학술적 근거가 없습니다]
:::

:::divider{n=4 label="15 divider — md 표준"}
# Section 3 — md 표준
:::

:::single{label="16 md heading/list/paragraph"}
# md heading · list · paragraph

일반 단락도 그냥 작성하면 본문 톤으로 렌더됩니다. **강조**나 *기울임*, `inline code`도 md 그대로.

- 리스트
- :primary[primary 강조 단어]
- :muted 회색 마커
- :key 핵심 마커
:::

:::single{label="17 md table"}
# md table

| 시기 | 실업률 | 다우 |
|------|--------|------|
| 1929 | 3.2% | 381 |
| 1933 | 24.9% | 99 |
| 1937 | 14.3% | 194 |
:::

:::split{label="18 md image + blockquote"}
# md image + blockquote

> 우리가 두려워해야 할 단 한 가지는 두려움 그 자체입니다.
> — Franklin D. Roosevelt, 1933

---

![루즈벨트](./assets/roosevelt.png)
:::

:::single{label="18b LaTeX math"}
# LaTeX (KaTeX)

- 인라인: 오일러의 항등식 $e^{i\pi} + 1 = 0$
- 인라인: $\sum_{k=1}^{n} k = \frac{n(n+1)}{2}$
- 블록 수식 아래:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

- :key 다항식 일반형 $ax^2 + bx + c = 0$
:::

:::single{label="19 md code fence"}
# md code fence

```ts
function fib(n: number): number {
  if (n < 2) return n;
  return fib(n - 1) + fib(n - 2);
}
console.log(fib(10)); // 55
```

- 문법 하이라이트는 별도 처리 없이 md fence 그대로
- :key 라인 하이라이트는 의도적으로 미지원
:::

:::divider{n=5 label="20 chrome demos"}
# Section 4 — Chrome
:::

:::single{chrome=false label="21 chrome=false override"}
# Chrome 숨김 override

- 이 슬라이드는 frontmatter에 chrome이 정의돼 있어도 숨김
- :key `chrome=false` attribute로 per-slide override
:::

:::cover{chrome=true label="22 chrome=true on cover"}
# Cover에 chrome 강제 노출
chrome=true로 기본 숨김 정책을 깸
:::

:::cover{variant=close label="23 cover close"}
# 검증 완료
:::
