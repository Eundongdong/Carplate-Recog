
import { useState } from 'react';
import Header from './components/Header';
import { processCarImage } from './services/geminiService';
import { ComparisonResult, ProcessStatus } from './types';

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessStatus>(ProcessStatus.IDLE);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [result, setResult] = useState<ComparisonResult | null>(null);
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
    setProgressMsg("멀티 분석 수행 중...");

    try {
      const base64Data = image.split(',')[1];
      const comparison = await processCarImage(base64Data, (msg) => {
        setProgressMsg(msg);
      });
      setResult(comparison);
      setStatus(ProcessStatus.SUCCESS);
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
      
      <main className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 업로드 섹션 */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 sticky top-8">
              <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
                차량 이미지
              </h2>
              
              <div 
                className={`relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all overflow-hidden aspect-square ${
                  image ? 'border-blue-500 bg-blue-50/5' : 'border-slate-200 hover:border-blue-300 bg-slate-50/50'
                }`}
              >
                {image ? (
                  <div className="w-full h-full relative">
                    <img src={image} alt="Preview" className="w-full h-full object-contain p-2" />
                    <button 
                      onClick={reset}
                      className="absolute top-2 right-2 bg-white/90 backdrop-blur shadow p-1.5 rounded-full hover:text-red-500 transition-all z-10"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <p className="text-slate-400 text-sm">클릭하여 이미지 업로드</p>
                  </div>
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
                className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 shadow-lg shadow-blue-200"
              >
                {status === ProcessStatus.VERIFYING ? '비교 분석 중...' : '분석 결과 비교하기'}
              </button>
            </div>
          </div>

          {/* 결과 비교 섹션 */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 h-full">
              <h2 className="text-xl font-bold mb-8 text-slate-800 flex items-center gap-2">
                <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                프롬프트 성능 비교
              </h2>

              {status === ProcessStatus.IDLE && (
                <div className="h-64 flex items-center justify-center text-slate-300 border-2 border-dashed rounded-3xl">
                  분석할 이미지를 업로드해 주세요.
                </div>
              )}

              {status === ProcessStatus.VERIFYING && (
                <div className="py-20 flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="font-bold text-slate-600">{progressMsg}</p>
                </div>
              )}

              {status === ProcessStatus.ERROR && (
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100 text-red-600 font-medium">
                  {error}
                </div>
              )}

              {status === ProcessStatus.SUCCESS && result && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  {/* 결과 A */}
                  <div className="flex flex-col border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
                    <div className="bg-slate-800 text-white px-5 py-3 text-xs font-bold uppercase tracking-wider flex justify-between items-center">
                      <span>분석 A</span>
                      <span className="text-[10px] opacity-60 font-normal italic">License Focus</span>
                    </div>
                    <div className="p-6 space-y-4 flex-grow">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Status</label>
                        <div className={`text-sm font-black ${
                          result.analysisA.status === 'SUCCESS' ? 'text-emerald-600' : 'text-orange-500'
                        }`}>
                          {result.analysisA.status}
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Plate Recognition</label>
                        <div className="bg-white border-2 border-slate-800 p-4 rounded-xl text-center shadow-sm">
                          <span className="text-3xl font-mono font-black text-slate-900 tracking-tighter leading-none">
                            {result.analysisA.plate || "N/A"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Description</label>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">{result.analysisA.message}</p>
                      </div>
                    </div>
                  </div>

                  {/* 결과 B */}
                  <div className="flex flex-col border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
                    <div className="bg-blue-600 text-white px-5 py-3 text-xs font-bold uppercase tracking-wider flex justify-between items-center">
                      <span>분석 B</span>
                      <span className="text-[10px] opacity-60 font-normal italic">Damage & Plate</span>
                    </div>
                    <div className="p-6 space-y-4 flex-grow">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Status</label>
                        <div className={`px-4 py-2 rounded-lg font-bold text-center border-2 text-xs ${
                          result.analysisB.status === 'SUCCESS' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' :
                          result.analysisB.status === 'ISSUE' ? 'bg-orange-50 border-orange-500 text-orange-700' :
                          'bg-red-50 border-red-500 text-red-700'
                        }`}>
                          {result.analysisB.status}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Plate Recognition</label>
                        <div className="bg-white border-2 border-blue-600 p-4 rounded-xl text-center shadow-sm">
                          <span className="text-3xl font-mono font-black text-blue-600 tracking-tighter leading-none">
                            {result.analysisB.plate || "N/A"}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Description</label>
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                           <p className="text-xs font-medium text-slate-700 leading-relaxed">
                             {result.analysisB.message}
                           </p>
                        </div>
                      </div>

                      <div className="mt-2 pt-4 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Vehicle Identified</span>
                        <div className={`w-2.5 h-2.5 rounded-full ${result.isVehicle ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`}></div>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
