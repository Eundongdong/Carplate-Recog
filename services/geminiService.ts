
import { ComparisonResult } from "../types";

export const processCarImage = async (
  base64Image: string, 
  onProgress: (status: string) => void
): Promise<ComparisonResult> => {
  // Azure OpenAI 설정 (환경 변수 우선, 없으면 기본값 사용)
  const apiKey = process.env.API_KEY;
  const endpoint = process.env.ENDPOINT_URL || "https://imcapital-aoai.openai.azure.com/";
  const deployment = process.env.DEPLOYMENT_NAME || "gpt-4o";
  const apiVersion = process.env.API_VERSION || "2025-01-01-preview";
  
  if (!apiKey || apiKey === "undefined" || apiKey.length < 10) {
    throw new Error("환경 변수 'API_KEY' (Azure OpenAI Key)가 설정되지 않았습니다.");
  }

  // Azure OpenAI REST API URL 구성
  // URL 구조: {endpoint}/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}
  const cleanEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
  const apiUrl = `${cleanEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  try {
    onProgress("Azure GPT-4o 분석 수행 중...");

    const systemInstruction = `
You are a vehicle analysis specialist. Analyze the image using TWO different criteria sets and return a single JSON object containing both results.

[CRITERIA SET A - License Plate Extraction]
1. Determine if it's a vehicle.
2. If NOT, status: "NOT_VEHICLE", message: "차량 사진이 아닙니다."
3. If IS, extract Korean license plate.
4. If plate is missing/unreadable, status: "VEHICLE_NO_PLATE", message: "번호판을 찾을 수 없습니다."
5. If plate found, status: "SUCCESS", message: "성공".

[CRITERIA SET B - Vehicle Condition Analysis]
Step 1: Determine whether the image contains a vehicle. (Cars, trucks, buses, motorcycles, parts like plates, wheels, bumpers).
- If no vehicle: status: "EXCEPT", message: "차량 사진이 아닙니다.", plate: null.
Step 2: If vehicle, check for serious damage.
- If serious damage: status: "ISSUE", message: "차량 파손 여부가 확인됩니다."
- If no serious damage: status: "SUCCESS", message: "정상 차량입니다."
Step 3: Extract license plate into 'plate' field if visible.

RETURN JSON FORMAT ONLY:
{
  "analysisA": { "status": "...", "plate": "...", "message": "..." },
  "analysisB": { "status": "...", "plate": "...", "message": "..." }
}
`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey // Azure OpenAI 전용 헤더
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemInstruction },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image for vehicle identification and damage assessment." },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 800,
        temperature: 0.7,
        top_p: 0.95,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Azure OpenAI Error Response:", errorData);
      const code = response.status;
      if (code === 401) throw new Error("Azure API 키가 유효하지 않습니다.");
      if (code === 404) throw new Error("배포된 모델(Deployment)을 찾을 수 없습니다. 설정된 이름을 확인하세요.");
      throw new Error(errorData.error?.message || `Azure API 오류 (${code})`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    const result = JSON.parse(content || "{}");
    
    return {
      isVehicle: result.analysisA?.status !== "NOT_VEHICLE" && result.analysisB?.status !== "EXCEPT",
      analysisA: result.analysisA,
      analysisB: result.analysisB
    };

  } catch (error: any) {
    console.error("AOAI Process Error:", error);
    throw error;
  }
};
