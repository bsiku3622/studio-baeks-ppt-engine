---
title: 슬라이드 템플릿 카탈로그
author: Studio Baeks
id: templates
primary: terracotta
---

:::cover{label="00 표지"}
# 슬라이드 템플릿 카탈로그

발표.md 시스템의 8가지 directive — 작성 예시 + 빌드 결과
:::

:::bullets{label="00 인덱스"}
# 8가지 directive

- :primary[:::cover] — 표지 (다크)
- :primary[:::divider] — 장 구분 (검정 또는 primary 색상)
- :primary[:::split] — 제목 + 불릿 + 우측 이미지. **데크의 70% 이상이 여기에 해당**
- :primary[:::bullets] — 풀폭 텍스트 슬라이드 (이미지 없이 논점만)
- :primary[:::stats] — 좌측 불릿 + 우측 통계 사이드바
- :primary[:::charts] — 좌측 불릿 + 우측 2-col 차트 그리드
- :primary[:::disclaimer] — 회색 불릿 + 하단 면책 (검증 안 된 가설)
- :key :primary[:::thanks] — 마지막 인사
:::

:::cover{label="01 :::cover"}
# 발표 제목

한 줄 부제 — 발표를 한 문장으로 요약
:::

:::divider{n=1 label="02 :::divider"}
# 섹션 제목 — 다음 장의 한 줄 요약
:::

:::divider{n=4 primary label="03 :::divider{primary}"}
# 결정적 전환 — 강조하고 싶은 섹션
:::

:::split{label="04 :::split"}
# 슬라이드 제목

- 일반 불릿 — 핵심 단어는 :primary[강조 색상]으로 처리
- 두 번째 불릿 — 한 슬라이드에 4–5개가 적정
- 세 번째 불릿 — 너무 길면 데크 톤이 무너짐
- :key 마지막 줄은 결론·요약을 굵게

![](../assets/stock-crash.png)
:::

:::bullets{label="05 :::bullets"}
# 텍스트 중심 슬라이드 제목

- 풀폭 사용 시 한 불릿당 글자 수를 더 늘려도 됨 — :primary[최대 1400px] 폭이라 여백이 자연스럽게 잡힘
- 두 번째 불릿 — 논리 전개가 길거나 인용문이 들어갈 때 적합
- 세 번째 불릿 — 논점이 5개를 넘어가면 두 슬라이드로 나누는 편이 가독성에 유리
- :muted 네 번째 불릿 — 부연 설명을 muted 톤으로 끼우는 것도 가능
- :key 마지막 불릿은 이 슬라이드에서 가져갈 단 하나의 메시지
:::

:::stats{label="06 :::stats"}
# 통계가 핵심인 슬라이드

- 좌측에는 통계의 의미·맥락을 풀어쓰고
- 우측에는 숫자만 크게 — 눈이 즉시 멈추도록
- 3개 이내가 적정 — 더 많아지면 한 슬라이드 안에서 비교가 안 됨
- :key 숫자는 가급적 단위(%)·기간 명시

::stat[−88.88%]{label="지표 1" primary}
::stat[약 −60%]{label="지표 2"}
::stat[9,000+]{label="지표 3"}
:::

:::charts{label="07 :::charts"}
# 두 자료를 나란히 비교

- 좌측 텍스트 — 두 차트가 무엇을 보여주는지
- 각 차트는 캡션 라벨로 식별
- 차트가 핵심이라면 글자 수는 줄여서 시선이 우측으로 가게
- :key 두 자료의 비교 결론을 마지막에

::chart{src="../assets/tariff-history-1821-2016.png" caption="차트 캡션 A"}
::chart{src="../assets/tariff-2025-timeline.png" caption="차트 캡션 B"}
:::

:::disclaimer{label="08 :::disclaimer"}
# 검증되지 않은 주장들

- 학술적 근거가 약한 주장
- 농담·여담·음모론 등
- 데크 본류와 분리해서 보여주는 콘텐츠
- 톤이 회색이라 시선이 자연스럽게 본문보다 약하게 잡힘

::note[본 슬라이드의 내용은 학술적으로 검증되지 않았습니다]
:::

:::thanks
:::
