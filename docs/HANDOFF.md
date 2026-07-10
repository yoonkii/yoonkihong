# YOONKI WORLD — Handoff Doc

> 마지막 업데이트: 2026-07-08. yoonkihong.com 리빌드 프로젝트의 전체 인수인계 문서.
> 대상: 다음 작업 세션(사람 또는 AI 에이전트). 이 문서 하나로 프로젝트 전체 맥락을 복원할 수 있어야 함.

---

## 1. 프로젝트 개요

- **사이트**: yoonkihong.com (GitHub Pages, `CNAME` 파일로 커스텀 도메인 연결)
- **저장소**: github.com/yoonkii/yoonkihong · 로컬: `/Users/yoonki/yoonkihong.com`
- **정체**: 쿼터뷰 3D 복셀 포트폴리오 게임 **"YOONKI WORLD"**. 방문자가 캐릭터를 조작해 섬을 탐험하며 포켓몬 만나듯 포트폴리오 프로젝트를 "인카운터"함
- **비주얼 목표**: 포켓몬 포코피아(2026, Switch 2)의 코지 토이 디오라마 룩 + bruno-simon.com의 인터랙티브 재미
- **기술 원칙**: 빌드 스텝 없음, 프레임워크 없음. Three.js는 pinned CDN importmap(`three@0.180.0`, jsdelivr). 나머지는 바닐라 ES 모듈
- **폰트**: Geist Sans (사용자 명시 요청 — 사이트 전역, 게임 UI 포함)

## 2. 현재 상태 (2026-07-08)

- ✅ 3D 버전 완성, 최종 스모크 테스트 9/9 통과, 콘솔 에러 0
- ✅ 로컬 커밋 완료: `e57e26d`(2D GBA 버전 v1 — 보존용) → `6091cb2`(3D 버전) → `37cfca8`(gitignore)
- ⛔ **push/배포 전** — 사용자 확인 후 push하면 GitHub Pages로 자동 배포됨
- 배포 페이로드: 추적 파일 ~7.5MB + three.js CDN

## 3. 파일 구조

```
index.html              게임 진입점 (타이틀 = 라이브 디오라마, importmap, HUD/다이얼로그 DOM)
classic.html            채용담당자용 심플 뷰 (Geist Sans, projects.js에서 렌더링,
                        Products / Demos & Experiments / Coming soon 그룹핑)
data/projects.js        ★ 단일 소스 오브 트루스 — 게임 맵과 classic 뷰 둘 다 이걸 읽음
scripts/game3d.js       오케스트레이터 (부팅, 품질 티어, 상태머신, GLB_PRELOAD 목록, __yw3 디버그 훅)
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
glbviewer.html          GLB 턴테이블 뷰어 (게임과 동일 라이팅)
.env.local              API 키 (gitignored, 공개 저장소 — 절대 커밋/출력 금지)
```

## 4. 프로젝트 데이터 관리 (가장 흔한 유지보수 작업)

`data/projects.js`의 `window.PROJECTS` 배열이 전부. 필드: `id, name, tagline, desc, url, kind('creature'|'egg'), category('product'|'demo'), sprite, building`.

- **새 프로젝트 추가**: 객체 하나 추가 → 게임 맵 슬롯 자동 배정 + classic 카드 자동 생성
- **알 부화** (Suno/Substack/X 링크 도착 시): 해당 항목에 `url` 채우고 `kind:'creature'`로 변경. 전용 GLB를 원하면 §5 파이프라인으로 생성 후 `GLB_PRELOAD`(scripts/game3d.js)에 이름 추가
- **데모 추가**: `category:'demo'`로 추가 → Demo Lab 존 스톨에 자동 등장 (슬롯 5개 사전 확보, 없으면 공사중 표지판)
- **현재 상태**: product 5종(macrodoc, mathstreet, mathwings, funnify, lasthand) + egg 3종(suno, substack, x). 데모 0종

## 5. 에셋 파이프라인

### GLB (Meshy image-to-3D) — `docs/GLB_PIPELINE.md` 필독
1. OpenAI `gpt-image-1`로 컨셉샷 (단일 피사체, 3/4뷰, 밝은 회색 무배경, 포코피아 토이 렌더) → `assets/3d/concepts/`
2. `POST https://api.meshy.ai/openapi/v1/image-to-3d` (`enable_pbr:false, target_polycount 10-15k, symmetry auto`) → 15-20초 간격 폴링 (에셋당 2-8분, 여러 개 동시 폴링)
3. `model_urls.glb` 다운로드 → `gltfpack -c` 압축 (또는 `npx @gltf-transform/cli optimize --texture-size 1024`)
4. `glbviewer.html?model=이름`으로 검증 → `GLB_PRELOAD`에 추가 → **`ASSET_V` 범프** (scripts/game3d/const.js — 캐시버스팅)
- 용량 예산: 크리처/건물 ≤3MB, 반복 소품(나무) ≤1.2MB
- **폴백 설계**: GLB 없거나 파싱 실패 → 해당 에셋만 복셀 모델 사용, 게임은 무조건 돌아감
- 현재 라이브 16종: 크리처 6(macrodoc, mathstreet, mathwings, funnify, lasthand, goldie) + 건물 6(bld_ 접두, lasthand 포함) + tree_a/b, fountain, egg
- About 하우스 문 = 실내 미니씬 진입 (scripts/game3d/interior.js — NAVER/LINE/GOOGLE 복셀 로고 명판 + 대화)

### 오디오 (ElevenLabs)
- **BGM**: 현재 `/v1/sound-generation` 우회 생성물 (키에 `music_generation` 권한 없음 — 401). 권한 추가되면 `/v1/music`으로 재생성 (overworld 90s, encounter 60s, 루프)
- **SFX**: `audio/sfx/` 6종 (footstep_grass, bump, pop, encounter_sting, blip, fireworks) — audio.js에서 연결, 없으면 WebAudio 합성 폴백

### API 키 (`.env.local`)
`OPENAI_API_KEY`, `ELEVEN_LABS_KEY`, `MESHY_API_KEY` — 로드: `set -a; source .env.local; set +a`. 값 출력·커밋 절대 금지 (공개 저장소).

## 6. 게임 기능 명세 (회귀 테스트 체크리스트로 사용)

- 이동: WASD/방향키, 관성(가감속), 카메라 기준 8방향, 벽 슬라이딩. 모바일: 가상 조이스틱 + A/B
- 인터랙션: 근접 시 "!" 마커, **Space**/Z/Enter 발동, X/Esc 닫기
- 인카운터: 포켓몬식 투샷 — 카메라는 월드 방위각 45° 고정(회전 없음), 한 번의 팬+줌 후 정지(10초에 걸친 1.5% 푸시인만 허용). 아이리스 암전 중 플레이어를 "트레이너 슬롯"(화면 좌하단, 충돌 검사·미러 폴백 포함)으로 컷, RUN 시 페이드 아래 복원. 피사체 높이로 줌 산출, 울타리/수관 가림 시 앙각 35→48→58° 에스컬레이션, 근처 크리처+GOLDIE는 암전 중 숨김. 세로 모바일은 프레임을 위로 올려 패널 위에 투샷 유지 → 타자기 텍스트 → VISIT(새 탭)/RUN. 알 = incubating + BACK. url 없는 non-egg = 파란 COMING SOON 태그
- NPC 대화(빌더 스토리 멀티페이지), 표지판(링크), 집, Demo Lab 표지판, 시크릿 GOLDIE(숲 뒤)
- 물리 장난감: 볼링핀 6개·상자·비치볼 (커스텀 임펄스)
- 인트로: 타이틀 = 라이브 디오라마 → PRESS START → 카메라 스윕(입력 시 스킵, reduced-motion 시 생략)
- 불꽃놀이: 프로젝트 5종 모두 방문 시 (localStorage, HUD 0/5 카운터 — data/projects.js에서 파생)
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
7. (선택) 플레이어/NPC 캐릭터도 Meshy GLB로 교체 — 현재 복셀. 절차적 홉 애니메이션이 그룹 단위라 정적 GLB로 교체 가능

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
