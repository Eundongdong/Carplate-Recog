/// <reference types="vite/client" />  
import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import OcrVerificationResult from './components/OcrVerificationResult';
import { processCarImage } from './services/geminiService';
import { callNaverOcr } from './services/naverOcrService';
import { downloadResultsAsCsv } from './services/exportService';
import { ComparisonResult, AIModelType } from './types';
const DEFAULT_PROMPT_A = "Extract the Korean license plate number.";
const DEFAULT_PROMPT_B = "Describe the vehicle's condition or issues.";

const App: React.FC = () => {
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [aiModel, setAiModel] = useState('gemini' as AIModelType);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [progressMsg, setProgressMsg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [corsProxy, setCorsProxy] = useState(localStorage.getItem('CORS_PROXY') || '');

   // 프롬프트 상태
  const [promptA, setPromptA] = useState(localStorage.getItem('PROMPT_A') || DEFAULT_PROMPT_A);
  const [promptB, setPromptB] = useState(localStorage.getItem('PROMPT_B') || DEFAULT_PROMPT_B);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const verifyPassword = async () => {
    const envPassword = import.meta.env.VITE_PASSWORD;
    const userInput = passwordInput.trim();
    const targetPassword = envPassword ? String(envPassword).trim() : "test";

    if (userInput === targetPassword) {
      setIsAuthenticated(true);
      setAiModel('gpt4o'); 
      setShowPasswordInput(false);
    } else {
      alert("비밀번호가 일치하지 않습니다.");
    }
  };

  const handleModelToggle = (model: AIModelType) => {
    if (model === 'gpt4o' && !isAuthenticated) {
      setShowPasswordInput(true);
      return;
    }
    setAiModel(model);
  };

  const fillDemoProxy = () => {
    setCorsProxy('https://cors-anywhere.herokuapp.com/');
  };

  const resetPrompts = () => {
    setPromptA(DEFAULT_PROMPT_A);
    setPromptB(DEFAULT_PROMPT_B);
  };

  const saveSettings = () => {
    localStorage.setItem('CORS_PROXY', corsProxy);
    localStorage.setItem('PROMPT_A', promptA);
    localStorage.setItem('PROMPT_B', promptB);
    setIsSettingsOpen(false);
  };

  const clearAllResults = () => {
    if (window.confirm("모든 분석 데이터를 초기화하시겠습니까?")) {
      setResults([]);
      setSelectedIndex(null);
      setError(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    const fileList = Array.from(files);
    
    const newProcessedResults: ComparisonResult[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      setProgressMsg(`전체 ${fileList.length}건 중 ${i + 1}번째 이미지 분석 중...`);
      
      try {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        
        const base64Data = base64.split(',')[1];
        
        const analysis = await processCarImage(base64Data, () => {}, promptA, promptB, aiModel);

        if (!analysis.isVehicle) {
          throw new Error("차량 사진이 아닙니다.");
        }

        let naverOcrData = null;
        if (isAuthenticated && analysis.isVehicle) {
          try {
            naverOcrData = await callNaverOcr(base64Data);
          } catch (ocrErr) {
            console.warn("OCR skip", ocrErr);
          }
        }

        const newResult: ComparisonResult = {
          ...analysis,
          id: `res-${Date.now()}-${i}`,
          timestamp: Date.now(),
          originalImage: base64,
          fileName: file.name,
          naverOcrPlate: naverOcrData?.plate,
          naverOcrRawText: naverOcrData?.rawText,
          modelUsed: aiModel
        };

        newProcessedResults.push(newResult);
      } catch (err: any) {
        setError(`${file.name}: ${err.message}`);
      }
    }

    if (newProcessedResults.length > 0) {
      setResults(prev => [...newProcessedResults, ...prev]);
      setSelectedIndex(0); 
    }
    
    setIsProcessing(false);
    setProgressMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const activeResult = selectedIndex !== null ? results[selectedIndex] : null;

  const getConsistencyStatus = (res: ComparisonResult) => {
    if (!res.analysisA.plate || !res.analysisB.plate || !res.naverOcrPlate) return false;
    return res.analysisA.plate === res.analysisB.plate && res.analysisA.plate === res.naverOcrPlate;
  };

  const isConsistent = activeResult ? getConsistencyStatus(activeResult) : false;


  return (
    <div className="min-h-screen pb-10 bg-[#F8FAFC] font-sans">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />
      
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}></div>
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-6 text-slate-800 flex items-center justify-between">
              시스템 설정
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </h3>
            
            <div className="space-y-8">
              {/* 분석 엔진 섹션 */}
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase mb-2">분석 엔진</label>
                <div className="flex p-1 bg-slate-100 rounded-xl">
                  <button onClick={() => handleModelToggle('gemini')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${aiModel === 'gemini' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>Standard</button>
                  <button onClick={() => handleModelToggle('gpt4o')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${aiModel === 'gpt4o' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}>Premium</button>
                </div>
              </div>

              {showPasswordInput && (
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                  <p className="text-xs font-bold text-indigo-700 mb-2">프리미엄 인증 비밀번호</p>
                  <div className="flex gap-2">
                    <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="flex-1 px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Password" onKeyDown={(e) => e.key === 'Enter' && verifyPassword()} />
                    <button onClick={verifyPassword} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">확인</button>
                  </div>
                </div>
              )}

              {/* 프롬프트 설정 섹션 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">분석 프롬프트 설정</label>
                  <button onClick={resetPrompts} className="text-[10px] text-blue-500 font-black hover:underline">기본값으로 초기화</button>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 ml-1">분석 A (번호판 추출)</span>
                    <textarea 
                      value={promptA} 
                      onChange={(e) => setPromptA(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px] resize-none"
                      placeholder="분석 A에 사용할 프롬프트를 입력하세요."
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 ml-1">분석 B (차량 상태/이슈)</span>
                    <textarea 
                      value={promptB} 
                      onChange={(e) => setPromptB(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px] resize-none"
                      placeholder="분석 B에 사용할 프롬프트를 입력하세요."
                    />
                  </div>
                </div>
              </div>

              {/* CORS 프록시 섹션 */}
              <div className="space-y-3">
                <label className="text-sm font-black text-blue-600 uppercase tracking-tight">CORS 프록시</label>
                <input type="text" value={corsProxy} onChange={(e) => setCorsProxy(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://cors-anywhere.herokuapp.com/" />
                <button onClick={fillDemoProxy} className="text-[10px] text-blue-500 font-bold hover:underline">데모 서버 자동 입력</button>
              </div>
            </div>
            <button onClick={saveSettings} className="w-full mt-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-colors">저장 및 닫기</button>
          </div>
        </div>
      )}

      <main className="max-w-[1440px] mx-auto px-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 h-full">
            <div className="bg-white rounded-[1.5rem] shadow-sm p-5 border border-slate-100 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">차량 이미지 프리뷰</h2>
                <div className="flex gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-blue-500 animate-pulse' : 'bg-slate-100'}`}></div>
                  <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-blue-300 animate-pulse' : 'bg-slate-100'}`}></div>
                </div>
              </div>
              
              <div className="relative flex-1 bg-slate-50 rounded-[1.2rem] border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden min-h-[300px]">
                {activeResult && !isProcessing ? (
                  <img src={activeResult.originalImage} className="w-full h-full object-contain" alt="Vehicle preview" />
                ) : (
                  <div className="text-center p-8">
                    <div className="w-16 h-16 bg-white/50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-200">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">이미지 선택</p>
                  </div>
                )}
                {!isProcessing && (
                  <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-4 right-4 bg-blue-600 text-white p-4 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all group z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />
              </div>
              {error && <div className="mt-4 p-3 bg-red-50 text-red-600 text-[10px] rounded-lg border border-red-100 font-bold">{error}</div>}
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="bg-white rounded-[1.5rem] shadow-sm p-6 border border-slate-100 h-full flex flex-col min-h-[450px]">
              {isProcessing ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-300">
                  <div className="relative">
                    <div className="w-20 h-20 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                       </svg>
                    </div>
                  </div>
                  <div className="text-center">
                    <h4 className="text-lg font-black text-slate-800 tracking-tight mb-2">데이터 분석 중</h4>
                    <p className="text-sm font-bold text-blue-600 bg-blue-50 px-6 py-2 rounded-full border border-blue-100 animate-pulse">
                      {progressMsg}
                    </p>
                  </div>
                </div>
              ) : activeResult ? (
                <div className="flex flex-col h-full space-y-5 animate-in fade-in duration-500">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-4 shrink-0">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 tracking-tighter truncate max-w-md">{activeResult.fileName}</h3>
                      <p className="text-[10px] text-slate-400 font-bold">{new Date(activeResult.timestamp).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {isConsistent && (
                        <span className="bg-[#E7FBF3] text-[#059669] text-[9px] font-black px-2 py-1 rounded-md border border-[#D1FAE5]">정합성 일치</span>
                      )}
                      <span className="px-3 py-1 bg-slate-100 rounded-md text-[9px] font-black text-slate-500">
                        {activeResult.modelUsed === 'gpt4o' ? 'PREMIUM' : 'STANDARD'}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                    <div className="w-full space-y-3">
                      {activeResult.naverOcrPlate ? (
                        <OcrVerificationResult plate={activeResult.naverOcrPlate} />
                      ) : (
                        <div className="bg-[#0F172A] rounded-2xl p-4 text-white flex flex-col items-center justify-center border border-slate-800">
                          <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">분석 C (NAVER OCR)</p>
                          <div className="bg-white/5 border border-white/10 rounded-lg px-8 py-2">
                             <span className="text-xl font-black text-slate-500">판독 불가</span>
                          </div>
                        </div>
                      )}
                      
                      {activeResult.naverOcrRawText && (
                        <div className="bg-slate-900/5 border border-slate-200 rounded-xl p-3">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1 tracking-widest">Naver OCR Raw Text</p>
                          <p className="text-[10px] text-slate-600 font-medium leading-relaxed italic break-all">
                            "{activeResult.naverOcrRawText}"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div className="bg-[#1E293B] px-4 py-2 flex justify-between items-center shrink-0">
                          <span className="text-white font-black text-[11px]">분석 A</span>
                          <span className="text-slate-400 text-[8px] italic font-bold">GEMINI V3.0</span>
                        </div>
                        <div className="p-4 space-y-3 flex-1">
                          <div className="flex justify-between items-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase">STATUS</p>
                            <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{activeResult.analysisA.status}</span>
                          </div>
                          <div className="bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0] text-center">
                            <span className="text-2xl font-mono font-black text-slate-800 tracking-tighter">{activeResult.analysisA.plate || "N/A"}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold leading-tight line-clamp-2">{activeResult.analysisA.message || "분석 완료"}</p>
                        </div>
                      </div>

                      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                        <div className="bg-[#2563EB] px-4 py-2 flex justify-between items-center shrink-0">
                          <span className="text-white font-black text-[11px]">분석 B</span>
                          <span className="text-blue-200 text-[8px] italic font-bold">GEMINI V3.0</span>
                        </div>
                        <div className="p-4 space-y-3 flex-1">
                          <div className="flex justify-between items-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase">STATUS</p>
                            <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">{activeResult.analysisB.status}</span>
                          </div>
                          <div className="bg-[#F8FAFC] rounded-lg p-3 border border-[#BFDBFE] text-center">
                            <span className="text-2xl font-mono font-black text-[#1E40AF] tracking-tighter">{activeResult.analysisB.plate || "N/A"}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold leading-tight line-clamp-2">{activeResult.analysisB.message || "정상 판단"}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isConsistent ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`}></div>
                      <p className="text-[10px] text-slate-600 font-bold leading-tight">
                        {isConsistent ? "모든 분석 결과가 100% 일치하여 신뢰도가 매우 높습니다." : "결과가 일치하지 않거나 누락된 정보가 있습니다."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center space-y-4 py-10">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <div className="text-center">
                    <p className="text-[12px] font-black text-slate-300 uppercase tracking-[0.3em]">SYSTEM READY</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">상단에서 차량 이미지를 업로드해 주세요</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-black text-slate-800">분석 히스토리</h3>
              <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded-full">{results.length}건</span>
            </div>
            <div className="flex items-center gap-2">
              {results.length > 0 && (
                <>
                  <button 
                    onClick={() => downloadResultsAsCsv(results)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black hover:bg-emerald-100 transition-all border border-emerald-100 active:scale-95"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    엑셀 다운
                  </button>
                  <button onClick={clearAllResults} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black hover:bg-red-100 transition-all border border-red-100 active:scale-95">
                    전체 초기화
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-50">
                  <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">이미지 및 파일명</th>
                  <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">분석 A</th>
                  <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">분석 B</th>
                  <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">네이버 OCR</th>
                  <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">네이버 OCR (전체)</th>
                  <th className="px-6 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">정합성</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {results.length > 0 ? (
                  results.map((res, index) => {
                    const consistent = getConsistencyStatus(res);
                    const isSelected = selectedIndex === index;
                    return (
                      <tr 
                        key={res.id} 
                        onClick={() => setSelectedIndex(index)} 
                        className={`cursor-pointer transition-colors group ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50/50'}`}
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                              <img src={res.originalImage} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[11px] font-bold text-slate-700 truncate block max-w-[140px]">{res.fileName}</span>
                              <span className="text-[9px] text-slate-400 font-medium">{new Date(res.timestamp).toLocaleTimeString()}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-center font-mono font-black text-[11px] text-slate-800">{res.analysisA.plate || "-"}</td>
                        <td className="px-6 py-3 text-center font-mono font-black text-[11px] text-slate-800">{res.analysisB.plate || "-"}</td>
                        <td className="px-6 py-3 text-center font-mono font-black text-blue-600 text-[11px]">{res.naverOcrPlate || "불가"}</td>
                        <td className="px-6 py-3 text-center">
                          <span className="text-[9px] text-slate-400 font-medium truncate max-w-[150px] inline-block" title={res.naverOcrRawText || ""}>
                            {res.naverOcrRawText || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black border ${consistent ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                            {consistent ? '일치' : '불일치'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">데이터가 없습니다</td>
                  </tr>
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