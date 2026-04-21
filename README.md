# 멀티마켓 재고 통합 자동화 시스템

> Google Sheets 기반 품절/재개 요청을 감지하여 6개 이커머스 플랫폼에 자동으로 반영하는 자동화 시스템

---

## 배경 및 문제상황

이커머스 운영팀은 재고 변동이 발생할 때마다 MD가 직접 6개 플랫폼(카페24, 쿠팡, 스마트스토어, 11번가, 롯데온, G마켓/옥션) 관리자 페이지에 각각 접속하여 수동으로 품절 처리를 해야 했습니다.

별도 알람 시스템이 없었기 때문에 MD가 구글 시트를 주기적으로 직접 확인해야 했고, 업무가 바쁜 경우 수십 건씩 처리가 밀리는 상황이 반복됐습니다.

**결과적으로 발생한 문제:**
- 품절 상품이 여전히 구매 가능 상태로 노출
- 고객이 주문 → CS팀이 취소 전화 → 고객 불만 발생
- MD ↔ CS팀 간 반복적인 소통 비용 발생

---

## 해결 방법

기존 팀의 업무 흐름(구글 시트)을 그대로 유지하면서 자동화를 얹는 방향으로 설계했습니다.

- MD가 구글 시트에 품절/품절해제 요청을 입력하면
- 1분 간격으로 시트를 폴링하여 변경사항을 감지하고
- 플랫폼별 API를 호출해 자동으로 판매 상태를 변경

비개발자가 기존 업무 흐름을 바꾸지 않아도 되는 구조가 핵심입니다.

---

## 성과

| 지표 | 개선 전 | 개선 후 |
|------|--------|--------|
| MD 수동 작업 | 월 33시간 | 0시간 |
| CS 품절 문의 | 주 10건 이상 | 해소 |
| 반영 시간 | 수 시간 ~ 다음날 | 최대 1분 |
| 운영 플랫폼 | 6개 수동 | 6개 자동 24시간 |

---

## 기술적 구현 포인트

### 플랫폼별 인증 방식 직접 구현
플랫폼마다 인증 방식이 모두 달라 각각 직접 구현했습니다.

| 플랫폼 | 인증 방식 |
|--------|---------|
| 쿠팡 | HMAC-SHA256 서명 |
| 스마트스토어 | OAuth 2.0 (bcrypt 서명) |
| 11번가 | API Key |
| 롯데온 | Bearer Token |
| G마켓/옥션 (ESM) | JWT 자체 생성 (HS256) |
| 카페24 | Google Apps Script + OAuth |

### 핵심 트러블슈팅
- **쿠팡**: Google Apps Script는 실행마다 IP가 변경되어 쿠팡 Wing IP 화이트리스트 등록 불가 → Python + 회사 고정 IP로 전환
- **Google Sheets API 429 에러**: 지수 백오프 재시도 로직 구현
- **ESM (G마켓/옥션)**: 공식 SDK 없이 JWT 직접 생성하여 인증 구현

### 시스템 플로우
```
구글 시트 입력 (품절 / 품절해제)
        ↓
   1분 간격 폴링
        ↓
  플랫폼 분기 처리
        ↓
각 마켓 API 호출
        ↓
완료 시 시트에 체크 + 로그 기록
```

---

## 기술 스택

- **Language**: Python 3, Google Apps Script
- **API 연동**: 쿠팡 Partners API, 네이버 커머스 API, 11번가 Open API, 롯데온 Open API, ESM Plus API, 카페24 API
- **인증**: HMAC-SHA256, OAuth 2.0, JWT (PyJWT), Bearer Token
- **스케줄링**: Windows Task Scheduler (1분 간격)
- **데이터 소스**: Google Sheets API (gspread)

---

## 프로젝트 구조

```
multi-market-automation/
├── apps_script/
│   └── cafe24.js          # 카페24 + 자사몰 처리 (Google Apps Script)
├── python/
│   ├── main.py            # 진입점 - 전체 플랫폼 순차 실행
│   ├── config.py          # 환경변수 로드 및 상수 정의
│   ├── sheets.py          # Google Sheets 연동 (읽기/쓰기)
│   ├── coupang.py         # 쿠팡 HMAC 인증 + 3단계 API 처리
│   ├── naver.py           # 스마트스토어 OAuth 2.0 + 다중 계정
│   ├── st11.py            # 11번가 XML 응답 파싱
│   ├── lotteon.py         # 롯데온 Bearer 인증
│   └── esm.py             # G마켓/옥션 JWT 자체 생성
├── .env.example           # 환경변수 템플릿
├── .gitignore
├── requirements.txt
└── README.md
```

---

## 실행 방법

### 1. 환경변수 설정

```bash
cp .env.example .env
# .env 파일에 각 플랫폼 API 키 입력
```

### 2. 의존성 설치

```bash
pip install -r requirements.txt
```

### 3. 실행

```bash
python main.py
```

Windows Task Scheduler에 등록하여 1분 간격으로 자동 실행하도록 설정합니다.

---

## 환경변수 목록

`.env.example` 파일 참고
