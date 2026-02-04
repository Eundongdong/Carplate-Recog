
export interface DetectionResult {
  isVehicle: boolean;
  plateNumber: string | null;
  confidence?: number;
  error?: string;
}

export enum ProcessStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  VERIFYING = 'VERIFYING',
  EXTRACTING = 'EXTRACTING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
