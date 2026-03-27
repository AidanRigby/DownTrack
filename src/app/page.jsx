'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// DOWNTRACK — Live Multi-Tech Downtime Tracker
// ============================================================

const GEN2_SECTIONS = [
  { id: "startup", name: "Maintenance", type: "single" as const },
  { id: "printer", name: "Printer", type: "single" as const },
  { id: "sec-a", name: "Sec A", type: "stations" as const, stations: Array.from({ length: 12 }, (_, i) => String(i + 1)) },
  { id: "sec-b", name: "Sec B", type: "stations" as const, stations: ["1", "2", "3", "4", "Dial 1", "Dial 2"] },
  { id: "sec-c", name: "Sec C", type: "single" as const },
];
const GEN3_AUTO = ["10-1","10-2","20","30","40","50-1","50-2","60","70-1","70-2","80","90-1","90-2","100-1","100-2","110-1","110-2","130-1","140-1","140-2","150","160","180-1","180-2","190-1","190-2","200-1","200-2","200-3","205","210","220","225","240","250","255","260-1","260-2"];
const GEN3_SECTIONS = [
  { id: "startup", name: "Maintenance", type: "single" as const },
  { id: "printer", name: "Printer", type: "single" as const },
  { id: "automation", name: "Automation", type: "stations" as const, stations: GEN3_AUTO },
  { id: "omag", name: "Omag", type: "stations" as const, stations: ["Warehouse", "Poucher", "Randomizer"] },
];
const PKG_SECTIONS = [
  { id: "startup", name: "Maintenance", type: "single" as const },
  { id: "packager-unit", name: "Packager Unit", type: "single" as const },
];
const LINES = [
  { id: "line-3", name: "Line 3", gen: "Gen 2", color: "#2A6070", sections: GEN2_SECTIONS },
  { id: "line-5", name: "Line 5", gen: "Gen 2", color: "#2A6070", sections: GEN2_SECTIONS },
  { id: "line-6", name: "Line 6", gen: "Gen 2", color: "#2A6070", sections: GEN2_SECTIONS },
  { id: "line-7", name: "Line 7", gen: "Gen 3", color: "#3B82A0", sections: GEN3_SECTIONS },
  { id: "line-8", name: "Line 8", gen: "Gen 3", color: "#3B82A0", sections: GEN3_SECTIONS },
  { id: "pkg-1", name: "Packager 1", gen: "Packaging", color: "#6EAE72", sections: PKG_SECTIONS },
  { id: "pkg-2", name: "Packager 2", gen: "Packaging", color: "#6EAE72", sections: PKG_SECTIONS },
];

const SEC_ICONS: Record<string, string> = { startup:"🔄", printer:"🖨", "sec-a":"🅰️", "sec-b":"🅱️", "sec-c":"©️", automation:"⚙️", omag:"📦", "packager-unit":"📦", other:"📝" };
const SEC_COLORS: Record<string, string> = { startup:"#D97706", printer:"#E8763A", "sec-a":"#5B8DEF", "sec-b":"#9B7DC9", "sec-c":"#D4A843", automation:"#3B82A0", omag:"#6EAE72", "packager-unit":"#6EAE72", other:"#8C9AA5" };
const DTYPE: Record<string, {label: string, color: string, icon: string}> = { unplanned:{ label:"Unplanned", color:"#C75D5D", icon:"⚠" }, startup:{ label:"Maintenance", color:"#D97706", icon:"🔄" } };

interface Tech { id: string; name: string; initials: string; }
interface Entry {
  id: string; tech_id: string; tech_name: string; line_name: string; line_id: string; line_gen: string;
  section: string; station: string; dtype: string; issue: string; fix: string; part_replaced: string | null;
  inventory_adj: boolean | null; repair_log: boolean | null; duration_ms: number; start_time: string;
  end_time: string; created_at: string;
}

const fmtTimer = (ms: number) => { const t=Math.floor(ms/1000),h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=t%60; return h>0?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; };
const fmtDur = (ms: number) => { const m=Math.round(ms/60000); if(m<1)return"<1m"; if(m<60)return`${m}m`; const h=Math.floor(m/60),r=m%60; return r>0?`${h}h ${r}m`:`${h}h`; };
const dk = (ts: string | number) => { const d=new Date(ts); return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const dLabel = (key: string) => { const[y,mo,d]=key.split("-").map(Number); const dt=new Date(y,mo-1,d); const today=dk(Date.now()); const yd=new Date();yd.setDate(yd.getDate()-1); if(key===today)return"Today"; if(key===dk(yd.getTime()))return"Yesterday"; return dt.toLocaleDateString("en-CA",{weekday:"short",month:"short",day:"numeric"}); };
const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString("en-CA",{hour:"2-digit",minute:"2-digit",hour12:true});
const fmtDateFull = (key: string) => { const[y,mo,d]=key.split("-").map(Number); return new Date(y,mo-1,d).toLocaleDateString("en-CA",{weekday:"long",year:"numeric",month:"long",day:"numeric"}); };
const ff = "'DM Sans', system-ui, sans-serif";

function TextArea({value,onValueChange,placeholder,autoFocus,style}: {value: string, onValueChange: (v: string) => void, placeholder: string, autoFocus?: boolean, style: React.CSSProperties}) {
  const ref=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{if(autoFocus&&ref.current)setTimeout(()=>ref.current?.focus(),100);},[autoFocus]);
  return <textarea ref={ref} value={value} onChange={e=>onValueChange(e.target.value)} placeholder={placeholder} style={style} spellCheck={false} autoComplete="off" autoCorrect="off"/>;
}

const inputS: React.CSSProperties = { width:"100%", padding:"10px 14px", border:"2px solid #E4E7EB", borderRadius:10, fontSize:14, fontFamily:ff, color:"#1B3A4B", outline:"none", boxSizing:"border-box", minHeight:70, resize:"vertical" };
const labelS: React.CSSProperties = { display:"block", fontSize:12, fontWeight:700, color:"#5A6872", textTransform:"uppercase", letterSpacing:0.8, marginBottom:6 };
const backS: React.CSSProperties = { background:"none", border:"none", color:"#8C9AA5", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:ff, padding:"4px 0", marginBottom:10 };
const btnPrimary = (ok: boolean): React.CSSProperties => ({ width:"100%", padding:"14px", borderRadius:10, border:"none", fontSize:15, fontWeight:700, fontFamily:ff, cursor:ok?"pointer":"default", background:ok?"linear-gradient(135deg,#1B3A4B,#2A6070)":"#CDD2D8", color:"#fff", transition:"all 0.15s" });
const tBadge = (t: string): React.CSSProperties => { const d=DTYPE[t]||DTYPE.unplanned; return{ display:"inline-block", padding:"3px 10px", borderRadius:6, fontSize:11, fontWeight:700, background:`${d.color}18`, color:d.color }; };

function Toggle({value, onChange, label, yesLabel="Yes", noLabel="No"}: {value: boolean | null, onChange: (v: boolean) => void, label?: string, yesLabel?: string, noLabel?: string}) {
  return (
    <div style={{marginBottom:10}}>
      {label && <div style={{...labelS, marginBottom:4}}>{label}</div>}
      <div style={{display:"flex",gap:4}}>
        <button onClick={()=>onChange(true)} style={{padding:"6px 14px",borderRadius:7,border:`2px solid ${value===true?"#2A6070":"#E4E7EB"}`,background:value===true?"#2A607012":"#fff",color:value===true?"#2A6070":"#8C9AA5",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:ff}}>{yesLabel}</button>
        <button onClick={()=>onChange(false)} style={{padding:"6px 14px",borderRadius:7,border:`2px solid ${value===false?"#5A6872":"#E4E7EB"}`,background:value===false?"#5A687212":"#fff",color:value===false?"#5A6872":"#8C9AA5",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:ff}}>{noLabel}</button>
      </div>
    </div>
  );
}

function TypeSelector({value,onChange,small}: {value: string, onChange: (v: string) => void, small?: boolean}) {
  return (
    <div style={{display:"flex",gap:6}}>
      {Object.entries(DTYPE).map(([key,d])=>(
        <button key={key} onClick={()=>onChange(key)} style={{padding:small?"4px 12px":"8px 16px",borderRadius:8,border:`2px solid ${value===key?d.color:"#E4E7EB"}`,background:value===key?`${d.color}12`:"#fff",color:value===key?d.color:"#8C9AA5",fontSize:small?11:13,fontWeight:700,cursor:"pointer",fontFamily:ff,transition:"all 0.12s"}}>{d.icon} {d.label}</button>
      ))}
    </div>
  );
}

function StatusPill({label, value, onCycle, colors}: {label: string, value: boolean | null, onCycle: () => void, colors?: {yesBg?: string, yesColor?: string, noBg?: string, noColor?: string}}) {
  const states = [{val:null as boolean|null,label:"—",bg:"#F0F2F5",color:"#8C9AA5"},{val:true as boolean|null,label:"Yes",bg:colors?.yesBg||"#D1FAE5",color:colors?.yesColor||"#059669"},{val:false as boolean|null,label:"No",bg:colors?.noBg||"#FEE2E2",color:colors?.noColor||"#DC2626"}];
  const cur = states.find(s=>s.val===value)||states[0];
  return (
    <button onClick={onCycle} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:6,border:"1px solid #E4E7EB",background:cur.bg,color:cur.color,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:ff,transition:"all 0.12s"}}>
      <span style={{fontSize:9,color:"#8C9AA5",fontWeight:600}}>{label}:</span> {cur.label}
    </button>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function DownTrack() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // Auth
  const [currentTech, setCurrentTech] = useState<Tech | null>(null);
  const [techList, setTechList] = useState<Tech[]>([]);
  const [newTechName, setNewTechName] = useState("");
  const [newTechInitials, setNewTechInitials] = useState("");

  // App state
  const [tab,setTab]=useState("log");
  const [step,setStep]=useState("line");
  const [line,setLine]=useState<typeof LINES[0] | null>(null);
  const [section,setSection]=useState<typeof GEN2_SECTIONS[0] | null>(null);
  const [station,setStation]=useState<string | null>(null);
  const [timerStart,setTimerStart]=useState<number | null>(null);
  const [elapsed,setElapsed]=useState(0);
  const [dtype,setDtype]=useState("unplanned");
  const [issueText,setIssueText]=useState("");
  const [fixText,setFixText]=useState("");
  const [partReplaced,setPartReplaced]=useState<boolean | null>(null);
  const [partName,setPartName]=useState("");
  const [entries,setEntries]=useState<Entry[]>([]);
  const [success,setSuccess]=useState(false);
  const [fDate,setFDate]=useState(dk(Date.now()));
  const [fLine,setFLine]=useState("all");
  const [fType,setFType]=useState("all");
  const [hover,setHover]=useState<string | null>(null);
  const [editingId,setEditingId]=useState<string | null>(null);
  const [editIssue,setEditIssue]=useState("");
  const [editFix,setEditFix]=useState("");
  const [editDtype,setEditDtype]=useState("unplanned");
  const [editDurationMin,setEditDurationMin]=useState("");
  const [editLine,setEditLine]=useState("");
  const [editSection,setEditSection]=useState("");
  const [editStation,setEditStation]=useState("");
  const [editPartReplaced,setEditPartReplaced]=useState<boolean | null>(null);
  const [editPartName,setEditPartName]=useState("");
  const [deleteConfirm,setDeleteConfirm]=useState<string | null>(null);
  const [reportData,setReportData]=useState<Record<string, unknown> | null>(null);
  const [copied,setCopied]=useState(false);
  const [showSummary,setShowSummary]=useState(false);
  const [summaryTechs,setSummaryTechs]=useState("");
  const [summaryShift,setSummaryShift]=useState("day");
  const [summaryGeneral,setSummaryGeneral]=useState("");
  const [summarySafety,setSummarySafety]=useState("N/A");
  const [summaryQuality,setSummaryQuality]=useState("N/A");
  const [summaryScheduledPM,setSummaryScheduledPM]=useState("N/A");
  const [summaryCalibrations,setSummaryCalibrations]=useState("N/A");
  const [summaryStartups,setSummaryStartups]=useState<Record<string, boolean>>({});

  // Load techs
  useEffect(()=>{
    const loadTechs = async () => {
      const {data} = await supabase.from('techs').select('*').order('name');
      if(data) setTechList(data);
    };
    loadTechs();
  },[]);

  // Load entries and subscribe to realtime
  useEffect(()=>{
    const loadEntries = async () => {
      const {data} = await supabase.from('entries').select('*').order('created_at',{ascending:false});
      if(data) setEntries(data);
    };
    loadEntries();

    const channel = supabase.channel('entries-realtime')
      .on('postgres_changes', {event:'INSERT', schema:'public', table:'entries'}, (payload) => {
        setEntries(prev => {
          if(prev.find(e=>e.id===payload.new.id)) return prev;
          return [payload.new as Entry, ...prev];
        });
      })
      .on('postgres_changes', {event:'UPDATE', schema:'public', table:'entries'}, (payload) => {
        setEntries(prev => prev.map(e => e.id === payload.new.id ? payload.new as Entry : e));
      })
      .on('postgres_changes', {event:'DELETE', schema:'public', table:'entries'}, (payload) => {
        setEntries(prev => prev.filter(e => e.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },[]);

  // Timer
  useEffect(()=>{if(!timerStart||step!=="timer")return;const id=setInterval(()=>setElapsed(Date.now()-timerStart),1000);return()=>clearInterval(id);},[timerStart,step]);

  const resetLog=useCallback(()=>{setStep("line");setLine(null);setSection(null);setStation(null);setTimerStart(null);setElapsed(0);setIssueText("");setFixText("");setDtype("unplanned");setPartReplaced(null);setPartName("");},[]);

  const goTimer=(ln: typeof LINES[0],sec: string,stn: string)=>{setLine(ln);setSection(null);setStation(stn);setDtype(sec==="Maintenance"?"startup":"unplanned");setTimerStart(Date.now());setElapsed(0);setStep("timer");
    // Store section name for display
    setSectionName(sec);
  };
  const [sectionName,setSectionName]=useState("");

  const submit=async()=>{
    if(!issueText.trim()||!fixText.trim()||!currentTech||!line)return;
    const now = new Date();
    const startDate = new Date(now.getTime() - elapsed);
    const {error} = await supabase.from('entries').insert({
      tech_id: currentTech.id,
      tech_name: currentTech.name,
      line_name: line.name,
      line_id: line.id,
      line_gen: line.gen,
      section: sectionName,
      station: station,
      dtype,
      issue: issueText.trim(),
      fix: fixText.trim(),
      part_replaced: partReplaced===true?partName.trim()||"Yes":partReplaced===false?"No":null,
      inventory_adj: null,
      repair_log: null,
      duration_ms: elapsed,
      start_time: startDate.toISOString(),
      end_time: now.toISOString(),
    });
    if(!error){setSuccess(true);setTimeout(()=>{setSuccess(false);resetLog();},1500);}
  };

  const startEdit=(e: Entry)=>{setEditingId(e.id);setEditIssue(e.issue);setEditFix(e.fix);setEditDtype(e.dtype||"unplanned");setEditDurationMin(String(Math.round(e.duration_ms/60000)));setEditLine(e.line_name);setEditSection(e.section||"");setEditStation(e.station||"");setEditPartReplaced(e.part_replaced==="No"?false:e.part_replaced&&e.part_replaced!=="No"?true:null);setEditPartName(e.part_replaced&&e.part_replaced!=="No"&&e.part_replaced!=="Yes"?e.part_replaced:"");setDeleteConfirm(null);};
  const cancelEdit=()=>{setEditingId(null);setEditIssue("");setEditFix("");setEditDurationMin("");setEditLine("");setEditSection("");setEditStation("");setEditPartReplaced(null);setEditPartName("");};
  const saveEdit=async(id: string)=>{
    if(!editIssue.trim()||!editFix.trim())return;
    const durMs=Math.max(1,parseInt(editDurationMin)||1)*60000;
    const matchLine=LINES.find(l=>l.name===editLine);
    await supabase.from('entries').update({
      issue:editIssue.trim(), fix:editFix.trim(), dtype:editDtype, duration_ms:durMs,
      line_name:editLine, line_id:matchLine?.id||editLine, line_gen:matchLine?.gen||"",
      section:editSection, station:editStation,
      part_replaced:editPartReplaced===true?editPartName.trim()||"Yes":editPartReplaced===false?"No":null,
    }).eq('id',id);
    cancelEdit();
  };
  const deleteEntry=async(id: string)=>{await supabase.from('entries').delete().eq('id',id);setDeleteConfirm(null);setEditingId(null);};
  const cycleFlag=async(id: string,field: string)=>{
    const entry=entries.find(e=>e.id===id);if(!entry)return;
    const cur=field==="inventory_adj"?entry.inventory_adj:entry.repair_log;
    const next=cur===null?true:cur===true?false:null;
    await supabase.from('entries').update({[field]:next}).eq('id',id);
  };

  const addTech=async()=>{
    if(!newTechName.trim()||!newTechInitials.trim())return;
    const {data}=await supabase.from('techs').insert({name:newTechName.trim(),initials:newTechInitials.trim()}).select().single();
    if(data){setTechList(prev=>[...prev,data]);setNewTechName("");setNewTechInitials("");}
  };

  const dates=useMemo(()=>{const s=new Set(entries.map(e=>dk(e.created_at)));s.add(dk(Date.now()));return[...s].sort().reverse();},[entries]);
  const filtered=useMemo(()=>entries.filter(e=>dk(e.created_at)===fDate&&(fLine==="all"||e.line_id===fLine)&&(fType==="all"||(e.dtype||"unplanned")===fType)),[entries,fDate,fLine,fType]);
  const totalDT=useMemo(()=>filtered.reduce((s,e)=>s+e.duration_ms,0),[filtered]);
  const reportEntries=useMemo(()=>entries.filter(e=>dk(e.created_at)===fDate),[entries,fDate]);

  const buildReport=()=>{
    const sorted=[...reportEntries].sort((a,b)=>new Date(a.start_time).getTime()-new Date(b.start_time).getTime());
    const byLine: Record<string, Entry[]>={};sorted.forEach(e=>{if(!byLine[e.line_name])byLine[e.line_name]=[];byLine[e.line_name].push(e);});
    const totalMs=sorted.reduce((s,e)=>s+e.duration_ms,0);
    const unp=sorted.filter(e=>e.dtype==="unplanned"||!e.dtype);
    const mnt=sorted.filter(e=>e.dtype==="startup");
    setReportData({dateLabel:fmtDateFull(fDate),date:fDate,total:sorted.length,totalMs,unplannedCount:unp.length,unplannedMs:unp.reduce((s,e)=>s+e.duration_ms,0),maintCount:mnt.length,maintMs:mnt.reduce((s,e)=>s+e.duration_ms,0),byLine,sorted,techs:summaryTechs,shift:summaryShift,general:summaryGeneral,safety:summarySafety,quality:summaryQuality,scheduledPM:summaryScheduledPM,calibrations:summaryCalibrations,startups:summaryStartups});
    setShowSummary(false);
  };

  const copyReport=()=>{
    const r=reportData as Record<string, unknown>;if(!r)return;
    let t=`SHIFT REPORT — ${r.dateLabel}\nShift: ${r.shift==="day"?"Day":"Night"}${r.techs?`  |  Techs: ${r.techs}`:""}\n${"=".repeat(50)}\n\n`;
    t+=`Events: ${r.total}  |  Downtime: ${fmtDur(r.totalMs as number)}  |  Unplanned: ${r.unplannedCount} (${fmtDur(r.unplannedMs as number)})  |  Maintenance: ${r.maintCount} (${fmtDur(r.maintMs as number)})\n\n`;
    if(r.general)t+=`GENERAL ISSUES:\n${r.general}\n\n`;
    if(r.safety&&r.safety!=="N/A")t+=`SAFETY INCIDENT: ${r.safety}\n\n`;
    if(r.quality&&r.quality!=="N/A")t+=`QUALITY INCIDENT: ${r.quality}\n\n`;
    if(r.scheduledPM&&r.scheduledPM!=="N/A")t+=`SCHEDULED PM: ${r.scheduledPM}\n\n`;
    if(r.calibrations&&r.calibrations!=="N/A")t+=`CALIBRATIONS: ${r.calibrations}\n\n`;
    const startupLines=Object.entries(r.startups as Record<string,boolean>||{}).filter(([,v])=>v).map(([k])=>k);
    if(startupLines.length)t+=`STARTUP COMPLETED: ${startupLines.join(", ")}\n\n`;
    Object.entries(r.byLine as Record<string, Entry[]>).forEach(([ln,es])=>{
      t+=`${ln} — ${es.length} events, ${fmtDur(es.reduce((s,e)=>s+e.duration_ms,0))}\n${"-".repeat(40)}\n`;
      es.forEach(e=>{
        const loc=[e.section,e.station].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(" > ");
        t+=`  ${fmtTime(e.start_time)}  |  ${loc}  |  ${e.dtype==="startup"?"Maint":"Unplanned"}  |  ${fmtDur(e.duration_ms)}`;
        if(e.part_replaced&&e.part_replaced!=="No")t+=`  |  Part: ${e.part_replaced}`;
        t+=`\n  Issue: ${e.issue}\n  Fix: ${e.fix}`;
        if(e.inventory_adj!==null)t+=`\n  Inventory Adj: ${e.inventory_adj?"Yes":"No"}`;
        if(e.repair_log!==null)t+=`\n  Repair Log: ${e.repair_log?"Complete":"N/A"}`;
        t+="\n\n";
      });
    });
    t+=`Generated by DownTrack — ${new Date().toLocaleString("en-CA")}`;
    navigator.clipboard.writeText(t).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}).catch(()=>{});
  };

  // ============================================================
  // TECH SELECT SCREEN
  // ============================================================
  if(!currentTech){
    return(
      <div style={{fontFamily:ff,minHeight:"100vh",background:"#F4F5F7",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');button:active{transform:scale(0.97);}`}</style>
        <div style={{background:"#fff",borderRadius:20,padding:"40px 36px",maxWidth:400,width:"100%",boxShadow:"0 8px 32px rgba(0,0,0,0.08)"}}>
          <div style={{textAlign:"center",marginBottom:24}}>
            <div style={{width:48,height:48,borderRadius:12,background:"linear-gradient(135deg,#1B3A4B,#2A6070)",display:"inline-flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:18,marginBottom:12}}>DT</div>
            <div style={{fontSize:22,fontWeight:800,color:"#1B3A4B"}}>DownTrack</div>
            <div style={{fontSize:13,color:"#8C9AA5",marginTop:4}}>Select your name to start</div>
          </div>
          <div style={{display:"grid",gap:8,marginBottom:20}}>
            {techList.map(t=>(
              <button key={t.id} onClick={()=>setCurrentTech(t)}
                style={{padding:"14px 16px",borderRadius:10,border:"2px solid #E4E7EB",background:"#fff",cursor:"pointer",fontFamily:ff,fontSize:15,fontWeight:700,color:"#1B3A4B",textAlign:"left",transition:"all 0.12s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#2A6070";e.currentTarget.style.background="#F0F5F7";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#E4E7EB";e.currentTarget.style.background="#fff";}}>
                <span style={{color:"#2A6070",marginRight:8}}>{t.initials}</span> {t.name}
              </button>
            ))}
          </div>
          <div style={{borderTop:"1px solid #E8ECEF",paddingTop:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"#8C9AA5",textTransform:"uppercase",letterSpacing:0.8,marginBottom:8}}>Add New Tech</div>
            <div style={{display:"flex",gap:8,marginBottom:8}}>
              <input value={newTechName} onChange={e=>setNewTechName(e.target.value)} placeholder="Name" style={{flex:2,padding:"8px 12px",border:"2px solid #E4E7EB",borderRadius:8,fontSize:13,fontFamily:ff,color:"#1B3A4B",outline:"none",boxSizing:"border-box"}}/>
              <input value={newTechInitials} onChange={e=>setNewTechInitials(e.target.value)} placeholder="Initials" style={{flex:1,padding:"8px 12px",border:"2px solid #E4E7EB",borderRadius:8,fontSize:13,fontFamily:ff,color:"#1B3A4B",outline:"none",boxSizing:"border-box"}}/>
            </div>
            <button onClick={addTech} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",background:newTechName.trim()&&newTechInitials.trim()?"linear-gradient(135deg,#1B3A4B,#2A6070)":"#CDD2D8",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:ff}}>Add Tech</button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // LINE SELECT
  // ============================================================
  const renderLineSelect=()=>{
    const groups=[{label:"Gen 2",items:LINES.filter(l=>l.gen==="Gen 2")},{label:"Gen 3",items:LINES.filter(l=>l.gen==="Gen 3")},{label:"Packaging",items:LINES.filter(l=>l.gen==="Packaging")}];
    return(<div>
      <h2 style={{fontSize:20,fontWeight:700,color:"#1B3A4B",margin:"0 0 4px"}}>Select Line</h2>
      <p style={{fontSize:13,color:"#8C9AA5",margin:"0 0 18px",fontWeight:500}}>Choose the production line</p>
      {groups.map(g=>(<div key={g.label} style={{marginBottom:18}}>
        <div style={{fontSize:11,fontWeight:700,color:"#8C9AA5",textTransform:"uppercase",letterSpacing:1.2,marginBottom:8}}>{g.label}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:10}}>
          {g.items.map(ln=>(<div key={ln.id} onClick={()=>{setLine(ln);setStep("section");}} onMouseEnter={()=>setHover(ln.id)} onMouseLeave={()=>setHover(null)}
            style={{background:"#fff",borderRadius:11,padding:"16px 14px",cursor:"pointer",border:`2px solid ${hover===ln.id?"#1B3A4B":"#E4E7EB"}`,borderLeft:`4px solid ${ln.color}`,transform:hover===ln.id?"translateY(-1px)":"none",boxShadow:hover===ln.id?"0 3px 12px rgba(27,58,75,0.08)":"none",transition:"all 0.12s"}}>
            <div style={{fontSize:15,fontWeight:700,color:"#1B3A4B"}}>{ln.name}</div>
            <div style={{fontSize:11,color:"#8C9AA5",fontWeight:500,marginTop:2}}>{ln.sections.length} sections</div>
          </div>))}
        </div>
      </div>))}
    </div>);
  };

  const renderSectionSelect=()=>(<div>
    <button onClick={resetLog} style={backS}>← Lines</button>
    <h2 style={{fontSize:20,fontWeight:700,color:"#1B3A4B",margin:"0 0 4px"}}>{line!.name}</h2>
    <p style={{fontSize:13,color:"#8C9AA5",margin:"0 0 18px",fontWeight:500}}>Select section</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(145px,1fr))",gap:10}}>
      {line!.sections.map(sec=>{const clr=SEC_COLORS[sec.id]||"#999";return(
        <div key={sec.id} onClick={()=>{if(sec.type==="single")goTimer(line!,sec.name,sec.name);else{setSection(sec);setStep("station");setSectionName(sec.name);}}}
          onMouseEnter={()=>setHover(sec.id)} onMouseLeave={()=>setHover(null)}
          style={{background:"#fff",borderRadius:11,padding:"18px 14px",cursor:"pointer",border:`2px solid ${hover===sec.id?clr:"#E4E7EB"}`,borderBottom:`3px solid ${clr}`,textAlign:"center",transform:hover===sec.id?"translateY(-1px)":"none",transition:"all 0.12s"}}>
          <div style={{fontSize:22,marginBottom:4}}>{SEC_ICONS[sec.id]||"📍"}</div>
          <div style={{fontSize:13,fontWeight:700,color:clr}}>{sec.name}</div>
          <div style={{fontSize:11,color:"#8C9AA5",marginTop:2}}>{sec.type==="single"?"Tap to start":`${'stations' in sec ? sec.stations!.length : 0} stations`}</div>
        </div>);})}
    </div>
  </div>);

  const renderStationSelect=()=>{const stns='stations' in section! ? section!.stations! : [];const many=stns.length>15;return(<div>
    <button onClick={()=>{setStep("section");setSection(null);}} style={backS}>← {line!.name}</button>
    <h2 style={{fontSize:20,fontWeight:700,color:"#1B3A4B",margin:"0 0 4px"}}>{line!.name} — {sectionName}</h2>
    <p style={{fontSize:13,color:"#8C9AA5",margin:"0 0 18px",fontWeight:500}}>Select station</p>
    <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${many?66:80}px,1fr))`,gap:8}}>
      {stns.map((stn: string)=>(<button key={stn} onClick={()=>goTimer(line!,sectionName,stn)} onMouseEnter={()=>setHover(`s-${stn}`)} onMouseLeave={()=>setHover(null)}
        style={{background:hover===`s-${stn}`?"#F0F5F7":"#fff",border:`2px solid ${hover===`s-${stn}`?"#1B3A4B":"#E4E7EB"}`,borderRadius:9,padding:"12px 6px",cursor:"pointer",fontSize:many?12:14,fontWeight:700,color:"#1B3A4B",textAlign:"center",fontFamily:ff,transition:"all 0.1s"}}>{stn}</button>))}
    </div>
    <button onClick={()=>goTimer(line!,sectionName,"Other")} onMouseEnter={()=>setHover("s-other")} onMouseLeave={()=>setHover(null)}
      style={{marginTop:12,width:"100%",background:hover==="s-other"?"#F0F5F7":"#fff",border:`2px solid ${hover==="s-other"?"#8C9AA5":"#E4E7EB"}`,borderRadius:9,padding:"10px",cursor:"pointer",fontSize:13,fontWeight:700,color:"#8C9AA5",textAlign:"center",fontFamily:ff,transition:"all 0.1s"}}>
      📝 Other
    </button>
  </div>);};

  const renderTimer=()=>{const parts=[line?.name,sectionName,station].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);return(<div>
    <div style={{fontSize:12,color:"#8C9AA5",fontWeight:500,marginBottom:16,display:"flex",gap:6,flexWrap:"wrap"}}>
      {parts.map((p,i)=>(<span key={i}>{i>0&&<span style={{color:"#CDD2D8"}}> › </span>}<span style={i===parts.length-1?{color:"#1B3A4B",fontWeight:700}:{}}>{p}</span></span>))}
    </div>
    <div style={{background:"#fff",borderRadius:16,padding:"40px 28px",border:"2px solid #E4E7EB",textAlign:"center",maxWidth:420,margin:"0 auto"}}>
      <div style={{fontSize:11,color:"#8C9AA5",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Working on</div>
      <div style={{fontSize:14,color:"#5A6872",fontWeight:600,background:"#F0F5F7",display:"inline-block",padding:"5px 14px",borderRadius:8,margin:"8px 0"}}>{parts.join(" › ")}</div>
      <div style={{fontSize:56,fontWeight:800,color:"#1B3A4B",fontVariantNumeric:"tabular-nums",letterSpacing:-1,margin:"16px 0 4px"}}>{fmtTimer(elapsed)}</div>
      <div style={{fontSize:11,color:"#8C9AA5",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Elapsed</div>
      <button onClick={()=>setStep("form")} style={{background:"linear-gradient(135deg,#1B3A4B,#2A6070)",color:"#fff",border:"none",borderRadius:10,padding:"14px 40px",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:ff,marginTop:24}}>Task Complete</button>
      <div style={{marginTop:12}}><button onClick={resetLog} style={{background:"none",border:"none",color:"#8C9AA5",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:ff}}>Cancel</button></div>
    </div>
  </div>);};

  const renderForm=()=>{
    const loc=[line?.name,sectionName,station].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
    const ok=issueText.trim().length>0&&fixText.trim().length>0;
    return(<div>
      <div style={{fontSize:12,color:"#8C9AA5",fontWeight:500,marginBottom:16,display:"flex",gap:6,flexWrap:"wrap"}}>
        {loc.map((p,i)=>(<span key={i}>{i>0&&<span style={{color:"#CDD2D8"}}> › </span>}<span style={i===loc.length-1?{color:"#1B3A4B",fontWeight:700}:{}}>{p}</span></span>))}
      </div>
      <div style={{background:"#fff",borderRadius:16,padding:"24px",border:"2px solid #E4E7EB",maxWidth:500,margin:"0 auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><div style={{fontSize:13,color:"#5A6872",fontWeight:600}}>{loc.join(" › ")}</div><div style={{fontSize:11,color:"#8C9AA5",marginTop:2}}>Duration: {fmtDur(elapsed)}</div></div>
          <div style={{fontSize:24,fontWeight:800,color:"#2A6070",fontVariantNumeric:"tabular-nums"}}>{fmtTimer(elapsed)}</div>
        </div>
        <div style={{marginBottom:14}}><label style={labelS}>Type</label><TypeSelector value={dtype} onChange={setDtype}/></div>
        <div style={{borderTop:"1px solid #F0F2F5",paddingTop:14}}>
          <div style={{marginBottom:14}}><label style={labelS}>What was the issue?</label><TextArea value={issueText} onValueChange={setIssueText} placeholder="Describe the problem..." autoFocus={true} style={inputS}/></div>
          <div style={{marginBottom:14}}><label style={labelS}>What was the fix?</label><TextArea value={fixText} onValueChange={setFixText} placeholder="Describe what you did..." autoFocus={false} style={inputS}/></div>
          <Toggle label="Part Replaced?" value={partReplaced} onChange={setPartReplaced}/>
          {partReplaced===true&&<div style={{marginBottom:10}}><input value={partName} onChange={e=>setPartName(e.target.value)} placeholder="Part name (optional)" style={{...inputS,minHeight:"auto",padding:"8px 12px"}}/></div>}
        </div>
        <button onClick={ok?submit:undefined} style={btnPrimary(ok)}>Log Downtime</button>
        <div style={{textAlign:"center",marginTop:10}}><button onClick={resetLog} style={{background:"none",border:"none",color:"#8C9AA5",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:ff}}>Cancel</button></div>
      </div>
    </div>);
  };

  // ============================================================
  // HISTORY
  // ============================================================
  const renderHistory=()=>(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4,flexWrap:"wrap",gap:8}}>
      <div><h2 style={{fontSize:20,fontWeight:700,color:"#1B3A4B",margin:0}}>Downtime Log</h2><p style={{fontSize:13,color:"#8C9AA5",margin:"2px 0 0",fontWeight:500}}>All techs — live updates</p></div>
      {reportEntries.length>0&&<button onClick={()=>setShowSummary(true)} style={{background:"linear-gradient(135deg,#1B3A4B,#2A6070)",color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:ff}}>📄 Shift Report</button>}
    </div>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center",marginTop:12}}>
      <select value={fDate} onChange={e=>setFDate(e.target.value)} style={{padding:"8px 12px",border:"2px solid #E4E7EB",borderRadius:8,fontSize:13,fontFamily:ff,color:"#1B3A4B",fontWeight:600,background:"#fff",cursor:"pointer"}}>{dates.map(d=><option key={d} value={d}>{dLabel(d)}</option>)}</select>
      <select value={fLine} onChange={e=>setFLine(e.target.value)} style={{padding:"8px 12px",border:"2px solid #E4E7EB",borderRadius:8,fontSize:13,fontFamily:ff,color:"#1B3A4B",fontWeight:600,background:"#fff",cursor:"pointer"}}><option value="all">All Lines</option>{LINES.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
      <select value={fType} onChange={e=>setFType(e.target.value)} style={{padding:"8px 12px",border:"2px solid #E4E7EB",borderRadius:8,fontSize:13,fontFamily:ff,color:"#1B3A4B",fontWeight:600,background:"#fff",cursor:"pointer"}}><option value="all">All Types</option><option value="unplanned">Unplanned</option><option value="startup">Maintenance</option></select>
    </div>
    <div style={{display:"flex",gap:16,marginBottom:16,padding:"12px 16px",background:"#fff",borderRadius:10,border:"1px solid #E8ECEF"}}>
      {[[filtered.length,"Events"],[fmtDur(totalDT),"Total Downtime"],[filtered.length>0?fmtDur(Math.round(totalDT/filtered.length)):"—","Avg Duration"]].map(([n,l],i)=>(
        <div key={i} style={{flex:1,textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:"#1B3A4B"}}>{n}</div><div style={{fontSize:10,color:"#8C9AA5",fontWeight:600,textTransform:"uppercase",letterSpacing:0.8}}>{l}</div></div>
      ))}
    </div>
    {filtered.length===0?<div style={{textAlign:"center",padding:"48px 20px",color:"#8C9AA5",fontSize:14,fontWeight:500}}>No downtime events for this date.</div>:
    filtered.map(e=>{
      const loc=[e.section,e.station].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
      const isEd=editingId===e.id,isDel=deleteConfirm===e.id,et=e.dtype||"unplanned";
      return(<div key={e.id} style={{background:"#fff",borderRadius:12,padding:"14px 16px",border:isEd?"2px solid #2A6070":"1px solid #E8ECEF",marginBottom:10,overflow:"hidden"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span style={{fontSize:14,fontWeight:700,color:"#1B3A4B"}}>{e.line_name}</span><span style={tBadge(et)}>{DTYPE[et]?.label}</span><span style={{fontSize:10,color:"#8C9AA5",fontWeight:500}}>{e.tech_name}</span></div>
            <div style={{fontSize:12,color:"#5A6872",fontWeight:500,marginTop:2}}>{loc.join(" › ")}</div>
          </div>
          <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
            <div style={{textAlign:"right"}}><div style={{fontSize:13,fontWeight:700,color:"#2A6070"}}>{fmtDur(e.duration_ms)}</div><div style={{fontSize:11,color:"#8C9AA5",fontWeight:500}}>{fmtTime(e.start_time)}</div></div>
            {!isEd&&!isDel&&<div style={{display:"flex",gap:2,marginLeft:4}}>
              <button onClick={()=>startEdit(e)} style={{background:"none",border:"1px solid #E4E7EB",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#5A6872",fontFamily:ff,fontWeight:600}}>Edit</button>
              <button onClick={()=>setDeleteConfirm(e.id)} style={{background:"none",border:"1px solid #E4E7EB",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#5A6872",fontFamily:ff,fontWeight:600}}>Del</button>
            </div>}
          </div>
        </div>
        {isDel&&<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 12px",marginBottom:8}}>
          <div style={{fontSize:13,fontWeight:600,color:"#991B1B",marginBottom:6}}>Delete this entry?</div>
          <div style={{display:"flex",gap:8}}><button onClick={()=>deleteEntry(e.id)} style={{background:"#C75D5D",color:"#fff",border:"none",borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:ff}}>Delete</button><button onClick={()=>setDeleteConfirm(null)} style={{background:"#fff",color:"#5A6872",border:"1px solid #E4E7EB",borderRadius:7,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:ff}}>Cancel</button></div>
        </div>}
        {!isEd&&<div style={{overflow:"hidden"}}>
          <div style={{marginBottom:6}}><div style={{fontSize:10,fontWeight:700,color:"#8C9AA5",textTransform:"uppercase",letterSpacing:0.8,marginBottom:1}}>Issue</div><div style={{fontSize:13,color:"#2D2D2D",lineHeight:1.4,wordBreak:"break-word",overflowWrap:"anywhere"}}>{e.issue}</div></div>
          <div style={{marginBottom:8}}><div style={{fontSize:10,fontWeight:700,color:"#8C9AA5",textTransform:"uppercase",letterSpacing:0.8,marginBottom:1}}>Fix</div><div style={{fontSize:13,color:"#2D2D2D",lineHeight:1.4,wordBreak:"break-word",overflowWrap:"anywhere"}}>{e.fix}</div></div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {e.part_replaced&&e.part_replaced!=="No"&&<span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:6,background:"#EDE9FE",color:"#7C3AED"}}>Part: {e.part_replaced}</span>}
            <StatusPill label="Inv" value={e.inventory_adj} onCycle={()=>cycleFlag(e.id,"inventory_adj")}/>
            <StatusPill label="Repair Log" value={e.repair_log} onCycle={()=>cycleFlag(e.id,"repair_log")} colors={{yesBg:"#D1FAE5",yesColor:"#059669",noBg:"#FEF3C7",noColor:"#D97706"}}/>
          </div>
        </div>}
        {isEd&&<div>
          <div style={{marginBottom:8}}><label style={{...labelS,fontSize:10,marginBottom:3}}>Type</label><TypeSelector value={editDtype} onChange={setEditDtype} small/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
            <div><label style={{...labelS,fontSize:10,marginBottom:3}}>Line</label><select value={editLine} onChange={ev=>setEditLine(ev.target.value)} style={{width:"100%",padding:"7px 10px",border:"2px solid #E4E7EB",borderRadius:8,fontSize:12,fontFamily:ff,color:"#1B3A4B",fontWeight:600,background:"#fff"}}>{LINES.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}</select></div>
            <div><label style={{...labelS,fontSize:10,marginBottom:3}}>Section</label><input value={editSection} onChange={ev=>setEditSection(ev.target.value)} style={{width:"100%",padding:"7px 10px",border:"2px solid #E4E7EB",borderRadius:8,fontSize:12,fontFamily:ff,color:"#1B3A4B",boxSizing:"border-box"}}/></div>
            <div><label style={{...labelS,fontSize:10,marginBottom:3}}>Station</label><input value={editStation} onChange={ev=>setEditStation(ev.target.value)} style={{width:"100%",padding:"7px 10px",border:"2px solid #E4E7EB",borderRadius:8,fontSize:12,fontFamily:ff,color:"#1B3A4B",boxSizing:"border-box"}}/></div>
          </div>
          <div style={{marginBottom:8}}><label style={{...labelS,fontSize:10,marginBottom:3}}>Duration (minutes)</label><input type="number" value={editDurationMin} onChange={ev=>setEditDurationMin(ev.target.value)} min="1" style={{width:120,padding:"7px 10px",border:"2px solid #E4E7EB",borderRadius:8,fontSize:13,fontFamily:ff,color:"#1B3A4B",fontWeight:700,boxSizing:"border-box"}}/></div>
          <div style={{marginBottom:8}}><label style={{...labelS,fontSize:10,marginBottom:3}}>Issue</label><TextArea value={editIssue} onValueChange={setEditIssue} placeholder="Issue..." autoFocus style={{...inputS,minHeight:50}}/></div>
          <div style={{marginBottom:8}}><label style={{...labelS,fontSize:10,marginBottom:3}}>Fix</label><TextArea value={editFix} onValueChange={setEditFix} placeholder="Fix..." style={{...inputS,minHeight:50}}/></div>
          <div style={{marginBottom:10}}><Toggle label="Part Replaced?" value={editPartReplaced} onChange={setEditPartReplaced}/>{editPartReplaced===true&&<input value={editPartName} onChange={ev=>setEditPartName(ev.target.value)} placeholder="Part name" style={{width:"100%",padding:"7px 10px",border:"2px solid #E4E7EB",borderRadius:8,fontSize:12,fontFamily:ff,color:"#1B3A4B",boxSizing:"border-box",marginTop:4}}/>}</div>
          <div style={{display:"flex",gap:8}}><button onClick={()=>saveEdit(e.id)} style={{background:editIssue.trim()&&editFix.trim()?"linear-gradient(135deg,#1B3A4B,#2A6070)":"#CDD2D8",color:"#fff",border:"none",borderRadius:7,padding:"8px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:ff}}>Save</button><button onClick={cancelEdit} style={{background:"#fff",color:"#5A6872",border:"1px solid #E4E7EB",borderRadius:7,padding:"8px 20px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:ff}}>Cancel</button></div>
        </div>}
      </div>);
    })}
  </div>);

  // ============================================================
  // SHIFT SUMMARY + REPORT (same as before, abbreviated for space)
  // ============================================================
  const renderSummaryForm=()=>{
    const smallInput: React.CSSProperties={...inputS,minHeight:"auto",padding:"8px 12px"};
    return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(15,30,40,0.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,overflowY:"auto",padding:20}}>
      <div style={{background:"#fff",borderRadius:16,maxWidth:520,width:"100%",maxHeight:"90vh",overflowY:"auto",padding:"24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><div style={{fontSize:18,fontWeight:700,color:"#1B3A4B"}}>Shift Summary</div><div style={{fontSize:12,color:"#8C9AA5",marginTop:2}}>Fill out before generating report</div></div>
          <button onClick={()=>setShowSummary(false)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#8C9AA5"}}>✕</button>
        </div>
        <div style={{display:"flex",gap:12,marginBottom:12}}>
          <div style={{flex:1}}><label style={labelS}>Shift</label>
            <div style={{display:"flex",gap:4}}>{["day","night"].map(s=>(<button key={s} onClick={()=>setSummaryShift(s)} style={{flex:1,padding:"8px",borderRadius:8,border:`2px solid ${summaryShift===s?"#2A6070":"#E4E7EB"}`,background:summaryShift===s?"#2A607012":"#fff",color:summaryShift===s?"#2A6070":"#8C9AA5",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:ff,textTransform:"capitalize"}}>{s}</button>))}</div>
          </div>
          <div style={{flex:2}}><label style={labelS}>Techs on Shift</label><input value={summaryTechs} onChange={e=>setSummaryTechs(e.target.value)} placeholder="Names or initials" style={smallInput}/></div>
        </div>
        <div style={{marginBottom:12}}><label style={labelS}>Startup Completed</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {LINES.filter(l=>l.gen!=="Packaging").map(l=>(<button key={l.id} onClick={()=>setSummaryStartups(p=>({...p,[l.name]:!p[l.name]}))}
              style={{padding:"6px 12px",borderRadius:7,border:`2px solid ${summaryStartups[l.name]?"#059669":"#E4E7EB"}`,background:summaryStartups[l.name]?"#D1FAE5":"#fff",color:summaryStartups[l.name]?"#059669":"#8C9AA5",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:ff}}>
              {summaryStartups[l.name]?"✓ ":""}{l.name}
            </button>))}
          </div>
        </div>
        <div style={{marginBottom:12}}><label style={labelS}>General Issues</label><TextArea value={summaryGeneral} onValueChange={setSummaryGeneral} placeholder="Issues not tied to a specific line..." style={{...inputS,minHeight:50}}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div><label style={labelS}>Safety Incident</label><TextArea value={summarySafety} onValueChange={setSummarySafety} placeholder="N/A" style={{...inputS,minHeight:40}}/></div>
          <div><label style={labelS}>Quality Incident</label><TextArea value={summaryQuality} onValueChange={setSummaryQuality} placeholder="N/A" style={{...inputS,minHeight:40}}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <div><label style={labelS}>Scheduled PM</label><TextArea value={summaryScheduledPM} onValueChange={setSummaryScheduledPM} placeholder="N/A" style={{...inputS,minHeight:40}}/></div>
          <div><label style={labelS}>Calibrations</label><TextArea value={summaryCalibrations} onValueChange={setSummaryCalibrations} placeholder="N/A" style={{...inputS,minHeight:40}}/></div>
        </div>
        <button onClick={()=>{buildReport();}} style={{...btnPrimary(true),width:"100%"}}>Generate Shift Report</button>
      </div>
    </div>);
  };

  const renderReport=()=>{
    const r=reportData as Record<string, unknown>;if(!r)return null;
    const statBox=(n: string | number,l: string)=>(<div style={{flex:1,textAlign:"center",padding:"14px 8px"}}><div style={{fontSize:24,fontWeight:800,color:"#1B3A4B"}}>{n}</div><div style={{fontSize:9,color:"#8C9AA5",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginTop:2}}>{l}</div></div>);
    const startupLines=Object.entries(r.startups as Record<string,boolean>||{}).filter(([,v])=>v).map(([k])=>k);
    const byLine = r.byLine as Record<string, Entry[]>;
    return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(15,30,40,0.92)",display:"flex",flexDirection:"column",zIndex:200}}>
      <div style={{width:"100%",maxWidth:780,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 4px",flexShrink:0}}>
        <div style={{fontSize:14,fontWeight:700,color:"#fff"}}>Shift Report</div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={copyReport} style={{background:copied?"#2A6070":"rgba(255,255,255,0.15)",color:"#fff",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:ff}}>{copied?"✓ Copied":"📋 Copy"}</button>
          <button onClick={()=>{setReportData(null);setCopied(false);}} style={{background:"rgba(255,255,255,0.1)",color:"#fff",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:ff}}>✕ Close</button>
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"0 8px 24px"}}>
      <div style={{width:"100%",maxWidth:780,background:"#fff",borderRadius:16,margin:"0 auto",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{background:"linear-gradient(135deg,#0F2B3C,#1E3A4F)",padding:"28px 32px 24px"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",fontWeight:700,textTransform:"uppercase",letterSpacing:2,marginBottom:6}}>DownTrack</div>
          <div style={{fontSize:24,fontWeight:800,color:"#fff"}}>Shift Report</div>
          <div style={{display:"flex",gap:16,marginTop:8,flexWrap:"wrap"}}>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>{r.dateLabel as string}</span>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>|</span>
            <span style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>{r.shift==="day"?"Day Shift":"Night Shift"}</span>
            {r.techs&&<><span style={{fontSize:13,color:"rgba(255,255,255,0.5)"}}>|</span><span style={{fontSize:13,color:"rgba(255,255,255,0.7)"}}>Techs: {r.techs as string}</span></>}
          </div>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid #E8ECEF"}}>
          {statBox(r.total as number,"Events")}<div style={{width:1,background:"#E8ECEF"}}/>{statBox(fmtDur(r.totalMs as number),"Downtime")}<div style={{width:1,background:"#E8ECEF"}}/>{statBox(r.unplannedCount as number,`Unplanned (${fmtDur(r.unplannedMs as number)})`)}<div style={{width:1,background:"#E8ECEF"}}/>{statBox(r.maintCount as number,`Maint (${fmtDur(r.maintMs as number)})`)}
        </div>
        {(r.general||r.safety!=="N/A"||r.quality!=="N/A"||r.scheduledPM!=="N/A"||r.calibrations!=="N/A"||startupLines.length>0)&&(
          <div style={{padding:"16px 28px",borderBottom:"1px solid #E8ECEF",background:"#FAFBFC"}}>
            {startupLines.length>0&&<div style={{marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:"#059669",textTransform:"uppercase",letterSpacing:0.8}}>Startup Completed: </span><span style={{fontSize:12,color:"#2D2D2D"}}>{startupLines.join(", ")}</span></div>}
            {r.general&&<div style={{marginBottom:8}}><span style={{fontSize:10,fontWeight:700,color:"#8C9AA5",textTransform:"uppercase",letterSpacing:0.8}}>General: </span><span style={{fontSize:12,color:"#2D2D2D"}}>{r.general as string}</span></div>}
          </div>
        )}
        <div style={{padding:"20px 28px 28px"}}>
          {Object.entries(byLine).map(([lineName,lineEntries])=>(<div key={lineName} style={{marginBottom:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",borderBottom:"2px solid #1B3A4B",paddingBottom:6,marginBottom:8}}>
              <span style={{fontSize:14,fontWeight:700,color:"#1B3A4B"}}>{lineName}</span>
              <span style={{fontSize:11,color:"#8C9AA5",fontWeight:600}}>{lineEntries.length} events — {fmtDur(lineEntries.reduce((s: number,e: Entry)=>s+e.duration_ms,0))}</span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Time","Tech","Location","Type","Dur","Issue","Fix","Part"].map(h=>(<th key={h} style={{textAlign:"left",padding:"5px 6px",fontSize:9,color:"#8C9AA5",fontWeight:700,textTransform:"uppercase",letterSpacing:0.6,borderBottom:"2px solid #E8ECEF"}}>{h}</th>))}</tr></thead>
              <tbody>{lineEntries.map((e: Entry,i: number)=>{
                const loc2=[e.section,e.station].filter(Boolean).filter((v,j,a)=>a.indexOf(v)===j).join(" › ");
                const isSt=e.dtype==="startup";
                return(<tr key={i} style={{background:i%2===0?"#fff":"#FAFBFC"}}>
                  <td style={{padding:"6px",fontSize:11,borderBottom:"1px solid #F0F2F5",whiteSpace:"nowrap"}}>{fmtTime(e.start_time)}</td>
                  <td style={{padding:"6px",fontSize:11,borderBottom:"1px solid #F0F2F5",fontWeight:600}}>{e.tech_name}</td>
                  <td style={{padding:"6px",fontSize:11,borderBottom:"1px solid #F0F2F5",fontWeight:600}}>{loc2}</td>
                  <td style={{padding:"6px",borderBottom:"1px solid #F0F2F5"}}><span style={{padding:"2px 6px",borderRadius:4,fontSize:9,fontWeight:700,background:isSt?"#FEF3C7":"#FEE2E2",color:isSt?"#D97706":"#C75D5D"}}>{isSt?"Maint":"Unplanned"}</span></td>
                  <td style={{padding:"6px",fontSize:11,borderBottom:"1px solid #F0F2F5",fontWeight:700}}>{fmtDur(e.duration_ms)}</td>
                  <td style={{padding:"6px",fontSize:11,borderBottom:"1px solid #F0F2F5",maxWidth:140,wordBreak:"break-word"}}>{e.issue}</td>
                  <td style={{padding:"6px",fontSize:11,borderBottom:"1px solid #F0F2F5",maxWidth:140,wordBreak:"break-word"}}>{e.fix}</td>
                  <td style={{padding:"6px",fontSize:11,borderBottom:"1px solid #F0F2F5"}}>{e.part_replaced&&e.part_replaced!=="No"?e.part_replaced:"—"}</td>
                </tr>);
              })}</tbody>
            </table>
          </div>))}
        </div>
        <div style={{padding:"12px 28px",borderTop:"1px solid #E8ECEF",display:"flex",justifyContent:"space-between",fontSize:10,color:"#8C9AA5"}}><span>DownTrack Shift Report</span><span>{r.dateLabel as string}</span></div>
      </div>
      </div>
    </div>);
  };

  // ============================================================
  // RENDER
  // ============================================================
  if (!mounted) return null;
  return(
    <div style={{fontFamily:ff,minHeight:"100vh",background:"#F4F5F7",color:"#1a1a1a"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes scaleIn{from{transform:scale(0.9);opacity:0}to{transform:scale(1);opacity:1}}textarea:focus,select:focus,input:focus{border-color:#2A6070 !important;outline:none;}button:active{transform:scale(0.97);}::-webkit-scrollbar{width:5px;}::-webkit-scrollbar-thumb{background:#D0D5DA;border-radius:3px;}*{-webkit-user-select:auto;user-select:auto;}`}</style>
      <div style={{background:"#fff",borderBottom:"2px solid #E4E7EB",padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:8,background:"linear-gradient(135deg,#1B3A4B,#2A6070)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:14}}>DT</div>
          <div style={{fontSize:17,fontWeight:700,color:"#1B3A4B"}}>DownTrack</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{display:"flex",gap:3,background:"#EDEEF1",borderRadius:9,padding:3}}>
            {[["log","Log"],["history","History"]].map(([k,l])=>(<button key={k} onClick={()=>{setTab(k);if(k==="log")resetLog();}} style={{padding:"7px 18px",borderRadius:7,border:"none",cursor:"pointer",fontFamily:ff,fontSize:13,fontWeight:600,background:tab===k?"#fff":"transparent",color:tab===k?"#1B3A4B":"#8C9AA5",boxShadow:tab===k?"0 1px 3px rgba(0,0,0,0.06)":"none"}}>{l}</button>))}
          </div>
          <button onClick={()=>setCurrentTech(null)} style={{background:"none",border:"1px solid #E4E7EB",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontFamily:ff,fontSize:11,fontWeight:600,color:"#8C9AA5"}}>{currentTech.initials}</button>
        </div>
      </div>
      <div style={{maxWidth:900,margin:"0 auto",padding:"20px 16px"}}>
        {tab==="log"&&step==="line"&&renderLineSelect()}
        {tab==="log"&&step==="section"&&renderSectionSelect()}
        {tab==="log"&&step==="station"&&renderStationSelect()}
        {tab==="log"&&step==="timer"&&renderTimer()}
        {tab==="log"&&step==="form"&&renderForm()}
        {tab==="history"&&renderHistory()}
      </div>
      {showSummary&&renderSummaryForm()}
      {reportData&&renderReport()}
      {success&&(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(27,58,75,0.85)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}}><div style={{background:"#fff",borderRadius:20,padding:"44px 52px",textAlign:"center",animation:"scaleIn 0.25s ease"}}><div style={{fontSize:44,marginBottom:10}}>✓</div><div style={{fontSize:20,fontWeight:800,color:"#1B3A4B"}}>Logged</div><div style={{fontSize:13,color:"#8C9AA5",marginTop:4}}>Downtime event saved</div></div></div>)}
    </div>
  );
}
