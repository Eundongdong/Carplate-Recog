
import React from 'react';

interface OcrVerificationResultProps {
  plate: string;
}

const OcrVerificationResult: React.FC<OcrVerificationResultProps> = ({ plate }) => {
  return (
    <div className="bg-gradient-to-br from-indigo-600 to-blue-800 rounded-3xl p-6 text-white shadow-2xl shadow-indigo-200 overflow-hidden relative animate-in fade-in zoom-in duration-500">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      
      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-left space-y-2">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black tracking-widest uppercase">Premium Verification Active</span>
          </div>
          <h3 className="text-2xl font-bold tracking-tight">최종 정밀 검증 결과</h3>
          <p className="text-blue-100 text-sm font-medium opacity-80">
            ChatGPT-4o와 Naver OCR이 협력하여 판독한 데이터입니다.
          </p>
        </div>

        <div className="flex flex-col items-center">
          <div className="bg-white text-slate-900 px-10 py-4 rounded-2xl shadow-2xl border-4 border-indigo-400/30 flex items-center justify-center min-w-[240px]">
            <span className="text-5xl font-black font-mono tracking-tighter sm:text-6xl">
              {plate}
            </span>
          </div>
          <div className="mt-2 text-[10px] text-indigo-200 font-bold uppercase tracking-[0.2em]">
            Digital Plate Identity
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-center gap-4 text-[10px] font-bold text-blue-200 uppercase tracking-widest">
        <span>ChatGPT-4o</span>
        <span className="w-1 h-1 bg-white/30 rounded-full"></span>
        <span>Clova OCR V2</span>
        <span className="w-1 h-1 bg-white/30 rounded-full"></span>
        <span>Cross-Verified</span>
      </div>
    </div>
  );
};

export default OcrVerificationResult;
