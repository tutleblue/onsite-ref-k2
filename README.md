# 두줄김밥 주문함

| 화면 | 주소 |
|---|---|
| 주문함 — 세 앱 주문 접수 · 조리 · 완료 | `#/` |
| 주방 화면 | `#/kitchen` |

- 처리 상태는 브라우저(localStorage)에 저장됩니다
- 주문은 앱 안 시뮬레이터가 만듭니다(처음 연 때를 11:40으로, 10배속). `테스트 주문`: 다음 주문 바로 받기 · `초기화`: 처음부터

## 실행

```
npm install
npm run dev
```

## 빌드 · 배포

```
npm run build     # dist/
npm run deploy    # Cloudflare Workers (정적 자산)
```
