
import { GoogleGenAI, Type } from "@google/genai";
import { ComparisonResult } from "../types";

export const processCarImage = async (
  base64Image: string, 
  onProgress: (status: string) => void
): Promise<ComparisonResult> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey.length < 10) {
    throw new Error("환경 변수 'API_KEY'가 인식되지 않았습니다. Vercel 설정에서 API_KEY 추가 후 반드시 [Redeploy]를 실행해야 합니다.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = 'gemini-3-flash-preview';

  try {
    onProgress("비교 분석 수행 중...");

    const systemInstruction = `
You are a vehicle analysis specialist. Analyze the image using TWO different criteria sets and return a single JSON object containing both results.

[CRITERIA SET A - Existing Logic]
1. Determine if it's a vehicle.
2. If NOT, status: "NOT_VEHICLE", message: "차량 사진이 아닙니다."
3. If IS, extract Korean license plate.
4. If plate is missing/unreadable, status: "VEHICLE_NO_PLATE", message: "번호판을 찾을 수 없습니다."
5. If plate found, status: "SUCCESS", message: "성공".

[CRITERIA SET B - New Logic with Plate Extraction]
Step 1: Determine whether the image contains a vehicle. (Cars, trucks, buses, motorcycles, parts like plates, wheels, bumpers).
- If no vehicle: status: "EXCEPT", message: "차량 사진이 아닙니다.", plate: null.
Step 2: If vehicle, check for serious damage (ignore minor scratches/reflections).
- If serious damage: status: "ISSUE", message: "차량 파손 여부가 확인됩니다."
- If no serious damage: status: "SUCCESS", message: "정상 차량입니다."
Step 3 (Additional): Regardless of damage, if a license plate is visible, extract it into the 'plate' field.

RETURN JSON:
{
  "analysisA": { "status": "...", "plate": "...", "message": "..." },
  "analysisB": { "status": "...", "plate": "...", "message": "..." }
}
`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: "Analyze this image according to criteria sets A and B." }
        ],
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            analysisA: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                plate: { type: Type.STRING, nullable: true },
                message: { type: Type.STRING }
              },
              required: ["status", "message"]
            },
            analysisB: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                plate: { type: Type.STRING, nullable: true },
                message: { type: Type.STRING }
              },
              required: ["status", "message"]
            }
          },
          required: ["analysisA", "analysisB"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    return {
      isVehicle: result.analysisA.status !== "NOT_VEHICLE" && result.analysisB.status !== "EXCEPT",
      analysisA: result.analysisA,
      analysisB: result.analysisB
    };

  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "AI 분석 중 오류가 발생했습니다.");
  }
};
