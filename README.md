# Playground

여러 작은 프로젝트를 한 저장소 안에서 관리하는 워크스페이스입니다.

## 루트 실행

```bash
cd /Users/leeyukyung/Documents/Playground
npm run dev
```

브라우저:

```bash
http://127.0.0.1:3000
```

루트 페이지는 프로젝트 목록을 보여주고, 현재 `snake`는 `/snake` 경로로 연결됩니다.

## Snake 실행

```bash
cd /Users/leeyukyung/Documents/Playground/snake
PORT=3001 npm run dev
```

테스트:

```bash
cd /Users/leeyukyung/Documents/Playground/snake
npm test
```

## build-vercel-output 설명

[`scripts/build-vercel-output.js`](/Users/leeyukyung/Documents/Playground/scripts/build-vercel-output.js) 는 Vercel 배포 시 사용하는 빌드 스크립트입니다.

이 스크립트가 하는 일:

- 기존 `.vercel/output`을 지움
- 루트 [`public/`](/Users/leeyukyung/Documents/Playground/public) 을 `.vercel/output/static`으로 복사
- [`snake/public/`](/Users/leeyukyung/Documents/Playground/snake/public) 을 `.vercel/output/static/snake` 로 복사
- `/snake` 요청이 `snake/index.html` 로 가도록 Vercel용 `config.json` 생성

즉, Git에는 중복된 `public/snake` 소스를 두지 않고, 배포할 때만 필요한 정적 산출물을 만들어 줍니다.

## 권장 구조

```text
Playground/
  README.md
  public/
  scripts/
  snake/
  project-b/
  project-c/
```
