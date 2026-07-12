# YOONKI WORLD — Handoff Doc

> 마지막 업데이트: 2026-07-12 (**classic.html v2 r26** — 모바일 nav 레일, 오토플레이 주춤 수정, 락인 앵커 단축, 카드 진짜 라운드 코너+스택 섀도우. 게임 모드는 r5 상태 유지). yoonkihong.com 리빌드 프로젝트의 전체 인수인계 문서.
> 대상: 다음 작업 세션(사람 또는 AI 에이전트). 이 문서 하나로 프로젝트 전체 맥락을 복원할 수 있어야 함.
> **Classic v2 상세는 §6.5** — 히어로 필름/카드 시스템을 만질 거면 그 섹션의 "재렌더 계약"부터 읽을 것.

---

## 1. 프로젝트 개요

- **사이트**: yoonkihong.com (GitHub Pages, `CNAME` 파일로 커스텀 도메인 연결)
- **저장소**: github.com/yoonkii/yoonkihong · 로컬: `/Users/yoonki/yoonkihong.com`
- **정체**: 쿼터뷰 3D 복셀 포트폴리오 게임 **"YOONKI WORLD"**. 방문자가 캐릭터를 조작해 섬을 탐험하며 포켓몬 만나듯 포트폴리오 프로젝트를 "인카운터"함
- **비주얼 목표**: 포켓몬 포코피아(2026, Switch 2)의 코지 토이 디오라마 룩 + bruno-simon.com의 인터랙티브 재미
- **기술 원칙**: 빌드 스텝 없음, 프레임워크 없음. Three.js는 pinned CDN importmap(`three@0.180.0`, jsdelivr). 나머지는 바닐라 ES 모듈
- **폰트**: Geist Sans (사용자 명시 요청 — 사이트 전역, 게임 UI 포함)

## 2. 현재 상태 (2026-07-10) — ✅ LIVE 배포됨

- ✅ **https://yoonkihong.com 에 라이브** (GitHub Pages, `main` push = 자동 배포, 빌드 ~1분). 콘솔 에러 0
- ✅ 사용자가 "publish 모드" 선언 후 여러 차례 배포 완료. push 전 매번 시크릿/백업 유출 가드(`git ls-files | grep -iE '\.env|_old\.glb|concepts/'`) 확인 후 진행
- **최신 배포 상태 (r5, 2026-07-10)**:
  - product **7종**(macrodoc, mathstreet, mathwings, funnify, lasthand, gunball, **gomokulike**) + egg 3종(x 에그는 url 보유 = "HATCHING" 상태, VISIT 가능)
  - **테마 하우스 r5**: 실제 서비스 컨셉 반영해 6개 건물 리뉴얼 + 1개 신규 (모두 gpt-image-2→Meshy) — funnify=게임쇼 스튜디오, mathstreet=NYSE 신전+황금황소, mathwings=아르데코 나이트타워+금날개, macrodoc=세브란스 MDR 오피스(초록 카펫+CRT 인테리어), gunball=SF 글래스 아레나(네온 블루/오렌지), lasthand=지하 포커 덴(팔각 레드펠트), **gomokulike=기원 하노크**(동쪽 연못가 신규 지구, row18 스포크 연장)
  - **랜드마크**: `landmark_namsan`(N서울타워 GLB, 북쪽 바다의 **복셀 언덕 섬 위** — `namsan_hill`) + `landmark_goldengate`(**프로시저럴 복셀 현수교 12.5wu**, 서해안↔`sf_islet` 새 섬을 실제로 **연결** — 2026-07-11: 해안 평행 배치가 아무것도 잇지 않아 어색하다는 리포트로 재배치, sf_islet은 비어있는 미래 콘텐츠 자리) — 장식용, `const.js LANDMARKS`. 복셀 랜드마크는 static 월드 메시에 병합(로드 비용 0), namsan 타워 GLB만 GLB_STREAM→`world.addLandmark`
  - **건물 재생성 r2 (2026-07-11, 테마 강조)**: bld_lasthand=느와르 포커클럽(수트 네온·에이스 카드·지붕 포커칩), bld_funnify=**지붕 없는 야외** 게임쇼 세트(QUIZ TIME 스크린+포디움), bld_gunball=**오픈 보울** 미니 경기장(피치 노출, 의도적으로 낮음 h1.15), bld_mathwings=월스트리트 아르데코 티커 타워(mathstreet NYSE와 트윈). 새 TARGET_HEIGHTS/GLB_FOOTPRINT 반영. Meshy가 target_polycount를 무시하는 경우 있음 → `gltfpack -si`로 단순화(≤20k tris 확인)
  - **소셜 링크 노출 강화**: 타이틀 카드 필 버튼 3종(LinkedIn/Instagram/**X @yoonki1214**), classic 히어로 소셜 필, dlg-links·푸터에 X 추가
  - **E 키 상호작용** 추가 (Space/Z/Enter와 동일 — ui.js isActionKey + 타이틀 시작 + 힌트/헬프 문구)
  - **LINE 명판 수정**: hi-res 24×32 모델(voxelSize 0.0625)로 "LINE" 워드마크+버블, 명판 로고를 화면에서 가로지르던 북측 천장 빔 제거 (models/interior.js 주석 참조)
  - **로딩 최적화**: GLB_CRITICAL 12종 `<link rel="preload" as="fetch" crossorigin>` 프리로드 힌트 (index.html — ASSET_V 범프 시 토큰 함께 갱신 필수!)
  - 플레이어/NPC = 리깅+애니메이션 GLB, 플레이어는 **파타고니아풍 플리스**(§5)
  - 맵 = 허브-스포크 마을 + 동쪽 연못가 gomokulike 지구 (`const.js` RAW_MAP 주석)
  - 포켓몬식 선택지 메뉴(§6), 16비트 BGM(§5 — **/v1/music은 유료 플랜 필요, 402**)
  - 집 내부 커리어 룸 = 실제 커리어 내용 — interior.js 명판 + NPC CAREER + classic.html Experience 3곳 동기화
  - OG/트위터 셰어 카드, PostHog+Sentry 애널리틱스(§11)
- 커밋 히스토리: `e57e26d`(2D v1 보존) → `6091cb2`(3D) → `b18fbf4`(폴리시 r2) → `6b2f90b`(퍼블리시 r3: GUNBALL/맵/메뉴) → `3eece04`(애널리틱스) → `6e596a4`(폴리시 r4: 파타고니아/BGM/커리어) → … → `cdbe584`(classic v2 머지) → `fbcf332`(v2 r25 오토플레이) — v2 이터레이션 전체는 `git log --oneline --grep="v2 r"` 참조
- **2026-07-12: classic.html이 v2로 완전 교체됨** (구 classic은 git 히스토리에만 존재). 상세 §6.5
- 배포 페이로드: 추적 파일 ~9.5MB + **classic v2 에셋 ~31MB**(히어로 프레임 30MB — 단, 프로그레시브 로딩 + 모바일 룽 분리) + three.js CDN

## 3. 파일 구조

```
index.html              게임 진입점 (타이틀 = 라이브 디오라마, importmap, HUD/다이얼로그 DOM)
classic.html            ★ v2 (2026-07-12~): 스크롤 스토리 포트폴리오 — §6.5 참조
scripts/v2/             main.js(히어로 필름+비트+오토플레이), cards.js(카드 팬→스택 쇼케이스),
                        work.js(NAVER/LINE/Google 3D 로고 타일)
styles/v2.css           classic v2 전용 스타일 (팔레트: --ink/--paper/--accent 인터내셔널 오렌지)
assets/v2/hero2/        히어로 필름 프레임 s000-187.webp(1920px, 21MB) + m/(672x1080 모바일 룽 8.2MB)
                        + idle.mp4(정↔역 팔린드롬 16s) + first/poster.webp
assets/videos/          ⚠️ gitignored — 히어로 원본 영상 sequence0-4.mp4 (재렌더 시 필요, 로컬에만 존재)
images/v2/art/          카드 일러스트 7종 (gpt-image-2, §6.5 재생성 레시피)
images/v2/shots/        라이브 제품 스크린샷 7종 (headless Chrome 캡처, 960px webp)
data/projects.js        ★ 단일 소스 오브 트루스 — 게임 맵과 classic 뷰 둘 다 이걸 읽음
scripts/game3d.js       오케스트레이터 (부팅, 품질 티어, 상태머신, 2단계 GLB 프리로드
                        목록 GLB_CRITICAL/GLB_STREAM, __yw3 디버그 훅)
scripts/game3d/         const.js(맵·팔레트·상수·ASSET_V), ground.js(지형·물), sky.js(하늘·구름),
                        world.js(건물·나무·소품·충돌·Demo Lab), actors.js(플레이어·NPC·크리처·알),
                        physics.js(장난감 물리), glbassets.js(GLB 로더+정규화+폴백),
                        audio.js(BGM 크로스페이드+SFX), ui.js(다이얼로그·인카운터·HUD)
scripts/voxel/          복셀 엔진 (voxel.js 메시 빌더, rig.js 표준 라이팅 리그, models/*.js)
                        → GLB 로드 실패 시 자동 폴백으로 여전히 사용됨. 삭제 금지
assets/3d/*.glb         Meshy 생성 3D 에셋 20종 (아래 §5) — *_old.glb 백업은 gitignore
assets/3d/concepts/     컨셉 아트 (gitignored — 재생성 참조용, 배포 안 됨)
scripts/analytics.js    PostHog + Sentry 부트스트랩 (prod 전용, window.ywTrack 래퍼 — §11)
audio/                  overworld.mp3, encounter.mp3, sfx/ 6종, manifest.json
images/og.jpg           OG/트위터 셰어 카드 1200x630 (양 페이지 head에서 참조)
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
- **현재 상태**: product 7종(macrodoc, mathstreet, mathwings, funnify, lasthand, gunball, gomokulike) + egg 3종(suno, substack, x — x는 url 보유로 "HATCHING", ui.js가 egg+url이면 VISIT 메뉴 제공). 데모 0종

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
- **idle 팔 포즈 최종 수정 (2026-07-11)**: Idle_3(243)도 손이 몸 뒤로 들어가 대부분 각도에서 뒷짐으로 읽힘(사용자 2회 리포트 — rigviewer는 반드시 **여러 yaw에서** 확인할 것). 최종 해법 = `fixarms.mjs`(scratchpad/ktx2, 리포엔 미보관 — 스펙: walk 클립의 팔체인 본별 평균 쿼터니언으로 idle 팔 트랙을 리베이스 q_new = qWalkAvg·qIdleAvg⁻¹·qIdle(t), 8트랙, 이후 gltfpack -cc -kn). walk의 팔은 확실히 옆에 보이므로 그 평균이 "팔 내린 자세"의 신뢰 기준. player+npc 둘 다 적용
- **idle 클립 교체 (2026-07-10 저녁)**: 기존 idle(액션 338 "Short Breathe and Look Around")은 **뒷짐 포즈**라 사용자 리포트로 교체 — 현재 idle = **액션 243 "Idle_3"** (10s, 팔 자연스럽게 옆, 미세 호흡). player rig task `019f4e3e-cb45-7511-acdf-30ff11489ad3`, npc rig task `019f4cc2-baa7-788f-8ae2-cc7030958728` (나머지 019f4cc2-a1df는 구 r3 플레이어). 교체 기법: 새 애니만 Meshy로 뽑고 gltf-transform으로 기존 GLB의 idle 채널만 이식(같은 rig = 같은 본 이름) 후 gltfpack -cc -kn 재압축 — 전체 캐릭터 재수출 불필요, YAW_OFFSET 재측정 불필요(rig 동일). walk 클립 무변경
- 검증 하니스: **`rigviewer.html?model=player&clip=walk|idle`** (게임 로더는 스킨드 미리보기 불가 — 직접 GLTFLoader + 동일 라이팅). 주의: rigviewer 정면 각도로 YAW_OFFSET을 유추하지 말 것 — 인게임 측정과 달랐던 전례 있음(2026-07-10). 추가 클립 생성용 Meshy rig task ID는 이 문서 히스토리/워크플로 리포트 참조

### 텍스처 압축 + 폴리시 팩 (2026-07-10 밤)
- **전 GLB 텍스처 = ETC1S KTX2** (`KHR_texture_basisu`): JPEG→KTX2로 세트 11.9→7.7MB(−36%), GPU 텍스처 메모리 ~−80%, 밉체인 신규 확보(원거리 셰이딩 개선). 인코딩: `scripts/toktx2.mjs` + `basisu` CLI(`brew install basis_universal`), q224 — 절차는 GLB_PIPELINE.md §4.1. 런타임: glbassets.js의 KTX2Loader가 `provideRenderer(renderer)` 핸드셰이크까지 로드를 지연(프리로드가 렌더러보다 먼저 시작되는 레이스 해결). 팔레트 게이트는 `basisu -unpack`으로 KTX2 자동 디코드(단, unpack PNG는 CWD에 떨어지므로 temp cwd에서 실행)
- **폴리시 팩**: ① 해안 전체 거품 링(ground.js, 오프쇼어 알파 페이드, 타일별 폭 랜덤) ② 건물 컨택트 섀도우 패드(world.js buildingPad — 태양 그림자는 SE로만 지므로 베이스 접지감 보강) ③ HIGH 티어 그림자맵 2048→4096(정적 1회 베이크라 VRAM 비용뿐) ④ 구름 그림자는 기존 sky.js에 이미 존재

### 오디오 (ElevenLabs)
- **BGM (2026-07-10 재생성)**: `/v1/music`은 여전히 401(`music_generation` 권한 없음, 당일 재시도 확인) → `/v1/sound-generation`(eleven_text_to_sound_v2, loop:true) 30s 클립을 샘플 단위로 루프 확장. overworld 90s/129BPM/RMS −19.3dB, encounter 60s/161BPM/RMS −17.0dB — 이전 대비 확연히 크고 드라이빙한 톤. 루프 심 무클릭(인게임 시크 테스트로 88→92s 랩 확인). 상세는 `audio/manifest.json` bgm 블록
- **⚠️ /v1/music 재시도 결과 (2026-07-10 저녁)**: 권한 문제(401)는 해결됐으나 이제 **402 `paid_plan_required`** — Music API는 ElevenLabs **유료 플랜 전용**. 플랜 업그레이드 후 재생성할 것 (sound-generation 폴백물 유지 중)
- **SFX**: `audio/sfx/` 6종 (footstep_grass, bump, pop, encounter_sting, blip, fireworks) — audio.js에서 연결, 없으면 WebAudio 합성 폴백

### API 키 (`.env.local`)
`OPENAI_API_KEY`, `ELEVEN_LABS_KEY`, `MESHY_API_KEY` — 로드: `set -a; source .env.local; set +a`. 값 출력·커밋 절대 금지 (공개 저장소).

## 6. 게임 기능 명세 (회귀 테스트 체크리스트로 사용)

- 이동: WASD/방향키, 관성(가감속), 카메라 기준 8방향, 벽 슬라이딩. 모바일: 가상 조이스틱 + A/B
- 인터랙션: 근접 시 "!" 마커, **Space**/**E**/Z/Enter 발동, X/Esc 닫기
- **선택지 메뉴 (포켓몬 배틀 메뉴)**: 줄글 대신 2열 그리드 선택지 — ui.js `createChoiceMenu`가 다이얼로그(#dlg-menu)·인카운터(#enc-menu) 공용. 방향키/WASD로 ▶ 커서 이동(좌우 순환, 상하 행 이동), Space/Z/Enter 확정, X/Esc는 한 단계 백아웃(토픽/DETAILS 페이지 → 메뉴, 메뉴 → 닫기/RUN). 터치는 버튼 직접 탭(44px+ 타깃, 375px에서 검증). 메뉴가 (재)등장할 때마다 275ms 연타 가드 재장전 + 가드 통과 후에만 포커스 부여(앵커 네이티브 Enter 우회 방지). 커서 위치는 토픽에서 돌아와도 유지
- 인카운터: 포켓몬식 투샷 — 시작·종료 방위각은 월드 45° 고정이지만, 팬+줌 중간에 **±12° 시네마틱 호 스윙**(camera.js `azBulge`, sin(π·k)로 부풀었다 45°에 정확히 착지 — 2026-07-11 복원: r4의 완전 고정 컷이 "팬이 사라졌다"로 읽힘. r2의 200° 스핀 혼란은 그대로 방지) 후 정지(10초에 걸친 1.5% 푸시인만 허용). RUN 복귀도 +7° 아크아웃. 아이리스 암전 중 플레이어를 "트레이너 슬롯"(화면 좌하단, 충돌 검사·미러 폴백 포함)으로 컷, RUN 시 페이드 아래 복원. 피사체 높이로 줌 산출, 울타리/수관 가림 시 앙각 35→48→58° 에스컬레이션, 근처 크리처+GOLDIE는 암전 중 숨김. 세로 모바일은 프레임을 위로 올려 패널 위에 투샷 유지. **플로우**: 짧은 인트로("A wild X appeared!" + 태그라인 한 줄) 타자기 → [DETAILS][VISIT]/[RUN] 그리드. DETAILS = 풀 설명을 문장 단위 페이지(≤200자, `paginate`)로 타자기 → 마지막 페이지에서 메뉴 복귀(인트로 즉시 복원, 재타이핑 없음) — DETAILS↔메뉴 무한 루프 가능. VISIT = 진짜 앵커 새 탭 + 그때만 방문 카운트(DETAILS는 카운트 안 함), 인카운터는 열려 있음. RUN/X = 종료(탭·키보드 모두 onRun 콜백 경유 — 구버전의 "RUN 탭 무반응" 버그 수정됨). 알 = incubating 한 줄 + [DETAILS][BACK]. url 없는 non-egg = 파란 COMING SOON 태그 + [DETAILS][RUN], "not ready" 문구는 DETAILS 마지막 페이지
- NPC YOONKI: 인사 한 줄 → [THE STORY][CAREER]/[LINKS][BYE]. THE STORY = 빌더 정체성 4페이지, CAREER = NAVER→LINE→GOOGLE 요약 2페이지(집 명판 안내 포함), LINKS = 표지판식 링크 노출(메뉴 유지), BYE = 닫기. 각 토픽 종료 시 메뉴로 복귀
- 표지판 = 인구 한 줄 + [LINKS][BACK], Demo Lab 표지판/공사중 = 한 줄 + [MORE][BACK], 집 내부 명판(NAVER/LINE/GOOGLE) = 명판 한 줄 + [MORE][BACK] (interior.js `line`/`more` 필드). 분수·GOLDIE는 기존 선형 다이얼로그 유지 (`ui.openDialog`), 나머지는 `ui.openMenuDialog(name, {intro, menu})` 스크립트
- 물리 장난감: 볼링핀 6개·상자·비치볼 (커스텀 임펄스)
- 인트로: 타이틀 = 라이브 디오라마 → PRESS START → 카메라 스윕(입력 시 스킵, reduced-motion 시 생략). **매번 재생** — r4의 sessionStorage 재방문 스킵은 2026-07-11 제거(오너가 스윕 실종으로 인지). 참고: 사용자 기기에 OS 'Reduce Motion'이 켜져 있으면 스윕·인카운터 팬 모두 스냅됨
- 불꽃놀이: 라이브 제품 전부 방문 시 (localStorage, HUD 카운터 0/6 — data/projects.js에서 파생, 로스터 크기로 축하 플래그 버전링)
- 사운드: BGM 크로스페이드(월드↔인카운터), 뮤트 localStorage 저장, 뮤트가 BGM+SFX 모두 제어
- 품질 티어: HIGH/MID/LOW 자동 감지 + 첫 120프레임 실측 적응 (LOW = EffectComposer 완전 생략)
- 안전망: WebGL 불가 → classic.html 안내 카드. 인카운터 연타 가드 275ms

## 6.5 Classic v2 (classic.html) — 스크롤 스토리 페이지 (2026-07-12 프로덕션)

25 라운드의 사용자 피드백 이터레이션으로 완성 (`git log --grep="v2 r"`). 게임과 동일한 노빌드 원칙, three.js는 같은 importmap.

### 구조 (스크롤 순서대로)
1. **히어로 (main.js)** — 아이들 비디오 루프 → 스크롤 스크럽 필름 → 헤드라인 락인 → 타이핑 루프
2. **Work (work.js)** — NAVER/LINE/Google 캔버스 텍스처 3D 로고 타일 + 커리어 카드
3. **About** — 워드 리빌 문단
4. **Products (cards.js)** — 9장 카드 팬 → sticky 스택 쇼케이스 (카드별 ~55vh 스크롤)
5. 푸터 (funnify 크리처 피크 이스터에그 → 게임으로)

### 히어로 필름 시스템 (main.js) — 만지기 전에 반드시 이해할 것
- **아이들**: `#hero-idle` 비디오(idle.mp4 = sequence0을 정재생+역재생 concat한 16.08s 팔린드롬, 시임리스 루프). 스크롤 시작 시 **손 흔드는 중이면**(WAVES 창) 손 내릴 때까지 배속 재생 후 캔버스로 크로스페이드(점프컷 방지). `WAVES = [[3.2,6.85],[9.23,12.88]]` — 팔린드롬이라 2개 창
- **스크럽**: 188프레임(s000-187) = sequence1-4에서 3프레임 간격 추출. `SEGS` 가중치 테이블이 필름 타임라인의 단일 소스: play/dwell 교차 (씬 완성 시 정지 구간 = 사용자가 "완성된 장면을 보고 넘어가게"). `easeFilm` = 0.55 linear + 0.45 smoothstep 블렌드. **r26**: seq4를 [139,150,8]+[150,187,40]로 분할 — 소스 프레임 143-150이 거의 동일해서 고개 돌리는 초입을 천천히 지나가면 "주춤"으로 읽힘 → 빠르게 통과
- **텍스트 비트**: `WINDOWS`는 **필름-t 공간**(스크럽 이징과 무관하게 그림에 고정): 인사(로드 시부터)/SEOUL(서울 씬)/SAN FRANCISCO(SF 씬). 워드 캐스케이드 마스크-라이즈, 하단 배치, 시네마틱 스크림
- **락인**: p 0.6부터 헤드라인 ("GTM & product at **Google** by day / Builder of small, *playful* things by night") — 여기부터 **오토플레이**: `AUTO_FROM=0.55, AUTO_RATE=0.085/s` — 스크롤 없이도 남은 필름(앉아서 타이핑까지)이 ~4s 자동 재생. 스크롤=빨리감기, 되감기 없음, `AUTO_RESET=0.5` 아래로 올라가야 리셋(**r26 히스테리시스** — 경계에서 스크롤이 오르내리면 고개 돌리는 장면이 재재생되던 문제). 오토플레이는 dwell을 **skipDwell()로 건너뜀**(정지 프레임은 스크럽용 — 자동 재생 중엔 히치로 읽힘). **r26 앵커 단축**: SCRUB_END 0.82→0.9 + 히어로 높이 1450→1320vh(모바일 1050→955vh) — 필름 스크롤 길이(~1188vh)는 동일, 필름 완주 후 앵커 꼬리만 260→130vh로 절반. hp-tick(classic.html)도 2/11/35/60%로 재계산됨. 높이·SCRUB_END·락인 p·AUTO_FROM은 **세트로만 움직일 것**
- **타이핑 루프**: 필름 완주 후 프레임 182-187 핑퐁(115ms — 의자 움직임이 있는 176-181은 제외)
- **모바일**: 720px 이하면 `hero2/m/`(672x1080 **센터 크롭** — 리사이즈 아님, cover-draw가 세로 기준이라 크롭이 화질 동일·용량 60%↓) 룽을 로드
- **모바일/랜드스케이프 nav (r26)**: 히어로 필름이 얼굴로 화면을 채우므로 가로 한 줄 nav가 얼굴을 가로지르던 문제 → `max-width:720px` 또는 `max-height:560px`에서 corner-nav가 우측 가장자리 **세로 프로스티드 필 레일**로 전환(v2.css) — 모든 씬에서 하늘 영역, 나이트 씬에서도 판독 가능
- ⚠️ **재렌더 계약**: 원본 sequence*.mp4는 gitignored(assets/videos/ + ~/Downloads). 아무 시퀀스라도 다시 뽑으면 **손으로 재측정**해야 하는 상수: `WAVES`(아이들 웨이브 타이밍), `TYPE_FROM`/`FRAMES`, `SEGS` 경계, `WINDOWS`, hp-tick %(classic.html), 락인 p(0.6). 추출 레시피는 r10/r21/r22 커밋 메시지에

### 카드 시스템 (cards.js)
- **카드 앞면** = 512x716 캔버스 텍스처, **unlit MeshBasicMaterial**(과노출 이슈로 조명 반응 재질 금지 — 3회 재발함): 상단 일러스트(images/v2/art/) + 크리처 배지 + 이름/태그라인 + `● LIVE` 칩(프로젝트 컬러) + `OPEN →`. 에그는 리퀴드 글라스 스타일 분기. 텍스처 페인트는 `document.fonts.ready` 이후(Geist 굽기 보장)
- **지오메트리 (r26)**: RoundedBoxGeometry는 얇은 슬랩(0.04)에서 radius가 depth/2로 캡되어 실루엣이 각져 보였음 → `makeCardGeometry()` = 라운드 렉트 Shape **ExtrudeGeometry**(r = 텍스처 RAD 40과 일치, UV는 캡 면 기준 0..1 리맵). 머티리얼 [face, edge] 2개. 카드마다 자식으로 **드롭섀도우 쿼드**(블러 라운드렉트 캔버스 텍스처, raycast noop 필수 — three r180 intersectObjects는 recursive 기본) — 종이색이 같은 카드끼리 겹칠 때 경계를 그려줌. 모바일 스택은 `STACK.gap 2.3`(데스크톱 2.0)으로 위아래 카드 접촉 해소
- **일러스트 재생성**: gpt-image-2, 1536x1024, "soft matte felt/clay toy 3D, 프로젝트 컬러 배경, no text/no logo" → 960px webp → images/v2/art/<id>.webp
- **스크린샷 재생성**: `chrome --headless=new --screenshot --window-size=1440,900 --virtual-time-budget=9000 <url>` → 960px webp → images/v2/shots/
- **팬→스택**: 스크롤 P<0.12 팬 홀드 → 0.24까지 스택 전환 → 카드당 세그먼트로 좌측 카드+우측 패널(실 스크린샷+설명+VISIT) 2컬럼 락업, 좌측 가장자리 닷 레일(클릭 점프). 호버=팬에서 카드 뽑기, 클릭=모달(터치는 `pickAt(e)`로 클릭 좌표 레이캐스트 — hover 상태 의존 금지, 탭이 죽음)
- **폴백 3중**: WebGL 실패/CDN 임포트 실패/prefers-reduced-motion → `productsFallback()`(main.js)이 DOM 리스트 렌더. aria: 레일/패널은 `inert` 토글로 관리 (aria-hidden 하드코딩 금지 — 접근성 리뷰에서 걸렸던 부분)

### 성능 계약 (프로덕션 리뷰에서 잡은 것들 — 되돌리지 말 것)
- lazy(): IntersectionObserver(600px)만 진짜 트리거 — scroll/timeout 안전망은 뷰포트 근접 게이트 필수
- 렌더 루프는 섹션 오프스크린 시 rAF 체인 정지(IO가 재기동), 타이핑 루프는 히어로 벗어나면 슬립
- DOM 쓰기(패널 opacity/--dy/클래스)는 변경 시에만
- `?p=`/`?sp=` 훅은 `Number.isFinite` 가드 (NaN 오염 방지)

## 7. 검증 방법 (환경 특이사항 ★중요)

- **gstack 헤드리스 브라우저(`~/.claude/skills/gstack/browse/dist/browse`)의 WebGL이 죽어 있음** (SwiftShader 실패, 재시작 무효). 비주얼 검증에 쓰지 말 것. 콘솔/네트워크/DOM 체크는 유효
- **Claude Preview 패널**: 진짜 Chromium이라 WebGL 정상. 단, 탭이 hidden이면 rAF 스로틀 → 스크린샷 호출이 프레임을 강제 펌핑하므로 상태 폴링과 병행하면 테스트 가능
- 로컬 서버: `python3 -m http.server 8000` (8898은 프리뷰 패널이 점유할 수 있음)
- 디버그 훅: `window.__yw3` (state(), player, creatures, nearestInteractable(), renderer.info 등)
- **classic v2 디버그 훅** (긴 스크롤 페이지를 프리뷰 패널이 래스터화 못 하므로 필수): `?p=0.55`(히어로 스크럽 진행도 핀), `?sp=0.5`(products 쇼케이스 진행도 핀), `?solo=products|work`(해당 섹션만 첫 뷰포트에). 프리뷰 패널은 rAF 스로틀 → **오토플레이/스윙 등 시간 기반 모션은 페인에서 못 봄**, 사용자 실기기 확인 필요. 모듈 캐시: `fetch(url,{cache:'reload'})` 후 reload
- 카메라 기준 이동이라 스크립트로 걷기 제어 시 월드축→화면축 변환 필요: `aRight = dx·0.707 − dz·0.707`, `aUp = −dx·0.707 − dz·0.707`

## 8. 남은 작업 (우선순위순)

1. **Suno/Substack/X 링크 도착 시 알 부화** (§4) — 사용자가 "일부만 준비됨"이라 함. 링크 오면 `data/projects.js`에서 `url` 채우고 `kind:'creature'`로. 인터뷰(2026-07-10)에서 아직 링크 미제공
2. **데모 목록 도착 시 Demo Lab 채우기** (`category:'demo'`, §4). Demo Lab은 2026-07-11부로 **금문교 건너 DEMO ISLAND**(sf_islet 고원, 오프맵 x<0)로 이전 — 다리는 실제로 건널 수 있음: `const.js WALKWAYS`(물 타일 solid 무시 렉트) + `BRIDGE_RAILS`(난간 콜라이더) + `createColliders.addWalkable`. 다리 노면·고원 정상 모두 y=0 플러시(랜드마크 y −2.0 배치, landmarks.js 참조). 카메라 서쪽 클램프는 z 11-16.5 밴드에서만 −10.5까지 해제(camera.js). 사인 대사 = "DEMO ISLAND — Yoonki is cooking demos... stay tuned!", 애널리틱스 `demo_island_visited` 1회 발화. 구 SE 울타리 마당은 제거(잔디 복귀), 크레이트 더미는 부두 옆 dressing으로 존치
3. **ElevenLabs 유료 플랜 업그레이드 시 BGM을 정식 `/v1/music`으로 재생성** (2026-07-10: 401 권한 문제는 해결, 이제 402 paid_plan_required — §5)
4. **미학 지속 폴리시**: 사용자가 스크린샷으로 짚는 부분 정밀 수정 방식이 잘 통함. 수치 기준은 `docs/VISUAL_PLAYBOOK.md`
5. **Classic v2 백로그**:
   - `x` 에그 부화 시 v2 카드 대응: cards.js `CARD_COLORS`에 'x' 색 추가 + images/v2/{art,shots}/x.webp 생성 필요 (현재 소온 리스트에서 id로 제외 중 — kind를 creature로 바꾸면 라이브 리스트에 회색 카드로 들어옴, 리뷰에서 지적된 잠복 경로)
   - 필름 타임라인 좌표계 통일(altitude 리뷰 지적): SEGS/WINDOWS/락인 p/hp-tick이 4곳에 분산 — SEGS에서 파생하는 단일 모델로 리팩터 후보
   - OG 이미지가 아직 게임 스크린샷(images/og.jpg) — v2 히어로 프레임으로 교체 검토
   - Lighthouse 패스 + H.264 인코딩 검증(사파리 구버전 idle.mp4), 카드별 게임플레이 클립(사용자가 클립 주면)
6. 완료된 항목: ~~플레이어/NPC GLB화~~✅, ~~profile.jpg 경량화~~✅(448px), ~~OG 카드~~✅, ~~애널리틱스~~✅ (모두 2026-07-10), ~~classic v2 리빌드+프로덕션~~✅(2026-07-12)

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
| **v2**: 프레임 시퀀스 스크럽 (비디오 currentTime 아님) | 프레임 단위 정밀 제어 + 프로그레시브 로딩, 스크럽 잔렬림 없음 |
| **v2**: 아이들 비디오를 팔린드롬으로 베이크 | 시작≠끝 프레임 루프 점프 해결, JS 역재생은 Chrome 미지원 |
| **v2**: 행잉 캡슐(가챠) → 카드 팬/스택 피벗 | 3라운드 다듬고도 "디자인 혁신 부족" — 사용자가 카드 레퍼런스 제공, 전면 교체 |
| **v2**: 카드 앞면 unlit(MeshBasic) | 조명 반응 재질은 과노출 워시아웃 3회 재발 — 텍스처 원색 보장으로 종결 |
| **v2**: 카드 썸네일 = 일러스트, 패널 = 실 스크린샷 | 스크린샷 썸네일은 "별로"(사용자) — 카드는 아이덴티티, 패널은 실물 증빙으로 역할 분리 |
| **v2**: 락인부터 필름 오토플레이 | 헤드라인 체류가 길다는 피드백 — 스크롤 강요 대신 영상처럼 완주 |

## 10. 작업 방식 (사용자 선호)

- **큰 작업은 Workflow(멀티에이전트 오케스트레이션) 사용** — 사용자 명시 요청. 세션의 workflow 스크립트: `~/.claude/projects/-Users-yoonki-yoonkihong-com/.../workflows/scripts/` (resume 시 완료 에이전트 캐시 복원됨)
- 취향: 폴리시·미니멀보다 **플레이풀·인터랙티브**. "낮엔 Google GTM, 밤엔 빌더" 정체성 중시
- push 등 공개 배포는 반드시 사전 확인. "publish 모드" 선언(2026-07-10) 이후로는 검증 완료 후 push까지 진행 OK
- 세션 한도로 workflow가 끊기면 리셋 후 `resumeFromRunId`로 재개 (완료 에이전트는 캐시 복원)
- 캐릭터/에셋 리퍼런스는 사용자가 이미지로 줌 → 에이전트는 이미지를 못 보므로 **텍스트 스펙으로 번역**해서 workflow에 주입하는 패턴
- 이미지 생성은 `gpt-image-2` 우선 시도(2026-07-10 정상 작동 확인), 실패 시 `gpt-image-1` 폴백

## 11. 애널리틱스 (PostHog + Sentry) — 2026-07-10 신규

- `scripts/analytics.js`가 양 페이지 `<head>`에 `<script defer>`로 로드. **prod 전용**: `yoonkihong.com` 호스트에서만 활성(localhost/프리뷰/미러는 완전 휴면 → 개발 트래픽이 통계 오염 안 함)
- 두 키 모두 **공개 클라이언트 키**라 저장소에 커밋됨(안전): PostHog `phc_...`, Sentry DSN. .env.local과 무관
- `window.ywTrack(event, props)` = 안전 no-op 래퍼. 게임 코드는 애널리틱스 로드 여부와 무관하게 호출
- **커스텀 이벤트**(코드 내 `ywTrack(...)` 호출 위치): `game_start`{mobile} (ui.js tryStart), `encounter_opened`{project,egg} (ui.js showEncounter), `project_visited`{project} (ui.js VISIT 확정 — DETAILS는 카운트 안 함), `all_projects_visited` (game3d.js celebrate), `house_entered`/`npc_talked`/`secret_found` (game3d.js)
- 추천 인사이트: PostHog에서 `encounter_opened → project_visited` 퍼널로 프로젝트별 관심도/전환율 확인. Sentry는 방문자 브라우저 실제 에러만 Issues에 잡힘
- 이벤트 추가 시: 계측 지점에 `if (window.ywTrack) ywTrack('name', {...})` 한 줄. 새 이벤트명은 이 목록에 추가
