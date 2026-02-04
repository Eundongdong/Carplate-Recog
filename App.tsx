
import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import OcrVerificationResult from './components/OcrVerificationResult';
import { processCarImage } from './services/geminiService';
import { callNaverOcr } from './services/naverOcrService';
import { ComparisonResult, ProcessStatus, AIModelType } from './types';

const DEFAULT_PROMPT_A = `[CRITERIA SET A - License Plate Extraction]
1. Determine if it's a vehicle.
2. If NOT, status: "NOT_VEHICLE", message: "차량 사진이 아닙니다."
3. If IS, extract Korean license plate.
4. If plate is missing/unreadable, status: "VEHICLE_NO_PLATE", message: "번호판을 찾을 수 없습니다."
5. If plate found, status: "SUCCESS", message: "성공".`;

const DEFAULT_PROMPT_B = `[CRITERIA SET B - Vehicle Condition Analysis]
Step 1: Determine whether the image contains a vehicle. (Cars, trucks, buses, motorcycles, parts like plates, wheels, bumpers).
- If no vehicle: status: "EXCEPT", message: "차량 사진이 아닙니다.", plate: null.
Step 2: If vehicle, check for serious damage.
- If serious damage: status: "ISSUE", message: "차량 파손 여부가 확인됩니다."
- If no serious damage: status: "SUCCESS", message: "정상 차량입니다."
Step 3: Extract license plate into 'plate' field if visible.`;

const App: React.FC = () => {
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [aiModel, setAiModel] = useState<AIModelType>('gemini');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  
  const [status, setStatus] = useState<ProcessStatus>(ProcessStatus.IDLE);
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isCorsError, setIsCorsError] = useState(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [corsProxy, setCorsProxy] = useState(localStorage.getItem('CORS_PROXY') || '');
  const [promptA, setPromptA] = useState(localStorage.getItem('CUSTOM_PROMPT_A') || DEFAULT_PROMPT_A);
  const [promptB, setPromptB] = useState(localStorage.getItem('CUSTOM_PROMPT_B') || DEFAULT_PROMPT_B);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveSettings = () => {
    localStorage.setItem('CORS_PROXY', corsProxy);
    localStorage.setItem('CUSTOM_PROMPT_A', promptA);
    localStorage.setItem('CUSTOM_PROMPT_B', promptB);
    setIsSettingsOpen(false);
  };

  const handleModelToggle = (model: AIModelType) => {
    if (model === 'gpt4o') {
      if (!isAuthenticated) {
        setShowPasswordInput(true);
        setPasswordInput("");
      } else {
        setAiModel('gpt4o');
      }
    } else {
      setAiModel('gemini');
    }
  };

  const verifyPassword = () => {
    console.log(passwordInput)
    if (passwordInput === process.env.PASSWORD) {
      
      setIsAuthenticated(true);
      setAiModel('gpt4o');
      setShowPasswordInput(false);
      alert("Premium 인증 완료: ChatGPT-4o 엔진과 Naver OCR 정밀 판독 기능이 활성화되었습니다.");
    } else {
      alert("비밀번호가 일치하지 않습니다.");
    }
  };

  const useDemoProxy = () => setCorsProxy('https://cors-anywhere.herokuapp.com/');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setBatchProgress({ current: 0, total: files.length });
    setError(null);
    setIsCorsError(false);

    const fileList = Array.from(files);
    
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setBatchProgress({ current: i + 1, total: fileList.length });
      setProgressMsg(`${file.name} 분석 중...`);
      
      try {
        const base64 = await fileToBase64(file);
        const base64Data = base64.split(',')[1];
        
        setStatus(ProcessStatus.VERIFYING);
        const comparison = await processCarImage(
          base64Data, 
          (msg) => setProgressMsg(msg),
          promptA,
          promptB,
          aiModel
        );

        let naverOcrPlate = null;
        // Premium 인증 상태에서만 Naver OCR 호출
        if (isAuthenticated && (comparison.analysisA.status === 'SUCCESS' || comparison.analysisB.status === 'SUCCESS')) {
          setStatus(ProcessStatus.OCR_PROCESSING);
          setProgressMsg("Naver OCR 정밀 대조 중...");
          try {
            naverOcrPlate = await callNaverOcr(base64Data);
          } catch (ocrErr: any) {
            console.error("OCR 단계 에러:", ocrErr);
            if (ocrErr.message === "CORS_BLOCKED") setIsCorsError(true);
          }
        }

        const newResult: ComparisonResult = {
          ...comparison,
          id: `res-${Date.now()}-${i}`,
          timestamp: Date.now(),
          originalImage: base64,
          fileName: file.name,
          naverOcrPlate,
          modelUsed: aiModel
        };

        setResults(prev => [newResult, ...prev]);
        setSelectedIndex(0); 
        setStatus(ProcessStatus.SUCCESS);
      } catch (err: any) {
        setError(`${file.name}: ${err.message}`);
        setStatus(ProcessStatus.ERROR);
      }
    }

    setIsProcessing(false);
    setBatchProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const clearAll = () => {
    if (window.confirm("모든 분석 내역을 삭제하시겠습니까?")) {
      setResults([]); setSelectedIndex(null); setError(null); setStatus(ProcessStatus.IDLE);
    }
  };

  const activeResult = selectedIndex !== null ? results[selectedIndex] : null;

  return (
    <div className="min-h-screen pb-20 bg-slate-50 relative">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />
      
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                시스템 구성
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" /></svg>
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">AI Model Engine</h4>
                  {isAuthenticated && <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 uppercase">Premium Active</span>}
                </div>
                <div className="flex p-1 bg-slate-100 rounded-2xl relative">
                  <button 
                    onClick={() => handleModelToggle('gemini')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${aiModel === 'gemini' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    Gemini 3 Pro (Standard)
                  </button>
                  <button 
                    onClick={() => handleModelToggle('gpt4o')}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${aiModel === 'gpt4o' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    ChatGPT-4o + NaverOCR (Premium)
                  </button>
                </div>
                
                {showPasswordInput && (
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl animate-in slide-in-from-top-2">
                    <p className="text-xs font-bold text-indigo-700 mb-2">Premium 활성화를 위해 비밀번호를 입력하세요.</p>
                    <div className="flex gap-2">
                      <input 
                        type="password" 
                        value={passwordInput} 
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Password"
                        className="flex-1 px-4 py-2 bg-white border border-indigo-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button onClick={verifyPassword} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">인증</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Proxy Settings</h4>
                <div className="space-y-2">
                   <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-bold text-blue-600 uppercase">CORS Proxy 주소</label>
                      <button onClick={useDemoProxy} className="text-[9px] text-blue-500 font-bold hover:underline">데모용 주소 사용</button>
                   </div>
                   <input type="text" value={corsProxy} onChange={(e) => setCorsProxy(e.target.value)} placeholder="https://cors-anywhere.herokuapp.com/" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Prompt Customization</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">프롬프트 A</label>
                    <textarea value={promptA} onChange={(e) => setPromptA(e.target.value)} className="w-full h-24 px-3 py-2 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-xl resize-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">프롬프트 B</label>
                    <textarea value={promptB} onChange={(e) => setPromptB(e.target.value)} className="w-full h-24 px-3 py-2 bg-slate-900 text-blue-400 font-mono text-[10px] rounded-xl resize-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button onClick={() => {setPromptA(DEFAULT_PROMPT_A); setPromptB(DEFAULT_PROMPT_B);}} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm">기본값</button>
              <div className="flex-1"></div>
              <button onClick={saveSettings} className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg text-sm">저장</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          <div className="lg:col-span-4">
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-6 sticky top-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-blue-600 rounded-full"></span>
                  Detail View
                </h2>
                <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${aiModel === 'gpt4o' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  {aiModel} {isAuthenticated && "+ OCR"}
                </div>
              </div>
              
              <div className="relative border-2 border-dashed rounded-[1.5rem] flex flex-col items-center justify-center transition-all overflow-hidden aspect-video bg-slate-50/50 border-slate-200">
                {isProcessing && (
                  <div className="absolute inset-0 z-20 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-in fade-in">
                    <div className="relative mb-6">
                      <div className="w-20 h-20 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-black text-blue-600">{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Processing Batch</p>
                      <h4 className="text-xl font-black text-slate-800">
                         {batchProgress.total}개 중 {batchProgress.current}번째 분석 중
                      </h4>
                      <p className="text-xs text-slate-400 mt-2 font-medium italic animate-pulse">{progressMsg}</p>
                    </div>
                  </div>
                )}

                {activeResult ? (
                  <img src={activeResult.originalImage} alt="Detail" className="w-full h-full object-contain p-2" />
                ) : !isProcessing && (
                  <div className="text-center p-8 text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-3 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <p className="text-[11px] font-black uppercase tracking-widest">분석을 시작하세요</p>
                  </div>
                )}

                {!isProcessing && (
                  <div className="absolute bottom-4 right-4 z-30">
                    <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 text-white p-4 rounded-2xl shadow-2xl hover:bg-blue-700 transition-all active:scale-95 group">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
                  </div>
                )}
              </div>

              {error && (
                 <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl">
                    <p className="text-[11px] text-red-600 font-bold uppercase mb-1">Error</p>
                    <p className="text-xs text-red-800 font-medium leading-tight">{error}</p>
                 </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-8 min-h-[500px] flex flex-col">
              {activeResult ? (
                <div className="space-y-8 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                    <div>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight">{activeResult.fileName}</h3>
                      <p className="text-[10px] text-slate-400 font-mono tracking-widest mt-0.5">{new Date(activeResult.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${activeResult.modelUsed === 'gpt4o' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-white'}`}>
                        {activeResult.modelUsed}
                       </span>
                       {activeResult.naverOcrPlate && (
                         <div className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-lg shadow-emerald-100">
                           PREMIUM VERIFIED
                         </div>
                       )}
                    </div>
                  </div>

                  {activeResult.naverOcrPlate && <OcrVerificationResult plate={activeResult.naverOcrPlate} />}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex flex-col border border-slate-100 rounded-[1.5rem] overflow-hidden shadow-sm bg-white hover:shadow-md transition-shadow">
                      <div className="bg-slate-800 text-white px-4 py-2.5 text-[10px] font-black uppercase flex justify-between">
                        <span>Analysis A</span>
                      </div>
                      <div className="p-6 space-y-4">
                        <div className={`text-[10px] font-black px-3 py-1 rounded-full inline-block ${activeResult.analysisA.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-500'}`}>{activeResult.analysisA.status}</div>
                        <div className="bg-slate-50 border border-slate-200 py-3 rounded-2xl text-center">
                          <span className="text-xl font-mono font-black text-slate-800">{activeResult.analysisA.plate || "No Data"}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{activeResult.analysisA.message}</p>
                      </div>
                    </div>

                    <div className="flex flex-col border border-slate-100 rounded-[1.5rem] overflow-hidden shadow-sm bg-white hover:shadow-md transition-shadow">
                      <div className="bg-blue-600 text-white px-4 py-2.5 text-[10px] font-black uppercase flex justify-between">
                        <span>Analysis B</span>
                      </div>
                      <div className="p-6 space-y-4">
                         <div className={`text-[10px] font-black px-3 py-1 rounded-full inline-block ${activeResult.analysisB.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-500'}`}>{activeResult.analysisB.status}</div>
                         <div className="bg-blue-50/30 border border-blue-100 py-3 rounded-2xl text-center">
                           <span className="text-xl font-mono font-black text-blue-700">{activeResult.analysisB.plate || "No Data"}</span>
                         </div>
                         <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{activeResult.analysisB.message}</p>
                      </div>
                    </div>

                    <div className={`flex flex-col border rounded-[1.5rem] overflow-hidden shadow-sm transition-all ${activeResult.naverOcrPlate ? 'bg-emerald-50/20 border-emerald-100' : 'bg-slate-50/50 border-slate-100 opacity-60'}`}>
                      <div className={`px-4 py-2.5 text-[10px] font-black uppercase flex justify-between ${activeResult.naverOcrPlate ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                        <span>Analysis C</span>
                        <span className="opacity-40">NAVER OCR</span>
                      </div>
                      <div className="p-6 space-y-4">
                        <div className={`text-[10px] font-black px-3 py-1 rounded-full inline-block ${activeResult.naverOcrPlate ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                          {activeResult.naverOcrPlate ? 'VERIFIED' : 'STANDBY'}
                        </div>
                        <div className={`py-3 rounded-2xl text-center border ${activeResult.naverOcrPlate ? 'bg-white border-emerald-200' : 'bg-white border-slate-100'}`}>
                           <span className={`text-xl font-mono font-black ${activeResult.naverOcrPlate ? 'text-emerald-700' : 'text-slate-200'}`}>{activeResult.naverOcrPlate || "None"}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium italic leading-tight">
                          {activeResult.naverOcrPlate ? "정밀 교차 검증 완료." : "Premium 전용 기능입니다."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-grow flex flex-col items-center justify-center text-slate-200">
                   <p className="font-black text-sm tracking-widest uppercase text-slate-300">리스트에서 선택하세요</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
          <div className="px-10 py-8 flex items-center justify-between border-b border-slate-50">
            <div>
              <h2 className="text-xl font-black text-slate-800">분석 기록 아카이브</h2>
              <p className="text-xs text-slate-400 mt-1 font-bold uppercase tracking-widest">Total: {results.length}</p>
            </div>
            <button onClick={clearAll} className="px-6 py-3 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black hover:bg-red-100 border border-red-100 uppercase tracking-widest transition-all">전체 삭제</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100">
                  <th className="px-10 py-6 w-16">No.</th>
                  <th className="px-6 py-6 w-24">Snapshot</th>
                  <th className="px-6 py-6">Identity</th>
                  <th className="px-6 py-6">AI Stack</th>
                  <th className="px-6 py-6 text-right pr-10">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {results.length > 0 ? results.map((res, idx) => (
                  <tr key={res.id} onClick={() => setSelectedIndex(idx)} className={`group cursor-pointer transition-all hover:bg-blue-50/30 ${selectedIndex === idx ? 'bg-blue-50/60' : ''}`}>
                    <td className="px-10 py-6 font-mono text-xs text-slate-400">{results.length - idx}</td>
                    <td className="px-6 py-6"><div className="w-16 h-10 rounded-xl overflow-hidden border border-slate-200"><img src={res.originalImage} className="w-full h-full object-cover" /></div></td>
                    <td className="px-6 py-6"><div className="text-sm font-black text-slate-700">{res.fileName}</div></td>
                    <td className="px-6 py-6">
                       <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase ${res.modelUsed === 'gpt4o' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{res.modelUsed}</span>
                    </td>
                    <td className="px-6 py-6 text-right pr-10 text-[10px] font-black text-slate-400">{new Date(res.timestamp).toLocaleTimeString()}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="py-24 text-center opacity-30 text-sm font-black uppercase tracking-[0.4em]">Empty</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
