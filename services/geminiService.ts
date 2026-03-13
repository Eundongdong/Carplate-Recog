/// <reference types="vite/client" />
import { GoogleGenAI, Type } from "@google/genai";
import { ComparisonResult } from "../types";

type AIAnalysisResult = Pick<ComparisonResult, 'isVehicle' | 'analysisA' | 'analysisB'>;

/**
 * Performs vehicle analysis.
 * Environment variables are accessed via import.meta.env.
 */
export const processCarImage = async (
  base64Image: string, 
  onProgress: (status: string) => void,
  customPromptA?: string,
  customPromptB?: string,
  modelType: AIModelType = 'gemini'
): Promise<AIAnalysisResult> => {

  const defaultPromptA = `[Role]
You are a vehicle image classifier and damage inspector.

[Analysis Process - Step by Step]
Step 1. Identify if the image is related to a vehicle. 
- This includes not only the full view of the car, but also close-ups of specific parts (e.g., bumper, door, wheel, headlight, engine room, etc.).
- Even if the image is dark, blurry, or only shows a small part of the vehicle, as long as it is a part of a vehicle, consider it a "Vehicle Picture."

Step 2. If it is a "Vehicle Picture," inspect for serious damage.
- "Serious damage" includes large dents, cracks, broken parts, or significant deformation.
- Ignore minor scratches, light reflections, or dirt.

[Response Format]
1) If it is NOT a picture of a vehicle (or any vehicle part):
   EXCEPT: 차량 사진이 아닙니다.

2) If it is a vehicle picture AND serious damage is detected:
   ISSUE: 차량 파손 여부가 확인됩니다.

3) If it is a vehicle picture AND NO serious damage is detected (including minor scratches):
   success`
  const defaultPromptB = `Vehicle photos will be continuously provided.

Step 1:
Determine whether the image contains a vehicle.
A vehicle includes cars, trucks, buses, motorcycles, and vehicle parts
such as license plates, dashboards, wheels, or bumpers.
If any part of a vehicle is visible, classify it as a vehicle.

If no vehicle is clearly present (e.g., people, documents, landscapes),
respond:
EXCEPT : 차량 사진이 아닙니다.

Step 2:
If the image is a vehicle, determine whether there is serious damage.
Ignore light scratches, reflections, dirt, or glare.

If serious damage is confirmed, respond:
ISSUE: 차량 파손 여부가 확인됩니다.

If no serious damage is found, respond:
success
`;

  const finalPromptA = customPromptA?.trim() || defaultPromptA;
  const finalPromptB = customPromptB?.trim() || defaultPromptB;

  
  const systemInstruction = `
  - Analysis A: ${finalPromptA}
  - Analysis B: ${finalPromptB}
  
  Return format: STRICT JSON ONLY.
  {
    "isVehicle": boolean,
    "analysisA": { "status": "SUCCESS" | "NOT_VEHICLE" | "VEHICLE_NO_PLATE", "plate": string | null, "message": string },
    "analysisB": { "status": "SUCCESS" | "EXCEPT" | "ISSUE", "plate": string | null, "message": string }
  }`;

  if (modelType === 'gemini') {
    
    // Model selection based on task type: Basic Text/Multi-modal
    const modelName = 'gemini-3-flash-preview'; 
    
    onProgress(`Gemini 엔진 분석 중...`);
    const apiKeyGemini = import.meta.env.VITE_GEMINI_API_KEY;
    const ai = new GoogleGenAI({apiKey: apiKeyGemini});

    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: systemInstruction + (customPromptA ? `\n\nAdditional A: ${customPromptA}` : "") + (customPromptB ? `\n\nAdditional B: ${customPromptB}` : "") },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isVehicle: { type: Type.BOOLEAN },
              analysisA: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  plate: { type: Type.STRING },
                  message: { type: Type.STRING }
                },
                required: ["status", "plate", "message"]
              },
              analysisB: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING },
                  plate: { type: Type.STRING },
                  message: { type: Type.STRING }
                },
                required: ["status", "plate", "message"]
              }
            },
            required: ["isVehicle", "analysisA", "analysisB"]
          }
        },
      });

      // Extract generated text directly from response.text property (getter, not a method)
      const result = JSON.parse(response.text?.trim() || '{}');
      return {
        isVehicle: result.isVehicle ?? false,
        analysisA: result.analysisA,
        analysisB: result.analysisB
      };
    } catch (e: any) {
      // Handle invalid keys and requested entity not found by triggering UI selection
      if (e.message?.includes("400") || e.message?.includes("not valid") || e.message?.includes("Requested entity was not found")) throw new Error("API_KEY_INVALID");
      throw new Error(`Gemini 오류: ${e.message}`);
    }

  } else {
    // Access non-Gemini environment variables via import.meta.env to resolve TS errors
    const apiUrl = import.meta.env.VITE_ENDPOINT_URL;
    const apiKey = import.meta.env.VITE_GPT_API_KEY;
    
    if (!apiUrl || !apiKey) throw new Error("GPT_CONFIG_MISSING");

    onProgress(`Premium(GPT) 엔진 분석 중...`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey
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
      const errorData = await response.json().catch(() => ({}));
      const code = response.status;
      if (code === 401) throw new Error("GPT API 키가 유효하지 않습니다.");
      throw new Error(errorData.error?.message || `GPT API 오류 (${code})`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    const result = JSON.parse(content || "{}");
    
    return {
      isVehicle: result.analysisA?.status !== "NOT_VEHICLE" && result.analysisB?.status !== "EXCEPT",
      analysisA: result.analysisA,
      analysisB: result.analysisB
    };
  }
};