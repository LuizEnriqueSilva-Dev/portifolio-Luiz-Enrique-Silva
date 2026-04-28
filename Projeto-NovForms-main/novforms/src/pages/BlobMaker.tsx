import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Twitter, 
  Share2, 
  RefreshCw, 
  Code, 
  Star, 
  Dice5, 
  Circle, 
  Layers,
  Settings2,
  ChevronRight,
  Mail,
  ArrowRight,
  Download,
  Copy,
  FileText,
  Heart,
  History,
  Play,
  Pause,
  Plus,
  RotateCcw,
  Sun,
  Moon,
  Monitor,
  Smartphone,
  Image as ImageIcon,
  Check,
  Info,
  X,
  Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useAuth, useTheme } from '../App';

// --- Types ---

interface BlobConfig {
  size: number;
  growth: number;
  edges: number;
  seed: number;
  smoothness?: number;
}

interface SavedBlob {
  id: string;
  complexity: number;
  contrast: number;
  smoothness: number;
  color: string;
  isOutline: boolean;
  seed: number;
  timestamp: number;
}

interface Preset {
  name: string;
  complexity: number;
  contrast: number;
  smoothness: number;
  icon: React.ReactNode;
}

// --- Blob Generation Logic ---

const generateBlobPath = (config: BlobConfig) => {
  const { size, growth, edges, seed, smoothness = 0.2 } = config;
  const center = size / 2;
  const radius = center * 0.7;
  const points: { x: number; y: number }[] = [];
  
  const random = (i: number) => {
    const x = Math.sin(seed + i) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < edges; i++) {
    const angle = (i / edges) * Math.PI * 2;
    const r = radius + (random(i) - 0.5) * growth * radius;
    points.push({
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
    });
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const p3 = points[(i + 2) % points.length];
    
    const cp1x = p1.x + (p2.x - points[(i - 1 + points.length) % points.length].x) * smoothness;
    const cp1y = p1.y + (p2.y - points[(i - 1 + points.length) % points.length].y) * smoothness;
    const cp2x = p2.x - (p3.x - p1.x) * smoothness;
    const cp2y = p2.y - (p3.y - p1.y) * smoothness;
    
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  path += ' Z';
  return path;
};

// --- Components ---

const Tooltip = ({ text, children }: { text: string, children: React.ReactNode }) => (
  <div className="group relative flex items-center">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
    </div>
  </div>
);

export const BlobMaker = () => {
  const { user, login } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [complexity, setComplexity] = useState(6);
  const [contrast, setContrast] = useState(0.4);
  const [smoothness, setSmoothness] = useState(0.2);
  const [color, setColor] = useState('#0F62FE');
  const [isOutline, setIsOutline] = useState(false);
  const [seed, setSeed] = useState(Math.random() * 1000);
  const [isAnimating, setIsAnimating] = useState(false);
  const [favorites, setFavorites] = useState<SavedBlob[]>([]);
  const [history, setHistory] = useState<SavedBlob[]>([]);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Load from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('novforms_favorites');
    const savedHistory = localStorage.getItem('novforms_history');
    if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    // Check URL params for shared blob
    const params = new URLSearchParams(window.location.search);
    if (params.has('c')) setComplexity(parseInt(params.get('c')!));
    if (params.has('ct')) setContrast(parseFloat(params.get('ct')!));
    if (params.has('sm')) setSmoothness(parseFloat(params.get('sm')!));
    if (params.has('col')) setColor(params.get('col')!);
    if (params.has('out')) setIsOutline(params.get('out') === 'true');
    if (params.has('s')) setSeed(parseFloat(params.get('s')!));
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('novforms_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('novforms_history', JSON.stringify(history));
  }, [history]);

  const blobPath = generateBlobPath({
    size: 400,
    growth: contrast,
    edges: complexity,
    seed: seed,
    smoothness: smoothness
  });

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'r' || e.key === 'R') {
        randomize();
      } else if (e.key === 'Backspace') {
        reset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [complexity, contrast, smoothness, color, isOutline]);

  // Animation effect
  useEffect(() => {
    let interval: any;
    if (isAnimating) {
      interval = setInterval(() => {
        setSeed(s => s + 0.01);
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isAnimating]);

  const randomize = () => {
    const newSeed = Math.random() * 1000;
    const currentBlob: SavedBlob = {
      id: Math.random().toString(36).substr(2, 9),
      complexity,
      contrast,
      smoothness,
      color,
      isOutline,
      seed,
      timestamp: Date.now()
    };
    setSeed(newSeed);
    setHistory(prev => [currentBlob, ...prev].slice(0, 20));
  };

  const reset = () => {
    setComplexity(6);
    setContrast(0.4);
    setSmoothness(0.2);
    setColor('#0F62FE');
    setIsOutline(false);
    setSeed(Math.random() * 1000);
    setIsAnimating(false);
  };

  const saveToFavorites = () => {
    const currentBlob: SavedBlob = {
      id: Math.random().toString(36).substr(2, 9),
      complexity,
      contrast,
      smoothness,
      color,
      isOutline,
      seed,
      timestamp: Date.now()
    };
    setFavorites(prev => [currentBlob, ...prev]);
  };

  const loadBlob = (blob: SavedBlob) => {
    setComplexity(blob.complexity);
    setContrast(blob.contrast);
    setSmoothness(blob.smoothness);
    setColor(blob.color);
    setIsOutline(blob.isOutline);
    setSeed(blob.seed);
    setShowHistory(false);
    setShowFavorites(false);
  };

  const copySvg = () => {
    const svg = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <path d="${blobPath}" fill="${isOutline ? 'none' : color}" stroke="${isOutline ? color : 'none'}" stroke-width="${isOutline ? '4' : '0'}" />
</svg>`;
    navigator.clipboard.writeText(svg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadSvg = () => {
    const svg = `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
  <path d="${blobPath}" fill="${isOutline ? 'none' : color}" stroke="${isOutline ? color : 'none'}" stroke-width="${isOutline ? '4' : '0'}" />
</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `novforms-blob-${Date.now()}.svg`;
    a.click();
  };

  const downloadPng = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    canvas.width = 800;
    canvas.height = 800;

    img.onload = () => {
      if (ctx) {
        ctx.drawImage(img, 0, 0, 800, 800);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `novforms-blob-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    };
    img.src = url;
  };

  const copyShareLink = () => {
    const params = new URLSearchParams();
    params.set('c', complexity.toString());
    params.set('ct', contrast.toString());
    params.set('sm', smoothness.toString());
    params.set('col', color);
    params.set('out', isOutline.toString());
    params.set('s', seed.toString());
    
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(url);
    alert('Shareable link copied to clipboard!');
  };

  const presets: Preset[] = [
    { name: 'Soft', complexity: 4, contrast: 0.2, smoothness: 0.2, icon: <Circle size={14} fill="currentColor" className="opacity-20" /> },
    { name: 'Sharp', complexity: 12, contrast: 0.6, smoothness: 0.1, icon: <Star size={14} /> },
    { name: 'Abstract', complexity: 8, contrast: 0.8, smoothness: 0.3, icon: <Layers size={14} /> },
    { name: 'Background', complexity: 3, contrast: 0.1, smoothness: 0.2, icon: <Monitor size={14} /> },
  ];

  const applyPreset = (p: Preset) => {
    setComplexity(p.complexity);
    setContrast(p.contrast);
    setSmoothness(p.smoothness);
    randomize();
  };

  return (
    <div className={cn("min-h-screen font-sans transition-colors duration-500", isDarkMode ? "bg-zinc-950 text-white" : "bg-white text-slate-900")}>
      {/* Banner */}
      <div className="bg-linear-to-r from-[#FF4D4D] to-[#FF8C42] text-white py-2.5 px-4 text-center text-xs font-bold tracking-wide">
        NOVFORMS DESIGN SUITE • GENERATE BEAUTIFUL ASSETS IN SECONDS
      </div>

      {/* Header */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-zinc-950/80 border-b border-slate-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-linear-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20">
            N
          </div>
          <div className="text-sm">
            <p className="font-black tracking-tight leading-tight">NovForms</p>
            <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Design Tool</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleDarkMode}
            className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors text-slate-400"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="h-6 w-px bg-slate-100 dark:bg-zinc-800" />
          <button 
            onClick={copyShareLink}
            className="text-sm font-bold text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Share
          </button>
          {user ? (
            <Link to="/dashboard" className="btn-primary py-2 px-6 text-sm flex items-center gap-2">
              <Plus size={16} /> Create Form
            </Link>
          ) : (
            <button onClick={login} className="btn-primary py-2 px-6 text-sm">Sign In</button>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-12 text-center space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <h1 className="text-6xl md:text-7xl font-black tracking-tighter leading-[0.9]">
            Generate beautiful organic <br />
            <span className="text-blue-600">SVG shapes</span> in seconds.
          </h1>
          <p className="text-lg text-slate-500 dark:text-zinc-400 max-w-2xl mx-auto font-medium">
            The ultimate design tool for UI designers, illustrators, and creators. 
            Create unique blobs for backgrounds, hero sections, and branding.
          </p>
        </motion.div>
        
        <div className="flex items-center justify-center gap-4">
          <button 
            onClick={() => canvasRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="btn-primary px-8 py-4 text-lg flex items-center gap-2 group"
          >
            Start generating <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <button className="px-8 py-4 rounded-2xl font-bold border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all">
            View Gallery
          </button>
        </div>
      </section>

      {/* Main Generator Section */}
      <main ref={canvasRef} className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-[1fr,360px] gap-12 items-start">
        
        {/* Canvas Area */}
        <div className="space-y-8">
          <div className="relative aspect-square bg-slate-50 dark:bg-zinc-900/50 rounded-[48px] border border-slate-100 dark:border-zinc-800 flex items-center justify-center overflow-hidden group shadow-inner">
            <AnimatePresence mode="wait">
              <motion.svg 
                key={seed}
                ref={svgRef}
                viewBox="0 0 400 400" 
                className="w-full max-w-[450px] drop-shadow-2xl filter blur-0"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ type: 'spring', damping: 25, stiffness: 120 }}
              >
                <motion.path
                  d={blobPath}
                  fill={isOutline ? 'none' : color}
                  stroke={isOutline ? color : 'none'}
                  strokeWidth={isOutline ? 4 : 0}
                  animate={{ d: blobPath }}
                  transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                />
              </motion.svg>
            </AnimatePresence>

            {/* Canvas Actions Overlay */}
            <div className="absolute top-8 right-8 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
              <Tooltip text="Save to Favorites">
                <button 
                  onClick={saveToFavorites}
                  className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl hover:text-red-500 transition-colors"
                >
                  <Heart size={20} className={cn(favorites.some(f => f.seed === seed) && "fill-red-500 text-red-500")} />
                </button>
              </Tooltip>
              <Tooltip text="View History">
                <button 
                  onClick={() => setShowHistory(true)}
                  className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl hover:text-blue-500 transition-colors"
                >
                  <History size={20} />
                </button>
              </Tooltip>
              <Tooltip text="View Favorites">
                <button 
                  onClick={() => setShowFavorites(true)}
                  className="p-3 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl hover:text-yellow-500 transition-colors"
                >
                  <Star size={20} />
                </button>
              </Tooltip>
            </div>

            {/* Animation Toggle */}
            <div className="absolute bottom-8 left-8">
              <button 
                onClick={() => setIsAnimating(!isAnimating)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm transition-all shadow-lg",
                  isAnimating ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300"
                )}
              >
                {isAnimating ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                {isAnimating ? "Pause Animation" : "Animate Blob"}
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {presets.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className="flex items-center justify-center gap-3 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group"
              >
                <span className="text-slate-400 group-hover:text-blue-500">{p.icon}</span>
                <span className="font-bold text-sm">{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Controls Panel */}
        <aside className="card p-8 space-y-10 sticky top-32 border border-slate-100 dark:border-zinc-800 shadow-2xl shadow-slate-200/50 dark:shadow-none">
          <div className="space-y-6">
            <h3 className="font-black text-lg flex items-center gap-2">
              <Settings2 size={20} className="text-blue-600" /> Configuration
            </h3>

            {/* Color Picker */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Color</label>
                <span className="text-xs font-mono font-bold text-blue-600">{color.toUpperCase()}</span>
              </div>
              <div className="flex gap-2">
                <input 
                  type="color" 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent"
                />
                <input 
                  type="text" 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-grow bg-slate-50 dark:bg-zinc-900 rounded-xl px-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 border border-slate-100 dark:border-zinc-800"
                />
              </div>
            </div>

            {/* Complexity Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Complexity</label>
                <span className="text-xs font-bold">{complexity}</span>
              </div>
              <input 
                type="range" 
                min="3" 
                max="20" 
                value={complexity}
                onChange={(e) => setComplexity(parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            {/* Contrast Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Contrast</label>
                <span className="text-xs font-bold">{Math.round(contrast * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0.1" 
                max="0.9" 
                step="0.05"
                value={contrast}
                onChange={(e) => setContrast(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            {/* Smoothness Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Smoothness</label>
                <span className="text-xs font-bold">{Math.round(smoothness * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0.05" 
                max="0.4" 
                step="0.01"
                value={smoothness}
                onChange={(e) => setSmoothness(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            {/* Style Toggle */}
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Style</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-zinc-900 p-1 rounded-xl border border-slate-100 dark:border-zinc-800">
                <button 
                  onClick={() => setIsOutline(false)}
                  className={cn(
                    "py-2 rounded-lg text-xs font-bold transition-all",
                    !isOutline ? "bg-white dark:bg-zinc-800 shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Filled
                </button>
                <button 
                  onClick={() => setIsOutline(true)}
                  className={cn(
                    "py-2 rounded-lg text-xs font-bold transition-all",
                    isOutline ? "bg-white dark:bg-zinc-800 shadow-sm text-blue-600" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Outline
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-zinc-800">
            <button 
              onClick={randomize}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]"
            >
              <Dice5 size={24} /> Randomize
            </button>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={copySvg}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 font-bold text-sm hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy SVG'}
              </button>
              <div className="relative group/export">
                <button 
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 dark:border-zinc-800 font-bold text-sm hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all"
                >
                  <Download size={18} /> Export
                </button>
                <div className="absolute bottom-full left-0 w-full mb-2 bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-slate-100 dark:border-zinc-700 opacity-0 group-hover/export:opacity-100 pointer-events-none group-hover/export:pointer-events-auto transition-all translate-y-2 group-hover/export:translate-y-0 overflow-hidden">
                  <button onClick={downloadSvg} className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors border-b border-slate-50 dark:border-zinc-700">SVG Format</button>
                  <button onClick={downloadPng} className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors">PNG Format</button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                if (!user) {
                  login();
                  return;
                }
                // Pass blob config via state or URL if needed, for now just redirect
                navigate('/dashboard');
              }}
              className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-xl active:scale-[0.98]"
            >
              <FileText size={24} /> Use in Form
            </button>

            <button 
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 py-2 text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors"
            >
              <RotateCcw size={14} /> Reset to Default
            </button>
          </div>
        </aside>
      </main>

      {/* Use Cases Section */}
      <section className="bg-slate-50 dark:bg-zinc-900/30 py-32">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-black tracking-tight">Endless possibilities</h2>
            <p className="text-slate-500 dark:text-zinc-400 max-w-xl mx-auto">
              See how top designers are using NovForms blobs to elevate their digital products.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: 'Hero Backgrounds', desc: 'Add depth to your landing pages with soft, layered organic shapes.', icon: <Layout size={24} /> },
              { title: 'Mobile UI', desc: 'Create unique button backdrops and card accents for mobile apps.', icon: <Smartphone size={24} /> },
              { title: 'Illustrations', desc: 'The perfect foundation for abstract characters and scenes.', icon: <ImageIcon size={24} /> },
            ].map((item, i) => (
              <div key={i} className="card p-8 space-y-6 hover:translate-y-[-8px] transition-transform duration-500 border border-slate-100 dark:border-zinc-800">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
                  {item.icon}
                </div>
                <div className="space-y-2">
                  <h3 className="font-black text-xl">{item.title}</h3>
                  <p className="text-slate-500 dark:text-zinc-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
                <div className="pt-4 flex items-center gap-2 text-blue-600 font-bold text-sm cursor-pointer group">
                  Learn more <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative pt-32 pb-12 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full -z-10 opacity-5">
           <svg viewBox="0 0 1440 320" className="w-full h-full" preserveAspectRatio="none">
             <path fill="#0F62FE" d="M0,192L48,176C96,160,192,128,288,138.7C384,149,480,203,576,224C672,245,768,235,864,202.7C960,171,1056,117,1152,106.7C1248,96,1344,128,1392,144L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
           </svg>
        </div>

        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-16">
          <div className="col-span-2 space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black">N</div>
              <span className="font-black text-xl tracking-tight">NovForms</span>
            </div>
            <p className="text-slate-500 dark:text-zinc-400 max-w-sm leading-relaxed">
              The world's most powerful organic shape generator. Built for designers who care about the details.
            </p>
            <div className="flex items-center gap-6 text-slate-400">
              <Twitter size={20} className="hover:text-blue-500 cursor-pointer transition-colors" />
              <Share2 size={20} className="hover:text-blue-500 cursor-pointer transition-colors" />
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="font-black text-sm uppercase tracking-widest text-slate-400">Newsletter</h4>
            <div className="space-y-4">
              <div className="relative">
                <input 
                  type="email" 
                  placeholder="Your email"
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600 font-bold text-sm">Join</button>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Weekly design tips and free assets.</p>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="font-black text-sm uppercase tracking-widest text-slate-400">Contact</h4>
            <div className="space-y-2">
              <p className="text-sm text-slate-500 dark:text-zinc-400">Need a custom tool?</p>
              <a href="mailto:hello@novforms.com" className="text-sm font-bold hover:text-blue-600 transition-colors">hello@novforms.com</a>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 mt-24 pt-8 border-t border-slate-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
          <span>© 2026 NovForms Design Labs</span>
          <div className="flex gap-8">
            <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
            <a href="#" className="hover:text-slate-900 transition-colors">Cookies</a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {(showHistory || showFavorites) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => { setShowHistory(false); setShowFavorites(false); }}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-2xl font-black flex items-center gap-3">
                  {showHistory ? <History size={24} className="text-blue-600" /> : <Star size={24} className="text-yellow-500" />}
                  {showHistory ? 'Recent Creations' : 'Your Favorites'}
                </h3>
                <button onClick={() => { setShowHistory(false); setShowFavorites(false); }} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-8">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {(showHistory ? history : favorites).length === 0 ? (
                    <div className="col-span-full py-20 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-zinc-800 flex items-center justify-center mx-auto text-slate-300">
                        {showHistory ? <History size={32} /> : <Heart size={32} />}
                      </div>
                      <p className="text-slate-500 font-bold">Nothing here yet.</p>
                    </div>
                  ) : (
                    (showHistory ? history : favorites).map((blob) => (
                      <button 
                        key={blob.id}
                        onClick={() => loadBlob(blob)}
                        className="group relative aspect-square bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700 p-4 hover:border-blue-500 transition-all overflow-hidden"
                      >
                        <svg viewBox="0 0 400 400" className="w-full h-full drop-shadow-lg">
                          <path 
                            d={generateBlobPath({
                              size: 400,
                              growth: blob.contrast,
                              edges: blob.complexity,
                              seed: blob.seed,
                              smoothness: blob.smoothness
                            })} 
                            fill={blob.isOutline ? 'none' : blob.color} 
                            stroke={blob.isOutline ? blob.color : 'none'} 
                            strokeWidth={blob.isOutline ? 8 : 0} 
                          />
                        </svg>
                        <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-xl">Apply</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 dark:bg-zinc-950 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {(showHistory ? history : favorites).length} items
                </p>
                <button 
                  onClick={() => {
                    if (showHistory) { setHistory([]); localStorage.removeItem('novforms_history'); }
                    else { setFavorites([]); localStorage.removeItem('novforms_favorites'); }
                  }}
                  className="text-xs font-black text-red-500 hover:underline uppercase tracking-widest"
                >
                  Clear All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
