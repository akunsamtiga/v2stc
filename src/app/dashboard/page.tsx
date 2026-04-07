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
import { LanguageProvider, useLanguage, formatTime, formatDate, Language } from '@/lib/i18n';
import { LanguageSelectorCompact } from '@/components/LanguageSelector';
import {
  Activity, AlertCircle, BarChart2, Calendar,
  ChevronDown, ChevronUp, CheckCircle, Info, Plus,
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
// SHARED SUB-COMPONENTS (module-level)
// ═══════════════════════════════════════════
const StatusChip: React.FC<{col:string;label:string;pulse?:boolean}> = ({col,label,pulse}) => (
  <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',padding:'4px 10px',borderRadius:99,color:col,background:`${col}10`,border:`1px solid ${col}28`}}>
    <span style={{width:5,height:5,borderRadius:'50%',background:col,animation:pulse?'ping 1.6s ease-in-out infinite':undefined,boxShadow:`0 0 4px ${col}`}}/>
    {label}
  </span>
);

// ═══════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════
function DashboardPageContent() {
  const router = useRouter();
  const { t, language } = useLanguage();
  
  // State declarations
  const [assets, setAssets] = useState<StockityAsset[]>([]);
  const [balance, setBalance] = useState<ProfileBalance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Trading mode state
  const [mode, setMode] = useState<TradingMode>('schedule');
  const [isRunning, setIsRunning] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [blockedModes, setBlockedModes] = useState<TradingMode[]>([]);
  
  // Form state
  const [selectedAsset, setSelectedAsset] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [duration, setDuration] = useState<number>(1);
  const [accountType, setAccountType] = useState<'demo' | 'real'>('demo');
  
  // Modal state
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showAISignalModal, setShowAISignalModal] = useState(false);
  
  // Schedule state
  const [scheduleOrders, setScheduleOrders] = useState<ScheduleOrder[]>([]);
  const [scheduleLogs, setScheduleLogs] = useState<ExecutionLog[]>([]);
  
  // FastTrade state
  const [ftStatus, setFtStatus] = useState<FastradeStatus | null>(null);
  const [ftLogs, setFtLogs] = useState<FastradeLog[]>([]);
  
  // AI Signal state
  const [aiStatus, setAiStatus] = useState<AISignalStatus | null>(null);
  const [aiPending, setAiPending] = useState<AISignalOrder[]>([]);
  
  // Indicator state
  const [indicatorStatus, setIndicatorStatus] = useState<IndicatorStatus | null>(null);
  
  // Momentum state
  const [momentumStatus, setMomentumStatus] = useState<MomentumStatus | null>(null);
  
  // Martingale config
  const [martingale, setMartingale] = useState<MartingaleConfig>({
    enabled: false,
    maxStep: 3,
    multiplier: 2,
    alwaysSignal: false,
  });
  
  // Profit flash
  const [flash, setFlash] = useState<'win' | 'lose' | null>(null);
  
  // Timeframe for FastTrade
  const [timeframe, setTimeframe] = useState<FastTradeTimeframe>('1m');

  // Initialize
  useEffect(() => {
    const init = async () => {
      const token = await storage.get('stc_token');
      if (!token) {
        router.push('/login');
        return;
      }
      loadData();
    };
    init();
    
    // Poll status
    const interval = setInterval(() => {
      pollStatus();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [assetsData, balanceData] = await Promise.all([
        api.getAssets(),
        api.balance(),
      ]);
      setAssets(assetsData);
      setBalance(balanceData);
      
      // Set default asset
      if (assetsData.length > 0 && !selectedAsset) {
        setSelectedAsset(assetsData[0].ric);
      }
    } catch (err) {
      setError(t('dashboard.errors.loadAssets'));
    } finally {
      setIsLoading(false);
    }
  };

  const pollStatus = async () => {
    try {
      const status = await api.getStatus();
      setIsRunning(status.isRunning);
      setIsLocked(status.isLocked);
      setBlockedModes((status.blockedModes || []) as TradingMode[]);
      
      // Update mode-specific status
      if (status.schedule) {
        setScheduleOrders(status.schedule.orders || []);
        setScheduleLogs(status.schedule.logs || []);
      }
      if (status.fastrade) {
        setFtStatus(status.fastrade);
        setFtLogs(status.fastrade.logs || []);
      }
      if (status.aisignal) {
        setAiStatus(status.aisignal);
        setAiPending(status.aisignal.pendingOrders || []);
      }
      if (status.indicator) {
        setIndicatorStatus(status.indicator);
      }
      if (status.momentum) {
        setMomentumStatus(status.momentum);
      }
    } catch (err) {
      console.error('Poll status error:', err);
    }
  };

  const handleStart = async () => {
    if (!selectedAsset || !amount) {
      setError(t('dashboard.errors.invalidAmount'));
      return;
    }
    
    const amt = parseInt(amount.replace(/[^0-9]/g, ''));
    if (amt < IDR_MIN_DISPLAY) {
      setError(`${t('dashboard.errors.minAmount')} ${IDR_MIN_DISPLAY.toLocaleString()}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    
    try {
      await api.startBot({
        mode,
        assetRic: selectedAsset,
        amount: amt,
        duration,
        accountType,
        martingale,
        timeframe: mode === 'fastrade' || mode === 'ctc' ? timeframe : undefined,
      });
      
      setSuccessMsg(t('common.success'));
      setTimeout(() => setSuccessMsg(null), 3000);
      setIsRunning(true);
    } catch (err: any) {
      setError(err.message || t('dashboard.errors.startBot'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStop = async () => {
    setIsSubmitting(true);
    try {
      await api.stopBot(mode);
      setSuccessMsg(t('common.success'));
      setTimeout(() => setSuccessMsg(null), 3000);
      setIsRunning(false);
    } catch (err: any) {
      setError(err.message || t('dashboard.errors.stopBot'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get localized timeframe label
  const getTimeframeLabel = (tf: FastTradeTimeframe): string => {
    const labels: Record<FastTradeTimeframe, string> = {
      '1m': `1 ${t('dashboard.duration')}`,
      '5m': `5 ${t('dashboard.duration')}`,
      '15m': `15 ${t('dashboard.duration')}`,
      '30m': `30 ${t('dashboard.duration')}`,
      '1h': `1 ${t('dashboard.duration')}`,
    };
    return labels[tf];
  };

  // Get localized mode label
  const getModeLabel = (m: TradingMode): string => {
    const labels: Record<TradingMode, string> = {
      schedule: t('dashboard.schedule.title'),
      fastrade: t('dashboard.fastTrade.title'),
      ctc: t('history.ctc'),
      aisignal: t('dashboard.aiSignal.title'),
      indicator: t('dashboard.indicator.title'),
      momentum: t('dashboard.momentum.title'),
    };
    return labels[m];
  };

  // ═══════════════════════════════════════════
  // SUB-COMPONENTS
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

  // Realtime Clock
  const RealtimeClock: React.FC = () => {
    const [now,setNow] = useState<Date|null>(null);
    useEffect(()=>{setNow(new Date());const id=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(id);},[]);
    const fmt  = (d:Date) => formatTime(d, language);
    const fmtD = (d:Date) => formatDate(d, language, {weekday:'short',day:'2-digit',month:'short'});
    const tz   = () => {if(!now)return'';const o=-now.getTimezoneOffset()/60;return`UTC${o>=0?'+':''}${o}`;};
    return (
      <Card style={{padding:'14px 16px',height:'100%'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <span style={{fontSize:11,fontWeight:500,color:C.muted}}>{t('dashboard.localTime')}</span>
          <span style={{display:'flex',alignItems:'center',gap:5}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:C.coral}}/>
            <span style={{fontSize:10,fontWeight:600,color:C.coral}}>{t('dashboard.live')}</span>
          </span>
        </div>
        <p suppressHydrationWarning style={{fontSize:26,fontWeight:600,letterSpacing:'-0.01em',lineHeight:1,color:C.text,marginBottom:8}}>
          {now?fmt(now):'--:--:--'}
        </p>
        <div style={{display:'flex',justifyContent:'space-between'}}>
          <span suppressHydrationWarning style={{fontSize:11,color:C.sub}}>{now?fmtD(now):''}</span>
          <span suppressHydrationWarning style={{fontSize:10,color:C.muted}}>{tz()}</span>
        </div>
      </Card>
    );
  };

  // Balance Card
  const BalanceCard: React.FC = () => {
    const [hidden,setHidden] = useState(false);
    const isDemo = accountType==='demo';
    const rawAmount = isDemo
      ? (balance?.demo_balance ?? balance?.balance ?? 0)
      : (balance?.real_balance ?? balance?.balance ?? 0);
    const amt = rawAmount / 100;
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
              {amt.toLocaleString(language === 'en' ? 'en-US' : language === 'ru' ? 'ru-RU' : 'id-ID')}
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

  // Asset Card
  const AssetCard: React.FC = () => {
    const asset = assets.find(a => a.ric === selectedAsset);
    const modeCol = modeAccent(mode);
    const abbr    = asset?.ric ? asset.ric.slice(0,3).toUpperCase() : '—';
    const [imgErr,setImgErr] = useState(false);
    
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
            <p style={{fontSize:10,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.08em',color:'rgba(255,255,255,0.65)',lineHeight:1,marginBottom:5}}>{t('dashboard.asset')}</p>
            {asset?(
              <>
                <p style={{fontSize:15,fontWeight:700,lineHeight:1,color:'#f0f4ff',letterSpacing:'-0.02em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{asset.ric}</p>
                <p style={{fontSize:10,marginTop:3,color:'rgba(255,255,255,0.68)',lineHeight:1.2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{asset.name}</p>
              </>
            ):(
              <p style={{fontSize:12,color:'rgba(255,255,255,0.2)'}}>{t('dashboard.notSelected')}</p>
            )}
          </div>
          {asset && <span style={{fontSize:11,fontWeight:700,color:modeCol,flexShrink:0}}>{asset.profitRate}%</span>}
        </div>
      </Card>
    );
  };

  // Picker Modal
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
              <input autoFocus className="ds-input" style={{fontSize:13,borderRadius:8}} placeholder={t('dashboard.searchAsset')} value={q} onChange={e=>setQ(e.target.value)}/>
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
            {filtered.length===0&&<div style={{padding:'40px 20px',textAlign:'center',color:C.muted,fontSize:12}}>{t('common.notFound')}</div>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{minHeight:'100dvh',background:C.bg,color:C.text,fontFamily:"-apple-system,'SF Pro Display',BlinkMacSystemFont,'Helvetica Neue',sans-serif",paddingBottom:90}}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes win-flash { 0%,100%{box-shadow:0 4px 18px rgba(41,151,255,0.05)} 50%{box-shadow:0 4px 30px rgba(52,199,89,0.4)} }
        @keyframes lose-flash { 0%,100%{box-shadow:0 4px 18px rgba(41,151,255,0.05)} 50%{box-shadow:0 4px 30px rgba(255,69,58,0.4)} }
        @keyframes ping { 0%{transform:scale(1);opacity:1} 75%,100%{transform:scale(2);opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fade-in { from{opacity:0} to{opacity:1} }
        @keyframes slide-up { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        
        .ds-card {
          background: linear-gradient(145deg, ${C.card} 0%, ${C.card2} 100%);
          border: 1px solid ${C.bdr};
          border-radius: 14px;
        }
        .ds-input {
          width: 100%;
          padding: 10px 12px;
          background: rgba(0,0,0,0.3);
          border: 1px solid ${C.bdr};
          border-radius: 8px;
          color: ${C.text};
          font-size: 13px;
          outline: none;
          resize: none;
        }
        .ds-input:focus {
          border-color: ${C.bdrAct};
          box-shadow: 0 0 0 3px rgba(41,151,255,0.1);
        }
        .ds-input::placeholder {
          color: ${C.muted};
        }
      `}</style>

      {/* Header */}
      <div style={{position:'sticky',top:0,zIndex:50,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(20px)',borderBottom:`1px solid ${C.bdr}`,padding:'12px 16px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',maxWidth:1200,margin:'0 auto'}}>
          <h1 style={{fontSize:18,fontWeight:700,color:C.text}}>{t('dashboard.title')}</h1>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <LanguageSelectorCompact />
            <button onClick={loadData} disabled={isLoading} style={{width:32,height:32,borderRadius:8,background:'rgba(255,255,255,0.05)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <RefreshCw size={15} style={{animation:isLoading?'spin 0.8s linear infinite':'none',color:C.muted}}/>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{maxWidth:1200,margin:'0 auto',padding:'16px'}}>
        
        {/* Error/Success Messages */}
        {error && (
          <div style={{padding:'10px 14px',borderRadius:10,background:C.cord,border:`1px solid ${C.coral}30`,marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
            <AlertCircle size={16} color={C.coral}/>
            <span style={{fontSize:13,color:C.coral}}>{error}</span>
            <button onClick={()=>setError(null)} style={{marginLeft:'auto',background:'none',border:'none',color:C.muted,cursor:'pointer'}}><X size={14}/></button>
          </div>
        )}
        {successMsg && (
          <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(52,199,89,0.12)',border:'1px solid rgba(52,199,89,0.3)',marginBottom:16,display:'flex',alignItems:'center',gap:8}}>
            <CheckCircle size={16} color='#34c759'/>
            <span style={{fontSize:13,color:'#34c759'}}>{successMsg}</span>
          </div>
        )}

        {/* Top Cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12,marginBottom:16}}>
          <RealtimeClock />
          <BalanceCard />
          <AssetCard />
        </div>

        {/* Trading Controls */}
        <Card style={{padding:16,marginBottom:16}}>
          {/* Mode Selector */}
          <div style={{marginBottom:16}}>
            <label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:C.muted,display:'block',marginBottom:8}}>{t('dashboard.tradingMode')}</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {(['schedule','fastrade','ctc','aisignal','indicator','momentum'] as TradingMode[]).map(m=>{
                const active = mode===m;
                const col = modeAccent(m);
                const blocked = blockedModes.includes(m);
                return (
                  <button
                    key={m}
                    onClick={()=>!blocked && setMode(m)}
                    disabled={blocked || isLocked}
                    style={{
                      padding:'8px 14px',borderRadius:10,fontSize:12,fontWeight:600,
                      background:active?`${col}20`:'rgba(255,255,255,0.04)',
                      border:`1px solid ${active?`${col}50`:C.bdr}`,
                      color:blocked?'rgba(255,255,255,0.2)':active?col:C.sub,
                      cursor:(blocked||isLocked)?'not-allowed':'pointer',
                      opacity:blocked?0.4:1,
                    }}
                  >
                    {getModeLabel(m)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asset & Amount */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:12,marginBottom:16}}>
            <div>
              <label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:C.muted,display:'block',marginBottom:8}}>{t('dashboard.asset')}</label>
              <button 
                onClick={()=>setShowAssetPicker(true)}
                disabled={isRunning}
                style={{
                  width:'100%',padding:'10px 12px',borderRadius:8,
                  background:'rgba(0,0,0,0.3)',border:`1px solid ${C.bdr}`,
                  color:selectedAsset?C.text:C.muted,fontSize:13,
                  cursor:isRunning?'not-allowed':'pointer',
                  display:'flex',alignItems:'center',justifyContent:'space-between'
                }}
              >
                <span>{selectedAsset||t('dashboard.selectAsset')}</span>
                <ChevronDown size={14} color={C.muted}/>
              </button>
            </div>
            <div>
              <label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:C.muted,display:'block',marginBottom:8}}>{t('dashboard.amount')}</label>
              <input
                type="text"
                value={amount}
                onChange={(e)=>setAmount(e.target.value.replace(/[^0-9]/g,''))}
                placeholder={IDR_MIN_DISPLAY.toLocaleString()}
                disabled={isRunning}
                style={{
                  width:'100%',padding:'10px 12px',borderRadius:8,
                  background:'rgba(0,0,0,0.3)',border:`1px solid ${C.bdr}`,
                  color:C.text,fontSize:13,outline:'none'
                }}
              />
            </div>
          </div>

          {/* Quick Amounts */}
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
            {QUICK_AMOUNTS.map(amt=>{
              const active = parseInt(amount||'0')===amt;
              return (
                <button
                  key={amt}
                  onClick={()=>setAmount(amt.toString())}
                  disabled={isRunning}
                  style={{
                    padding:'6px 12px',borderRadius:8,fontSize:11,
                    background:active?`${C.cyan}20`:'rgba(255,255,255,0.04)',
                    border:`1px solid ${active?C.cyan:C.bdr}`,
                    color:active?C.cyan:C.sub,
                    cursor:isRunning?'not-allowed':'pointer'
                  }}
                >
                  {(amt/1000)}K
                </button>
              );
            })}
          </div>

          {/* Timeframe for FastTrade/CTC */}
          {(mode==='fastrade'||mode==='ctc') && (
            <div style={{marginBottom:16}}>
              <label style={{fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',color:C.muted,display:'block',marginBottom:8}}>{t('dashboard.duration')}</label>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {(['1m','5m','15m','30m','1h'] as FastTradeTimeframe[]).map(tf=>{
                  const active = timeframe===tf;
                  return (
                    <button
                      key={tf}
                      onClick={()=>setTimeframe(tf)}
                      disabled={isRunning}
                      style={{
                        padding:'6px 14px',borderRadius:8,fontSize:12,
                        background:active?`${C.cyan}20`:'rgba(255,255,255,0.04)',
                        border:`1px solid ${active?C.cyan:C.bdr}`,
                        color:active?C.cyan:C.sub,
                        cursor:isRunning?'not-allowed':'pointer'
                      }}
                    >
                      {getTimeframeLabel(tf)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Start/Stop Button */}
          <div style={{display:'flex',gap:10}}>
            {!isRunning?(
              <button
                onClick={handleStart}
                disabled={isSubmitting||!selectedAsset||!amount}
                style={{
                  flex:1,padding:'12px',borderRadius:10,
                  background:'linear-gradient(135deg,#2997FF,#5AC8F5)',
                  border:'none',color:'#000',fontSize:14,fontWeight:700,
                  cursor:isSubmitting?'not-allowed':'pointer',
                  opacity:isSubmitting||!selectedAsset||!amount?0.5:1,
                  display:'flex',alignItems:'center',justifyContent:'center',gap:8
                }}
              >
                {isSubmitting?<RefreshCw size={16} style={{animation:'spin 0.7s linear infinite'}}/>:<PlayCircle size={18}/>}
                {isSubmitting?t('common.processing'):t('dashboard.start')}
              </button>
            ):(
              <button
                onClick={handleStop}
                disabled={isSubmitting}
                style={{
                  flex:1,padding:'12px',borderRadius:10,
                  background:C.coral,border:'none',color:'#fff',fontSize:14,fontWeight:700,
                  cursor:isSubmitting?'not-allowed':'pointer',
                  opacity:isSubmitting?0.5:1,
                  display:'flex',alignItems:'center',justifyContent:'center',gap:8
                }}
              >
                {isSubmitting?<RefreshCw size={16} style={{animation:'spin 0.7s linear infinite'}}/>:<StopCircle size={18}/>}
                {isSubmitting?t('common.processing'):t('dashboard.stop')}
              </button>
            )}
          </div>
        </Card>

        {/* Status Panels */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12}}>
          {/* Schedule Panel */}
          {mode==='schedule' && (
            <SchedulePanel 
              orders={scheduleOrders}
              logs={scheduleLogs}
              onOpenModal={()=>setShowOrderModal(true)}
              isRunning={isRunning}
              isLoading={isLoading}
            />
          )}
          
          {/* FastTrade Panel */}
          {(mode==='fastrade'||mode==='ctc') && (
            <FastradePanel 
              status={ftStatus}
              logs={ftLogs}
              isLoading={isLoading}
            />
          )}
          
          {/* AI Signal Panel */}
          {mode==='aisignal' && (
            <AISignalPanel 
              status={aiStatus}
              pendingOrders={aiPending}
              onOpenSendModal={()=>setShowAISignalModal(true)}
              isLoading={isLoading}
            />
          )}
          
          {/* Indicator Panel */}
          {mode==='indicator' && (
            <IndicatorPanel 
              status={indicatorStatus}
              isLoading={isLoading}
            />
          )}
          
          {/* Momentum Panel */}
          {mode==='momentum' && (
            <MomentumPanel 
              status={momentumStatus}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>

      {/* Asset Picker Modal */}
      <PickerModal
        open={showAssetPicker}
        onClose={()=>setShowAssetPicker(false)}
        title={t('dashboard.selectAsset')}
        options={assets.map(a=>({value:a.ric,label:a.ric,sub:a.name,icon:a.iconUrl}))}
        value={selectedAsset}
        onSelect={setSelectedAsset}
        searchable
      />
    </div>
  );
}

// ═══════════════════════════════════════════
// PANEL COMPONENTS
// ═══════════════════════════════════════════

// Schedule Panel
const SchedulePanel: React.FC<{
  orders:ScheduleOrder[];
  logs:ExecutionLog[];
  onOpenModal:()=>void;
  isRunning:boolean;
  isLoading:boolean;
}> = ({orders,logs,onOpenModal,isRunning,isLoading}) => {
  const { t } = useLanguage();
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement|null)[]>([]);
  const [activeIdx,setActiveIdx] = useState(-1);

  const pendingOrders = orders.filter(o => !o.isExecuted && !o.isSkipped);
  const doneCount = orders.length - pendingOrders.length;

  useEffect(()=>{
    const update=()=>{
      if(!pendingOrders.length){setActiveIdx(-1);return;}
      const now = new Date(); const nowMin = now.getHours()*60+now.getMinutes();
      let ci=-1,cd=Infinity;
      pendingOrders.forEach((o,i)=>{const[h,m]=o.time.split(':').map(Number);let d=(h*60+m)-nowMin;if(d<0)d+=24*60;if(d<cd){cd=d;ci=i;}});
      setActiveIdx(ci);
    };
    update(); const timer=setInterval(update,10000); return()=>clearInterval(timer);
  },[pendingOrders.length]);

  return (
    <div className="ds-card" style={{padding:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <span style={{fontSize:13,fontWeight:600,color:C.sub}}>{t('dashboard.schedule.title')}</span>
        {doneCount>0 && (
          <span style={{fontSize:10,padding:'2px 8px',borderRadius:99,color:C.muted,background:'rgba(255,255,255,0.05)',border:`1px solid ${C.bdr}`}}>
            {doneCount} {t('dashboard.schedule.activeSignals')}
          </span>
        )}
      </div>
      
      {pendingOrders.length===0?(
        <div style={{padding:30,textAlign:'center'}}>
          <Calendar size={32} color={C.muted} style={{marginBottom:8,opacity:0.5}}/>
          <p style={{fontSize:12,color:C.muted}}>
            {doneCount>0?t('dashboard.schedule.allCompleted'):t('dashboard.schedule.noSignals')}
          </p>
        </div>
      ):(
        <div ref={listRef} style={{maxHeight:200,overflowY:'auto'}}>
          {pendingOrders.map((order,i)=>{
            const isA=i===activeIdx, isCall=order.trend==='call', col=isCall?C.cyan:C.coral;
            return (
              <div key={order.id} style={{
                display:'flex',alignItems:'center',gap:8,padding:'8px 10px',
                borderBottom:i<pendingOrders.length-1?`1px solid ${C.bdr}`:'none',
                background:isA?(isCall?'rgba(41,151,255,0.04)':'rgba(255,69,58,0.04)'):'transparent',
              }}>
                {isA?<PlayCircle size={14} color={col}/>:<PauseCircle size={14} color='rgba(255,255,255,0.18)'/>}
                <span style={{fontSize:12,fontFamily:'monospace',color:isA?C.text:C.sub,fontWeight:isA?600:400}}>{order.time}</span>
                <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:5,color:col,background:isCall?'rgba(41,151,255,0.1)':'rgba(255,69,58,0.1)'}}>
                  {isCall?t('dashboard.schedule.call'):t('dashboard.schedule.put')}
                </span>
              </div>
            );
          })}
        </div>
      )}
      
      <button 
        onClick={onOpenModal}
        disabled={isRunning}
        style={{
          width:'100%',marginTop:12,padding:'8px',borderRadius:8,
          background:'rgba(41,151,255,0.07)',border:`1px solid rgba(41,151,255,0.18)`,
          color:C.cyan,fontSize:12,cursor:isRunning?'not-allowed':'pointer',
          opacity:isRunning?0.4:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6
        }}
      >
        <Plus size={14}/>
        {pendingOrders.length===0?t('dashboard.schedule.addSignal'):t('dashboard.schedule.manageSignals')}
      </button>
    </div>
  );
};

// FastTrade Panel
const FastradePanel: React.FC<{
  status:FastradeStatus|null;
  logs:FastradeLog[];
  isLoading:boolean;
}> = ({status,logs,isLoading}) => {
  const { t } = useLanguage();
  const isOn = status?.isRunning??false;
  const pnl = status?.sessionPnL??0;
  const wins = status?.totalWins??0;
  const losses = status?.totalLosses??0;
  const total = status?.totalTrades??0;
  const wr = total>0?Math.round((wins/total)*100):null;
  const accent = status?.mode==='CTC'?C.violet:C.cyan;
  const isCTC = status?.mode==='CTC';

  const phaseMap: Record<string,string> = {
    WAITING_MINUTE_1:t('dashboard.fastTrade.phase')+': 1',
    FETCHING_1:t('dashboard.fastTrade.phase')+': 1',
    WAITING_MINUTE_2:t('dashboard.fastTrade.phase')+': 2',
    FETCHING_2:t('dashboard.fastTrade.phase')+': 2',
    ANALYZING:t('common.processing'),
    WAITING_EXEC_SYNC:t('common.processing'),
    EXECUTING:t('common.processing'),
    WAITING_RESULT:t('common.processing'),
    WAITING_LOSS_DELAY:t('common.processing'),
    IDLE:t('common.standby'),
  };

  return (
    <div className="ds-card" style={{padding:14}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <Zap size={14} color={accent}/>
          <span style={{fontSize:13,fontWeight:600,color:C.sub}}>{isCTC?t('dashboard.fastTrade.ctcSession'):t('dashboard.fastTrade.session')}</span>
        </div>
        {isOn?<StatusChip col={accent} label={t('common.active')} pulse/>:<span style={{fontSize:10,color:C.muted}}>{t('common.standby')}</span>}
      </div>

      {!isOn?(
        <div style={{padding:30,textAlign:'center'}}>
          <Zap size={32} color={C.muted} style={{marginBottom:8,opacity:0.4}}/>
          <p style={{fontSize:12,color:C.muted}}>{t('dashboard.fastTrade.noActiveSession')}</p>
        </div>
      ):(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <div style={{padding:10,borderRadius:8,background:'rgba(255,255,255,0.03)'}}>
              <span style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>{t('dashboard.fastTrade.pnl')}</span>
              <p style={{fontSize:16,fontWeight:700,color:pnl>=0?accent:C.coral}}>{pnl>=0?'+':''}{pnl.toLocaleString()}</p>
            </div>
            <div style={{padding:10,borderRadius:8,background:'rgba(255,255,255,0.03)'}}>
              <span style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>{t('dashboard.fastTrade.winRate')}</span>
              <p style={{fontSize:16,fontWeight:700,color:wr&&wr>=50?accent:C.coral}}>{wr??'—'}%</p>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderTop:`1px solid ${C.bdr}`}}>
            <span style={{fontSize:11,color:C.muted}}>{t('dashboard.fastTrade.wins')}: <span style={{color:C.cyan}}>{wins}</span></span>
            <span style={{fontSize:11,color:C.muted}}>{t('dashboard.fastTrade.losses')}: <span style={{color:C.coral}}>{losses}</span></span>
          </div>
        </div>
      )}
    </div>
  );
};

// AI Signal Panel
const AISignalPanel: React.FC<{
  status:AISignalStatus|null;
  pendingOrders:AISignalOrder[];
  onOpenSendModal:()=>void;
  isLoading:boolean;
}> = ({status,pendingOrders,onOpenSendModal,isLoading}) => {
  const { t } = useLanguage();
  const isOn = status?.botState==='RUNNING'||status?.isActive===true;
  const pnl = status?.sessionPnL??0;
  const wins = status?.totalWins??status?.stats?.wins??0;
  const losses = status?.totalLosses??status?.stats?.losses??0;
  const total = status?.totalTrades??status?.stats?.totalTrades??0;
  const wr = total>0?Math.round((wins/total)*100):null;

  return (
    <div className="ds-card" style={{padding:14,borderColor:`${C.sky}44`}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <Radio size={14} color={C.sky}/>
          <span style={{fontSize:13,fontWeight:600,color:C.sub}}>{t('dashboard.aiSignal.title')}</span>
        </div>
        {isOn?<StatusChip col={C.sky} label={t('common.active')} pulse/>:<span style={{fontSize:10,color:C.muted}}>{t('common.standby')}</span>}
      </div>

      {!isOn?(
        <div style={{padding:30,textAlign:'center'}}>
          <Radio size={32} color={C.muted} style={{marginBottom:8,opacity:0.4}}/>
          <p style={{fontSize:12,color:C.muted}}>{t('dashboard.aiSignal.waiting')}</p>
        </div>
      ):(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <div style={{padding:10,borderRadius:8,background:'rgba(255,255,255,0.03)'}}>
              <span style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>{t('dashboard.fastTrade.pnl')}</span>
              <p style={{fontSize:16,fontWeight:700,color:pnl>=0?C.sky:C.coral}}>{pnl>=0?'+':''}{pnl.toLocaleString()}</p>
            </div>
            <div style={{padding:10,borderRadius:8,background:'rgba(255,255,255,0.03)'}}>
              <span style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>{t('dashboard.fastTrade.winRate')}</span>
              <p style={{fontSize:16,fontWeight:700,color:wr&&wr>=50?C.sky:C.coral}}>{wr??'—'}%</p>
            </div>
          </div>
          
          {pendingOrders.length>0 && (
            <div style={{marginTop:12}}>
              <span style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>{t('dashboard.aiSignal.pending')} ({pendingOrders.length})</span>
              {pendingOrders.slice(0,3).map((o,i)=>{
                const msLeft = o.executionTime - Date.now();
                const secLeft = Math.max(0, Math.ceil(msLeft/1000));
                const col = o.trend==='call'?C.cyan:C.coral;
                return (
                  <div key={o.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderTop:i===0?`1px solid ${C.bdr}`:'none'}}>
                    <span style={{fontSize:11,fontWeight:700,color:col}}>{o.trend==='call'?'↑ CALL':'↓ PUT'}</span>
                    <span style={{fontSize:10,color:C.sky,fontFamily:'monospace'}}>{secLeft>0?`${secLeft}s`:t('dashboard.aiSignal.now')}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {isOn && (
        <button 
          onClick={onOpenSendModal}
          style={{
            width:'100%',marginTop:12,padding:'8px',borderRadius:8,
            background:`${C.sky}10`,border:`1px solid ${C.sky}25`,
            color:C.sky,fontSize:12,cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',gap:6
          }}
        >
          <Send size={12}/>
          {t('dashboard.aiSignal.sendSignal')}
        </button>
      )}
    </div>
  );
};

// Indicator Panel
const IndicatorPanel: React.FC<{
  status:IndicatorStatus|null;
  isLoading:boolean;
}> = ({status,isLoading}) => {
  const { t } = useLanguage();
  const isOn = status?.isRunning??false;
  const pnl = status?.sessionPnL??0;
  const wins = status?.totalWins??0;
  const losses = status?.totalLosses??0;
  const total = status?.totalTrades??0;
  const wr = total>0?Math.round((wins/total)*100):null;
  const indType = status?.indicatorType??'SMA';

  return (
    <div className="ds-card" style={{padding:14,borderColor:`${C.orange}44`}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <BarChart size={14} color={C.orange}/>
          <span style={{fontSize:13,fontWeight:600,color:C.sub}}>{t('dashboard.indicator.title')} — {indType}</span>
        </div>
        {isOn?<StatusChip col={C.orange} label={t('common.active')} pulse/>:<span style={{fontSize:10,color:C.muted}}>{t('common.standby')}</span>}
      </div>

      {!isOn?(
        <div style={{padding:30,textAlign:'center'}}>
          <BarChart size={32} color={C.muted} style={{marginBottom:8,opacity:0.4}}/>
          <p style={{fontSize:12,color:C.muted}}>{t('dashboard.indicator.monitoring')}</p>
        </div>
      ):(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <div style={{padding:10,borderRadius:8,background:'rgba(255,255,255,0.03)'}}>
              <span style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>{t('dashboard.fastTrade.pnl')}</span>
              <p style={{fontSize:16,fontWeight:700,color:pnl>=0?C.orange:C.coral}}>{pnl>=0?'+':''}{pnl.toLocaleString()}</p>
            </div>
            <div style={{padding:10,borderRadius:8,background:'rgba(255,255,255,0.03)'}}>
              <span style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>{t('dashboard.fastTrade.winRate')}</span>
              <p style={{fontSize:16,fontWeight:700,color:wr&&wr>=50?C.orange:C.coral}}>{wr??'—'}%</p>
            </div>
          </div>
          {status?.currentIndicatorValue!=null && (
            <div style={{padding:'8px 0',borderTop:`1px solid ${C.bdr}`}}>
              <span style={{fontSize:10,color:C.orange}}>{indType} {t('dashboard.indicator.value')}: {status.currentIndicatorValue.toFixed(4)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Momentum Panel
const MomentumPanel: React.FC<{
  status:MomentumStatus|null;
  isLoading:boolean;
}> = ({status,isLoading}) => {
  const { t } = useLanguage();
  const isOn = status?.isRunning??false;
  const pnl = status?.sessionPnL??0;
  const wins = status?.totalWins??0;
  const losses = status?.totalLosses??0;
  const total = status?.totalTrades??0;
  const wr = total>0?Math.round((wins/total)*100):null;

  const PATTERN_LABELS: Record<string,string> = {
    CANDLE_SABIT:t('dashboard.momentum.patterns.candleSabit'),
    DOJI_TERJEPIT:t('dashboard.momentum.patterns.dojiTerjepit'),
    DOJI_PEMBATALAN:t('dashboard.momentum.patterns.dojiPembatalan'),
    BB_SAR_BREAK:t('dashboard.momentum.patterns.bbSarBreak'),
  };

  return (
    <div className="ds-card" style={{padding:14,borderColor:`${C.pink}44`}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <Waves size={14} color={C.pink}/>
          <span style={{fontSize:13,fontWeight:600,color:C.sub}}>{t('dashboard.momentum.title')}</span>
        </div>
        {isOn?<StatusChip col={C.pink} label={t('common.active')} pulse/>:<span style={{fontSize:10,color:C.muted}}>{t('common.standby')}</span>}
      </div>

      {!isOn?(
        <div style={{padding:30,textAlign:'center'}}>
          <Waves size={32} color={C.muted} style={{marginBottom:8,opacity:0.4}}/>
          <p style={{fontSize:12,color:C.muted}}>{t('dashboard.momentum.scanning')}</p>
        </div>
      ):(
        <div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <div style={{padding:10,borderRadius:8,background:'rgba(255,255,255,0.03)'}}>
              <span style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>{t('dashboard.fastTrade.pnl')}</span>
              <p style={{fontSize:16,fontWeight:700,color:pnl>=0?C.pink:C.coral}}>{pnl>=0?'+':''}{pnl.toLocaleString()}</p>
            </div>
            <div style={{padding:10,borderRadius:8,background:'rgba(255,255,255,0.03)'}}>
              <span style={{fontSize:9,color:C.muted,textTransform:'uppercase'}}>{t('dashboard.fastTrade.winRate')}</span>
              <p style={{fontSize:16,fontWeight:700,color:wr&&wr>=50?C.pink:C.coral}}>{wr??'—'}%</p>
            </div>
          </div>
          {status?.lastDetectedPattern && (
            <div style={{padding:'8px 0',borderTop:`1px solid ${C.bdr}`}}>
              <span style={{fontSize:10,color:C.pink}}>{t('dashboard.momentum.pattern')}: {PATTERN_LABELS[status.lastDetectedPattern]||status.lastDetectedPattern}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Export with LanguageProvider
export default function DashboardPage() {
  return (
    <LanguageProvider>
      <DashboardPageContent />
    </LanguageProvider>
  );
}