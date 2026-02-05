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

  
  
  const systemInstruction = `You are a specialized vehicle inspection AI.
  
  CRITICAL STEP 1: Determine if the image contains a vehicle (car, truck, bus, or recognizable vehicle parts).
  - If the image is NOT a vehicle, set "isVehicle" to false.
  - If it IS a vehicle, set "isVehicle" to true.
  
  STEP 2 (Only if it's a vehicle):
  - Analysis A: Extract the Korean license plate number.
  - Analysis B: Describe the vehicle's condition or issues.
  
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