# 🚗 차량번호 판독 (Car Plate Detector)

AI(Gemini)와 OCR(Naver Clova) 기술을 결합하여 차량 사진에서 번호판을 추출하고 차량의 상태를 정밀하게 분석하는 웹 애플리케이션입니다.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-8E75C2?style=for-the-badge&logo=google-gemini&logoColor=white)
![GPT](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=for-the-badge?logo=openai&logoColor=white)
---

## ✨ 주요 기능

- **🤖 AI 기반 차량 분석**: Google Gemini 모델을 활용하여 번호판 번호 추출 및 차량의 외관 상태(파손, 오염, 특이사항)를 분석합니다.
- **🔍 Naver OCR 교차 검증**: 프리미엄 모드 활성 시 Naver Clova OCR API를 연동하여 번호판 인식의 정확도를 높이고 AI 결과와 비교합니다.
- **📦 일괄 이미지 처리**: 여러 장의 차량 사진을 한 번에 업로드하여 자동으로 순차 분석을 진행합니다.
- **📊 데이터 내보내기**: 분석 완료된 모든 결과를 CSV 형식으로 다운로드하여 엑셀 등에서 활용할 수 있습니다.
- **⚙️ 커스텀 프롬프트**: 사용자가 직접 AI 분석 프롬프트를 수정하여 프로젝트에 최적화된 결과값을 얻을 수 있습니다.


---

## 🛠 기술 스택

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Build Tool**: Vite
- **AI/OCR**: 
  - Google Generative AI (@google/genai)
  - OpenAI GPT-4.1
  - Naver Clova OCR API
- **Icons**: Lucide React

---

## 🚀 시작하기

### 1. 필수 요구 사항
- Node.js 18.x 이상
- Google AI Studio API Key ([발급받기](https://aistudio.google.com/app/apikey))
- Naver Cloud Platform OCR API Key (선택 사항)

### 2. 환경 변수 설정
프로젝트 루트 디렉토리에 `.env` 파일을 생성하고 아래 내용을 입력합니다.

```env
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Premium Mode Password
VITE_PASSWORD=your_admin_password

# Naver OCR Settings (Optional)
VITE_NAVER_OCR_URL=your_naver_ocr_invoke_url
VITE_NAVER_OCR_SECRET=your_naver_ocr_secret_key
```

### 3. 설치 및 실행
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

---

## 💡 사용 방법

1. **이미지 업로드**: 분석할 차량 사진을 선택하거나 드래그 앤 드롭합니다.
2. **분석 진행**: AI가 자동으로 번호판과 차량 상태를 판독합니다.
3. **결과 확인**: 좌측 리스트에서 각 결과를 선택하여 상세 분석 내용과 원본 이미지를 확인합니다.
4. **프리미엄 모드**: 설정에서 비밀번호를 입력하여 프리미엄 모드를 활성화하면 Naver OCR 분석 결과가 추가됩니다.
5. **데이터 저장**: 상단의 'CSV 다운로드' 버튼을 클릭하여 분석 결과를 저장합니다.

---

## ⚠️ 주의 사항

- **CORS 정책**: 브라우저에서 Naver OCR API를 직접 호출할 경우 CORS 에러가 발생할 수 있습니다. 설정 메뉴에서 CORS 프록시 서버(예: `https://cors-anywhere.herokuapp.com/`)를 설정하여 해결할 수 있습니다.

