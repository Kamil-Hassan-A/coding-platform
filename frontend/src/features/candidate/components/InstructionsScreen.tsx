import React from "react";
import { ChevronLeft, ClipboardList, ShieldAlert, Monitor, Terminal } from "lucide-react";
import type { InstructionsScreenProps } from "../types/candidate";

export default function InstructionsScreen({ confirmed, onContinue, onBack }: InstructionsScreenProps) {
  return (
    <div className="flex flex-col md:flex-row h-full min-h-[550px] w-full max-w-[1000px] mx-auto overflow-hidden rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-slate-200">
      
      {/* Left Panel: Branding & Selection Summary (Black/Orange) */}
      <div className="md:w-5/12 bg-[#0d0d0d] p-10 text-white flex flex-col justify-between relative overflow-hidden">
        {/* Abstract Background Element */}
        <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-admin-orange/20 rounded-full blur-[80px]" />
        
        <div>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-12 text-sm font-medium"
          >
            <ChevronLeft size={16} /> Change Selection
          </button>
          
          <div className="mb-2 inline-flex items-center justify-center rounded-lg bg-admin-orange/10 p-3 text-admin-orange border border-admin-orange/20">
            <Terminal size={28} />
          </div>
          
          <h1 className="text-3xl font-bold mt-4 leading-tight">
            Assessment <span className="text-admin-orange">Center</span>
          </h1>
          <p className="text-slate-400 mt-3 text-sm">
            Ready to demonstrate your expertise?
          </p>
          
          <div className="mt-10 grid grid-cols-1 gap-6">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-[2px] text-admin-orange uppercase">Selected Skill</span>
              <span className="text-lg font-bold mt-1">{confirmed.skill}</span>
            </div>
            
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-[2px] text-slate-400 uppercase">Target Level</span>
              <span className="text-lg font-bold mt-1 text-slate-200">{confirmed.levelLabel}</span>
            </div>

            {/* NEW TEST DETAILS */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div className="flex flex-col text-slate-300">
                <span className="text-[10px] font-bold tracking-[2px] text-slate-500 uppercase">Duration</span>
                <span className="text-sm font-semibold mt-1">45 Minutes</span>
              </div>
              <div className="flex flex-col text-slate-300">
                <span className="text-[10px] font-bold tracking-[2px] text-slate-500 uppercase">Questions</span>
                <span className="text-sm font-semibold mt-1">1 Problem</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-auto pt-10 text-slate-500 text-[10px] flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            System Secure & Environment Ready
        </div>
      </div>

      {/* Right Panel: Instructions & Action (White) */}
      <div className="flex-1 flex flex-col h-full bg-white relative">
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-10 md:pt-14 md:px-14 pb-6">
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-2xl font-bold text-slate-900">General Instructions</h2>
            <p className="text-slate-500 mt-2 text-sm">Please read the following rules before starting your assessment.</p>
          </div>
          
          <div className="space-y-6">
            <InstructionItem 
              icon={<Monitor className="text-blue-500" size={20} />}
              title="Fullscreen Requirement"
              desc="The assessment must be taken in fullscreen mode. Any exit from fullscreen will be flagged as a violation."
            />
            
            <InstructionItem 
              icon={<ShieldAlert className="text-rose-500" size={20} />}
              title="Proctored Session"
              desc="No tab switching, no copy-pasting, and no opening DevTools. Violations are tracked and reported automatically."
            />
            
            <InstructionItem 
              icon={<ClipboardList className="text-amber-500" size={20} />}
              title="Auto-Submission"
              desc="Your work is periodically saved as a draft. When the timer expires, your latest code will be automatically submitted."
            />
            
            {/* Additional padding to ensure space between content and sticky footer on scroll */}
            <div className="h-4" />
          </div>
        </div>
        
        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-8 pt-6 flex flex-col items-center">
          <p className="text-[11px] text-slate-400 mb-5 text-center">
            By clicking continue, you agree to follow the assessment rules and conduct terms.
          </p>
          
          <button
            onClick={onContinue}
            className="w-full max-w-[280px] bg-admin-orange text-white py-4 px-8 rounded-xl font-bold text-[16px] shadow-[0_10px_25px_-5px_rgba(241,90,43,0.3)] hover:shadow-[0_12px_30px_-5px_rgba(241,90,43,0.4)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function InstructionItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex gap-4 items-start p-4 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
      <div className="mt-1 shrink-0 bg-white shadow-sm border border-slate-100 p-2 rounded-lg">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-slate-800 text-[15px]">{title}</h4>
        <p className="text-slate-500 text-[13px] mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
