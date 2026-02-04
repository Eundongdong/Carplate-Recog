
export const callNaverOcr = async (base64Image: string): Promise<string | null> => {
  const ocrUrl = process.env.NAVER_OCR_URL || localStorage.getItem('NAVER_OCR_URL');
  const ocrSecret = process.env.NAVER_OCR_SECRET || localStorage.getItem('NAVER_OCR_SECRET');
  const proxyUrl = localStorage.getItem('CORS_PROXY') || "";

  if (!ocrUrl || !ocrSecret) {
    console.warn("Naver OCR credentials missing.");
    return null;
  }

  // 프록시 URL이 있는 경우 URL을 조합 (프록시 주소 끝에 '/'가 없을 경우 대비)
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
            name: 'vehicle_image',
            data: base64Image,
          },
        ],
        requestId: `req-${Date.now()}`,
        timestamp: Date.now(),
        version: 'V2',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OCR_API_ERROR: ${response.status}`);
    }

    const data = await response.json();
    
    const allText = data.images?.[0]?.fields
      ?.map((f: any) => f.inferText)
      .join(' ') || "";

    console.log("--- [Naver OCR Raw Data] ---");
    console.log("인식된 전체 텍스트:", allText);

    const plateRegex = /([가-힣]{2})?\s?\d{2,3}[가-힣]{1}\s?\d{4}/g;
    const matches = allText.match(plateRegex);

    if (matches && matches.length > 0) {
      const finalPlate = matches.sort((a, b) => b.length - a.length)[0].replace(/\s/g, '');
      console.log("최종 추출 번호판:", finalPlate);
      console.log("----------------------------");
      return finalPlate;
    }

    return null;
  } catch (error: any) {
    console.error('Naver OCR Internal Error:', error);
    
    // 브라우저 fetch 실패(CORS/네트워크) 시 TypeError 발생
    if (error instanceof TypeError || error.message.includes('Failed to fetch')) {
      throw new Error("CORS_BLOCKED");
    }
    throw error;
  }
};
