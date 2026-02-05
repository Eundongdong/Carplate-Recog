
import React from 'react';

interface OcrVerificationResultProps {
  plate: string;
}

const OcrVerificationResult: React.FC<OcrVerificationResultProps> = ({ plate }) => {
  return (
    <div className="bg-[#0F172A] rounded-2xl p-4 text-white shadow-md relative overflow-hidden group border border-slate-800 animate-in fade-in zoom-in duration-300">
      {/* 배경 패턴 간소화 */}
      <div className="absolute -top-6 -right-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      </div>
      
      <div className="relative z-10 flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 backdrop-blur-md px-2 py-0.5 rounded-md border border-emerald-500/20">
            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[8px] font-black tracking-widest uppercase text-emerald-400">OCR 검증 완료</span>
          </div>
          <h3 className="text-base font-black tracking-tight">정밀 OCR 판독</h3>
          <p className="text-slate-500 text-[9px] font-medium">Naver Clova V2 Engine</p>
        </div>

        <div className="bg-white text-slate-900 px-6 py-2 rounded-xl shadow-lg border-2 border-blue-500/10 flex items-center justify-center min-w-[180px]">
          <span className="text-2xl font-black font-mono tracking-tighter">
            {plate}
          </span>
        </div>
      </div>
    </div>
  );
};

export default OcrVerificationResult;
