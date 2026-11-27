2030 MYEONGDONG — 3단계 1차 (R1-a, R1-b만 적용) / 기준: 2단계 패치 버전
변경 파일 3개 (코드에 [V3-R1a] / [V3-R1b] 표시)
 R1-a assets/game/city/engine.js  resize(): 게임 해상도 상한 PC 1.5 → 1.25 (폰은 이미 1.25)
 R1-b bridge/js3d/entry.js        EffectComposer 렌더타깃 MSAA 4 → 2 (PC), bridge/index.html 은 build3d.py 로 번들 재생성(위 변경만 반영)
되돌리기: 위 세 파일을 2단계 zip의 같은 파일로 교체하면 원복. 또는 R1-a: 1.25) → matchMedia("(pointer: coarse)").matches?1.25:1.5) / R1-b: samples 2 → 4.
