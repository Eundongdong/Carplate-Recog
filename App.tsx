
import { useState, useEffect } from 'react';
import Header from './components/Header';
import OcrVerificationResult from './components/OcrVerificationResult';
import { processCarImage } from './services/geminiService';
import { callNaverOcr } from './services/naverOcrService';
import { ComparisonResult, ProcessStatus } from './types';

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessStatus>(ProcessStatus.IDLE);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCorsError, setIsCorsError] = useState(false);
  
  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [naverUrl, setNaverUrl] = useState(localStorage.getItem('NAVER_OCR_URL') || '');
  const [naverSecret, setNaverSecret] = useState(localStorage.getItem('NAVER_OCR_SECRET') || '');
  const [corsProxy, setCorsProxy] = useState(localStorage.getItem('CORS_PROXY') || '');

  const saveSettings = () => {
    localStorage.setItem('NAVER_OCR_URL', naverUrl);
    localStorage.setItem('NAVER_OCR_SECRET', naverSecret);
    localStorage.setItem('CORS_PROXY', corsProxy);
    setIsSettingsOpen(false);
    setIsCorsError(false);
  };

  const useDemoProxy = () => {
    setCorsProxy('https://cors-anywhere.herokuapp.com/');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
        setIsCorsError(false);
        setStatus(ProcessStatus.IDLE);
      };
      reader.readAsDataURL(file);
    }
  };

  const startProcessing = async () => {
    if (!image) return;
    setStatus(ProcessStatus.VERIFYING);
    setError(null);
    setIsCorsError(false);
    setProgressMsg("Gemini 멀티 분석 수행 중...");

    try {
      const base64Data = image.split(',')[1];
      
      const comparison = await processCarImage(base64Data, (msg) => {
        setProgressMsg(msg);
      });

      if (comparison.analysisA.status === 'SUCCESS' || comparison.analysisB.status === 'SUCCESS') {
        setStatus(ProcessStatus.OCR_PROCESSING);
        setProgressMsg("Naver OCR 정밀 판독 중...");
        try {
          const ocrPlate = await callNaverOcr(base64Data);
          comparison.naverOcrPlate = ocrPlate;
        } catch (ocrErr: any) {
          console.error("OCR 단계 에러 감지:", ocrErr);
          if (ocrErr.message === "CORS_BLOCKED") {
            setIsCorsError(true);
          }
          comparison.naverOcrPlate = null;
        }
      }

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
    setIsCorsError(false);
    setStatus(ProcessStatus.IDLE);
    setProgressMsg("");
  };

  const hasNaverConfig = (process.env.NAVER_OCR_URL && process.env.NAVER_OCR_SECRET) || 
                         (localStorage.getItem('NAVER_OCR_URL') && localStorage.getItem('NAVER_OCR_SECRET'));

  return (
    <div className="min-h-screen pb-12 bg-slate-50 relative">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />
      
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Naver OCR API 설정
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Invoke URL</label>
                <input 
                  type="text" 
                  value={naverUrl}
                  onChange={(e) => setNaverUrl(e.target.value)}
                  placeholder="https://clovao.apigw.ntruss.com/..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Secret Key</label>
                <input 
                  type="password" 
                  value={naverSecret}
                  onChange={(e) => setNaverSecret(e.target.value)}
                  placeholder="여기에 시크릿 키 입력"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-blue-600 uppercase tracking-widest">CORS Proxy (우회)</label>
                  <button 
                    onClick={useDemoProxy}
                    className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold border border-blue-100 hover:bg-blue-100 transition-colors"
                  >
                    데모용 프록시 입력
                  </button>
                </div>
                <input 
                  type="text" 
                  value={corsProxy}
                  onChange={(e) => setCorsProxy(e.target.value)}
                  placeholder="https://cors-anywhere.herokuapp.com/"
                  className={`w-full px-4 py-3 bg-blue-50/50 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${isCorsError ? 'border-red-400 animate-pulse' : 'border-blue-100'}`}
                />
                <div className="mt-3 space-y-2">
                   <p className="text-[10px] text-slate-500 leading-normal">
                    * 브라우저 보안상 외부 API 직접 호출이 차단될 수 있습니다. 
                  </p>
                  <div className="p-3 bg-slate-100 rounded-lg text-[10px] text-slate-600 font-medium">
                    <p className="font-bold text-slate-800 mb-1">사용 가이드:</p>
                    1. '데모용 프록시' 버튼 클릭<br/>
                    2. <a href="https://cors-anywhere.herokuapp.com/corsdemo" target="_blank" className="text-blue-600 underline">이 링크(cors-anywhere)</a> 접속 후 활성화 버튼 클릭<br/>
                    3. 저장 후 다시 분석
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
              >
                취소
              </button>
              <button 
                onClick={saveSettings}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all text-sm"
              >
                설정 저장
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 업로드 섹션 */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 sticky top-8">
              <h2 className="text-lg font-bold mb-4 text-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-blue-600 rounded-full"></span>
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
                  <div className="text-center p-4 text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs">이미지 업로드</p>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={status === ProcessStatus.VERIFYING || status === ProcessStatus.OCR_PROCESSING}
                />
              </div>

              <button
                onClick={startProcessing}
                disabled={!image || status === ProcessStatus.VERIFYING || status === ProcessStatus.OCR_PROCESSING}
                className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 shadow-lg shadow-blue-200 transition-all text-sm"
              >
                {status === ProcessStatus.IDLE ? '분석 시작하기' : '처리 중...'}
              </button>
            </div>
          </div>

          {/* 결과 섹션 */}
          <div className="lg:col-span-9 space-y-6">
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 h-full min-h-[500px]">
              <h2 className="text-xl font-bold mb-8 text-slate-800 flex items-center gap-2">
                <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
                지능형 교차 검증 대시보드
              </h2>

              {status === ProcessStatus.IDLE && (
                <div className="h-64 flex flex-col items-center justify-center text-slate-300 border-2 border-dashed rounded-3xl space-y-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm font-medium">분석할 이미지를 업로드해 주세요.</p>
                </div>
              )}

              {(status === ProcessStatus.VERIFYING || status === ProcessStatus.OCR_PROCESSING) && (
                <div className="py-24 flex flex-col items-center gap-6">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-800 text-lg">{progressMsg}</p>
                    <p className="text-slate-400 text-sm mt-1">분석 A, B 결과를 바탕으로 Naver OCR 연동 여부를 판단합니다.</p>
                  </div>
                </div>
              )}

              {status === ProcessStatus.ERROR && (
                <div className="bg-red-50 p-8 rounded-3xl border border-red-100 text-center space-y-4">
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-red-700 font-bold">{error}</p>
                  <button onClick={reset} className="text-sm text-red-500 font-bold underline">다시 시도하기</button>
                </div>
              )}

              {status === ProcessStatus.SUCCESS && result && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  
                  {result.naverOcrPlate && (
                    <OcrVerificationResult plate={result.naverOcrPlate} />
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                    {/* 분석 A */}
                    <div className="flex flex-col border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
                      <div className="bg-slate-800 text-white px-4 py-3 text-[10px] font-black uppercase tracking-widest flex justify-between items-center">
                        <span>분석 A</span>
                        <span className="opacity-40 italic">Gemini v3.0</span>
                      </div>
                      <div className="p-5 space-y-4 flex-grow flex flex-col">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Status</label>
                          <div className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block ${
                            result.analysisA.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-500'
                          }`}>
                            {result.analysisA.status}
                          </div>
                        </div>
                        
                        <div className="space-y-1.5">
                          <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Plate Recognition</label>
                          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
                            <span className="text-xl font-mono font-black text-slate-800 tracking-tighter">
                              {result.analysisA.plate || "No Data"}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-50 flex-grow">
                          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                            {result.analysisA.message}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 분석 B */}
                    <div className="flex flex-col border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm transition-all hover:shadow-md">
                      <div className="bg-blue-600 text-white px-4 py-3 text-[10px] font-black uppercase tracking-widest flex justify-between items-center">
                        <span>분석 B</span>
                        <span className="opacity-40 italic">Gemini v3.0</span>
                      </div>
                      <div className="p-5 space-y-4 flex-grow flex flex-col">
                         <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Status</label>
                          <div className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block ${
                            result.analysisB.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 
                            result.analysisB.status === 'ISSUE' ? 'bg-orange-50 text-orange-500' : 'bg-red-50 text-red-500'
                          }`}>
                            {result.analysisB.status}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Plate Recognition</label>
                          <div className="bg-blue-50/30 border border-blue-100 p-3 rounded-xl text-center">
                            <span className="text-xl font-mono font-black text-blue-700 tracking-tighter">
                              {result.analysisB.plate || "No Data"}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-50 flex-grow">
                           <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                             {result.analysisB.message}
                           </p>
                        </div>
                      </div>
                    </div>

                    {/* 분석 C (Naver OCR) */}
                    <div className={`flex flex-col border rounded-3xl overflow-hidden shadow-sm transition-all hover:shadow-md ${
                      result.naverOcrPlate ? 'border-emerald-100 bg-white' : 'border-slate-100 bg-slate-50/50'
                    }`}>
                      <div className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest flex justify-between items-center ${
                        result.naverOcrPlate ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                      }`}>
                        <span>분석 C</span>
                        <span className="opacity-40 italic">Naver Clova OCR</span>
                      </div>
                      <div className="p-5 space-y-4 flex-grow flex flex-col">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">System Check</label>
                          <div className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-block ${
                            result.naverOcrPlate ? 'bg-emerald-50 text-emerald-600' : isCorsError ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {result.naverOcrPlate ? 'VERIFIED' : isCorsError ? 'CORS BLOCKED' : 'SKIPPED/FAIL'}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">OCR Extraction</label>
                          <div className={`p-3 rounded-xl text-center border ${
                            result.naverOcrPlate ? 'bg-emerald-50 border-emerald-200' : isCorsError ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'
                          }`}>
                            <span className={`text-xl font-mono font-black tracking-tighter ${
                              result.naverOcrPlate ? 'text-emerald-700' : isCorsError ? 'text-red-400' : 'text-slate-300'
                            }`}>
                              {result.naverOcrPlate || (isCorsError ? "CORS ERR" : "No Data")}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-50 flex-grow">
                           {isCorsError ? (
                             <div className="bg-red-50 p-2.5 rounded-xl border border-red-100 text-[10px] space-y-1.5">
                               <p className="text-red-700 font-bold">브라우저 보안으로 차단되었습니다.</p>
                               <button 
                                onClick={() => setIsSettingsOpen(true)}
                                className="w-full py-1.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-sm"
                               >
                                 CORS 프록시 설정하기
                               </button>
                             </div>
                           ) : !hasNaverConfig ? (
                             <div className="text-[10px] text-blue-600 font-bold bg-blue-50 p-2 rounded-lg border border-blue-100">
                               설정에서 Naver API 정보를 입력하면 정밀 판독 결과가 여기에 표시됩니다. 
                               <button onClick={() => setIsSettingsOpen(true)} className="ml-1 underline">설정 열기</button>
                             </div>
                           ) : (
                             <p className="text-[11px] text-slate-500 leading-relaxed font-medium italic">
                               {result.naverOcrPlate 
                                 ? "네이버 OCR 엔진을 통해 가장 높은 신뢰도의 텍스트가 추출되었습니다." 
                                 : "차량 미인식 또는 번호판 부재로 OCR 분석을 건너뛰었습니다."}
                             </p>
                           )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-4 pt-6">
                    <button 
                      onClick={reset} 
                      className="group flex items-center gap-2 px-8 py-3 bg-white text-slate-500 text-sm font-bold border border-slate-200 rounded-full hover:bg-slate-50 hover:text-slate-800 transition-all shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      다른 사진 분석하기
                    </button>
                    <p className="text-[10px] text-slate-300 font-medium uppercase tracking-widest">Data Cross-Verification Module v2.1</p>
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
