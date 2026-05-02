# Playground

여러 작은 프로젝트를 한 저장소 안에서 관리하는 워크스페이스입니다.

## 루트 실행

```bash
cd /Users/leeyukyung/project/Playground
npm run dev
```

브라우저:

```bash
http://127.0.0.1:3000
```

루트 페이지는 프로젝트 목록을 보여주고, 현재 아래 경로로 연결됩니다.

- `snake` → `/snake`
- `cards` → `/cards`
- `giraffe` → `/giraffe`
- `minecraft` → `/minecraft`

## Snake 실행

```bash
cd /Users/leeyukyung/project/Playground/snake
PORT=3001 npm run dev
```

테스트:

```bash
cd /Users/leeyukyung/project/Playground/snake
npm test
```

## Walking Giraffe 실행

루트 서버에서 함께 제공됩니다.

```bash
cd /Users/leeyukyung/project/Playground
npm run dev
```

브라우저:

```bash
http://127.0.0.1:3000/giraffe
```

## Prism Trio 실행

루트 서버에서 함께 제공됩니다.

```bash
cd /Users/leeyukyung/project/Playground
npm run dev
```

브라우저:

```bash
http://127.0.0.1:3000/cards
```

게임 규칙, 점수 로직, 랜덤 구조, 공유 랭킹, 관련 파일 정리는 [`cards/README.md`](/Users/leeyukyung/project/Playground/cards/README.md) 에 있습니다.

## Prism Trio 공유 랭킹(Supabase)

`/cards` 의 공유 랭킹은 Supabase REST API를 직접 사용합니다. 기본값은 전용 프로젝트 `ai-playground` (`rexaexziprkcyeyxnivh`) 로 고정되어 있어서 별도 설정 없이도 동작합니다. 랭킹은 게임을 완료한 뒤 저장한 점수만 등록할 수 있습니다. 다른 Supabase 프로젝트로 바꾸고 싶을 때만 아래 환경변수를 사용하세요.

- `PRISM_TRIO_SUPABASE_URL`
- `PRISM_TRIO_SUPABASE_ANON_KEY`

로컬 실행 예시:

```bash
cd /Users/leeyukyung/project/Playground
PRISM_TRIO_SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
PRISM_TRIO_SUPABASE_ANON_KEY="YOUR_ANON_KEY" \
npm run dev
```

Vercel 배포도 같은 이름의 환경변수를 프로젝트에 설정하면 됩니다. 로컬 서버는 `/cards/runtime-config.js` 를 동적으로 제공하고, `npm run vercel-build` 는 같은 내용을 `.vercel/output/static/cards/runtime-config.js` 로 생성합니다.

DB 스키마와 RLS 정책은 [`supabase/prism_trio_scores.sql`](/Users/leeyukyung/project/Playground/supabase/prism_trio_scores.sql) 에 있습니다. Supabase SQL editor에서 이 파일 내용을 실행하면 됩니다.

## build-vercel-output 설명

[`scripts/build-vercel-output.js`](/Users/leeyukyung/project/Playground/scripts/build-vercel-output.js) 는 Vercel 배포 시 사용하는 빌드 스크립트입니다.

이 스크립트가 하는 일:

- 기존 `.vercel/output`을 지움
- 루트 [`public/`](/Users/leeyukyung/project/Playground/public) 을 `.vercel/output/static`으로 복사
- [`snake/public/`](/Users/leeyukyung/project/Playground/snake/public) 을 `.vercel/output/static/snake` 로 복사
- [`cards/public/`](/Users/leeyukyung/project/Playground/cards/public) 을 `.vercel/output/static/cards` 로 복사
- [`giraffe/public/`](/Users/leeyukyung/project/Playground/giraffe/public) 을 `.vercel/output/static/giraffe` 로 복사
- [`giraffe/src/`](/Users/leeyukyung/project/Playground/giraffe/src) 을 `.vercel/output/static/giraffe/src` 로 복사
- [`minecraft/public/`](/Users/leeyukyung/project/Playground/minecraft/public) 을 `.vercel/output/static/minecraft` 로 복사
- `/snake`, `/cards`, `/giraffe`, `/minecraft` 요청이 각 앱 `index.html` 로 가도록 Vercel용 `config.json` 생성

즉, Git에는 중복된 `public/snake` 소스를 두지 않고, 배포할 때만 필요한 정적 산출물을 만들어 줍니다.

## 권장 구조

```text
Playground/
  README.md
  public/
  scripts/
  snake/
  cards/
  giraffe/
  minecraft/
  project-b/
  project-c/
```
