# fullcount

iPad Safari에서 터치로 치고 던지는 카툰 3D 야구 게임. 혼자 만들고 혼자 플레이하는 개인 프로젝트다.

- `index.html`: 게임 화면. Babylon.js 7.20.0을 jsDelivr에서 불러온 뒤 아래 파일을 순서대로 불러온다. 빌드 도구 없이 브라우저로 바로 열면 된다.
- `css/style.css`: 화면 모양(전광판, 버튼, 배너).
- `js/core.js`: 경기장 기본 치수, 게임 상태, 공통 도구 함수.
- `js/data/pitches.js`: 구종 데이터.
- `js/scene.js`: 3D 엔진, 카메라, 조명, 구장, 공.
- `js/players.js`: 선수 모델(투수, 타자, 배트).
- `js/ui.js`: 전광판, 결과 배너, 안내 문구.
- `js/pitching.js`: 투구 궤적, 컴퓨터 투수, 내 투구 조준과 컴퓨터 타자.
- `js/batting.js`: 타구 계산과 판정, 내 스윙 판정.
- `js/game.js`: 볼·스트라이크·아웃 진행, 타석 넘기기, 모드 바꾸기.
- `js/main.js`: 매 프레임 애니메이션, 입력 연결, 시작.
- `prompts/v0.2-update-prompts.md`: v0.2(한 경기)를 만들기 위한 코드 작업용 단계별 프롬프트.

## iPad에서 열기

저장소 Settings → Pages에서 Source를 `main` 브랜치 `/ (root)`로 정하면 `https://myongg14.github.io/fullcount/` 주소로 열 수 있다.
