'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type StockityAsset, type ProfileBalance, type ScheduleStatus,
  type ScheduleOrder, type ExecutionLog,
  type FastradeStatus, type FastradeLog,
  type AISignalStatus, type AISignalOrder, type AISignalConfig,
  type IndicatorStatus, type IndicatorConfig, type IndicatorType,
  type MomentumStatus, type MomentumConfig,
  type TodayProfitSummary,
  type AlwaysSignalLossState,
} from '@/lib/api';
import { ChartCard } from '@/components/ChartCard';
import AssetIcon from '@/components/common/AssetIcon';
import { storage, isSessionValid } from '@/lib/storage';
import { useLanguage } from '@/lib/i18n';
import { useDarkMode } from '@/lib/DarkModeContext';
import {
  Activity, AlertCircle, BarChart2, Calendar,
  ChevronDown, ChevronUp, Info, Plus,
  Settings, Trash2, X, Zap, TrendingUp, TrendingDown,
  PlayCircle, StopCircle, PauseCircle, RefreshCw, Timer, Copy,
  ArrowRight, Radio, BarChart, Waves,
  Wallet, Clock, CreditCard, Eye, EyeOff,
} from 'lucide-react';

// ═══════════════════════════════════════════
// DESIGN TOKENS - Emerald Theme (Dark/Light)
// ═══════════════════════════════════════════
function getColors(isDark: boolean) {
  // ── Dark: matched to Kotlin DarkColors ──────────────────────────────────
  // background=#161616  surface=#1F1F1F  cardBackground=#323232
  // textPrimary=#EBEBEB textSecondary=#BAC1CB textMuted=rgba(126,126,126,.73)
  // successColor=#10B981  errorColor=#EF4444  warningColor=#FBBF24
  // borderColor=#494949   chartLine=Cyan(#00FFFF)
  //
  // ── Light: matched to Kotlin LightColors ────────────────────────────────
  // background=#F8F9FA  surface=#FFFFFF  surface3=#EBEBEB
  // textPrimary=#1F2937  textSecondary=#6B7280  textMuted=#9CA3AF
  // successColor=#059669  errorColor=#DC2626  warningColor=#D97706
  // borderColor=#D6DADF
  return {
    // Surfaces
    bg:    isDark ? '#161616' : '#F8F9FA',   // Kotlin: background
    card:  isDark ? '#2C2C2C' : '#FFFFFF',   // Kotlin: cardBackground ~#323232, softer
    card2: isDark ? '#1F1F1F' : '#EBEBEB',   // Kotlin: surface / surface3
    // Borders
    bdr:   isDark ? 'rgba(73,73,73,0.75)' : 'rgba(214,218,223,0.90)', // Kotlin: #494949 / #D6DADF
    bdrAct:'rgba(16,185,129,0.55)',
    // Primary accent — successColor in Kotlin
    cyan:  isDark ? '#10B981' : '#059669',   // Kotlin: successColor dark / light
    cyand: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(5,150,105,0.10)',
    // Error / loss
    coral: isDark ? '#EF4444' : '#DC2626',   // Kotlin: errorColor
    cord:  isDark ? 'rgba(239,68,68,0.16)'  : 'rgba(220,38,38,0.09)',
    // Warning / martingale
    amber: isDark ? '#FBBF24' : '#D97706',   // Kotlin: warningColor
    ambd:  isDark ? 'rgba(251,191,36,0.15)' : 'rgba(217,119,6,0.09)',
    // Misc accent colors
    violet: isDark ? '#C96CF5' : '#BF5AF2',
    vltd:  isDark ? 'rgba(201,108,245,0.14)' : 'rgba(191,90,242,0.09)',
    sky:   isDark ? '#34D399' : '#34D399',   // emerald-400 (accentProfit area)
    skyd:  isDark ? 'rgba(52,211,153,0.14)' : 'rgba(52,211,153,0.09)',
    orange:'#FF6B35',
    orgd:  isDark ? 'rgba(255,107,53,0.14)' : 'rgba(255,107,53,0.09)',
    pink:  '#FF375F',
    pinkd: isDark ? 'rgba(255,55,95,0.14)'  : 'rgba(255,55,95,0.09)',
    // Text
    text:  isDark ? '#EBEBEB' : '#1F2937',   // Kotlin: textPrimary
    sub:   isDark ? '#BAC1CB' : '#6B7280',   // Kotlin: textSecondary
    muted: isDark ? 'rgba(126,126,126,0.80)' : '#9CA3AF', // Kotlin: textMuted
    faint: isDark ? 'rgba(16,185,129,0.08)'  : 'rgba(5,150,105,0.05)',
  };
}

// Module-level colors — updated each render by DashboardPage via C = colors
// Must be `let` so sub-components always get the current theme on re-render
let C = getColors(true);
let T: (k: string) => string = (k: string) => k;

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
  <div style={{width:w,height:h,background:C.faint,borderRadius:4,...style}}/>
);

const Card: React.FC<{children:React.ReactNode;style?:React.CSSProperties;className?:string;flash?:'win'|'lose'|null;onClick?:()=>void}> =
({children,style,className='',flash,onClick}) => (
  <div className={`ds-card overflow-hidden ${className}`} onClick={onClick} style={{
    // Flash animation hanya berjalan pada .ds-card (box-shadow pulse)
    // Border rotation tetap berjalan pada ::before — tidak terpengaruh
    animation: flash==='win'
      ? 'win-flash 2s ease forwards'
      : flash==='lose'
      ? 'lose-flash 2s ease forwards'
      : undefined,
    borderRadius: 18, // More rounded like Kotlin
    // boxShadow TIDAK di-override inline — biarkan globals.css yang mengontrol
    ...style,
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
  <label style={{display:'block',fontSize:10,fontWeight:600,marginBottom:6,letterSpacing:'0.06em',textTransform:'uppercase',color:C.muted}}>{children}</label>
);

const Toggle: React.FC<{checked:boolean;onChange:(v:boolean)=>void;disabled?:boolean;accent?:string}> = ({checked,onChange,disabled,accent=C.cyan}) => (
  <label style={{display:'inline-flex',alignItems:'center',cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.4:1}}>
    <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} disabled={disabled} style={{position:'absolute',opacity:0,width:0,height:0}}/>
    <div style={{width:44,height:22,borderRadius:22,position:'relative',transition:'all 0.2s',background:checked?`${accent}28`:C.bdr,border:`1px solid ${checked?`${accent}55`:C.bdr}`}}>
      <div style={{position:'absolute',top:2,width:16,height:16,borderRadius:'50%',transition:'left 0.2s',left:checked?23:2,background:checked?accent:C.muted}}/>
    </div>
  </label>
);

const StatusChip: React.FC<{col:string;label:string;pulse?:boolean}> = ({col,label,pulse}) => (
  <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',padding:'4px 10px',borderRadius:99,color:col,background:`${col}10`,border:`1px solid ${col}28`}}>
    <span style={{width:5,height:5,borderRadius:'50%',background:col,animation:pulse?'ping 1.6s ease-in-out infinite':undefined,boxShadow:`0 0 4px ${col}`}}/>
    {label}
  </span>
);

/** Tampilkan status Always Signal Martingale yang sedang aktif */
const AlwaysSignalBadge: React.FC<{
  isActive: boolean;
  step: number;
  maxSteps: number;
  totalLoss?: number;
  accent?: string;
}> = ({ isActive, step, maxSteps, totalLoss, accent = C.amber }) => {
  if (!isActive) return null;
  const lossDisplay = totalLoss ? `  −${Math.round(Math.abs(totalLoss) / 100).toLocaleString('id-ID')}` : '';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '5px 10px', borderRadius: 99,
      background: `${accent}12`, border: `1px solid ${accent}35`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: accent, animation: 'ping 1.4s ease-in-out infinite', boxShadow: `0 0 5px ${accent}` }} />
      <span style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Always Signal
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'monospace', color: accent }}>
        K{step}/{maxSteps}
      </span>
      {lossDisplay && (
        <span style={{ fontSize: 9, color: C.coral, fontFamily: 'monospace' }}>{lossDisplay}</span>
      )}
    </div>
  );
};

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
    {loading?T('common.processing'):label}
  </button>
);

// ═══════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════
const RealtimeClock: React.FC<{t:(k:string)=>string;lang:string;isBotRunning?:boolean}> = ({t:tr,lang,isBotRunning=false}) => {
  const [time,setTime] = useState<Date|null>(null);
  useEffect(()=>{setTime(new Date());const id=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(id);},[]);
  const locale = lang==='ru'?'ru-RU':lang==='en'?'en-US':'id-ID';
  const fmt  = (d:Date) => {const h=String(d.getHours()).padStart(2,'0');const m=String(d.getMinutes()).padStart(2,'0');const s=String(d.getSeconds()).padStart(2,'0');return`${h}:${m}:${s}`;};
  const fmtD = (d:Date) => d.toLocaleDateString(locale,{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
  const tz   = () => {if(!time)return'';const o=-time.getTimezoneOffset()/60;return`UTC${o>=0?'+':''}${o}`;};
  const dotColor = isBotRunning ? C.cyan : C.coral;
  return (
    <div style={{
      borderRadius:16,overflow:'hidden',height:'100%',
      background:C.card,
      border:`1px solid rgba(16,185,129,0.40)`,
      boxShadow:`0 4px 18px rgba(0,0,0,0.28)`,
      padding:'14px 14px 10px',
      display:'flex',flexDirection:'column',gap:6,
    }}>
      {/* Digital time box */}
      <div style={{
        height:46,borderRadius:12,
        background:C.card2,
        border:`1px solid rgba(16,185,129,0.35)`,
        display:'flex',alignItems:'center',justifyContent:'center',
      }}>
        <p suppressHydrationWarning style={{
          fontSize:28,fontWeight:700,lineHeight:1,letterSpacing:'0.08em',
          fontFamily:"'DSEG7 Classic','Share Tech Mono',ui-monospace,monospace",
          color:C.text,
          textShadow:`0 0 20px rgba(16,185,129,0.40),0 0 6px rgba(16,185,129,0.18)`,
          margin:0,
        }}>{time?fmt(time):'--:--:--'}</p>
      </div>
      {/* Date row */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span suppressHydrationWarning style={{fontSize:8,color:C.sub}}>{time?fmtD(time):''}</span>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <span style={{fontSize:8,fontWeight:600,color:C.text}}>{tz()}</span>
          <span style={{
            width:8,height:8,borderRadius:'50%',flexShrink:0,
            background:dotColor,
            boxShadow:`0 0 ${isBotRunning?6:3}px ${dotColor}`,
            animation:isBotRunning?'ping 1.6s ease-in-out infinite':undefined,
          }}/>
        </div>
      </div>
    </div>
  );
};

const RealtimeClockCompact: React.FC<{t:(k:string)=>string;lang:string;isBotRunning?:boolean}> = ({t:tr,lang,isBotRunning=false}) => {
  const [time,setTime] = useState<Date|null>(null);
  useEffect(()=>{setTime(new Date());const id=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(id);},[]);
  const locale = lang==='ru'?'ru-RU':lang==='en'?'en-US':'id-ID';
  const fmt     = (d:Date) => {const h=String(d.getHours()).padStart(2,'0');const m=String(d.getMinutes()).padStart(2,'0');const s=String(d.getSeconds()).padStart(2,'0');return`${h}:${m}:${s}`;};
  const fmtDay  = (d:Date) => d.toLocaleDateString(locale,{weekday:'short'});
  const fmtDate = (d:Date) => d.toLocaleDateString(locale,{day:'2-digit',month:'short',year:'numeric'});
  const tz      = () => {if(!time)return'';const o=-time.getTimezoneOffset()/60;return`UTC${o>=0?'+':''}${o}`;};
  const dotColor = isBotRunning ? C.cyan : C.coral;
  const tzLabel = lang==='ru'?'ВРЕМЯ':lang==='en'?T('dashboard.localTime').toUpperCase():T('dashboard.localTime').toUpperCase();
  return (
    <div style={{
      width:'100%',borderRadius:14,overflow:'hidden',
      background:C.bg,
      border:`1px solid rgba(16,185,129,0.38)`,
      boxShadow:`0 2px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.40), 0 0 0 1px rgba(0,0,0,0.25)`,
      padding:'10px 12px 8px',
      display:'flex',flexDirection:'column',gap:5,
    }}>
      {/* Digital time box */}
      <div style={{
        borderRadius:10,
        background:C.card2,
        border:`1px solid rgba(16,185,129,0.32)`,
        display:'flex',alignItems:'center',justifyContent:'center',
        padding:'7px 0',
      }}>
        <p suppressHydrationWarning style={{
          fontSize:18,fontWeight:700,lineHeight:1,letterSpacing:'0.08em',
          fontFamily:"'DSEG7 Classic','Share Tech Mono',ui-monospace,monospace",
          color:C.text,margin:0,
          textShadow:`0 0 18px rgba(16,185,129,0.38),0 0 5px rgba(16,185,129,0.15)`,
        }}>{time?fmt(time):'--:--:--'}</p>
      </div>
      {/* Date + UTC + dot */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <span suppressHydrationWarning style={{fontSize:8,color:C.sub,fontWeight:500}}>{time?fmtDay(time):''}</span>
          <span style={{width:2,height:2,borderRadius:'50%',background:C.muted}}/>
          <span suppressHydrationWarning style={{fontSize:8,color:C.muted}}>{time?fmtDate(time):''}</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <span style={{
            fontSize:7,fontWeight:700,color:C.cyan,letterSpacing:'0.04em',
            background:'rgba(16,185,129,0.12)',border:'1px solid rgba(16,185,129,0.26)',
            borderRadius:4,padding:'1px 4px',
          }}>{tz()}</span>
          <span style={{
            width:7,height:7,borderRadius:'50%',
            background:dotColor,
            boxShadow:`0 0 ${isBotRunning?6:3}px ${dotColor}`,
            animation:isBotRunning?'ping 1.6s ease-in-out infinite':undefined,
          }}/>
        </div>
      </div>
    </div>
  );
};

/** Inline clock for desktop top strip — just time + date, no wrapper card */
const RealtimeClockDesktop: React.FC = () => {
  const [time, setTime] = useState<Date|null>(null);
  useEffect(()=>{setTime(new Date());const id=setInterval(()=>setTime(new Date()),1000);return()=>clearInterval(id);},[]);
  const fmt  = (d:Date)=>{const h=String(d.getHours()).padStart(2,'0');const m=String(d.getMinutes()).padStart(2,'0');const s=String(d.getSeconds()).padStart(2,'0');return`${h}:${m}:${s}`;};
  const fmtD = (d:Date)=>d.toLocaleDateString('id-ID',{weekday:'short',day:'2-digit',month:'short'});
  const tz   = ()=>{if(!time)return'';const o=-time.getTimezoneOffset()/60;return`UTC${o>=0?'+':''}${o}`;};
  return (
    <div>
      <p suppressHydrationWarning style={{
        fontSize:15,fontWeight:700,letterSpacing:'0.06em',lineHeight:1,
        color:C.text,
        fontFamily:"'DSEG7 Classic','Share Tech Mono',ui-monospace,monospace",
        textShadow:`0 0 14px rgba(16,185,129,0.45),0 0 4px rgba(16,185,129,0.18)`,
      }}>
        {time?fmt(time):'--:--:--'}
      </p>
      <div suppressHydrationWarning style={{display:'flex',alignItems:'center',gap:5,marginTop:2}}>
        <span style={{fontSize:10,color:C.muted}}>{time?fmtD(time):''}</span>
        <span style={{fontSize:9,fontWeight:700,color:C.cyan,background:'rgba(16,185,129,0.10)',border:'1px solid rgba(16,185,129,0.20)',borderRadius:4,padding:'0px 4px'}}>{tz()}</span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
const BalanceCard: React.FC<{balance:ProfileBalance|null;accountType:'demo'|'real';isLoading?:boolean;t:(k:string)=>string}> = ({balance,accountType,isLoading,t}) => {
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
        <span style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.08em',color:C.muted}}>{t('dashboard.balance')}</span>
        <span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:99,color:col,background:colBg,border:`1px solid ${col}30`}}>{isDemo?t('common.demo'):t('common.real')}</span>
      </div>
      {isLoading?<Sk h={26} w={110}/>:
        hidden?(
          <div style={{display:'flex',alignItems:'center',gap:3,marginTop:4}}>
            {[...Array(6)].map((_,i)=><span key={i} style={{width:5,height:5,borderRadius:'50%',background:col,opacity:0.4+(i%2)*0.2}}/>)}
          </div>
        ):(
          <p style={{fontSize:'clamp(16px,4vw,24px)',fontWeight:700,letterSpacing:'-0.02em',lineHeight:1,color:col}}>
            {Math.round(amount).toLocaleString('id-ID',{maximumFractionDigits:0})}
          </p>
        )
      }
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
        <span style={{fontSize:9,color:C.muted}}>{balance?.currency??'IDR'}</span>
        <button onClick={()=>setHidden(h=>!h)} style={{background:'transparent',border:'none',cursor:'pointer',color:C.muted,padding:0,fontSize:11}}>
          {hidden?'👁':'👁‍🗨'}
        </button>
      </div>
    </Card>
  );
};

// ═══════════════════════════════════════════
// COMPACT ASSET CARD (Mobile 2-row layout)
// ═══════════════════════════════════════════
const AssetCardCompact: React.FC<{asset?:StockityAsset|null;mode:TradingMode;isLoading?:boolean;t:(k:string)=>string;onOpenPicker?:()=>void;disabled?:boolean}> = ({asset,mode,isLoading,t,onOpenPicker,disabled}) => {
  const modeCol = modeAccent(mode);
  const abbr = asset?.ric ? asset.ric.slice(0,3).toUpperCase() : '+';
  const [imgErr,setImgErr] = useState(false);
  if(isLoading) return <Card style={{padding:'10px 12px'}}><Sk w={80} h={18}/></Card>;
  return (
    <Card style={{padding:'10px 12px',cursor:onOpenPicker&&!disabled?'pointer':'default',position:'relative'}} onClick={onOpenPicker&&!disabled?onOpenPicker:undefined}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <div style={{width:32,height:32,borderRadius:9,overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:`${modeCol}12`,border:`1px solid ${modeCol}28`}}>
          {asset?.iconUrl&&!imgErr?(
            <img src={asset.iconUrl} alt={asset.ric} crossOrigin="anonymous"
              onError={()=>setImgErr(true)}
              style={{width:'100%',height:'100%',objectFit:'contain',padding:3}}
            />
          ):(
            <span style={{fontWeight:700,fontSize:18,color:modeCol,letterSpacing:'-0.02em'}}>{abbr}</span>
          )}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:9,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.06em',color:C.muted,lineHeight:1,marginBottom:3}}>{t('dashboard.asset')}</p>
          {asset?(
            <p style={{fontSize:13,fontWeight:700,lineHeight:1,color:C.text,letterSpacing:'-0.02em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{asset.name}</p>
          ):(
            <p style={{fontSize:11,color:modeCol,fontWeight:600}}>{t('dashboard.notSelected')}</p>
          )}
        </div>
        {asset
          ? <span style={{fontSize:10,fontWeight:700,color:modeCol,flexShrink:0}}>{asset.profitRate}%</span>
          : onOpenPicker&&!disabled&&<ChevronDown style={{width:12,height:12,color:modeCol,flexShrink:0}}/>
        }
      </div>
    </Card>
  );
};

// ═══════════════════════════════════════════
// COMPACT BALANCE CARD (Mobile 2-row layout)
// ════════════════════��══════════════════════
const BalanceCardCompact: React.FC<{balance:ProfileBalance|null;accountType:'demo'|'real';isLoading?:boolean;t:(k:string)=>string}> = ({balance,accountType,isLoading,t}) => {
  const [hidden,setHidden] = useState(false);
  const isDemo = accountType==='demo';
  const rawAmount = isDemo
    ? (balance?.demo_balance ?? balance?.balance ?? 0)
    : (balance?.real_balance ?? balance?.balance ?? 0);
  const amount = rawAmount / 100;
  const col = isDemo?C.amber:C.cyan;
  const colBg = isDemo?'rgba(255,159,10,0.08)':'rgba(16,185,129,0.08)';
  return (
    <Card style={{padding:'10px 12px'}}>
      {/* Baris 1: label + badge + eye */}
      <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5}}>
        <span style={{fontSize:9,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.06em',color:C.muted,flex:1}}>{t('dashboard.balance')}</span>
        <span style={{fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:99,color:col,background:colBg,border:`1px solid ${col}30`}}>{isDemo?t('common.demo'):t('common.real')}</span>
        <button onClick={()=>setHidden(h=>!h)} style={{background:'transparent',border:'none',cursor:'pointer',color:C.muted,padding:0,fontSize:10,lineHeight:1}}>
          {hidden?'👁':'👁‍🗨'}
        </button>
      </div>
      {/* Baris 2: angka + currency pojok kanan */}
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:4}}>
        {isLoading?<Sk h={18} w={80}/>:
          hidden?(
            <div style={{display:'flex',alignItems:'center',gap:2}}>
              {[...Array(5)].map((_,i)=><span key={i} style={{width:4,height:4,borderRadius:'50%',background:col,opacity:0.4+(i%2)*0.2}}/>)}
            </div>
          ):(
            <p style={{fontSize:'clamp(14px,3.5vw,18px)',fontWeight:700,letterSpacing:'-0.02em',lineHeight:1,color:col}}>
              {Math.round(amount).toLocaleString('id-ID',{maximumFractionDigits:0})}
            </p>
          )
        }
        <span style={{fontSize:11,fontWeight:700,color:C.muted,letterSpacing:'0.04em'}}>{balance?.currency??'IDR'}</span>
      </div>
    </Card>
  );
};

// ═══════════════════════════════════════════
// PROFIT CARD - with auto-scaling font and 00 trimmed for mobile
// ═══════════════════════════════════════════
const formatProfitDisplay = (profit: number): string => {
  const absVal = Math.abs(profit / 100);
  // Remove trailing 00 for cleaner display (like trading settings)
  const formatted = Math.round(absVal).toLocaleString('id-ID', { maximumFractionDigits: 0 });
  // Remove trailing 00 patterns (e.g., 14000 -> 14k, 100000 -> 100k)
  return formatted;
};

const getAutoScaleFontSize = (valueLength: number): string => {
  // Auto scale font based on digit count - larger font for smaller numbers
  if (valueLength <= 4) return 'clamp(18px, 5vw, 24px)';
  if (valueLength <= 6) return 'clamp(16px, 4vw, 20px)';
  if (valueLength <= 8) return 'clamp(14px, 3.5vw, 18px)';
  return 'clamp(12px, 3vw, 16px)';
};

const ProfitCard: React.FC<{profit:number;isLoading?:boolean;flash?:'win'|'lose'|null;t:(k:string)=>string}> = ({profit,isLoading,flash,t}) => {
  const isPos = profit>=0;
  const col   = isPos?C.cyan:C.coral;
  const prevR = useRef(profit);
  const [animKey,setAnimKey] = useState(0);
  const [dir,setDir] = useState<'up'|'down'>('up');
  useEffect(()=>{
    if(profit!==prevR.current){setDir(profit>prevR.current?'up':'down');setAnimKey(k=>k+1);prevR.current=profit;}
  },[profit]);
  
  const displayValue = formatProfitDisplay(profit);
  const fontSize = getAutoScaleFontSize(displayValue.length);
  
  return (
    <Card style={{padding:'11px 16px'}} flash={flash}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div style={{display:'flex',flexDirection:'column',gap:4,flexShrink:0}}>
          <span style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',color:C.muted}}>{t('dashboard.profitToday')}</span>
          <span style={{display:'flex',alignItems:'center',gap:5,padding:'2px 7px',borderRadius:99,background:`${col}10`,border:`1px solid ${col}22`,width:'fit-content'}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:col,boxShadow:`0 0 5px ${col}`,animation:'pulse 1.8s ease-in-out infinite'}}/>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:col}}>{T('dashboard.live')}</span>
          </span>
        </div>
        <div style={{width:1,alignSelf:'stretch',background:C.bdr}}/>
        <div style={{flex:1,minWidth:0}}>
          {isLoading?<Sk h={24} w="85%"/>:(
            <p key={animKey} style={{
              fontWeight:700,letterSpacing:'-0.02em',lineHeight:1,color:col,
              fontSize:fontSize,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',
              animation:animKey>0?`profit-slide-${dir} 0.4s cubic-bezier(0.4,0,0.2,1) both`:undefined,
            }}>
              {isPos?'+':'-'}Rp {displayValue}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

// ═══════════════════════════════════════════
// TODAY PROFIT CARD — uses /today-profit API
// ═══════════════════════════════════════════
const MODE_LABELS: Record<string, string> = {
  schedule: 'Signal', fastrade: 'FTT', indicator: 'Indikator',
  momentum: 'Momentum', aisignal: 'AI',
};
const MODE_COLORS: Record<string, string> = {
  schedule: '#10B981', fastrade: '#10B981', ctc: '#BF5AF2',
  aisignal: '#34D399', indicator: '#FF6B35', momentum: '#FF375F',
};

const TodayProfitCard: React.FC<{
  data: TodayProfitSummary | null;
  localProfit: number;
  isLoading?: boolean;
  flash?: 'win' | 'lose' | null;
  t: (k: string) => string;
}> = ({ data, localProfit, isLoading, flash, t }) => {
  const profit  = data ? data.totalPnL : localProfit;
  const isPos   = profit >= 0;
  const col     = isPos ? C.cyan : C.coral;
  const prevR   = useRef(profit);
  const [animKey, setAnimKey] = useState(0);
  const [dir, setDir]         = useState<'up' | 'down'>('up');
  const [hidden, setHidden]   = useState(false);

  useEffect(() => {
    if (profit !== prevR.current) {
      setDir(profit > prevR.current ? 'up' : 'down');
      setAnimKey(k => k + 1);
      prevR.current = profit;
    }
  }, [profit]);

  const displayValue = Math.round(Math.abs(profit / 100)).toLocaleString('id-ID', { maximumFractionDigits: 0 });

  return (
    <Card style={{ padding: '12px 16px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 68 }} flash={flash}>
      {/* Baris 1: Label + eye toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: C.muted, whiteSpace: 'nowrap' }}>
          {t('dashboard.profitToday')}
        </span>
        <button
          onClick={() => setHidden(h => !h)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}
        >
          {hidden
            ? <Eye style={{ width: 11, height: 11 }} />
            : <EyeOff style={{ width: 11, height: 11 }} />
          }
        </button>
      </div>
      {/* Baris 2: Angka profit atau dots */}
      {isLoading ? (
        <Sk h={28} w="80%" style={{ borderRadius: 6 }} />
      ) : hidden ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {[...Array(6)].map((_, i) => (
            <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: col, opacity: 0.35 + (i % 2) * 0.25 }} />
          ))}
        </div>
      ) : (
        <p key={animKey} style={{
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: col,
          fontSize: 'clamp(20px, 6.5vw, 36px)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textAlign: 'center',
          animation: animKey > 0 ? `profit-slide-${dir} 0.4s cubic-bezier(0.4,0,0.2,1) both` : undefined,
        }}>
          {isPos ? '+' : '−'}Rp {displayValue}
        </p>
      )}
    </Card>
  );
};

// ═══════════════════════════════════════════
// ASSET CARD
// ═══════════════════════════════════════════
const AssetCard: React.FC<{asset?:StockityAsset|null;mode:TradingMode;isLoading?:boolean;t:(k:string)=>string;onOpenPicker?:()=>void;disabled?:boolean}> = ({asset,mode,isLoading,t,onOpenPicker,disabled}) => {
  const modeCol = modeAccent(mode);
  const abbr    = asset?.ric ? asset.ric.slice(0,3).toUpperCase() : '+';
  const [imgErr,setImgErr] = useState(false);
  if(isLoading) return <Card style={{padding:'11px 14px',height:'100%'}}><Sk w={100} h={22}/></Card>;
  return (
    <Card style={{padding:0,height:'100%',cursor:onOpenPicker&&!disabled?'pointer':'default'}} onClick={onOpenPicker&&!disabled?onOpenPicker:undefined}>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',height:68}}>
        <div style={{width:40,height:40,borderRadius:11,overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:`${modeCol}12`,border:`1.5px solid ${modeCol}28`}}>
          {asset?.iconUrl&&!imgErr?(
            <img src={asset.iconUrl} alt={asset.ric} crossOrigin="anonymous"
              onError={()=>setImgErr(true)}
              style={{width:'100%',height:'100%',objectFit:'contain',padding:4}}
            />
          ):(
            <span style={{fontWeight:700,fontSize:20,color:modeCol,letterSpacing:'-0.02em'}}>{abbr}</span>
          )}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.08em',color:C.muted,lineHeight:1,marginBottom:5}}>{t('dashboard.asset')}</p>
          {asset?(
            <>
              <p style={{fontSize:15,fontWeight:700,lineHeight:1,color:C.text,letterSpacing:'-0.02em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{asset.name}</p>
              <p style={{fontSize:10,marginTop:3,color:C.sub,lineHeight:1.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{asset.ric}</p>
            </>
          ):(
            <p style={{fontSize:12,color:C.muted}}>{t('dashboard.notSelected')}</p>
          )}
        </div>
        {asset && <span style={{fontSize:11,fontWeight:700,color:modeCol,flexShrink:0}}>{asset.profitRate}%</span>}
      </div>
    </Card>
  );
};

// ═══════════════════════════════════════════
// COMBINED ASSET + BALANCE CARD (Mobile — 1 card full width)
// ═══════════════════════════════════════════
const AssetBalanceCombinedCard: React.FC<{
  asset?: StockityAsset | null;
  mode: TradingMode;
  isLoading?: boolean;
  t: (k: string) => string;
  onOpenPicker?: () => void;
  disabled?: boolean;
  balance: ProfileBalance | null;
  accountType: 'demo' | 'real';
}> = ({ asset, mode, isLoading, t, onOpenPicker, disabled, balance, accountType }) => {
  const [hidden, setHidden] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const modeCol = modeAccent(mode);
  const abbr = asset?.ric ? asset.ric.slice(0, 3).toUpperCase() : '+';
  const isDemo = accountType === 'demo';
  const rawAmount = isDemo
    ? (balance?.demo_balance ?? balance?.balance ?? 0)
    : (balance?.real_balance ?? balance?.balance ?? 0);
  const amount = rawAmount / 100;
  const balCol = isDemo ? C.amber : C.cyan;
  const balBg  = isDemo ? 'rgba(255,159,10,0.08)' : 'rgba(16,185,129,0.08)';

  return (
    <Card style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Sisi Kiri: Aset */}
        <button
          type="button"
          onClick={onOpenPicker && !disabled ? onOpenPicker : undefined}
          disabled={disabled || !onOpenPicker}
          style={{
            flex: 1, minWidth: 0,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: 'none', padding: 0,
            cursor: onOpenPicker && !disabled ? 'pointer' : 'default',
            textAlign: 'left',
          }}
        >

          <div style={{
            width: 32, height: 32, borderRadius: 9, overflow: 'hidden', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${modeCol}12`, border: `1px solid ${modeCol}28`,
          }}>
            {asset?.iconUrl && !imgErr ? (
              <img src={asset.iconUrl} alt={asset.ric} crossOrigin="anonymous"
                onError={() => setImgErr(true)}
                style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }}
              />
            ) : (
              <span style={{ fontWeight: 700, fontSize: 11, color: modeCol }}>{abbr}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, lineHeight: 1, marginBottom: 3 }}>
              {t('dashboard.asset')}
            </p>
            {isLoading ? <div style={{ height: 14, width: 60, borderRadius: 4, background: C.faint }} /> : asset ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', minWidth: 0 }}>
                <p style={{ fontSize: 'clamp(10px,3.2vw,14px)', fontWeight: 700, lineHeight: 1, color: C.text, letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {asset.name}
                </p>
                <span style={{ fontSize: 'clamp(8px,2.5vw,10px)', fontWeight: 700, color: modeCol, flexShrink: 0 }}>{asset.profitRate}%</span>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: modeCol, fontWeight: 600 }}>{t('dashboard.notSelected')}</p>
            )}
          </div>
        </button>

        {/* Divider Vertikal */}
        <div style={{ width: 1, height: 36, background: C.bdr, flexShrink: 0 }} />

        {/* Sisi Kanan: Saldo */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Kiri: label "Saldo + eye" & badge "Real/Demo" — 2 baris rapat */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <p style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.muted, lineHeight: '13px', margin: 0 }}>
                {t('dashboard.balance')}
              </p>
              <button
                onClick={() => setHidden(h => !h)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: C.muted, padding: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}
              >
                {hidden
                  ? <Eye style={{ width: 10, height: 10 }} />
                  : <EyeOff style={{ width: 10, height: 10 }} />
                }
              </button>
            </div>
            <span style={{ fontSize: 8, fontWeight: 700, padding: '0px 5px', borderRadius: 99, color: balCol, background: balBg, border: `1px solid ${balCol}30`, lineHeight: '13px', display: 'inline-block' }}>
              {isDemo ? t('common.demo') : t('common.real')}
            </span>
          </div>

          {/* Kanan: angka saldo — rata kanan, otomatis center vertikal karena parent align-items:center */}
          <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
            {isLoading ? (
              <div style={{ height: 13, width: 60, borderRadius: 4, background: C.faint, marginLeft: 'auto' }} />
            ) : hidden ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                {[...Array(5)].map((_, i) => (
                  <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: balCol, opacity: 0.4 + (i % 2) * 0.2 }} />
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 'clamp(11px,3.5vw,20px)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, color: balCol, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                {Math.round(amount).toLocaleString('id-ID', { maximumFractionDigits: 0 })}
              </p>
            )}
          </div>
        </div>

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

// ═══════════════════════════════════════════
// ENHANCED PICKER BUTTON WITH ICON & COLORED BACKGROUND
// ═══════════════════════════════════════════
const PickerBtn: React.FC<{
  label: string;
  placeholder?: string;
  disabled?: boolean;
  onClick: () => void;
  accent?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'demo' | 'real';
}> = ({ label, placeholder, disabled, onClick, accent, icon, variant = 'default' }) => {
  const has = !!label;
  const ac = accent || C.cyan;

  // Background colors based on variant
  const getBgColor = () => {
    if (variant === 'demo') return 'rgba(255, 170, 0, 0.14)';
    if (variant === 'real') return 'rgba(16, 185, 129, 0.14)';
    return has ? C.cyand : C.card2;
  };

  const getBorderColor = () => {
    if (variant === 'demo') return 'rgba(255, 170, 0, 0.50)';
    if (variant === 'real') return 'rgba(16, 185, 129, 0.50)';
    return has ? C.bdrAct : C.bdr;
  };

  const getTextColor = () => {
    if (variant === 'demo') return '#FFAA00';
    if (variant === 'real') return '#10B981';
    return has ? C.text : C.muted;
  };

  return (
    <button 
      type="button" 
      onClick={onClick} 
      disabled={disabled} 
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 12,
        background: getBgColor(),
        border: `1.5px solid ${getBorderColor()}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      {icon && (
        <span style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: getTextColor(),
          flexShrink: 0,
        }}>
          {icon}
        </span>
      )}
      <span style={{ 
        fontSize: 13, 
        fontWeight: 500, 
        overflow: 'hidden', 
        textOverflow: 'ellipsis', 
        whiteSpace: 'nowrap', 
        color: getTextColor(),
        flex: 1,
        textAlign: 'left',
      }}>
        {label || placeholder || '— pilih —'}
      </span>
      <ChevronDown style={{ width: 14, height: 14, flexShrink: 0, color: getTextColor() }} />
    </button>
  );
};

// ═══════════════════════════════════════════
// ORDER INPUT MODAL (Schedule) — Kotlin ScheduleDialog style
// ═══════════════════════════════════════════
const OrderInputModal: React.FC<{open:boolean;onClose:()=>void;orders:ScheduleOrder[];logs:ExecutionLog[];onAdd:(s:string)=>Promise<void>;onDelete:(id:string)=>void;onClear:()=>Promise<void>;loading:boolean;isRunning?:boolean}> =
({open,onClose,orders,logs,onAdd,onDelete,onClear,loading,isRunning}) => {
  const { t } = useLanguage();
  const [input,setInput]           = useState('');
  const [clearLoading,setClearLoading] = useState(false);
  const [view,setView]             = useState<'list'|'input'>('list');

  const handleClear = async () => {
    if(!window.confirm('Hapus semua signal pending?')) return;
    setClearLoading(true);
    try { await onClear(); }
    finally { setClearLoading(false); }
  };

  const handleAdd = async () => {
    if(!input.trim()) return;
    await onAdd(input);
    setInput('');
    setView('list');
  };

  const isBusy = loading || clearLoading;
  const pendingOrders = orders.filter(o=>!o.isExecuted&&!o.isSkipped);
  const doneOrders    = orders.filter(o=>o.isExecuted||o.isSkipped);
  const sortedOrders  = [...pendingOrders,...doneOrders];

  // ── Riwayat sesi sebelumnya: logs yang orderId-nya tidak ada di orders saat ini ──
  // Ini adalah execution logs dari sesi/run yang sudah selesai/clear
  const currentOrderIds  = new Set(orders.map(o => o.id));
  const currentOrderTimes = new Set(orders.map(o => o.time));
  const prevSessionLogs = logs
    .filter(l => {
      // Exclude jika log ini sudah direpresentasikan oleh order yang ada sekarang
      if (l.orderId && currentOrderIds.has(l.orderId)) return false;
      if (l.time && currentOrderTimes.has(l.time) && orders.some(o=>o.isExecuted&&o.time===l.time)) return false;
      return true;
    })
    .sort((a,b) => (b.executedAt??0) - (a.executedAt??0))
    .slice(0, 3);

  if(!open) return null;

  // ── Match log untuk order: cari lewat orderId atau waktu ─────────
  const getLog = (o: ScheduleOrder): ExecutionLog | undefined =>
    logs.find(l => l.orderId === o.id) ??
    logs.find(l => l.time === o.time);

  // ── Resolve result: dari order.result atau log.result ────────────
  const getResult = (o: ScheduleOrder): 'WIN'|'LOSS'|null => {
    const raw = o.result ?? getLog(o)?.result ?? '';
    if (/^win$/i.test(raw))  return 'WIN';
    if (/^los/i.test(raw))   return 'LOSS';
    return null;
  };

  // ── Item colours — WIN=cyan, LOSS=coral, skipped=amber, pending=card2 ──
  const itemBg  = (o:ScheduleOrder) => {
    if (o.isSkipped) return `${C.amber}0d`;
    const r = getResult(o);
    if (r === 'WIN')  return `${C.cyan}0d`;
    if (r === 'LOSS') return `${C.coral}0d`;
    if (o.isExecuted) return `${C.cyan}0d`;
    return `${C.card2}`;
  };
  const itemBdr = (o:ScheduleOrder) => {
    if (o.isSkipped) return `${C.amber}33`;
    const r = getResult(o);
    if (r === 'WIN')  return `${C.cyan}40`;
    if (r === 'LOSS') return `${C.coral}40`;
    if (o.isExecuted) return `${C.cyan}33`;
    return C.bdr;
  };
  const statusTx = (o:ScheduleOrder) => o.isSkipped?'Dilewati':o.isExecuted?'Selesai':'Menunggu...';
  const statusCl = (o:ScheduleOrder) => o.isSkipped?C.amber:o.isExecuted?C.cyan:C.muted;

  return (
    <div style={{position:'fixed',inset:0,zIndex:60,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',animation:'fade-in 0.15s ease'}}>
      {/* Backdrop */}
      <div onClick={isBusy?undefined:onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)',cursor:isBusy?'not-allowed':'default'}}/>

      {/* Modal card — Kotlin: fillMaxWidth(0.96f) fillMaxHeight(0.88f) */}
      <div style={{
        position:'relative',width:'100%',maxWidth:460,height:'88dvh',maxHeight:640,
        display:'flex',flexDirection:'column',
        background:C.bg,
        borderRadius:24,
        border:`0.4px solid rgba(52,211,153,0.40)`,
        boxShadow:'0 32px 80px rgba(0,0,0,0.70), 0 8px 24px rgba(0,0,0,0.50)',
        overflow:'hidden',
        animation:'slide-up 0.28s cubic-bezier(0.32,0.72,0,1)',
      }}>

        {/* ── Header — vertical gradient surface→cardBackground ── */}
        <div style={{
          flexShrink:0,
          background:`linear-gradient(180deg,${C.card2} 0%,${C.card} 100%)`,
          padding:'16px 24px',
          display:'flex',flexDirection:'column',gap:8,
        }}>
          {/* Row 1: title + close */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <p style={{fontSize:20,fontWeight:600,color:C.text,letterSpacing:'-0.02em',margin:0}}>
              {view==='list'?t('dashboard.schedule.title')+' Orders':t('dashboard.schedule.inputSignal')}
            </p>
            <button
              onClick={view==='input'?()=>setView('list'):onClose}
              disabled={isBusy}
              style={{
                width:36,height:36,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                background:C.card2,border:`1px solid ${C.bdr}`,
                color:C.sub,cursor:isBusy?'not-allowed':'pointer',opacity:isBusy?0.4:1,
              }}
            >
              <X style={{width:16,height:16}}/>
            </button>
          </div>

          {/* Row 2: subtitle */}
          <p style={{fontSize:13,color:C.sub,margin:0}}>
            {view==='list'
              ? 'Manage pending trades · History preserved'
              : `Format: 09:30 B · 14:00 S · satu per baris`}
          </p>

          {/* Row 3: action buttons (only in list view, only if orders exist) */}
          {view==='list' && orders.length>0 && (
            <div style={{display:'flex',gap:8,marginTop:2}}>
              {/* Input Signal */}
              <button
                onClick={()=>setView('input')}
                disabled={isRunning}
                style={{
                  flex:1,height:36,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                  borderRadius:12,cursor:isRunning?'not-allowed':'pointer',
                  background:`${C.cyan}1a`,border:`1px solid ${C.cyan}4d`,color:C.cyan,
                  fontSize:12,fontWeight:500,
                  opacity:isRunning?0.35:1,
                }}
              >
                <Plus style={{width:15,height:15}}/>{t('dashboard.schedule.inputSignal')}
              </button>
              {/* Clear Pending */}
              <button
                onClick={handleClear}
                disabled={isBusy||pendingOrders.length===0||isRunning}
                style={{
                  flex:1,height:36,display:'flex',alignItems:'center',justifyContent:'center',gap:6,
                  borderRadius:12,cursor:(isBusy||pendingOrders.length===0||isRunning)?'not-allowed':'pointer',
                  background:`${C.coral}1a`,border:`1px solid ${C.coral}33`,color:C.coral,
                  fontSize:12,fontWeight:500,
                  opacity:(isBusy||pendingOrders.length===0||isRunning)?0.35:1,
                }}
              >
                {clearLoading
                  ? <RefreshCw style={{width:13,height:13,animation:'spin 0.7s linear infinite'}}/>
                  : <Trash2 style={{width:14,height:14}}/>
                }
                {t('dashboard.schedule.clearPending')}
              </button>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div style={{flex:1,overflowY:'auto',background:C.bg,padding:'4px 20px 16px',WebkitOverflowScrolling:'touch' as any}}>

          {/* INPUT VIEW */}
          {view==='input' && (
            <div style={{display:'flex',flexDirection:'column',gap:12,paddingTop:12}}>
              <div style={{padding:'8px 12px',borderRadius:10,background:`${C.cyan}08`,border:`1px solid ${C.cyan}20`}}>
                <p style={{fontSize:11,color:C.muted,margin:0,lineHeight:1.6}}>
                  Contoh: <span style={{color:C.cyan,fontWeight:600}}>09:30 call</span> · <span style={{color:C.coral}}>14:15 put</span> · <span style={{color:C.cyan,fontWeight:600}}>09.30 B</span> · <span style={{color:C.coral}}>14.15 S</span>
                </p>
              </div>
              <textarea
                className="ds-input"
                autoFocus
                value={input}
                onChange={e=>setInput(e.target.value)}
                placeholder={"09:00 B\n09.30 S\n10:00 B\n14:00 S"}
                rows={9}
                style={{resize:'vertical'}}
              />
              <div style={{display:'flex',gap:8}}>
                <button
                  onClick={handleAdd}
                  disabled={!input.trim()||isBusy}
                  style={{
                    flex:1,height:44,display:'flex',alignItems:'center',justifyContent:'center',gap:7,
                    borderRadius:12,fontSize:13,fontWeight:600,
                    background:input.trim()?`${C.cyan}20`:'rgba(255,255,255,0.04)',
                    border:`1px solid ${input.trim()?`${C.cyan}50`:C.bdr}`,
                    color:input.trim()?C.cyan:C.muted,
                    cursor:(!input.trim()||isBusy)?'not-allowed':'pointer',
                    opacity:isBusy?0.5:1,
                  }}
                >
                  {loading?<RefreshCw style={{width:13,height:13,animation:'spin 0.7s linear infinite'}}/>:<Plus style={{width:14,height:14}}/>}
                  {loading?'Menambahkan...':'Tambah'}
                </button>
                <button
                  onClick={()=>setView('list')}
                  disabled={isBusy}
                  style={{
                    padding:'0 20px',height:44,borderRadius:12,fontSize:13,fontWeight:500,
                    background:'rgba(255,255,255,0.05)',border:`1px solid ${C.bdr}`,
                    color:C.sub,cursor:isBusy?'not-allowed':'pointer',
                  }}
                >Batal</button>
              </div>
            </div>
          )}

          {/* LIST VIEW */}
          {view==='list' && (
            <>
              {sortedOrders.length===0 ? (
                /* Empty state */
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:24,paddingTop:40}}>
                  <div style={{
                    width:88,height:88,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                    background:`${C.card2}66`,border:`1px solid ${C.bdr}`,
                  }}>
                    <Calendar style={{width:36,height:36,color:C.muted}}/>
                  </div>
                  <div style={{textAlign:'center',display:'flex',flexDirection:'column',gap:12}}>
                    <p style={{fontSize:20,fontWeight:600,color:C.text,letterSpacing:'-0.01em',margin:0}}>No Scheduled Orders</p>
                    <p style={{fontSize:15,color:C.sub,margin:0,lineHeight:1.55}}>
                      Schedule orders to execute automatically<br/>at your specified times.
                    </p>
                  </div>
                  <button
                    onClick={()=>setView('input')}
                    style={{
                      display:'flex',alignItems:'center',gap:7,padding:'12px 28px',borderRadius:14,
                      background:`${C.cyan}18`,border:`1px solid ${C.cyan}45`,
                      color:C.cyan,fontSize:13,fontWeight:600,cursor:'pointer',
                    }}
                  >
                    <Plus style={{width:15,height:15}}/>{t('dashboard.schedule.inputSignal')}
                  </button>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:6,paddingTop:8}}>

                  {/* ── 3 RIWAYAT TERAKHIR (di atas) ── */}
                  {prevSessionLogs.length > 0 && (
                    <>
                      <p style={{fontSize:9,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:C.muted,margin:'0 0 2px'}}>Riwayat Sebelumnya</p>
                      {prevSessionLogs.map((l,idx)=>{
                        const isWin  = /^win$/i.test(l.result??'');
                        const isLoss = /^los/i.test(l.result??'');
                        const isBuy  = l.trend==='call';
                        const col    = isWin ? C.cyan : isLoss ? C.coral : C.muted;
                        const profit = l.profit;
                        return (
                          <div key={l.id} style={{
                            display:'flex',alignItems:'center',gap:10,
                            padding:'10px 12px',borderRadius:12,
                            background:isWin?`${C.cyan}08`:isLoss?`${C.coral}08`:C.card2,
                            border:`1px solid ${isWin?`${C.cyan}35`:isLoss?`${C.coral}35`:C.bdr}`,
                            opacity:0.85,
                          }}>
                            {/* Nomor badge — seragam dengan pending orders */}
                            <div style={{
                              width:22,height:22,borderRadius:'50%',flexShrink:0,
                              display:'flex',alignItems:'center',justifyContent:'center',
                              background:isWin?`${C.cyan}14`:isLoss?`${C.coral}14`:'rgba(126,126,126,0.12)',
                              border:`1px solid ${isWin?`${C.cyan}35`:isLoss?`${C.coral}35`:'rgba(126,126,126,0.22)'}`,
                            }}>
                              <span style={{fontSize:10,fontWeight:700,color:col}}>{idx+1}</span>
                            </div>
                            {/* Waktu */}
                            <span style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:'monospace',flexShrink:0}}>{l.time||'--:--'}</span>
                            {/* BUY/SELL badge */}
                            <span style={{
                              fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:6,
                              background:isBuy?`${C.cyan}22`:`${C.coral}22`,
                              color:isBuy?C.cyan:C.coral,
                              border:`1px solid ${isBuy?C.cyan:C.coral}35`,
                              flexShrink:0,
                            }}>{isBuy?'BUY':'SELL'}</span>
                            {/* Result — minWidth agar kolom selalu sejajar dengan done orders */}
                            <span style={{fontSize:9,fontWeight:700,color:col,flexShrink:0,minWidth:32,textAlign:'left'}}>
                              {isWin?'WIN':isLoss?'LOSS':''}
                            </span>
                            {/* Martingale step */}
                            {l.martingaleStep!=null&&l.martingaleStep>0&&(
                              <span style={{fontSize:9,color:C.amber,fontWeight:600,flexShrink:0}}>K{l.martingaleStep}</span>
                            )}
                            {/* Profit/Amount — push ke kanan */}
                            {profit!=null&&(
                              <span style={{fontSize:10,fontWeight:700,fontFamily:'monospace',marginLeft:'auto',color:profit>=0?C.cyan:C.coral,flexShrink:0}}>
                                {profit>=0?'+':''}{Math.round(profit/100).toLocaleString('id-ID')}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      <div style={{height:1,background:C.bdr,margin:'2px 0 4px'}}/>
                    </>
                  )}

                  {/* ── PENDING ORDERS ── */}
                  {pendingOrders.map((o,i)=>{
                    const isBuy = o.trend==='call';
                    return (
                      <div key={o.id} style={{
                        display:'flex',alignItems:'center',padding:'10px 12px',gap:10,
                        borderRadius:12,background:C.card2,
                        border:`1px solid rgba(16,185,129,0.45)`,
                      }}>
                        <div style={{
                          width:22,height:22,borderRadius:'50%',flexShrink:0,
                          display:'flex',alignItems:'center',justifyContent:'center',
                          background:'rgba(16,185,129,0.10)',border:`1px solid rgba(16,185,129,0.22)`,
                        }}>
                          <span style={{fontSize:10,fontWeight:600,color:C.cyan}}>{i+1}</span>
                        </div>
                        <span style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:'monospace'}}>{o.time}</span>
                        <span style={{
                          fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:6,
                          background:isBuy?`${C.cyan}22`:`${C.coral}22`,
                          color:isBuy?C.cyan:C.coral,
                          border:`1px solid ${isBuy?C.cyan:C.coral}35`,
                        }}>{isBuy?'BUY':'SELL'}</span>
                        <span style={{fontSize:10,color:C.muted,marginLeft:'auto'}}>Menunggu…</span>
                        {!isRunning && (
                          <button onClick={()=>onDelete(o.id)} style={{
                            width:28,height:28,borderRadius:'50%',flexShrink:0,
                            display:'flex',alignItems:'center',justifyContent:'center',
                            background:`${C.coral}18`,border:'none',cursor:'pointer',color:C.coral,
                          }}>
                            <Trash2 style={{width:12,height:12}}/>
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* ── DONE ORDERS (sesi ini) ── */}
                  {doneOrders.map(o=>{
                    const isBuy  = o.trend==='call';
                    const isSkip = o.isSkipped;
                    const res    = getResult(o);
                    const log    = getLog(o);
                    const ms     = o.martingaleState ?? (log?.martingaleStep!=null?{currentStep:log.martingaleStep,maxSteps:0} as any:null);
                    const profit = log?.profit;
                    const col    = isSkip?C.amber:res==='WIN'?C.cyan:res==='LOSS'?C.coral:C.muted;
                    return (
                      <div key={o.id} style={{
                        display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                        borderRadius:12,
                        background:isSkip?`${C.amber}0c`:res==='WIN'?`${C.cyan}0c`:res==='LOSS'?`${C.coral}0c`:C.card2,
                        border:`1px solid ${isSkip?`${C.amber}30`:res==='WIN'?`${C.cyan}35`:res==='LOSS'?`${C.coral}35`:C.bdr}`,
                      }}>
                        <span style={{fontSize:14,fontWeight:800,color:col,width:16,textAlign:'center',lineHeight:1}}>
                          {isSkip?'⊘':res==='WIN'?'✓':res==='LOSS'?'✗':'·'}
                        </span>
                        <span style={{fontSize:14,fontWeight:700,color:C.text,fontFamily:'monospace'}}>{o.time}</span>
                        <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:6,background:isBuy?`${C.cyan}18`:`${C.coral}18`,color:isBuy?C.cyan:C.coral,border:`1px solid ${isBuy?C.cyan:C.coral}35`,flexShrink:0}}>{isBuy?'BUY':'SELL'}</span>
                        {isSkip?(
                          <span style={{fontSize:9,fontWeight:700,color:C.amber,minWidth:32,textAlign:'left'}}>SKIP</span>
                        ):res?(
                          <span style={{fontSize:9,fontWeight:700,color:col,minWidth:32,textAlign:'left'}}>{res}</span>
                        ):(
                          <span style={{minWidth:32}}/>
                        )}
                        {ms&&(ms.currentStep??0)>0&&(
                          <span style={{fontSize:9,color:C.amber,fontWeight:600}}>K{ms.currentStep}{ms.maxSteps>0?`/${ms.maxSteps}`:''}</span>
                        )}
                        {profit!=null&&(
                          <span style={{fontSize:10,fontWeight:700,fontFamily:'monospace',marginLeft:'auto',color:profit>=0?C.cyan:C.coral}}>
                            {profit>=0?'+':''}{Math.round(profit/100).toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                    );
                  })}

                </div>
              )}
            </>
          )}
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
const SchedulePanel: React.FC<{orders:ScheduleOrder[];logs:ExecutionLog[];onOpenModal:()=>void;isRunning:boolean;isLoading:boolean;fillHeight?:boolean;compact?:boolean;onViewSession?:()=>void}> =
({orders,logs,onOpenModal,isRunning,isLoading,fillHeight,compact,onViewSession}) => {
  const listRef  = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement|null)[]>([]);
  const [activeIdx,setActiveIdx] = useState(-1);

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
      {!compact&&(
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',borderBottom:`1px solid ${C.bdr}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:12,fontWeight:600,color:C.sub}}>{T('dashboard.schedule.title')}</span>
          {doneCount>0&&(
            <span style={{fontSize:10,padding:'1px 7px',borderRadius:99,color:C.muted,background:'rgba(255,255,255,0.05)',border:`1px solid rgba(255,255,255,0.08)`}}>
              {doneCount} {T('dashboard.schedule.completed')}
            </span>
          )}
        </div>
        {pendingOrders.length>0&&activeIdx>=0&&(
          <span style={{fontSize:10,fontWeight:500,color:C.cyan}}></span>
        )}
      </div>
      )}
      {pendingOrders.length===0?(
        <div style={{height:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20,gap:8}}>
          <Calendar style={{width:28,height:28,color:C.muted,opacity:0.5}}/>
          <p style={{fontSize:12,color:C.muted,textAlign:'center'}}>
  {doneCount>0?`${T('common.all')} ${doneCount} ${T('dashboard.schedule.title')} ${T('dashboard.schedule.completed')}`:`${T('dashboard.schedule.noSignals')}`}
          </p>
        </div>
      ):(
        <>
        <div ref={listRef} style={{overflowY:'auto',overflowX:'hidden',maxHeight:compact?100:210,flex:'none'}}>
          {(compact?pendingOrders.slice(0,2):pendingOrders).map((order,i,arr)=>{
            const isA=i===activeIdx, isCall=order.trend==='call', col=isCall?C.cyan:C.coral;
            const iconSz = compact?11:13;
            const timeFz = compact?'clamp(9px,2.8vw,11px)':'12px';
            const badgeFz = compact?'clamp(8px,2.4vw,10px)':'10px';
            const badgePad = compact?'2px 5px':'2px 7px';
            const itemPad = compact?'5px 10px':'8px 12px';
            const itemGap = compact?5:8;
            return (
              <div key={order.id} ref={el=>{itemRefs.current[i]=el;}} className="schedule-item" style={{
                display:'flex',alignItems:'center',gap:itemGap,padding:itemPad,
                borderBottom:i<arr.length-1?`1px solid ${C.bdr}`:'none',
                background:isA?(isCall?'rgba(41,151,255,0.04)':'rgba(255,69,58,0.04)'):'transparent',
                minWidth:0,overflow:'hidden',
              }}>
                {isA
                  ? <PlayCircle style={{width:iconSz,height:iconSz,color:col,flexShrink:0}}/>
                  : <PauseCircle style={{width:iconSz,height:iconSz,color:'rgba(255,255,255,0.18)',flexShrink:0}}/>
                }
                <span style={{fontSize:timeFz,fontFamily:'monospace',color:isA?C.text:C.sub,fontWeight:isA?600:400,flexShrink:0}}>{order.time}</span>
                <span style={{fontSize:badgeFz,fontWeight:700,padding:badgePad,borderRadius:5,color:col,background:isCall?'rgba(41,151,255,0.1)':'rgba(255,69,58,0.1)',flexShrink:0,lineHeight:'1.2'}}>{isCall?'B':'S'}</span>
              </div>
            );
          })}
        </div>
        </>
      )}
      <div style={{padding:'8px 10px',marginTop:'auto',borderTop:`1px solid ${C.bdr}`,flexShrink:0}}>
        <button
          onClick={onOpenModal}
          style={{
            width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:6,
            padding:'8px 0',borderRadius:8,fontSize:'clamp(9px,3vw,12px)',fontWeight:500,
            background:`${C.cyan}10`,border:`1px solid ${C.cyan}28`,color:C.cyan,
            cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',
          }}
        >
          <Info style={{width:12,height:12,flexShrink:0}}/>
          {isRunning ? T('dashboard.viewSession') : (pendingOrders.length===0 ? T('dashboard.schedule.add') : 'View')}
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
    WAITING_MINUTE_1:T('dashboard.phaseMap.waitingMinute1'),FETCHING_1:T('dashboard.phaseMap.fetching1'),
    WAITING_MINUTE_2:T('dashboard.phaseMap.waitingMinute2'),FETCHING_2:T('dashboard.phaseMap.fetching2'),
    ANALYZING:T('dashboard.phaseMap.analyzing'),WAITING_EXEC_SYNC:T('dashboard.phaseMap.waitingExecSync'),
    EXECUTING:T('dashboard.phaseMap.executing'),WAITING_RESULT:T('dashboard.phaseMap.waitingResult'),
    WAITING_LOSS_DELAY:T('dashboard.phaseMap.waitingLossDelay'),IDLE:T('dashboard.phaseMap.idle'),
  };
  const phase = status?.phase||(isOn?'Running':T('common.standby'));
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
        {isOn ? (
          <>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <Zap style={{width:14,height:14,color:accent}}/>
              <span style={{fontSize:12,fontWeight:600,color:C.sub}}>{isCTC?T('dashboard.fastTrade.ctcSession'):T('dashboard.fastTrade.fttSession')}</span>
            </div>
<StatusChip col={accent} label={T('common.active')} pulse/>
          </>
        ) : (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,width:'100%'}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:C.muted,opacity:0.4}}/>
            <span style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em'}}>{T('common.standby')}</span>
          </div>
        )}
      </div>

      {isLoading?(
        <div style={{padding:'8px 0'}}>{[1,2,3].map(i=><div key={i} style={{padding:'8px 12px'}}><Sk w={`${i===1?70:i===2?50:60}%`} h={14}/></div>)}</div>
      ):!status||!isOn?(
        <div style={{height:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
          <Zap style={{width:24,height:24,color:C.muted,opacity:0.4}}/>
          <p style={{fontSize:12,color:C.muted,textAlign:'center'}}>{T('dashboard.fastTrade.noActiveSession')}</p>
        </div>
      ):(
        <div style={{overflowY:'auto',maxHeight:240}}>
          <Row label="P&L" right={<span style={{color:pnlCol,fontFamily:'monospace'}}>{pnl>=0?'+':'-'}{Math.round(Math.abs(pnl)/100).toLocaleString('id-ID')}</span>}/>
          <Row label="W / L" right={<span style={{fontFamily:'monospace'}}><span style={{color:C.cyan}}>{wins}</span><span style={{color:C.muted}}> / </span><span style={{color:C.coral}}>{losses}</span></span>}/>
          <Row label="Win Rate" right={wr!==null?<span style={{color:wr>=50?accent:C.coral}}>{wr}%</span>:<span style={{color:C.muted}}>—</span>}/>
          <Row label={T('dashboard.fastTrade.phase')} right={<span style={{color:accent,fontSize:10}}>{phaseMap[phase]??phase}</span>}/>
          {trend&&<Row label={T('dashboard.fastTrade.trend')} right={<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,color:trend==='call'?C.cyan:C.coral,background:trend==='call'?'rgba(41,151,255,0.1)':'rgba(255,69,58,0.1)'}}>{trend==='call'?'↑ CALL':'↓ PUT'}</span>} border={logs.length===0}/>}
          {logs.length>0&&(
            <>
              <div style={{padding:'6px 12px 4px',borderBottom:`1px solid ${C.bdr}`}}>
                <span style={{fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'rgba(41,151,255,0.45)'}}>{T('dashboard.fastTrade.history')}</span>
              </div>
              {logs.slice(-4).reverse().map((log,i,arr)=>{
                const rc=log.result==='WIN'?accent:log.result==='LOSS'||log.result==='LOSE'?C.coral:C.amber;
                const col=log.trend==='call'?C.cyan:C.coral;
                return (
                  <div key={log.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderBottom:i<arr.length-1?`1px solid ${C.bdr}`:'none',minWidth:0,overflow:'hidden'}}>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,color:col,background:log.trend==='call'?'rgba(41,151,255,0.1)':'rgba(255,69,58,0.1)',flexShrink:0}}>{log.trend==='call'?'CALL':'PUT'}</span>
                    <span style={{fontSize:10,color:C.muted,flex:1,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.amount!=null?Math.round(log.amount/100).toLocaleString('id-ID',{maximumFractionDigits:0}):''}</span>
                    {log.result&&<span style={{fontSize:10,fontWeight:700,color:rc,flexShrink:0}}>{log.result}</span>}
                    {log.profit!=null&&<span style={{fontSize:10,color:rc,fontFamily:'monospace',flexShrink:0}}>{log.profit>=0?'+':'-'}{Math.round(Math.abs(log.profit)/100).toLocaleString('id-ID',{maximumFractionDigits:0})}</span>}
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
const AISignalPanel: React.FC<{
  status: AISignalStatus | null;
  pendingOrders: AISignalOrder[];
  isLoading: boolean;
  fillHeight?: boolean;
}> = ({ status, pendingOrders, isLoading }) => {
  const isOn   = status?.botState === 'RUNNING' || (!status?.botState && status?.isActive === true);
  const pnl    = status?.sessionPnL ?? status?.stats?.sessionPnL ?? 0;
  const wins   = status?.totalWins  ?? status?.stats?.wins   ?? 0;
  const losses = status?.totalLosses ?? status?.stats?.losses ?? 0;
  const total  = status?.totalTrades ?? status?.stats?.totalTrades ?? 0;
  const wr     = total > 0 ? Math.round((wins / total) * 100) : null;
  const pnlCol = pnl >= 0 ? C.sky : C.coral;
  const alwaysSignal = status?.alwaysSignalStatus;
  const monCount = status?.monitoringStatus?.active_monitoring_count ?? 0;
  const wsOk = status?.wsConnected ?? false;
 
  // Listening status dari TelegramSignalService
  const telegramStatus = (status as any)?.telegramSignalStatus as {
    isListening?: boolean;
    hasCallback?: boolean;
    globalListenerActive?: boolean;
  } | undefined;
  const listenerActive = telegramStatus?.globalListenerActive ?? telegramStatus?.isListening ?? isOn;
 
  // Live countdown — update setiap detik
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isOn) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isOn]);
 
  const formatCountdown = (executionTime: number): string => {
    const ms = executionTime - now;
    if (ms <= 0) return T('dashboard.phaseMap.executing');
    const sec = Math.ceil(ms / 1000);
    if (sec < 60) return `${sec}d`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}d`;
  };
 
  const formatExecTime = (executionTime: number): string => {
    return new Date(executionTime).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'Asia/Jakarta',
    });
  };
 
  const Row: React.FC<{ label: string; right: React.ReactNode; border?: boolean }> = ({
    label, right, border = true,
  }) => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 12px', borderBottom: border ? `1px solid ${C.bdr}` : 'none', minWidth: 0,
    }}>
      <span style={{ fontSize: 11, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600 }}>{right}</span>
    </div>
  );
 
  // ── Status dot indicator ──
  const Dot: React.FC<{ on: boolean; col: string; pulse?: boolean }> = ({ on, col, pulse }) => (
    <span style={{
      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
      background: on ? col : C.muted,
      boxShadow: on ? `0 0 5px ${col}` : 'none',
      animation: on && pulse ? 'pulse 1.6s ease-in-out infinite' : 'none',
    }} />
  );
 
  return (
    <Card style={{ display: 'flex', flexDirection: 'column' }}>
 
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 14px', borderBottom: `1px solid ${isOn ? 'rgba(52,211,153,0.20)' : C.bdr}`, flexShrink: 0,
      }}>
        {isOn ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Radio style={{ width: 14, height: 14, color: C.sky }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: C.sub }}>AI Signal</span>
            </div>
            <StatusChip col={C.sky} label={T('common.active')} pulse />
          </>
        ) : (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,width:'100%'}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:C.muted,opacity:0.4}}/>
            <span style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em'}}>{T('common.standby')}</span>
          </div>
        )}
      </div>
 
      {/* ── Loading skeleton ── */}
      {isLoading ? (
        <div style={{ padding: '8px 0' }}>
          {[70, 50, 60].map((w, i) => (
            <div key={i} style={{ padding: '8px 12px' }}>
              <Sk w={`${w}%`} h={14} />
            </div>
          ))}
        </div>
 
      ) : !isOn ? (
        /* ── Idle state ── */
        <div style={{
          padding: '20px 14px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${C.sky}08`, border: `1px solid ${C.sky}18`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Radio style={{ width: 22, height: 22, color: C.muted, opacity: 0.4 }} />
          </div>
          <p style={{ fontSize: 12, color: C.muted, textAlign: 'center', lineHeight: 1.5 }}>
            {T('dashboard.aiSignal.notActive')}<br />
            <span style={{ fontSize: 10, color: `${C.muted}88` }}>
              {T('dashboard.aiSignal.startPrompt')}
            </span>
          </p>
        </div>
 
      ) : (
        /* ── Active state ── */
        <div style={{ overflowY: 'auto' }}>
 
          {/* ── Infra Status Row ── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px 5px',
            borderBottom: `1px solid ${C.bdr}`,
            background: `${C.sky}04`,
          }}>
            {/* WebSocket */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
              <Dot on={wsOk} col={C.cyan} pulse={wsOk} />
              <span style={{ fontSize: 9, fontWeight: 600, color: wsOk ? C.cyan : C.muted, letterSpacing: '0.06em' }}>WS</span>
            </div>
            {/* Telegram Listener */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center' }}>
              <Dot on={listenerActive} col={C.sky} pulse={listenerActive} />
              <span style={{ fontSize: 9, fontWeight: 600, color: listenerActive ? C.sky : C.muted, letterSpacing: '0.06em' }}>Listener</span>
            </div>
            {/* Monitor count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
              <Dot on={monCount > 0} col={C.amber} pulse={monCount > 0} />
              <span style={{ fontSize: 9, fontWeight: 600, color: monCount > 0 ? C.amber : C.muted, letterSpacing: '0.06em' }}>
                Monitor {monCount > 0 ? `(${monCount})` : ''}
              </span>
            </div>
          </div>
 
          {/* ── P&L + W/L + WR ── */}
          <Row
            label={T('dashboard.fastTrade.sessionPnl')}
            right={
              <span style={{ color: pnlCol, fontFamily: 'monospace', fontWeight: 700 }}>
                {pnl >= 0 ? '+' : '-'}{Math.round(Math.abs(pnl) / 100).toLocaleString('id-ID')}
              </span>
            }
          />
          <Row
            label={T('dashboard.fastTrade.wlTotal')}
            right={
              <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
                <span style={{ color: C.cyan, fontWeight: 700 }}>{wins}</span>
                <span style={{ color: C.muted }}> / </span>
                <span style={{ color: C.coral, fontWeight: 700 }}>{losses}</span>
                <span style={{ color: C.muted }}> / </span>
                <span style={{ color: C.sub }}>{total}</span>
              </span>
            }
          />
          <Row
            label={T('dashboard.fastTrade.winRate')}
            right={wr !== null
              ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Mini bar */}
                  <span style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 10 }}>
                    {[...Array(5)].map((_, i) => (
                      <span key={i} style={{
                        width: 3, borderRadius: 2,
                        height: `${Math.max(30, (i + 1) * 20)}%`,
                        background: i < Math.round(wr / 20) ? (wr >= 50 ? C.sky : C.coral) : C.bdr,
                      }} />
                    ))}
                  </span>
                  <span style={{ color: wr >= 60 ? C.sky : wr >= 50 ? C.cyan : C.coral, fontWeight: 700 }}>
                    {wr}%
                  </span>
                </span>
              )
              : <span style={{ color: C.muted }}>—</span>
            }
          />
 
          {/* ── Martingale AlwaysSignal Status ── */}
          {alwaysSignal?.isActive && (
            <div style={{
              margin: '0 10px 0',
              padding: '6px 10px',
              borderRadius: 8,
              background: `${C.amber}0a`,
              border: `1px solid ${C.amber}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.amber, animation: 'pulse 1.4s ease-in-out infinite' }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: C.amber }}>Martingale</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Step dots */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {[...Array(alwaysSignal.maxSteps ?? 3)].map((_, i) => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: i < (alwaysSignal.currentStep ?? 0) ? C.amber : `${C.amber}28`,
                      boxShadow: i < (alwaysSignal.currentStep ?? 0) ? `0 0 4px ${C.amber}` : 'none',
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 10, color: C.amber, fontWeight: 700 }}>
                  {alwaysSignal.currentStep}/{alwaysSignal.maxSteps}
                </span>
              </div>
            </div>
          )}
 
          {/* ── Current Status / Last Signal ── */}
          <div style={{ padding: '0 10px', marginTop: 6 }}>
            <div style={{
              padding: '7px 10px', borderRadius: 8,
              background: `${C.sky}07`, border: `1px solid ${C.sky}18`,
              display: 'flex', alignItems: 'flex-start', gap: 6,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%', background: C.sky, flexShrink: 0, marginTop: 4,
                animation: 'pulse 2s ease-in-out infinite',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: `${C.sky}80`, display: 'block', marginBottom: 2 }}>
                  {T('dashboard.aiSignal.status')}
                </span>
                <span style={{ fontSize: 10, color: C.sky, lineHeight: 1.4, display: 'block' }}>
                  {alwaysSignal?.isActive
                    ? alwaysSignal.status || `${T('dashboard.aiSignal.martingaleStep')} ${alwaysSignal.currentStep}/${alwaysSignal.maxSteps}`
                    : pendingOrders.length > 0
                    ? `${pendingOrders.length} ${T('dashboard.aiSignal.pendingSignals')}`
                    : 'sedang konfigurasi analysis ai system'}
                </span>
              </div>
            </div>
          </div>
 
          {/* ── Pending Orders ── */}
          {pendingOrders.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{
                padding: '5px 12px 4px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: `1px solid ${C.bdr}`, borderBottom: `1px solid ${C.bdr}`,
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: `${C.sky}60` }}>
                  {T('dashboard.aiSignal.queue')}
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.sky, background: `${C.sky}12`, padding: '1px 6px', borderRadius: 99, border: `1px solid ${C.sky}25` }}>
                  {pendingOrders.length}
                </span>
              </div>
 
              {pendingOrders.slice(0, 5).map((o, i, arr) => {
                const col     = o.trend === 'call' ? C.cyan : C.coral;
                const colBg   = o.trend === 'call' ? 'rgba(16,185,129,0.10)' : 'rgba(255,69,58,0.10)';
                const secLeft = Math.max(0, Math.ceil((o.executionTime - now) / 1000));
                const urgent  = secLeft < 30 && secLeft > 0;
                const isMart  = o.martingaleStep > 0;
 
                return (
                  <div key={o.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    borderBottom: i < arr.length - 1 ? `1px solid ${C.bdr}` : 'none',
                    background: urgent ? `${col}05` : 'transparent',
                    transition: 'background 0.3s',
                  }}>
                    {/* Trend badge */}
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                      color: col, background: colBg, flexShrink: 0, letterSpacing: '0.04em',
                    }}>
                      {o.trend === 'call' ? '↑ CALL' : '↓ PUT'}
                    </span>
 
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 10, color: C.sub, fontFamily: 'monospace', fontWeight: 600 }}>
                          {formatExecTime(o.executionTime)}
                        </span>
                        {isMart && (
                          <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 4, color: C.amber, background: `${C.amber}12`, border: `1px solid ${C.amber}25` }}>
                            M{o.martingaleStep}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 9, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {o.assetRic} · {Math.round(o.amount / 100).toLocaleString('id-ID')}
                      </span>
                    </div>
 
                    {/* Countdown */}
                    <span style={{
                      fontSize: 10, fontWeight: 700, fontFamily: 'monospace', flexShrink: 0,
                      color: urgent ? col : C.muted,
                      animation: urgent ? 'pulse 0.8s ease-in-out infinite' : 'none',
                    }}>
                      {formatCountdown(o.executionTime)}
                    </span>
                  </div>
                );
              })}
 
              {pendingOrders.length > 5 && (
                <div style={{ padding: '5px 12px', textAlign: 'center' }}>
                  <span style={{ fontSize: 9, color: C.muted }}>+{pendingOrders.length - 5} {T('dashboard.aiSignal.moreItems')}</span>
                </div>
              )}
            </div>
          )}
 
          {/* ── Empty pending ── */}
          {pendingOrders.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 5, padding: '12px 14px 8px',
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[...Array(3)].map((_, i) => (
                  <span key={i} style={{
                    width: 4, height: 4, borderRadius: '50%',
                    background: C.sky, opacity: 0.25 + i * 0.2,
                    animation: `pulse ${1.4 + i * 0.2}s ease-in-out infinite`,
                    animationDelay: `${i * 0.3}s`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 10, color: `${C.muted}88` }}>sedang konfigurasi analysis ai system</span>
            </div>
          )}
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
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',borderBottom:`1px solid ${isOn ? 'rgba(255,107,53,0.2)' : C.bdr}`,flexShrink:0}}>
        {isOn ? (
          <>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <BarChart style={{width:14,height:14,color:C.orange}}/>
              <span style={{fontSize:12,fontWeight:600,color:C.sub}}>{T('dashboard.indicator.title')} <span style={{color:C.orange}}>— {indType}</span></span>
            </div>
<StatusChip col={C.orange} label={T('common.active')} pulse/>
          </>
        ) : (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,width:'100%'}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:C.muted,opacity:0.4}}/>
            <span style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em'}}>{T('common.standby')}</span>
          </div>
        )}
      </div>
      {isLoading?(
        <div style={{padding:'8px 0'}}>{[1,2,3].map(i=><div key={i} style={{padding:'8px 12px'}}><Sk w={`${i===1?70:i===2?50:60}%`} h={14}/></div>)}</div>
      ):!isOn?(
        <div style={{height:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
          <BarChart style={{width:24,height:24,color:C.muted,opacity:0.4}}/>
          <p style={{fontSize:12,color:C.muted,textAlign:'center'}}>{T('dashboard.indicator.notActive')}</p>
        </div>
      ):(
        <div style={{overflowY:'auto',maxHeight:240}}>
          <Row label="P&L" right={<span style={{color:pnlCol,fontFamily:'monospace'}}>{pnl>=0?'+':'-'}{Math.round(Math.abs(pnl)/100).toLocaleString('id-ID')}</span>}/>
          <Row label="W / L" right={<span style={{fontFamily:'monospace'}}><span style={{color:C.cyan}}>{wins}</span><span style={{color:C.muted}}> / </span><span style={{color:C.coral}}>{losses}</span></span>}/>
          <Row label="Win Rate" right={wr!==null?<span style={{color:wr>=50?C.orange:C.coral}}>{wr}%</span>:<span style={{color:C.muted}}>—</span>}/>
          <Row label={T('dashboard.fastTrade.status')} right={<span style={{color:C.orange,fontSize:10}}>{status?.lastStatus||T('dashboard.indicator.monitoring')}</span>}/>
          <Row label={T('dashboard.indicator.signalLabel')} right={lastTrend?<span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,color:lastTrend==='call'?C.cyan:C.coral,background:lastTrend==='call'?'rgba(41,151,255,0.1)':'rgba(255,69,58,0.1)'}}>{lastTrend==='call'?'↑ CALL':'↓ PUT'}</span>:<span style={{color:C.muted}}>—</span>}/>
          {status?.currentIndicatorValue!=null&&(
            <Row label={`${T('dashboard.indicator.valueLabel')} ${indType}`} right={<span style={{color:C.orange,fontFamily:'monospace'}}>{status.currentIndicatorValue.toFixed(4)}</span>} border={false}/>
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
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'11px 14px',borderBottom:`1px solid ${isOn ? 'rgba(255,55,95,0.2)' : C.bdr}`,flexShrink:0}}>
        {isOn ? (
          <>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <Waves style={{width:14,height:14,color:C.pink}}/>
              <span style={{fontSize:12,fontWeight:600,color:C.sub}}>Momentum</span>
            </div>
<StatusChip col={C.pink} label={T('common.active')} pulse/>
          </>
        ) : (
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,width:'100%'}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:C.muted,opacity:0.4}}/>
            <span style={{fontSize:11,fontWeight:600,color:C.muted,letterSpacing:'0.04em'}}>{T('common.standby')}</span>
          </div>
        )}
      </div>
      {isLoading?(
        <div style={{padding:'8px 0'}}>{[1,2,3].map(i=><div key={i} style={{padding:'8px 12px'}}><Sk w={`${i===1?70:i===2?50:60}%`} h={14}/></div>)}</div>
      ):!isOn?(
        <div style={{height:120,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
          <Waves style={{width:24,height:24,color:C.muted,opacity:0.4}}/>
          <p style={{fontSize:12,color:C.muted,textAlign:'center'}}>{T('dashboard.momentum.notActive')}</p>
        </div>
      ):(
        <div style={{overflowY:'auto',maxHeight:240}}>
          <Row label="P&L" right={<span style={{color:pnlCol,fontFamily:'monospace'}}>{pnl>=0?'+':'-'}{Math.round(Math.abs(pnl)/100).toLocaleString('id-ID')}</span>}/>
          <Row label="W / L" right={<span style={{fontFamily:'monospace'}}><span style={{color:C.cyan}}>{wins}</span><span style={{color:C.muted}}> / </span><span style={{color:C.coral}}>{losses}</span></span>}/>
          <Row label="Win Rate" right={wr!==null?<span style={{color:wr>=50?C.pink:C.coral}}>{wr}%</span>:<span style={{color:C.muted}}>—</span>}/>
          <Row label={T('dashboard.fastTrade.status')} right={<span style={{color:C.pink,fontSize:10}}>{status?.lastStatus||T('dashboard.momentum.scanning')}</span>}/>
          {status?.lastDetectedPattern?(
            <Row
              label={T('dashboard.momentum.pattern')}
              border={!status.lastSignalTime}
              right={<span style={{color:C.pink,fontSize:10,fontWeight:700}}>{PATTERN_LABELS[status.lastDetectedPattern]??status.lastDetectedPattern}</span>}
            />
          ):(
<Row label={T('dashboard.momentum.pattern')} right={<span style={{color:C.muted}}>—</span>} border={false}/>
          )}
          {status?.lastSignalTime&&(
            <Row label={T('dashboard.momentum.signalTime')} right={<span style={{color:C.muted,fontFamily:'monospace',fontSize:10}}>{new Date(status.lastSignalTime).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>} border={false}/>
          )}
        </div>
      )}
    </Card>
  );
};

// ═══════════════════════════════════════════
// MOBILE SESSION SHEET
// ═══════════════════════════════════════════
const MobileSessionSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  mode: TradingMode;
  ftStatus: FastradeStatus | null;
  ftLogs: FastradeLog[];
  aiStatus: AISignalStatus | null;
  aiPending: AISignalOrder[];
  indicatorStatus: IndicatorStatus | null;
  momentumStatus: MomentumStatus | null;
  orders: ScheduleOrder[];
  logs: ExecutionLog[];
  onOpenModal: () => void;
  isRunning: boolean;
}> = ({
  open, onClose, mode,
  ftStatus, ftLogs, aiStatus, aiPending,
  indicatorStatus, momentumStatus, orders, logs, onOpenModal, isRunning,
}) => {
  const ac = modeAccent(mode);
  const modeLabel: Record<TradingMode,string> = {
    schedule:'Signal Mode', fastrade:'Fastrade FTT Mode', ctc:'Fastrade CTC',
    aisignal:'AI Signal Mode', indicator:'Analysis Strategy Mode', momentum:'Momentum Mode',
  };

  if (!open) return null;

  return (
    <div style={{position:'fixed',inset:0,zIndex:80,display:'flex',alignItems:'center',justifyContent:'center',padding:16,animation:'fade-in 0.15s ease'}}>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)'}}
      />
      {/* modal — sama persis gaya OrderInputModal */}
      <div style={{
        position:'relative',width:'100%',maxWidth:460,height:'88dvh',maxHeight:640,
        display:'flex',flexDirection:'column',
        background:C.bg,
        borderRadius:24,
        border:`0.4px solid ${ac}66`,
        boxShadow:'0 32px 80px rgba(0,0,0,0.70), 0 8px 24px rgba(0,0,0,0.50)',
        overflow:'hidden',
        animation:'slide-up 0.28s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* header — gradient seperti OrderInputModal */}
        <div style={{
          flexShrink:0,
          background:`linear-gradient(180deg,${C.card2} 0%,${C.card} 100%)`,
          padding:'16px 24px',
          display:'flex',alignItems:'center',justifyContent:'space-between',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:ac,boxShadow:`0 0 6px ${ac}`,animation:'pulse 1.6s ease-in-out infinite',flexShrink:0}}/>
            <p style={{fontSize:20,fontWeight:600,color:C.text,letterSpacing:'-0.02em',margin:0}}>{modeLabel[mode]}</p>
          </div>
          <button
            onClick={onClose}
            style={{
              width:36,height:36,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
              background:C.card2,border:`1px solid ${C.bdr}`,
              color:C.sub,cursor:'pointer',flexShrink:0,
            }}
          >
            <X style={{width:16,height:16}}/>
          </button>
        </div>
        {/* content */}
        <div style={{flex:1,overflowY:'auto',background:C.bg,WebkitOverflowScrolling:'touch' as any}}>
          {(mode==='fastrade'||mode==='ctc')&&(
            <FastradePanel status={ftStatus} logs={ftLogs} isLoading={false} fillHeight={false}/>
          )}
          {mode==='aisignal'&&(
            <AISignalPanel status={aiStatus} pendingOrders={aiPending} isLoading={false} fillHeight={false}/>
          )}
          {mode==='indicator'&&(
            <IndicatorPanel status={indicatorStatus} isLoading={false} fillHeight={false}/>
          )}
          {mode==='momentum'&&(
            <MomentumPanel status={momentumStatus} isLoading={false} fillHeight={false}/>
          )}
          {mode==='schedule'&&(
            <SchedulePanel orders={orders} logs={logs} onOpenModal={()=>{onOpenModal();onClose();}} isRunning={isRunning} isLoading={false} fillHeight={false}/>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// MODE PICKER MODAL
// ═══════════════════════════════════════════
const ModePickerModal: React.FC<{
  open: boolean; onClose: () => void;
  mode: TradingMode; onModeChange: (m: TradingMode) => void;
  locked: boolean; blockedModes: TradingMode[];
}> = ({ open, onClose, mode, onModeChange, locked, blockedModes }) => {
  if (!open) return null;

  const MODES = [
    { v: 'schedule'  as TradingMode, label: 'Signal Mode',           icon: <Calendar  style={{ width: 16, height: 16 }} />, accent: C.cyan,   desc: 'Manual Input Signal' },
    { v: 'fastrade'  as TradingMode, label: 'Fastrade FTT Mode',    icon: <Zap       style={{ width: 16, height: 16 }} />, accent: C.cyan,   desc: 'Fast Trade Execution' },
    { v: 'ctc'       as TradingMode, label: 'Fastrade CTC',         icon: <Copy      style={{ width: 16, height: 16 }} />, accent: C.violet, desc: 'Ultra-Fast Execution' },
    { v: 'aisignal'  as TradingMode, label: 'AI Signal Mode',       icon: <Radio     style={{ width: 16, height: 16 }} />, accent: C.sky,    desc: 'AI Signal Automation' },
    { v: 'indicator' as TradingMode, label: 'Analysis Strategy Mode', icon: <BarChart style={{ width: 16, height: 16 }} />, accent: C.orange, desc: 'Technical Analysis Based' },
    { v: 'momentum'  as TradingMode, label: 'Momentum Mode',        icon: <Waves     style={{ width: 16, height: 16 }} />, accent: C.pink,   desc: 'Parallel Momentum Analysis' },
  ];

  return (
    <div style={{position:'fixed',inset:0,zIndex:70,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',animation:'fade-in 0.15s ease'}}>
      {/* backdrop */}
      <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.72)',backdropFilter:'blur(10px)',WebkitBackdropFilter:'blur(10px)'}}/>
      {/* sheet */}
      <div style={{
        position:'relative',width:'100%',maxWidth:420,
        background:'linear-gradient(160deg,#1a1a1e 0%,#111113 100%)',
        borderRadius:20,
        border:`1px solid rgba(255,255,255,0.08)`,
        animation:'slide-up 0.28s cubic-bezier(0.32,0.72,0,1)',
        boxShadow:'0 20px 60px rgba(0,0,0,0.6)',
        maxHeight:'85dvh',
        overflowY:'auto',
      }}>
        {/* header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 20px 12px'}}>
          <div>
            <p style={{fontSize:16,fontWeight:700,color:C.text,lineHeight:1}}>Mode Trading</p>
            <p style={{fontSize:12,color:C.muted,marginTop:3}}>Pilih mode yang ingin digunakan</p>
          </div>
          <button onClick={onClose} style={{width:30,height:30,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:99,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',cursor:'pointer',color:C.muted}}>
            <X style={{width:14,height:14}}/>
          </button>
        </div>
        {/* mode list */}
        <div style={{padding:'0 12px 16px',display:'flex',flexDirection:'column',gap:6}}>
          {MODES.map(({ v, label, icon, accent, desc }) => {
            const isAct = mode === v;
            const isLock = blockedModes.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => {
                  onModeChange(v);
                  if (!isLock) onClose();
                }}
                style={{
                  display:'flex',alignItems:'center',gap:12,padding:'11px 14px',
                  borderRadius:14,cursor:'pointer',
                  background:isAct?`${accent}14`:'rgba(255,255,255,0.03)',
                  border:`1px solid ${isAct?`${accent}45`:isLock?'rgba(255,255,255,0.10)':'rgba(255,255,255,0.06)'}`,
                  opacity:isLock?0.6:1,
                  transition:'background 0.15s,border-color 0.15s',
                }}
              >
                <span style={{
                  width:38,height:38,borderRadius:11,flexShrink:0,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  background:`${accent}18`,border:`1px solid ${accent}25`,color:accent,
                }}>
                  {icon}
                </span>
                <div style={{flex:1,textAlign:'left'}}>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <span style={{display:'block',fontSize:14,fontWeight:600,color:isAct?accent:C.sub}}>{label}</span>
                    {isLock&&!isAct&&(
        <span style={{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:6,color:C.coral,background:'rgba(255,69,58,0.10)',border:'1px solid rgba(255,69,58,0.22)',letterSpacing:'0.04em',flexShrink:0}}>🔒 {T('common.active')}</span>
                    )}
                  </div>
                  <span style={{display:'block',fontSize:11,color:C.muted,marginTop:1}}>{desc}</span>
                </div>
                {isAct && (
                  <span style={{width:20,height:20,borderRadius:'50%',background:`${accent}18`,border:`1px solid ${accent}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:accent,flexShrink:0}}>✓</span>
                )}
              </button>
            );
          })}
          {blockedModes.length > 0 && (
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:10,background:'rgba(255,159,10,0.06)',border:'1px solid rgba(255,159,10,0.22)',marginTop:2}}>
              <Info style={{width:11,height:11,color:C.amber,flexShrink:0}}/>
              <span style={{fontSize:11,color:C.amber}}>{T('dashboard.modePicker.stopActiveFirst')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════
// MODE SESSION PANEL — FIXED
// ═══════════════════════════════════════════
//
// BUG 1 — Dropdown terpotong:
//   Parent wrapper punya `overflow:'hidden'` → dropdown `position:absolute`
//   ikut terpotong sehingga hanya beberapa item terlihat dan tidak bisa discroll.
//   FIX: hapus overflow:'hidden' dari wrapper; ubah dropdown ke position:'fixed'
//        dengan koordinat dihitung dari ref tombol agar lolos dari semua ancestor overflow.
//
// BUG 2 — Halaman hang saat scroll:
//   Backdrop `position:fixed, inset:0` yang aktif saat dropdown terbuka "menelan"
//   semua touch events termasuk scroll halaman. Perlu ditambah overscroll protection.
//   FIX: tambah `pointer-events:'none'` pada backdrop kecuali area dropdown, dan
//        pastikan dropdown wrapper tidak menghalangi scroll saat tertutup.
//
// CARA PAKAI:
//   Ganti seluruh blok komponen ModeSessionPanel di page.tsx dengan kode di bawah.
// ═══════════════════════════════════════════

// Tambahkan useRef ke import React di baris atas page.tsx jika belum ada:
// import React, { useState, useEffect, useCallback, useRef } from 'react';

const ModeSessionPanel: React.FC<{
  mode: TradingMode; onModeChange: (m: TradingMode) => void; locked: boolean;
  blockedModes: TradingMode[];
  orders: ScheduleOrder[]; logs: ExecutionLog[]; onOpenModal: () => void; isRunning: boolean;
  ftStatus: FastradeStatus | null; ftLogs: FastradeLog[]; ftLoading: boolean;
  aiStatus: AISignalStatus | null; aiPending: AISignalOrder[];
  indicatorStatus: IndicatorStatus | null;
  momentumStatus: MomentumStatus | null;
  fillHeight?: boolean;
  compact?: boolean;
  onViewSession?: () => void;
  startStopButton?: React.ReactNode;
}> = ({
  mode, onModeChange, locked, blockedModes,
  orders, logs, onOpenModal, isRunning,
  ftStatus, ftLogs, ftLoading,
  aiStatus, aiPending,
  indicatorStatus, momentumStatus, fillHeight, compact, onViewSession, startStopButton,
}) => {
  const [modePickerOpen, setModePickerOpen] = useState(false);

  const MODE_LIST = [
    { v: 'schedule'  as TradingMode, label: 'Signal Mode',           icon: <Calendar  style={{ width: 12, height: 12 }} />, accent: C.cyan,   desc: 'Manual Input Signal' },
    { v: 'fastrade'  as TradingMode, label: 'Fastrade FTT Mode',    icon: <Zap       style={{ width: 12, height: 12 }} />, accent: C.cyan,   desc: 'Fast Trade Execution' },
    { v: 'ctc'       as TradingMode, label: 'Fastrade CTC',         icon: <Copy      style={{ width: 12, height: 12 }} />, accent: C.violet, desc: 'Ultra-Fast Execution' },
    { v: 'aisignal'  as TradingMode, label: 'AI Signal Mode',       icon: <Radio     style={{ width: 12, height: 12 }} />, accent: C.sky,    desc: 'AI Signal Automation' },
    { v: 'indicator' as TradingMode, label: 'Analysis Strategy Mode', icon: <BarChart style={{ width: 12, height: 12 }} />, accent: C.orange, desc: 'Technical Analysis Based' },
    { v: 'momentum'  as TradingMode, label: 'Momentum Mode',        icon: <Waves     style={{ width: 12, height: 12 }} />, accent: C.pink,   desc: 'Parallel Momentum Analysis' },
  ];

  const active = MODE_LIST.find(m => m.v === mode)!;
  const ac = modeAccent(mode);

  return (
    <Card style={{
      display: 'flex', flexDirection: 'column',
      minWidth: 0, width: '100%',
      overflow: 'hidden',
      padding: 0,
      background: locked ? undefined : C.card2,
      boxShadow:`0 2px 0 rgba(255,255,255,0.05) inset, 0 10px 32px rgba(0,0,0,0.55), 0 3px 10px rgba(0,0,0,0.40), 0 0 0 1px rgba(0,0,0,0.20)`,
    }}>
      {/* Mode picker modal */}
      <ModePickerModal
        open={modePickerOpen}
        onClose={() => setModePickerOpen(false)}
        mode={mode}
        onModeChange={onModeChange}
        locked={locked}
        blockedModes={blockedModes}
      />

      {/* Mode picker button — di dalam card, sebagai header */}
      <div style={{ position: 'relative', flexShrink: 0, padding: '10px 12px', borderBottom: `1px solid ${C.bdr}` }}>
        <button
          type="button"
          onClick={() => setModePickerOpen(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '7px 10px',
            borderRadius: 10, cursor: 'pointer',
            background: `${ac}10`,
            border: `1px solid ${ac}30`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <span style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${ac}18`, color: ac,
            }}>
              {active.icon}
            </span>
            <span style={{
              fontWeight: 600, color: ac,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              fontSize: 'clamp(9px, 2.5vw, 12px)',
              minWidth: 0, flex: 1,
            }}>{active.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {locked && (
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 99,
                color: ac, background: `${ac}14`, border: `1px solid ${ac}30`,
              }}>
                Aktif
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Konten panel — di dalam card yang sama */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '8px 12px 12px' }}>
        {mode === 'schedule' && (
          <SchedulePanel
            orders={orders} logs={logs} onOpenModal={onOpenModal}
            isRunning={isRunning} isLoading={false} fillHeight={fillHeight}
            compact={compact} onViewSession={onViewSession}
          />
        )}
        {(mode === 'fastrade' || mode === 'ctc') && (
          <FastradePanel status={ftStatus} logs={ftLogs} isLoading={ftLoading} fillHeight={fillHeight} />
        )}
        {mode === 'aisignal' && (
          <AISignalPanel
            status={aiStatus} pendingOrders={aiPending}
            isLoading={false} fillHeight={fillHeight}
          />
        )}
        {mode === 'indicator' && (
          <IndicatorPanel status={indicatorStatus} isLoading={false} fillHeight={fillHeight} />
        )}
        {mode === 'momentum' && (
          <MomentumPanel status={momentumStatus} isLoading={false} fillHeight={fillHeight} />
        )}
      </div>
      {/* Injected start/stop button (mobile only) */}
      {startStopButton && (
        <div style={{ padding: '0 12px 12px', flexShrink: 0 }}>
          {startStopButton}
        </div>
      )}
    </Card>
  );
};

// ═══════════════════════════════════════════
// MARTINGALE DIALOG — mirip Kotlin MaxStepSelectionDialog
// ═══════════════════════════════════════════
const MartingaleDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  martingale: MartingaleConfig;
  onMartingaleChange: (c: MartingaleConfig) => void;
  mode: TradingMode;
}> = ({ open, onClose, martingale, onMartingaleChange, mode }) => {
  const [customInput, setCustomInput] = useState('');
  const [multInput, setMultInput] = useState(String(martingale.multiplier));
  const [multType, setMultType] = useState<'fixed'|'pct'>('fixed');
  const set = (k: keyof MartingaleConfig, v: any) => onMartingaleChange({ ...martingale, [k]: v });

  const fixedPresets = [1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
  const pctPresets   = [50, 100, 150, 200, 300, 500];
  const currentPresets = multType === 'fixed' ? fixedPresets : pctPresets;
  const multVal = parseFloat(multInput) || martingale.multiplier;
  const multErr = multType === 'fixed'
    ? (multVal < 1 ? 'Min 1.0×' : multVal > 50 ? 'Maks 50×' : null)
    : (multVal < 1 ? 'Min 1%'   : multVal > 5000 ? 'Maks 5000%' : null);

  if (!open) return null;
  return (
    <div style={{ position:'fixed',inset:0,zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 16px',animation:'fade-in 0.15s ease' }}>
      <div onClick={onClose} style={{ position:'absolute',inset:0,background:'rgba(0,0,0,0.60)',backdropFilter:'blur(14px)' }}/>
      <div style={{
        position:'relative',width:'100%',maxWidth:420,maxHeight:'88dvh',
        background:C.card, borderRadius:20,border:`1px solid ${C.bdr}`,
        boxShadow:'0 20px 60px rgba(0,0,0,0.55)',
        overflow:'hidden',display:'flex',flexDirection:'column',
        animation:'slide-up 0.22s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Header */}
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:`1px solid ${C.bdr}` }}>
          <div>
            <p style={{ fontSize:17,fontWeight:700,color:C.text,letterSpacing:'-0.02em',margin:0 }}>{T('dashboard.martingale.title')}</p>
            <p style={{ fontSize:12,color:C.muted,margin:'2px 0 0' }}>{T('dashboard.martingale.subtitle')}</p>
          </div>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:C.card2,border:`1px solid ${C.bdr}`,cursor:'pointer' }}>
            <X style={{ width:15,height:15,color:C.sub }}/>
          </button>
        </div>
        {/* Scrollable body */}
        <div style={{ overflowY:'auto',padding:'0 20px 24px',flex:1 }}>
          {/* Maks. Kompensasi */}
          <div style={{ paddingTop:18 }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
              <p style={{ fontSize:13,fontWeight:600,color:C.text,margin:0 }}>{T('dashboard.martingale.maxCompensation')}</p>
              {martingale.alwaysSignal && (
                <span style={{ fontSize:10,fontWeight:600,color:C.amber,background:`${C.amber}14`,borderRadius:6,padding:'2px 8px',border:`1px solid ${C.amber}28` }}>∞ override</span>
              )}
            </div>
            <div style={{ display:'flex',gap:6 }}>
              {[1,2,3,4,5].map(k => {
                const sel = martingale.maxStep === k;
                return (
                  <button key={k} onClick={() => set('maxStep', k)} style={{
                    flex:1,height:38,borderRadius:10,cursor:'pointer',fontSize:12,fontWeight:sel?700:400,
                    background:sel?`${C.cyan}20`:C.card2,border:`1px solid ${sel?`${C.cyan}70`:C.bdr}`,
                    color:sel?C.cyan:C.muted,transition:'all 0.15s',
                  }}>K{k}</button>
                );
              })}
            </div>
            <div style={{ display:'flex',gap:8,marginTop:8,alignItems:'center' }}>
              <input className="ds-input" type="number" placeholder={martingale.maxStep>5?`K${martingale.maxStep} terpilih`:'Custom steps (1-10)'}
                value={customInput} onChange={e=>{ if(e.target.value.length<=2) setCustomInput(e.target.value.replace(/\D/g,'')); }}
                style={{ flex:1,borderColor:customInput&&(parseInt(customInput)<1||parseInt(customInput)>10)?C.coral:undefined }}/>
              <button onClick={()=>{ const v=parseInt(customInput); if(v>=1&&v<=10){set('maxStep',v);setCustomInput('');} }}
                disabled={!customInput||parseInt(customInput)<1||parseInt(customInput)>10}
                style={{ height:44,padding:'0 18px',borderRadius:10,cursor:'pointer',fontSize:12,fontWeight:600,background:C.cyan,color:'#fff',border:'none',opacity:(!customInput||parseInt(customInput)<1||parseInt(customInput)>10)?0.4:1 }}>Set</button>
            </div>
            {customInput&&(parseInt(customInput)<1||parseInt(customInput)>10)&&(
              <p style={{ fontSize:10,color:C.coral,marginTop:4 }}>{T('dashboard.martingale.rangeHint')}</p>
            )}
          </div>
          <div style={{ height:1,background:C.bdr,margin:'18px 0' }}/>
          {/* Perkalian Kompensasi */}
          <div>
            <p style={{ fontSize:13,fontWeight:600,color:C.text,margin:'0 0 10px' }}>{T('dashboard.martingale.compensationMultiplier')}</p>
            <div style={{ display:'flex',gap:3,padding:3,borderRadius:10,background:C.card2,marginBottom:10 }}>
              {(['fixed','pct'] as const).map(t => {
                const sel = multType === t;
                return (
                  <button key={t} onClick={() => setMultType(t)} style={{
                    flex:1,height:34,borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:sel?700:400,
                    background:sel?`${C.cyan}20`:'transparent',border:sel?`1px solid ${C.cyan}60`:'1px solid transparent',
                    color:sel?C.cyan:C.muted,transition:'all 0.15s',
                  }}>{t==='fixed'?'Fixed (×)':'Persen (%)'}</button>
                );
              })}
            </div>
            <div style={{ display:'flex',gap:6,flexWrap:'wrap',marginBottom:10 }}>
              {currentPresets.map(v => {
                const sel = Math.abs(martingale.multiplier - v) < 0.001;
                return (
                  <button key={v} onClick={() => { set('multiplier',v); setMultInput(String(v)); }} style={{
                    height:32,padding:'0 10px',borderRadius:8,cursor:'pointer',fontSize:11,fontWeight:sel?700:400,
                    background:sel?`${C.cyan}20`:C.card2,border:`1px solid ${sel?`${C.cyan}60`:C.bdr}`,
                    color:sel?C.cyan:C.muted,
                  }}>{multType==='fixed'?`${v}×`:`${v}%`}</button>
                );
              })}
            </div>
            <div style={{ position:'relative' }}>
              <input className="ds-input" type="number" value={multInput}
                onChange={e=>{ setMultInput(e.target.value); const v=parseFloat(e.target.value); if(v>=1&&v<=(multType==='fixed'?50:5000)) set('multiplier',v); }}
                style={{ paddingRight:36,borderColor:multErr?C.coral:undefined }}/>
              <span style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',fontSize:13,color:C.sub,pointerEvents:'none' }}>{multType==='fixed'?'×':'%'}</span>
            </div>
            {multErr&&<p style={{ fontSize:10,color:C.coral,marginTop:4 }}>{multErr}</p>}
          </div>
          {/* Always Signal */}
          {mode !== 'ctc' && (
            <>
              <div style={{ height:1,background:C.bdr,margin:'18px 0' }}/>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <div>
                  <p style={{ fontSize:13,fontWeight:600,color:C.text,margin:'0 0 2px' }}>{T('dashboard.martingale.alwaysSignal')}</p>
                  <p style={{ fontSize:11,color:C.muted,margin:0 }}>{martingale.alwaysSignal?T('dashboard.martingale.alwaysSignalOn'):T('dashboard.martingale.alwaysSignalOff')}</p>
                </div>
                <Toggle checked={martingale.alwaysSignal??false} onChange={v=>set('alwaysSignal',v)} accent={C.amber}/>
              </div>
              {martingale.alwaysSignal&&(
                <div style={{ marginTop:10,padding:'10px 12px',borderRadius:10,background:`${C.amber}09`,border:`1px solid ${C.amber}28` }}>
                  <p style={{ fontSize:11,color:C.amber,margin:0,lineHeight:1.5 }}>⚠ Martingale terus jalan di sinyal berikutnya hingga WIN. Max step diabaikan.</p>
                </div>
              )}
            </>
          )}
        </div>
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
  const [open,setOpen] = useState(!disabled);
  const [pickerOpen,setPickerOpen] = useState<string|null>(null);
  const [amtDrop,setAmtDrop] = useState(false);
  const [showMartingaleDialog, setShowMartingaleDialog] = useState(false);
  // Local string state for amount input — avoids iOS number-input editing issues
  const [amtStr, setAmtStr] = useState(amount > 0 ? String(amount) : '');
  const [amtFocused, setAmtFocused] = useState(false);
  // Sync amtStr when amount changes externally (e.g. quick-pick)
  useEffect(()=>{ setAmtStr(amount > 0 ? String(amount) : ''); },[amount]);
  // SELALU formatted dengan titik ribuan — live saat mengetik, nilai internal tetap integer
  const amtDisplay = amtStr && parseInt(amtStr,10) > 0
    ? parseInt(amtStr,10).toLocaleString('id-ID')
    : '';
  useEffect(()=>{ if(disabled) setOpen(false); },[disabled]);
  const set = (k:keyof MartingaleConfig,v:any) => onMartingaleChange({...martingale,[k]:v});
  const assetOpts: PickerOpt[] = assets.map(a=>({value:a.ric,label:a.name,sub:`${a.ric} · ${a.profitRate}%`,icon:a.iconUrl}));
  const durationOpts = [{value:'60',label:'1 Menit'},{value:'120',label:'2 Menit'},{value:'300',label:'5 Menit'},{value:'600',label:'10 Menit'},{value:'900',label:'15 Menit'},{value:'1800',label:'30 Menit'}];
  const acOpts: PickerOpt[] = [{value:'demo',label:'Demo',sub:'Virtual · tidak pakai dana nyata'},{value:'real',label:'Real',sub:'Menggunakan saldo sesungguhnya'}];
  const ac = modeAccent(mode);
  const isBelowMin = amount > 0 && amount < IDR_MIN_DISPLAY;
  const isNewMode = mode==='aisignal'||mode==='indicator'||mode==='momentum';
  const modeLabel = mode==='aisignal'?'AI Signal Mode':mode==='indicator'?'Analysis Strategy Mode':mode==='momentum'?'Momentum Mode':mode==='ctc'?'Fastrade CTC':mode==='fastrade'?'Fastrade FTT Mode':'Signal Mode';
  const acctCol = isDemo ? C.amber : C.cyan;

  return (
    <>
      <MartingaleDialog open={showMartingaleDialog} onClose={()=>setShowMartingaleDialog(false)} martingale={martingale} onMartingaleChange={onMartingaleChange} mode={mode}/>
      <PickerModal open={pickerOpen==='actype'} onClose={()=>setPickerOpen(null)} title={T('dashboard.settings.accountType')} options={acOpts} value={isDemo?'demo':'real'} onSelect={v=>onDemoChange(v==='demo')}/>
      <PickerModal open={pickerOpen==='duration'} onClose={()=>setPickerOpen(null)} title={T('dashboard.settings.orderDuration')} options={durationOpts} value={String(duration)} onSelect={v=>onDurationChange(+v)}/>
      <PickerModal open={pickerOpen==='ftTf'} onClose={()=>setPickerOpen(null)} title={T('dashboard.settings.fastradeTimeframe')} options={FT_TF.map(t=>({value:t.value,label:t.label}))} value={ftTf} onSelect={v=>onFtTfChange(v as FastTradeTimeframe)}/>

      <Card style={{ opacity:disabled?0.65:1, border:`1px solid ${C.bdr}`, boxShadow:`0 2px 0 rgba(255,255,255,0.05) inset, 0 10px 32px rgba(0,0,0,0.55), 0 3px 10px rgba(0,0,0,0.40), 0 0 0 1px rgba(0,0,0,0.20)` }}>
        {/* Header */}
        <button onClick={()=>setOpen(!open)} style={{ width:'100%',display:'flex',alignItems:'center',gap:10,padding:'16px 18px',background:'transparent',border:'none',borderBottom:open?`1px solid ${C.bdr}`:'none',cursor:'pointer',textAlign:'left' }}>
            <div style={{ width:34,height:34,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:`${ac}14`,border:`1px solid ${ac}30` }}>
              <Settings style={{ width:16,height:16,color:ac }}/>
            </div>
            <div style={{ flex:1,minWidth:0,textAlign:'left',overflow:'hidden' }}>
              <span style={{ fontSize:'clamp(11px,3.8vw,16px)',fontWeight:700,color:C.text,display:'block',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{T('dashboard.settings.title')}</span>
              {disabled ? <span style={{ fontSize:'clamp(8px,2.5vw,10px)',color:C.amber,fontWeight:600,display:'block',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>⚡ {T('dashboard.settings.botActive')}</span>
                        : <span style={{ fontSize:'clamp(8px,2.5vw,10px)',color:C.muted,display:'block',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{T('dashboard.settings.subtitle')}</span>}
            </div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <span style={{ fontSize:10,padding:'3px 9px',borderRadius:99,background:`${ac}12`,color:ac,border:`1px solid ${ac}28`,fontWeight:600 }}>{modeLabel}</span>
            <div style={{ width:24,height:24,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',background:C.card2,border:`1px solid ${C.bdr}` }}>
              {open?<ChevronUp style={{ width:12,height:12,color:C.muted }}/>:<ChevronDown style={{ width:12,height:12,color:C.muted }}/>}
            </div>
          </div>
        </button>

        {open&&(
          <div style={{ padding:'18px 18px 20px',pointerEvents:disabled?'none':undefined,display:'flex',flexDirection:'column',gap:18 }}>

            {/* Konfigurasi Akun */}
            <div>
              <p style={{ fontSize:12,fontWeight:600,color:C.text,margin:'0 0 10px' }}>{T('dashboard.settings.accountConfig')}</p>
              <div style={{ display:'flex',gap:8 }}>
                {/* Akun Real/Demo */}
                <button disabled={disabled} onClick={()=>setPickerOpen('actype')} style={{
                  flex:'0 0 auto',height:44,borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',gap:6,padding:'0 10px',
                  background:`${acctCol}16`,border:`0.8px solid ${acctCol}55`,transition:'all 0.15s',minWidth:0,
                  boxShadow:`0 1px 0 rgba(255,255,255,0.07) inset, 0 4px 14px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25)`,
                }}>
                  <Wallet style={{ width:14,height:14,color:acctCol,flexShrink:0 }}/>
                  <span style={{ fontSize:11,fontWeight:700,color:C.text,whiteSpace:'nowrap' }}>{isDemo?'Demo':'Real'}</span>
                  <ChevronDown style={{ width:12,height:12,color:C.text,flexShrink:0 }}/>
                </button>
                {/* Durasi / Timeframe */}
                <div style={{ flex:'0 0 auto',minWidth:0 }}>
                  {!isNewMode&&(mode==='fastrade'
                    ?<button disabled={disabled} onClick={()=>setPickerOpen('ftTf')} style={{ width:'100%',height:44,borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',gap:6,padding:'0 10px',background:C.card2,border:`0.8px solid ${C.bdr}`,minWidth:0,boxShadow:`0 1px 0 rgba(255,255,255,0.07) inset, 0 4px 14px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25)` }}>
                       <Clock style={{ width:13,height:13,color:C.muted,flexShrink:0 }}/><span style={{ fontSize:11,fontWeight:600,color:C.text,flex:1,textAlign:'left',whiteSpace:'nowrap' }}>{FT_TF.find(t=>t.value===ftTf)?.label||''}</span><ChevronDown style={{ width:12,height:12,color:C.muted,flexShrink:0 }}/>
                     </button>
                    :mode==='ctc'
                    ?<div style={{ height:44,borderRadius:12,display:'flex',alignItems:'center',gap:6,padding:'0 10px',background:C.faint,border:`0.8px solid ${C.bdr}`,minWidth:0 }}>
                       <Copy style={{ width:13,height:13,color:C.violet }}/><span style={{ fontSize:11,color:C.violet,whiteSpace:'nowrap' }}>1 Menit</span>
                     </div>
                    :<button disabled={disabled} onClick={()=>setPickerOpen('duration')} style={{ width:'100%',height:44,borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',gap:6,padding:'0 10px',background:C.card2,border:`0.8px solid ${C.bdr}`,minWidth:0,boxShadow:`0 1px 0 rgba(255,255,255,0.07) inset, 0 4px 14px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25)` }}>
                       <Clock style={{ width:13,height:13,color:C.muted,flexShrink:0 }}/><span style={{ fontSize:11,fontWeight:600,color:C.text,flex:1,textAlign:'left',whiteSpace:'nowrap' }}>{durationOpts.find(d=>d.value===String(duration))?.label||''}</span><ChevronDown style={{ width:12,height:12,color:C.muted,flexShrink:0 }}/>
                     </button>
                  )}
                  {isNewMode&&<div style={{ height:44,borderRadius:12,display:'flex',alignItems:'center',padding:'0 10px',background:C.card2,border:`0.8px solid ${C.bdr}` }}><span style={{ fontSize:11,color:C.muted }}>{T('dashboard.settings.automatic')}</span></div>}
                </div>
                {/* Mata Uang */}
                <div style={{ flex:1,height:44,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'space-between',gap:6,padding:'0 10px',background:`rgba(255,255,255,0.06)`,border:`0.8px solid rgba(255,255,255,0.15)`,minWidth:0 }}>
                  <span style={{ fontSize:14,lineHeight:1,flexShrink:0 }}>🇮🇩</span>
                  <span style={{ fontSize:8,fontWeight:700,color:'rgba(255,255,255,0.7)',background:`rgba(255,255,255,0.10)`,borderRadius:4,padding:'1px 5px',border:`1px solid rgba(255,255,255,0.18)`,flexShrink:0,whiteSpace:'nowrap' }}>AUTO</span>
                </div>
              </div>
              {mode==='ctc'&&<div style={{ marginTop:8,padding:'9px 12px',borderRadius:10,background:'rgba(191,90,242,0.07)',border:'1px solid rgba(191,90,242,0.2)',display:'flex',gap:8 }}><Copy style={{ width:13,height:13,color:C.violet,flexShrink:0,marginTop:1 }}/><p style={{ fontSize:10,color:C.muted,lineHeight:1.5 }}>{T('dashboard.settings.ctcInfo')}</p></div>}
            </div>

            {/* Jumlah Trade */}
            {mode!=='indicator'&&(
              <div>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                  <p style={{ fontSize:12,fontWeight:600,color:C.text,margin:0 }}>{T('dashboard.settings.tradeAmount')}</p>
                  <span style={{ fontSize:10,color:C.muted }}>{T('dashboard.settings.minAmount')}: Rp {IDR_MIN_DISPLAY.toLocaleString('id-ID')}</span>
                </div>
                <div style={{ display:'flex',gap:8 }}>
                  <div style={{ flex:1,position:'relative' }}>
                    <span style={{ position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:11,color:C.muted,zIndex:1,pointerEvents:'none' }}>Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      className="ds-input"
                      value={amtDisplay}
                      onChange={e=>{
                        // Strip titik ribuan + non-digit agar nilai internal tetap angka murni
                        const raw = e.target.value.replace(/\./g,'').replace(/[^0-9]/g,'');
                        setAmtStr(raw);
                        onAmountChange(raw ? parseInt(raw, 10) : 0);
                      }}
                      onFocus={e=>{ setAmtFocused(true); setTimeout(()=>e.target.select(),0); }}
                      onBlur={()=>{ setAmtFocused(false); if(!amtStr||amtStr==='0') setAmtStr(''); }}
                      onKeyDown={e=>{ if(e.key==='Enter'||(e as any).keyCode===13) e.currentTarget.blur(); }}
                      disabled={disabled}
                      placeholder={IDR_MIN_DISPLAY.toLocaleString('id-ID')}
                      style={{ paddingLeft:30, paddingRight:44, borderColor:isBelowMin?C.coral:undefined, fontSize:16 }}
                    />
                    {/* Tombol Enter — tutup keyboard */}
                    <button
                      type="button"
                      onMouseDown={e=>{ e.preventDefault(); (e.currentTarget.previousElementSibling as HTMLInputElement|null)?.blur(); }}
                      disabled={disabled}
                      style={{
                        position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',
                        width:30,height:26,borderRadius:7,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        background:amtFocused?`${C.cyan}22`:C.card2,
                        border:`1px solid ${amtFocused?`${C.cyan}55`:C.bdr}`,
                        color:amtFocused?C.cyan:C.muted,
                        cursor:'pointer',transition:'all 0.15s',flexShrink:0,
                        fontSize:18,fontWeight:700,lineHeight:1,
                      }}
                      title="Konfirmasi"
                    >↵</button>
                  </div>
                  <div style={{ position:'relative',flexShrink:0 }}>
                    <button type="button" disabled={disabled} onClick={()=>setAmtDrop(v=>!v)} style={{ height:'100%',padding:'0 12px',display:'flex',alignItems:'center',gap:5,borderRadius:12,fontSize:12,fontWeight:700,background:amtDrop?`${C.cyan}18`:C.card2,border:`0.8px solid ${amtDrop?`${C.cyan}50`:C.bdr}`,color:amtDrop?C.cyan:C.text,cursor:disabled?'not-allowed':'pointer',boxShadow:`0 1px 0 rgba(255,255,255,0.07) inset, 0 4px 14px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.25)` }}>
                      <Zap style={{ width:13,height:13 }}/> Quick
                    </button>
                    {amtDrop&&!disabled&&(
                      <>
                        <div style={{ position:'fixed',inset:0,zIndex:5 }} onClick={()=>setAmtDrop(false)}/>
                        <div style={{ position:'absolute',right:0,marginTop:4,zIndex:10,minWidth:170,borderRadius:12,overflow:'hidden',background:C.card,border:`1px solid ${C.bdr}`,boxShadow:'0 8px 32px rgba(0,0,0,0.3)',animation:'slide-up 0.15s ease' }}>
                          {QUICK_AMOUNTS.map((a,idx)=>{
                            const isAct=amount===a;
                            return (
                              <button key={a} type="button" onClick={()=>{onAmountChange(a);setAmtDrop(false);}} style={{ width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',fontSize:13,background:isAct?`${C.cyan}12`:'transparent',borderBottom:idx<QUICK_AMOUNTS.length-1?`1px solid ${C.bdr}`:'none',borderLeft:isAct?`2px solid ${C.cyan}`:'2px solid transparent',borderTop:'none',borderRight:'none',color:isAct?C.cyan:C.sub,fontWeight:isAct?700:400,cursor:'pointer' }}>
                                <span>{a>=1000000?`Rp ${a/1000000}M`:`Rp ${(a/1000).toFixed(a%1000===0?0:1)}K`}</span>
                                {isAct&&<span style={{ color:C.cyan }}>✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {isBelowMin&&<p style={{ fontSize:10,color:C.coral,marginTop:4 }}>⚠ {T('dashboard.settings.amountBelowMin')}</p>}
              </div>
            )}

            {/* Indicator specific */}
            {mode==='indicator'&&(
              <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                <div><FL>{T('dashboard.indicator.indicatorType')}</FL>
                  <div style={{ display:'flex',gap:6 }}>
                    {(['EMA','RSI','MACD','BBANDS','STOCH'] as IndicatorType[]).map(t=>(
                      <button key={t} disabled={disabled} onClick={()=>onIndicatorTypeChange(t)} style={{ flex:1,padding:'6px 0',borderRadius:8,fontSize:10,fontWeight:700,cursor:'pointer',background:indicatorType===t?`${C.orange}18`:C.card2,border:`1px solid ${indicatorType===t?`${C.orange}50`:C.bdr}`,color:indicatorType===t?C.orange:C.muted }}>{t}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                  <div><FL>Period</FL><input type="number" className="ds-input" value={indicatorPeriod} onChange={e=>onIndicatorPeriodChange(+e.target.value||14)} disabled={disabled} min={2} max={200}/></div>
                  <div><FL>{T('dashboard.indicator.sensitivity')}</FL>
                    <div style={{ display:'flex',gap:4 }}>
                      {[0.1,0.5,1,5,10].map(s=>(<button key={s} disabled={disabled} onClick={()=>onSensitivityChange(s)} style={{ flex:1,padding:'6px 0',borderRadius:6,fontSize:10,fontWeight:700,cursor:'pointer',background:indicatorSensitivity===s?`${C.orange}18`:C.card2,border:`1px solid ${indicatorSensitivity===s?`${C.orange}55`:C.bdr}`,color:indicatorSensitivity===s?C.orange:C.muted }}>{s}</button>))}
                    </div>
                  </div>
                </div>
                {indicatorType==='RSI'&&(
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8 }}>
                    <div><FL>Overbought</FL><input type="number" className="ds-input" value={rsiOverbought} onChange={e=>onOverboughtChange(+e.target.value||70)} disabled={disabled} min={50} max={100}/></div>
                    <div><FL>Oversold</FL><input type="number" className="ds-input" value={rsiOversold} onChange={e=>onOversoldChange(+e.target.value||30)} disabled={disabled} min={0} max={50}/></div>
                  </div>
                )}
                <div><FL>{T('dashboard.indicator.amountPerOrder')}</FL>
                  <div style={{ position:'relative' }}>
                    <span style={{ position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',fontSize:11,color:C.muted,zIndex:1,pointerEvents:'none' }}>Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      className="ds-input"
                      value={amtDisplay}
                      onChange={e=>{
                        // Strip titik ribuan + non-digit agar nilai internal tetap angka murni
                        const raw = e.target.value.replace(/\./g,'').replace(/[^0-9]/g,'');
                        setAmtStr(raw);
                        onAmountChange(raw ? parseInt(raw, 10) : 0);
                      }}
                      onFocus={e=>{ setAmtFocused(true); setTimeout(()=>e.target.select(),0); }}
                      onBlur={()=>{ setAmtFocused(false); if(!amtStr||amtStr==='0') setAmtStr(''); }}
                      onKeyDown={e=>{ if(e.key==='Enter'||(e as any).keyCode===13) e.currentTarget.blur(); }}
                      disabled={disabled}
                      placeholder={IDR_MIN_DISPLAY.toLocaleString('id-ID')}
                      style={{ paddingLeft:30, paddingRight:44, fontSize:16 }}
                    />
                    {/* Tombol Enter — tutup keyboard */}
                    <button
                      type="button"
                      onMouseDown={e=>{ e.preventDefault(); (e.currentTarget.previousElementSibling as HTMLInputElement|null)?.blur(); }}
                      disabled={disabled}
                      style={{
                        position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',
                        width:30,height:26,borderRadius:7,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        background:amtFocused?`${C.cyan}22`:C.card2,
                        border:`1px solid ${amtFocused?`${C.cyan}55`:C.bdr}`,
                        color:amtFocused?C.cyan:C.muted,
                        cursor:'pointer',transition:'all 0.15s',flexShrink:0,
                        fontSize:18,fontWeight:700,lineHeight:1,
                      }}
                      title="Konfirmasi"
                    >↵</button>
                  </div>
                </div>
              </div>
            )}

            {/* Momentum patterns — all auto-enabled, settings hidden */}
            {mode==='momentum'&&(
              <div style={{ padding:'10px 12px',borderRadius:10,background:`${C.pink}07`,border:`1px solid ${C.pink}20`,display:'flex',gap:8 }}>
                <Waves style={{ width:14,height:14,color:C.pink,flexShrink:0,marginTop:2 }}/>
                <div>
                  <p style={{ fontSize:11,fontWeight:600,color:C.pink,marginBottom:4 }}>Active pola candle</p>
                  <p style={{ fontSize:10,color:C.muted,lineHeight:1.5 }}>All candlestick patterns are systematically enabled — Hammer, Squeezed Doji, Reversal Doji, Bollinger Band + Parabolic SAR Breakout.</p>
                </div>
              </div>
            )}

            {/* AI Signal info */}
            {mode==='aisignal'&&(
              <div style={{ padding:'10px 12px',borderRadius:10,background:`${C.sky}07`,border:`1px solid ${C.sky}20`,display:'flex',gap:8 }}>
                <Radio style={{ width:14,height:14,color:C.sky,flexShrink:0,marginTop:2 }}/>
                <div>
                  <p style={{ fontSize:11,fontWeight:600,color:C.sky,marginBottom:4 }}>Mode AI Signal</p>
                  <p style={{ fontSize:10,color:C.muted,lineHeight:1.5 }}>Terima sinyal CALL/PUT dari Telegram/AI via endpoint <code style={{ color:C.sky }}>/aisignal/signal</code></p>
                </div>
              </div>
            )}

            {/* Kompensasi / Martingale — dua kartu mirip Kotlin */}
            <div>
              <div style={{ height:1,background:C.bdr,marginBottom:16 }}/>
              <p style={{ fontSize:12,fontWeight:600,color:C.text,marginBottom:10 }}>{T('dashboard.martingale.compensation')}</p>
              <div style={{ display:'flex',gap:8 }}>
                {/* Toggle card */}
                <button disabled={disabled} onClick={()=>set('enabled',!martingale.enabled)} style={{
                  flex:1,height:44,borderRadius:12,cursor:'pointer',display:'flex',alignItems:'center',gap:8,padding:'0 12px',
                  background:martingale.enabled?`${C.cyan}18`:C.card2,border:`0.8px solid ${martingale.enabled?`${C.cyan}60`:C.bdr}`,transition:'all 0.15s',
                }}>
                  <div style={{ width:16,height:16,borderRadius:'50%',flexShrink:0,background:martingale.enabled?C.cyan:'transparent',border:`1.5px solid ${martingale.enabled?C.cyan:C.muted}`,display:'flex',alignItems:'center',justifyContent:'center' }}>
                    {martingale.enabled&&<span style={{ width:6,height:6,borderRadius:'50%',background:'#fff' }}/>}
                  </div>
                  <span style={{ fontSize:11,fontWeight:700,color:C.text,letterSpacing:'0.02em' }}>Martingale</span>
                </button>
                {/* Max Steps card — opens dialog */}
                <button disabled={disabled||!martingale.enabled} onClick={()=>{ if(martingale.enabled) setShowMartingaleDialog(true); }} style={{
                  flex:1,height:44,borderRadius:12,cursor:martingale.enabled?'pointer':'not-allowed',
                  display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',
                  background:C.card2,border:`0.8px solid ${martingale.enabled&&!martingale.alwaysSignal?`${C.amber}45`:C.bdr}`,
                  opacity:martingale.enabled?1:0.45,transition:'all 0.15s',
                }}>
                  <span style={{ fontSize:11,fontWeight:500,color:C.text }}>{T('dashboard.martingale.maxStepLabel')}</span>
                  <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                    {martingale.alwaysSignal
                      ?<span style={{ fontSize:18,fontWeight:700,color:C.amber }}>∞</span>
                      :<span style={{ fontSize:14,fontWeight:700,color:C.text }}>{martingale.maxStep}</span>
                    }
                    {martingale.enabled&&<RefreshCw style={{ width:11,height:11,color:C.amber }}/>}
                  </div>
                </button>
              </div>
              {martingale.enabled&&(
                <div style={{ marginTop:8,display:'flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:10,background:`${C.cyan}07`,border:`1px solid ${C.cyan}18` }}>
                  <TrendingUp style={{ width:12,height:12,color:C.cyan,flexShrink:0 }}/>
                  <span style={{ fontSize:11,color:C.sub }}>Multiplier: <strong style={{ color:C.cyan }}>{martingale.multiplier}×</strong></span>
                  {martingale.alwaysSignal&&<span style={{ marginLeft:6,fontSize:10,fontWeight:700,color:C.amber,background:`${C.amber}14`,borderRadius:4,padding:'1px 6px' }}>Always Signal ON</span>}
                  <button onClick={()=>setShowMartingaleDialog(true)} style={{ marginLeft:'auto',fontSize:10,color:C.cyan,background:'transparent',border:'none',cursor:'pointer',padding:0,fontWeight:600 }}>Edit →</button>
                </div>
              )}
            </div>

            {/* Risk Management */}
            {!isNewMode&&(
              <div>
                <div style={{ height:1,background:C.bdr,marginBottom:16 }}/>
                <SL accent="rgba(255,69,58,0.55)">Risk Management</SL>
                <div style={{ padding:12,borderRadius:12,background:'rgba(255,69,58,0.05)',border:'1px solid rgba(255,69,58,0.12)' }}>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                    <div><FL>Stop Loss</FL>
                      <div style={{ position:'relative' }}>
                        <span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:11,color:C.muted,zIndex:1,pointerEvents:'none' }}>Rp</span>
                        <input type="number" className="ds-input" value={stopLoss||''} onChange={e=>onSlChange(e.target.value?+e.target.value:0)} disabled={disabled} placeholder="Opsional" style={{ paddingLeft:30 }}/>
                      </div>
                    </div>
                    <div><FL>Take Profit</FL>
                      <div style={{ position:'relative' }}>
                        <span style={{ position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:11,color:C.muted,zIndex:1,pointerEvents:'none' }}>Rp</span>
                        <input type="number" className="ds-input" value={stopProfit||''} onChange={e=>onSpChange(e.target.value?+e.target.value:0)} disabled={disabled} placeholder="Opsional" style={{ paddingLeft:30 }}/>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
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
  martingale:MartingaleConfig;
}> = ({mode,scheduleStatus,orders,ftStatus,aiStatus,indicatorStatus,momentumStatus,canStart,isLoading,profit,onStart,onStop,onPause,onResume,error,isBelowMin,martingale}) => {
  const [open,setOpen] = useState(true);
  const botState = scheduleStatus?.botState??'IDLE';
  const isSchedRunning = botState==='RUNNING', isSchedPaused = botState==='PAUSED';
  const isFtRunning = ftStatus?.isRunning??false;
  const isAIRunning = aiStatus?.botState === 'RUNNING' || (!aiStatus?.botState && aiStatus?.isActive === true);
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

  // Auto-collapse when bot becomes active
  useEffect(()=>{ if(isActive) setOpen(false); },[isActive]);

  const si = isActive ? {label:T('common.active'),col:ac,pulse:true} : {label:T('common.standby'),col:C.muted,pulse:false};

  const modeIcon = {
    schedule:<Calendar style={{width:14,height:14}}/>,
    fastrade:<Zap style={{width:14,height:14}}/>,
    ctc:<Copy style={{width:14,height:14}}/>,
    aisignal:<Radio style={{width:14,height:14}}/>,
    indicator:<BarChart style={{width:14,height:14}}/>,
    momentum:<Waves style={{width:14,height:14}}/>,
  }[mode];

  const modeLabel = {schedule:'Signal Mode',fastrade:'Fastrade FTT Mode',ctc:'Fastrade CTC',aisignal:'AI Signal Mode',indicator:'Analysis Strategy Mode',momentum:'Momentum Mode'}[mode];
  const modeSub = {schedule:'Eksekusi terjadwal',fastrade:'Auto per candle',ctc:'Copy the Candle · 1m',aisignal:'Terima & eksekusi sinyal',indicator:'Analisis teknikal otomatis',momentum:'Deteksi pola candle'}[mode];

  const pnlPos = profit>=0;
  const wins = ftStatus?.totalWins??aiStatus?.totalWins??indicatorStatus?.totalWins??momentumStatus?.totalWins??0;
  const losses = ftStatus?.totalLosses??aiStatus?.totalLosses??indicatorStatus?.totalLosses??momentumStatus?.totalLosses??0;
  const total = ftStatus?.totalTrades??aiStatus?.totalTrades??indicatorStatus?.totalTrades??momentumStatus?.totalTrades??0;
  const wr = total>0?Math.round((wins/total)*100):null;

  // Kotlin BotControlCard: botState = RUNNING / PAUSED / STOPPED
  const isSchedRunning2 = scheduleStatus?.botState==='RUNNING';
  const isSchedPaused2  = scheduleStatus?.botState==='PAUSED';
  const canPauseBot  = mode==='schedule' ? isSchedRunning2 : isActive;
  const canResumeBot = mode==='schedule' ? isSchedPaused2  : false;
  const canStopBot   = isActive;

  // Dynamic colors: green=running, amber=paused, red=stopped
  const stateCol = canResumeBot ? C.amber : canStopBot ? C.cyan : C.coral;
  const stateLabel = canResumeBot ? 'Paused' : canStopBot ? 'Running' : 'Stopped';
  const stateBg: Record<string,string> = {
    Running: 'rgba(16,185,129,0.12)', Paused: 'rgba(255,170,0,0.12)', Stopped: 'rgba(255,77,77,0.10)',
  };

  return (
    <Card style={{
      border:`1px solid ${C.bdr}`,
      boxShadow:`0 2px 0 rgba(255,255,255,0.05) inset, 0 10px 32px rgba(0,0,0,0.55), 0 3px 10px rgba(0,0,0,0.40), 0 0 0 1px rgba(0,0,0,0.20)`,
    }}>
      {/* ── Header: LEFT-aligned title + state pill + chevron ── */}
      <button onClick={()=>setOpen(!open)} style={{
        width:'100%',display:'flex',alignItems:'center',gap:10,
        padding:'16px 18px',background:'transparent',border:'none',
        borderBottom:open?`1px solid ${C.bdr}`:'none',cursor:'pointer',
        textAlign:'left',
      }}>
        {/* icon badge */}
        <div style={{width:34,height:34,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:`${ac}14`,border:`1px solid ${ac}30`}}>
          <span style={{color:ac}}>{modeIcon}</span>
        </div>
        {/* title — left-aligned */}
        <div style={{flex:1,minWidth:0,textAlign:'left',overflow:'hidden'}}>
          <span style={{fontSize:'clamp(11px,3.8vw,16px)',fontWeight:700,color:C.text,display:'block',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Bot Control</span>
          <span style={{fontSize:'clamp(8px,2.5vw,10px)',color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}>{modeLabel} · {modeSub}</span>
        </div>
        {/* state pill */}
        <div style={{
          display:'flex',alignItems:'center',gap:5,
          padding:'4px 10px',borderRadius:20,flexShrink:0,
          background:stateBg[stateLabel]??`${C.muted}10`,
          border:`0.5px solid ${stateCol}40`,
        }}>
          <span style={{
            width:8,height:8,borderRadius:'50%',flexShrink:0,
            background:stateCol,boxShadow:`0 0 5px ${stateCol}`,
            animation:canStopBot&&!canResumeBot?'ping 1.6s ease-in-out infinite':undefined,
          }}/>
          <span style={{fontSize:11,fontWeight:700,color:stateCol}}>{stateLabel}</span>
        </div>
        <div style={{width:22,height:22,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',background:C.card2,border:`1px solid ${C.bdr}`,flexShrink:0}}>
          {open?<ChevronUp style={{width:11,height:11,color:C.muted}}/>:<ChevronDown style={{width:11,height:11,color:C.muted}}/>}
        </div>
      </button>

      {open&&(
        <div style={{padding:'16px 18px 18px',display:'flex',flexDirection:'column',gap:12}}>

          {/* ── Always Signal badge ── */}
          {(()=>{
            const schAS = mode==='schedule'&&(scheduleStatus as any)?.alwaysSignalActive;
            const ftAS  = (mode==='fastrade'||mode==='ctc')&&(ftStatus as any)?.alwaysSignalActive;
            const aiAS  = mode==='aisignal'&&aiStatus?.alwaysSignalStatus?.isActive;
            const indAS = mode==='indicator'&&(indicatorStatus as any)?.alwaysSignalActive;
            const momAS = mode==='momentum'&&(momentumStatus as any)?.alwaysSignalActive;
            const anyAS = schAS||ftAS||aiAS||indAS||momAS;
            if(!anyAS||!isActive) return null;
            const step  = (scheduleStatus as any)?.alwaysSignalStep
              ?? (ftStatus as any)?.alwaysSignalStep
              ?? aiStatus?.alwaysSignalStatus?.currentStep
              ?? (indicatorStatus as any)?.alwaysSignalStep
              ?? (momentumStatus as any)?.alwaysSignalStep ?? 1;
            const totalLoss = (scheduleStatus as any)?.alwaysSignalLossState?.totalLoss
              ?? aiStatus?.alwaysSignalStatus?.totalLoss ?? 0;
            return <AlwaysSignalBadge isActive={true} step={step} maxSteps={martingale.maxStep} totalLoss={totalLoss} accent={C.amber}/>;
          })()}

          {/* ── Error ── */}
          {error&&(
            <div style={{display:'flex',gap:8,padding:'10px 12px',borderRadius:12,background:'rgba(255,69,58,0.07)',border:'1px solid rgba(255,69,58,0.18)'}}>
              <AlertCircle style={{width:12,height:12,flexShrink:0,marginTop:1,color:C.coral}}/>
              <p style={{fontSize:11,color:C.coral}}>{error}</p>
            </div>
          )}

          {/* ── Action buttons only, no P&L ── */}
          {isActive ? (
            <div style={{display:'flex',gap:10}}>
              {/* Pause / Resume */}
              <button onClick={canResumeBot?onResume:onPause} disabled={!canPauseBot&&!canResumeBot} style={{
                flex:1,height:48,borderRadius:14,cursor:'pointer',
                border:`0.5px solid ${canResumeBot?C.cyan:C.amber}`,
                background:canResumeBot?`rgba(16,185,129,0.55)`:`rgba(251,191,36,0.75)`,
                color:'#fff',fontSize:13,fontWeight:700,letterSpacing:'0.02em',
                display:'flex',alignItems:'center',justifyContent:'center',gap:7,
                boxShadow:`0 1px 0 rgba(255,255,255,0.18) inset, 0 8px 24px ${canResumeBot?`${C.cyan}55`:`${C.amber}55`}, 0 3px 8px rgba(0,0,0,0.40)`,
                opacity:(!canPauseBot&&!canResumeBot)?0.45:1,transition:'opacity 0.2s',
              }}>
                {canResumeBot?<><PlayCircle style={{width:16,height:16}}/> Resume</>:<><PauseCircle style={{width:16,height:16}}/> Pause</>}
              </button>
              {/* Stop */}
              <button onClick={onStop} disabled={!canStopBot||isLoading} style={{
                flex:1,height:48,borderRadius:14,cursor:'pointer',
                border:`0.5px solid ${C.coral}`,
                background:`rgba(239,68,68,0.60)`,
                color:'#fff',fontSize:13,fontWeight:700,letterSpacing:'0.02em',
                display:'flex',alignItems:'center',justifyContent:'center',gap:7,
                boxShadow:`0 1px 0 rgba(255,255,255,0.18) inset, 0 8px 24px ${C.coral}50, 0 3px 8px rgba(0,0,0,0.40)`,
                opacity:(!canStopBot||isLoading)?0.45:1,transition:'opacity 0.2s',
              }}>
                <StopCircle style={{width:16,height:16}}/> Stop
              </button>
            </div>
          ) : (
            /* Idle — simple start button */
            <>
              <button onClick={onStart} disabled={isLoading||!canStart||isBelowMin} style={{
                width:'100%',height:50,borderRadius:14,cursor:'pointer',
                border:`1px solid ${ac}55`,
                background:`linear-gradient(180deg,${ac}CC,${ac}AA)`,
                color:'#fff',fontSize:14,fontWeight:700,letterSpacing:'0.02em',
                display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                boxShadow:`0 1px 0 rgba(255,255,255,0.18) inset, 0 10px 28px ${ac}55, 0 3px 10px rgba(0,0,0,0.45)`,
                opacity:(isLoading||!canStart||isBelowMin)?0.45:1,transition:'opacity 0.2s',
              }}>
                <PlayCircle style={{width:18,height:18}}/> Start
              </button>
              {!canStart&&!error&&!isBelowMin&&(
                <p style={{fontSize:10,textAlign:'center',color:C.muted}}>
                  {mode==='schedule'?T('dashboard.control.startPromptSchedule'):T('dashboard.control.startPrompt')}
                </p>
              )}
              {isBelowMin&&(
                <p style={{fontSize:10,textAlign:'center',color:C.coral}}>
                  ✗ {T('dashboard.control.amountBelowMin')} Rp {IDR_MIN_DISPLAY.toLocaleString('id-ID')}
                </p>
              )}
            </>
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
  const { t, language } = useLanguage();
  const { isDarkMode } = useDarkMode();
  const colors = useMemo(() => getColors(isDarkMode), [isDarkMode]);
  // ✅ FIX: Update module-level C so all sub-components use the correct theme
  C = colors;
  T = t;
  const isMounted = useRef(true);
  useEffect(()=>{isMounted.current=true;return()=>{isMounted.current=false;};},[]);

  // State
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
  const [todayProfitData,setTodayProfitData] = useState<TodayProfitSummary|null>(null);

  const [tradingMode,setTradingMode] = useState<TradingMode>('schedule');
  const [error,setError] = useState<string|null>(null);
  const [actionLoading,setActionLoading] = useState(false);
  const [orderModalOpen,setOrderModalOpen] = useState(false);
  const [addOrderLoading,setAddOrderLoading] = useState(false);
  // ✅ FIX: Deteksi device SEKALI saat mount, tidak pakai resize listener
  // (resize listener → re-render saat keyboard muncul di mobile)
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

  const [mobileSessionOpen,setMobileSessionOpen] = useState(false);
  const [assetPickerOpen,setAssetPickerOpen] = useState(false);
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

  // ✅ FIX: Device detection sekali saat mount saja
  useEffect(()=>{
    const w = window.innerWidth;
    setDeviceType(w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop');
  },[]);

  const loadAll = useCallback(async(silent=false)=>{
    if(!silent)setIsLoading(true);
    try{
      const [assRes,balRes,schRes,ordRes,logRes,ftRes,ftLogRes,aiRes,aiPendRes,indRes,momRes,tpRes] = await Promise.allSettled([
        api.getAssets(),api.balance(),api.scheduleStatus(),
        api.getOrders(),
        api.scheduleLogs(500),
        api.fastradeStatus(),
        api.fastradeLogs(500),
        api.aiSignalStatus(),api.aiSignalPendingOrders(),
        api.indicatorStatus(),api.momentumStatus(),
        api.todayProfit(),
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
      if(tpRes.status==='fulfilled')setTodayProfitData(tpRes.value);

      // ✅ FIX: Auto-detect mode aktif hanya saat load pertama (bukan silent)
      if (!silent) {
        const ftData  = ftRes.status  === 'fulfilled' ? ftRes.value  : null;
        const aiData  = aiRes.status  === 'fulfilled' ? aiRes.value  : null;
        const indData = indRes.status === 'fulfilled' ? indRes.value : null;
        const momData = momRes.status === 'fulfilled' ? momRes.value : null;
        const schData = schRes.status === 'fulfilled' ? schRes.value : null;

        if (ftData?.isRunning) {
          setTradingMode(ftData.mode === 'CTC' ? 'ctc' : 'fastrade');
        } else if (aiData?.botState === 'RUNNING' || (!aiData?.botState && aiData?.isActive)) {
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
      if(!silent&&isMounted.current)setError(T('dashboard.errors.loadFailed'));
    }finally{if(!silent&&isMounted.current)setIsLoading(false);}
  },[router]);

  // ✅ FIX: Auth check menggunakan isSessionValid (Capacitor-safe)
  useEffect(()=>{
    const init = async () => {
      const sessionValid = await isSessionValid();
      if(!sessionValid){ router.push('/login'); return; }
      loadAll();
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ✅ Polling interval 10 detik
  useEffect(()=>{
    const iv=setInterval(async()=>{
      const results = await Promise.allSettled([
        api.scheduleStatus(),api.fastradeStatus(),api.getOrders(),
        api.fastradeLogs(500),
        api.aiSignalStatus(),api.aiSignalPendingOrders(),
        api.indicatorStatus(),api.momentumStatus(),
        api.realtimeProfit(),
      ]);
      if(!isMounted.current)return;
      const [sRes,fRes,oRes,ftlRes,aiRes,aiPendRes,indRes,momRes,tpRes] = results;
      if(sRes.status==='fulfilled')setScheduleStatus(sRes.value);
      if(fRes.status==='fulfilled')setFtStatus(fRes.value);
      if(oRes.status==='fulfilled')setScheduleOrders(oRes.value);
      if(ftlRes.status==='fulfilled')setFtLogs(ftlRes.value);
      if(aiRes.status==='fulfilled')setAiStatus(aiRes.value);
      if(aiPendRes.status==='fulfilled')setAiPendingOrders(aiPendRes.value);
      if(indRes.status==='fulfilled')setIndicatorStatus(indRes.value);
      if(momRes.status==='fulfilled')setMomentumStatus(momRes.value);
      if(tpRes.status==='fulfilled')setTodayProfitData(tpRes.value);
      const balRes = await api.balance().catch(()=>null);
      if(balRes&&isMounted.current)setBalance(balRes);
    },10000);
    return()=>clearInterval(iv);
  },[]); // eslint-disable-line

  const botState = scheduleStatus?.botState??'IDLE';
  const isSchedRunning = botState==='RUNNING', isSchedPaused = botState==='PAUSED';
  const isFtRunning = ftStatus?.isRunning??false;
  const isAIRunning = aiStatus?.botState === 'RUNNING' || (!aiStatus?.botState && aiStatus?.isActive === true);
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
    // ✅ Prioritaskan data dari /today-profit API (aggregates semua mode)
    if(todayProfitData) return todayProfitData.totalPnL;
    // Fallback: hitung lokal dari schedule + fastrade logs
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let total = 0;
    for(const log of scheduleLogs){
      if((log.executedAt??0)>=cutoff&&log.profit!=null&&log.isDemoAccount===isDemo) total+=log.profit;
    }
    for(const log of ftLogs){
      if((log.executedAt??0)>=cutoff&&log.profit!=null&&log.isDemoAccount===isDemo) total+=log.profit;
    }
    return total;
  },[todayProfitData,scheduleLogs,ftLogs,isDemo]);

  const isBelowMin = amount > 0 && amount < IDR_MIN_DISPLAY;

  const handleModeChange = (m:TradingMode)=>{
    if(m===tradingMode)return;
    if(blockedModes.includes(m)){showBlock(T('dashboard.modePicker.stopActiveFirst'));return;}
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
          candleSabitEnabled:true,
          dojiTerjepitEnabled:true,
          dojiPembatalanEnabled:true,
          bbSarBreakEnabled:true,
          baseAmount:amount*100,multiplierValue:martingale.multiplier,maxSteps:martingale.maxStep,
        });
        await api.momentumStart();
      }
      await loadAll(true);
    }catch(e:any){setError(e?.message??T('dashboard.errors.startFailed'));}
    finally{setActionLoading(false);}
  };

  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);

  const handleStop = async()=>{
    setStopConfirmOpen(true);
  };

  const handleStopConfirmed = async()=>{
    setStopConfirmOpen(false);
    setActionLoading(true);setError(null);
    try{
      if(tradingMode==='schedule') await api.scheduleStop();
      else if(tradingMode==='fastrade'||tradingMode==='ctc') await api.fastradeStop();
      else if(tradingMode==='aisignal') await api.aiSignalStop();
      else if(tradingMode==='indicator') await api.indicatorStop();
      else if(tradingMode==='momentum') await api.momentumStop();
      await loadAll(true);
    }catch(e:any){setError(e?.message??T('dashboard.errors.stopFailed'));}
    finally{setActionLoading(false);}
  };

  const handlePause  = async()=>{setActionLoading(true);try{await api.schedulePause();await loadAll(true);}catch(e:any){setError(e?.message??T('dashboard.errors.pauseFailed'));}finally{setActionLoading(false);}};
  const handleResume = async()=>{setActionLoading(true);try{await api.scheduleResume();await loadAll(true);}catch(e:any){setError(e?.message??T('dashboard.errors.resumeFailed'));}finally{setActionLoading(false);}};

  const handleAddOrders = async(input:string)=>{
    const validLines = input
      .split('\n')
      .map(l => {
        const trimmed = l.trim();
        const match = trimmed.match(/^(\d{1,2}[:.]\d{2})\s+(call|put|buy|sell|b|s|c|p)\b/i);
        if (!match) return null;
        const time = match[1].replace('.', ':').padStart(5, '0');
        const raw = match[2].toLowerCase();
        const trend = (raw === 'call' || raw === 'buy' || raw === 'c' || raw === 'b') ? 'call' : 'put';
        return `${time} ${trend}`;
      })
      .filter(Boolean)
      .join('\n');
    if (!validLines) return;
    setAddOrderLoading(true);
    try{
      await api.addOrders(validLines);
      const newOrders=await api.getOrders();
      setScheduleOrders(newOrders);
    }
    catch(e:any){setError(e?.message??T('dashboard.errors.addOrderFailed'));}
    finally{setAddOrderLoading(false);}
  };

  const g = deviceType==='desktop'?20:deviceType==='tablet'?18:16;
  const px = 16;

  const TopCards = <TodayProfitCard data={todayProfitData} localProfit={profitToday} isLoading={isLoading} flash={flash} t={t}/>;

  const InfoRow = (
    <div style={{display:'grid',gridTemplateColumns:deviceType==='desktop'?'repeat(3,1fr)':deviceType==='tablet'?'repeat(2,1fr)':'1fr 1fr',gap:g}}>
      <AssetCard asset={selectedAsset} mode={tradingMode} isLoading={isLoading} t={t} onOpenPicker={()=>setAssetPickerOpen(true)} disabled={isActiveMode}/>
      <BalanceCard balance={balance} accountType={isDemo?'demo':'real'} isLoading={isLoading} t={t}/>
      {deviceType==='desktop'&&(
        <Card style={{padding:'11px 14px'}}>
          <p style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.08em',color:C.muted,marginBottom:5}}>{t('dashboard.tradingMode')}</p>
          <p style={{fontSize:16,fontWeight:700,color:isActiveMode?modeAccent(tradingMode):C.muted}}>
            {{schedule:'Signal Mode',fastrade:'Fastrade FTT Mode',ctc:'Fastrade CTC',aisignal:'AI Signal Mode',indicator:'Analysis Strategy Mode',momentum:'Momentum Mode'}[tradingMode]}
          </p>
          <div style={{marginTop:6}}>
            <StatusChip col={isActiveMode?modeAccent(tradingMode):C.muted} label={isActiveMode?t('dashboard.running'):t('common.standby')}/>
          </div>
        </Card>
      )}
    </div>
  );

  const ModeSession = (fillH:boolean, compact?:boolean, onViewSession?:()=>void, startStopButton?:React.ReactNode) => (
    <ModeSessionPanel
      mode={tradingMode} onModeChange={handleModeChange} locked={isActiveMode} blockedModes={blockedModes}
      orders={scheduleOrders} logs={scheduleLogs} onOpenModal={()=>setOrderModalOpen(true)} isRunning={isSchedRunning}
      ftStatus={ftStatus} ftLogs={ftLogs} ftLoading={false}
      aiStatus={aiStatus} aiPending={aiPendingOrders}
      indicatorStatus={indicatorStatus}
      momentumStatus={momentumStatus}
      fillHeight={fillH}
      compact={compact}
      onViewSession={onViewSession}
      startStopButton={startStopButton}
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
      martingale={martingale}
    />
  );

  const ac = modeAccent(tradingMode);
  const mobileStartStopBtn = (
    <button
      onClick={isActiveMode ? handleStop : handleStart}
      disabled={actionLoading || (!isActiveMode && !canStart)}
      style={{
        width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:6,
        padding:'9px 0',borderRadius:10,
        background: actionLoading
          ? (isActiveMode ? `${C.coral}20` : `${ac}20`)
          : isActiveMode
            ? `linear-gradient(135deg,${C.coral}d0,${C.coral}90)`
            : `linear-gradient(135deg,${ac}d0,${ac}90)`,
        border:`1px solid ${isActiveMode ? C.coral : ac}55`,
        color:'#fff',
        fontSize:12,fontWeight:800,letterSpacing:'0.05em',
        cursor: actionLoading || (!isActiveMode && !canStart) ? 'not-allowed' : 'pointer',
        opacity: !isActiveMode && !canStart ? 0.45 : 1,
        boxShadow: actionLoading ? 'none' : isActiveMode
          ? `0 3px 12px ${C.coral}40`
          : `0 3px 12px ${ac}40`,
        transition:'all 0.2s ease',
      }}
    >
      {actionLoading && <div style={{width:12,height:12,border:`2px solid rgba(255,255,255,0.3)`,borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>}
      {actionLoading ? T('common.loading') : isActiveMode ? 'Stop' : 'Start'}
    </button>
  );


  return (
    <div style={{minHeight:'100%',background:colors.bg,paddingBottom:88,color:colors.text,transition:'background 0.3s, color 0.3s'}}>
      {/* Asset Picker Modal — top level */}
      <PickerModal
        open={assetPickerOpen}
        onClose={()=>setAssetPickerOpen(false)}
        title={T('dashboard.selectAsset')}
        options={assets.map(a=>({value:a.ric,label:a.name,sub:`${a.ric} · ${a.profitRate}%`,icon:a.iconUrl}))}
        value={selectedRic}
        searchable
        onSelect={v=>{const a=assets.find(x=>x.ric===v);if(a)setSelectedRic(a.ric);setAssetPickerOpen(false);}}
      />
      {/* Stop Confirmation Modal */}
      {stopConfirmOpen && (
        <div style={{position:'fixed',inset:0,zIndex:90,display:'flex',alignItems:'center',justifyContent:'center',padding:20,animation:'fade-in 0.18s ease'}}>
          <div onClick={()=>setStopConfirmOpen(false)} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(14px)',WebkitBackdropFilter:'blur(14px)'}}/>
          <div style={{
            position:'relative',width:'100%',maxWidth:320,
            background:'linear-gradient(160deg,#1c1c1e 0%,#141416 100%)',
            borderRadius:18,border:'1px solid rgba(255,255,255,0.10)',
            overflow:'hidden',
            animation:'slide-up 0.24s cubic-bezier(0.32,0.72,0,1)',
            boxShadow:'0 20px 60px rgba(0,0,0,0.6)',
          }}>
            {/* Icon + Title + Desc */}
            <div style={{padding:'28px 24px 20px',textAlign:'center',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
              <div style={{width:52,height:52,borderRadius:16,background:'rgba(255,69,58,0.12)',border:'1px solid rgba(255,69,58,0.25)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
                <StopCircle style={{width:24,height:24,color:C.coral}}/>
              </div>
              <p style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:6}}>{T('dashboard.stopConfirm.title')}</p>
              <p style={{fontSize:13,color:C.muted,lineHeight:1.5}}>
                {T('dashboard.stopConfirm.message')}
              </p>
            </div>
            {/* Action buttons — Apple-style */}
            <div style={{display:'flex',flexDirection:'column'}}>
              <button
                onClick={handleStopConfirmed}
                style={{
                  padding:'15px 20px',fontSize:16,fontWeight:600,
                  color:C.coral,background:'transparent',border:'none',
                  borderBottom:'1px solid rgba(255,255,255,0.07)',
                  cursor:'pointer',letterSpacing:'-0.01em',
                }}
              >
                {T('dashboard.stopConfirm.confirm')}
              </button>
              <button
                onClick={()=>setStopConfirmOpen(false)}
                style={{
                  padding:'15px 20px',fontSize:16,fontWeight:400,
                  color:C.text,background:'transparent',border:'none',
                  cursor:'pointer',letterSpacing:'-0.01em',
                }}
              >
                {T('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes ping        { 0%{transform:scale(1);opacity:1} 80%,100%{transform:scale(2);opacity:0} }
        @keyframes slide-up    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fade-in     { from{opacity:0} to{opacity:1} }
        @keyframes profit-slide-up   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes profit-slide-down { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes win-flash   { 0%{box-shadow:0 0 0 0 rgba(41,151,255,0)} 15%{box-shadow:0 0 0 4px rgba(41,151,255,0.35)} 100%{box-shadow:0 0 0 0 rgba(41,151,255,0)} }
        @keyframes lose-flash  { 0%{box-shadow:0 0 0 0 rgba(255,69,58,0)} 15%{box-shadow:0 0 0 4px rgba(255,69,58,0.35)} 100%{box-shadow:0 0 0 0 rgba(255,69,58,0)} }

        .ds-card {
          background: ${isDarkMode ? C.card : '#ffffff'};
          border: 1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};
          border-radius: 14px;
          box-shadow: ${isDarkMode ? '0 4px 20px rgba(0,0,0,0.50), 0 1px 4px rgba(0,0,0,0.30)' : '0 1px 3px rgba(0,0,0,0.04)'};
          transition: background 0.3s, border-color 0.3s, box-shadow 0.3s;
        }

        @media (max-width: 767px) {
          .ds-card, .ds-card:hover {
            border: 0.5px solid ${isDarkMode ? 'rgba(20,184,166,0.35)' : 'rgba(20,184,166,0.28)'} !important;
            box-shadow: ${isDarkMode
              ? '0 1px 0 rgba(255,255,255,0.08) inset, 0 8px 32px rgba(0,0,0,0.18), 0 0 40px rgba(20,184,166,0.05), 0 2px 8px rgba(0,0,0,0.12)'
              : '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px rgba(0,0,0,0.06), 0 0 28px rgba(20,184,166,0.04), 0 2px 6px rgba(0,0,0,0.05)'
            } !important;
            transform: none !important;
          }
        }

        .ds-input {
          width: 100%;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13px;
          background: ${isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(16,185,129,0.03)'};
          border: 1px solid ${isDarkMode ? 'rgba(41,151,255,0.18)' : 'rgba(16,185,129,0.15)'};
          color: ${isDarkMode ? '#ffffff' : '#1C1C1E'};
          outline: none;
          font-family: inherit;
          transition: border-color 0.15s, background 0.3s, color 0.3s;
          resize: vertical;
          box-sizing: border-box;
        }
        .ds-input:focus { border-color: ${isDarkMode ? 'rgba(41,151,255,0.45)' : 'rgba(16,185,129,0.45)'}; }
        .ds-input::placeholder { color: ${isDarkMode ? 'rgba(255,255,255,0.28)' : 'rgba(60,60,67,0.40)'}; }

        .schedule-item { transition: background 0.15s; }
        .schedule-item:hover { background: ${isDarkMode ? 'rgba(41,151,255,0.04)' : 'rgba(16,185,129,0.06)'} !important; }
      `}</style>

      <OrderInputModal
        open={orderModalOpen}
        onClose={()=>setOrderModalOpen(false)}
        orders={scheduleOrders}
        logs={scheduleLogs}
        onAdd={handleAddOrders}
        onDelete={async(id)=>{
          try{await api.deleteOrder(id);setScheduleOrders(p=>p.filter(o=>o.id!==id));}
          catch(e:any){setError(e?.message??T('dashboard.errors.deleteOrderFailed'));}
        }}
        onClear={async()=>{await api.clearOrders();setScheduleOrders([]);}}
        loading={addOrderLoading}
        isRunning={isSchedRunning||isSchedPaused}
      />
      {deviceType==='mobile'&&(
        <MobileSessionSheet
          open={mobileSessionOpen}
          onClose={()=>setMobileSessionOpen(false)}
          mode={tradingMode}
          ftStatus={ftStatus} ftLogs={ftLogs}
          aiStatus={aiStatus} aiPending={aiPendingOrders}
          indicatorStatus={indicatorStatus}
          momentumStatus={momentumStatus}
          orders={scheduleOrders} logs={scheduleLogs}
          onOpenModal={()=>setOrderModalOpen(true)}
          isRunning={isSchedRunning}
        />
      )}

      <div style={{maxWidth:1280,margin:'0 auto',padding:`0 ${px}px 0`}}>
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

        {/* ── DESKTOP ── */}
        {deviceType==='desktop'&&(
          <div style={{paddingTop:20,paddingBottom:32,display:'flex',flexDirection:'column',gap:16}}>

            {/* ── TOP INFO STRIP ─────────────────────────────────────────── */}
            <div style={{
              display:'grid',
              gridTemplateColumns:'1fr 1fr 1fr 1fr',
              gap:12,
              alignItems:'stretch',
            }}>
              {/* Asset */}
              <div style={{
                display:'flex',alignItems:'center',gap:12,
                padding:'12px 16px',borderRadius:14,
                background:isDarkMode?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.9)',
                border:`1px solid ${isDarkMode?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}`,
                backdropFilter:'blur(8px)',
              }}>
                <div style={{
                  width:38,height:38,borderRadius:10,flexShrink:0,overflow:'hidden',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  background:`${modeAccent(tradingMode)}12`,
                  border:`1px solid ${modeAccent(tradingMode)}22`,
                }}>
                  {selectedAsset?.iconUrl
                    ? <img src={selectedAsset.iconUrl} alt={selectedRic} crossOrigin="anonymous" style={{width:'100%',height:'100%',objectFit:'contain',padding:6}}/>
                    : <span style={{fontSize:12,fontWeight:700,color:modeAccent(tradingMode)}}>{selectedRic?selectedRic.slice(0,3).toUpperCase():'+'}</span>
                  }
                </div>
                <div style={{minWidth:0,flex:1}}>
                  <p style={{fontSize:10,fontWeight:500,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3}}>{T('dashboard.asset')}</p>
                  <p style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
  {selectedAsset?.name ?? <span style={{color:C.muted,fontWeight:400,fontSize:12}}>{T('dashboard.notSelected')}</span>}
                  </p>
                  {selectedAsset&&<p style={{fontSize:10,color:C.muted,marginTop:2}}>{selectedAsset.profitRate}% profit rate</p>}
                </div>
              </div>

              {/* Balance */}
              <div style={{
                display:'flex',alignItems:'center',gap:12,
                padding:'12px 16px',borderRadius:14,
                background:isDarkMode?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.9)',
                border:`1px solid ${isDarkMode?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}`,
              }}>
                {(()=>{
                  const rawAmt = isDemo?(balance?.demo_balance??balance?.balance??0):(balance?.real_balance??balance?.balance??0);
                  const amt = rawAmt/100;
                  const col = isDemo?C.amber:C.cyan;
                  return (
                    <>
                      <div style={{width:38,height:38,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:`${col}10`,border:`1px solid ${col}20`}}>
                        <span style={{fontSize:16}}>💳</span>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}>
                          <p style={{fontSize:10,fontWeight:500,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>Saldo</p>
                          <span style={{fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:99,color:col,background:`${col}10`,border:`1px solid ${col}25`}}>{isDemo?'Demo':'Real'}</span>
                        </div>
                        {isLoading?<div style={{height:18,width:90,borderRadius:4,background:C.faint}}/>
                          :<p style={{fontSize:15,fontWeight:700,color:col,lineHeight:1,letterSpacing:'-0.01em'}}>{Math.round(amt).toLocaleString('id-ID')}</p>
                        }
                        <p style={{fontSize:10,color:C.muted,marginTop:2}}>{balance?.currency??'IDR'}</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Mode + Status */}
              <div style={{
                display:'flex',alignItems:'center',gap:12,
                padding:'12px 16px',borderRadius:14,
                background:isActiveMode?`${modeAccent(tradingMode)}08`:isDarkMode?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.9)',
                border:`1px solid ${isActiveMode?`${modeAccent(tradingMode)}25`:isDarkMode?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}`,
                transition:'all 0.3s ease',
              }}>
                <div style={{
                  width:38,height:38,borderRadius:10,flexShrink:0,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  background:`${modeAccent(tradingMode)}12`,border:`1px solid ${modeAccent(tradingMode)}22`,
                  position:'relative',
                }}>
                  <span style={{color:modeAccent(tradingMode)}}>
                    {{schedule:<Calendar style={{width:17,height:17}}/>,fastrade:<Zap style={{width:17,height:17}}/>,ctc:<Copy style={{width:17,height:17}}/>,aisignal:<Radio style={{width:17,height:17}}/>,indicator:<BarChart style={{width:17,height:17}}/>,momentum:<Waves style={{width:17,height:17}}/>}[tradingMode]}
                  </span>
                  {isActiveMode&&<span style={{position:'absolute',top:-3,right:-3,width:8,height:8,borderRadius:'50%',background:modeAccent(tradingMode),boxShadow:`0 0 6px ${modeAccent(tradingMode)}`,animation:'ping 1.6s ease-in-out infinite'}}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:10,fontWeight:500,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3}}>Mode</p>
                  <p style={{fontSize:14,fontWeight:700,color:isActiveMode?modeAccent(tradingMode):C.text,lineHeight:1}}>
                    {{schedule:'Signal Mode',fastrade:'Fastrade FTT Mode',ctc:'Fastrade CTC',aisignal:'AI Signal Mode',indicator:'Analysis Strategy Mode',momentum:'Momentum Mode'}[tradingMode]}
                  </p>
                  <p style={{fontSize:10,marginTop:2,color:isActiveMode?modeAccent(tradingMode):C.muted}}>
                    {isActiveMode?'● '+T('dashboard.running'):'○ '+T('common.standby')}
                  </p>
                </div>
              </div>

              {/* Today P&L */}
              <div style={{
                display:'flex',alignItems:'center',gap:12,
                padding:'12px 16px',borderRadius:14,
                background:isDarkMode?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.9)',
                border:`1px solid ${isDarkMode?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}`,
              }}>
                {(()=>{
                  const pnl = todayProfitData?.totalPnL ?? profitToday;
                  const isPos = pnl >= 0;
                  const col = isPos?C.cyan:C.coral;
                  const wr = todayProfitData?.winRate;
                  return (
                    <>
                      <div style={{width:38,height:38,borderRadius:10,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:`${col}10`,border:`1px solid ${col}20`}}>
                        {isPos?<TrendingUp style={{width:17,height:17,color:col}}/>:<TrendingDown style={{width:17,height:17,color:col}}/>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                          <p style={{fontSize:10,fontWeight:500,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>Profit Hari Ini</p>
                          {wr!=null&&<span style={{fontSize:9,fontWeight:700,color:wr>=50?C.cyan:C.coral}}>{wr.toFixed(0)}% WR</span>}
                        </div>
                        {isLoading?<div style={{height:18,width:90,borderRadius:4,background:C.faint}}/>
                          :<p style={{fontSize:15,fontWeight:700,color:col,lineHeight:1,letterSpacing:'-0.01em',fontFamily:'monospace'}}>
                            {isPos?'+':'-'}{Math.round(Math.abs(pnl/100)).toLocaleString('id-ID')}
                          </p>
                        }
                        <p style={{fontSize:10,color:C.muted,marginTop:2}}>
                          {todayProfitData?`${todayProfitData.totalTrades} trade · ${todayProfitData.totalWins}W ${todayProfitData.totalLosses}L`:'24 jam terakhir'}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

            </div>

            {/* ── MAIN 2-COLUMN LAYOUT ───────────────────────────────────── */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:16,alignItems:'start'}}>

              {/* LEFT: Chart hero + session strip */}
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {/* Chart */}
                <div style={{
                  borderRadius:16,overflow:'hidden',
                  background:isDarkMode?'rgba(255,255,255,0.02)':'rgba(255,255,255,0.95)',
                  border:`1px solid ${isDarkMode?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}`,
                  padding:4,
                }}>
                  {/* Clock header */}
                  <div style={{
                    display:'flex',alignItems:'center',justifyContent:'space-between',
                    padding:'10px 14px 8px',
                    borderBottom:`1px solid ${isDarkMode?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)'}`,
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <Activity style={{width:13,height:13,color:C.coral}}/>
                      <span style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',color:C.muted}}>Waktu Lokal</span>
                      <span style={{width:5,height:5,borderRadius:'50%',background:C.coral,boxShadow:`0 0 5px ${C.coral}80`,animation:'ping 1.6s ease-in-out infinite'}}/>
                    </div>
                    <RealtimeClockDesktop/>
                  </div>
                  <ChartCard assetSymbol={selectedRic} height={340}/>
                </div>

                {/* Session stat strip */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                  {(()=>{
                    const ac = modeAccent(tradingMode);
                    const wins   = ftStatus?.totalWins??aiStatus?.totalWins??indicatorStatus?.totalWins??momentumStatus?.totalWins??0;
                    const losses = ftStatus?.totalLosses??aiStatus?.totalLosses??indicatorStatus?.totalLosses??momentumStatus?.totalLosses??0;
                    const total  = wins+losses;
                    const wr     = total>0?Math.round((wins/total)*100):null;
                    const pnlPos = sessionPnL>=0;
                    const nextT  = (scheduleStatus as any)?.nextOrderTime;
                    const nextS  = (scheduleStatus as any)?.nextOrderInSeconds;
                    const asActive = (scheduleStatus as any)?.alwaysSignalActive
                      ||(ftStatus as any)?.alwaysSignalActive
                      ||aiStatus?.alwaysSignalStatus?.isActive
                      ||(indicatorStatus as any)?.alwaysSignalActive
                      ||(momentumStatus as any)?.alwaysSignalActive;
                    const asStep = (scheduleStatus as any)?.alwaysSignalStep
                      ??(ftStatus as any)?.alwaysSignalStep
                      ??aiStatus?.alwaysSignalStatus?.currentStep
                      ??(indicatorStatus as any)?.alwaysSignalStep
                      ??(momentumStatus as any)?.alwaysSignalStep??0;

                    const statCards = [
                      {
                        label:'Sesi P&L', icon:<TrendingUp style={{width:14,height:14}}/>,
                        value: isLoading?null:(pnlPos?'+':'-')+'Rp '+Math.round(Math.abs(sessionPnL/100)).toLocaleString('id-ID'),
                        col: pnlPos?ac:C.coral,
                      },
                      {
                        label:'W / L', icon:<BarChart2 style={{width:14,height:14}}/>,
                        value: isLoading?null:`${wins} / ${losses}`,
                        col: wins>losses?ac:losses>wins?C.coral:C.muted,
                      },
                      {
                        label:'Win Rate', icon:<Activity style={{width:14,height:14}}/>,
                        value: isLoading?null:wr!=null?`${wr}%`:'—',
                        col: wr!=null?(wr>=50?ac:C.coral):C.muted,
                      },
                      asActive&&asStep>0
                        ? {
                            label:'Always Signal', icon:<Zap style={{width:14,height:14}}/>,
                            value:`K${asStep}/${martingale.maxStep}`,
                            col:C.amber,
                          }
                        : nextT
                        ? {
                            label:'Signal Berikutnya', icon:<Timer style={{width:14,height:14}}/>,
                            value:`${nextT}${nextS!=null?' · '+nextS+'s':''}`,
                            col:ac,
                          }
                        : {
                            label:'Mode', icon:<Radio style={{width:14,height:14}}/>,
                            value:({schedule:'Signal Mode',fastrade:'Fastrade FTT Mode',ctc:'Fastrade CTC',aisignal:'AI Signal Mode',indicator:'Analysis Strategy Mode',momentum:'Momentum Mode'} as Record<string,string>)[tradingMode],
                            col:ac,
                          },
                    ];
                    return statCards.map((s,i)=>(
                      <div key={i} style={{
                        padding:'12px 14px',borderRadius:12,
                        background:isDarkMode?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.9)',
                        border:`1px solid ${isDarkMode?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}`,
                      }}>
                        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:6}}>
                          <span style={{color:s.col,opacity:0.7}}>{s.icon}</span>
                          <span style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',color:C.muted}}>{s.label}</span>
                        </div>
                        {s.value==null
                          ? <div style={{height:16,width:'70%',borderRadius:4,background:C.faint}}/>
                          : <p style={{fontSize:15,fontWeight:700,color:s.col,fontFamily:'monospace',letterSpacing:'-0.01em',lineHeight:1}}>{s.value}</p>
                        }
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* RIGHT SIDEBAR */}
              <div style={{display:'flex',flexDirection:'column',gap:12,position:'sticky',top:20}}>
                {ModeSession(false)}
                {SettingsCardEl}
                {ControlCardEl}
              </div>
            </div>
          </div>
        )}

        {/* ── TABLET ── */}
        {deviceType==='tablet'&&(
          <div style={{display:'flex',flexDirection:'column',gap:14,paddingTop:14}}>

            {/* ── ROW 1: Top info strip — 4 tiles ── */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>

              {/* Asset */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:14,background:isDarkMode?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.9)',border:`1px solid ${isDarkMode?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}`,cursor:!isActiveMode?'pointer':'default'}} onClick={!isActiveMode?()=>setAssetPickerOpen(true):undefined}>
                <div style={{width:34,height:34,borderRadius:9,flexShrink:0,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',background:`${modeAccent(tradingMode)}12`,border:`1px solid ${modeAccent(tradingMode)}22`}}>
                  {selectedAsset?.iconUrl
                    ?<img src={selectedAsset.iconUrl} alt={selectedRic} crossOrigin="anonymous" style={{width:'100%',height:'100%',objectFit:'contain',padding:5}}/>
                    :<span style={{fontSize:11,fontWeight:700,color:modeAccent(tradingMode)}}>{selectedRic?selectedRic.slice(0,3).toUpperCase():'+'}</span>
                  }
                </div>
                <div style={{minWidth:0,flex:1}}>
                  <p style={{fontSize:9,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3}}>{T('dashboard.asset')}</p>
                  <p style={{fontSize:13,fontWeight:700,color:C.text,lineHeight:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {selectedAsset?.name??<span style={{color:C.muted,fontWeight:400,fontSize:11}}>{T('dashboard.notSelected')}</span>}
                  </p>
                  {selectedAsset&&<p style={{fontSize:9,color:C.muted,marginTop:2}}>{selectedAsset.profitRate}% profit</p>}
                </div>
              </div>

              {/* Balance */}
              {(()=>{
                const rawAmt=isDemo?(balance?.demo_balance??balance?.balance??0):(balance?.real_balance??balance?.balance??0);
                const amt=rawAmt/100;
                const col=isDemo?C.amber:C.cyan;
                return (
                  <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:14,background:isDarkMode?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.9)',border:`1px solid ${isDarkMode?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}`}}>
                    <div style={{width:34,height:34,borderRadius:9,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:`${col}10`,border:`1px solid ${col}20`}}>
                      <Wallet style={{width:15,height:15,color:col}}/>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:3}}>
                        <p style={{fontSize:9,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>Saldo</p>
                        <span style={{fontSize:7,fontWeight:700,padding:'1px 4px',borderRadius:99,color:col,background:`${col}10`,border:`1px solid ${col}25`}}>{isDemo?'Demo':'Real'}</span>
                      </div>
                      {isLoading?<div style={{height:15,width:80,borderRadius:4,background:C.faint}}/>
                        :<p style={{fontSize:14,fontWeight:700,color:col,lineHeight:1,letterSpacing:'-0.01em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{Math.round(amt).toLocaleString('id-ID')}</p>
                      }
                      <p style={{fontSize:9,color:C.muted,marginTop:2}}>{balance?.currency??'IDR'}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Mode + Status */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:14,background:isActiveMode?`${modeAccent(tradingMode)}08`:isDarkMode?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.9)',border:`1px solid ${isActiveMode?`${modeAccent(tradingMode)}25`:isDarkMode?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}`,transition:'all 0.3s ease'}}>
                <div style={{width:34,height:34,borderRadius:9,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:`${modeAccent(tradingMode)}12`,border:`1px solid ${modeAccent(tradingMode)}22`,position:'relative'}}>
                  <span style={{color:modeAccent(tradingMode)}}>
                    {{schedule:<Calendar style={{width:15,height:15}}/>,fastrade:<Zap style={{width:15,height:15}}/>,ctc:<Copy style={{width:15,height:15}}/>,aisignal:<Radio style={{width:15,height:15}}/>,indicator:<BarChart style={{width:15,height:15}}/>,momentum:<Waves style={{width:15,height:15}}/>}[tradingMode]}
                  </span>
                  {isActiveMode&&<span style={{position:'absolute',top:-3,right:-3,width:7,height:7,borderRadius:'50%',background:modeAccent(tradingMode),boxShadow:`0 0 5px ${modeAccent(tradingMode)}`,animation:'ping 1.6s ease-in-out infinite'}}/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:9,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3}}>Mode</p>
                  <p style={{fontSize:13,fontWeight:700,color:isActiveMode?modeAccent(tradingMode):C.text,lineHeight:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                    {{schedule:'Signal Mode',fastrade:'Fastrade FTT Mode',ctc:'Fastrade CTC',aisignal:'AI Signal Mode',indicator:'Analysis Strategy Mode',momentum:'Momentum Mode'}[tradingMode]}
                  </p>
                  <p style={{fontSize:9,marginTop:2,color:isActiveMode?modeAccent(tradingMode):C.muted}}>
                    {isActiveMode?'● '+T('dashboard.running'):'○ '+T('common.standby')}
                  </p>
                </div>
              </div>

              {/* Today P&L */}
              {(()=>{
                const pnl=todayProfitData?.totalPnL??profitToday;
                const isPos=pnl>=0;
                const col=isPos?C.cyan:C.coral;
                const wr=todayProfitData?.winRate;
                return (
                  <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:14,background:isDarkMode?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.9)',border:`1px solid ${isDarkMode?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}`}}>
                    <div style={{width:34,height:34,borderRadius:9,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:`${col}10`,border:`1px solid ${col}20`}}>
                      {isPos?<TrendingUp style={{width:15,height:15,color:col}}/>:<TrendingDown style={{width:15,height:15,color:col}}/>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                        <p style={{fontSize:9,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>Profit Hari Ini</p>
                        {wr!=null&&<span style={{fontSize:8,fontWeight:700,color:wr>=50?C.cyan:C.coral}}>{wr.toFixed(0)}% WR</span>}
                      </div>
                      {isLoading?<div style={{height:15,width:80,borderRadius:4,background:C.faint}}/>
                        :<p style={{fontSize:14,fontWeight:700,color:col,lineHeight:1,letterSpacing:'-0.01em',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {isPos?'+':'−'}{Math.round(Math.abs(pnl/100)).toLocaleString('id-ID')}
                        </p>
                      }
                      <p style={{fontSize:9,color:C.muted,marginTop:2}}>
                        {todayProfitData?`${todayProfitData.totalTrades} trade · ${todayProfitData.totalWins}W ${todayProfitData.totalLosses}L`:'24 jam terakhir'}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── ROW 2: Main 2-column — Chart + Sidebar ── */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 288px',gap:12,alignItems:'start'}}>

              {/* LEFT: Chart hero + session stat strip */}
              <div style={{display:'flex',flexDirection:'column',gap:12}}>

                {/* Chart card — clock header compact, tidak melebar */}
                <div style={{borderRadius:16,overflow:'hidden',background:isDarkMode?'rgba(255,255,255,0.02)':'rgba(255,255,255,0.95)',border:`1px solid ${isDarkMode?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}`,padding:4}}>
                  {/* Clock header — compact, left-aligned, tidak space-between */}
                  <div style={{
                    display:'flex',alignItems:'center',gap:10,
                    padding:'9px 14px 9px',
                    borderBottom:`1px solid ${isDarkMode?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)'}`,
                  }}>
                    {/* Kiri: label + dot */}
                    <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                      <Activity style={{width:11,height:11,color:isActiveMode?modeAccent(tradingMode):C.coral}}/>
                      <span style={{fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.10em',color:C.muted}}>Waktu Lokal</span>
                      <span style={{width:5,height:5,borderRadius:'50%',flexShrink:0,background:isActiveMode?modeAccent(tradingMode):C.coral,boxShadow:`0 0 5px ${isActiveMode?modeAccent(tradingMode):C.coral}90`,animation:'ping 1.6s ease-in-out infinite'}}/>
                    </div>
                    {/* Divider vertikal */}
                    <div style={{width:1,height:20,background:isDarkMode?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)',flexShrink:0}}/>
                    {/* Clock — inline, compact, tidak stretching */}
                    <div style={{flexShrink:0}}>
                      <RealtimeClockDesktop/>
                    </div>
                  </div>
                  <ChartCard assetSymbol={selectedRic} height={280}/>
                </div>

                {/* Session stat strip — 4 mini tiles */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                  {(()=>{
                    const ac=modeAccent(tradingMode);
                    const wins=ftStatus?.totalWins??aiStatus?.totalWins??indicatorStatus?.totalWins??momentumStatus?.totalWins??0;
                    const losses=ftStatus?.totalLosses??aiStatus?.totalLosses??indicatorStatus?.totalLosses??momentumStatus?.totalLosses??0;
                    const total=wins+losses;
                    const wr=total>0?Math.round((wins/total)*100):null;
                    const pnlPos=sessionPnL>=0;
                    const nextT=(scheduleStatus as any)?.nextOrderTime;
                    const nextS=(scheduleStatus as any)?.nextOrderInSeconds;
                    const asActive=(scheduleStatus as any)?.alwaysSignalActive||(ftStatus as any)?.alwaysSignalActive||aiStatus?.alwaysSignalStatus?.isActive||(indicatorStatus as any)?.alwaysSignalActive||(momentumStatus as any)?.alwaysSignalActive;
                    const asStep=(scheduleStatus as any)?.alwaysSignalStep??(ftStatus as any)?.alwaysSignalStep??aiStatus?.alwaysSignalStatus?.currentStep??(indicatorStatus as any)?.alwaysSignalStep??(momentumStatus as any)?.alwaysSignalStep??0;
                    const statCards=[
                      {label:'Sesi P&L',icon:<TrendingUp style={{width:13,height:13}}/>,value:isLoading?null:(pnlPos?'+':'−')+'Rp '+Math.round(Math.abs(sessionPnL/100)).toLocaleString('id-ID'),col:pnlPos?ac:C.coral},
                      {label:'W / L',icon:<BarChart2 style={{width:13,height:13}}/>,value:isLoading?null:`${wins} / ${losses}`,col:wins>losses?ac:losses>wins?C.coral:C.muted},
                      {label:'Win Rate',icon:<Activity style={{width:13,height:13}}/>,value:isLoading?null:wr!=null?`${wr}%`:'—',col:wr!=null?(wr>=50?ac:C.coral):C.muted},
                      asActive&&asStep>0
                        ?{label:'Always Signal',icon:<Zap style={{width:13,height:13}}/>,value:`K${asStep}/${martingale.maxStep}`,col:C.amber}
                        :nextT
                        ?{label:'Signal Berikutnya',icon:<Timer style={{width:13,height:13}}/>,value:`${nextT}${nextS!=null?' · '+nextS+'s':''}`,col:ac}
                        :{label:'Mode',icon:<Radio style={{width:13,height:13}}/>,value:({schedule:'Signal Mode',fastrade:'Fastrade FTT Mode',ctc:'Fastrade CTC',aisignal:'AI Signal Mode',indicator:'Analysis Strategy Mode',momentum:'Momentum Mode'} as Record<string,string>)[tradingMode],col:ac},
                    ];
                    return statCards.map((s,i)=>(
                      <div key={i} style={{padding:'11px 13px',borderRadius:12,background:isDarkMode?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.9)',border:`1px solid ${isDarkMode?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)'}`}}>
                        <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:6}}>
                          <span style={{color:s.col,opacity:0.7}}>{s.icon}</span>
                          <span style={{fontSize:8,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.08em',color:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.label}</span>
                        </div>
                        {s.value==null
                          ?<div style={{height:14,width:'70%',borderRadius:4,background:C.faint}}/>
                          :<p style={{fontSize:14,fontWeight:700,color:s.col,fontFamily:'monospace',letterSpacing:'-0.01em',lineHeight:1,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.value}</p>
                        }
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* RIGHT: Sticky sidebar */}
              <div style={{display:'flex',flexDirection:'column',gap:12,position:'sticky',top:16}}>
                {ModeSession(false)}
                {SettingsCardEl}
                {ControlCardEl}
              </div>

            </div>
          </div>
        )}

        {/* ── MOBILE ── */}
        {deviceType==='mobile'&&(
          <div style={{display:'flex',flexDirection:'column',gap:g}}>
            {/* Header Image - Fullwidth, no top margin */}
            {/* Header Image - Full bleed, breaks out of padding */}
            <div className="header-shimmer-wrap" style={{marginLeft:`-${px}px`,marginRight:`-${px}px`,marginTop:0,marginBottom:8}}>
              <img 
                src="/header.png" 
                alt="STC AutoTrade" 
                style={{width:'100%',height:'auto',display:'block'}}
                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
              />
            </div>
            {TopCards}
            <div style={{display:'flex',flexDirection:'row',gap:g,alignItems:'stretch'}}>
              {/* LEFT: chart card — stretches to match right column height */}
              <Card style={{flex:3,padding:10,display:'flex',flexDirection:'column',minWidth:0,border:`1px solid ${isDarkMode?'rgba(16,185,129,0.38)':'rgba(5,150,105,0.28)'}`,boxShadow:`0 2px 0 rgba(255,255,255,0.05) inset, 0 10px 32px rgba(0,0,0,0.55), 0 3px 10px rgba(0,0,0,0.40), 0 0 0 1px rgba(0,0,0,0.20)`}}>
                {/* Clock header inside chart card */}
                <div style={{
                  marginBottom:8,
                  flexShrink:0,
                }}>
                  <RealtimeClockCompact t={t} lang={language}/>
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6,gap:6,flexShrink:0}}>
                  {selectedRic?(
                    <div style={{display:'flex',alignItems:'center',gap:4,minWidth:0}}>
                      <span style={{width:4,height:4,borderRadius:'50%',background:modeAccent(tradingMode),opacity:0.6,flexShrink:0}}/>
                      <span style={{fontSize:9,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selectedRic}</span>
                    </div>
                  ):(
                    <span style={{fontSize:9,color:C.muted}}>—</span>
                  )}
                  <span style={{display:'flex',alignItems:'center',gap:4,fontSize:9,fontWeight:600,flexShrink:0,color:isActiveMode?modeAccent(tradingMode):C.muted}}>
                    <span style={{width:5,height:5,borderRadius:'50%',background:isActiveMode?modeAccent(tradingMode):C.muted,flexShrink:0}}/>
{isActiveMode?t('common.active'):T('dashboard.offStatus')}
                  </span>
                </div>
                <div style={{flex:1,minHeight:0,position:'relative'}}>
                  <ChartCard assetSymbol={selectedRic} height={110}/>
                </div>
              </Card>
              {/* RIGHT: Mode panel — flex:2, drives the row height on mode change */}
              {isActiveMode && tradingMode !== 'schedule' ? (
                <div style={{flex:2,display:'flex',flexDirection:'column',gap:6,minWidth:0}}>
                  {/* mode selector button (read-only style) */}
                  <div style={{
                    display:'flex',alignItems:'center',justifyContent:'space-between',
                    padding:'8px 12px',borderRadius:12,
                    background:`${modeAccent(tradingMode)}0a`,
                    border:`1px solid ${modeAccent(tradingMode)}30`,
                  }}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:modeAccent(tradingMode),animation:'pulse 1.6s ease-in-out infinite',boxShadow:`0 0 5px ${modeAccent(tradingMode)}`}}/>
                      <span style={{fontSize:11,fontWeight:700,color:modeAccent(tradingMode)}}>
                        {{schedule:'Signal Mode',fastrade:'Fastrade FTT',ctc:'Fastrade CTC',aisignal:'AI Signal Mode',indicator:'Analysis Strategy Mode',momentum:'Momentum Mode'}[tradingMode]}
                      </span>
                    </div>
                    <span style={{fontSize:9,padding:'1px 6px',borderRadius:99,color:modeAccent(tradingMode),background:`${modeAccent(tradingMode)}14`,border:`1px solid ${modeAccent(tradingMode)}28`}}>
{T('common.active')}
                    </span>
                  </div>
                  {/* P&L + Mini Stats + Lihat Sesi — unified card (non-schedule modes) */}
                  <div style={{
                    padding:'10px 12px',borderRadius:12,
                    background:C.card2,
                    border:`1px solid ${modeAccent(tradingMode)}28`,
                    boxShadow:`0 2px 0 rgba(255,255,255,0.05) inset, 0 10px 32px rgba(0,0,0,0.55), 0 3px 10px rgba(0,0,0,0.40), 0 0 0 1px rgba(0,0,0,0.20)`,
                    display:'flex',flexDirection:'column',gap:7,
                    flex:1,minHeight:0,
                  }}>
                    {/* P&L */}
                    <div>
                      <span style={{fontSize:8,color:C.muted,textTransform:'uppercase',letterSpacing:'0.1em',display:'block',marginBottom:2}}>{T('dashboard.sessionPnl')}</span>
                      <span style={{
                        fontSize:13,fontWeight:800,fontFamily:'monospace',letterSpacing:'-0.02em',
                        color:sessionPnL>=0?modeAccent(tradingMode):C.coral,
                      }}>
                        {sessionPnL>=0?'+':'-'}{Math.round(Math.abs(sessionPnL/100)).toLocaleString('id-ID',{maximumFractionDigits:0})}
                      </span>
                    </div>
                    <div style={{height:1,background:`${modeAccent(tradingMode)}15`}}/>
                    {/* Mini Stats (non-schedule modes) */}
                    {(()=>{
                      const ac = modeAccent(tradingMode);
                      const wins = ftStatus?.totalWins??aiStatus?.totalWins??indicatorStatus?.totalWins??momentumStatus?.totalWins??0;
                      const losses = ftStatus?.totalLosses??aiStatus?.totalLosses??indicatorStatus?.totalLosses??momentumStatus?.totalLosses??0;
                      const total = wins+losses;
                      const wr = total>0?Math.round((wins/total)*100):null;
                      const asActive = (ftStatus as any)?.alwaysSignalActive
                        || aiStatus?.alwaysSignalStatus?.isActive
                        || (indicatorStatus as any)?.alwaysSignalActive
                        || (momentumStatus as any)?.alwaysSignalActive;
                      const asStep = (ftStatus as any)?.alwaysSignalStep
                        ?? aiStatus?.alwaysSignalStatus?.currentStep
                        ?? (indicatorStatus as any)?.alwaysSignalStep
                        ?? (momentumStatus as any)?.alwaysSignalStep ?? 0;
                      return (
                        <div style={{display:'flex',flexDirection:'column',gap:5}}>
                          {/* Kotak W / L / WR */}
                          <div style={{display:'flex',gap:4}}>
                            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:1,padding:'5px 4px',borderRadius:7,background:`${C.cyan}0c`,border:`1px solid ${C.cyan}20`}}>
                              <span style={{fontSize:14,fontWeight:800,color:C.cyan,lineHeight:1,fontFamily:'monospace'}}>{wins}</span>
                              <span style={{fontSize:7,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>Win</span>
                            </div>
                            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:1,padding:'5px 4px',borderRadius:7,background:`${C.coral}0c`,border:`1px solid ${C.coral}20`}}>
                              <span style={{fontSize:14,fontWeight:800,color:C.coral,lineHeight:1,fontFamily:'monospace'}}>{losses}</span>
                              <span style={{fontSize:7,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>Loss</span>
                            </div>
                            {wr!==null&&(
                              <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:1,padding:'5px 4px',borderRadius:7,background:wr>=50?`${ac}0c`:`${C.coral}0c`,border:`1px solid ${wr>=50?ac:C.coral}20`}}>
                                <span style={{fontSize:14,fontWeight:800,color:wr>=50?ac:C.coral,lineHeight:1,fontFamily:'monospace'}}>{wr}%</span>
                                <span style={{fontSize:7,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>WR</span>
                              </div>
                            )}
                            {asActive&&asStep>0&&(
                              <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:1,padding:'5px 4px',borderRadius:7,background:`${C.amber}0c`,border:`1px solid ${C.amber}20`}}>
                                <span style={{fontSize:11,fontWeight:800,color:C.amber,lineHeight:1,fontFamily:'monospace'}}>K{asStep}</span>
                                <span style={{fontSize:7,color:C.muted,textTransform:'uppercase',letterSpacing:'0.08em'}}>AS</span>
                              </div>
                            )}
                          </div>
                          {/* Bar sparkline animasi */}
                          <div style={{display:'flex',alignItems:'flex-end',gap:2,height:22}}>
                            {[0.4,0.7,0.5,1,0.6,0.85,0.45,0.9,0.55,0.75].map((h,i)=>(
                              <div key={i} style={{
                                flex:1,height:`${h*100}%`,borderRadius:2,
                                background:ac,opacity:0.2+h*0.5,
                                animation:`pulse ${1.1+i*0.12}s ease-in-out infinite`,
                                animationDelay:`${i*0.07}s`,
                              }}/>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    <div style={{height:1,background:`${modeAccent(tradingMode)}15`}}/>
                    <button
                      onClick={()=>setMobileSessionOpen(true)}
                      style={{
                        display:'flex',alignItems:'center',justifyContent:'center',gap:5,
                        padding:'6px 0',borderRadius:8,
                        background:`${modeAccent(tradingMode)}14`,
                        border:`1px solid ${modeAccent(tradingMode)}35`,
                        color:modeAccent(tradingMode),
                        fontSize:'clamp(8px,2.8vw,10px)',fontWeight:700,letterSpacing:'0.04em',
                        cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',
                      }}
>
                      <Info style={{width:11,height:11,flexShrink:0}}/>
                      {T('dashboard.viewSession')}
                    </button>
                    {/* Start / Stop toggle button */}
                    {mobileStartStopBtn}
                  </div>
                </div>
              ) : isActiveMode && tradingMode === 'schedule' ? (
                <div style={{flex:2,display:'flex',flexDirection:'column',gap:6,minWidth:0}}>
                  {/* Schedule aktif: tampilkan list seperti idle + tombol Lihat Sesi di bawah */}
                  {/* Always Signal badge jika aktif */}
                  {(scheduleStatus as any)?.alwaysSignalActive && (
                    <div style={{padding:'5px 8px',borderRadius:10,background:`${C.amber}10`,border:`1px solid ${C.amber}30`,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{width:5,height:5,borderRadius:'50%',background:C.amber,animation:'ping 1.4s ease-in-out infinite'}}/>
                      <span style={{fontSize:9,fontWeight:700,color:C.amber,letterSpacing:'0.06em'}}>
                        ALWAYS SIGNAL · K{(scheduleStatus as any)?.alwaysSignalStep ?? 1}/{martingale.maxStep}
                      </span>
                    </div>
                  )}
                  {/* Next order time */}
                  {(scheduleStatus as any)?.nextOrderTime && (
                    <div style={{padding:'4px 8px',borderRadius:8,background:`${modeAccent(tradingMode)}08`,border:`1px solid ${modeAccent(tradingMode)}20`,display:'flex',alignItems:'center',gap:5}}>
                      <Timer style={{width:9,height:9,color:modeAccent(tradingMode)}}/>
                      <span style={{fontSize:9,fontWeight:600,color:modeAccent(tradingMode),fontFamily:'monospace'}}>
                        {(scheduleStatus as any).nextOrderTime}
                      </span>
                      {(scheduleStatus as any)?.nextOrderInSeconds != null && (
                        <span style={{fontSize:9,color:C.muted,marginLeft:'auto'}}>
                          {(scheduleStatus as any).nextOrderInSeconds}s
                        </span>
                      )}
                    </div>
                  )}
                  <div style={{flex:1}}>
                    {ModeSession(true, true, ()=>setOrderModalOpen(true), mobileStartStopBtn)}
                  </div>
                </div>
              ) : (
                <div style={{flex:2,display:'flex',flexDirection:'column',gap:6,minWidth:0}}>
                  {ModeSession(true, true, ()=>setMobileSessionOpen(true), mobileStartStopBtn)}
                </div>
              )}
            </div>
            {/* Asset + Balance — 1 card gabungan full width */}
            <AssetBalanceCombinedCard
              asset={selectedAsset} mode={tradingMode} isLoading={isLoading} t={t}
              onOpenPicker={()=>setAssetPickerOpen(true)} disabled={isActiveMode}
              balance={balance} accountType={isDemo?'demo':'real'}
            />
            {SettingsCardEl}
            {ControlCardEl}
          </div>
        )}
      </div>
    </div>
  );
}