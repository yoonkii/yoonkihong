# YOONKI WORLD — Handoff Doc

> 마지막 업데이트: 2026-07-10. yoonkihong.com 리빌드 프로젝트의 전체 인수인계 문서.
> 대상: 다음 작업 세션(사람 또는 AI 에이전트). 이 문서 하나로 프로젝트 전체 맥락을 복원할 수 있어야 함.

---

## 1. 프로젝트 개요

- **사이트**: yoonkihong.com (GitHub Pages, `CNAME` 파일로 커스텀 도메인 연결)
- **저장소**: github.com/yoonkii/yoonkihong · 로컬: `/Users/yoonki/yoonkihong.com`
- **정체**: 쿼터뷰 3D 복셀 포트폴리오 게임 **"YOONKI WORLD"**. 방문자가 캐릭터를 조작해 섬을 탐험하며 포켓몬 만나듯 포트폴리오 프로젝트를 "인카운터"함
- **비주얼 목표**: 포켓몬 포코피아(2026, Switch 2)의 코지 토이 디오라마 룩 + bruno-simon.com의 인터랙티브 재미
- **기술 원칙**: 빌드 스텝 없음, 프레임워크 없음. Three.js는 pinned CDN importmap(`three@0.180.0`, jsdelivr). 나머지는 바닐라 ES 모듈
- **폰트**: Geist Sans (사용자 명시 요청 — 사이트 전역, 게임 UI 포함)

## 2. 현재 상태 (2026-07-10)

- ✅ 3D 버전 완성, 최종 스모크 테스트 9/9 통과, 콘솔 에러 0
- ✅ 2026-07-10 퍼블리시 푸시: **GUNBALL 추가로 product 6종**, 플레이어/NPC가
  리깅+애니메이션 GLB로 교체(§5), 맵이 허브-스포크 마을로 재구성(분수 광장
  중심 + 2건물 지구 3곳 + 남쪽 nursery + SE Demo Lab — `const.js` RAW_MAP 주석
  참조), 포켓몬식 선택지 메뉴(§6), 타이틀 화면의 떠다니는 2D 스프라이트 제거
  (라이브 디오라마가 히어로 이미지)
- ✅ 로컬 커밋 완료: `e57e26d`(2D GBA 버전 v1 — 보존용) → `6091cb2`(3D 버전) → `37cfca8`(gitignore) → `b18fbf4`(디자인 폴리시 r2)
- ⛔ **push/배포 전** — 사용자 확인 후 push하면 GitHub Pages로 자동 배포됨
- 배포 페이로드: 추적 파일 ~9.5MB + three.js CDN

## 3. 파일 구조

```
index.html              게임 진입점 (타이틀 = 라이브 디오라마, importmap, HUD/다이얼로그 DOM)
classic.html            채용담당자용 심플 뷰 (Geist Sans, projects.js에서 렌더링,
                        Products / Demos & Experiments / Coming soon 그룹핑)
data/projects.js        ★ 단일 소스 오브 트루스 — 게임 맵과 classic 뷰 둘 다 이걸 읽음
scripts/game3d.js       오케스트레이터 (부팅, 품질 티어, 상태머신, 2단계 GLB 프리로드
                        목록 GLB_CRITICAL/GLB_STREAM, __yw3 디버그 훅)
scripts/game3d/         const.js(맵·팔레트·상수·ASSET_V), ground.js(지형·물), sky.js(하늘·구름),
                        world.js(건물·나무·소품·충돌·Demo Lab), actors.js(플레이어·NPC·크리처·알),
                        physics.js(장난감 물리), glbassets.js(GLB 로더+정규화+폴백),
                        audio.js(BGM 크로스페이드+SFX), ui.js(다이얼로그·인카운터·HUD)
scripts/voxel/          복셀 엔진 (voxel.js 메시 빌더, rig.js 표준 라이팅 리그, models/*.js)
                        → GLB 로드 실패 시 자동 폴백으로 여전히 사용됨. 삭제 금지
assets/3d/*.glb         Meshy 생성 3D 에셋 14종 (아래 §5)
assets/3d/concepts/     컨셉 아트 (gitignored — 재생성 참조용, 배포 안 됨)
audio/                  overworld.mp3, encounter.mp3, sfx/ 6종, manifest.json
images/game/            2D 픽셀아트 (classic 뷰 아이콘 + 폴백용으로 유지)
docs/ART_BIBLE.md       아트 디렉션 "EMBER ISLE — Golden Hour Edition" 수치 스펙
docs/VISUAL_PLAYBOOK.md ★ 포코피아 팔레트/라이팅/포스트체인/품질티어 정확 수치 — 비주얼 작업 전 필독
docs/VOXEL_FORMAT.md    복셀 모델 포맷 계약
docs/GLB_PIPELINE.md    ★ GLB 네이밍/방향/높이/용량 계약 + 캐시버스팅(ASSET_V) 절차
viewer.html             복셀 모델 턴테이블 뷰어 (?model=이름)
glbviewer.html          GLB 턴테이블 뷰어 (게임과 동일 라이팅) — 스킨드 메시 불가
rigviewer.html          리깅 GLB 뷰어 (?model=player&clip=walk|idle — 직접 GLTFLoader)
.env.local              API 키 (gitignored, 공개 저장소 — 절대 커밋/출력 금지)
```

## 4. 프로젝트 데이터 관리 (가장 흔한 유지보수 작업)

`data/projects.js`의 `window.PROJECTS` 배열이 전부. 필드: `id, name, tagline, desc, url, kind('creature'|'egg'), category('product'|'demo'), sprite, building`.

- **새 프로젝트 추가**: 객체 하나 추가 → 게임 맵 슬롯 자동 배정 + classic 카드 자동 생성
- **알 부화** (Suno/Substack/X 링크 도착 시): 해당 항목에 `url` 채우고 `kind:'creature'`로 변경. 전용 GLB를 원하면 §5 파이프라인으로 생성 후 `GLB_STREAM`(scripts/game3d.js — 크리처는 스트리밍 단계, 타이틀에 크게 보이는 건물/소품만 `GLB_CRITICAL`)에 이름 추가
- **데모 추가**: `category:'demo'`로 추가 → Demo Lab 존 스톨에 자동 등장 (슬롯 5개 사전 확보, 없으면 공사중 표지판)
- **현재 상태**: product 6종(macrodoc, mathstreet, mathwings, funnify, lasthand, gunball) + egg 3종(suno, substack, x). 데모 0종

## 5. 에셋 파이프라인

### GLB (Meshy image-to-3D) — `docs/GLB_PIPELINE.md` 필독
1. OpenAI `gpt-image-1`로 컨셉샷 (단일 피사체, 3/4뷰, 밝은 회색 무배경, 포코피아 토이 렌더) → `assets/3d/concepts/`
2. `POST https://api.meshy.ai/openapi/v1/image-to-3d` (`enable_pbr:false, target_polycount 10-15k, symmetry auto`) → 15-20초 간격 폴링 (에셋당 2-8분, 여러 개 동시 폴링)
3. `model_urls.glb` 다운로드 → `gltfpack -c` 압축 (또는 `npx @gltf-transform/cli optimize --texture-size 1024`)
4. `glbviewer.html?model=이름`으로 검증 → `GLB_CRITICAL`(타이틀 디오라마에 크게 보이는 건물/소품/플레이어) 또는 `GLB_STREAM`(크리처/알/NPC — PRESS START 게이트 안 함, 복셀→GLB 핫스왑)에 추가 → **`ASSET_V` 범프** (scripts/game3d/const.js — 캐시버스팅, index.html+classic.html `?v=` 토큰 포함)
- 용량 예산: 크리처/건물 ≤3MB, 반복 소품(나무) ≤1.2MB
- **폴백 설계**: GLB 없거나 파싱 실패 → 해당 에셋만 복셀 모델 사용, 게임은 무조건 돌아감
- 현재 라이브 20종: 크리처 7(macrodoc, mathstreet, mathwings, funnify, lasthand, gunball, goldie) + 건물 7(bld_ 접두, bld_gunball 포함) + 캐릭터 2(player, npc_yoonki) + tree_a/b, fountain, egg
- About 하우스 문 = 실내 미니씬 진입 (scripts/game3d/interior.js — NAVER/LINE/GOOGLE 복셀 로고 명판 + 대화)

### 캐릭터 (리깅 GLB — 2026-07-10 신규, 같은 날 player 재수출)
- `player.glb` / `npc_yoonki.glb`: 스킨드 26본 스켈레톤 + 클립 2종(`walk` 1.0s 루프, `idle` 8.0s 숨쉬기/둘러보기). 파이프라인: gpt-image 컨셉 → Meshy image-to-3d → **Meshy Auto-Rigging API**(`POST /openapi/v1/rigging`) → Animation API(idle = action 338) → 클립 병합/개명 → PBR 스트립 → gltfpack `-cc -kn`
- **player 룩 (2026-07-10 재수출, gpt-image-2 컨셉)**: 라이트 헤더 그레이 **파타고니아풍 플리스**(퍼지 텍스처 + 진한 센터 집업 + 스탠드업 카라 + 왼쪽 가슴 마운틴/선셋 패치), 네이비 진, 백팩·안경·레이어드 큐브 헤어는 유지. 648KB / 13,554 tris. 이전 파일은 `assets/3d/player_old.glb`(gitignored) 백업
- 로더(`glbassets.js`)가 스킨드 메시를 감지해 **SkeletonUtils.clone** 사용 + `frustumCulled=false`. Meshy 리타겟은 정면이 +Z 계약을 안 지키므로 `YAW_OFFSET` 테이블로 복원 — **오프셋은 리타겟마다 다름(재수출 시 반드시 인게임 재측정)**: 현재 player **0.2 rad**, npc_yoonki **0.35 rad** (둘 다 2026-07-10 헤드드 브라우저에서 화면 아래로 걷기 → 카메라 정면 기준 실측)
- `actors.js`: THREE.AnimationMixer로 idle↔walk 0.15s 크로스페이드, walk timeScale = 속도/2.2 동기화, 발소리/먼지는 클립 위상에서 파생. 새 walk 클립 보폭 실측 0.575 wu p2p(구 0.38, 동일 1.0s/2보 루프) → 2.2 유지 시 최대속도 케이던스(~4.7보/s)는 그대로에 풋슬라이드는 65%→48%로 개선되어 divisor 변경 없음. 스킨드 경로에서는 스쿼시-스트레치 OFF(클립이 바디랭귀지 담당). GLB 실패 시 기존 복셀 리그 폴백 그대로
- 검증 하니스: **`rigviewer.html?model=player&clip=walk|idle`** (게임 로더는 스킨드 미리보기 불가 — 직접 GLTFLoader + 동일 라이팅). 주의: rigviewer 정면 각도로 YAW_OFFSET을 유추하지 말 것 — 인게임 측정과 달랐던 전례 있음(2026-07-10). 추가 클립 생성용 Meshy rig task ID는 이 문서 히스토리/워크플로 리포트 참조

### 오디오 (ElevenLabs)
- **BGM (2026-07-10 재생성)**: `/v1/music`은 여전히 401(`music_generation` 권한 없음, 당일 재시도 확인) → `/v1/sound-generation`(eleven_text_to_sound_v2, loop:true) 30s 클립을 샘플 단위로 루프 확장. overworld 90s/129BPM/RMS −19.3dB, encounter 60s/161BPM/RMS −17.0dB — 이전 대비 확연히 크고 드라이빙한 톤. 루프 심 무클릭(인게임 시크 테스트로 88→92s 랩 확인). 상세는 `audio/manifest.json` bgm 블록. 권한 추가되면 `/v1/music`으로 재생성
- **SFX**: `audio/sfx/` 6종 (footstep_grass, bump, pop, encounter_sting, blip, fireworks) — audio.js에서 연결, 없으면 WebAudio 합성 폴백

### API 키 (`.env.local`)
`OPENAI_API_KEY`, `ELEVEN_LABS_KEY`, `MESHY_API_KEY` — 로드: `set -a; source .env.local; set +a`. 값 출력·커밋 절대 금지 (공개 저장소).

## 6. 게임 기능 명세 (회귀 테스트 체크리스트로 사용)

- 이동: WASD/방향키, 관성(가감속), 카메라 기준 8방향, 벽 슬라이딩. 모바일: 가상 조이스틱 + A/B
- 인터랙션: 근접 시 "!" 마커, **Space**/Z/Enter 발동, X/Esc 닫기
- **선택지 메뉴 (포켓몬 배틀 메뉴)**: 줄글 대신 2열 그리드 선택지 — ui.js `createChoiceMenu`가 다이얼로그(#dlg-menu)·인카운터(#enc-menu) 공용. 방향키/WASD로 ▶ 커서 이동(좌우 순환, 상하 행 이동), Space/Z/Enter 확정, X/Esc는 한 단계 백아웃(토픽/DETAILS 페이지 → 메뉴, 메뉴 → 닫기/RUN). 터치는 버튼 직접 탭(44px+ 타깃, 375px에서 검증). 메뉴가 (재)등장할 때마다 275ms 연타 가드 재장전 + 가드 통과 후에만 포커스 부여(앵커 네이티브 Enter 우회 방지). 커서 위치는 토픽에서 돌아와도 유지
- 인카운터: 포켓몬식 투샷 — 카메라는 월드 방위각 45° 고정(회전 없음), 한 번의 팬+줌 후 정지(10초에 걸친 1.5% 푸시인만 허용). 아이리스 암전 중 플레이어를 "트레이너 슬롯"(화면 좌하단, 충돌 검사·미러 폴백 포함)으로 컷, RUN 시 페이드 아래 복원. 피사체 높이로 줌 산출, 울타리/수관 가림 시 앙각 35→48→58° 에스컬레이션, 근처 크리처+GOLDIE는 암전 중 숨김. 세로 모바일은 프레임을 위로 올려 패널 위에 투샷 유지. **플로우**: 짧은 인트로("A wild X appeared!" + 태그라인 한 줄) 타자기 → [DETAILS][VISIT]/[RUN] 그리드. DETAILS = 풀 설명을 문장 단위 페이지(≤200자, `paginate`)로 타자기 → 마지막 페이지에서 메뉴 복귀(인트로 즉시 복원, 재타이핑 없음) — DETAILS↔메뉴 무한 루프 가능. VISIT = 진짜 앵커 새 탭 + 그때만 방문 카운트(DETAILS는 카운트 안 함), 인카운터는 열려 있음. RUN/X = 종료(탭·키보드 모두 onRun 콜백 경유 — 구버전의 "RUN 탭 무반응" 버그 수정됨). 알 = incubating 한 줄 + [DETAILS][BACK]. url 없는 non-egg = 파란 COMING SOON 태그 + [DETAILS][RUN], "not ready" 문구는 DETAILS 마지막 페이지
- NPC YOONKI: 인사 한 줄 → [THE STORY][CAREER]/[LINKS][BYE]. THE STORY = 빌더 정체성 4페이지, CAREER = NAVER→LINE→GOOGLE 요약 2페이지(집 명판 안내 포함), LINKS = 표지판식 링크 노출(메뉴 유지), BYE = 닫기. 각 토픽 종료 시 메뉴로 복귀
- 표지판 = 인구 한 줄 + [LINKS][BACK], Demo Lab 표지판/공사중 = 한 줄 + [MORE][BACK], 집 내부 명판(NAVER/LINE/GOOGLE) = 명판 한 줄 + [MORE][BACK] (interior.js `line`/`more` 필드). 분수·GOLDIE는 기존 선형 다이얼로그 유지 (`ui.openDialog`), 나머지는 `ui.openMenuDialog(name, {intro, menu})` 스크립트
- 물리 장난감: 볼링핀 6개·상자·비치볼 (커스텀 임펄스)
- 인트로: 타이틀 = 라이브 디오라마 → PRESS START → 카메라 스윕(입력 시 스킵, reduced-motion 시 생략)
- 불꽃놀이: 라이브 제품 전부 방문 시 (localStorage, HUD 카운터 0/6 — data/projects.js에서 파생, 로스터 크기로 축하 플래그 버전링)
- 사운드: BGM 크로스페이드(월드↔인카운터), 뮤트 localStorage 저장, 뮤트가 BGM+SFX 모두 제어
- 품질 티어: HIGH/MID/LOW 자동 감지 + 첫 120프레임 실측 적응 (LOW = EffectComposer 완전 생략)
- 안전망: WebGL 불가 → classic.html 안내 카드. 인카운터 연타 가드 275ms

## 7. 검증 방법 (환경 특이사항 ★중요)

- **gstack 헤드리스 브라우저(`~/.claude/skills/gstack/browse/dist/browse`)의 WebGL이 죽어 있음** (SwiftShader 실패, 재시작 무효). 비주얼 검증에 쓰지 말 것. 콘솔/네트워크/DOM 체크는 유효
- **Claude Preview 패널**: 진짜 Chromium이라 WebGL 정상. 단, 탭이 hidden이면 rAF 스로틀 → 스크린샷 호출이 프레임을 강제 펌핑하므로 상태 폴링과 병행하면 테스트 가능
- 로컬 서버: `python3 -m http.server 8000` (8898은 프리뷰 패널이 점유할 수 있음)
- 디버그 훅: `window.__yw3` (state(), player, creatures, nearestInteractable(), renderer.info 등)
- 카메라 기준 이동이라 스크립트로 걷기 제어 시 월드축→화면축 변환 필요: `aRight = dx·0.707 − dz·0.707`, `aUp = −dx·0.707 − dz·0.707`

## 8. 남은 작업 (우선순위순)

1. **사용자 플레이 테스트 → push/배포** (사용자 확인 필수 — 공개 배포임)
2. **미학 마무리**: 자동 심사 6.5/10에서 정체 (단, 헤드리스 WebGL 고장으로 일부 추정 채점이라 신뢰도 낮음. 실제 렌더는 그보다 좋음). 사용자가 짚는 부분만 정밀 수정 권장. 수치는 `docs/VISUAL_PLAYBOOK.md` 기준
3. ElevenLabs `music_generation` 권한 추가 시 BGM 재생성
4. Suno/Substack/X 링크 도착 시 알 부화 (§4)
5. 데모 목록 도착 시 Demo Lab 채우기 (§4)
6. `images/profile.jpg` 7.8MB → 1200px/200KB 이하로 재추출 (classic 뷰에서 사용)
7. ~~(선택) 플레이어/NPC 캐릭터도 Meshy GLB로 교체~~ — ✅ 완료 (2026-07-10, 리깅+클립 GLB. §5 캐릭터 항목 참조)

## 9. 의사결정 로그 (왜 이렇게 됐나)

| 결정 | 이유 |
|---|---|
| 에디토리얼 리디자인("Ink & Paper") 폐기 | 사용자: "별로야. 더 인터랙티브한 재밌는 웹사이트" |
| 포켓몬식 인카운터 컨셉 | 사용자 아이디어 — 포트폴리오를 야생 포켓몬처럼 만남 |
| 2D GBA → 3D 복셀 전환 | 사용자 요청 (three.js, "업계 최고 수준") — 2D는 `e57e26d`에 보존 |
| 그리드 걷기 → 자유 이동+관성 | bruno-simon.com 레퍼런스, 사용자 선택 |
| 포코피아 비주얼 타깃 | 사용자 레퍼런스. 리서치 기반 수치가 VISUAL_PLAYBOOK.md에 |
| 복셀 지형 + Meshy GLB 히어로 에셋 하이브리드 | GLB로 퀄리티 업, 복셀 폴백으로 안정성 확보 |
| game/classic 이중 구조 | 채용담당자·링크드인 방문자용 빠른 경로 확보 |
| 에그(알) 시스템 | 링크 미정 항목을 "부화 중"으로 온테마 표현 |

## 10. 작업 방식 (사용자 선호)

- **큰 작업은 Workflow(멀티에이전트 오케스트레이션) 사용** — 사용자 명시 요청. 세션의 workflow 스크립트: `~/.claude/projects/-Users-yoonki-yoonkihong-com/.../workflows/scripts/` (resume 시 완료 에이전트 캐시 복원됨)
- 취향: 폴리시·미니멀보다 **플레이풀·인터랙티브**. "낮엔 Google GTM, 밤엔 빌더" 정체성 중시
- push 등 공개 배포는 반드시 사전 확인. 로컬 커밋으로 보존은 OK였음
- 세션 한도로 workflow가 끊기면 리셋 후 `resumeFromRunId`로 재개
