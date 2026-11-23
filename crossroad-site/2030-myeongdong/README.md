# 2030 MYEONGDONG — A City That Responds

AI 기반 긴급 통행 제어 시스템(AI-Powered Emergency Passage Control System)을 소개하는 인터랙티브 제품 웹사이트입니다.

## 실행 방법

> 경량화 버전: 실시간 바닥 반사 끔, 조명·인물·빛줄기 수 축소, 해상도 자동 조절, 모델 압축 (ZIP 6.1MB → 1.2MB)

**압축을 풀고 `index.html`을 더블클릭하면 바로 열립니다.** (크롬·엣지 권장, 인터넷 연결 필요 — Three.js·GSAP·폰트를 인터넷에서 불러옵니다)

- `index.html` : 모든 코드가 한 파일에 묶인 실행용 페이지 (더블클릭용)
- `dev.html` + `js/` 폴더 : 원본 소스 (수정용). `dev.html`은 VS Code Live Server로 열어야 작동합니다.
- `js/` 안의 코드를 고쳤다면 `python tools/build.py`를 실행해 `index.html`을 다시 만들어 주세요.

## 폴더 구조

```
2030-myeongdong/
├─ index.html                 실행용 (더블클릭) — 코드가 한 파일에 묶여 있음
├─ dev.html                   원본 페이지 (Live Server용)
├─ tools/build.py             js/ → index.html 묶기
├─ css/style.css              디자인 시스템 (컬러·타이포·레이아웃·반응형)
├─ assets/
│  ├─ models/
│  │  └─ models.bundle.js     제품 GLB 2개(열림/닫힘)를 압축해 담은 파일 — 사이트는 이것만으로 작동
│  │                          (원본 epcs_open.glb / epcs_closed.glb를 이 폴더에 넣으면 그 파일을 우선 사용)
│  ├─ images/                 레퍼런스 렌더링
│  ├─ videos/  audio/         (비어 있음 — 가이드 구조 유지)
└─ js/
   ├─ main.js                 렌더러·후처리·스크롤 디렉터·루프
   ├─ config/settings.js      ★ 수치 조정은 여기: 색상, 제품 개수/간격, 시나리오 구간, 품질
   ├─ core/                   GLB 로딩, 지오메트리 병합 유틸
   ├─ components/             ProductRig(제품 기구), Crowd(군중), Ambulance(구급차), 텍스처, 재질
   ├─ scenes/                 CityScene(명동 골목), StudioScene(컨셉·디테일), ViewerScene(3D 뷰어)
   ├─ animations/             카메라 경로, 작동 시나리오 타임라인
   ├─ fx/LightTrails.js       보라 빛 궤적 시스템
   └─ ui/ui.js                내비게이션, 인트로, 뷰어 버튼
```

## 자주 바꾸는 값 (js/config/settings.js)

- `LAYOUT.unitsPerRow` — 한 줄에 설치할 제품 개수 (기본 4 → 총 8개)
- `LAYOUT.pitch` — 제품 간 간격(m)
- `LAYOUT.rowX` — 통로 중심에서 제품 열까지 거리(m)
- `QUALITY.people` — 보행자 수

## 제품 모델 처리 방식

GLB 파일에는 부품 이름·애니메이션이 없어서, 두 모델의 메시를 비교해 부품별 실제 움직임을 계산했습니다 (오차 실척 약 5mm 이내).
- 양 끝 모듈: 몸체/LED띠/상판이 단계적으로 상승 (텔레스코픽)
- 중앙 패널: 닫힌 모델의 바닥 커버 → 힌지 회전으로 수직 패널
- 투명 스트립: 각 패널에 연결된 2분할 구조, 패널이 서는 동안 점진적으로 펼쳐져 X 형성 (두 스트립은 서로 다른 깊이)

## v2 프리미엄 비주얼 리디자인 (변경 내역)

- **인트로**: `js/fx/IntroVortex.js` — 셰이더로 그린 수백 겹 빛 리본 소용돌이. 스크롤 5단계(회전 → 가속 → 몰입(터널) → 암전 → 중앙을 가로지르는 보라 빛 슬릿)
- **추상 섹션**: 문제 정의/콘셉트 전반부는 `js/fx/FlowStreams.js`의 빛 흐름(정체 → 중앙 통로 개방)
- **제품 재질**: `js/components/materials.js` — 무광 폴리머(metalness 0.04, roughness 0.64 + 미세 텍스처, clearcoat 0.12/0.62, sheen), 아크릴은 굴절 + 가장자리 프레넬 발광
- **스튜디오**: `js/components/StudioKit.js` — 소프트박스 키·상단 스트립·바이올렛 림·중성 필(RectArea), 반사 환경맵, 컨택트 섀도
- **LED**: 발광 코어 + 실제 광원(RectArea/Point) + 바닥에 번지는 빛
- **빛 궤적**: `js/fx/LightTrails.js` — WebGL 다중 가닥 리본(코어+글로우, 가감속)
- **색보정**: `js/fx/GradePass.js` — 블랙·퍼플 리프트, 비네트, 미세 색수차, 그레인

## v3 인트로·캐릭터 리디자인

- **인트로 흡입**: 하나의 카메라 경로(스플라인)를 따라 비스듬한 전경 → 축 정렬 → 원의 중심 통과 → 빛 터널. 스크롤 위치가 회전 속도·카메라 깊이·전진 속도·화각(40°→96°)·꼬리 길이·방사형 모션 블러·밝기·원근 왜곡을 각각 제어 (`js/fx/IntroVortex.js`, `RadialBlurShader`)
- **Urban Context 섹션 삭제**: 인트로 → 문제 정의(추상 빛: 흩어진 흐름 → 정체 → 보라 빛 관통)로 바로 연결. 섹션 번호·내비 갱신
- **인물**: `js/components/Crowd.js` 전면 재작성 — 로프트 메시 인체/의상 8가지 스타일, 재질별 셰이딩 + 보라 림라이트, 자연스러운 보행, 서로 피하기, 긴급 반응(고개 돌림→멈춤→이동), LOD
- 색수차 대폭 축소, 데스크톱 최소 해상도 1.0 유지

## 한계 (솔직하게)

- 인물은 라이선스 휴먼 GLB가 아닌 코드로 만든 스타일라이즈드 모델입니다(오프라인 환경에서 외부 에셋 다운로드 불가). 천 시뮬레이션, 손가락, 얼굴 표정은 없습니다.

- 화면 공간 AO(SSAO) 대신 컨택트 섀도 + 소프트 섀도맵 + 환경맵으로 접촉부 음영을 표현했습니다.

도시 건물·보행자·구급차는 라이선스 3D 에셋이 아니라 코드로 직접 만든 실시간 모델입니다. 세부 구조(간판, 창틀, 관절, 바퀴, 경광등 등)는 있지만, 고품질 상용 에셋 수준의 사실감은 아닙니다. 더 사실적인 결과가 필요하면 라이선스 에셋(GLB)으로 교체할 수 있도록 구조를 나눠 두었습니다.
