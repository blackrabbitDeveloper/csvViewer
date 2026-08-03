<div align="center">

# CSV Viewer

CSV와 TSV 파일을 브라우저 안에서 빠르고 안전하게 탐색하는 정적 웹 앱입니다.

[![Open App](https://img.shields.io/badge/Open_App-E8795A?style=for-the-badge&logo=googlechrome&logoColor=white)](https://blackrabbitdeveloper.github.io/csvViewer/)

</div>

## 주요 기능

- CSV/TSV 파일 선택과 드래그 앤 드롭
- 쉼표, 탭, 세미콜론, 파이프 구분자 자동 감지 및 수동 변경
- UTF-8 및 EUC-KR 파일 읽기
- 전체 데이터 검색, 열별 오름차순·내림차순 정렬
- 열 타입을 자동 인식하는 다중 조건 필터(텍스트, 숫자, 날짜, 빈 값)
- 숫자·날짜 범위 필터와 활성 조건 개별 제거/전체 초기화
- 열 표시 설정과 25~250행 페이지 보기
- 검색 결과와 표시 중인 열을 CSV로 저장
- 반응형 레이아웃과 Dark/Light 공통 테마
- 서버 업로드 없는 완전한 로컬 처리

## 로컬 실행

```bash
npm run dev
```

브라우저에서 <http://localhost:8000>을 엽니다.

## 테스트

```bash
npm test
```

## 기술

- Vanilla HTML, CSS, JavaScript
- Node.js 내장 테스트 러너
- GitHub Pages

## 개인정보

파일 내용은 서버로 업로드되지 않으며 현재 브라우저 안에서만 처리됩니다.

## 라이선스

MIT
