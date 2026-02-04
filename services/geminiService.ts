
import { GoogleGenAI, Type } from "@google/genai";
import { DetectionResult } from "../types";

export const processCarImage = async (
  base64Image: string, 
  onProgress: (status: string) => void
): Promise<DetectionResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key가 설정되지 않았습니다.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const modelName = 'gemini-3-flash-preview';

  try {
    onProgress("차량 상태 및 파손 여부 분석 중...");

    const prompt = `
[Role]
You are a vehicle image classifier and damage inspector.

[Analysis Process - Step by Step]
Step 1. Identify if the image is related to a vehicle. 
- This includes not only the full view of the car, but also close-ups of specific parts (e.g., bumper, door, wheel, headlight, engine room, etc.).
- Even if the image is dark, blurry, or only shows a small part of the vehicle, as long as it is a part of a vehicle, consider it a "Vehicle Picture."

Step 2. If it is a "Vehicle Picture," inspect for serious damage.
- "Serious damage" includes large dents, cracks, broken parts, or significant deformation.
- Ignore minor scratches, light reflections, or dirt.

Step 3. If it is a vehicle picture, identify the license plate number.
- The format must follow the Korean standard (e.g., 12가3456 or 123가4567).
- If multiple texts are detected, select the one that matches the vehicle license plate format.

[Response Format Rules]
1) If NOT a picture of a vehicle: status "EXCEPT", message "차량 사진이 아닙니다."
2) If vehicle picture AND serious damage detected: status "ISSUE", message "차량 파손 여부가 확인됩니다."
3) If vehicle picture AND NO serious damage: status "SUCCESS", extract license plate.
`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { 
              type: Type.STRING, 
              description: "Status based on analysis: EXCEPT, ISSUE, or SUCCESS"
            },
            message: { 
              type: Type.STRING, 
              description: "Description message for EXCEPT or ISSUE status"
            },
            plate: { 
              type: Type.STRING, 
              description: "Extracted Korean license plate number (e.g., 00가0000). Null if not found."
            }
          },
          required: ["status"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");

    if (result.status === "EXCEPT") {
      return { 
        isVehicle: false, 
        plateNumber: null, 
        error: result.message || "차량 사진이 아닙니다." 
      };
    }

    if (result.status === "ISSUE") {
      return { 
        isVehicle: true, 
        plateNumber: result.plate || null, 
        error: result.message || "차량 파손 여부가 확인됩니다." 
      };
    }

    if (result.status === "SUCCESS") {
      if (!result.plate) {
        return {
          isVehicle: true,
          plateNumber: null,
          error: "차량은 확인되었으나 번호판을 읽을 수 없습니다."
        };
      }
      return {
        isVehicle: true,
        plateNumber: result.plate,
      };
    }

    throw new Error("분석 결과 형식이 올바르지 않습니다.");

  } catch (error: any) {
    console.error("Processing Error:", error);
    return { 
      isVehicle: false, 
      plateNumber: null, 
      error: error.message || "분석 과정 중 오류가 발생했습니다." 
    };
  }
};
