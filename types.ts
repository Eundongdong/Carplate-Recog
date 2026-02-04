
export interface AnalysisA {
  status: 'SUCCESS' | 'NOT_VEHICLE' | 'VEHICLE_NO_PLATE';
  plate: string | null;
  message: string;
}

export interface AnalysisB {
  status: 'SUCCESS' | 'EXCEPT' | 'ISSUE';
  plate: string | null;
  message: string;
}

export interface ComparisonResult {
  isVehicle: boolean;
  analysisA: AnalysisA;
  analysisB: AnalysisB;
  naverOcrPlate?: string | null;
}

export enum ProcessStatus {
  IDLE = 'IDLE',
  VERIFYING = 'VERIFYING',
  OCR_PROCESSING = 'OCR_PROCESSING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
