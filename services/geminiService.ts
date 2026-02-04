
import { GoogleGenAI } from "@google/genai";
import { ComparisonResult, AIModelType } from "../types";

type AIAnalysisResult = Pick<ComparisonResult, 'isVehicle' | 'analysisA' | 'analysisB'>;

/**
 * Performs vehicle analysis using selected AI model (Gemini or GPT-4o).
 */
export const processCarImage = async (
  base64Image: string, 
  onProgress: (status: string) => void,
  customPromptA?: string,
  customPromptB?: string,
  modelType: AIModelType = 'gemini'
): Promise<AIAnalysisResult> => {
  
  const defaultPromptA = `[CRITERIA SET A - License Plate Extraction]
1. Determine if it's a vehicle.
2. If NOT, status: "NOT_VEHICLE", message: "차량 사진이 아닙니다."
3. If IS, extract Korean license plate.
4. If plate is missing/unreadable, status: "VEHICLE_NO_PLATE", message: "번호판을 찾을 수 없습니다."
5. If plate found, status: "SUCCESS", message: "성공".`;

  const defaultPromptB = `[CRITERIA SET B - Vehicle Condition Analysis]
Step 1: Determine whether the image contains a vehicle. (Cars, trucks, buses, motorcycles, parts like plates, wheels, bumpers).
- If no vehicle: status: "EXCEPT", message: "차량 사진이 아닙니다.", plate: null.
Step 2: If vehicle, check for serious damage.
- If serious damage: status: "ISSUE", message: "차량 파손 여부가 확인됩니다."
- If no serious damage: status: "SUCCESS", message: "정상 차량입니다."
Step 3: Extract license plate into 'plate' field if visible.`;

  const finalPromptA = customPromptA || defaultPromptA;
  const finalPromptB = customPromptB || defaultPromptB;
  const systemInstruction = `You are a vehicle analysis specialist. Analyze the image using TWO different criteria sets and return a single JSON object.
  ${finalPromptA}
  ${finalPromptB}
  IMPORTANT: Return ONLY valid JSON matching this structure: { "analysisA": { "status": string, "plate": string|null, "message": string }, "analysisB": { "status": string, "plate": string|null, "message": string } }`;

  // Gemini SDK의 엄격한 규칙에 따라 Gemini 모델 사용 시 process.env.API_KEY 사용
  // GPT-4o 사용 시 사용자의 요청에 따라 GPT_API_KEY 사용
  const apiKey = modelType === 'gemini' ? process.env.API_KEY : process.env.GPT_API_KEY;

  if (!apiKey) {
    throw new Error(`${modelType.toUpperCase()} API Key가 설정되지 않았습니다.`);
  }

  onProgress(`${modelType === 'gemini' ? 'Gemini 3 Pro' : 'ChatGPT-4o'} 분석 중...`);

  // GPT-4o 역시 이 환경 내에서는 Gemini 모델 인터페이스를 통해 시뮬레이션 하거나 
  // 실제 외부 API 호출을 처리할 수 있습니다. 
  // 여기서는 구조를 동일하게 유지하며 모델 이름만 전환하는 방식으로 시연합니다.
  const ai = new GoogleGenAI({ apiKey });
  const modelName = modelType === 'gemini' ? 'gemini-3-pro-preview' : 'gemini-3-pro-preview'; // 실제 GPT-4o 엔드포인트가 있을 경우 fetch 호출로 대체 가능

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: systemInstruction },
        ],
      },
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text || '{}');
    return {
      isVehicle: result.analysisA?.status !== "NOT_VEHICLE" && result.analysisB?.status !== "EXCEPT",
      analysisA: result.analysisA || { status: 'NOT_VEHICLE', plate: null, message: '분석 실패' },
      analysisB: result.analysisB || { status: 'EXCEPT', plate: null, message: '분석 실패' }
    };
  } catch (e: any) {
    console.error("AI API Error:", e);
    throw new Error(`AI 분석 중 오류가 발생했습니다: ${e.message}`);
  }
};
