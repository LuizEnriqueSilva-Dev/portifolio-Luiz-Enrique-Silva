import React, { useState, useEffect, createContext, useContext, ReactNode, FormEvent, Component, ErrorInfo } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useNavigate, 
  useParams,
  Link
} from 'react-router-dom';
import { 
  Plus, 
  FileText, 
  BarChart3, 
  Settings, 
  LogOut, 
  Layout, 
  ChevronRight, 
  MoreVertical, 
  Trash2, 
  Eye, 
  Copy, 
  Share2, 
  CheckCircle2, 
  AlertCircle,
  Menu,
  X,
  User as UserIcon,
  ArrowLeft,
  Save,
  Send,
  PlusCircle,
  GripVertical,
  Circle,
  Dice5,
  Sun,
  Moon,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  serverTimestamp,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { auth, db, googleProvider } from './lib/firebase';
import { cn } from './lib/utils';
import { BlobMaker } from './pages/BlobMaker';

// --- Error Handling ---

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    (this as any).state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const state = (this as any).state;
    if (state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-zinc-950">
          <div className="card p-12 text-center space-y-6 max-w-md border-t-8 border-t-red-500">
            <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto text-red-500">
              <AlertCircle size={40} />
            </div>
            <h2 className="text-3xl font-black">Something went wrong</h2>
            <p className="text-gray-500">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {state.error && (
              <pre className="text-xs text-left bg-gray-100 dark:bg-zinc-900 p-4 rounded-xl overflow-auto max-h-40 text-red-600">
                {state.error.message}
              </pre>
            )}
            <button 
              onClick={() => window.location.reload()} 
              className="btn-primary w-full py-4"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo?: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Types ---

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'select' | 'checkbox' | 'radio';
  required: boolean;
  options?: string[];
}

interface Form {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  fields: FormField[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  isPublished: boolean;
}

interface Submission {
  id: string;
  formId: string;
  data: Record<string, any>;
  submittedAt: Timestamp;
  submittedBy?: string;
}

// --- Auth Context ---

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Theme Context ---

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('novforms_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('novforms_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('novforms_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

const ThemeToggle = () => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  return (
    <button 
      onClick={toggleDarkMode}
      className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-zinc-900 transition-colors text-gray-400"
    >
      {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};

// --- Components ---

const Navbar = () => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-pink flex items-center justify-center text-white font-bold">N</div>
              <span className="font-black text-xl tracking-tight dark:text-white">NovForms</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />

            {user && (
              <div className="hidden md:flex items-center gap-6">
                <Link to="/dashboard" className="text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-brand-pink transition-colors">Dashboard</Link>
                <Link to="/make-forms" className="text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-brand-pink transition-colors">Make Forms</Link>
                <div className="h-4 w-px bg-gray-200 dark:bg-zinc-800" />
                <div className="flex items-center gap-3">
                  <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-gray-100 dark:border-zinc-800" />
                  <button onClick={logout} className="text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-brand-pink transition-colors flex items-center gap-2">
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            )}

            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-gray-600 dark:text-zinc-400">
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white dark:bg-zinc-950 border-b border-gray-100 dark:border-zinc-800 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-4">
              <Link to="/dashboard" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-xl text-base font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-900">Dashboard</Link>
              <Link to="/make-forms" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 rounded-xl text-base font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-900">Make Forms</Link>
              <button onClick={() => { logout(); setIsMenuOpen(false); }} className="w-full text-left px-3 py-2 rounded-xl text-base font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Sign Out</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-950">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-brand-pink border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-500 font-medium">Loading NovForms...</p>
    </div>
  </div>
);

// --- Pages ---

const LandingPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <div className="text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 bg-linear-to-r from-gray-900 to-gray-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
              Build professional forms <br /> in minutes.
            </h1>
            <p className="text-xl text-gray-600 dark:text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              NovForms is the simplest way to create, publish, and analyze forms. 
              Real-time responses, beautiful UI, and zero friction.
            </p>
            <button onClick={login} className="btn-primary text-lg px-8 py-4 flex items-center gap-3 mx-auto">
              <UserIcon size={20} /> Get Started with Google
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="relative mt-20"
          >
            <div className="absolute inset-0 bg-brand-pink/10 blur-3xl rounded-full -z-10" />
            <div className="card p-4 md:p-8 max-w-4xl mx-auto overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-zinc-800 pb-4">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="ml-4 h-6 w-48 bg-gray-100 dark:bg-zinc-800 rounded" />
              </div>
              <div className="space-y-6 text-left">
                <div className="h-8 w-1/2 bg-gray-100 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-3/4 bg-gray-50 dark:bg-zinc-900 rounded" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-100 dark:bg-zinc-800 rounded" />
                    <div className="h-12 w-full bg-gray-50 dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-100 dark:bg-zinc-800 rounded" />
                    <div className="h-12 w-full bg-gray-50 dark:bg-zinc-900 rounded-xl border border-gray-100 dark:border-zinc-800" />
                  </div>
                </div>
                <div className="h-12 w-32 bg-brand-pink rounded-xl" />
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'forms'),
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const formsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Form[];
      setForms(formsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'forms');
    });

    return () => unsubscribe();
  }, [user]);

  const createNewForm = async () => {
    if (!user) return;
    
    const newForm = {
      ownerId: user.uid,
      title: 'Untitled Form',
      description: 'Add a description here...',
      fields: [
        { id: Math.random().toString(36).substr(2, 9), label: 'Full Name', type: 'text', required: true }
      ],
      createdAt: serverTimestamp(),
      isPublished: false
    };

    try {
      const docRef = await addDoc(collection(db, 'forms'), newForm);
      navigate(`/builder/${docRef.id}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'forms');
    }
  };

  const deleteForm = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this form?')) {
      try {
        await deleteDoc(doc(db, 'forms', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `forms/${id}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-3xl font-black tracking-tight mb-2 dark:text-white">Your Forms</h1>
            <p className="text-gray-500 dark:text-zinc-400">Manage and analyze your active forms.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/make-forms')} 
              className="px-6 py-3 rounded-2xl font-bold border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all flex items-center gap-2"
            >
              <Dice5 size={20} className="text-blue-600" /> Design with NovForms
            </button>
            <button onClick={createNewForm} className="btn-primary flex items-center gap-2">
              <Plus size={20} /> Create New Form
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="card h-48 animate-pulse bg-gray-100 dark:bg-zinc-900" />
            ))}
          </div>
        ) : forms.length === 0 ? (
          <div className="card p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-gray-400">
              <FileText size={32} />
            </div>
            <h3 className="text-xl font-bold dark:text-white">No forms yet</h3>
            <p className="text-gray-500 max-w-xs mx-auto">Create your first form to start collecting responses.</p>
            <button onClick={createNewForm} className="text-brand-pink font-bold hover:underline">Start Building →</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map(form => (
              <motion.div
                key={form.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card group hover:border-brand-pink transition-all overflow-hidden"
              >
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider",
                      form.isPublished ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400"
                    )}>
                      {form.isPublished ? 'Published' : 'Draft'}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => navigate(`/builder/${form.id}`)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                        <Settings size={16} className="text-gray-400 dark:text-zinc-500" />
                      </button>
                      <button onClick={() => deleteForm(form.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-lg mb-1 group-hover:text-brand-pink transition-colors truncate dark:text-white">{form.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 line-clamp-2">{form.description || 'No description provided.'}</p>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Layout size={14} /> {form.fields.length} fields</span>
                    </div>
                    <Link to={`/submissions/${form.id}`} className="text-xs font-bold text-brand-pink flex items-center gap-1 hover:underline">
                      <BarChart3 size={14} /> View Results
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const FormBuilder = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = onSnapshot(doc(db, 'forms', id), (doc) => {
      if (doc.exists()) {
        setForm({ id: doc.id, ...doc.data() } as Form);
      } else {
        setForm(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `forms/${id}`);
    });
    return () => unsubscribe();
  }, [id]);

  const saveForm = async () => {
    if (!form || !id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'forms', id), {
        ...form,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `forms/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    if (!form) return;
    const newField: FormField = {
      id: Math.random().toString(36).substr(2, 9),
      label: 'New Question',
      type: 'text',
      required: false
    };
    setForm({ ...form, fields: [...form.fields, newField] });
  };

  const removeField = (fieldId: string) => {
    if (!form) return;
    setForm({ ...form, fields: form.fields.filter(f => f.id !== fieldId) });
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    if (!form) return;
    setForm({
      ...form,
      fields: form.fields.map(f => {
        if (f.id === fieldId) {
          const updated = { ...f, ...updates };
          if (['select', 'radio', 'checkbox'].includes(updated.type) && !updated.options) {
            updated.options = ['Option 1'];
          }
          return updated;
        }
        return f;
      })
    });
  };

  const copyFormLink = () => {
    if (!id) return;
    const url = `${window.location.origin}/v/${id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <LoadingScreen />;
  if (!form) return <div className="p-12 text-center">Form not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Navbar />
      
      {/* Builder Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 px-4 py-4 sticky top-16 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-600 dark:text-zinc-400">
              <ArrowLeft size={20} />
            </button>
            <div className="h-6 w-px bg-gray-200 dark:bg-zinc-800" />
            <input 
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="bg-transparent font-bold text-lg focus:outline-none border-b border-transparent focus:border-brand-pink transition-all dark:text-white"
              placeholder="Form Title"
            />
          </div>
          <div className="flex items-center gap-3">
            {form.isPublished && (
              <button 
                onClick={copyFormLink}
                className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-xl hover:text-brand-pink transition-colors flex items-center gap-2 text-xs font-bold"
              >
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
            )}
            <button 
              onClick={() => setForm({ ...form, isPublished: !form.isPublished })}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                form.isPublished ? "bg-green-50 text-green-600 border border-green-100 dark:bg-green-900/20 dark:border-green-900/30 dark:text-green-400" : "bg-gray-50 text-gray-600 border border-gray-100 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
              )}
            >
              {form.isPublished ? <CheckCircle2 size={16} /> : <Circle size={16} />} 
              {form.isPublished ? 'Published' : 'Draft'}
            </button>
            <button onClick={saveForm} disabled={saving} className="btn-primary py-2 flex items-center gap-2">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
              Save
            </button>
            {form.isPublished && (
              <Link to={`/v/${form.id}`} target="_blank" className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-xl hover:text-brand-pink transition-colors text-gray-600 dark:text-zinc-400">
                <Eye size={20} />
              </Link>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        {/* Form Meta */}
        <div className="card p-8 space-y-4">
          <textarea 
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full bg-transparent text-gray-500 dark:text-zinc-400 focus:outline-none resize-none dark:placeholder-zinc-600"
            placeholder="Form description..."
            rows={2}
          />
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <AnimatePresence>
            {form.fields.map((field, index) => (
              <motion.div
                key={field.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="card p-6 group relative"
              >
                <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                  <GripVertical size={16} className="text-gray-300 dark:text-zinc-700" />
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-grow space-y-4">
                    <input 
                      value={field.label}
                      onChange={(e) => updateField(field.id, { label: e.target.value })}
                      className="w-full bg-transparent font-bold text-lg focus:outline-none border-b border-gray-100 dark:border-zinc-800 focus:border-brand-pink transition-all dark:text-white"
                      placeholder="Question Label"
                    />
                    
                    <div className="flex flex-wrap gap-4">
                      <select 
                        value={field.type}
                        onChange={(e) => updateField(field.id, { type: e.target.value as any })}
                        className="bg-gray-50 dark:bg-zinc-800 px-3 py-2 rounded-lg text-sm font-medium focus:outline-none dark:text-white border border-gray-100 dark:border-zinc-700"
                      >
                        <option value="text">Short Text</option>
                        <option value="textarea">Long Text</option>
                        <option value="number">Number</option>
                        <option value="email">Email</option>
                        <option value="select">Dropdown</option>
                        <option value="checkbox">Checkbox</option>
                        <option value="radio">Multiple Choice</option>
                      </select>

                      <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={field.required}
                          onChange={(e) => updateField(field.id, { required: e.target.checked })}
                          className="w-4 h-4 rounded border-gray-300 text-brand-pink focus:ring-brand-pink"
                        />
                        Required
                      </label>
                    </div>

                    {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                      <div className="space-y-2 pt-4">
                        <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Options</p>
                        {(field.options || ['Option 1']).map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-zinc-700" />
                            <input 
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...(field.options || ['Option 1'])];
                                newOpts[i] = e.target.value;
                                updateField(field.id, { options: newOpts });
                              }}
                              className="flex-grow bg-transparent text-sm focus:outline-none border-b border-transparent focus:border-gray-200 dark:focus:border-zinc-700 dark:text-zinc-300"
                            />
                            <button 
                              onClick={() => {
                                const newOpts = (field.options || []).filter((_, idx) => idx !== i);
                                updateField(field.id, { options: newOpts });
                              }}
                              className="text-gray-300 dark:text-zinc-700 hover:text-red-400 dark:hover:text-red-500"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => updateField(field.id, { options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })}
                          className="text-xs text-brand-pink font-bold hover:underline flex items-center gap-1"
                        >
                          <Plus size={12} /> Add Option
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col justify-end gap-2">
                    <button onClick={() => removeField(field.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <button onClick={addField} className="w-full py-6 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-3xl text-gray-400 dark:text-zinc-500 hover:text-brand-pink dark:hover:text-brand-pink hover:border-brand-pink dark:hover:border-brand-pink transition-all flex flex-col items-center gap-2">
            <PlusCircle size={24} />
            <span className="font-bold">Add Question</span>
          </button>
        </div>
      </main>
    </div>
  );
};

const FormViewer = () => {
  const { id } = useParams();
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!id) return;
    const fetchForm = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'forms', id));
        if (docSnap.exists() && docSnap.data().isPublished) {
          setForm({ id: docSnap.id, ...docSnap.data() } as Form);
        }
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `forms/${id}`);
      }
    };
    fetchForm();
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || !id) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'forms', id, 'submissions'), {
        formId: id,
        data: formData,
        submittedAt: serverTimestamp(),
        submittedBy: auth.currentUser?.uid || null
      });
      setSubmitted(true);
    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!form) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-zinc-950">
      <div className="card p-12 text-center space-y-4 max-w-md">
        <AlertCircle size={48} className="text-red-400 mx-auto" />
        <h2 className="text-2xl font-black dark:text-white">Form Not Found</h2>
        <p className="text-gray-500">This form may have been deleted or is not currently published.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-zinc-950">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card p-12 text-center space-y-6 max-w-md"
      >
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto text-green-500">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-3xl font-black dark:text-white">Thank you!</h2>
        <p className="text-gray-500">Your response has been successfully recorded.</p>
        <button onClick={() => window.location.reload()} className="text-brand-pink font-bold hover:underline">Submit another response</button>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 py-12 px-4 transition-colors duration-300">
      <div className="fixed top-6 right-6 z-50">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 p-1">
          <ThemeToggle />
        </div>
      </div>
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="card p-8 border-t-8 border-t-brand-pink">
          <h1 className="text-4xl font-black mb-4 dark:text-white">{form.title}</h1>
          {form.description && <p className="text-gray-500 dark:text-zinc-400">{form.description}</p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {form.fields.map(field => (
            <div key={field.id} className="card p-8 space-y-4">
              <label className="block font-bold text-lg dark:text-white">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              
              {field.type === 'text' && (
                <input 
                  type="text" 
                  required={field.required}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  className="w-full input-field"
                  placeholder="Your answer"
                />
              )}

              {field.type === 'textarea' && (
                <textarea 
                  required={field.required}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  className="w-full input-field min-h-[120px]"
                  placeholder="Your answer"
                />
              )}

              {field.type === 'number' && (
                <input 
                  type="number" 
                  required={field.required}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  className="w-full input-field"
                  placeholder="0"
                />
              )}

              {field.type === 'email' && (
                <input 
                  type="email" 
                  required={field.required}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  className="w-full input-field"
                  placeholder="email@example.com"
                />
              )}

              {field.type === 'select' && (
                <select 
                  required={field.required}
                  onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                  className="w-full input-field"
                >
                  <option value="">Select an option</option>
                  {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              )}

              {(field.type === 'radio' || field.type === 'checkbox') && (
                <div className="space-y-3">
                  {field.options?.map(opt => (
                    <label key={opt} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors">
                      <input 
                        type={field.type}
                        name={field.id}
                        required={field.required && field.type === 'radio'}
                        onChange={(e) => {
                          if (field.type === 'radio') {
                            setFormData({ ...formData, [field.id]: opt });
                          } else {
                            const current = formData[field.id] || [];
                            const next = e.target.checked ? [...current, opt] : current.filter((v: string) => v !== opt);
                            setFormData({ ...formData, [field.id]: next });
                          }
                        }}
                        className="w-5 h-5 border-gray-300 text-brand-pink focus:ring-brand-pink"
                      />
                      <span className="text-gray-700 dark:text-zinc-300">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="flex justify-between items-center">
            <button 
              type="submit" 
              disabled={submitting}
              className="btn-primary px-12 py-4 flex items-center gap-3"
            >
              {submitting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={20} />}
              Submit Form
            </button>
            <button type="button" onClick={() => setFormData({})} className="text-gray-400 hover:text-gray-600 font-medium">Clear form</button>
          </div>
        </form>

        <div className="text-center pt-12">
          <p className="text-xs text-gray-400">Powered by <span className="font-black text-gray-500">NovForms</span></p>
        </div>
      </div>
    </div>
  );
};

const SubmissionsView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    
    const fetchForm = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'forms', id));
        if (docSnap.exists()) {
          setForm({ id: docSnap.id, ...docSnap.data() } as Form);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `forms/${id}`);
      }
    };

    const q = query(
      collection(db, 'forms', id, 'submissions'),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Submission[];
      setSubmissions(subsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `forms/${id}/submissions`);
    });

    fetchForm();
    return () => unsubscribe();
  }, [id]);

  if (loading) return <LoadingScreen />;
  if (!form) return <div className="p-12 text-center">Form not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center gap-4 mb-12">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg text-gray-600 dark:text-zinc-400">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight dark:text-white">{form.title}</h1>
            <p className="text-gray-500 dark:text-zinc-400">{submissions.length} total responses</p>
          </div>
        </div>

        {submissions.length === 0 ? (
          <div className="card p-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-gray-400">
              <BarChart3 size={32} />
            </div>
            <h3 className="text-xl font-bold dark:text-white">No responses yet</h3>
            <p className="text-gray-500">Share your form to start collecting data.</p>
            <div className="flex justify-center gap-4 pt-4">
              <button 
                onClick={() => {
                  const url = `${window.location.origin}/v/${form.id}`;
                  navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="btn-primary flex items-center gap-2"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied!' : 'Copy Form Link'}
              </button>
            </div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400">Submitted At</th>
                    {form.fields.map(f => (
                      <th key={f.id} className="px-6 py-4 text-xs font-black uppercase tracking-wider text-gray-400">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {submissions.map(sub => (
                    <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-zinc-400">
                        {sub.submittedAt?.toDate().toLocaleString()}
                      </td>
                      {form.fields.map(f => (
                        <td key={f.id} className="px-6 py-4 text-sm dark:text-zinc-300">
                          {Array.isArray(sub.data[f.id]) ? sub.data[f.id].join(', ') : sub.data[f.id] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// --- Main App ---

const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading ? children : <LoadingScreen />}
    </AuthContext.Provider>
  );
};

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" />;
  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/builder/:id" element={<ProtectedRoute><FormBuilder /></ProtectedRoute>} />
              <Route path="/submissions/:id" element={<ProtectedRoute><SubmissionsView /></ProtectedRoute>} />
              <Route path="/make-forms" element={<BlobMaker />} />
              <Route path="/v/:id" element={<FormViewer />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
