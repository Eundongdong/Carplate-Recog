
export const callNaverOcr = async (base64Image: string): Promise<string | null> => {
  // 환경변수에서 직접 가져옴 (비밀번호 인증 시에만 이 함수가 호출되도록 App.tsx에서 제어)
  const ocrUrl = process.env.NAVER_OCR_URL;
  const ocrSecret = process.env.NAVER_OCR_SECRET;
  const proxyUrl = localStorage.getItem('CORS_PROXY') || "";

  if (!ocrUrl || !ocrSecret) {
    console.warn("Naver OCR credentials are not configured in environment variables.");
    return null;
  }

  // 프록시 URL 조합
  const normalizedProxy = proxyUrl && !proxyUrl.endsWith('/') && !ocrUrl.startsWith('/') ? `${proxyUrl}/` : proxyUrl;
  const finalUrl = normalizedProxy ? `${normalizedProxy}${ocrUrl}` : ocrUrl;

  try {
    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OCR-SECRET': ocrSecret,
      },
      body: JSON.stringify({
        images: [
          {
            format: 'jpg',
            name: 'batch_proc_vehicle',
            data: base64Image,
          },
        ],
        requestId: `batch-${Date.now()}`,
        timestamp: Date.now(),
        version: 'V2',
      }),
    });

    if (!response.ok) {
      throw new Error(`NAVER_OCR_API_ERROR: ${response.status}`);
    }

    const data = await response.json();
    
    // 인식된 모든 텍스트 병합 및 번호판 패턴 추출
    const allText = data.images?.[0]?.fields
      ?.map((f: any) => f.inferText)
      .join(' ') || "";

    // 한국 번호판 정규식 (신형/구형 대응)
    const plateRegex = /([가-힣]{2})?\s?\d{2,3}[가-힣]{1}\s?\d{4}/g;
    const matches = allText.match(plateRegex);

    if (matches && matches.length > 0) {
      // 가장 긴 매칭 결과(더 정확한 결과) 선택 및 공백 제거
      const finalPlate = matches.sort((a, b) => b.length - a.length)[0].replace(/\s/g, '');
      return finalPlate;
    }

    return null;
  } catch (error: any) {
    console.error('Naver OCR Internal Error:', error);
    if (error instanceof TypeError || error.message.includes('Failed to fetch')) {
      throw new Error("CORS_BLOCKED");
    }
    throw error;
  }
};
