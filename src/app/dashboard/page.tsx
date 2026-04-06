'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type StockityAsset, type ProfileBalance, type ScheduleStatus,
  type ScheduleOrder, type ExecutionLog,
  type FastradeStatus, type FastradeLog,
  type AISignalStatus, type AISignalOrder, type AISignalConfig,
  type IndicatorStatus, type IndicatorConfig, type IndicatorType,
  type MomentumStatus, type MomentumConfig,
} from '@/lib/api';
import { ChartCard } from '@/components/ChartCard';
import AssetIcon from '@/components/common/AssetIcon';
import { storage } from '@/lib/storage';
import {
  Activity, AlertCircle, BarChart2, Calendar,
  ChevronDown, ChevronUp, Info, Plus,
  Settings, Trash2, X, Zap, TrendingUp, TrendingDown,
  PlayCircle, StopCircle, PauseCircle, RefreshCw, Timer, Copy,
  ArrowRight, Radio, BarChart, Waves, Send,
} from 'lucide-react';

// ═══════════════════════════════════════════
// DESIGN TOKENS
// ═══════════════════════════════════════════
const C = {
  bg:    '#000000',
  card:  '#18181c',
  card2: '#101012',
  bdr:   'rgba(255,255,255,0.08)',
  bdrAct:'rgba(41,151,255,0.50)',
  cyan:  '#2997FF',
  cyand: 'rgba(41,151,255,0.15)',
  coral: '#FF453A',
  cord:  'rgba(255,69,58,0.12)',
  amber: '#FF9F0A',
  ambd:  'rgba(255,159,10,0.10)',
  violet:'#BF5AF2',
  vltd:  'rgba(191,90,242,0.10)',
  sky:   '#5AC8F5',
  skyd:  'rgba(90,200,245,0.10)',
  orange:'#FF6B35',
  orgd:  'rgba(255,107,53,0.10)',
  pink:  '#FF375F',
  pinkd: 'rgba(255,55,95,0.10)',
  text:  '#FFFFFF',
  sub:   'rgba(235,235,245,0.88)',
  muted: 'rgba(235,235,245,0.50)',
  faint: 'rgba(41,151,255,0.07)',
};

type TradingMode = 'schedule' | 'fastrade' | 'ctc' | 'aisignal' | 'indicator' | 'momentum';
type FastTradeTimeframe = '1m' | '5m' | '15m' | '30m' | '1h';

interface MartingaleConfig { enabled:boolean; maxStep:number; multiplier:number; alwaysSignal?:boolean; }

const FT_TF: {value:FastTradeTimeframe; label:string}[] = [
  {value:'1m',label:'1 Menit'},{value:'5m',label:'5 Menit'},
  {value:'15m',label:'15 Menit'},{value:'30m',label:'30 Menit'},{value:'1h',label:'1 Jam'},
];

const IDR_MIN_DISPLAY = 14_000;
const QUICK_AMOUNTS   = [14_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

function modeAccent(mode: TradingMode): string {
  if (mode === 'ctc') return C.violet;
  if (mode === 'aisignal') return C.sky;
  if (mode === 'indicator') return C.orange;
  if (mode === 'momentum') return C.pink;
  return C.cyan;
}

// ═══════════════════════════════════════════
// PRIMITIVES
// ═══════════════════════════════════════════
const Sk: React.FC<{w?:string|number;h?:number;style?:React.CSSProperties}> = ({w='100%',h=20,style}) => (
  <div style={{width:w,height:h,background:`linear-gradient(90deg,${C.faint} 0%,rgba(255,255,255,0.06) 50%,${C.faint} 100%)`,backgroundSize:'200% 100%',animation:'shimmer 1.8s ease infinite',borderRadius:4,...style}}/>
);

const Card: React.FC<{children:React.ReactNode;style?:React.CSSProperties;className?:string;flash?:'win'|'lose'|null}> =
({children,style,className='',flash}) => (
  <div className={`ds-card overflow-hidden ${className}`} style={{
    animation:flash==='win'?'win-flash 2s ease forwards':flash==='lose'?'lose-flash 2s ease forwards':undefined,
    boxShadow:'0 4px 18px rgba(41,151,255,0.05), 0 2px 8px rgba(0,0,0,0.3)',...style,
  }}>{children}</div>
);

const Divider = () => <div style={{height:1,margin:'12px 0',background:C.bdr}}/>;
const SL: React.FC<{children:React.ReactNode;accent?:string}> = ({children,accent}) => (
  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,marginTop:4}}>
    <span style={{fontSize:10,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:accent||'rgba(41,151,255,0.6)'}}>{children}</span>
    <div style={{flex:1,height:1,background:`linear-gradient(to right,${accent||'rgba(41,151,255,0.18)'},transparent)`}}/>
  </div>
);
const FL: React.FC<{children:React.ReactNode}> = ({children}) => (
  <label style={{display:'block',fontSize:10,fontWeight:600,marginBottom:6,letterSpacing:'0.06em',textTransform:'uppercase',color:'rgba(255,255,255,0.65)'}}>{children}</label>
);

const Toggle: React.FC<{checked:boolean;onChange:(v:boolean)=>void;disabled?:boolean;accent?:string}> = ({checked,onChange,disabled,accent=C.cyan}) => (
  <label style={{display:'inline-flex',alignItems:'center',cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.4:1}}>
    <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} disabled={disabled} style={{position:'absolute',opacity:0,width:0,height:0}}/>
    <div style={{width:44,height:22,borderRadius:22,position:'relative',transition:'all 0.2s',background:checked?`${accent}28`:'rgba(255,255,255,0.06)',border:`1px solid ${checked?`${accent}55`:'rgba(255,255,255,0.12)'}`}}>
      <div style={{position:'absolute',top:2,width:16,height:16,borderRadius:'50%',transition:'left 0.2s',left:checked?23:2,background:checked?accent:'rgba(255,255,255,0.5)'}}/>
    </div>
  </label>
);

const StatusChip: React.FC<{col:string;label:string;pulse?:boolean}> = ({col,label,pulse}) => (
  <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',padding:'4px 10px',borderRadius:99,color:col,background:`${col}10`,border:`1px solid ${col}28`}}>
    <span style={{width:5,height:5,borderRadius:'50%',background:col,animation:pulse?'ping 1.6s ease-in-out infinite':undefined,boxShadow:`0 0 4px ${col}`}}/>
    {label}
  </span>
);

const CtrlBtn: React.FC<{onClick:()=>void;disabled?:boolean;loading?:boolean;accent:string;label:string;icon?:React.ReactNode;solid?:boolean}> =
({onClick,disabled,loading,accent,label,icon,solid}) => (
  <button onClick={onClick} disabled={disabled||loading} style={{
    flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8,
    padding:'11px 8px',borderRadius:12,fontSize:12,fontWeight:700,
    letterSpacing:'0.06em',textTransform:'uppercase',cursor:(disabled||loading)?'not-allowed':'pointer',
    background:solid?accent:`${accent}14`,border:`1px solid ${accent}${solid?'':'35'}`,
    color:solid?'#000':accent,opacity:disabled?0.3:1,
    boxShadow:(!disabled&&!loading)?`0 0 14px ${accent}20`:'none',transition:'all 0.15s',
  }}>
    {loading?<RefreshCw style={{width:14,height:14,animation:'spin 0.7s linear infinite'}}/>:icon}
    {loading?'Memproses...':label}
  </button>
);

// ═══════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════
const RealtimeClock: React.FC = () => {
  const [t,setT] = useState<Date|null>(null);
  useEffect(()=>{setT(new Date());const id=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(id);},[]);
  const fmt  = (d:Date) => d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const fmtD = (d:Date) => d.toLocaleDateString('id-ID',{weekday:'short',day:'2-digit',month:'short'});
  const tz   = () => {if(!t)return'';const o=-t.getTimezoneOffset()/60;return`UTC${o>=0?'+':''}${o}`;};
  return (
    <Card style={{padding:'14px 16px',height:'100%'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <span style={{fontSize:11,fontWeight:500,color:C.muted}}>Waktu Lokal</span>
        <span style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{width:6,height:6,borderRadius:'50%',background:C.coral}}/>
          <span style={{fontSize:10,fontWeight:600,color:C.coral}}>Live</span>
        </span>
      </div>
      <p suppressHydrationWarning style={{fontSize:26,fontWeight:600,letterSpacing:'-0.01em',lineHeight:1,color:C.text,marginBottom:8}}>
        {t?fmt(t):'--:--:--'}
      </p>
      <div style={{display:'flex',justifyContent:'space-between'}}>
        <span suppressHydrationWarning style={{fontSize:11,color:C.sub}}>{t?fmtD(t):''}</span>
        <span suppressHydrationWarning style={{fontSize:10,color:C.muted}}>{tz()}</span>
      </div>
    </Card>
  );
};

const RealtimeClockCompact: React.FC = () => {
  const [t,setT] = useState<Date|null>(null);
  useEffect(()=>{setT(new Date());const id=setInterval(()=>setT(new Date()),1000);return()=>clearInterval(id);},[]);
  const fmt = (d:Date) => d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const tz  = () => {if(!t)return'';const o=-t.getTimezoneOffset()/60;return`UTC${o>=0?'+':''}${o}`;};
  const fmtDay  = (d:Date) => d.toLocaleDateString('id-ID',{weekday:'short'}).toUpperCase();
  const fmtDate = (d:Date) => d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'});
  return (
    <div style={{borderRadius:8,background:'rgba(0,0,0,0.4)',border:'1px solid rgba(41,151,255,0.22)',boxShadow:'0 0 10px rgba(41,151,255,0.06)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'5px 10px',borderBottom:'1px solid rgba(41,151,255,0.1)'}}>
        <span style={{fontSize:9,fontWeight:600,letterSpacing:'0.12em',textTransform:'uppercase',color:C.muted}}>WAKTU</span>
        <span style={{width:5,height:5,borderRadius:'50%',background:C.coral}}/>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 10px'}}>
        <span suppressHydrationWarning style={{fontSize:10,fontWeight:600,color:C.muted}}>{t?fmtDay(t):'—'}</span>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
          <p suppressHydrationWarning style={{fontSize:16,fontWeight:600,lineHeight:1,color:C.text}}>{t?fmt(t):'--:--:--'}</p>
          <p suppressHydrationWarning style={{fontSize:9,marginTop:3,color:C.muted}}>{tz()}</p>
        </div>
        <span suppressHydrationWarning style={{fontSize:10,fontWeight:600,color:C.muted}}>{t?fmtDate(t):'—'}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// BALANCE CARD
// ═══════════════════════════════════════════
const BalanceCard: React.FC<{balance:ProfileBalance|null;accountType:'demo'|'real';isLoading?:boolean}> = ({balance,accountType,isLoading}) => {
  const [hidden,setHidden] = useState(false);
  const isDemo = accountType==='demo';
  const rawAmount = isDemo
    ? (balance?.demo_balance ?? balance?.balance ?? 0)
    : (balance?.real_balance ?? balance?.balance ?? 0);
  const amount = rawAmount / 100;
  const col  = isDemo?C.amber:C.cyan;
  const colBg = isDemo?'rgba(255,159,10,0.08)':'rgba(41,151,255,0.08)';
  return (
    <Card style={{padding:'11px 14px'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
        <span style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.08em',color:C.muted}}>Saldo</span>
        <span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:99,color:col,background:colBg,border:`1px solid ${col}30`}}>{isDemo?'Demo':'Real'}</span>
      </div>
      {isLoading?<Sk h={26} w={110}/>:
        hidden?(
          <div style={{display:'flex',alignItems:'center',gap:3,marginTop:4}}>
            {[...Array(6)].map((_,i)=><span key={i} style={{width:5,height:5,borderRadius:'50%',background:col,opacity:0.4+(i%2)*0.2}}/>)}
          </div>
        ):(
          <p style={{fontSize:'clamp(16px,4vw,24px)',fontWeight:700,letterSpacing:'-0.02em',lineHeight:1,color:col}}>
            {amount.toLocaleString('id-ID')}
          </p>
        )
      }
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
        <span style={{fontSize:9,color:C.muted}}>{balance?.currency??'IDR'}</span>
        <button onClick={()=>setHidden(h=>!h)} style={{background:'transparent',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.3)',padding:0,fontSize:11}}>
          {hidden?'👁':'🙈'}
        </button>
      </div>
    </Card>
  );
};

// ═══════════════════════════════════════════
// PROFIT CARD
// ═══════════════════════════════════════════
const ProfitCard: React.FC<{profit:number;isLoading?:boolean;flash?:'win'|'lose'|null}> = ({profit,isLoading,flash}) => {
  const isPos = profit>=0;
  const col   = isPos?C.cyan:C.coral;
  const prevR = useRef(profit);
  const [animKey,setAnimKey] = useState(0);
  const [dir,setDir] = useState<'up'|'down'>('up');
  useEffect(()=>{
    if(profit!==prevR.current){setDir(profit>prevR.current?'up':'down');setAnimKey(k=>k+1);prevR.current=profit;}
  },[profit]);
  return (
    <Card style={{padding:'11px 16px'}} flash={flash}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
          <span style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',color:C.muted}}>Profit Hari Ini</span>
          <span style={{display:'flex',alignItems:'center',gap:5,padding:'2px 7px',borderRadius:99,background:`${col}10`,border:`1px solid ${col}22`,width:'fit-content'}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:col,boxShadow:`0 0 5px ${col}`,animation:'pulse 1.8s ease-in-out infinite'}}/>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:col}}>24j</span>
          </span>
        </div>
        <div style={{width:1,alignSelf:'stretch',background:'rgba(255,255,255,0.07)'}}/>
        <div style={{flex:1,minWidth:0}}>
          {isLoading?<Sk h={24} w="85%"/>:(
            <p key={animKey} style={{
              fontWeight:700,letterSpacing:'-0.02em',lineHeight:1,color:col,
              fontSize:'clamp(13px,1.6vw,20px)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
              animation:animKey>0?`profit-slide-${dir} 0.4s cubic-bezier(0.4,0,0.2,1) both`:undefined,
            }}>
              {isPos?'+':'-'}Rp {Math.abs(profit).toLocaleString('id-ID')}
            </p>
          )}
        </div>
        {!isLoading&&(
          <div style={{display:'flex',alignItems:'flex-end',gap:3,height:20,flexShrink:0}}>
            {[0.4,0.7,1,0.6,0.85,0.5,0.9].map((h,i)=>(
              <div key={i} style={{width:3,height:`${h*100}%`,borderRadius:2,background:col,opacity:0.3+h*0.45,animation:`pulse ${1.2+i*0.15}s ease-in-out infinite`,animationDelay:`${i*0.1}s`}}/>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

// ═══════════════════════════════════════════
// ASSET CARD
// ═══════════════════════════════════════════
const AssetCard: React.FC<{asset?:StockityAsset|null;mode:TradingMode;isLoading?:boolean}> = ({asset,mode,isLoading}) => {
  const modeCol = modeAccent(mode);
  const abbr    = asset?.ric ? asset.ric.slice(0,3).toUpperCase() : '—';
  const [imgErr,setImgErr] = useState(false);
  if(isLoading) return <Card style={{padding:'11px 14px',height:'100%'}}><Sk w={100} h={22}/></Card>;
  return (
    <Card style={{padding:0,height:'100%'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',height:68}}>
        <div style={{width:40,height:40,borderRadius:11,overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:`${modeCol}12`,border:`1.5px solid ${modeCol}28`}}>
          {asset?.iconUrl&&!imgErr?(
            <img src={asset.iconUrl} alt={asset.ric} crossOrigin="anonymous"
              onError={()=>setImgErr(true)}
              style={{width:'100%',height:'100%',objectFit:'contain',padding:4}}
            />
          ):(
            <span style={{fontWeight:700,fontSize:13,color:modeCol,letterSpacing:'-0.02em'}}>{abbr}</span>
          )}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.08em',color:'rgba(255,255,255,0.65)',lineHeight:1,marginBottom:5}}>Aset</p>
          {asset?(
            <>
              <p style={{fontSize:15,fontWeight:700,lineHeight:1,color:'#f0f4ff',letterSpacing:'-0.02em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{asset.ric}</p>
              <p style={{fontSize:10,marginTop:3,color:'rgba(255,255,255,0.68)',lineHeight:1.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{asset.name}</p>
            </>
          ):(
            <p style={{fontSize:12,color:'rgba(255,255,255,0.2)'}}>Belum dipilih</p>
          )}
        </div>
        {asset && <span style={{fontSize:11,fontWeight:700,color:modeCol,flexShrink:0}}>{asset.profitRate}%</span>}
      </div>
    </Card>
  );
};

// ═══════════════════════════════════════════
// PICKER MODAL
// ═══════════════════════════════════════════
interface PickerOpt {value:string;label:string;sub?:string;icon?:string|null;}
const PickerModal: React.FC<{open:boolean;onClose:()=>void;title:string;options:PickerOpt[];value:string;onSelect:(v:string)=>void;searchable?:boolean}> =
({open,onClose,title,options,value,onSelect,searchable}) => {
  const [q,setQ] = useState('');
  useEffect(()=>{if(open)setQ('');},[open]);

  if(!open) return null;
  const filtered = q.trim() ? options.filter(o=>o.label.toLowerCase().includes(q.toLowerCase())||o.value.toLowerCase().includes(q.toLowerCase())) : options;
  return (
    <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',padding:'16px',animation:'fade-in 0.15s ease'}}>
      <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(12px)'}}/>
      <div style={{position:'relative',width:'100%',maxWidth:480,maxHeight:'80%',display:'flex',flexDirection:'column',background:'linear-gradient(160deg,#18181c 0%,#101012 100%)',borderRadius:16,border:`1px solid ${C.bdr}`,boxShadow:'0 24px 80px rgba(0,0,0,0.7)',overflow:'hidden',animation:'slide-up 0.25s cubic-bezier(0.32,0.72,0,1)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 16px 12px',borderBottom:'1px solid rgba(255,255,255,0.06)',flexShrink:0}}>
          <span style={{fontSize:14,fontWeight:600,color:C.text}}>{title}</span>
          <button onClick={onClose} style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.4)',cursor:'pointer'}}>
            <X style={{width:13,height:13}}/>
          </button>
        </div>
        {searchable&&(
          <div style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.05)',flexShrink:0}}>
            <input autoFocus className="ds-input" style={{fontSize:13,borderRadius:8}} placeholder="Cari aset..." value={q} onChange={e=>setQ(e.target.value)}/>
          </div>
        )}
        <div style={{overflowY:'auto',flex:1}}>
          {filtered.map((opt,i)=>{
            const isSel = opt.value===value;
            return (
              <button key={opt.value} onClick={()=>{onSelect(opt.value);onClose();}} style={{
                width:'100%',textAlign:'left',display:'flex',alignItems:'center',gap:12,padding:'11px 16px',
                background:isSel?'rgba(41,151,255,0.08)':'transparent',
                borderBottom:i<filtered.length-1?'1px solid rgba(255,255,255,0.04)':'none',
                borderLeft:isSel?`2px solid ${C.cyan}`:'2px solid transparent',
                borderTop:'none',borderRight:'none',cursor:'pointer',
              }}>
                {opt.icon!==undefined&&(
                  <div style={{width:32,height:32,borderRadius:8,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',background:isSel?'rgba(41,151,255,0.12)':'rgba(255,255,255,0.05)',border:`1px solid ${isSel?'rgba(41,151,255,0.25)':'rgba(255,255,255,0.08)'}`}}>
                    {opt.icon?(
                      <img src={opt.icon} alt="" style={{width:'100%',height:'100%',objectFit:'contain',padding:4}} onError={e=>{(e.currentTarget as HTMLImageElement).style.display='none'}}/>
                    ):(
                      <span style={{fontSize:10,fontWeight:700,color:isSel?C.cyan:'rgba(255,255,255,0.4)'}}>{opt.value.slice(0,3)}</span>
                    )}
                  </div>
                )}
                <div style={{flex:1,minWidth:0}}>
                  <span style={{display:'block',fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:isSel?C.cyan:C.text,fontWeight:isSel?600:400}}>{opt.label}</span>
                  {opt.sub&&<span style={{display:'block',fontSize:11,marginTop:2,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{opt.sub}</span>}
                </div>
                <div style={{flexShrink:0,width:20,height:20,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:isSel?'rgba(41,151,255,0.15)':'rgba(255,255,255,0.04)',border:`1px solid ${isSel?C.cyan:'rgba(255,255,255,0.08)'}`}}>
                  {isSel&&<span style={{fontSize:10,color:C.cyan}}>✓</span>}
                </div>
              </button>
            );
          })}
          {filtered.length===0&&<div style={{padding:'40px 20px',textAlign:'center',color:C.muted,fontSize:12}}>Tidak ditemukan</div>}
        </div>
      </div>
    </div>
  );
};

const PickerBtn: React.FC<{label:string;placeholder?:string;disabled?:boolean;onClick:()=>void;accent?:string}> =
({label,placeholder,disabled,onClick,accent}) => {
  const has = !!label;
  const ac  = accent||C.cyan;
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',borderRadius:8,
      background:has?`rgba(41,151,255,0.04)`:'rgba(0,0,0,0.3)',
      border:`1px solid ${has?'rgba(41,151,255,0.18)':C.bdr}`,
      cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,
    }}>
      <span style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:has?C.text:C.muted}}>{label||placeholder||'— pilih —'}</span>
      <ChevronDown style={{width:12,height:12,flexShrink:0,marginLeft:6,color:has?ac:C.muted}}/>
    </button>
  );
};

// ═══════════════════════════════════════════
// ORDER INPUT MODAL (Schedule)
// ═══════════════════════════════════════════
const OrderInputModal: React.FC<{open:boolean;onClose:()=>void;orders:ScheduleOrder[];onAdd:(s:string)=>Promise<void>;onDelete:(id:string)=>void;onClear:()=>Promise<void>;loading:boolean}> =
({open,onClose,orders,onAdd,onDelete,onClear,loading}) => {
  const [input,setInput] = useState('');
  const [clearLoading,setClearLoading] = useState(false);

  const handleClear = async () => {
    if(!window.confirm('Hapus semua signal?')) return;
    setClearLoading(true);
    try { await onClear(); onClose(); }
    finally { setClearLoading(false); }
  };

  const isBusy = loading || clearLoading;

  if(!open) return null;

  return (
    <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',animation:'fade-in 0.15s ease'}}>
      <div onClick={isBusy?undefined:onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(12px)',cursor:isBusy?'not-allowed':'default'}}/>
      <div style={{position:'relative',width:'100%',maxWidth:480,maxHeight:'80%',display:'flex',flexDirection:'column',background:'linear-gradient(160deg,#18181c 0%,#101012 100%)',borderRadius:16,border:`1px solid ${C.bdr}`,overflow:'hidden',animation:'slide-up 0.25s cubic-bezier(0.32,0.72,0,1)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:`1px solid ${C.bdr}`,flexShrink:0}}>
          <div>
            <h2 style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:2}}>Input Signal</h2>
            <p style={{fontSize:11,color:C.muted}}>Format: <span style={{fontWeight:600,color:C.cyan}}>09:30 call</span> / <span style={{color:C.coral}}>14:00 put</span> / <span style={{fontWeight:600,color:C.cyan}}>09.30 B</span> / <span style={{color:C.coral}}>14.00 S</span> · satu per baris</p>
          </div>
          <button onClick={isBusy?undefined:onClose} disabled={isBusy} style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.4)',cursor:isBusy?'not-allowed':'pointer',opacity:isBusy?0.4:1}}>
            <X style={{width:13,height:13}}/>
          </button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>
          {orders.length>0&&(
            <div style={{marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontSize:12,fontWeight:500,color:C.sub}}>{orders.length} signal aktif</span>
                <button onClick={handleClear} disabled={isBusy} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:clearLoading?C.muted:C.coral,background:'transparent',border:'none',cursor:isBusy?'not-allowed':'pointer',opacity:isBusy?0.5:1,transition:'opacity 0.15s'}}>
                  {clearLoading
                    ? <><RefreshCw style={{width:10,height:10,animation:'spin 0.7s linear infinite'}}/>Menghapus...</>
                    : <><Trash2 style={{width:10,height:10}}/>Hapus semua</>
                  }
                </button>
              </div>
              <div style={{maxHeight:130,overflowY:'auto',borderRadius:8,border:`1px solid ${C.bdr}`,background:C.card2}}>
                {orders.map((o,i)=>(
                  <div key={o.id} className="schedule-item" style={{display:'flex',alignItems:'center',gap:10,padding:'7px 12px',borderBottom:i<orders.length-1?`1px solid ${C.bdr}`:'none'}}>
                    <span style={{fontSize:13,fontWeight:500,flex:1,color:C.text,fontFamily:'monospace'}}>{o.time}</span>
                    <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:6,color:o.trend==='call'?C.cyan:C.coral,background:o.trend==='call'?'rgba(41,151,255,0.1)':'rgba(255,69,58,0.1)'}}>{o.trend==='call'?'CALL':'PUT'}</span>
                    {!o.isExecuted&&<button onClick={()=>onDelete(o.id)} style={{background:'transparent',border:'none',cursor:'pointer',color:C.muted,padding:'2px 4px'}}><X style={{width:12,height:12}}/></button>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{marginBottom:10}}>
            <p style={{fontSize:11,marginBottom:7,padding:'5px 10px',borderRadius:8,color:C.muted,background:C.faint}}>
              Contoh: <span style={{color:C.cyan}}>09:30 call</span> · <span style={{color:C.coral}}>14:15 put</span> · <span style={{color:C.cyan}}>09.30 B</span> · <span style={{color:C.coral}}>14.15 S</span>
            </p>
            <textarea className="ds-input" value={input} onChange={e=>setInput(e.target.value)} placeholder={"09:00 call\n09.30 B\n10:00 put\n10.03 S"} rows={7}/>
          </div>
        </div>
        <div style={{display:'flex',gap:10,padding:'10px 16px',borderTop:`1px solid ${C.bdr}`,flexShrink:0}}>
          <button onClick={()=>onAdd(input).then(()=>{setInput('');onClose();})} disabled={!input.trim()||isBusy} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'11px 0',borderRadius:8,fontSize:13,fontWeight:600,background:input.trim()?`rgba(41,151,255,0.12)`:'rgba(255,255,255,0.04)',border:`1px solid ${input.trim()?'rgba(41,151,255,0.3)':C.bdr}`,color:input.trim()?C.cyan:C.muted,cursor:(input.trim()&&!isBusy)?'pointer':'not-allowed',opacity:isBusy?0.5:1}}>
            <Plus style={{width:13,height:13}}/>{loading?'Menambahkan...':'Tambah'}
          </button>
          <button onClick={onClose} disabled={isBusy} style={{padding:'11px 20px',borderRadius:8,fontSize:13,fontWeight:500,background:'rgba(255,255,255,0.05)',border:`1px solid ${C.bdr}`,color:isBusy?C.muted:C.sub,cursor:isBusy?'not-allowed':'pointer',opacity:isBusy?0.4:1}}>Tutup</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// AI SIGNAL INPUT MODAL
// ═══════════════════════════════════════════
const AISignalInputModal: React.FC<{open:boolean;onClose:()=>void;onSend:(trend:string,ms:number,msg:string)=>Promise<void>;loading:boolean}> =
({open,onClose,onSend,loading}) => {
  const [trend,setTrend] = useState<'call'|'put'>('call');
  const [delayMs,setDelayMs] = useState(5000);
  const [msg,setMsg] = useState('');

  if(!open) return null;
  const execTime = Date.now()+delayMs;

  return (
    <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',flexDirection:'column',justifyContent:'flex-end',alignItems:'center',animation:'fade-in 0.15s ease'}}>
      <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(12px)'}}/>
      <div style={{position:'relative',width:'100%',maxWidth:480,display:'flex',flexDirection:'column',background:'linear-gradient(160deg,#18181c 0%,#101012 100%)',borderRadius:'16px 16px 0 0',border:`1px solid ${C.sky}44`,borderBottom:'none',overflow:'hidden',animation:'slide-up 0.25s cubic-bezier(0.32,0.72,0,1)'}}>
        <div style={{width:32,height:3,borderRadius:99,background:`${C.sky}44`,margin:'12px auto 0'}}/>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:`1px solid ${C.sky}20`}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <Send style={{width:14,height:14,color:C.sky}}/>
            <span style={{fontSize:14,fontWeight:600,color:C.text}}>Kirim Sinyal Manual</span>
          </div>
          <button onClick={onClose} style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.4)',cursor:'pointer'}}>
            <X style={{width:13,height:13}}/>
          </button>
        </div>
        <div style={{padding:'16px'}}>
          <div style={{marginBottom:14}}>
            <FL>Arah Sinyal</FL>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {(['call','put'] as const).map(t=>(
                <button key={t} onClick={()=>setTrend(t)} style={{padding:'12px 0',borderRadius:10,fontWeight:700,fontSize:13,textTransform:'uppercase',letterSpacing:'0.08em',cursor:'pointer',background:trend===t?(t==='call'?'rgba(41,151,255,0.15)':'rgba(255,69,58,0.15)'):'rgba(255,255,255,0.04)',border:`1px solid ${trend===t?(t==='call'?C.cyan:C.coral):'rgba(255,255,255,0.1)'}`,color:trend===t?(t==='call'?C.cyan:C.coral):'rgba(255,255,255,0.4)'}}>
                  {t==='call'?'↑ CALL':'↓ PUT'}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <FL>Eksekusi Dalam (detik)</FL>
            <div style={{display:'flex',gap:6}}>
              {[3,5,10,30,60].map(s=>(
                <button key={s} onClick={()=>setDelayMs(s*1000)} style={{flex:1,padding:'7px 0',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',background:delayMs===s*1000?`${C.sky}18`:'rgba(255,255,255,0.04)',border:`1px solid ${delayMs===s*1000?`${C.sky}55`:'rgba(255,255,255,0.08)'}`,color:delayMs===s*1000?C.sky:'rgba(255,255,255,0.5)'}}>
                  {s}s
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <FL>Pesan (opsional)</FL>
            <input className="ds-input" value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Keterangan sinyal..."/>
          </div>
          <button onClick={()=>onSend(trend,execTime,msg).then(()=>onClose())} disabled={loading} style={{width:'100%',padding:'13px 0',borderRadius:12,fontSize:13,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',background:C.sky,color:'#000',border:'none',cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
            {loading?<RefreshCw style={{width:14,height:14,animation:'spin 0.7s linear infinite'}}/>:<Send style={{width:14,height:14}}/>}
            {loading?'Mengirim...':'Kirim Sinyal'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// GENERIC STAT GRID
// ═══════════════════════════════════════════
const StatGrid: React.FC<{stats:{l:string;v:string|number;c:string}[]}> = ({stats}) => (
  <div style={{display:'grid',gridTemplateColumns:`repeat(${stats.length},1fr)`,gap:8}}>
    {stats.map(s=>(
      <div key={s.l} style={{background:`${s.c}08`,border:`1px solid ${s.c}18`,borderRadius:10,padding:'8px 10px'}}>
        <p style={{fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>{s.l}</p>
        <p style={{fontSize:15,fontWeight:800,color:s.c,fontFamily:'monospace'}}>{s.v}</p>
      </div>
    ))}
  </div>
);

// ═══════════════════════════════════════════
// SCHEDULE PANEL
// ═══════════════════════════════════════════
const SchedulePanel: React.FC<{orders:ScheduleOrder[];logs:ExecutionLog[];onOpenModal:()=>void;isRunning:boolean;isLoading:boolean;fillHeight?:boolean}> =
({orders,logs,onOpenModal,isRunning,isLoading,fillHeight}) => {
  const listRef  = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement|null)[]>([]);
  const [activeIdx,setActiveIdx] = useState(-1);

  // Hanya tampilkan order yang belum selesai (belum dieksekusi & belum diskip)
  const pendingOrders = orders.filter(o => !o.isExecuted && !o.isSkipped);

  useEffect(()=>{
    const update=()=>{
      if(!pendingOrders.length){setActiveIdx(-1);return;}
      const now = new Date(); const nowMin = now.getHours()*60+now.getMinutes();
      let ci=-1,cd=Infinity;
      pendingOrders.forEach((o,i)=>{const[h,m]=o.time.split(':').map(Number);let d=(h*60+m)-nowMin;if(d<0)d+=24*60;if(d<cd){cd=d;ci=i;}});
      setActiveIdx(ci);
    };
    update(); const t=setInterval(update,10000); return()=>clearInterval(t);
  },[pendingOrders.length]); // eslint-disable-line

  useEffect(()=>{
    if(activeIdx<0)return;
    const el=itemRefs.current[activeIdx],c=listRef.current;
    if(!el||!c)return;
    c.scrollTo({top:el.offsetTop-c.clientHeight/2+el.offsetHeight/2,behavior:'smooth'});
  },[activeIdx]);

  const doneCount = orders.length - pendingOrders.length;

  return (
    <Card style={{display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',borderBottom:`1px solid ${C.bdr}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:12,fontWeight:600,color:C.sub}}>Signal</span>
          {doneCount>0&&(
            <span style={{fontSize:10,padding:'1px 7px',borderRadius:99,color:C.muted,background:'rgba(255,255,255,0.05)',border:`1px solid rgba(255,255,255,0.08)`}}>
              {doneCount} selesai
            </span>
          )}
        </div>
        {pendingOrders.length>0&&activeIdx>=0&&(
          <span style={{fontSize:10,fontWeight:500,color:C.cyan}}>Berikutnya</span>
        )}
      </div>
      {pendingOrders.length===0?(
        <div style={{height:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,gap:8}}>
          <Calendar style={{width:28,height:28,color:C.muted,opacity:0.5}}/>
          <p style={{fontSize:12,color:C.muted,textAlign:'center'}}>
            {doneCount>0?`Semua ${doneCount} signal telah selesai`:'Belum ada signal'}
          </p>
        </div>
      ):(
        <div ref={listRef} style={{overflowY:'auto',overflowX:'hidden',maxHeight:210,flex:'none'}}>
          {pendingOrders.map((order,i)=>{
            const isA=i===activeIdx, isCall=order.trend==='call', col=isCall?C.cyan:C.coral;
            return (
              <div key={order.id} ref={el=>{itemRefs.current[i]=el;}} className="schedule-item" style={{
                display:'flex',alignItems:'center',gap:8,padding:'8px 12px',
                borderBottom:i<pendingOrders.length-1?`1px solid ${C.bdr}`:'none',
                background:isA?(isCall?'rgba(41,151,255,0.04)':'rgba(255,69,58,0.04)'):'transparent',
                minWidth:0,overflow:'hidden',
              }}>
                {isA
                  ? <PlayCircle style={{width:13,height:13,color:col,flexShrink:0}}/>
                  : <PauseCircle style={{width:13,height:13,color:'rgba(255,255,255,0.18)',flexShrink:0}}/>
                }
                <span style={{fontSize:12,fontFamily:'monospace',color:isA?C.text:C.sub,fontWeight:isA?600:400,flexShrink:0}}>{order.time}</span>
                <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,color:col,background:isCall?'rgba(41,151,255,0.1)':'rgba(255,69,58,0.1)',flexShrink:0}}>{isCall?'CALL':'PUT'}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{padding:'8px 10px',marginTop:'auto',borderTop:`1px solid ${C.bdr}`,flexShrink:0}}>
        <button onClick={onOpenModal} disabled={isRunning} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'8px 0',borderRadius:8,fontSize:12,fontWeight:500,background:'rgba(41,151,255,0.07)',border:`1px solid rgba(41,151,255,0.18)`,color:C.cyan,cursor:isRunning?'not-allowed':'pointer',opacity:isRunning?0.4:1}}>
          <Plus style={{width:12,height:12}}/>{pendingOrders.length===0?'Tambah':'Kelola'}
        </button>
      </div>
    </Card>
  );
};

// ═══════════════════════════════════════════
// FASTRADE PANEL
// ═══════════════════════════════════════════
const FastradePanel: React.FC<{status:FastradeStatus|null;logs:FastradeLog[];isLoading:boolean;fillHeight?:boolean}> =
({status,logs,isLoading,fillHeight}) => {
  const isOn   = status?.isRunning??false;
  const pnl    = status?.sessionPnL??0;
  const wins   = status?.totalWins??0;
  const losses = status?.totalLosses??0;
  const total  = status?.totalTrades??0;
  const wr     = total>0?Math.round((wins/total)*100):null;
  const accent = status?.mode==='CTC'?C.violet:C.cyan;
  const isCTC  = status?.mode==='CTC';
  const phaseMap: Record<string,string> = {
    WAITING_MINUTE_1:'Menunggu candle 1',FETCHING_1:'Membaca candle 1',
    WAITING_MINUTE_2:'Menunggu candle 2',FETCHING_2:'Membaca candle 2',
    ANALYZING:'Menganalisis',WAITING_EXEC_SYNC:'Sinkronisasi waktu',
    EXECUTING:'Memasang order',WAITING_RESULT:'Menunggu hasil',
    WAITING_LOSS_DELAY:'Jeda setelah loss',IDLE:'Memulai...',
  };
  const phase = status?.phase||(isOn?'Running':'Standby');
  const trend = status?.activeTrend??status?.currentTrend;
  const pnlCol = pnl>=0?accent:C.coral;

  const Row: React.FC<{label:string;right:React.ReactNode;border?:boolean}> = ({label,right,border=true}) => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderBottom:border?`1px solid ${C.bdr}`:'none',minWidth:0}}>
      <span style={{fontSize:11,color:C.muted}}>{label}</span>
      <span style={{fontSize:11,fontWeight:600,color:C.text}}>{right}</span>
    </div>
  );

  return (
    <Card style={{display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',borderBottom:`1px solid ${C.bdr}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <Zap style={{width:14,height:14,color:accent}}/>
          <span style={{fontSize:12,fontWeight:600,color:C.sub}}>{isCTC?'Sesi CTC':'Sesi FastTrade'}</span>
        </div>
        {isOn?<StatusChip col={accent} label="Aktif" pulse/>:<span style={{fontSize:10,color:C.muted}}>Standby</span>}
      </div>

      {isLoading?(
        <div style={{padding:'8px 0'}}>{[1,2,3].map(i=><div key={i} style={{padding:'8px 12px'}}><Sk w={`${i===1?70:i===2?50:60}%`} h={14}/></div>)}</div>
      ):!status||!isOn?(
        <div style={{height:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
          <Zap style={{width:24,height:24,color:C.muted,opacity:0.4}}/>
          <p style={{fontSize:12,color:C.muted}}>Belum ada sesi aktif</p>
        </div>
      ):(
        <div style={{overflowY:'auto',maxHeight:240}}>
          <Row label="P&L" right={<span style={{color:pnlCol,fontFamily:'monospace'}}>{pnl>=0?'+':''}{pnl.toLocaleString('id-ID')}</span>}/>
          <Row label="W / L" right={<span style={{fontFamily:'monospace'}}><span style={{color:C.cyan}}>{wins}</span><span style={{color:C.muted}}> / </span><span style={{color:C.coral}}>{losses}</span></span>}/>
          <Row label="Win Rate" right={wr!==null?<span style={{color:wr>=50?accent:C.coral}}>{wr}%</span>:<span style={{color:C.muted}}>—</span>}/>
          <Row label="Fase" right={<span style={{color:accent,fontSize:10}}>{phaseMap[phase]??phase}</span>}/>
          {trend&&<Row label="Trend" right={<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,color:trend==='call'?C.cyan:C.coral,background:trend==='call'?'rgba(41,151,255,0.1)':'rgba(255,69,58,0.1)'}}>{trend==='call'?'↑ CALL':'↓ PUT'}</span>} border={logs.length===0}/>}
          {logs.length>0&&(
            <>
              <div style={{padding:'6px 12px 4px',borderBottom:`1px solid ${C.bdr}`}}>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(41,151,255,0.45)'}}>Riwayat</span>
              </div>
              {logs.slice(-4).reverse().map((log,i,arr)=>{
                const rc=log.result==='WIN'?accent:log.result==='LOSS'||log.result==='LOSE'?C.coral:C.amber;
                const col=log.trend==='call'?C.cyan:C.coral;
                return (
                  <div key={log.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderBottom:i<arr.length-1?`1px solid ${C.bdr}`:'none',minWidth:0,overflow:'hidden'}}>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,color:col,background:log.trend==='call'?'rgba(41,151,255,0.1)':'rgba(255,69,58,0.1)',flexShrink:0}}>{log.trend==='call'?'CALL':'PUT'}</span>
                    <span style={{fontSize:10,color:C.muted,flex:1,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.amount?.toLocaleString('id-ID')}</span>
                    {log.result&&<span style={{fontSize:10,fontWeight:700,color:rc,flexShrink:0}}>{log.result}</span>}
                    {log.profit!=null&&<span style={{fontSize:10,color:rc,fontFamily:'monospace',flexShrink:0}}>{log.profit>=0?'+':''}{log.profit?.toLocaleString('id-ID')}</span>}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </Card>
  );
};

// ═══════════════════════════════════════════
// AI SIGNAL PANEL
// ═══════════════════════════════════════════
const AISignalPanel: React.FC<{status:AISignalStatus|null;pendingOrders:AISignalOrder[];onOpenSendModal:()=>void;isLoading:boolean;fillHeight?:boolean}> =
({status,pendingOrders,onOpenSendModal,isLoading,fillHeight}) => {
  const isOn   = status?.isRunning??false;
  const pnl    = status?.sessionPnL??0;
  const wins   = status?.totalWins??0;
  const losses = status?.totalLosses??0;
  const total  = status?.totalTrades??0;
  const wr     = total>0?Math.round((wins/total)*100):null;
  const pnlCol = pnl>=0?C.sky:C.coral;

  const Row: React.FC<{label:string;right:React.ReactNode;border?:boolean}> = ({label,right,border=true}) => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderBottom:border?`1px solid ${C.bdr}`:'none',minWidth:0}}>
      <span style={{fontSize:11,color:C.muted}}>{label}</span>
      <span style={{fontSize:11,fontWeight:600}}>{right}</span>
    </div>
  );

  return (
    <Card style={{display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',borderBottom:`1px solid rgba(90,200,245,0.2)`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <Radio style={{width:14,height:14,color:C.sky}}/>
          <span style={{fontSize:12,fontWeight:600,color:C.sub}}>AI Signal</span>
        </div>
        {isOn?<StatusChip col={C.sky} label="Aktif" pulse/>:<span style={{fontSize:10,color:C.muted}}>Standby</span>}
      </div>

      {isLoading?(
        <div style={{padding:'8px 0'}}>{[1,2,3].map(i=><div key={i} style={{padding:'8px 12px'}}><Sk w={`${i===1?70:i===2?50:60}%`} h={14}/></div>)}</div>
      ):!isOn?(
        <div style={{height:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
          <Radio style={{width:24,height:24,color:C.muted,opacity:0.4}}/>
          <p style={{fontSize:12,color:C.muted}}>Mode AI Signal tidak aktif</p>
        </div>
      ):(
        <div style={{overflowY:'auto',maxHeight:pendingOrders.length>0?240:200}}>
          <Row label="P&L" right={<span style={{color:pnlCol,fontFamily:'monospace'}}>{pnl>=0?'+':''}{pnl.toLocaleString('id-ID')}</span>}/>
          <Row label="W / L" right={<span style={{fontFamily:'monospace'}}><span style={{color:C.cyan}}>{wins}</span><span style={{color:C.muted}}> / </span><span style={{color:C.coral}}>{losses}</span></span>}/>
          <Row label="Win Rate" right={wr!==null?<span style={{color:wr>=50?C.sky:C.coral}}>{wr}%</span>:<span style={{color:C.muted}}>—</span>}/>
          <Row label="Status" right={<span style={{color:C.sky,fontSize:10}}>{status?.lastStatus||'Menunggu sinyal...'}</span>} border={pendingOrders.length===0}/>
          {pendingOrders.length>0&&(
            <>
              <div style={{padding:'6px 12px 4px',borderBottom:`1px solid ${C.bdr}`}}>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(90,200,245,0.45)'}}>Pending ({pendingOrders.length})</span>
              </div>
              {pendingOrders.slice(0,3).map((o,i,arr)=>{
                const msLeft = o.executionTime - Date.now();
                const secLeft = Math.max(0,Math.ceil(msLeft/1000));
                const col = o.trend==='call'?C.cyan:C.coral;
                return (
                  <div key={o.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderBottom:i<arr.length-1?`1px solid ${C.bdr}`:'none',minWidth:0,overflow:'hidden'}}>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,color:col,background:o.trend==='call'?'rgba(41,151,255,0.1)':'rgba(255,69,58,0.1)',flexShrink:0}}>{o.trend==='call'?'↑ CALL':'↓ PUT'}</span>
                    <span style={{fontSize:10,color:C.muted,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.assetRic}</span>
                    <span style={{fontSize:10,fontWeight:600,color:C.sky,fontFamily:'monospace',flexShrink:0}}>{secLeft>0?`${secLeft}s`:'Sekarang'}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
      {isOn&&(
        <div style={{padding:'8px 10px',borderTop:`1px solid rgba(90,200,245,0.15)`,flexShrink:0}}>
          <button onClick={onOpenSendModal} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'8px 0',borderRadius:8,fontSize:12,fontWeight:500,background:`${C.sky}10`,border:`1px solid ${C.sky}25`,color:C.sky,cursor:'pointer'}}>
            <Send style={{width:12,height:12}}/>Kirim Sinyal
          </button>
        </div>
      )}
    </Card>
  );
};

// ═══════════════════════════════════════════
// INDICATOR PANEL
// ═══════════════════════════════════════════
const IndicatorPanel: React.FC<{status:IndicatorStatus|null;isLoading:boolean;fillHeight?:boolean}> =
({status,isLoading,fillHeight}) => {
  const isOn   = status?.isRunning??false;
  const pnl    = status?.sessionPnL??0;
  const wins   = status?.totalWins??0;
  const losses = status?.totalLosses??0;
  const total  = status?.totalTrades??0;
  const wr     = total>0?Math.round((wins/total)*100):null;
  const indType = status?.indicatorType??'SMA';
  const pnlCol  = pnl>=0?C.orange:C.coral;
  const lastTrend = status?.lastTrend;

  const Row: React.FC<{label:string;right:React.ReactNode;border?:boolean}> = ({label,right,border=true}) => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderBottom:border?`1px solid ${C.bdr}`:'none',minWidth:0}}>
      <span style={{fontSize:11,color:C.muted}}>{label}</span>
      <span style={{fontSize:11,fontWeight:600}}>{right}</span>
    </div>
  );

  return (
    <Card style={{display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',borderBottom:`1px solid rgba(255,107,53,0.2)`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <BarChart style={{width:14,height:14,color:C.orange}}/>
          <span style={{fontSize:12,fontWeight:600,color:C.sub}}>Indicator <span style={{color:C.orange}}>— {indType}</span></span>
        </div>
        {isOn?<StatusChip col={C.orange} label="Aktif" pulse/>:<span style={{fontSize:10,color:C.muted}}>Standby</span>}
      </div>

      {isLoading?(
        <div style={{padding:'8px 0'}}>{[1,2,3].map(i=><div key={i} style={{padding:'8px 12px'}}><Sk w={`${i===1?70:i===2?50:60}%`} h={14}/></div>)}</div>
      ):!isOn?(
        <div style={{height:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
          <BarChart style={{width:24,height:24,color:C.muted,opacity:0.4}}/>
          <p style={{fontSize:12,color:C.muted}}>Indicator Bot tidak aktif</p>
        </div>
      ):(
        <div style={{overflowY:'auto',maxHeight:240}}>
          <Row label="P&L" right={<span style={{color:pnlCol,fontFamily:'monospace'}}>{pnl>=0?'+':''}{pnl.toLocaleString('id-ID')}</span>}/>
          <Row label="W / L" right={<span style={{fontFamily:'monospace'}}><span style={{color:C.cyan}}>{wins}</span><span style={{color:C.muted}}> / </span><span style={{color:C.coral}}>{losses}</span></span>}/>
          <Row label="Win Rate" right={wr!==null?<span style={{color:wr>=50?C.orange:C.coral}}>{wr}%</span>:<span style={{color:C.muted}}>—</span>}/>
          <Row label="Status" right={<span style={{color:C.orange,fontSize:10}}>{status?.lastStatus||'Memantau indikator...'}</span>}/>
          <Row label="Sinyal" right={lastTrend?<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,color:lastTrend==='call'?C.cyan:C.coral,background:lastTrend==='call'?'rgba(41,151,255,0.1)':'rgba(255,69,58,0.1)'}}>{lastTrend==='call'?'↑ CALL':'↓ PUT'}</span>:<span style={{color:C.muted}}>—</span>}/>
          {status?.currentIndicatorValue!=null&&(
            <Row label={`Nilai ${indType}`} right={<span style={{color:C.orange,fontFamily:'monospace'}}>{status.currentIndicatorValue.toFixed(4)}</span>} border={false}/>
          )}
        </div>
      )}
    </Card>
  );
};

// ═══════════════════════════════════════════
// MOMENTUM PANEL
// ═══════════════════════════════════════════
const MomentumPanel: React.FC<{status:MomentumStatus|null;isLoading:boolean;fillHeight?:boolean}> =
({status,isLoading,fillHeight}) => {
  const isOn   = status?.isRunning??false;
  const pnl    = status?.sessionPnL??0;
  const wins   = status?.totalWins??0;
  const losses = status?.totalLosses??0;
  const total  = status?.totalTrades??0;
  const wr     = total>0?Math.round((wins/total)*100):null;
  const pnlCol = pnl>=0?C.pink:C.coral;

  const PATTERN_LABELS: Record<string,string> = {
    CANDLE_SABIT:'Candle Sabit',
    DOJI_TERJEPIT:'Doji Terjepit',
    DOJI_PEMBATALAN:'Doji Pembatalan',
    BB_SAR_BREAK:'BB + SAR Break',
  };

  const Row: React.FC<{label:string;right:React.ReactNode;border?:boolean}> = ({label,right,border=true}) => (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderBottom:border?`1px solid ${C.bdr}`:'none',minWidth:0}}>
      <span style={{fontSize:11,color:C.muted}}>{label}</span>
      <span style={{fontSize:11,fontWeight:600}}>{right}</span>
    </div>
  );

  return (
    <Card style={{display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',borderBottom:`1px solid rgba(255,55,95,0.2)`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <Waves style={{width:14,height:14,color:C.pink}}/>
          <span style={{fontSize:12,fontWeight:600,color:C.sub}}>Momentum</span>
        </div>
        {isOn?<StatusChip col={C.pink} label="Aktif" pulse/>:<span style={{fontSize:10,color:C.muted}}>Standby</span>}
      </div>

      {isLoading?(
        <div style={{padding:'8px 0'}}>{[1,2,3].map(i=><div key={i} style={{padding:'8px 12px'}}><Sk w={`${i===1?70:i===2?50:60}%`} h={14}/></div>)}</div>
      ):!isOn?(
        <div style={{height:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
          <Waves style={{width:24,height:24,color:C.muted,opacity:0.4}}/>
          <p style={{fontSize:12,color:C.muted}}>Momentum Bot tidak aktif</p>
        </div>
      ):(
        <div style={{overflowY:'auto',maxHeight:240}}>
          <Row label="P&L" right={<span style={{color:pnlCol,fontFamily:'monospace'}}>{pnl>=0?'+':''}{pnl.toLocaleString('id-ID')}</span>}/>
          <Row label="W / L" right={<span style={{fontFamily:'monospace'}}><span style={{color:C.cyan}}>{wins}</span><span style={{color:C.muted}}> / </span><span style={{color:C.coral}}>{losses}</span></span>}/>
          <Row label="Win Rate" right={wr!==null?<span style={{color:wr>=50?C.pink:C.coral}}>{wr}%</span>:<span style={{color:C.muted}}>—</span>}/>
          <Row label="Status" right={<span style={{color:C.pink,fontSize:10}}>{status?.lastStatus||'Memindai pola candle...'}</span>}/>
          {status?.lastDetectedPattern?(
            <Row
              label="Pola"
              border={!status.lastSignalTime}
              right={<span style={{color:C.pink,fontSize:10,fontWeight:700}}>{PATTERN_LABELS[status.lastDetectedPattern]??status.lastDetectedPattern}</span>}
            />
          ):(
            <Row label="Pola" right={<span style={{color:C.muted}}>—</span>} border={false}/>
          )}
          {status?.lastSignalTime&&(
            <Row label="Waktu sinyal" right={<span style={{color:C.muted,fontFamily:'monospace',fontSize:10}}>{new Date(status.lastSignalTime).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>} border={false}/>
          )}
        </div>
      )}
    </Card>
  );
};

// ═══════════════════════════════════════════
// MODE SESSION PANEL
// ═══════════════════════════════════════════
const ModeSessionPanel: React.FC<{
  mode:TradingMode; onModeChange:(m:TradingMode)=>void; locked:boolean;
  blockedModes:TradingMode[];
  orders:ScheduleOrder[]; logs:ExecutionLog[]; onOpenModal:()=>void; isRunning:boolean;
  ftStatus:FastradeStatus|null; ftLogs:FastradeLog[]; ftLoading:boolean;
  aiStatus:AISignalStatus|null; aiPending:AISignalOrder[]; onOpenAIModal:()=>void;
  indicatorStatus:IndicatorStatus|null;
  momentumStatus:MomentumStatus|null;
  fillHeight?:boolean;
}> = ({mode,onModeChange,locked,blockedModes,orders,logs,onOpenModal,isRunning,ftStatus,ftLogs,ftLoading,aiStatus,aiPending,onOpenAIModal,indicatorStatus,momentumStatus,fillHeight}) => {
  const [dropOpen,setDropOpen] = useState(false);

  const MODES = [
    {v:'schedule' as TradingMode,label:'Signal',icon:<Calendar style={{width:12,height:12}}/>,accent:C.cyan,desc:'Order terjadwal'},
    {v:'fastrade' as TradingMode,label:'FastTrade',icon:<Zap style={{width:12,height:12}}/>,accent:C.cyan,desc:'Auto per candle (FTT)'},
    {v:'ctc' as TradingMode,label:'CTC',icon:<Copy style={{width:12,height:12}}/>,accent:C.violet,desc:'Copy candle 1m'},
    {v:'aisignal' as TradingMode,label:'AI Signal',icon:<Radio style={{width:12,height:12}}/>,accent:C.sky,desc:'Sinyal dari AI/Telegram'},
    {v:'indicator' as TradingMode,label:'Indicator',icon:<BarChart style={{width:12,height:12}}/>,accent:C.orange,desc:'SMA / EMA / RSI'},
    {v:'momentum' as TradingMode,label:'Momentum',icon:<Waves style={{width:12,height:12}}/>,accent:C.pink,desc:'Pola candle otomatis'},
  ];
  const active = MODES.find(m=>m.v===mode)!;
  const ac = modeAccent(mode);

  return (
    <div style={{display:'flex',flexDirection:'column',height:fillHeight?'100%':undefined,gap:6,minWidth:0,width:'100%',overflow:'hidden'}}>
      <div style={{position:'relative',flexShrink:0}}>
        <button type="button" onClick={()=>setDropOpen(v=>!v)} style={{
          width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
          padding:'8px 12px',borderRadius:12,cursor:'pointer',
          background:dropOpen?`${ac}14`:'rgba(0,0,0,0.4)',
          border:`1px solid ${dropOpen?`${ac}40`:'rgba(255,255,255,0.08)'}`,
        }}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{width:20,height:20,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',background:`${ac}18`,color:ac}}>{active.icon}</span>
            <span style={{fontSize:12,fontWeight:600,color:ac}}>{active.label}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            {locked&&<span style={{fontSize:9,padding:'1px 6px',borderRadius:99,color:ac,background:`${ac}14`,border:`1px solid ${ac}30`}}>Aktif</span>}
            <ChevronDown style={{width:11,height:11,color:C.muted,transform:dropOpen?'rotate(180deg)':'none',transition:'transform 0.2s'}}/>
          </div>
        </button>
        {dropOpen&&(
          <>
            <div style={{position:'fixed',inset:0,zIndex:9}} onClick={()=>setDropOpen(false)}/>
            <div style={{position:'absolute',left:0,right:0,marginTop:4,zIndex:10,borderRadius:12,overflow:'hidden',background:'linear-gradient(160deg,#161618 0%,#0e0e10 100%)',border:`1px solid rgba(41,151,255,0.18)`,boxShadow:'0 8px 32px rgba(0,0,0,0.55)',animation:'slide-up 0.15s ease'}}>
              {MODES.map(({v,label,icon,accent,desc},idx)=>{
                const isAct=mode===v, isLock=blockedModes.includes(v);
                return (
                  <button key={v} type="button" onClick={()=>{onModeChange(v);if(!isLock)setDropOpen(false);}} style={{
                    width:'100%',display:'flex',alignItems:'center',gap:10,padding:'11px 16px',cursor:isLock?'not-allowed':'pointer',
                    background:isAct?`${accent}10`:'transparent',
                    borderBottom:idx<MODES.length-1?'1px solid rgba(255,255,255,0.04)':'none',
                    borderLeft:isAct?`2px solid ${accent}`:'2px solid transparent',
                    borderTop:'none',borderRight:'none',opacity:isLock?0.5:1,
                  }}>
                    <span style={{width:24,height:24,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:`${accent}15`,color:accent,flexShrink:0}}>{icon}</span>
                    <div style={{flex:1,textAlign:'left'}}>
                      <span style={{display:'block',fontSize:12,fontWeight:600,color:isAct?accent:C.sub}}>{label}</span>
                      <span style={{display:'block',fontSize:10,color:C.muted}}>{desc}</span>
                    </div>
                    {isAct&&<span style={{color:accent,fontSize:12}}>✓</span>}
                    {isLock&&!isAct&&<span style={{fontSize:10,color:C.coral}}>🔒</span>}
                  </button>
                );
              })}
              {blockedModes.length>0&&(
                <div style={{padding:'8px 16px',borderTop:'1px solid rgba(255,255,255,0.04)',background:'rgba(255,69,58,0.04)',display:'flex',alignItems:'center',gap:6}}>
                  <AlertCircle style={{width:10,height:10,color:'rgba(255,69,58,0.75)',flexShrink:0}}/>
                  <span style={{fontSize:10,color:'rgba(255,69,58,0.75)'}}>Hentikan mode aktif untuk berpindah</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
        {mode==='schedule'&&<SchedulePanel orders={orders} logs={logs} onOpenModal={onOpenModal} isRunning={isRunning} isLoading={false} fillHeight={fillHeight}/>}
        {(mode==='fastrade'||mode==='ctc')&&<FastradePanel status={ftStatus} logs={ftLogs} isLoading={ftLoading} fillHeight={fillHeight}/>}
        {mode==='aisignal'&&<AISignalPanel status={aiStatus} pendingOrders={aiPending} onOpenSendModal={onOpenAIModal} isLoading={false} fillHeight={fillHeight}/>}
        {mode==='indicator'&&<IndicatorPanel status={indicatorStatus} isLoading={false} fillHeight={fillHeight}/>}
        {mode==='momentum'&&<MomentumPanel status={momentumStatus} isLoading={false} fillHeight={fillHeight}/>}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// SETTINGS CARD
// ═══════════════════════════════════════════
const SettingsCard: React.FC<{
  mode:TradingMode; assets:StockityAsset[];
  assetRic:string; onAssetChange:(a:StockityAsset)=>void;
  isDemo:boolean; onDemoChange:(v:boolean)=>void;
  duration:number; onDurationChange:(v:number)=>void;
  amount:number; onAmountChange:(v:number)=>void;
  martingale:MartingaleConfig; onMartingaleChange:(c:MartingaleConfig)=>void;
  ftTf:FastTradeTimeframe; onFtTfChange:(v:FastTradeTimeframe)=>void;
  stopLoss:number; onSlChange:(v:number)=>void;
  stopProfit:number; onSpChange:(v:number)=>void;
  indicatorType:IndicatorType; onIndicatorTypeChange:(v:IndicatorType)=>void;
  indicatorPeriod:number; onIndicatorPeriodChange:(v:number)=>void;
  indicatorSensitivity:number; onSensitivityChange:(v:number)=>void;
  rsiOverbought:number; onOverboughtChange:(v:number)=>void;
  rsiOversold:number; onOversoldChange:(v:number)=>void;
  momentumPatterns:{candleSabit:boolean;dojiTerjepit:boolean;dojiPembatalan:boolean;bbSarBreak:boolean};
  onMomentumPatternsChange:(p:any)=>void;
  disabled?:boolean;
}> = ({mode,assets,assetRic,onAssetChange,isDemo,onDemoChange,duration,onDurationChange,amount,onAmountChange,martingale,onMartingaleChange,ftTf,onFtTfChange,stopLoss,onSlChange,stopProfit,onSpChange,indicatorType,onIndicatorTypeChange,indicatorPeriod,onIndicatorPeriodChange,indicatorSensitivity,onSensitivityChange,rsiOverbought,onOverboughtChange,rsiOversold,onOversoldChange,momentumPatterns,onMomentumPatternsChange,disabled}) => {
  const [open,setOpen] = useState(true);
  const [pickerOpen,setPickerOpen] = useState<string|null>(null);
  const [amtDrop,setAmtDrop] = useState(false);
  const set = (k:keyof MartingaleConfig,v:any) => onMartingaleChange({...martingale,[k]:v});
  const assetOpts: PickerOpt[] = assets.map(a=>({value:a.ric,label:a.name,sub:`${a.ric} · ${a.profitRate}%`,icon:a.iconUrl}));
  const durationOpts = [{value:'60',label:'1 Menit'},{value:'120',label:'2 Menit'},{value:'300',label:'5 Menit'},{value:'600',label:'10 Menit'},{value:'900',label:'15 Menit'},{value:'1800',label:'30 Menit'}];
  const acOpts: PickerOpt[] = [{value:'demo',label:'Demo',sub:'Virtual · tidak pakai dana nyata'},{value:'real',label:'Real',sub:'Menggunakan saldo sesungguhnya'}];
  const selectedAsset = assets.find(a=>a.ric===assetRic);
  const ac = modeAccent(mode);
  const isBelowMin = amount > 0 && amount < IDR_MIN_DISPLAY;

  const isNewMode = mode==='aisignal'||mode==='indicator'||mode==='momentum';
  const modeLabel = mode==='aisignal'?'AI Signal':mode==='indicator'?'Indicator':mode==='momentum'?'Momentum':mode==='ctc'?'CTC':mode==='fastrade'?'FastTrade':'Signal';

  return (
    <>
      <PickerModal open={pickerOpen==='asset'} onClose={()=>setPickerOpen(null)} title="Pilih Aset" options={assetOpts} value={assetRic} searchable onSelect={v=>{const a=assets.find(x=>x.ric===v);if(a)onAssetChange(a);}}/>
      <PickerModal open={pickerOpen==='actype'} onClose={()=>setPickerOpen(null)} title="Tipe Akun" options={acOpts} value={isDemo?'demo':'real'} onSelect={v=>onDemoChange(v==='demo')}/>
      <PickerModal open={pickerOpen==='duration'} onClose={()=>setPickerOpen(null)} title="Durasi Order" options={durationOpts} value={String(duration)} onSelect={v=>onDurationChange(+v)}/>
      <PickerModal open={pickerOpen==='ftTf'} onClose={()=>setPickerOpen(null)} title="Timeframe FastTrade" options={FT_TF.map(t=>({value:t.value,label:t.label}))} value={ftTf} onSelect={v=>onFtTfChange(v as FastTradeTimeframe)}/>

      <Card style={{opacity:disabled?0.65:1}}>
        <button onClick={()=>setOpen(!open)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'transparent',border:'none',borderBottom:open?`1px solid ${C.bdr}`:'none',cursor:'pointer'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <Settings style={{width:14,height:14,color:ac}}/>
            <span style={{fontSize:13,fontWeight:600,color:C.text}}>Pengaturan Order</span>
            {disabled&&<span style={{fontSize:10,padding:'1px 6px',borderRadius:6,color:C.muted,background:C.faint}}>terkunci</span>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:10,padding:'2px 8px',borderRadius:99,background:`${ac}12`,color:ac,border:`1px solid ${ac}25`}}>{modeLabel}</span>
            {open?<ChevronUp style={{width:13,height:13,color:C.muted}}/>:<ChevronDown style={{width:13,height:13,color:C.muted}}/>}
          </div>
        </button>
        {open&&(
          <div style={{padding:'14px 16px',pointerEvents:disabled?'none':undefined}}>
            <div style={{marginBottom:10}}>
              <FL>Aset Trading</FL>
              <PickerBtn label={selectedAsset?.name||''} placeholder="Pilih aset trading" disabled={disabled} onClick={()=>setPickerOpen('asset')}/>
            </div>
            {!isNewMode&&(
              <>
                {mode==='ctc'&&(
                  <div style={{marginBottom:10,padding:'10px 12px',borderRadius:10,background:'rgba(191,90,242,0.06)',border:'1px solid rgba(191,90,242,0.2)',display:'flex',gap:8}}>
                    <Copy style={{width:14,height:14,color:C.violet,flexShrink:0,marginTop:2}}/>
                    <div>
                      <p style={{fontSize:11,fontWeight:600,color:C.violet,marginBottom:4}}>CTC — Timeframe fixed 1 menit</p>
                      <p style={{fontSize:10,color:C.muted,lineHeight:1.5}}>WIN → lanjut arah sama · LOSE → martingale, arah mengikuti candle kalah</p>
                    </div>
                  </div>
                )}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  <div><FL>Tipe Akun</FL><PickerBtn label={isDemo?'Demo':'Real'} disabled={disabled} onClick={()=>setPickerOpen('actype')}/></div>
                  <div>
                    <FL>{mode==='fastrade'?'Timeframe':'Durasi'}</FL>
                    {mode==='fastrade'
                      ? <PickerBtn label={FT_TF.find(t=>t.value===ftTf)?.label||''} disabled={disabled} onClick={()=>setPickerOpen('ftTf')}/>
                      : mode==='ctc'
                      ? <div style={{display:'flex',alignItems:'center',padding:'9px 12px',borderRadius:8,background:'rgba(255,255,255,0.04)',border:`1px solid ${C.bdr}`}}><span style={{fontSize:13,flex:1,color:C.violet}}>1 Menit (fixed)</span><Copy style={{width:13,height:13,color:C.violet}}/></div>
                      : <PickerBtn label={durationOpts.find(d=>d.value===String(duration))?.label||''} disabled={disabled} onClick={()=>setPickerOpen('duration')}/>
                    }
                  </div>
                </div>
              </>
            )}
            {isNewMode&&(
              <div style={{marginBottom:10}}>
                <FL>Tipe Akun</FL>
                <PickerBtn label={isDemo?'Demo':'Real'} disabled={disabled} onClick={()=>setPickerOpen('actype')}/>
              </div>
            )}
            {mode!=='indicator'&&(
              <div style={{marginBottom:16}}>
                <FL>Jumlah per Order</FL>
                <div style={{display:'flex',gap:6}}>
                  <div style={{flex:1,position:'relative'}}>
                    <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:11,color:C.muted,zIndex:1,pointerEvents:'none'}}>Rp</span>
                    <input type="number" className="ds-input" value={amount} onChange={e=>onAmountChange(+e.target.value||0)} disabled={disabled} min={IDR_MIN_DISPLAY} step={1000} style={{paddingLeft:30,borderColor:isBelowMin?C.coral:undefined}}/>
                  </div>
                  <div style={{position:'relative',flexShrink:0}}>
                    <button type="button" disabled={disabled} onClick={()=>setAmtDrop(v=>!v)} style={{height:'100%',padding:'0 10px',display:'flex',alignItems:'center',gap:4,borderRadius:8,fontSize:11,fontWeight:600,background:amtDrop?`${ac}18`:'rgba(255,255,255,0.04)',border:`1px solid ${amtDrop?`${ac}40`:'rgba(255,255,255,0.1)'}`,color:amtDrop?ac:C.muted,cursor:disabled?'not-allowed':'pointer'}}>
                      Quick<ChevronDown style={{width:10,height:10,transform:amtDrop?'rotate(180deg)':'none',transition:'transform 0.15s'}}/>
                    </button>
                    {amtDrop&&!disabled&&(
                      <>
                        <div style={{position:'fixed',inset:0,zIndex:5}} onClick={()=>setAmtDrop(false)}/>
                        <div style={{position:'absolute',right:0,marginTop:4,zIndex:10,minWidth:160,borderRadius:12,overflow:'hidden',background:'linear-gradient(160deg,#161618 0%,#0e0e10 100%)',border:`1px solid ${ac}30`,boxShadow:'0 8px 32px rgba(0,0,0,0.5)',animation:'slide-up 0.15s ease'}}>
                          {QUICK_AMOUNTS.map((a,idx)=>{
                            const isAct=amount===a;
                            return (
                              <button key={a} type="button" onClick={()=>{onAmountChange(a);setAmtDrop(false);}} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',fontSize:12,background:isAct?`${ac}10`:'transparent',borderBottom:idx<QUICK_AMOUNTS.length-1?'1px solid rgba(255,255,255,0.04)':'none',borderLeft:isAct?`2px solid ${ac}`:'2px solid transparent',borderTop:'none',borderRight:'none',color:isAct?ac:C.sub,fontWeight:isAct?700:400,cursor:'pointer'}}>
                                <span>{a>=1000000?`Rp ${a/1000000}M`:`Rp ${(a/1000).toFixed(a%1000===0?0:1)}K`}</span>
                                {isAct&&<span style={{color:ac}}>✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {isBelowMin&&(
                  <div style={{display:'flex',alignItems:'center',gap:6,marginTop:6,padding:'6px 10px',borderRadius:8,background:'rgba(255,69,58,0.08)',border:'1px solid rgba(255,69,58,0.25)'}}>
                    <AlertCircle style={{width:11,height:11,color:C.coral,flexShrink:0}}/>
                    <p style={{fontSize:10,color:C.coral}}>Minimum IDR Rp {IDR_MIN_DISPLAY.toLocaleString('id-ID')}</p>
                    <button type="button" onClick={()=>onAmountChange(IDR_MIN_DISPLAY)} style={{marginLeft:'auto',fontSize:9,fontWeight:700,color:C.coral,background:'transparent',border:'none',cursor:'pointer',textDecoration:'underline',flexShrink:0}}>Set min →</button>
                  </div>
                )}
              </div>
            )}
            {mode==='indicator'&&(
              <>
                <Divider/>
                <SL accent={`rgba(255,107,53,0.5)`}>Indikator</SL>
                <div style={{padding:12,borderRadius:12,background:`${C.orange}06`,border:`1px solid ${C.orange}15`,marginBottom:12}}>
                  <div style={{marginBottom:10}}>
                    <FL>Tipe Indikator</FL>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                      {(['SMA','EMA','RSI'] as IndicatorType[]).map(t=>(
                        <button key={t} onClick={()=>onIndicatorTypeChange(t)} disabled={disabled} style={{padding:'8px 0',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',background:indicatorType===t?`${C.orange}18`:'rgba(255,255,255,0.04)',border:`1px solid ${indicatorType===t?`${C.orange}55`:'rgba(255,255,255,0.08)'}`,color:indicatorType===t?C.orange:'rgba(255,255,255,0.5)'}}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                    <div>
                      <FL>Period</FL>
                      <input type="number" className="ds-input" value={indicatorPeriod} onChange={e=>onIndicatorPeriodChange(+e.target.value||14)} disabled={disabled} min={2} max={200} step={1}/>
                    </div>
                    <div>
                      <FL>Sensitivitas</FL>
                      <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                        {[0.1,0.5,1,5,10].map(s=>(
                          <button key={s} onClick={()=>onSensitivityChange(s)} disabled={disabled} style={{flex:1,minWidth:28,padding:'5px 0',borderRadius:6,fontSize:10,fontWeight:700,cursor:'pointer',background:indicatorSensitivity===s?`${C.orange}18`:'rgba(255,255,255,0.04)',border:`1px solid ${indicatorSensitivity===s?`${C.orange}55`:'rgba(255,255,255,0.08)'}`,color:indicatorSensitivity===s?C.orange:'rgba(255,255,255,0.5)'}}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {indicatorType==='RSI'&&(
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                      <div>
                        <FL>Overbought</FL>
                        <input type="number" className="ds-input" value={rsiOverbought} onChange={e=>onOverboughtChange(+e.target.value||70)} disabled={disabled} min={50} max={100}/>
                      </div>
                      <div>
                        <FL>Oversold</FL>
                        <input type="number" className="ds-input" value={rsiOversold} onChange={e=>onOversoldChange(+e.target.value||30)} disabled={disabled} min={0} max={50}/>
                      </div>
                    </div>
                  )}
                  <div>
                    <FL>Jumlah per Order</FL>
                    <div style={{position:'relative'}}>
                      <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:11,color:C.muted,zIndex:1,pointerEvents:'none'}}>Rp</span>
                      <input type="number" className="ds-input" value={amount} onChange={e=>onAmountChange(+e.target.value||0)} disabled={disabled} min={IDR_MIN_DISPLAY} step={1000} style={{paddingLeft:30}}/>
                    </div>
                  </div>
                </div>
              </>
            )}
            {mode==='momentum'&&(
              <>
                <Divider/>
                <SL accent={`rgba(255,55,95,0.5)`}>Pola Candle</SL>
                <div style={{padding:12,borderRadius:12,background:`${C.pink}06`,border:`1px solid ${C.pink}15`,marginBottom:12}}>
                  {[
                    {k:'candleSabit',l:'Candle Sabit',d:'Body membesar berturut-turut'},
                    {k:'dojiTerjepit',l:'Doji Terjepit',d:'Doji setelah 3 candle panjang'},
                    {k:'dojiPembatalan',l:'Doji Pembatalan',d:'Sinyal reversal/pembatalan'},
                    {k:'bbSarBreak',l:'BB + SAR Break',d:'Breakout BB + konfirmasi SAR'},
                  ].map(({k,l,d})=>(
                    <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid rgba(255,55,95,0.08)`}}>
                      <div>
                        <p style={{fontSize:12,fontWeight:600,color:C.sub}}>{l}</p>
                        <p style={{fontSize:10,color:C.muted}}>{d}</p>
                      </div>
                      <Toggle checked={(momentumPatterns as any)[k]} onChange={v=>onMomentumPatternsChange({...momentumPatterns,[k]:v})} disabled={disabled} accent={C.pink}/>
                    </div>
                  ))}
                </div>
              </>
            )}
            {mode==='aisignal'&&(
              <>
                <Divider/>
                <div style={{marginBottom:12,padding:'10px 12px',borderRadius:10,background:`${C.sky}06`,border:`1px solid ${C.sky}20`,display:'flex',gap:8}}>
                  <Radio style={{width:14,height:14,color:C.sky,flexShrink:0,marginTop:2}}/>
                  <div>
                    <p style={{fontSize:11,fontWeight:600,color:C.sky,marginBottom:4}}>Mode AI Signal</p>
                    <p style={{fontSize:10,color:C.muted,lineHeight:1.5}}>Terima sinyal CALL/PUT dari Telegram/AI via endpoint <code style={{color:C.sky}}>/aisignal/signal</code></p>
                  </div>
                </div>
                <div style={{marginBottom:14}}>
                  <FL>Always Signal Mode</FL>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',borderRadius:10,background:'rgba(255,255,255,0.03)',border:`1px solid rgba(255,255,255,0.08)`}}>
                    <div>
                      <p style={{fontSize:12,color:C.sub}}>Martingale pada sinyal berikutnya</p>
                      <p style={{fontSize:10,color:C.muted}}>Tidak blocking, lanjut saat sinyal datang</p>
                    </div>
                    <Toggle checked={martingale.alwaysSignal??false} onChange={v=>set('alwaysSignal',v)} disabled={disabled} accent={C.sky}/>
                  </div>
                </div>
              </>
            )}
            <Divider/>
            <SL accent={`${ac}60`}>Martingale</SL>
            <div style={{padding:12,borderRadius:12,background:`${ac}06`,border:`1px solid ${ac}12`,marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:martingale.enabled?12:0}}>
                <div>
                  <p style={{fontSize:13,fontWeight:600,color:C.sub,marginBottom:2}}>Aktifkan Martingale</p>
                  <p style={{fontSize:10,color:C.muted}}>{mode==='ctc'?'Lipat gandakan amount · ikuti arah candle kalah':'Lipat gandakan amount setelah loss'}</p>
                </div>
                <Toggle checked={martingale.enabled} onChange={v=>set('enabled',v)} disabled={disabled} accent={ac}/>
              </div>
              {martingale.enabled&&(
                <div style={{paddingTop:12,borderTop:`1px solid ${C.bdr}`,display:'flex',flexDirection:'column',gap:10}}>
                  <div>
                    <FL>Max Step</FL>
                    <div style={{display:'flex',gap:6}}>
                      {[1,2,3,4,5].map(k=>(
                        <button key={k} type="button" disabled={disabled} onClick={()=>set('maxStep',k)} style={{flex:1,padding:'6px 0',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',background:martingale.maxStep===k?`${ac}18`:'rgba(255,255,255,0.04)',border:`1px solid ${martingale.maxStep===k?`${ac}50`:'rgba(255,255,255,0.08)'}`,color:martingale.maxStep===k?ac:'rgba(255,255,255,0.5)'}}>K{k}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <FL>Multiplier</FL>
                    <div style={{display:'flex',gap:6}}>
                      {[1.5,2,2.5,3,5].map(m=>(
                        <button key={m} type="button" disabled={disabled} onClick={()=>set('multiplier',m)} style={{flex:1,padding:'6px 0',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',background:martingale.multiplier===m?`${ac}18`:'rgba(255,255,255,0.04)',border:`1px solid ${martingale.multiplier===m?`${ac}50`:'rgba(255,255,255,0.08)'}`,color:martingale.multiplier===m?ac:'rgba(255,255,255,0.5)'}}>
                          {m}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {!isNewMode&&(
              <>
                <Divider/>
                <SL accent="rgba(255,69,58,0.55)">Risk Management</SL>
                <div style={{padding:12,borderRadius:12,background:'rgba(255,69,58,0.05)',border:'1px solid rgba(255,69,58,0.12)'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div>
                      <FL>Stop Loss</FL>
                      <div style={{position:'relative'}}>
                        <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:11,color:C.muted,zIndex:1,pointerEvents:'none'}}>Rp</span>
                        <input type="number" className="ds-input" value={stopLoss||''} onChange={e=>onSlChange(e.target.value?+e.target.value:0)} disabled={disabled} placeholder="Opsional" style={{paddingLeft:30}}/>
                      </div>
                    </div>
                    <div>
                      <FL>Take Profit</FL>
                      <div style={{position:'relative'}}>
                        <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:11,color:C.muted,zIndex:1,pointerEvents:'none'}}>Rp</span>
                        <input type="number" className="ds-input" value={stopProfit||''} onChange={e=>onSpChange(e.target.value?+e.target.value:0)} disabled={disabled} placeholder="Opsional" style={{paddingLeft:30}}/>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </>
  );
};

// ═══════════════════════════════════════════
// CONTROL CARD
// ═══════════════════════════════════════════
const ControlCard: React.FC<{
  mode:TradingMode;
  scheduleStatus:ScheduleStatus|null; orders:ScheduleOrder[];
  ftStatus:FastradeStatus|null;
  aiStatus:AISignalStatus|null;
  indicatorStatus:IndicatorStatus|null;
  momentumStatus:MomentumStatus|null;
  canStart:boolean; isLoading:boolean;
  profit:number;
  onStart:()=>void; onStop:()=>void; onPause:()=>void; onResume:()=>void;
  error:string|null;
  isBelowMin:boolean;
}> = ({mode,scheduleStatus,orders,ftStatus,aiStatus,indicatorStatus,momentumStatus,canStart,isLoading,profit,onStart,onStop,onPause,onResume,error,isBelowMin}) => {
  const [open,setOpen] = useState(true);
  const botState = scheduleStatus?.botState??'IDLE';
  const isSchedRunning = botState==='RUNNING', isSchedPaused = botState==='PAUSED';
  const isFtRunning = ftStatus?.isRunning??false;
  const isAIRunning = aiStatus?.isRunning??false;
  const isIndRunning = indicatorStatus?.isRunning??false;
  const isMomRunning = momentumStatus?.isRunning??false;
  const ac = modeAccent(mode);

  const isActive = (()=>{
    if(mode==='schedule') return isSchedRunning||isSchedPaused;
    if(mode==='fastrade'||mode==='ctc') return isFtRunning;
    if(mode==='aisignal') return isAIRunning;
    if(mode==='indicator') return isIndRunning;
    if(mode==='momentum') return isMomRunning;
    return false;
  })();

  const si = isActive ? {label:'Aktif',col:ac,pulse:true} : {label:'Standby',col:C.muted,pulse:false};

  const modeIcon = {
    schedule:<Calendar style={{width:14,height:14}}/>,
    fastrade:<Zap style={{width:14,height:14}}/>,
    ctc:<Copy style={{width:14,height:14}}/>,
    aisignal:<Radio style={{width:14,height:14}}/>,
    indicator:<BarChart style={{width:14,height:14}}/>,
    momentum:<Waves style={{width:14,height:14}}/>,
  }[mode];

  const modeLabel = {schedule:'Bot Signal',fastrade:'FastTrade',ctc:'CTC Bot',aisignal:'AI Signal',indicator:'Indicator',momentum:'Momentum'}[mode];
  const modeSub = {schedule:'Eksekusi terjadwal',fastrade:'Auto per candle',ctc:'Copy the Candle · 1m',aisignal:'Terima & eksekusi sinyal',indicator:'Analisis teknikal otomatis',momentum:'Deteksi pola candle'}[mode];

  const pnlPos = profit>=0;
  const wins = ftStatus?.totalWins??aiStatus?.totalWins??indicatorStatus?.totalWins??momentumStatus?.totalWins??0;
  const losses = ftStatus?.totalLosses??aiStatus?.totalLosses??indicatorStatus?.totalLosses??momentumStatus?.totalLosses??0;
  const total = ftStatus?.totalTrades??aiStatus?.totalTrades??indicatorStatus?.totalTrades??momentumStatus?.totalTrades??0;
  const wr = total>0?Math.round((wins/total)*100):null;

  return (
    <Card style={{borderColor:isActive?`${ac}40`:undefined}}>
      <button onClick={()=>setOpen(!open)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',background:'transparent',border:'none',borderBottom:open?'1px solid rgba(255,255,255,0.05)':'none',cursor:'pointer'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:28,height:28,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',background:`${ac}12`,border:`1px solid ${ac}25`}}>
            <span style={{color:ac}}>{modeIcon}</span>
          </div>
          <div>
            <span style={{display:'block',fontSize:13,fontWeight:600,lineHeight:1,marginBottom:3,color:C.text}}>{modeLabel}</span>
            <span style={{fontSize:10,color:C.muted}}>{modeSub}</span>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <StatusChip col={si.col} label={si.label} pulse={si.pulse}/>
          {open?<ChevronUp style={{width:12,height:12,color:C.muted}}/>:<ChevronDown style={{width:12,height:12,color:C.muted}}/>}
        </div>
      </button>
      {open&&(
        <div style={{padding:'12px 16px 16px'}}>
          <div style={{display:'flex',gap:8,marginBottom:12}}>
            {mode==='schedule'?(
              <>
                <div style={{flex:1,borderRadius:12,padding:'10px 12px',background:`${C.cyan}06`,border:`1px solid ${C.cyan}10`}}>
                  <span style={{display:'block',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:C.muted}}>Signal</span>
                  <span style={{fontSize:22,fontWeight:700,lineHeight:'1.1',color:C.text}}>{orders.filter(o=>!o.isExecuted&&!o.isSkipped).length}</span>
                </div>
                <div style={{flex:1,borderRadius:12,padding:'10px 12px',background:'rgba(0,0,0,0.25)',border:`1px solid ${pnlPos?'rgba(41,151,255,0.12)':'rgba(255,69,58,0.12)'}`}}>
                  <span style={{display:'block',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:C.muted}}>P&L Sesi</span>
                  <span style={{fontSize:16,fontWeight:700,lineHeight:'1.1',color:pnlPos?C.cyan:C.coral}}>{pnlPos?'+':''}{profit.toLocaleString('id-ID')}</span>
                </div>
              </>
            ):(
              <>
                <div style={{flex:1,borderRadius:12,padding:'10px 12px',background:'rgba(0,0,0,0.25)',border:`1px solid ${pnlPos?`${ac}12`:'rgba(255,69,58,0.12)'}`}}>
                  <span style={{display:'block',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:C.muted}}>P&L Sesi</span>
                  <span style={{fontSize:17,fontWeight:700,lineHeight:'1.1',color:pnlPos?ac:C.coral}}>{pnlPos?'+':''}{profit.toLocaleString('id-ID')}</span>
                </div>
                <div style={{flex:1,borderRadius:12,padding:'10px 12px',background:`${ac}05`,border:`1px solid ${ac}10`}}>
                  <span style={{display:'block',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:C.muted}}>W / L</span>
                  <span style={{fontSize:17,fontWeight:700,lineHeight:'1.1'}}><span style={{color:C.cyan}}>{wins}</span><span style={{fontSize:12,color:C.muted}}> / </span><span style={{color:C.coral}}>{losses}</span></span>
                </div>
                {wr!==null&&<div style={{flex:1,borderRadius:12,padding:'10px 12px',background:`${ac}05`,border:`1px solid ${ac}10`}}>
                  <span style={{display:'block',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:C.muted}}>Win%</span>
                  <span style={{fontSize:17,fontWeight:700,lineHeight:'1.1',color:wr>=50?ac:C.coral}}>{wr}%</span>
                </div>}
              </>
            )}
          </div>
          {error&&(
            <div style={{display:'flex',gap:8,padding:'10px 12px',marginBottom:12,borderRadius:12,background:'rgba(255,69,58,0.07)',border:'1px solid rgba(255,69,58,0.18)'}}>
              <AlertCircle style={{width:12,height:12,flexShrink:0,marginTop:1,color:C.coral}}/>
              <p style={{fontSize:11,color:C.coral}}>{error}</p>
            </div>
          )}
          <div style={{display:'flex',gap:8}}>
            {!isActive&&<CtrlBtn onClick={onStart} disabled={isLoading||!canStart||isBelowMin} loading={isLoading&&!isActive} accent={ac} label={`Mulai ${modeLabel}`} icon={<PlayCircle style={{width:14,height:14}}/>} solid/>}
            {isSchedRunning&&mode==='schedule'&&<CtrlBtn onClick={onPause} loading={isLoading} accent="#7EC8FF" label="Jeda" icon={<Timer style={{width:14,height:14}}/>}/>}
            {isActive&&<CtrlBtn onClick={onStop} loading={isLoading} accent={C.coral} label="Stop" icon={<StopCircle style={{width:14,height:14}}/>}/>}
          </div>
          {!canStart&&!isActive&&!error&&!isBelowMin&&(
            <p style={{marginTop:10,fontSize:10,textAlign:'center',color:C.muted}}>
              {mode==='schedule'?'Pilih aset + tambah signal untuk memulai':'Pilih aset untuk memulai'}
            </p>
          )}
          {isBelowMin&&!isActive&&(
            <p style={{marginTop:10,fontSize:10,textAlign:'center',color:C.coral}}>
              ✗ Amount di bawah minimum — set minimal Rp {IDR_MIN_DISPLAY.toLocaleString('id-ID')}
            </p>
          )}
        </div>
      )}
    </Card>
  );
};

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════
export default function DashboardPage() {
  const router = useRouter();
  const isMounted = useRef(true);
  useEffect(()=>{isMounted.current=true;return()=>{isMounted.current=false;};},[]);

  // ✅ FIX: gunakan storage.get() (async, Capacitor-safe) bukan localStorage
  useEffect(()=>{
    const init = async () => {
      const token = await storage.get('stc_token');
      if(!token){ router.push('/login'); return; }
      loadAll();
    };
    init();
  },[]); // eslint-disable-line

  const [assets,setAssets] = useState<StockityAsset[]>([]);
  const [balance,setBalance] = useState<ProfileBalance|null>(null);
  const [scheduleStatus,setScheduleStatus] = useState<ScheduleStatus|null>(null);
  const [scheduleOrders,setScheduleOrders] = useState<ScheduleOrder[]>([]);
  const [scheduleLogs,setScheduleLogs] = useState<ExecutionLog[]>([]);
  const [ftStatus,setFtStatus] = useState<FastradeStatus|null>(null);
  const [ftLogs,setFtLogs] = useState<FastradeLog[]>([]);
  const [isLoading,setIsLoading] = useState(true);

  const [aiStatus,setAiStatus] = useState<AISignalStatus|null>(null);
  const [aiPendingOrders,setAiPendingOrders] = useState<AISignalOrder[]>([]);
  const [indicatorStatus,setIndicatorStatus] = useState<IndicatorStatus|null>(null);
  const [momentumStatus,setMomentumStatus] = useState<MomentumStatus|null>(null);

  const [tradingMode,setTradingMode] = useState<TradingMode>('schedule');
  const [error,setError] = useState<string|null>(null);
  const [actionLoading,setActionLoading] = useState(false);
  const [orderModalOpen,setOrderModalOpen] = useState(false);
  const [aiSignalModalOpen,setAiSignalModalOpen] = useState(false);
  const [addOrderLoading,setAddOrderLoading] = useState(false);
  const [aiSendLoading,setAiSendLoading] = useState(false);
  const [deviceType,setDeviceType] = useState<'mobile'|'tablet'|'desktop'>('mobile');

  const [selectedRic,setSelectedRic] = useState('');
  const [isDemo,setIsDemo] = useState(true);
  const [duration,setDuration] = useState(60);
  const [amount,setAmount] = useState(50_000);
  const [martingale,setMartingale] = useState<MartingaleConfig>({enabled:false,maxStep:3,multiplier:2,alwaysSignal:false});
  const [ftTf,setFtTf] = useState<FastTradeTimeframe>('1m');
  const [stopLoss,setStopLoss] = useState(0);
  const [stopProfit,setStopProfit] = useState(0);

  const [indicatorType,setIndicatorType] = useState<IndicatorType>('SMA');
  const [indicatorPeriod,setIndicatorPeriod] = useState(14);
  const [indicatorSensitivity,setIndicatorSensitivity] = useState(0.5);
  const [rsiOverbought,setRsiOverbought] = useState(70);
  const [rsiOversold,setRsiOversold] = useState(30);

  const [momentumPatterns,setMomentumPatterns] = useState({candleSabit:true,dojiTerjepit:true,dojiPembatalan:true,bbSarBreak:true});

  const [flash,setFlash] = useState<'win'|'lose'|null>(null);
  const prevWRef = useRef(0), prevLRef = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const flashResult = useCallback((r:'win'|'lose')=>{
    if(flashTimer.current)clearTimeout(flashTimer.current);
    setFlash(r); flashTimer.current=setTimeout(()=>setFlash(null),2500);
  },[]);
  useEffect(()=>{
    const w=ftStatus?.totalWins??0, l=ftStatus?.totalLosses??0;
    if(w>prevWRef.current&&(prevWRef.current+prevLRef.current)>0)flashResult('win');
    else if(l>prevLRef.current&&(prevWRef.current+prevLRef.current)>0)flashResult('lose');
    prevWRef.current=w; prevLRef.current=l;
  },[ftStatus?.totalWins,ftStatus?.totalLosses]); // eslint-disable-line

  const [modeBlock,setModeBlock] = useState<string|null>(null);
  const mbTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const showBlock=(msg:string)=>{
    if(mbTimer.current)clearTimeout(mbTimer.current);
    setModeBlock(msg); mbTimer.current=setTimeout(()=>setModeBlock(null),3500);
  };

  useEffect(()=>{
    // ✅ FIX: Deteksi deviceType SEKALI saat mount, jangan listen 'resize'.
    // resize listener → setDeviceType → full re-render halaman setiap
    // kali keyboard muncul atau app resume dari background.
    const w = window.innerWidth;
    setDeviceType(w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop');
  },[]);

  const loadAll = useCallback(async(silent=false)=>{
    if(!silent)setIsLoading(true);
    try{
      const [assRes,balRes,schRes,ordRes,logRes,ftRes,ftLogRes,aiRes,aiPendRes,indRes,momRes] = await Promise.allSettled([
        api.getAssets(),api.balance(),api.scheduleStatus(),
        api.getOrders(),
        api.scheduleLogs(500),
        api.fastradeStatus(),
        api.fastradeLogs(500),
        api.aiSignalStatus(),api.aiSignalPendingOrders(),
        api.indicatorStatus(),api.momentumStatus(),
      ]);
      if(!isMounted.current)return;
      if(assRes.status==='fulfilled')setAssets(assRes.value);
      if(balRes.status==='fulfilled')setBalance(balRes.value);
      if(schRes.status==='fulfilled')setScheduleStatus(schRes.value);
      if(ordRes.status==='fulfilled')setScheduleOrders(ordRes.value);
      if(logRes.status==='fulfilled')setScheduleLogs(logRes.value);
      if(ftRes.status==='fulfilled')setFtStatus(ftRes.value);
      if(ftLogRes.status==='fulfilled')setFtLogs(ftLogRes.value);
      if(aiRes.status==='fulfilled')setAiStatus(aiRes.value);
      if(aiPendRes.status==='fulfilled')setAiPendingOrders(aiPendRes.value);
      if(indRes.status==='fulfilled')setIndicatorStatus(indRes.value);
      if(momRes.status==='fulfilled')setMomentumStatus(momRes.value);

      if (!silent) {
        const ftData  = ftRes.status  === 'fulfilled' ? ftRes.value  : null;
        const aiData  = aiRes.status  === 'fulfilled' ? aiRes.value  : null;
        const indData = indRes.status === 'fulfilled' ? indRes.value : null;
        const momData = momRes.status === 'fulfilled' ? momRes.value : null;
        const schData = schRes.status === 'fulfilled' ? schRes.value : null;

        if (ftData?.isRunning) {
          setTradingMode(ftData.mode === 'CTC' ? 'ctc' : 'fastrade');
        } else if (aiData?.isRunning) {
          setTradingMode('aisignal');
        } else if (indData?.isRunning) {
          setTradingMode('indicator');
        } else if (momData?.isRunning) {
          setTradingMode('momentum');
        } else if (schData?.botState === 'RUNNING' || schData?.botState === 'PAUSED') {
          setTradingMode('schedule');
        }
      }
    }catch(e:any){
      if(e?.status===401){router.push('/login');return;}
      if(!silent&&isMounted.current)setError('Gagal memuat data. Silakan refresh.');
    }finally{if(!silent&&isMounted.current)setIsLoading(false);}
  },[router]);

  useEffect(()=>{
    const iv=setInterval(async()=>{
      const results = await Promise.allSettled([
        api.scheduleStatus(),api.fastradeStatus(),api.getOrders(),
        api.fastradeLogs(500),
        api.aiSignalStatus(),api.aiSignalPendingOrders(),
        api.indicatorStatus(),api.momentumStatus(),
      ]);
      if(!isMounted.current)return;
      const [sRes,fRes,oRes,ftlRes,aiRes,aiPendRes,indRes,momRes] = results;
      if(sRes.status==='fulfilled')setScheduleStatus(sRes.value);
      if(fRes.status==='fulfilled')setFtStatus(fRes.value);
      if(oRes.status==='fulfilled')setScheduleOrders(oRes.value);
      if(ftlRes.status==='fulfilled')setFtLogs(ftlRes.value);
      if(aiRes.status==='fulfilled')setAiStatus(aiRes.value);
      if(aiPendRes.status==='fulfilled')setAiPendingOrders(aiPendRes.value);
      if(indRes.status==='fulfilled')setIndicatorStatus(indRes.value);
      if(momRes.status==='fulfilled')setMomentumStatus(momRes.value);
      const balRes = await api.balance().catch(()=>null);
      if(balRes&&isMounted.current)setBalance(balRes);
    },10000);
    return()=>clearInterval(iv);
  },[]); // eslint-disable-line

  const botState = scheduleStatus?.botState??'IDLE';
  const isSchedRunning = botState==='RUNNING', isSchedPaused = botState==='PAUSED';
  const isFtRunning = ftStatus?.isRunning??false;
  const isAIRunning = aiStatus?.isRunning??false;
  const isIndRunning = indicatorStatus?.isRunning??false;
  const isMomRunning = momentumStatus?.isRunning??false;

  const blockedModes: TradingMode[] = (()=>{
    const b: TradingMode[] = [];
    if(isSchedRunning||isSchedPaused){b.push('fastrade','ctc','aisignal','indicator','momentum');}
    if(isFtRunning&&ftStatus?.mode==='FTT'){b.push('schedule','ctc','aisignal','indicator','momentum');}
    if(isFtRunning&&ftStatus?.mode==='CTC'){b.push('schedule','fastrade','aisignal','indicator','momentum');}
    if(isAIRunning){b.push('schedule','fastrade','ctc','indicator','momentum');}
    if(isIndRunning){b.push('schedule','fastrade','ctc','aisignal','momentum');}
    if(isMomRunning){b.push('schedule','fastrade','ctc','aisignal','indicator');}
    return b.filter((v,i,a)=>a.indexOf(v)===i);
  })();

  const isActiveMode = (()=>{
    if(tradingMode==='schedule') return isSchedRunning||isSchedPaused;
    if(tradingMode==='fastrade'||tradingMode==='ctc') return isFtRunning;
    if(tradingMode==='aisignal') return isAIRunning;
    if(tradingMode==='indicator') return isIndRunning;
    if(tradingMode==='momentum') return isMomRunning;
    return false;
  })();

  const selectedAsset = assets.find(a=>a.ric===selectedRic)??null;
  const pendingOrders = scheduleOrders.filter(o=>!o.isExecuted&&!o.isSkipped);
  const canStart = tradingMode==='schedule' ? !!(selectedRic&&pendingOrders.length>0) : !!selectedRic;

  const sessionPnL = (()=>{
    if(tradingMode==='schedule') return (scheduleStatus as any)?.sessionPnL??0;
    if(tradingMode==='fastrade'||tradingMode==='ctc') return ftStatus?.sessionPnL??0;
    if(tradingMode==='aisignal') return aiStatus?.sessionPnL??0;
    if(tradingMode==='indicator') return indicatorStatus?.sessionPnL??0;
    if(tradingMode==='momentum') return momentumStatus?.sessionPnL??0;
    return 0;
  })();

  const profitToday = React.useMemo(()=>{
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let total = 0;
    // Filter berdasarkan mode akun yang sedang dipilih (demo/real)
    for(const log of scheduleLogs){
      if((log.executedAt??0)>=cutoff&&log.profit!=null&&log.isDemoAccount===isDemo) total+=log.profit;
    }
    for(const log of ftLogs){
      if((log.executedAt??0)>=cutoff&&log.profit!=null&&log.isDemoAccount===isDemo) total+=log.profit;
    }
    return total;
  },[scheduleLogs,ftLogs,isDemo]);

  const isBelowMin = amount > 0 && amount < IDR_MIN_DISPLAY;

  const handleModeChange = (m:TradingMode)=>{
    if(m===tradingMode)return;
    if(blockedModes.includes(m)){showBlock('Hentikan mode yang aktif terlebih dahulu.');return;}
    setTradingMode(m);setError(null);
  };

  const handleStart = async()=>{
    if(!selectedRic)return;
    if(isBelowMin&&tradingMode!=='indicator'){setError(`Amount di bawah minimum Rp ${IDR_MIN_DISPLAY.toLocaleString('id-ID')}.`);return;}
    setActionLoading(true);setError(null);
    try{
      if(tradingMode==='schedule'){
        await api.updateConfig({
          asset:{ric:selectedRic,name:selectedAsset?.name??selectedRic,profitRate:selectedAsset?.profitRate,iconUrl:selectedAsset?.iconUrl},
          martingale:{isEnabled:martingale.enabled,maxSteps:martingale.maxStep,baseAmount:amount*100,multiplierValue:martingale.multiplier,multiplierType:'FIXED',isAlwaysSignal:false},
          isDemoAccount:isDemo,currency:'IDR',currencyIso:'IDR',duration,
          stopLoss:stopLoss?stopLoss*100:undefined,stopProfit:stopProfit?stopProfit*100:undefined,
        });
        await api.scheduleStart();
      } else if(tradingMode==='fastrade'||tradingMode==='ctc'){
        await api.fastradeStart({
          mode:tradingMode==='ctc'?'CTC':'FTT',
          asset:{ric:selectedRic,name:selectedAsset?.name??selectedRic,profitRate:selectedAsset?.profitRate,iconUrl:selectedAsset?.iconUrl},
          martingale:{isEnabled:martingale.enabled,maxSteps:martingale.maxStep,baseAmount:amount*100,multiplierValue:martingale.multiplier,multiplierType:'FIXED'},
          isDemoAccount:isDemo,currency:'IDR',currencyIso:'IDR',
          stopLoss:stopLoss?stopLoss*100:undefined,stopProfit:stopProfit?stopProfit*100:undefined,
        });
      } else if(tradingMode==='aisignal'){
        await api.aiSignalSetAsset(selectedRic, selectedAsset?.name??selectedRic);
        await api.aiSignalUpdateConfig({
          baseAmount:amount*100,isDemoAccount:isDemo,
          martingaleEnabled:martingale.enabled,maxSteps:martingale.maxStep,
          multiplierValue:martingale.multiplier,isAlwaysSignal:martingale.alwaysSignal??false,
        });
        await api.aiSignalStart();
      } else if(tradingMode==='indicator'){
        await api.indicatorSetAsset(selectedRic, selectedAsset?.name??selectedRic);
        await api.indicatorSetAccount(isDemo);
        await api.indicatorSetMartingale({isEnabled:martingale.enabled,maxSteps:martingale.maxStep,baseAmount:amount*100,multiplierValue:martingale.multiplier,multiplierType:'FIXED'});
        await api.indicatorUpdateConfig({type:indicatorType,period:indicatorPeriod,sensitivity:indicatorSensitivity,rsiOverbought,rsiOversold,amount:amount*100});
        await api.indicatorStart();
      } else if(tradingMode==='momentum'){
        await api.momentumSetAsset(selectedRic, selectedAsset?.name??selectedRic);
        await api.momentumSetAccount(isDemo);
        await api.momentumUpdateConfig({
          candleSabitEnabled:momentumPatterns.candleSabit,
          dojiTerjepitEnabled:momentumPatterns.dojiTerjepit,
          dojiPembatalanEnabled:momentumPatterns.dojiPembatalan,
          bbSarBreakEnabled:momentumPatterns.bbSarBreak,
          baseAmount:amount*100,multiplierValue:martingale.multiplier,maxSteps:martingale.maxStep,
        });
        await api.momentumStart();
      }
      await loadAll(true);
    }catch(e:any){setError(e?.message??'Gagal memulai');}
    finally{setActionLoading(false);}
  };

  const handleStop = async()=>{
    if(!confirm('Yakin ingin menghentikan bot?'))return;
    setActionLoading(true);setError(null);
    try{
      if(tradingMode==='schedule') await api.scheduleStop();
      else if(tradingMode==='fastrade'||tradingMode==='ctc') await api.fastradeStop();
      else if(tradingMode==='aisignal') await api.aiSignalStop();
      else if(tradingMode==='indicator') await api.indicatorStop();
      else if(tradingMode==='momentum') await api.momentumStop();
      await loadAll(true);
    }catch(e:any){setError(e?.message??'Gagal menghentikan');}
    finally{setActionLoading(false);}
  };

  const handlePause  = async()=>{setActionLoading(true);try{await api.schedulePause();await loadAll(true);}catch(e:any){setError(e?.message??'Gagal menjeda');}finally{setActionLoading(false);}};
  const handleResume = async()=>{setActionLoading(true);try{await api.scheduleResume();await loadAll(true);}catch(e:any){setError(e?.message??'Gagal melanjutkan');}finally{setActionLoading(false);}};

  const handleAddOrders = async(input:string)=>{
    // Filter client-side: terima format HH:MM atau HH.MM diikuti arah
    // Arah yang diterima: call/buy/c/b (→ call) dan put/sell/p/s (→ put)
    // Mendukung format STC PRO: "00.00 B", "00.03 S"
    const validLines = input
      .split('\n')
      .map(l => {
        const trimmed = l.trim();
        const match = trimmed.match(/^(\d{1,2}[:.]\d{2})\s+(call|put|buy|sell|b|s|c|p)\b/i);
        if (!match) return null;
        // Normalisasi: ganti titik dengan titik dua, lalu pad jadi HH:MM
        const time = match[1].replace('.', ':').padStart(5, '0');
        const raw = match[2].toLowerCase();
        const trend = (raw === 'call' || raw === 'buy' || raw === 'c' || raw === 'b') ? 'call' : 'put';
        return `${time} ${trend}`;
      })
      .filter(Boolean)
      .join('\n');
    if (!validLines) return;
    setAddOrderLoading(true);
    try{const res=await api.addOrders(validLines);const newOrders=await api.getOrders();setScheduleOrders(newOrders);}
    catch(e:any){setError(e?.message??'Gagal menambah');}
    finally{setAddOrderLoading(false);}
  };

  const handleSendAISignal = async(trend:string,ms:number,msg:string)=>{
    setAiSendLoading(true);
    try{
      await api.aiSignalReceive(trend,ms,msg);
      await loadAll(true);
    }catch(e:any){setError(e?.message??'Gagal kirim sinyal');}
    finally{setAiSendLoading(false);}
  };

  const g = deviceType==='desktop'?20:deviceType==='tablet'?18:16;
  const px = 16;

  const TopCards = <ProfitCard profit={profitToday} isLoading={isLoading} flash={flash}/>;

  const InfoRow = (
    <div style={{display:'grid',gridTemplateColumns:deviceType==='desktop'?'repeat(4,1fr)':deviceType==='tablet'?'repeat(3,1fr)':'1fr 1fr',gap:g}}>
      <AssetCard asset={selectedAsset} mode={tradingMode} isLoading={isLoading}/>
      <BalanceCard balance={balance} accountType={isDemo?'demo':'real'} isLoading={isLoading}/>
      {deviceType!=='mobile'&&<RealtimeClock/>}
      {deviceType==='desktop'&&(
        <Card style={{padding:'11px 14px'}}>
          <p style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.08em',color:C.muted,marginBottom:5}}>Mode Aktif</p>
          <p style={{fontSize:16,fontWeight:700,color:isActiveMode?modeAccent(tradingMode):C.muted}}>
            {{schedule:'Signal',fastrade:'FastTrade',ctc:'CTC',aisignal:'AI Signal',indicator:'Indicator',momentum:'Momentum'}[tradingMode]}
          </p>
          <div style={{marginTop:6}}>
            <StatusChip col={isActiveMode?modeAccent(tradingMode):C.muted} label={isActiveMode?'Running':'Standby'}/>
          </div>
        </Card>
      )}
    </div>
  );

  const ModeSession = (fillH:boolean) => (
    <ModeSessionPanel
      mode={tradingMode} onModeChange={handleModeChange} locked={isActiveMode} blockedModes={blockedModes}
      orders={scheduleOrders} logs={scheduleLogs} onOpenModal={()=>setOrderModalOpen(true)} isRunning={isSchedRunning}
      ftStatus={ftStatus} ftLogs={ftLogs} ftLoading={false}
      aiStatus={aiStatus} aiPending={aiPendingOrders} onOpenAIModal={()=>setAiSignalModalOpen(true)}
      indicatorStatus={indicatorStatus}
      momentumStatus={momentumStatus}
      fillHeight={fillH}
    />
  );

  const SettingsCardEl = (
    <SettingsCard
      mode={tradingMode} assets={assets} assetRic={selectedRic}
      onAssetChange={a=>setSelectedRic(a.ric)}
      isDemo={isDemo} onDemoChange={setIsDemo}
      duration={duration} onDurationChange={setDuration}
      amount={amount} onAmountChange={setAmount}
      martingale={martingale} onMartingaleChange={setMartingale}
      ftTf={ftTf} onFtTfChange={setFtTf}
      stopLoss={stopLoss} onSlChange={setStopLoss}
      stopProfit={stopProfit} onSpChange={setStopProfit}
      indicatorType={indicatorType} onIndicatorTypeChange={setIndicatorType}
      indicatorPeriod={indicatorPeriod} onIndicatorPeriodChange={setIndicatorPeriod}
      indicatorSensitivity={indicatorSensitivity} onSensitivityChange={setIndicatorSensitivity}
      rsiOverbought={rsiOverbought} onOverboughtChange={setRsiOverbought}
      rsiOversold={rsiOversold} onOversoldChange={setRsiOversold}
      momentumPatterns={momentumPatterns} onMomentumPatternsChange={setMomentumPatterns}
      disabled={isActiveMode}
    />
  );

  const ControlCardEl = (
    <ControlCard
      mode={tradingMode} scheduleStatus={scheduleStatus} orders={scheduleOrders}
      ftStatus={ftStatus} aiStatus={aiStatus} indicatorStatus={indicatorStatus} momentumStatus={momentumStatus}
      canStart={canStart} isLoading={actionLoading} profit={sessionPnL}
      onStart={handleStart} onStop={handleStop} onPause={handlePause} onResume={handleResume}
      error={error} isBelowMin={isBelowMin&&tradingMode!=='indicator'}
    />
  );

  return (
    <div style={{minHeight:'100%',background:C.bg,paddingBottom:88}}>
      <style>{`
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes shimmer     { 0%,100%{background-position:200% 0} 50%{background-position:0% 0} }
        @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes ping        { 0%{transform:scale(1);opacity:1} 80%,100%{transform:scale(2);opacity:0} }
        @keyframes slide-up    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fade-in     { from{opacity:0} to{opacity:1} }
        @keyframes profit-slide-up   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes profit-slide-down { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes win-flash   { 0%{box-shadow:0 0 0 0 rgba(41,151,255,0)} 15%{box-shadow:0 0 0 4px rgba(41,151,255,0.35)} 100%{box-shadow:0 0 0 0 rgba(41,151,255,0)} }
        @keyframes lose-flash  { 0%{box-shadow:0 0 0 0 rgba(255,69,58,0)} 15%{box-shadow:0 0 0 4px rgba(255,69,58,0.35)} 100%{box-shadow:0 0 0 0 rgba(255,69,58,0)} }

        .ds-card {
          background: linear-gradient(145deg, #0e1d35 0%, #0a1526 100%);
          border: 1px solid rgba(41,151,255,0.16);
          border-radius: 14px;
        }

        .ds-input {
          width: 100%;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(41,151,255,0.18);
          color: #ffffff;
          outline: none;
          font-family: inherit;
          transition: border-color 0.15s;
          resize: vertical;
          box-sizing: border-box;
        }
        .ds-input:focus { border-color: rgba(41,151,255,0.45); }
        .ds-input::placeholder { color: rgba(255,255,255,0.28); }

        .schedule-item { transition: background 0.15s; }
        .schedule-item:hover { background: rgba(41,151,255,0.04) !important; }
      `}</style>

      <OrderInputModal open={orderModalOpen} onClose={()=>setOrderModalOpen(false)} orders={scheduleOrders} onAdd={handleAddOrders} onDelete={async(id)=>{try{await api.deleteOrder(id);setScheduleOrders(p=>p.filter(o=>o.id!==id));}catch(e:any){setError(e?.message??'Gagal hapus');}}} onClear={async()=>{await api.clearOrders();setScheduleOrders([]);}} loading={addOrderLoading}/>
      <AISignalInputModal open={aiSignalModalOpen} onClose={()=>setAiSignalModalOpen(false)} onSend={handleSendAISignal} loading={aiSendLoading}/>

      <div style={{maxWidth:1280,margin:'0 auto',padding:`16px ${px}px 0`}}>
        {error&&(
          <div style={{display:'flex',alignItems:'flex-start',gap:9,padding:'10px 14px',borderRadius:8,marginBottom:g,background:C.cord,border:`1px solid rgba(255,69,58,0.2)`,borderLeft:`2px solid ${C.coral}`}}>
            <AlertCircle style={{width:13,height:13,flexShrink:0,marginTop:2,color:C.coral}}/>
            <span style={{fontSize:12,flex:1,color:C.coral}}>{error}</span>
            <button onClick={()=>setError(null)} style={{background:'transparent',border:'none',cursor:'pointer',opacity:0.5,color:C.coral}}><X style={{width:13,height:13}}/></button>
          </div>
        )}
        {modeBlock&&(
          <div style={{display:'flex',alignItems:'center',gap:9,padding:'10px 14px',borderRadius:8,marginBottom:g,background:C.ambd,border:`1px solid rgba(255,159,10,0.2)`,animation:'slide-up 0.25s ease'}}>
            <Info style={{width:13,height:13,flexShrink:0,color:C.amber}}/>
            <span style={{fontSize:12,flex:1,color:C.amber}}>{modeBlock}</span>
            <button onClick={()=>setModeBlock(null)} style={{background:'transparent',border:'none',cursor:'pointer',opacity:0.5,color:C.amber}}><X style={{width:13,height:13}}/></button>
          </div>
        )}

        {deviceType==='desktop'&&(
          <div style={{paddingTop:24,display:'flex',flexDirection:'column',gap:g}}>
            {InfoRow}
            {TopCards}
            <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:g,alignItems:'start'}}>
              <Card style={{padding:16,display:'flex',flexDirection:'column',minHeight:420}}>
                <div style={{flex:1}}><ChartCard assetSymbol={selectedRic} height={340}/></div>
                {selectedRic&&(
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,marginTop:12}}>
                    <span style={{width:4,height:4,borderRadius:'50%',background:modeAccent(tradingMode),opacity:0.6}}/>
                    <span style={{fontSize:10,color:C.muted}}>{selectedRic} · {selectedAsset?.name}</span>
                  </div>
                )}
              </Card>
              <div style={{display:'flex',flexDirection:'column',gap:g}}>
                {ModeSession(false)}
                {SettingsCardEl}
                {ControlCardEl}
              </div>
            </div>
          </div>
        )}

        {deviceType==='tablet'&&(
          <div style={{display:'flex',flexDirection:'column',gap:g}}>
            {InfoRow}
            {TopCards}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:g,alignItems:'stretch'}}>
              <Card style={{padding:12}}><ChartCard assetSymbol={selectedRic} height={220}/></Card>
              {ModeSession(true)}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:g}}>
              {SettingsCardEl}
              {ControlCardEl}
            </div>
          </div>
        )}

        {deviceType==='mobile'&&(
          <div style={{display:'flex',flexDirection:'column',gap:g}}>
            {TopCards}
            <div style={{display:'grid',gridTemplateColumns:'3fr 2fr',gap:g,alignItems:'stretch'}}>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <RealtimeClockCompact/>
                <Card style={{padding:10,flex:1,display:'flex',flexDirection:'column'}}>
                  <ChartCard assetSymbol={selectedRic} height={110}/>
                  <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'flex-end',gap:5,marginTop:8}}>
                    {selectedRic&&(
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'3px 8px',borderRadius:6,background:C.faint}}>
                        <span style={{width:4,height:4,borderRadius:'50%',background:modeAccent(tradingMode),opacity:0.6,flexShrink:0}}/>
                        <span style={{fontSize:9,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selectedRic}</span>
                      </div>
                    )}
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:9,color:C.muted}}>Status</span>
                      <span style={{display:'flex',alignItems:'center',gap:4,fontSize:9,fontWeight:600,color:isActiveMode?modeAccent(tradingMode):C.muted}}>
                        <span style={{width:5,height:5,borderRadius:'50%',background:isActiveMode?modeAccent(tradingMode):'rgba(255,255,255,0.2)'}}/>
                        {isActiveMode?'Aktif':'Off'}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>
              {ModeSession(true)}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:g}}>
              <AssetCard asset={selectedAsset} mode={tradingMode} isLoading={isLoading}/>
              <BalanceCard balance={balance} accountType={isDemo?'demo':'real'} isLoading={isLoading}/>
            </div>
            {SettingsCardEl}
            {ControlCardEl}
          </div>
        )}
      </div>
    </div>
  );
}