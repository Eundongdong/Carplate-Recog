
import React, { useState } from 'react';
import Header from './components/Header';
import { processCarImage } from './services/geminiService';
import { DetectionResult, ProcessStatus } from './types';

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessStatus>(ProcessStatus.IDLE);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
        setStatus(ProcessStatus.IDLE);
      };
      reader.readAsDataURL(file);
    }
  };

  const startProcessing = async () => {
    if (!image) return;

    setStatus(ProcessStatus.VERIFYING);
    setError(null);

    try {
      const base64Data = image.split(',')[1];
      const detection = await processCarImage(base64Data, (msg) => {
        setProgressMsg(msg);
      });

      setResult(detection);
      
      if (detection.error) {
        // ISSUE 상태(파손)여도 번호판이 있을 수 있으므로 SUCCESS와 ERROR를 구분
        if (detection.isVehicle && detection.plateNumber) {
          setStatus(ProcessStatus.SUCCESS);
        } else {
          setError(detection.error);
          setStatus(ProcessStatus.ERROR);
        }
      } else {
        setStatus(ProcessStatus.SUCCESS);
      }
    } catch (err: any) {
      setError(err.message || "시스템 오류가 발생했습니다.");
      setStatus(ProcessStatus.ERROR);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setStatus(ProcessStatus.IDLE);
    setProgressMsg("");
  };

  return (
    <div className="min-h-screen pb-12 bg-slate-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Input Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
              <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                차량 이미지 업로드
              </h2>
              
              <div 
                className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all overflow-hidden ${
                  image ? 'border-blue-500 bg-blue-50/5' : 'border-slate-200 hover:border-blue-300 py-16 bg-slate-50/50'
                }`}
              >
                {image ? (
                  <div className="relative w-full aspect-[4/3]">
                    <img src={image} alt="Car preview" className="w-full h-full object-contain" />
                    <button 
                      onClick={reset}
                      className="absolute top-4 right-4 bg-white shadow-lg text-slate-600 p-2 rounded-full hover:bg-red-50 hover:text-red-500 transition-all z-10"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-100 p-5 rounded-3xl mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <p className="text-slate-700 font-bold mb-1">파일 선택 또는 드래그</p>
                    <p className="text-slate-400 text-sm px-8 text-center">차량의 일부분이라도 포함되면 인식이 가능합니다</p>
                  </>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={status === ProcessStatus.VERIFYING}
                />
              </div>

              <button
                onClick={startProcessing}
                disabled={!image || status === ProcessStatus.VERIFYING}
                className={`w-full mt-8 py-4 px-6 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${
                  !image || status === ProcessStatus.VERIFYING
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-200'
                }`}
              >
                {status === ProcessStatus.VERIFYING ? (
                  <>
                    <div className="animate-spin h-6 w-6 border-4 border-white/30 border-t-white rounded-full"></div>
                    인식 진행 중...
                  </>
                ) : (
                  <>번호판 인식 시작</>
                )}
              </button>
            </div>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 h-full min-h-[450px] flex flex-col">
              <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                분석 결과
              </h2>
              
              <div className="flex-grow flex flex-col justify-center">
                {status === ProcessStatus.IDLE && (
                  <div className="text-center space-y-4 py-12">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-slate-400 font-medium leading-relaxed">
                      AI가 차량 여부와 파손 상태를 판별하고<br/>번호판을 자동으로 추출합니다.
                    </p>
                  </div>
                )}

                {status === ProcessStatus.VERIFYING && (
                  <div className="space-y-8 py-8 px-4">
                    <div className="flex flex-col items-center gap-6">
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-slate-800">{progressMsg}</p>
                        <p className="text-slate-400 mt-2 text-sm">Gemini 멀티모달 엔진이 이미지를 분석하고 있습니다.</p>
                      </div>
                    </div>
                  </div>
                )}

                {status === ProcessStatus.ERROR && (
                  <div className="bg-red-50 border border-red-100 p-8 rounded-3xl text-center space-y-4">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-red-900 font-bold text-lg mb-1">인식 제한</h3>
                      <p className="text-red-600 text-sm leading-relaxed">{error}</p>
                    </div>
                    <button onClick={reset} className="w-full bg-white text-red-600 border border-red-200 py-3 rounded-xl font-bold hover:bg-red-50 transition-all">다시 시도</button>
                  </div>
                )}

                {status === ProcessStatus.SUCCESS && result && (
                  <div className="space-y-8 animate-in fade-in zoom-in duration-300">
                    <div className="text-center space-y-2">
                      <span className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">Analysis Complete</span>
                      <h3 className="text-slate-500 font-medium">인식된 정보</h3>
                    </div>

                    {result.error && (
                      <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-center gap-3">
                        <div className="bg-amber-100 p-2 rounded-full">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <p className="text-amber-800 text-sm font-semibold">{result.error}</p>
                      </div>
                    )}

                    <div className="relative group">
                      <div className="absolute inset-0 bg-blue-600 blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
                      <div className="relative bg-slate-900 text-white rounded-3xl p-10 text-center border-b-4 border-slate-700 shadow-2xl">
                        <div className="text-6xl font-black tracking-tight sm:text-7xl font-mono">
                          {result.plateNumber || "인식 불가"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <ResultBadge label="차량 여부" value={result.isVehicle ? "확인됨" : "미확인"} />
                      <ResultBadge label="파손 여부" value={result.error?.includes("파손") ? "파손 확인" : "이상 없음"} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const ResultBadge = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">{label}</p>
    <p className="text-xs text-slate-700 font-black truncate">{value}</p>
  </div>
);

export default App;
