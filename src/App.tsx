/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  History,
  LayoutDashboard, 
  PlusCircle, 
  ListTodo, 
  Archive, 
  User as UserIcon, 
  ShieldCheck, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Menu,
  X,
  Bell,
  Search,
  ExternalLink,
  MessageSquare,
  LogIn,
  LogOut,
  Lock,
  Mail,
  User,
  Settings,
  Moon,
  Sun,
  Users,
  ShieldAlert,
  Check,
  XCircle,
  Eye,
  EyeOff,
  UserSearch,
  Filter,
  Zap,
  BarChart3,
  Activity,
  Target,
  ArchiveRestore,
  Pin,
  PinOff,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from './lib/firebase';
import { firebaseService } from './services/firebaseService';
import { notificationService } from './services/notificationService';
import { Request, Division, RequestStatus, QAStatus, RequestComment, Config, RequestSubtaskKey, REQUEST_SUBTASKS } from './types';
import ConfigManagementView from './components/ConfigManagementView';
import { APP_CONFIG, BRAND_COLORS, DIVISION_CATEGORIES } from './constants';
import { calculateSLA } from './lib/sla';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';

// Injected at build time by Vite (see vite.config.ts `define`)
declare const __BUILD_TIME__: string;
const BUILD_TIME: string = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

export type UserRole = string;

interface NotificationSettings {
  emailEnabled: boolean;
  notifyTeamAssignment: boolean;
  notifyStatusChange: boolean;
  notifyQaChange: boolean;
  notifyNewComment: boolean;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  emailEnabled: true,
  notifyTeamAssignment: true,
  notifyStatusChange: true,
  notifyQaChange: true,
  notifyNewComment: true
};

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  pinnedRequestIds?: string[];
  notificationSettings?: NotificationSettings;
  mappedOwner?: string;
}

const ADMIN_EMAILS = ['ecom_ai_qa@public.gr'];

export function hasPermission(
  role: string | undefined, 
  permission: 'create_requests' | 'update_qa_status' | 'update_flow_status' | 'view_admin_panel' | 'admin_configurations',
  appConfig: Config
): boolean {
  if (!role) return false;
  
  const lowerRole = role.toLowerCase();
  if (lowerRole === 'owner' || lowerRole === 'admin') {
    return true; // owners and admins always have all privileges
  }

  // Fallbacks in case ROLE_PERMISSIONS is not defined yet or not configured for this specific role
  const defaultPermissions: Record<string, string[]> = {
    'Team Leader': ['update_flow_status'],
    'Manager': ['update_flow_status'],
    'Digital Merch': ['create_requests']
  };

  const configuredPermissions = (appConfig as any).ROLE_PERMISSIONS;
  if (configuredPermissions && configuredPermissions[role]) {
    return configuredPermissions[role].includes(permission);
  }
  
  const matches = defaultPermissions[role] || [];
  return matches.includes(permission);
}

let globalSigningIn = false;

// --- Components ---

const LoginView = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    globalSigningIn = true;
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // Check/create user profile immediately upon successful login popup
      const profile = await firebaseService.getUserProfile(firebaseUser.uid);
      if (!profile) {
        const isAdminEmail = ADMIN_EMAILS.includes(firebaseUser.email || '');
        let role: UserRole = isAdminEmail ? 'owner' : 'Team Leader';
        let status: 'pending' | 'approved' = isAdminEmail ? 'approved' : 'pending';

        // Check if user is pre-authorized
        let isPreAuthorized = false;
        let mappedOwner = '';
        if (!isAdminEmail && firebaseUser.email) {
          const invite = await firebaseService.getAuthorizedEmail(firebaseUser.email);
          if (invite) {
            role = invite.role as UserRole;
            status = 'approved';
            isPreAuthorized = true;
            mappedOwner = invite.mappedOwner || '';
          }
        }

        const newProfile = {
          name: firebaseUser.displayName || 'No Name',
          email: firebaseUser.email || '',
          role,
          status,
          mappedOwner,
          notificationSettings: DEFAULT_NOTIFICATION_SETTINGS
        };

        await firebaseService.createUserProfile(firebaseUser.uid, newProfile as any);

        if (isPreAuthorized && firebaseUser.email) {
          await firebaseService.deleteAuthorizedEmail(firebaseUser.email);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
      setIsLoading(false);
      globalSigningIn = false;
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-6 ${isDarkMode ? 'bg-dark-950' : 'bg-[#F9FAFB]'}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#FE5900] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-500/20">
            <div className="w-8 h-8 bg-white rounded-lg"></div>
          </div>
          <h1 className={`text-4xl font-black tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Request<span className="text-[#FE5900]">Tracker</span></h1>
          <p className="text-gray-500 font-medium tracking-tight">Enterprise Request Management System</p>
        </div>

        <div className={`p-10 rounded-[2.5rem] border ${isDarkMode ? 'dark-card' : 'bg-white shadow-[0_20px_50px_rgba(0,0,0,0.05)] border-gray-100'}`}>
          <div className="text-center mb-8">
            <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Welcome</h2>
            <p className="text-sm text-gray-500">Sign in to manage your project requests</p>
          </div>

          <button 
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className={`w-full py-4 border-2 rounded-2xl font-bold shadow-sm active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-3 cursor-pointer ${
              isDarkMode 
                ? 'bg-dark-800 border-dark-700 text-gray-200 hover:bg-dark-700' 
                : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {isLoading ? (
              <div className="w-6 h-6 border-4 border-[#FE5900]/30 border-t-[#FE5900] rounded-full animate-spin"></div>
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
                Continue with Google
              </>
            )}
          </button>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-xs font-bold uppercase tracking-wide"
            >
              <AlertCircle size={16} />
              {error}
            </motion.div>
          )}

          <div className="mt-8 pt-8 border-t border-gray-50 text-center">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Enterprise Access Restricted</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- Components ---

const CustomSelect = ({ 
  label, 
  value, 
  options, 
  onChange, 
  placeholder = "Select...", 
  disabled = false,
  className = "",
  isDarkMode = false,
  hasError = false
}: { 
  label?: string, 
  value: string, 
  options: { value: string, label: string }[], 
  onChange: (val: string) => void,
  placeholder?: string,
  disabled?: boolean,
  className?: string,
  isDarkMode?: boolean,
  hasError?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const fillSpace = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - fillSpace.bottom;
      setOpenUp(spaceBelow < 250);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleToggle = (e: React.MouseEvent) => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative ${isOpen ? 'z-[155]' : 'z-10'} ${className}`} ref={containerRef}>
      {label && <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between px-4 py-3 border rounded-xl transition-all outline-none font-medium text-sm text-left shadow-sm ${
          hasError
            ? (isDarkMode ? 'bg-dark-900 border-red-500/80 ring-2 ring-red-500/10' : 'bg-white border-red-500 ring-2 ring-red-500/10')
            : isDarkMode 
              ? `bg-dark-900 border-dark-800 ${isOpen ? 'ring-orange-500/10 border-orange-500' : 'hover:border-dark-700'}` 
              : `bg-white border-gray-200 ${isOpen ? 'border-[#FE5900] ring-4 ring-[#FE5900]/5' : 'hover:border-gray-300'}`
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}`}
      >
        <span className={`whitespace-nowrap ${value ? (isDarkMode ? 'text-gray-100' : 'text-gray-900') : 'text-gray-400'}`}>
          {options.find(o => o.value === value)?.label || placeholder}
        </span>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={18} className="text-[#FE5900]" />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: openUp ? -4 : 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUp ? -4 : 4, scale: 0.98 }}
            className={`absolute left-0 right-0 z-[100] ${openUp ? 'bottom-full mb-2' : 'mt-2'} rounded-2xl shadow-2xl border overflow-hidden py-2 ${
              isDarkMode ? 'bg-dark-800 border-dark-700' : 'bg-white border-gray-100'
            }`}
          >
            <div className={`max-h-[300px] overflow-y-auto custom-scrollbar`}>
              {options.length > 0 ? options.map((option) => {
                const isSelected = value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-sm transition-all flex items-center justify-between ${
                      isSelected 
                        ? isDarkMode ? 'bg-orange-500/10 text-orange-500 font-bold' : 'bg-orange-50 text-[#FE5900] font-bold' 
                        : isDarkMode ? 'text-gray-400 font-medium hover:bg-dark-700 hover:text-gray-200' : 'text-gray-600 font-medium hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {option.label}
                    {isSelected && <CheckCircle2 size={16} />}
                  </button>
                );
              }) : (
                <div className="px-4 py-3 text-sm text-gray-400 italic">No options available</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CompactSelect = ({ 
  value, 
  options, 
  onChange, 
  variant = 'default',
  disabled = false,
  isDarkMode = false,
  onOpenChange,
  title
}: { 
  value: string, 
  options: { value: string, label: string }[], 
  onChange: (val: string) => void,
  variant?: 'status' | 'qa' | 'default',
  disabled?: boolean,
  isDarkMode?: boolean,
  onOpenChange?: (open: boolean) => void,
  title?: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUp(spaceBelow < 200);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getVariantStyles = () => {
    if (variant === 'status') {
      if (isDarkMode) {
        const styles: Record<string, string> = {
          'Live': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          'Delayed': 'bg-red-500/10 text-red-400 border-red-500/20',
          'In Progress': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
          'Blocked': 'bg-zinc-800 text-gray-300 border-zinc-700',
          'Not Started': 'bg-zinc-850 text-zinc-400 border-zinc-700',
          'Pending': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          'default': 'bg-zinc-800 text-zinc-400 border-zinc-700'
        };
        return styles[value] || styles.default;
      } else {
        const styles: Record<string, string> = {
          'Live': 'bg-emerald-50 text-emerald-600 border-emerald-100',
          'Delayed': 'bg-red-50 text-red-600 border-red-100',
          'In Progress': 'bg-orange-50 text-[#FE5900] border-orange-100',
          'Blocked': 'bg-gray-900 text-white border-transparent',
          'Not Started': 'bg-gray-50 text-gray-400 border-gray-100',
          'Pending': 'bg-amber-50 text-amber-600 border-amber-100',
          'default': 'bg-gray-50 text-gray-400 border-gray-100'
        };
        return styles[value] || styles.default;
      }
    }
    if (variant === 'qa') {
      if (isDarkMode) {
        const styles: Record<string, string> = {
          'Approved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          'Rejected': 'bg-red-500/10 text-red-400 border-red-500/20',
          'Pending': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
          'Waiting': 'bg-zinc-850 text-zinc-400 border-zinc-700',
          'default': 'bg-zinc-800 text-zinc-450 border-zinc-700'
        };
        return styles[value] || styles.default;
      } else {
        const styles: Record<string, string> = {
          'Approved': 'bg-emerald-50 text-emerald-600 border-emerald-100',
          'Rejected': 'bg-red-50 text-red-600 border-red-100',
          'Pending': 'bg-purple-50 text-purple-600 border-purple-100',
          'Waiting': 'bg-gray-50 text-gray-400 border-gray-100',
          'default': 'bg-gray-50 text-gray-400 border-gray-100'
        };
        return styles[value] || styles.default;
      }
    }
    return isDarkMode ? 'bg-dark-900 border-dark-700 text-gray-300' : 'bg-white border-gray-200 text-gray-600';
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  if (disabled) {
    return (
      <div 
        title={title}
        className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-2 min-w-[120px] justify-center border whitespace-nowrap select-none ${getVariantStyles()}`}
      >
        <span className="uppercase tracking-wider whitespace-nowrap">
          {options.find(o => o.value === value)?.label || value}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative ${isOpen ? 'z-[155]' : 'z-10'}`} ref={containerRef}>
      <button
        type="button"
        onClick={handleToggle}
        title={title}
        className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-2 min-w-[120px] justify-between border shadow-sm whitespace-nowrap ${getVariantStyles()} ${
          isOpen 
            ? isDarkMode ? 'ring-2 ring-orange-500/20 outline-none border-orange-500' : 'ring-2 ring-orange-100 outline-none border-orange-300' 
            : ''
        } cursor-pointer hover:shadow`}
      >
        <span className="uppercase tracking-wider whitespace-nowrap">
          {options.find(o => o.value === value)?.label || value}
        </span>
        <ChevronDown size={12} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: openUp ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: openUp ? 4 : -4 }}
            className={`absolute left-0 z-[250] ${openUp ? 'bottom-full mb-1' : 'mt-1'} rounded-xl shadow-2xl border py-1.5 min-w-[140px] ${
              isDarkMode ? 'bg-dark-800 border-dark-700 text-gray-100' : 'bg-white border-gray-100 text-gray-900'
            }`}
          >
            <div className={`max-h-[250px] overflow-y-auto custom-scrollbar`}>
              {options.map((option) => {
                const isSelected = value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-[10px] font-bold transition-all flex items-center justify-between ${
                      isSelected 
                        ? isDarkMode ? 'text-orange-500 bg-orange-500/10' : 'text-[#FE5900] bg-orange-50' 
                        : isDarkMode ? 'text-gray-400 hover:bg-dark-700 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className="uppercase tracking-wide">{option.label}</span>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#FE5900]" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick,
  isDarkMode = false
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void,
  isDarkMode?: boolean
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 relative cursor-pointer group ${
      active 
        ? 'text-[#FE5900] font-bold shadow-sm shadow-[#FE5900]/5' 
        : isDarkMode 
          ? 'text-gray-400 hover:bg-dark-800 hover:text-gray-150'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
    }`}
  >
    {active && (
      <motion.div 
        layoutId="activeSidebarIndicator"
        className={`absolute inset-0 rounded-xl ${isDarkMode ? 'bg-orange-500/10 border-l-[3px] border-[#FE5900]' : 'bg-[#FE5900]/10 border-l-[3px] border-[#FE5900]'}`}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
      />
    )}
    <span className="relative z-10 flex items-center gap-3">
      <Icon size={18} className={`transition-transform duration-300 group-hover:scale-110 ${active ? 'text-[#FE5900]' : 'text-gray-400'}`} />
      <span className="text-sm font-semibold tracking-tight">{label}</span>
    </span>
  </button>
);

const StatCard = ({ label, value, color, icon: Icon, isDarkMode = false, onClick }: { label: string, value: number, color: string, icon: any, isDarkMode?: boolean, onClick?: () => void }) => {
  const getTheme = (c: string) => {
    if (c.includes('blue')) return { border: 'border-blue-500', text: 'text-blue-500', bg: 'bg-blue-50', darkText: 'text-blue-400' };
    if (c.includes('FE5900')) return { border: 'border-[#FE5900]', text: 'text-[#FE5900]', bg: 'bg-[#FE5900]/10', darkText: 'text-[#FE5900]' };
    if (c.includes('purple')) return { border: 'border-purple-500', text: 'text-purple-500', bg: 'bg-purple-50', darkText: 'text-purple-400' };
    if (c.includes('red')) return { border: 'border-red-500', text: 'text-red-500', bg: 'bg-red-50', darkText: 'text-red-400' };
    if (c.includes('gray')) return { border: 'border-gray-500', text: 'text-gray-500', bg: 'bg-gray-50', darkText: 'text-gray-400' };
    if (c.includes('emerald')) return { border: 'border-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-50', darkText: 'text-emerald-400' };
    return { border: 'border-gray-200', text: 'text-gray-500', bg: 'bg-gray-50', darkText: 'text-gray-400' };
  };

  const theme = getTheme(color);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className={`relative p-5 rounded-[2rem] border-2 transition-all duration-300 overflow-hidden group ${
        onClick ? 'cursor-pointer' : ''
      } ${
        isDarkMode 
          ? `bg-dark-900 border-dark-800 hover:${theme.border}` 
          : `bg-white border-gray-100 hover:${theme.border}/30 shadow-sm`
      }`}
    >
      <div className={`absolute top-0 left-0 w-1.5 h-full ${color}`} />
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-xl transition-all ${
          isDarkMode ? 'bg-dark-800' : theme.bg
        } group-hover:scale-110`}>
          <Icon size={18} className={isDarkMode ? theme.darkText : theme.text} />
        </div>
        <p className={`text-4xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900 group-hover:' + theme.text}`}>{value}</p>
      </div>
      <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>{label}</p>
    </motion.div>
  );
};

const SettingsView = ({ 
  isDarkMode, 
  onToggleDarkMode, 
  compactView,
  onToggleCompactView,
  user,
  isActuallyAdmin,
  mockRole,
  onMockRole,
  onUpdateNotificationSettings,
  appConfig
}: { 
  isDarkMode: boolean, 
  onToggleDarkMode: () => void, 
  compactView: boolean,
  onToggleCompactView: () => void,
  user: AuthUser,
  isActuallyAdmin?: boolean,
  mockRole?: UserRole | null,
  onMockRole?: (role: UserRole | null) => void,
  onUpdateNotificationSettings: (settings: NotificationSettings) => void,
  appConfig: Config,
  key?: string
}) => {
  const dynamicRoles = appConfig?.ROLES_LIST || ['owner', 'admin', 'Team Leader', 'Manager', 'Digital Merch'];
  const roleOptions = dynamicRoles
    .filter(r => r.toLowerCase() !== 'owner')
    .map(r => ({ value: r, label: r === 'admin' ? 'Admin' : r }));

  const currentSettings = user.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS;
  const effectiveRole = (isActuallyAdmin && mockRole) ? mockRole : user.role;

  const handleToggle = (key: keyof NotificationSettings) => {
    const updated = {
      ...currentSettings,
      [key]: !currentSettings[key]
    };
    onUpdateNotificationSettings(updated);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="mb-8">
        <h2 className={`text-3xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
        <p className="text-gray-500 mt-1">Manage your application preferences and account settings.</p>
      </div>

      <div className={`rounded-[2.5rem] border transition-colors duration-300 overflow-hidden ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100 shadow-sm'}`}>
        {isActuallyAdmin && onMockRole && (
          <div className={`p-8 border-b ${isDarkMode ? 'border-dark-800' : 'border-gray-100'}`}>
            <h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Developer Controls</h3>
            <div className={`p-6 rounded-2xl border transition-colors ${isDarkMode ? 'bg-dark-800 border-dark-700' : 'bg-gray-50 border-gray-100 shadow-inner'}`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${mockRole ? 'bg-orange-500/10 text-orange-500' : 'bg-orange-100 text-[#FE5900]'}`}>
                    <UserSearch size={24} />
                  </div>
                  <div>
                    <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>"View As" Role Simulation</p>
                    <p className="text-xs text-gray-400 font-medium tracking-tight">Test the application interface with different permission levels</p>
                  </div>
                </div>
                <div className={`p-1 rounded-2xl flex gap-1 ${isDarkMode ? 'bg-dark-900' : 'bg-gray-200/50'}`}>
                  <button
                    onClick={() => onMockRole(null)}
                    className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
                      mockRole === null
                        ? 'bg-[#FE5900] text-white shadow-lg shadow-orange-500/20'
                        : isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Default
                  </button>
                  {roleOptions.filter(r => r.value !== 'admin').map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => onMockRole(opt.value)}
                      className={`flex-1 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer whitespace-nowrap ${
                        mockRole === opt.value
                          ? 'bg-[#FE5900] text-white shadow-lg shadow-orange-500/20'
                          : isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className={`p-8 border-b ${isDarkMode ? 'border-dark-800' : 'border-gray-100'}`}>
          <h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Appearance & Interface</h3>
          
          <div className="space-y-4">
            <div className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${isDarkMode ? 'bg-dark-800 border-dark-700' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isDarkMode ? 'bg-orange-500/10 text-orange-500' : 'bg-orange-100 text-[#FE5900]'}`}>
                  {isDarkMode ? <Moon size={24} /> : <Sun size={24} />}
                </div>
                <div>
                  <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Dark Theme</p>
                  <p className="text-xs text-gray-400 font-medium tracking-tight">Toggle between light and dark visual modes</p>
                </div>
              </div>
              <button 
                onClick={onToggleDarkMode}
                className={`w-14 h-8 rounded-full relative transition-all duration-300 cursor-pointer ${isDarkMode ? 'bg-[#FE5900]' : 'bg-gray-200'}`}
              >
                <motion.div 
                  animate={{ x: isDarkMode ? 24 : 4 }}
                  className="absolute top-1 w-6 h-6 rounded-full shadow-lg bg-white"
                />
              </button>
            </div>

            <div className={`flex items-center justify-between p-4 rounded-2xl border transition-colors ${isDarkMode ? 'bg-dark-800 border-dark-700' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isDarkMode ? 'bg-orange-500/10 text-orange-500' : 'bg-orange-100 text-[#FE5900]'}`}>
                  <Activity size={24} />
                </div>
                <div>
                  <p className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Compact View</p>
                  <p className="text-xs text-gray-400 font-medium tracking-tight">Reduce vertical padding in tables and lists</p>
                </div>
              </div>
              <button 
                onClick={onToggleCompactView}
                className={`w-14 h-8 rounded-full relative transition-all duration-300 cursor-pointer ${compactView ? 'bg-[#FE5900]' : 'bg-gray-200'}`}
              >
                <motion.div 
                  animate={{ x: compactView ? 24 : 4 }}
                  className="absolute top-1 w-6 h-6 rounded-full shadow-lg bg-white"
                />
              </button>
            </div>
          </div>
        </div>

         <div className="p-8">
          <h3 className={`text-lg font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Account Profile</h3>
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <div className={`w-20 h-20 border-4 rounded-2xl flex items-center justify-center text-3xl font-black shadow-xl ${
                isDarkMode 
                  ? 'bg-dark-800 border-dark-700 text-orange-500 shadow-black/40' 
                  : 'bg-orange-100 border-orange-50 text-[#FE5900] shadow-orange-500/10'
              }`}>
                {user.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <p className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{user.name}</p>
                <p className="text-gray-500 font-medium tracking-tight">{user.email}</p>
                <div className={`mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-400 inline-block shadow-sm ${
                  isDarkMode ? 'bg-dark-800' : 'bg-gray-100'
                }`}>
                  {user.role} Access
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`p-6 rounded-[2rem] border transition-colors duration-300 ${isDarkMode ? 'bg-dark-900/40 border-dark-800' : 'bg-gray-50 border-gray-100'}`}>
          <h4 className={`text-xs font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Region & Locale</h4>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 font-medium">Timezone</span>
            <span className={isDarkMode ? 'text-gray-300' : 'text-gray-800 font-bold'}>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-500 font-medium">Language</span>
            <span className={isDarkMode ? 'text-gray-300' : 'text-gray-800 font-bold'}>English (US)</span>
          </div>
        </div>
        
        <div className={`p-6 rounded-[2rem] border transition-colors duration-300 ${isDarkMode ? 'bg-dark-900/40 border-dark-800' : 'bg-gray-50 border-gray-100'}`}>
           <h4 className={`text-xs font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Application Info</h4>
           <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 font-medium">Version</span>
            <span className={isDarkMode ? 'text-gray-300 font-black' : 'text-[#FE5900] font-black'}>1.0.6 Stable</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-500 font-medium">Last Sync</span>
            <span className={isDarkMode ? 'text-gray-300' : 'text-gray-800 font-bold'}>Real-time Active</span>
          </div>
          {isActuallyAdmin && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-500 font-medium">Last Build</span>
              <span className={isDarkMode ? 'text-gray-300 font-bold' : 'text-gray-800 font-bold'}>
                {BUILD_TIME
                  ? new Date(BUILD_TIME).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : 'Unknown'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="text-center pb-8">
        <p className="text-[10px] text-gray-500 font-medium">© 2026 Enterprise Request Management. All rights reserved.</p>
      </div>
    </motion.div>
  );
};

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  timestamp: string;
  details: string;
  requestId: string;
}

const LogsView = ({ 
  logs, 
  isDarkMode,
  onClear
}: { 
  logs: ActivityLog[], 
  isDarkMode: boolean,
  onClear: () => void
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  const filteredLogs = logs.filter(log => 
    log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.requestId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex justify-between items-center bg-gradient-to-r from-transparent via-[#FE5900]/5 to-transparent p-6 rounded-[2rem]">
        <div>
          <h2 className={`text-3xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Activity Logs</h2>
          <p className="text-gray-500 font-medium tracking-tight">System-wide event tracking and audit trail</p>
        </div>
        <button 
          onClick={() => setIsConfirmClearOpen(true)}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${
            isDarkMode ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'
          }`}
        >
          <Trash2 size={16} />
          Clear Logs
        </button>
      </div>

      <div className={`p-4 rounded-2xl border transition-colors ${isDarkMode ? 'bg-dark-900/60 backdrop-blur-md border-dark-800' : 'bg-white border-gray-100 shadow-sm'} flex flex-wrap gap-4 items-end`}>
        <div className="flex-1 min-w-[300px]">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Search Activity Logs</label>
          <div className={`flex items-center px-4 py-2.5 rounded-xl border transition-all ${isDarkMode ? 'bg-dark-800 border-dark-700 focus-within:border-orange-500 shadow-inner' : 'bg-gray-50 border-gray-200 focus-within:border-[#FE5900]'}`}>
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input 
              type="text"
              placeholder="Filter by user, action, requestId or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`bg-transparent border-none text-sm ml-2 focus:ring-0 w-full outline-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            />
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm transition-colors overflow-hidden ${isDarkMode ? 'bg-dark-900 border-dark-800' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className={`text-[11px] font-black uppercase tracking-widest text-gray-400 border-b ${isDarkMode ? 'border-dark-800 bg-dark-950/20' : 'border-gray-50 bg-gray-50/20'}`}>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Request</th>
                <th className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-gray-400 italic">No activity logs found matching your criteria.</td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className={`border-b last:border-0 transition-colors ${isDarkMode ? 'border-dark-800/40 hover:bg-white/5' : 'border-gray-50 hover:bg-gray-50/50'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-gray-500 font-medium tabular-nums">
                        <Clock size={12} className="text-orange-500" />
                        {new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${isDarkMode ? 'bg-dark-800 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
                          {log.userName ? log.userName[0] : '?'}
                        </div>
                        <span className={`font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{log.userName || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        log.action.includes('Delete') || log.action.includes('Reject') || log.action.includes('Reset')
                          ? 'bg-red-500/10 text-red-500'
                          : log.action.includes('Create') || log.action.includes('Approve')
                            ? 'bg-green-500/10 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.1)]'
                            : 'bg-orange-500/10 text-orange-500'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.requestId ? (
                        <span className={`font-mono text-xs font-bold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{log.requestId}</span>
                      ) : (
                        <span className="text-gray-400 italic text-xs">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className={`text-xs font-medium max-w-md break-words ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {log.details}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirmClearOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmClearOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border ${
                isDarkMode ? 'bg-dark-900 border-dark-800' : 'bg-white border-gray-100'
              }`}
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-500'
                }`}>
                  <AlertCircle size={40} />
                </div>
                
                <div className="space-y-2">
                  <h3 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Clear All Logs?</h3>
                  <p className="text-gray-500 text-sm px-4">
                    This will permanently delete <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} border-b-2 border-red-200`}>all activity logs</span>. This action cannot be undone.
                  </p>
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setIsConfirmClearOpen(false)}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-all cursor-pointer ${
                      isDarkMode ? 'bg-dark-800 text-gray-400 hover:bg-dark-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onClear();
                      setIsConfirmClearOpen(false);
                    }}
                    className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-200 hover:bg-red-600 transition-all cursor-pointer"
                  >
                    Confirm Clear
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CommentsChatModal = ({ 
  request, 
  user, 
  userRole,
  isDarkMode, 
  onClose, 
  onUpdateComments 
}: { 
  request: Request, 
  user: AuthUser, 
  userRole?: string,
  isDarkMode: boolean, 
  onClose: () => void, 
  onUpdateComments: (comments: RequestComment[], simpleText: string) => void 
}) => {
  const [newComment, setNewComment] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [request.commentsList]);

  const handleSend = () => {
    if (!newComment.trim()) return;
    
    const comment: RequestComment = {
      id: Math.random().toString(36).substring(2, 9),
      text: newComment.trim(),
      author: user.name,
      timestamp: new Date().toISOString(),
      userId: user.id
    };

    const newList = [...(request.commentsList || []), comment];
    const simpleText = newList.map(c => `${c.author}: ${c.text}`).join('\n');
    
    onUpdateComments(newList, simpleText);
    setNewComment('');
    onClose();
  };

  const handleDeleteComment = (commentId: string) => {
    const newList = (request.commentsList || []).filter(c => c.id !== commentId);
    const simpleText = newList.map(c => `${c.author}: ${c.text}`).join('\n');
    onUpdateComments(newList, simpleText);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`relative w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[600px] border ${
          isDarkMode ? 'bg-dark-900 border-dark-700' : 'bg-white border-white'
        }`}
      >
        <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'border-dark-800' : 'border-gray-100'}`}>
          <div>
            <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Comments: {request.requestId || request.id.substring(0, 8)}</h3>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5 font-bold">{request.category}</p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-dark-800' : 'hover:bg-gray-50'}`}>
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth"
        >
          {(!request.commentsList || request.commentsList.length === 0) ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-dark-800' : 'bg-gray-100'}`}>
                <MessageSquare size={32} className={isDarkMode ? 'text-gray-600' : 'text-gray-300'} />
              </div>
              <p className="text-sm text-gray-400 font-medium">No comments yet.<br/>Be the first to say something!</p>
            </div>
          ) : (
            request.commentsList.map((comment, index) => {
              const prevComment = request.commentsList[index - 1];
              const showAuthor = !prevComment || prevComment.userId !== comment.userId;
              const isOwnerOrAdmin = (userRole === 'owner' || userRole === 'admin');
              
              return (
              <div 
                key={comment.id} 
                className={`flex flex-col ${comment.userId === user.id ? 'items-end' : 'items-start'} ${!showAuthor ? '-mt-3' : ''} group/comment relative w-full`}
              >
                {showAuthor && (
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className={`text-[11px] font-bold tracking-tight ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{comment.author}</span>
                    <span className={`text-[10px] font-medium leading-none ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                <div className={`flex items-center gap-2 max-w-[85%] ${comment.userId === user.id ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                    comment.userId === user.id 
                      ? 'bg-[#FE5900] text-white rounded-tr-none shadow-orange-500/10' 
                      : isDarkMode 
                        ? 'bg-dark-800 text-gray-200 border border-dark-700 rounded-tl-none shadow-black/20' 
                        : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-tl-none shadow-sm'
                  }`}>
                    {comment.text}
                  </div>
                  {isOwnerOrAdmin && (
                    <button
                      id={`btn_delete_comment_${comment.id}`}
                      onClick={() => handleDeleteComment(comment.id)}
                      className={`p-1.5 rounded-lg opacity-0 group-hover/comment:opacity-100 transition-opacity cursor-pointer flex-shrink-0 ${
                        isDarkMode 
                          ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10' 
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                      }`}
                      title="Delete comment"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            )})
          )}
        </div>

        {request.isArchived ? (
          <div className={`p-5 border-t text-center ${isDarkMode ? 'border-dark-800 bg-dark-950/40' : 'border-gray-100 bg-gray-50'}`}>
            <span className={`text-xs font-bold flex items-center justify-center gap-1.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <span role="img" aria-label="locked">🔒</span> Comments are locked for archived requests
            </span>
          </div>
        ) : (
          <div className={`p-4 border-t ${isDarkMode ? 'border-dark-800 bg-dark-900/50' : 'border-gray-100 bg-gray-50'}`}>
            <div className={`flex gap-2 p-1.5 rounded-2xl border shadow-sm transition-all ${
              isDarkMode ? 'bg-dark-800 border-dark-700 focus-within:border-orange-500/50' : 'bg-white border-gray-200'
            }`}>
              <input 
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type your comment..."
                className={`flex-1 bg-transparent border-none outline-none px-3 text-sm ${isDarkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
              />
              <button 
                onClick={handleSend}
                disabled={!newComment.trim()}
                className={`p-2.5 rounded-xl transition-all ${
                  newComment.trim() 
                    ? 'bg-[#FE5900] text-white shadow-lg shadow-orange-500/20' 
                    : isDarkMode 
                      ? 'bg-dark-750 text-gray-500' 
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'create' | 'list' | 'archive' | 'settings' | 'users' | 'logs' | 'config'>('list');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userStatus, setUserStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [mockRole, setMockRole] = useState<UserRole | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [compactView, setCompactView] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isActuallyAdmin, setIsActuallyAdmin] = useState(false);
  const [requests, setRequests] = useState<Request[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [authEmails, setAuthEmails] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isRequestsLoading, setIsRequestsLoading] = useState(true);
  const [globalSearch, setGlobalSearch] = useState('');
  const [selectedCommentRequestId, setSelectedCommentRequestId] = useState<string | null>(null);
  const [listStatusFilter, setListStatusFilter] = useState<string>('All');
  const [listQAFilter, setListQAFilter] = useState<string>('All');
  const [listDivisionFilter, setListDivisionFilter] = useState<string>('All');
  const [archiveStatusFilter, setArchiveStatusFilter] = useState<string>('All');
  const [archiveQAFilter, setArchiveQAFilter] = useState<string>('All');
  const [archiveDivisionFilter, setArchiveDivisionFilter] = useState<string>('All');

  const [appConfig, setAppConfig] = useState<Config>(APP_CONFIG);
  const [divisionCategories, setDivisionCategories] = useState<Record<string, string[]>>(DIVISION_CATEGORIES);

  // New Requests detection pop-up on session connection
  const [newRequestsSinceLastVisit, setNewRequestsSinceLastVisit] = useState<Request[]>([]);
  const [showNewRequestsPopup, setShowNewRequestsPopup] = useState(false);
  const [hasCheckedNewRequests, setHasCheckedNewRequests] = useState(false);

  const effectiveRole = (isActuallyAdmin && mockRole) ? mockRole : user?.role;
  const uiIsAdmin = hasPermission(effectiveRole, 'view_admin_panel', appConfig);
  const canCreate = hasPermission(effectiveRole, 'create_requests', appConfig);

  // Auth & Data Subscription
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (firebaseUser) {
        // Subscribe to user profile in real-time
        unsubscribeProfile = firebaseService.subscribeUserProfile(firebaseUser.uid, async (profile) => {
          if (!profile) {
            if (globalSigningIn) {
              // Sign-in is currently in progress, handleGoogleLogin will handle creation shortly.
              return;
            }
            // No profile doc exists (e.g., they were deleted by an admin).
            // Instantly sign them out and redirect to Login.
            await signOut(auth);
            return;
          } else {
            // Existing user profile
            const isAdminEmail = ADMIN_EMAILS.includes(firebaseUser.email || '');
            if (isAdminEmail && (profile.status !== 'approved' || profile.role !== 'owner')) {
              // Ensure hardcoded admins are always approved & owner role, role is not changeable
              await firebaseService.updateUserStatus(firebaseUser.uid, 'approved');
              await firebaseService.updateUserRole(firebaseUser.uid, 'owner');
              return; // wait for snapshot to trigger again with corrected roles
            }

            const authUser: AuthUser = {
              id: firebaseUser.uid,
              name: profile.name,
              email: profile.email,
              role: profile.role,
              avatar: firebaseUser.photoURL || undefined,
              pinnedRequestIds: profile.pinnedRequestIds || [],
              notificationSettings: profile.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS,
              mappedOwner: profile.mappedOwner || ''
            };

            setUser(authUser);
            setIsActuallyAdmin(isAdminEmail || profile.role === 'admin' || profile.role === 'owner');
            setIsAdmin(profile.role === 'admin' || profile.role === 'owner');
            setUserStatus(profile.status);
            setIsAuthLoading(false);

            // Turn off signing-in flag as the login is verified complete
            globalSigningIn = false;
          }
        });
      } else {
        setUser(null);
        setIsAdmin(false);
        setUserStatus(null);
        setIsAuthLoading(false);
      }
    });

    const savedDarkMode = localStorage.getItem('nexus_dark_mode');
    if (savedDarkMode) {
      setIsDarkMode(JSON.parse(savedDarkMode));
    }

    const savedCompactMode = localStorage.getItem('nexus_compact_mode');
    if (savedCompactMode) {
      setCompactView(JSON.parse(savedCompactMode));
    }

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  // Data Subscription
  useEffect(() => {
    if (user) {
      // Admins and approved users can subscribe
      const canSeeRequests = isAdmin || isActuallyAdmin || userStatus === 'approved';
      
      let unsubscribeRequests: (() => void) | undefined;
      if (canSeeRequests) {
        setIsRequestsLoading(true);
        unsubscribeRequests = firebaseService.subscribeRequests((fetched) => {
          const normalized = fetched.map(r => {
            if (r.status === ('Pending' as any)) {
              return { ...r, status: 'Not Started' as RequestStatus };
            }
            return r;
          });
          setRequests(normalized);
          setIsRequestsLoading(false);
        });
      } else {
        setIsRequestsLoading(false);
      }
      
      // Config subscription
      const unsubscribeAppConfig = firebaseService.subscribeAppConfig((config) => {
        if (config) {
          setAppConfig({
            OWNERS: config.OWNERS || APP_CONFIG.OWNERS,
            REQUEST_TYPES: config.REQUEST_TYPES || APP_CONFIG.REQUEST_TYPES,
            PRIORITY_MAP: config.PRIORITY_MAP || APP_CONFIG.PRIORITY_MAP,
            CAPACITY_MAP: config.CAPACITY_MAP || APP_CONFIG.CAPACITY_MAP,
            HOLIDAYS: config.HOLIDAYS || APP_CONFIG.HOLIDAYS,
            OWNERS_LIST: config.OWNERS_LIST || APP_CONFIG.OWNERS_LIST,
            SUBMITTERS_LIST: config.SUBMITTERS_LIST || APP_CONFIG.SUBMITTERS_LIST,
            ROLES_LIST: config.ROLES_LIST || APP_CONFIG.ROLES_LIST,
            ROLE_PERMISSIONS: config.ROLE_PERMISSIONS || APP_CONFIG.ROLE_PERMISSIONS,
          });
          if (config.DIVISION_CATEGORIES) {
            setDivisionCategories(config.DIVISION_CATEGORIES);
          }
        }
      });
      
      // Admin subscriptions
      let unsubscribeUsers: (() => void) | undefined;
      let unsubscribeAuthEmails: (() => void) | undefined;
      let unsubscribeLogs: (() => void) | undefined;
      if (isAdmin || isActuallyAdmin) {
        unsubscribeUsers = firebaseService.subscribeUsers(setUsers);
        unsubscribeAuthEmails = firebaseService.subscribeAuthorizedEmails(setAuthEmails);
        unsubscribeLogs = firebaseService.subscribeLogs(setLogs as any);
      }
      
      return () => {
        if (unsubscribeRequests) unsubscribeRequests();
        if (unsubscribeAppConfig) unsubscribeAppConfig();
        if (unsubscribeUsers) unsubscribeUsers();
        if (unsubscribeAuthEmails) unsubscribeAuthEmails();
        if (unsubscribeLogs) unsubscribeLogs();
      };
    }
  }, [user, userStatus, isActuallyAdmin]);

  // Auto-switch overdue tasks to DELAYED
  useEffect(() => {
    if (!isAdmin && !isActuallyAdmin) return;
    if (requests.length === 0) return;

    const now = new Date();
    const overdueRequests = requests.filter(req => {
      if (req.isArchived || req.status === 'Live' || req.status === 'Delayed' || req.status === 'Blocked') return false;
      const deadline = new Date(req.slaDeadline);
      return now > deadline;
    });

    if (overdueRequests.length > 0) {
      overdueRequests.forEach(req => {
        firebaseService.updateRequest({
          ...req,
          status: 'Delayed',
          updateDate: now.toISOString()
        }).catch(() => {});
      });
    }
  }, [requests, isAdmin, isActuallyAdmin]);

  useEffect(() => {
    localStorage.setItem('nexus_dark_mode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('nexus_compact_mode', JSON.stringify(compactView));
  }, [compactView]);

  // Trigger check for new requests since last visit
  useEffect(() => {
    if (user && !isRequestsLoading && !hasCheckedNewRequests) {
      const lastVisitStr = localStorage.getItem('nexus_last_visit_' + user.id);
      
      if (!lastVisitStr) {
        // First visit tracking initialization
        localStorage.setItem('nexus_last_visit_' + user.id, new Date().toISOString());
        setHasCheckedNewRequests(true);
      } else {
        const lastVisitDate = new Date(lastVisitStr);
        // Find requests created after the last visit timestamp
        const newReqs = requests.filter(req => {
          if (!req.createdAt) return false;
          return new Date(req.createdAt).getTime() > lastVisitDate.getTime();
        });

        if (newReqs.length > 0) {
          setNewRequestsSinceLastVisit(newReqs);
          setShowNewRequestsPopup(true);
        } else {
          // If no new requests, update last visit to current time
          localStorage.setItem('nexus_last_visit_' + user.id, new Date().toISOString());
        }
        setHasCheckedNewRequests(true);
      }
    }
  }, [user, requests, isRequestsLoading, hasCheckedNewRequests]);

  // Reset checking flags on user logout
  useEffect(() => {
    if (!user) {
      setHasCheckedNewRequests(false);
      setNewRequestsSinceLastVisit([]);
      setShowNewRequestsPopup(false);
    }
  }, [user]);

  const handleCloseNewRequestsPopup = () => {
    setShowNewRequestsPopup(false);
    if (user) {
      localStorage.setItem('nexus_last_visit_' + user.id, new Date().toISOString());
    }
  };

  // Reset tab if mock role changes to non-admin while on admin-only tab
  useEffect(() => {
    if (!uiIsAdmin && (activeTab === 'users' || activeTab === 'logs' || activeTab === 'config')) {
      setActiveTab('list');
    }
  }, [uiIsAdmin, activeTab]);

  const combinedUsersList = useMemo(() => {
    const formattedAuth = (authEmails || []).map(ae => ({
      uid: ae.uid,
      name: ae.email ? ae.email.split('@')[0] : 'Authorized User',
      email: ae.email || 'No email',
      role: ae.role || 'Team Leader',
      status: 'authorized',
      isAuthorizedOnly: true,
      mappedOwner: ae.mappedOwner || ''
    }));
    
    // Filter out users that are already in the 'users' collection to avoid duplicates
    const authEmailsNotInUsers = formattedAuth.filter(
      ae => !users.some(u => u.email === ae.email)
    );
    
    return [...users, ...authEmailsNotInUsers];
  }, [users, authEmails]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showNotification('Logged out successfully');
    } catch (err) {
      showNotification('Logout failed', 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUpdateNotificationSettings = async (settings: NotificationSettings) => {
    if (!user) return;
    try {
      await firebaseService.updateUserNotificationSettings(user.id, settings);
      setUser(prev => prev ? { ...prev, notificationSettings: settings } : null);
      showNotification('Notification preferences saved');
    } catch (err) {
      console.error(err);
      showNotification('Failed to update notification preferences', 'error');
    }
  };

  // Analytics Logic
  const handleResetAll = async () => {
    try {
      await firebaseService.resetAllRequests();
      showNotification('All requests deleted and counter reset');
      setRequests([]);
      firebaseService.addLog({
        action: 'System Reset',
        details: 'All requests were cleared and counter was reset by admin'
      });
    } catch (err: any) {
      let message = 'Failed to reset requests';
      try {
        const errorData = JSON.parse(err.message);
        message = `Reset failed: ${errorData.error}`;
      } catch (e) {
        message = err.message || 'Reset failed';
      }
      showNotification(message, 'error');
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    
    let stats = { todo: 0, inProgress: 0, pendingQA: 0, completed: 0, alert: 0, delayed: 0 };

    requests.forEach(r => {
      const status = r.status.trim();
      const qaStatus = r.qaStatus.trim();
      const deadline = new Date(r.slaDeadline);

      const isLive = status === "Live";
      const isApproved = qaStatus === "Approved";

      if (isLive && isApproved) {
        stats.completed++;
        return;
      }

      if (r.isArchived) return;

      if (status === "Not Started") stats.todo++;
      else if (status === "In Progress") stats.inProgress++;
      else if (status === "Live" && qaStatus === "Pending") stats.pendingQA++;
      
      // Delayed check based on date and status (replicating checkSLAStatus)
      if (status !== "Live" && now > deadline && status !== "Delayed") {
        stats.delayed++;
      } else if (status === "Delayed") {
        stats.delayed++;
      }

      if (status === "Blocked" || qaStatus === "Rejected") stats.alert++;
    });

    return stats;
  }, [requests]);

  const handleAddRequest = async (newRequest: any) => {
    const requestId = `REQ-${(requests.length + 1).toString().padStart(4, '0')}`;
    const owner = appConfig.OWNERS[newRequest.division as Division] || "Unassigned";
    const priorityTier = appConfig.PRIORITY_MAP[newRequest.requestType] || 3;
    const now = new Date();
    
    const slaDate = calculateSLA(
      now, 
      newRequest.category, 
      priorityTier, 
      newRequest.valuesCount, 
      newRequest.requestType
    );

    const requestData: Omit<Request, 'id'> = {
      ...newRequest,
      requestId,
      owner,
      priorityTier,
      slaDeadline: slaDate.toISOString(),
      createdAt: now.toISOString(),
      updateDate: now.toISOString(),
      isArchived: false,
      status: 'Not Started',
      qaStatus: 'Waiting',
      comments: '',
      subtaskRequestActions: false,
      subtaskLockedValuelist: false,
      requestActionsCompletedAt: ''
    };

    try {
      const docId = await firebaseService.addRequest(requestData as any);
      showNotification(`Request submitted successfully!`);
      setActiveTab('list');
      firebaseService.addLog({
        action: 'Create Request',
        details: `Created new request ${requestId} for ${newRequest.category}`,
        requestId: requestId
      });
      notificationService.notifyTeamAssignment({ id: docId, ...requestData } as any);
    } catch (err) {
      showNotification('Failed to submit request', 'error');
    }
  };

  const updateStatus = async (id: string, status: RequestStatus) => {
    const request = requests.find(r => r.id === id);
    if (!request) return;

    let newQA = request.qaStatus;
    if (status === 'Live' && request.status !== 'Live') {
      newQA = 'Pending';
    }

    const prevRequests = requests;
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status, qaStatus: newQA, updateDate: new Date().toISOString() } : r));

    try {
      await firebaseService.updateRequest({
        ...request,
        status,
        qaStatus: newQA
      });
      showNotification(`Status updated for ${request.requestId || request.id.substring(0, 8)}`);
      firebaseService.addLog({
        action: 'Update Status',
        details: `Status changed from ${request.status} to ${status}`,
        requestId: request.requestId
      });
      notificationService.notifyStatusChange(request, request.status, status);
      if (newQA !== request.qaStatus) {
        notificationService.notifyQaChange(request, request.qaStatus, newQA);
      }
    } catch (err) {
      setRequests(prevRequests);
      showNotification('Update failed', 'error');
    }
  };

  const updateQAStatus = async (id: string, qaStatus: QAStatus) => {
    const request = requests.find(r => r.id === id);
    if (!request) return;

    const prevRequests = requests;
    setRequests(prev => prev.map(r => r.id === id ? { ...r, qaStatus, updateDate: new Date().toISOString() } : r));

    try {
      await firebaseService.updateRequest({
        ...request,
        qaStatus
      });
      showNotification(`QA Status updated for ${request.requestId || request.id.substring(0, 8)}`);
      firebaseService.addLog({
        action: 'Update QA',
        details: `QA Status changed from ${request.qaStatus} to ${qaStatus}`,
        requestId: request.requestId
      });
      notificationService.notifyQaChange(request, request.qaStatus, qaStatus);
    } catch (err) {
      setRequests(prevRequests);
      showNotification('Update failed', 'error');
    }
  };

  const updateRequest = async (updatedRequest: Request) => {
    const original = requests.find(r => r.id === updatedRequest.id);
    if (!original) return;

    const prevRequests = requests;
    setRequests(prev => prev.map(r => r.id === updatedRequest.id ? updatedRequest : r));

    try {
      await firebaseService.updateRequest(updatedRequest);
      showNotification(`Request ${updatedRequest.requestId || updatedRequest.id.substring(0, 8)} updated`);
      firebaseService.addLog({
        action: 'Update Request',
        details: `Updated details for request ${updatedRequest.requestId || updatedRequest.id.substring(0, 8)}`,
        requestId: updatedRequest.requestId
      });
      if (original.status !== updatedRequest.status) {
        notificationService.notifyStatusChange(original, original.status, updatedRequest.status);
      }
      if (original.qaStatus !== updatedRequest.qaStatus) {
        notificationService.notifyQaChange(original, original.qaStatus, updatedRequest.qaStatus);
      }
    } catch (err) {
      setRequests(prevRequests);
      showNotification('Update failed', 'error');
    }
  };

  const deleteRequest = async (id: string) => {
    const request = requests.find(r => r.id === id);
    if (!request) return;
    const displayName = request.requestId || request.id.substring(0, 8);

    const prevRequests = requests;
    setRequests(prev => prev.filter(r => r.id !== id));

    try {
      await firebaseService.deleteRequest(id);
      showNotification(`Request ${displayName} deleted`);
      firebaseService.addLog({
        action: 'Delete Request',
        details: `Deleted request ${displayName}`,
        requestId: request.requestId
      });
    } catch (err: any) {
      setRequests(prevRequests);
      let message = 'Deletion failed';
      try {
        const errorData = JSON.parse(err.message);
        message = `Delete failed: ${errorData.error}`;
      } catch (e) {
        message = err.message || 'Deletion failed';
      }
      showNotification(message, 'error');
    }
  };

  const unarchiveRequest = async (id: string) => {
    const request = requests.find(r => r.id === id);
    if (!request) return;

    const prevRequests = requests;
    setRequests(prev => prev.map(r => r.id === id ? { ...r, isArchived: false, updateDate: new Date().toISOString() } : r));

    try {
      await firebaseService.updateRequest({
        ...request,
        isArchived: false
      });
      showNotification(`Request ${request.requestId || request.id.substring(0, 8)} un-archived`);
      firebaseService.addLog({
        action: 'Restore Request',
        details: `Restored request ${request.requestId} from archive`,
        requestId: request.requestId
      });
    } catch (err) {
      setRequests(prevRequests);
      showNotification('Un-archive failed', 'error');
    }
  };

  const handlePinRequest = async (id: string) => {
    if (!user) return;
    const currentPins = user.pinnedRequestIds || [];
    const isPinned = currentPins.includes(id);
    
    let newPins: string[];
    if (isPinned) {
      newPins = currentPins.filter(pid => pid !== id);
    } else {
      if (currentPins.length >= 3) {
        showNotification('You can only pin up to 3 requests', 'error');
        return;
      }
      newPins = [...currentPins, id];
    }

    const prevUser = user;
    setUser({ ...user, pinnedRequestIds: newPins });

    try {
      await firebaseService.updateUserPins(user.id, newPins);
      showNotification(isPinned ? 'Request unpinned' : 'Request pinned');
    } catch (err) {
      setUser(prevUser);
      showNotification('Pin update failed', 'error');
    }
  };

  const archiveCompleted = async () => {
    const completed = requests.filter(r => 
      !r.isArchived && 
      r.status === 'Live' && 
      r.qaStatus === 'Approved'
    );

    if (completed.length === 0) {
      showNotification('No completed requests to archive');
      return;
    }

    const prevRequests = requests;
    setRequests(prev => prev.map(r => 
      (!r.isArchived && r.status === 'Live' && r.qaStatus === 'Approved')
        ? { ...r, isArchived: true, updateDate: new Date().toISOString() }
        : r
    ));

    try {
      await Promise.all(completed.map(r => 
        firebaseService.updateRequest({ ...r, isArchived: true })
      ));
      showNotification('Completed requests archived');
      firebaseService.addLog({
        action: 'Archive Completed',
        details: `Archived ${completed.length} completed requests`
      });
    } catch (err) {
      setRequests(prevRequests);
      showNotification('Archiving failed', 'error');
    }
  };

  if (isAuthLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-dark-950' : 'bg-[#F9FAFB]'}`}>
        <div className="w-10 h-10 border-4 border-[#FE5900]/30 border-t-[#FE5900] rounded-full animate-spin shadow-[0_0_15px_rgba(254,89,0,0.2)]"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView isDarkMode={isDarkMode} />;
  }

  if (userStatus === 'pending' || userStatus === 'rejected') {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 ${isDarkMode ? 'bg-dark-950 text-white' : 'bg-[#F9FAFB] text-gray-900'}`}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`max-w-md w-full p-10 rounded-[2.5rem] shadow-2xl text-center border ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}
        >
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${userStatus === 'pending' ? (isDarkMode ? 'bg-orange-500/10 text-orange-500' : 'bg-orange-100 text-[#FE5900]') : (isDarkMode ? 'bg-red-500/10 text-red-500' : 'bg-red-100 text-red-500')}`}>
            {userStatus === 'pending' ? <ShieldAlert size={40} /> : <XCircle size={40} />}
          </div>
          <h2 className={`text-2xl font-black mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {userStatus === 'pending' ? 'Access Pending' : 'Access Denied'}
          </h2>
          <p className="text-gray-500 mb-8 leading-relaxed font-medium">
            {userStatus === 'pending' 
              ? 'Your request for access has been submitted. An administrator will review your application shortly.' 
              : 'Your request for access was not approved. Please contact IT support if you believe this is an error.'}
          </p>
          <button 
            onClick={handleLogout}
            className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isDarkMode ? 'bg-dark-800 text-gray-200 hover:bg-dark-700 border border-dark-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans flex overflow-hidden transition-colors duration-300 ${isDarkMode ? 'dark bg-dark-950 text-gray-100' : 'bg-[#F9FAFB] text-gray-900'}`}>
      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 256 : 0, opacity: sidebarOpen ? 1 : 0 }}
        className={`border-r flex-shrink-0 z-20 relative overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-dark-900 border-dark-800' : 'bg-white border-gray-200'}`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-[#FE5900] rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
              <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            <span className={`font-bold text-xl tracking-tight ${isDarkMode ? 'text-white' : ''}`}>Request<span className="text-[#FE5900]">Tracker</span></span>
          </div>

          <div className="px-4 mb-6">
            {canCreate && (
              <button 
                onClick={() => setActiveTab('create')}
                className="w-full bg-[#FE5900] text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2"
              >
                <PlusCircle size={18} />
                New Request
              </button>
            )}
          </div>

          <nav className="flex-1 px-4 space-y-1">
            <SidebarItem 
              icon={ListTodo} 
              label="Requests" 
              active={activeTab === 'list'} 
              onClick={() => setActiveTab('list')} 
              isDarkMode={isDarkMode}
            />
            <SidebarItem 
              icon={LayoutDashboard} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              isDarkMode={isDarkMode}
            />
            <SidebarItem 
              icon={Archive} 
              label="Archive" 
              active={activeTab === 'archive'} 
              onClick={() => setActiveTab('archive')} 
              isDarkMode={isDarkMode}
            />
            <SidebarItem 
              icon={Settings} 
              label="Settings" 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
              isDarkMode={isDarkMode}
            />

            {uiIsAdmin && (
              <>
                <div className={`mx-2 my-4 border-t ${isDarkMode ? 'border-dark-800' : 'border-gray-100'}`} />
                <label className="px-4 text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Administration</label>
                <SidebarItem 
                  icon={Users} 
                  label="Users" 
                  active={activeTab === 'users'} 
                  onClick={() => setActiveTab('users')} 
                  isDarkMode={isDarkMode}
                />
                <SidebarItem 
                  icon={SlidersHorizontal} 
                  label="System Configuration" 
                  active={activeTab === 'config'} 
                  onClick={() => setActiveTab('config')} 
                  isDarkMode={isDarkMode}
                />
                <SidebarItem 
                  icon={History} 
                  label="Activity Logs" 
                  active={activeTab === 'logs'} 
                  onClick={() => setActiveTab('logs')} 
                  isDarkMode={isDarkMode}
                />
              </>
            )}
          </nav>

          <div className={`p-4 border-t transition-colors duration-300 ${isDarkMode ? 'border-dark-800' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300 ${isDarkMode ? 'bg-dark-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                  <UserIcon size={16} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold truncate w-24 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{user.name}</span>
                  <span className="text-[10px] text-[#FE5900] font-black uppercase tracking-widest">{effectiveRole}</span>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className={`p-2 rounded-lg transition-all cursor-pointer ${isDarkMode ? 'text-gray-400 hover:text-red-400 hover:bg-red-900/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative h-screen overflow-hidden">
        {/* Scrollable Content */}
        <div className={`flex-1 overflow-y-auto p-4 md:p-8 transition-colors duration-300 ${isDarkMode ? 'bg-dark-950' : 'bg-[#F9FAFB]'}`}>
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dash_tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <DashboardView 
                  stats={stats} 
                  requests={requests} 
                  isDarkMode={isDarkMode} 
                  statusFilter={listStatusFilter}
                  setStatusFilter={setListStatusFilter}
                  qaFilter={listQAFilter}
                  setQaFilter={setListQAFilter}
                  divisionFilter={listDivisionFilter}
                  setDivisionFilter={setListDivisionFilter}
                  setArchiveStatusFilter={setArchiveStatusFilter}
                  setArchiveQAFilter={setArchiveQAFilter}
                  onTabChange={setActiveTab}
                  appConfig={appConfig}
                  userRole={effectiveRole}
                />
              </motion.div>
            )}
            {activeTab === 'create' && (
              <motion.div
                key="create_tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <CreateRequestForm 
                  onSubmit={handleAddRequest} 
                  isDarkMode={isDarkMode} 
                  appConfig={appConfig}
                  divisionCategories={divisionCategories}
                />
              </motion.div>
            )}
            {activeTab === 'list' && (
              <motion.div
                key="list_tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <RequestListView 
                  requests={requests.filter(r => !r.isArchived)} 
                  isAdmin={uiIsAdmin} 
                  userRole={effectiveRole}
                  onUpdateStatus={updateStatus} 
                  onUpdateQA={updateQAStatus}
                  onUpdateRequest={updateRequest}
                  onDeleteRequest={deleteRequest}
                  onPinRequest={handlePinRequest}
                  pinnedRequestIds={user?.pinnedRequestIds}
                  onOpenComments={(id) => setSelectedCommentRequestId(id)}
                  onArchive={archiveCompleted} 
                  onReset={handleResetAll}
                  isDarkMode={isDarkMode}
                  compactView={compactView}
                  externalSearch={globalSearch}
                  statusFilter={listStatusFilter}
                  setStatusFilter={setListStatusFilter}
                  qaFilter={listQAFilter}
                  setQaFilter={setListQAFilter}
                  divisionFilter={listDivisionFilter}
                  setDivisionFilter={setListDivisionFilter}
                  appConfig={appConfig}
                  divisionCategories={divisionCategories}
                  currentUserMappedOwner={user?.mappedOwner}
                  isLoading={isRequestsLoading}
                />
              </motion.div>
            )}
            {activeTab === 'archive' && (
              <motion.div
                key="archive_tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <RequestListView 
                  requests={requests.filter(r => r.isArchived)} 
                  isAdmin={uiIsAdmin} 
                  userRole={effectiveRole}
                  onUpdateStatus={updateStatus} 
                  onUpdateQA={updateQAStatus}
                  onUpdateRequest={updateRequest}
                  onDeleteRequest={deleteRequest}
                  onUnarchive={unarchiveRequest}
                  onPinRequest={handlePinRequest}
                  pinnedRequestIds={user?.pinnedRequestIds}
                  onOpenComments={(id) => setSelectedCommentRequestId(id)}
                  isArchiveView 
                  isDarkMode={isDarkMode}
                  compactView={compactView}
                  externalSearch={globalSearch}
                  statusFilter={archiveStatusFilter}
                  setStatusFilter={setArchiveStatusFilter}
                  qaFilter={archiveQAFilter}
                  setQaFilter={setArchiveQAFilter}
                  divisionFilter={archiveDivisionFilter}
                  setDivisionFilter={setArchiveDivisionFilter}
                  appConfig={appConfig}
                  divisionCategories={divisionCategories}
                  currentUserMappedOwner={user?.mappedOwner}
                  isLoading={isRequestsLoading}
                />
              </motion.div>
            )}
            {activeTab === 'settings' && user && (
              <motion.div
                key="settings_tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <SettingsView 
                  isDarkMode={isDarkMode} 
                  onToggleDarkMode={() => setIsDarkMode(!isDarkMode)} 
                  compactView={compactView}
                  onToggleCompactView={() => setCompactView(!compactView)}
                  user={user}
                  isActuallyAdmin={isActuallyAdmin}
                  mockRole={mockRole}
                  onMockRole={setMockRole}
                  onUpdateNotificationSettings={handleUpdateNotificationSettings}
                  appConfig={appConfig}
                />
              </motion.div>
            )}
            {activeTab === 'users' && uiIsAdmin && (
              <motion.div
                key="users_tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <UsersManagementView 
                  users={combinedUsersList}
                  isDarkMode={isDarkMode}
                  appConfig={appConfig}
                  onApprove={async (uid) => {
                    const u = combinedUsersList.find(user => user.uid === uid);
                    if (u?.role?.toLowerCase() === 'owner') {
                      showNotification('Owner profiles cannot be changed', 'error');
                      return;
                    }
                    await firebaseService.updateUserStatus(uid, 'approved');
                    firebaseService.addLog({
                      action: 'Approve User',
                      details: `Approved access for ${u?.name || u?.email || uid}`
                    });
                  }}
                  onReject={async (uid) => {
                    const u = combinedUsersList.find(user => user.uid === uid);
                    if (u?.role?.toLowerCase() === 'owner') {
                      showNotification('Owner profiles cannot be changed', 'error');
                      return;
                    }
                    await firebaseService.updateUserStatus(uid, 'rejected');
                    firebaseService.addLog({
                      action: 'Reject User',
                      details: `Rejected access for ${u?.name || u?.email || uid}`
                    });
                  }}
                  onUpdateRole={async (uid, role) => {
                    const u = combinedUsersList.find(user => user.uid === uid);
                    if (u?.role?.toLowerCase() === 'owner') {
                      showNotification('Owner profiles cannot be changed', 'error');
                      return;
                    }
                    if (uid.startsWith('auth-')) {
                      const email = uid.replace('auth-', '');
                      await firebaseService.updateAuthorizedEmail(email, role);
                      showNotification(`Authorization updated for ${email}`);
                      firebaseService.addLog({
                        action: 'Update Auth',
                        details: `Updated pre-authorization for ${email} to ${role}`
                      });
                    } else {
                      await firebaseService.updateUserRole(uid, role);
                      showNotification('User role updated');
                      firebaseService.addLog({
                        action: 'Update Role',
                        details: `Updated role for ${u?.name || u?.email || uid} to ${role}`
                      });
                    }
                  }}
                  onDeleteUser={async (uid) => {
                    const u = combinedUsersList.find(user => user.uid === uid);
                    if (u?.role?.toLowerCase() === 'owner') {
                      showNotification('Owner profiles cannot be changed', 'error');
                      return;
                    }
                    if (uid.startsWith('auth-')) {
                      const email = uid.replace('auth-', '');
                      await firebaseService.deleteAuthorizedEmail(email);
                      showNotification(`Authorization revoked for ${email}`);
                      firebaseService.addLog({
                        action: 'Revoke Auth',
                        details: `Revoked pre-authorization for ${email}`
                      });
                    } else {
                      await firebaseService.deleteUserProfile(uid);
                      showNotification('User profile deleted');
                      firebaseService.addLog({
                        action: 'Delete User',
                        details: `Deleted user profile for ${u?.name || u?.email || uid}`
                      });
                    }
                  }}
                  onAddUser={async (email, role) => {
                    await firebaseService.addAuthorizedEmail(email, role);
                    showNotification(`User ${email} authorized as ${role}`);
                    firebaseService.addLog({
                      action: 'Authorize Email',
                      details: `Pre-authorized ${email} as ${role}`
                    });
                  }}
                />
              </motion.div>
            )}
            {activeTab === 'logs' && uiIsAdmin && (
              <motion.div
                key="logs_tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <LogsView 
                  logs={logs}
                  isDarkMode={isDarkMode}
                  onClear={async () => {
                    try {
                      await firebaseService.clearLogs();
                      showNotification('System logs cleared successfully');
                      firebaseService.addLog({
                        action: 'Clear Logs',
                        details: 'All existing system logs were cleared by an administrator'
                      });
                    } catch (err) {
                      showNotification('Failed to clear logs', 'error');
                    }
                  }}
                />
              </motion.div>
            )}
            {activeTab === 'config' && uiIsAdmin && (
              <motion.div
                key="config_tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <ConfigManagementView 
                  isDarkMode={isDarkMode}
                  appConfig={appConfig}
                  onUpdateConfig={async (newConfigObj) => {
                    try {
                      setAppConfig(newConfigObj);
                      await firebaseService.updateAppConfig(newConfigObj);
                      showNotification('System configuration updated successfully');
                      firebaseService.addLog({
                        action: 'Update Config',
                        details: 'Updated global division mapping, taxonomy, or capacity map configurations'
                      });
                    } catch (err) {
                      showNotification('Failed to update system configuration', 'error');
                    }
                  }}
                  divisionCategories={divisionCategories}
                  users={combinedUsersList}
                  onUpdateMappedOwner={async (uid, mappedOwner) => {
                    try {
                      if (uid.startsWith('auth-')) {
                        const email = uid.replace('auth-', '');
                        await firebaseService.updateAuthorizedEmailMappedOwner(email, mappedOwner);
                        showNotification(`Mapped owner updated to ${mappedOwner || 'Unassigned'} for ${email}`);
                        firebaseService.addLog({
                          action: 'Update Auth Mapping',
                          details: `Updated pre-authorization mapping for ${email} to owner ${mappedOwner || 'Unassigned'}`
                        });
                      } else {
                        await firebaseService.updateUserMappedOwner(uid, mappedOwner);
                        showNotification(`Mapped owner updated to ${mappedOwner || 'Unassigned'}`);
                        const u = combinedUsersList.find(u => u.uid === uid);
                        firebaseService.addLog({
                          action: 'Update User Mapping',
                          details: `Mapped user ${u?.name || u?.email || uid} to owner ${mappedOwner || 'Unassigned'}`
                        });
                      }
                    } catch (err) {
                      showNotification('Failed to update user owner mapping', 'error');
                    }
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Popups Row */}
        <AnimatePresence>
          {selectedCommentRequestId && (
            <CommentsChatModal 
              request={requests.find(r => r.id === selectedCommentRequestId)!}
              user={user}
              userRole={effectiveRole}
              isDarkMode={isDarkMode}
              onClose={() => setSelectedCommentRequestId(null)}
              onUpdateComments={(newList, simpleText) => {
                const req = requests.find(r => r.id === selectedCommentRequestId);
                if (req) {
                  const commentAdded = newList[newList.length - 1];
                  updateRequest({ ...req, commentsList: newList, comments: simpleText });
                  if (commentAdded) {
                    notificationService.notifyNewComment(req, { author: commentAdded.author, text: commentAdded.text });
                  }
                }
              }}
            />
          )}
        </AnimatePresence>

        {/* Toast Notification */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-8 right-8 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white z-50 ${
              notification.type === 'success' ? (isDarkMode ? 'bg-dark-800 border border-dark-700' : 'bg-gray-900') : 'bg-red-600'
              }`}
            >
              {notification.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span className="text-sm font-medium">{notification.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Requests Alert Modal */}
        <AnimatePresence>
          {showNewRequestsPopup && newRequestsSinceLastVisit.length > 0 && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseNewRequestsPopup}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={`relative rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden transition-colors border ${
                  isDarkMode ? 'bg-dark-900 border-[#FE5900]/25 shadow-black/80' : 'bg-white border-white'
                }`}
              >
                {/* Header block */}
                <div className="p-8 pb-5 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-orange-500/15 rounded-2xl flex items-center justify-center shrink-0">
                      <Bell className="text-[#FE5900] animate-bounce" size={22} />
                    </div>
                    <div className="text-left">
                      <h3 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        New Requests!
                      </h3>
                      <p className="text-xs font-semibold text-gray-400 mt-1">
                        Υπάρχουν {newRequestsSinceLastVisit.length} νέες καταχωρήσεις από την τελευταία σας επίσκεψη.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseNewRequestsPopup}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${
                      isDarkMode ? 'hover:bg-dark-800 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-950'
                    }`}
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Scrollable body with the item summary report */}
                <div className="p-8 pt-0 pb-6 max-h-[350px] overflow-y-auto space-y-3">
                  {newRequestsSinceLastVisit.map((req) => (
                    <div
                      key={req.id}
                      className={`p-4 rounded-2xl border transition-colors flex flex-col gap-2 text-start ${
                        isDarkMode 
                          ? 'bg-dark-800/40 border-dark-750 hover:bg-dark-850' 
                          : 'bg-gray-50/80 border-gray-100 hover:bg-white hover:border-gray-200 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-black text-[#FE5900] bg-orange-500/10 px-2 py-0.5 rounded-md">
                          {req.requestId || req.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          req.priorityTier === 1 
                            ? 'bg-red-500/10 text-red-550' 
                            : req.priorityTier === 2 
                              ? 'bg-amber-500/10 text-amber-500' 
                              : 'bg-orange-500/10 text-[#FE5900]'
                        }`}>
                          Priority Tier {req.priorityTier}
                        </span>
                      </div>

                      <p className={`text-xs font-bold leading-relaxed line-clamp-2 ${isDarkMode ? 'text-gray-150' : 'text-gray-800'}`}>
                        {req.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-gray-450 font-semibold pt-2 border-t border-dashed border-gray-200 dark:border-dark-700/50">
                        <div>
                          <span className="text-gray-400 dark:text-gray-500">Division:</span> <span className={isDarkMode ? 'text-white font-black' : 'text-gray-700 font-black'}>{req.division}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 dark:text-gray-500">Category:</span> <span className={isDarkMode ? 'text-white font-black' : 'text-gray-700 font-black'}>{req.category}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 dark:text-gray-500">Submitter:</span> <span className={isDarkMode ? 'text-white font-black' : 'text-gray-700 font-black'}>{req.submitter}</span>
                        </div>
                        <div className="ml-auto font-mono text-[9px] font-bold text-gray-400">
                          {new Date(req.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Action Footer */}
                <div className={`p-8 py-5 flex items-center justify-end transition-colors gap-3 ${
                  isDarkMode ? 'bg-dark-950/40 border-t border-dark-800' : 'bg-gray-50 border-t border-gray-100'
                }`}>
                  <button
                    onClick={handleCloseNewRequestsPopup}
                    className="px-6 py-2.5 h-[40px] bg-[#FE5900] hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-orange-500/15 transition-all text-center flex items-center justify-center cursor-pointer font-bold"
                  >
                    Okay, got it!
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- View Components ---

function UsersManagementView({ 
  users, 
  isDarkMode, 
  onApprove, 
  onReject,
  onUpdateRole,
  onDeleteUser,
  onAddUser,
  appConfig
}: { 
  users: any[], 
  isDarkMode: boolean, 
  onApprove: (uid: string) => void, 
  onReject: (uid: string) => void,
  onUpdateRole: (uid: string, role: UserRole) => void,
  onDeleteUser: (uid: string) => void,
  onAddUser: (email: string, role: UserRole) => Promise<void>,
  appConfig: Config,
  key?: string
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Team Leader');
  const [isAdding, setIsAdding] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [openDropdownRowId, setOpenDropdownRowId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single');
  const [bulkEmails, setBulkEmails] = useState('');
  const [bulkRoles, setBulkRoles] = useState<Record<string, UserRole>>({});
  const [bulkStep, setBulkStep] = useState<'input' | 'configure'>('input');

  const parsedEmails = React.useMemo(() => {
    const rawList = bulkEmails
      .split(/[\s,;\n]+/)
      .map(email => email.trim().toLowerCase())
      .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    
    // De-duplicate
    return Array.from(new Set(rawList));
  }, [bulkEmails]);

  const parsedBulkEmailsCount = parsedEmails.length;

  React.useEffect(() => {
    if (!showAddForm) {
      setBulkStep('input');
      setBulkEmails('');
      setBulkRoles({});
    }
  }, [showAddForm]);

  const handleNextStep = () => {
    if (parsedEmails.length === 0) return;
    setBulkRoles(prev => {
      const next = { ...prev };
      parsedEmails.forEach(email => {
        if (!next[email]) {
          next[email] = newRole;
        }
      });
      return next;
    });
    setBulkStep('configure');
  };

  const handleDefaultRoleChange = (val: UserRole) => {
    setNewRole(val);
    setBulkRoles(prev => {
      const next = { ...prev };
      parsedEmails.forEach(email => {
        next[email] = val;
      });
      return next;
    });
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const otherUsers = [...users.filter(u => u.status !== 'pending')].sort((a, b) => {
    const aIsOwner = (a.role || '').toLowerCase() === 'owner';
    const bIsOwner = (b.role || '').toLowerCase() === 'owner';
    if (aIsOwner && !bIsOwner) return -1;
    if (!aIsOwner && bIsOwner) return 1;
    return 0;
  });

  const dynamicRolesList = appConfig?.ROLES_LIST || ['owner', 'admin', 'Team Leader', 'Manager', 'Digital Merch'];
  const roleOptions = dynamicRolesList
    .filter(r => r.toLowerCase() !== 'owner')
    .map(r => ({ value: r, label: r === 'admin' ? 'Admin' : r }));

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addMode === 'single') {
      if (!newEmail) return;
      setIsAdding(true);
      try {
        await onAddUser(newEmail.trim(), newRole);
        setNewEmail('');
        setShowAddForm(false);
      } finally {
        setIsAdding(false);
      }
    } else {
      if (parsedEmails.length === 0) return;
      setIsAdding(true);
      try {
        for (const email of parsedEmails) {
          const role = bulkRoles[email] || newRole;
          await onAddUser(email, role);
        }

        setBulkEmails('');
        setBulkRoles({});
        setShowAddForm(false);
      } finally {
        setIsAdding(false);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[1700px] mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className={`text-3xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>User Management</h2>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-gray-500 text-sm">Review requests and manage system access.</p>
            <div className="flex gap-2">
              <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                Active: {users.filter(u => !u.isAuthorizedOnly).length}
              </span>
              <span className="bg-blue-50 text-blue-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                Invited: {users.filter(u => u.isAuthorizedOnly).length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className={`${isDarkMode ? 'bg-dark-800 hover:bg-dark-700' : 'bg-gray-900 hover:bg-black'} text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors cursor-pointer`}
          >
            {showAddForm ? <X size={18} /> : <PlusCircle size={18} />}
            {showAddForm ? 'Cancel' : 'Add User'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
            animate={{ opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' } }}
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            className="relative z-50"
          >
            <div className={`p-8 pb-48 rounded-[2rem] border relative ${isDarkMode ? 'bg-dark-900 border-dark-800 focus-within:border-orange-500/50' : 'bg-white border-gray-100 shadow-xl focus-within:border-[#FE5900]/30'} transition-colors duration-300`}>
              <div className="">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                  <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Authorize New User</h3>
                  
                  <div className="flex bg-gray-100 dark:bg-dark-800 p-1 rounded-xl w-fit gap-1">
                    <button
                      type="button"
                      onClick={() => setAddMode('single')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        addMode === 'single'
                          ? (isDarkMode ? 'bg-dark-900 text-white' : 'bg-white text-gray-900 shadow-sm')
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Single User
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddMode('bulk')}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        addMode === 'bulk'
                          ? (isDarkMode ? 'bg-dark-900 text-white' : 'bg-white text-gray-900 shadow-sm')
                          : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      Multiple Users
                    </button>
                  </div>
                </div>

                {addMode === 'single' ? (
                  <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end relative z-30">
                    <div className="md:col-span-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Email Address</label>
                      <input 
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="user@example.com"
                        className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all ${
                          isDarkMode ? 'bg-dark-800 border-dark-700 text-white focus:border-orange-500' : 'bg-white border-gray-200 focus:border-[#FE5900]'
                        }`}
                      />
                    </div>
                    <div className="md:col-span-1">
                      <CustomSelect 
                        label="Assigned Role"
                        value={newRole}
                        options={roleOptions}
                        onChange={(val) => setNewRole(val as UserRole)}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                    <div>
                      <button 
                        disabled={isAdding || !newEmail}
                        className="w-full py-3.5 bg-[#FE5900] text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-orange-200 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isAdding ? 'Authorizing...' : 'Authorize Access'}
                        <ShieldCheck size={16} />
                      </button>
                    </div>
                  </form>
                ) : bulkStep === 'input' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end relative z-30">
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">
                        Email Addresses (Comma/Space/Semicolon/Newline separated)
                      </label>
                      <textarea 
                        required
                        rows={5}
                        value={bulkEmails}
                        onChange={(e) => setBulkEmails(e.target.value)}
                        placeholder="user1@example.com&#10;user2@example.com, user3@example.com"
                        className={`w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all resize-none ${
                          isDarkMode ? 'bg-dark-800 border-dark-700 text-white focus:border-orange-500' : 'bg-white border-gray-200 focus:border-[#FE5900]'
                        }`}
                      />
                      {parsedBulkEmailsCount > 0 && (
                        <span className="text-xs text-[#FE5900] font-bold mt-1.5 block">
                          Found {parsedBulkEmailsCount} validated email address(es).
                        </span>
                      )}
                    </div>
                    <div className="md:col-span-1">
                      <button 
                        type="button"
                        onClick={handleNextStep}
                        disabled={parsedBulkEmailsCount === 0}
                        className="w-full py-3.5 bg-[#FE5900] text-white rounded-xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-orange-200 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Next: Set Individual Roles
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start relative z-30">
                    <div className="md:col-span-2 space-y-4">
                      <div className="flex justify-between items-center bg-gray-50 dark:bg-dark-800/50 p-4 rounded-2xl border border-gray-100 dark:border-dark-700/50">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                            Configure Individual Roles ({parsedEmails.length} Users)
                          </span>
                          <p className="text-[11px] text-gray-400 mt-0.5">Choose a custom role for each user below prior to finalizing access authorizations.</p>
                        </div>
                      </div>

                      <div className="max-h-[290px] overflow-y-auto space-y-2.5 pr-2 scrollbar-thin">
                        {parsedEmails.map((email) => {
                          const currentRole = bulkRoles[email] || newRole;
                          return (
                            <div 
                              key={email}
                              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border transition-all gap-4 ${
                                isDarkMode ? 'bg-dark-800/40 border-dark-700/50 hover:border-dark-700/85' : 'bg-gray-50/50 border-gray-100/80 hover:border-gray-200/80 shadow-sm'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#FE5900] flex-shrink-0 animate-pulse" />
                                <span className={`text-xs font-bold truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-850'}`}>
                                  {email}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 justify-between sm:justify-end flex-shrink-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase font-black tracking-wider text-gray-400">Role:</span>
                                  <CompactSelect 
                                    value={currentRole}
                                    options={roleOptions}
                                    onChange={(val) => setBulkRoles(prev => ({ ...prev, [email]: val as UserRole }))}
                                    isDarkMode={isDarkMode}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const regex = new RegExp(`\\b${email.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
                                    const updated = bulkEmails.replace(regex, '').trim();
                                    setBulkEmails(updated);
                                  }}
                                  className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                                  title="Remove user"
                                >
                                  <X size={15} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="md:col-span-1 space-y-6">
                      <CustomSelect 
                        label="Bulk Override Roles (All)"
                        value={newRole}
                        options={roleOptions}
                        onChange={(val) => handleDefaultRoleChange(val as UserRole)}
                        isDarkMode={isDarkMode}
                      />
                      <div className="p-4 rounded-2xl border border-dashed border-gray-200 dark:border-dark-700 bg-gray-50/10 dark:bg-dark-800/10 space-y-2">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-gray-400">Review Summary</h4>
                        <div className="space-y-1">
                          {roleOptions.map(opt => {
                            const count = parsedEmails.filter(email => (bulkRoles[email] || newRole) === opt.value).length;
                            if (count === 0) return null;
                            return (
                              <div key={opt.value} className="flex justify-between text-xs text-gray-500">
                                <span>{opt.label}:</span>
                                <span className="font-extrabold">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <button 
                          disabled={isAdding || parsedEmails.length === 0}
                          className="w-full py-3.5 bg-[#FE5900] text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-orange-200 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isAdding ? 'Authorizing...' : `Authorize ${parsedEmails.length} User(s)`}
                          <ShieldCheck size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkStep('input')}
                          className="w-full py-2 bg-transparent text-gray-400 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          &larr; Back to Edit Emails
                        </button>
                      </div>
                    </div>
                  </form>
                )}
                <p className="mt-4 text-xs text-gray-400 italic font-medium">Pre-authorizing emails will grant users instant 'approved' status with the chosen role when they first sign in with Google.</p>
              </div>
          </div>
        </motion.div>
        )}
      </AnimatePresence>

      {pendingUsers.length > 0 && (
        <div className="space-y-4">
          <h3 className={`text-sm font-black uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-orange-500' : 'text-[#FE5900]'}`}>
            <ShieldAlert size={16} />
            Pending Proposals ({pendingUsers.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingUsers.map(u => (
              <motion.div 
                key={u.uid}
                layout
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`p-6 rounded-3xl border flex items-center justify-between transition-colors ${isDarkMode ? 'bg-dark-900 border-dark-800' : 'bg-white border-gray-100 shadow-sm'}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                    {u.name[0]}
                  </div>
                  <div>
                    <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{u.name}</h4>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => onApprove(u.uid)}
                    className="p-3 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-colors cursor-pointer"
                    title="Approve"
                  >
                    <Check size={20} />
                  </button>
                  <button 
                    onClick={() => onReject(u.uid)}
                    className="p-3 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors cursor-pointer"
                    title="Reject"
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className={`rounded-3xl border ${isDarkMode ? 'bg-dark-900 border-dark-800' : 'bg-white border-gray-100 shadow-sm'}`}>
        <div className="overflow-x-auto pb-[180px] -mb-[180px]">
          <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className={`text-[11px] uppercase tracking-wider text-gray-400 border-b ${isDarkMode ? 'border-dark-800' : 'border-gray-50'}`}>
              <th className="px-6 py-4 font-bold">User</th>
              <th className="px-6 py-4 font-bold">Status</th>
              <th className="px-6 py-4 font-bold">Role</th>
              <th className="px-6 py-4 font-bold">Action</th>
            </tr>
          </thead>
          <tbody>
            {otherUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                  No active or authorized users found
                </td>
              </tr>
            ) : (
              otherUsers.map(u => {
                const isDropdownOpen = openDropdownRowId === u.uid;
                return (
                  <tr key={u.uid} className={`border-b last:border-0 relative ${
                    isDropdownOpen ? 'z-[50]' : 'hover:z-[30] focus-within:z-[30]'
                  } ${isDarkMode ? 'border-dark-800/50 hover:bg-dark-800/30' : 'border-gray-50 hover:bg-gray-50/50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                          isDarkMode ? 'bg-dark-800 text-gray-500' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {u.name ? u.name[0] : '?'}
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-950'}`}>{u.name}</p>
                          <p className="text-[10px] text-gray-500 font-medium">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        u.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 
                        u.status === 'authorized' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {u.status === 'authorized' ? 'Invited' : u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-[140px]">
                        {u.role?.toLowerCase() === 'owner' || u.email === 'ecom_ai_qa@public.gr' ? (
                          <div className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest text-center ${
                            isDarkMode ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-amber-50 text-amber-600 border border-amber-100'
                          }`}>
                            Owner
                          </div>
                        ) : (
                          <CompactSelect 
                            value={u.role}
                            options={roleOptions}
                            onChange={(role) => onUpdateRole(u.uid, role as UserRole)}
                            isDarkMode={isDarkMode}
                            onOpenChange={(open) => setOpenDropdownRowId(open ? u.uid : null)}
                          />
                        )}
                      </div>
                    </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {u.role?.toLowerCase() === 'owner' || u.email === 'ecom_ai_qa@public.gr' ? (
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider italic">System Owner</p>
                      ) : u.isAuthorizedOnly ? (
                        <p className="text-[10px] text-gray-400 font-medium italic">Pending First Sign-in</p>
                      ) : (
                        <>
                          {u.status === 'rejected' && (
                            <button 
                              onClick={() => onApprove(u.uid)}
                              className="text-[10px] font-bold text-[#FE5900] hover:underline uppercase tracking-wider cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          {u.status === 'approved' && (
                            <button 
                              onClick={() => onReject(u.uid)}
                              className="text-[10px] font-bold text-red-500 hover:underline uppercase tracking-wider cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </>
                      )}
                      {u.role?.toLowerCase() !== 'owner' && u.email !== 'ecom_ai_qa@public.gr' && (
                        <button 
                          onClick={() => setUserToDelete(u)}
                          className="p-2 text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                          title={u.isAuthorizedOnly ? "Delete Invitation" : "Delete User Profile"}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setUserToDelete(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border ${
                isDarkMode ? 'bg-dark-900 border-dark-800' : 'bg-white border-gray-100'
              }`}
            >
              <div className="flex flex-col items-center text-center space-y-6">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
                  isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-500'
                }`}>
                  <AlertCircle size={40} />
                </div>
                
                <div className="space-y-2">
                  <h3 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Delete User?</h3>
                  <p className="text-gray-500 text-sm px-4">
                    Are you sure you want to delete <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} border-b-2 border-red-200`}>{userToDelete.email}</span>? This action cannot be undone.
                  </p>
                </div>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setUserToDelete(null)}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-all cursor-pointer ${
                      isDarkMode ? 'bg-dark-800 text-gray-400 hover:bg-dark-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onDeleteUser(userToDelete.uid);
                      setUserToDelete(null);
                    }}
                    className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-200 hover:bg-red-600 transition-all cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  </motion.div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  "Completed": "#10B981",
  "Under Review": "#8B5CF6",
  "To Do": "#94A3B8",
  "In Progress": "#FE5900",
  "Delayed": "#EF4444",
  "Blocked / Alert": "#5a5b63"
};

const CustomChartTooltip = ({ active, payload, label, isDarkMode }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={`p-4 rounded-2xl border text-xs shadow-2xl backdrop-blur-md font-sans transition-all duration-300 ${
        isDarkMode 
          ? 'bg-[#2d2e32]/95 border-dark-700/60 text-gray-200 shadow-black/50' 
          : 'bg-white/95 border-gray-100 text-gray-800 shadow-gray-200/40'
      }`}>
        <p className={`font-black uppercase tracking-widest mb-2.5 text-[9px] ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{label}</p>
        <div className="space-y-1.5">
          {payload.map((pld: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pld.color || pld.fill }} />
                <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{pld.name || pld.dataKey}:</span>
              </div>
              <span className="font-extrabold text-[#FE5900] tracking-tight">{pld.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

function DashboardView({ 
  stats, 
  requests, 
  isDarkMode = false,
  statusFilter,
  setStatusFilter,
  qaFilter,
  setQaFilter,
  divisionFilter,
  setDivisionFilter,
  setArchiveStatusFilter,
  setArchiveQAFilter,
  onTabChange,
  appConfig,
  userRole
}: { 
  stats: any, 
  requests: Request[], 
  isDarkMode?: boolean, 
  key?: string,
  statusFilter: string,
  setStatusFilter: (s: string) => void,
  qaFilter: string,
  setQaFilter: (q: string) => void,
  divisionFilter: string,
  setDivisionFilter: (d: string) => void,
  setArchiveStatusFilter?: (s: string) => void,
  setArchiveQAFilter?: (q: string) => void,
  onTabChange: (tab: any) => void,
  appConfig: Config,
  userRole?: string
}) {
  const [localDivisionFilter, setLocalDivisionFilter] = useState<string>('All');
  const [workloadStatusFilter, setWorkloadStatusFilter] = useState<string>('All');

  const filteredRequests = useMemo(() => {
    // Include archived requests in the base pool so "Done" and "SLA Compliance" can see them
    if (localDivisionFilter === 'All') return requests;
    return requests.filter(r => r.division === localDivisionFilter);
  }, [requests, localDivisionFilter]);

  const filteredStats = useMemo(() => {
    const now = new Date();
    let s = { todo: 0, inProgress: 0, pendingQA: 0, completed: 0, alert: 0, delayed: 0 };

    filteredRequests.forEach(r => {
      const status = r.status.trim();
      const qaStatus = r.qaStatus.trim();
      const now = new Date();
      const deadline = new Date(r.slaDeadline);

      const isLive = status === "Live";
      const isApproved = qaStatus === "Approved";

      if (isLive && isApproved) {
        s.completed++;
        return;
      }

      // Skip archived requests for all other dashboard card counts
      if (r.isArchived) return;

      if (status === "Not Started") s.todo++;
      else if (status === "In Progress") s.inProgress++;
      else if (status === "Live" && qaStatus === "Pending") s.pendingQA++;
      
      if (status !== "Live" && now > deadline && status !== "Delayed") s.delayed++;
      else if (status === "Delayed") s.delayed++;

      if (status === "Blocked" || qaStatus === "Rejected") s.alert++;
    });

    return s;
  }, [filteredRequests]);

  const handleStatClick = (status: string, qa: string, targetTab: 'list' | 'archive' = 'list') => {
    if (targetTab === 'archive') {
      setArchiveStatusFilter?.(status);
      setArchiveQAFilter?.(qa);
    } else {
      setStatusFilter(status);
      setQaFilter(qa);
    }
    onTabChange(targetTab);
  };

  const insights = useMemo(() => {
    // SLA compliance should consider all non-archived work
    const inDiv = (localDivisionFilter === 'All' ? requests : requests.filter(r => r.division === localDivisionFilter))
      .filter(r => !r.isArchived);
    
    const total = inDiv.length;
    if (total === 0) return { slaCompliance: 100 };

    const delayed = inDiv.filter(r => {
      const now = new Date();
      const deadline = new Date(r.slaDeadline);
      const isLive = r.status.trim() === "Live";
      const isDelayed = r.status.trim() === "Delayed";
      return (!isLive && now > deadline) || isDelayed;
    }).length;

    const compliance = Math.round(((total - delayed) / total) * 100);

    return { slaCompliance: compliance };
  }, [requests, localDivisionFilter]);

  // 1. Request Volume Over Time (last 15 days)
  const volumeData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRequests.forEach(r => {
      if (!r.createdAt) return;
      // Get date string (YYYY-MM-DD)
      const dStr = r.createdAt.substring(0, 10);
      counts[dStr] = (counts[dStr] || 0) + 1;
    });

    const data = [];
    const now = new Date();
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dStr = d.toISOString().substring(0, 10);
      const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      data.push({
        date: dStr,
        name: label,
        Requests: counts[dStr] || 0
      });
    }
    return data;
  }, [filteredRequests]);

  // 2. SLA Compliance Rate Over Time (last 15 days, cumulative up to each day)
  const complianceData = useMemo(() => {
    const now = new Date();
    const data = [];
    
    for (let i = 14; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59, 999); // match full day end
      const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

      // Calculate snapshot of requests generated up to that date
      const requestsUpToDay = filteredRequests.filter(r => {
        if (!r.createdAt) return false;
        const createdDate = new Date(r.createdAt);
        return createdDate.getTime() <= dEnd.getTime();
      });

      if (requestsUpToDay.length === 0) {
        data.push({
          name: label,
          Compliance: 100
        });
      } else {
        const delayedCount = requestsUpToDay.filter(r => {
          const deadline = new Date(r.slaDeadline);
          const isLive = r.status.trim() === "Live";
          const isDelayed = r.status.trim() === "Delayed";
          return (!isLive && now > deadline) || isDelayed;
        }).length;

        const compliancePercent = Math.round(((requestsUpToDay.length - delayedCount) / requestsUpToDay.length) * 100);
        data.push({
          name: label,
          Compliance: compliancePercent
        });
      }
    }
    return data;
  }, [filteredRequests]);

  // 3. Breakdown of Requests by Owner (Limit to Top 6)
  const ownerBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRequests.forEach(r => {
      if (r.isArchived) return;
      const ownerName = r.owner?.trim() || 'Unassigned';
      counts[ownerName] = (counts[ownerName] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredRequests]);

  // 4. Breakdown of Requests by Status (for Pie Chart)
  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredRequests.forEach(r => {
      if (r.isArchived) return;
      let statusLabel = r.status.trim();
      const qaStatus = r.qaStatus.trim();
      
      if (statusLabel === "Live" && qaStatus === "Approved") {
        statusLabel = "Completed";
      } else if (statusLabel === "Live" && qaStatus === "Pending") {
        statusLabel = "Under Review";
      } else if (statusLabel === "Not Started") {
        statusLabel = "To Do";
      } else if (statusLabel === "In Progress") {
        statusLabel = "In Progress";
      } else if (statusLabel === "Delayed") {
        statusLabel = "Delayed";
      } else if (statusLabel === "Blocked" || qaStatus === "Rejected") {
        statusLabel = "Blocked / Alert";
      }
      
      counts[statusLabel] = (counts[statusLabel] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);
  }, [filteredRequests]);

  const matchesWorkloadStatus = React.useCallback((r: Request, filter: string) => {
    if (filter === 'All') return !r.isArchived;

    const status = r.status.trim();
    const qaStatus = r.qaStatus.trim();
    const now = new Date();
    const deadline = new Date(r.slaDeadline);

    const isLive = status === "Live";
    const isApproved = qaStatus === "Approved";

    if (filter === 'Done') {
      return isLive && isApproved;
    }

    if (r.isArchived) return false;

    if (filter === 'Active') {
      return status === "In Progress";
    }
    if (filter === 'Review') {
      return status === "Live" && qaStatus === "Pending";
    }
    if (filter === 'Delayed') {
      return (status !== "Live" && now > deadline && status !== "Delayed") || status === "Delayed";
    }
    if (filter === 'Blocked') {
      return status === "Blocked" || qaStatus === "Rejected";
    }
    return true;
  }, []);

  return (
    <div className="max-w-[1700px] mx-auto space-y-8 pb-20">
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-end gap-6 p-6 rounded-[2rem] transition-colors ${
        isDarkMode ? 'bg-dark-900/40 border border-dark-800' : 'bg-gradient-to-r from-transparent via-[#FE5900]/5 to-transparent'
      }`}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-orange-500/10 text-orange-500' : 'bg-[#FE5900]/10 text-[#FE5900]'}`}>
              <TrendingUp size={20} />
            </div>
            <h2 className={`text-3xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Performance</h2>
          </div>
          <p className="text-gray-500 font-medium ml-12">System overview and critical metrics.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="min-w-[200px]">
            <CustomSelect
              value={localDivisionFilter}
              onChange={(val) => setLocalDivisionFilter(val as any)}
              isDarkMode={isDarkMode}
              options={[
                { value: 'All', label: 'Global View' },
                { value: 'Home', label: 'Home' },
                { value: 'Entertainment', label: 'Entertainment' },
                { value: 'Technology', label: 'Technology' },
              ]}
              className="!bg-transparent"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Active" value={filteredStats.inProgress} color="bg-[#FE5900]" icon={Zap} isDarkMode={isDarkMode} onClick={() => handleStatClick('In Progress', 'All')} />
        <StatCard label="Review" value={filteredStats.pendingQA} color="bg-purple-500" icon={ShieldCheck} isDarkMode={isDarkMode} onClick={() => handleStatClick('Live', 'Pending')} />
        <StatCard label="Delayed" value={filteredStats.delayed} color="bg-red-500" icon={AlertCircle} isDarkMode={isDarkMode} onClick={() => handleStatClick('Delayed', 'All')} />
        <StatCard label="Blocked" value={filteredStats.alert} color={isDarkMode ? "bg-dark-800" : "bg-gray-800"} icon={X} isDarkMode={isDarkMode} onClick={() => handleStatClick('Blocked', 'All')} />
        <StatCard label="Done" value={filteredStats.completed} color="bg-emerald-500" icon={CheckCircle2} isDarkMode={isDarkMode} onClick={() => handleStatClick('Live', 'Approved', 'archive')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {localDivisionFilter === 'All' && (
          <div className={`lg:col-span-2 p-8 rounded-[2.5rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
              <div>
                <h3 className={`text-xl font-black flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  <BarChart3 size={20} className="text-[#FE5900]" />
                  Workload Distribution
                </h3>
                <p className="text-xs text-gray-400 font-semibold mt-1">
                  {workloadStatusFilter === 'All' 
                    ? 'All active requests across divisions' 
                    : `Active requests with status: ${workloadStatusFilter}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {(userRole === 'admin' || userRole === 'owner' || userRole === 'Manager') && (
                  <div className="min-w-[160px]">
                    <CustomSelect
                      value={workloadStatusFilter}
                      onChange={(val) => setWorkloadStatusFilter(val)}
                      isDarkMode={isDarkMode}
                      placeholder="Filter Status..."
                      options={[
                        { value: 'All', label: 'All Status' },
                        { value: 'Active', label: 'Active' },
                        { value: 'Review', label: 'Review' },
                        { value: 'Delayed', label: 'Delayed' },
                        { value: 'Blocked', label: 'Blocked' },
                        { value: 'Done', label: 'Done' },
                      ]}
                    />
                  </div>
                )}
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest hidden sm:inline">By Division</span>
              </div>
            </div>

            {workloadStatusFilter !== 'All' && (
              <div className={`mb-6 p-4 rounded-xl flex items-center justify-between transition-colors ${
                isDarkMode ? 'bg-orange-500/5 border border-orange-500/10' : 'bg-[#FE5900]/5 border border-[#FE5900]/10'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Active filter: <span className="text-[#FE5900] font-black">{workloadStatusFilter}</span>
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total matching:</span>
                  <span className="text-xl font-black text-[#FE5900]">
                    {requests.filter(r => matchesWorkloadStatus(r, workloadStatusFilter)).length}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              {(() => {
                const activePool = requests.filter(r => matchesWorkloadStatus(r, workloadStatusFilter));
                
                const totalActiveCount = activePool.length;
                const divisions = Object.keys(appConfig.OWNERS);
                const divisionData = divisions.map(div => {
                  const count = activePool.filter(r => r.division === div).length;
                  const percentRaw = totalActiveCount ? (count / totalActiveCount) * 100 : 0;
                  return { div, count, percentRaw, floor: Math.floor(percentRaw), remainder: percentRaw - Math.floor(percentRaw) };
                });

                const sumOfFloors = divisionData.reduce((acc, d) => acc + d.floor, 0);
                const diff = totalActiveCount > 0 ? 100 - sumOfFloors : 0;
                
                const adjustedData = [...divisionData]
                  .sort((a, b) => b.remainder - a.remainder)
                  .map((d, i) => ({
                    ...d,
                    finalPercent: i < diff ? d.floor + 1 : d.floor
                  }));

                const finalSortedData = divisions.map(divName => adjustedData.find(d => d.div === divName)!);

                return finalSortedData.map((d) => {
                  return (
                    <div key={d.div} className="group">
                      <div className="flex justify-between items-end mb-3">
                        <div>
                          <span className={`block text-xs font-bold opacity-60 uppercase tracking-tight ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{d.div}</span>
                          <span className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{d.count}</span>
                        </div>
                        <span className="text-[#FE5900] font-black text-xs">{d.finalPercent}%</span>
                      </div>
                      <div className={`h-3 rounded-full overflow-hidden relative ${isDarkMode ? 'bg-dark-800' : 'bg-gray-100'}`}>
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${d.finalPercent}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-[#FE5900] to-[#ff8533] rounded-full shadow-[0_0_10px_rgba(254,89,0,0.3)]"
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}
        
        <div className={`p-8 rounded-[2.5rem] border shadow-2xl relative overflow-hidden flex flex-col justify-between ${localDivisionFilter === 'All' ? '' : 'lg:col-span-3'} ${isDarkMode ? 'dark-card' : 'bg-white border-[#FE5900]/5 shadow-[#FE5900]/5'}`}>
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Activity size={120} className="text-[#FE5900]" />
          </div>
          
          <div>
            <h3 className={`text-xl font-black mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Insights</h3>
            <div className="space-y-6">
              <div className="group">
                <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-black mb-2 flex items-center gap-2">
                  <Target size={12} className="text-emerald-500" />
                  SLA HEALTH
                </p>
                <div className="flex items-end gap-2">
                  <span className={`text-4xl font-black leading-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{insights.slaCompliance}%</span>
                  <span className="text-xs font-bold text-emerald-500 mb-1">On Time</span>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* Advanced Visual Analytics Section */}
      <div className="space-y-8 pt-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isDarkMode ? 'bg-[#ff8533]/10 text-[#FE5900]' : 'bg-[#FE5900]/10 text-[#FE5900]'}`}>
            <BarChart3 size={20} />
          </div>
          <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Advanced Analytics & Trends</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Request Volume Over Time */}
          <div className={`p-8 rounded-[2.5rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h4 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Request Volume Trend</h4>
                <p className="text-xs text-gray-400 font-semibold mt-1">Daily inbound submissions over the last 15 days</p>
              </div>
              <Activity size={18} className="text-[#FE5900]" />
            </div>
            <div className="h-[320px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FE5900" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#FE5900" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis 
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 11, fontWeight: 600 }}
                  />
                  <Tooltip content={<CustomChartTooltip isDarkMode={isDarkMode} />} />
                  <Area 
                    type="monotone" 
                    dataKey="Requests" 
                    stroke="#FE5900" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorRequests)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SLA Compliance Trends */}
          <div className={`p-8 rounded-[2.5rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h4 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>SLA Compliance Rate</h4>
                <p className="text-xs text-gray-400 font-semibold mt-1">Historical cumulative SLA compliance progress</p>
              </div>
              <Target size={18} className="text-[#FE5900]" />
            </div>
            <div className="h-[320px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={complianceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCompliance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 11, fontWeight: 600 }}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 11, fontWeight: 600 }}
                    unit="%"
                  />
                  <Tooltip content={<CustomChartTooltip isDarkMode={isDarkMode} />} />
                  <Area 
                    type="monotone" 
                    dataKey="Compliance" 
                    stroke="#10B981" 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorCompliance)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Status Breakdown Diagram */}
          <div className={`p-8 rounded-[2.5rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'} flex flex-col justify-between`}>
            <div className="mb-4">
              <h4 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Status Breakdown</h4>
              <p className="text-xs text-gray-400 font-semibold mt-1">Active requirements status share</p>
            </div>
            <div className="h-[240px] w-full relative flex items-center justify-center">
              {statusBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusBreakdown.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={STATUS_COLORS[entry.name] || '#94A3B8'} 
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomChartTooltip isDarkMode={isDarkMode} />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500 italic">No active requests found</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-4 border-t border-gray-100/10 dark:border-dark-800 text-xs">
              {statusBreakdown.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[entry.name] || '#94A3B8' }} />
                  <span className={`font-semibold overflow-hidden text-ellipsis whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-650'}`}>{entry.name}</span>
                  <span className={`ml-auto font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{entry.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Owner Breakdown Horizontal Chart */}
          <div className={`lg:col-span-2 p-8 rounded-[2.5rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h4 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Owner Assignment Allocation</h4>
                <p className="text-xs text-gray-400 font-semibold mt-1">Active requirements assigned per core owner</p>
              </div>
              <Users size={18} className="text-[#FE5900]" />
            </div>
            <div className="h-[310px] w-full relative">
              {ownerBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ownerBreakdown}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                    <XAxis 
                       type="number" 
                       allowDecimals={false}
                       axisLine={false}
                       tickLine={false}
                       tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 11, fontWeight: 600 }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 11, fontWeight: 600 }}
                      width={100}
                    />
                    <Tooltip content={<CustomChartTooltip isDarkMode={isDarkMode} />} />
                    <Bar dataKey="value" name="Assigned Tasks" fill="#FE5900" radius={[0, 8, 8, 0]} maxBarSize={22}>
                      {ownerBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#FE5900' : '#FE5900CC'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-gray-500 italic">No assigned owners found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateRequestForm({ 
  onSubmit, 
  isDarkMode = false,
  appConfig,
  divisionCategories
}: { 
  onSubmit: (data: any) => void, 
  isDarkMode?: boolean, 
  key?: string,
  appConfig: Config,
  divisionCategories: Record<string, string[]>
}) {
  const [formData, setFormData] = useState({
    submitter: '',
    division: (Object.keys(appConfig.OWNERS)[0] || 'Home') as Division,
    category: '',
    requestType: appConfig.REQUEST_TYPES[0] || 'Major Issue',
    brief: '',
    description: '',
    valuesCount: 0,
  });

  const [errors, setErrors] = useState<{ submitter?: boolean, category?: boolean }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { submitter?: boolean, category?: boolean } = {};
    if (!formData.submitter) newErrors.submitter = true;
    if (!formData.category) newErrors.category = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setErrorMessage("Submitter and Category are required to submit a request.");
      return;
    }

    setErrors({});
    setErrorMessage(null);
    onSubmit(formData);
  };

  const categories = divisionCategories[formData.division] || [];

  const priorityTier = appConfig.PRIORITY_MAP[formData.requestType] || 3;
  const owner = appConfig.OWNERS[formData.division] || "Unassigned";

  // Calculate standard SLA
  const previewSlaDate = useMemo(() => {
    if (!formData.category) return null;
    return calculateSLA(
      new Date(),
      formData.category,
      priorityTier,
      formData.valuesCount || 0,
      formData.requestType
    );
  }, [formData.category, formData.requestType, formData.valuesCount, priorityTier]);

  const daysRequired = useMemo(() => {
    if (!formData.category) return null;
    if (formData.requestType === "Configurational") return 2;
    const categoryCapacities = appConfig.CAPACITY_MAP[formData.category];
    let dailyCapacity = 30;
    if (categoryCapacities && categoryCapacities[priorityTier]) {
      dailyCapacity = categoryCapacities[priorityTier];
    }
    return Math.ceil((formData.valuesCount || 0) / dailyCapacity) || 1;
  }, [formData.category, formData.requestType, formData.valuesCount, priorityTier]);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`max-w-4xl mx-auto p-10 rounded-[2.5rem] shadow-xl border mb-20 transition-colors ${
        isDarkMode ? 'dark-card' : 'bg-white border-gray-100 shadow-black/5'
      }`}
    >
      <div className="mb-8">
        <h2 className={`text-3xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>New Request</h2>
        <p className="text-gray-500 mt-1 font-medium">Please provide the details for your new request.</p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-bold leading-normal flex items-center gap-2 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        <CustomSelect
          label="Submitter"
          value={formData.submitter}
          onChange={(val) => {
            setFormData({...formData, submitter: val});
            if (errors.submitter) {
              const updatedErrors = { ...errors };
              delete updatedErrors.submitter;
              setErrors(updatedErrors);
              if (Object.keys(updatedErrors).length === 0) setErrorMessage(null);
            }
          }}
          placeholder="Select Submitter..."
          isDarkMode={isDarkMode}
          options={(appConfig.SUBMITTERS_LIST || APP_CONFIG.SUBMITTERS_LIST || []).map(s => ({ value: s, label: s }))}
          hasError={!!errors.submitter}
        />

        <div className="grid grid-cols-2 gap-6">
          <CustomSelect
            label="Division"
            value={formData.division}
            onChange={(val) => setFormData({...formData, division: val as Division, category: ''})}
            isDarkMode={isDarkMode}
            options={Object.keys(appConfig.OWNERS).map(d => ({ value: d, label: d }))}
          />
          <CustomSelect
            label="Category"
            value={formData.category}
            onChange={(val) => {
              setFormData({...formData, category: val});
              if (errors.category) {
                const updatedErrors = { ...errors };
                delete updatedErrors.category;
                setErrors(updatedErrors);
                if (Object.keys(updatedErrors).length === 0) setErrorMessage(null);
              }
            }}
            placeholder={formData.division ? "Select Category..." : "Select Division first"}
            disabled={!formData.division}
            isDarkMode={isDarkMode}
            options={categories.map(c => ({ value: c, label: c }))}
            hasError={!!errors.category}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <CustomSelect
            label="Request Type"
            value={formData.requestType}
            onChange={(val) => setFormData({...formData, requestType: val})}
            isDarkMode={isDarkMode}
            options={appConfig.REQUEST_TYPES.map(t => ({ value: t, label: t }))}
          />
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Values Count</label>
            <input 
              type="number" 
              min="1" 
              value={formData.valuesCount || ''}
              placeholder="e.g. 150"
              onChange={(e) => setFormData({...formData, valuesCount: parseInt(e.target.value) || 0})}
              required
              className={`w-full px-4 py-3 border rounded-xl transition-all outline-none font-medium text-sm h-[48px] ${
                isDarkMode 
                  ? 'bg-dark-900 border-dark-800 text-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10' 
                  : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-[#FE5900] focus:bg-white focus:ring-4 focus:ring-orange-500/5'
              }`}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Brief URL</label>
          <div className="relative group">
            <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#FE5900] transition-colors" size={18} />
            <input 
              type="url" 
              placeholder="https://docs.google.com/..." 
              value={formData.brief}
              onChange={(e) => setFormData({...formData, brief: e.target.value})}
              required
              className={`w-full pl-10 pr-4 py-3 border rounded-xl transition-all outline-none font-medium text-sm ${
                isDarkMode 
                  ? 'bg-dark-900 border-dark-800 text-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10' 
                  : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-[#FE5900] focus:bg-white focus:ring-4 focus:ring-orange-500/5'
              }`}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Description (Optional)</label>
          <textarea 
            rows={4}
            placeholder="Describe the scope of work (optional)..."
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className={`w-full px-4 py-3 border rounded-xl transition-all outline-none font-medium text-sm resize-none ${
              isDarkMode 
                ? 'bg-dark-900 border-dark-800 text-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10' 
                : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-[#FE5900] focus:bg-white focus:ring-4 focus:ring-orange-500/5'
            }`}
          />
        </div>

        {formData.category && previewSlaDate && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center gap-6 justify-between transition-colors ${
              isDarkMode 
                ? 'bg-orange-500/5 border-orange-500/20 text-orange-200' 
                : 'bg-orange-50/40 border-orange-100 text-orange-900 shadow-sm'
            }`}
          >
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center p-1.5 bg-orange-500 rounded-lg text-white">
                  <Zap size={14} className="animate-pulse" />
                </span>
                <span className="text-xs uppercase font-extrabold tracking-widest text-[#FE5900]">Live SLA & Assignment Preview</span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                <div className="space-y-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Assigned Owner</span>
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <User size={14} className="text-[#FE5900]" />
                    <span>{owner}</span>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Priority Tier</span>
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <Target size={14} className="text-[#FE5900]" />
                    <span>Tier {priorityTier}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Business Days</span>
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <Activity size={14} className="text-[#FE5900]" />
                    <span>{daysRequired} Days</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Target Deadline</span>
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <Clock size={14} className="text-[#FE5900]" />
                    <span>
                      {previewSlaDate.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`hidden md:block w-[1px] self-stretch ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200/60'}`} />

            <div className="flex flex-col justify-center items-start md:items-center">
              <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Status on submit</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-black uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                SLA Tracked
              </span>
            </div>
          </motion.div>
        )}

        <button 
          type="submit"
          className="w-full py-4 bg-[#FE5900] text-white rounded-2xl font-bold text-lg shadow-xl shadow-[#FE5900]/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
        >
          Submit Request
        </button>
      </form>
    </motion.div>
  );
}

// Fixed two-item subtask checklist shown on every request (list rows + modals).
function SubtaskChecks({
  request,
  onToggle,
  disabled = false,
  isDarkMode = false,
  compact = false,
}: {
  request: Request,
  onToggle: (key: RequestSubtaskKey, value: boolean) => void,
  disabled?: boolean,
  isDarkMode?: boolean,
  compact?: boolean,
}) {
  return (
    <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-2'}`}>
      {REQUEST_SUBTASKS.map(({ key, label }) => {
        const checked = !!request[key];
        return (
          <label
            key={key}
            title={disabled ? 'Locked' : (checked ? `Mark "${label}" as not done` : `Mark "${label}" as done`)}
            className={`flex items-center gap-2 select-none ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => { e.stopPropagation(); if (!disabled) onToggle(key, !checked); }}
              aria-pressed={checked}
              className={`flex items-center justify-center rounded-md border transition-all shrink-0 ${compact ? 'w-4 h-4' : 'w-5 h-5'} ${
                checked
                  ? 'bg-[#FE5900] border-[#FE5900] text-white shadow-[0_0_8px_rgba(254,89,0,0.25)]'
                  : isDarkMode
                    ? 'bg-dark-800 border-dark-700 text-transparent'
                    : 'bg-white border-gray-300 text-transparent'
              } ${disabled ? 'opacity-60' : 'cursor-pointer hover:border-[#FE5900]/60'}`}
            >
              <Check size={compact ? 11 : 13} strokeWidth={3.5} />
            </button>
            <span className={`font-bold tracking-tight whitespace-nowrap ${compact ? 'text-[10px]' : 'text-xs'} ${
              checked
                ? (isDarkMode ? 'text-gray-200' : 'text-gray-700')
                : 'text-gray-400'
            }`}>
              {label}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// Toggling "Request Actions" stamps (or clears) the completion time, which freezes the SLA clock.
function applySubtaskToggle(request: Request, key: RequestSubtaskKey, value: boolean): Request {
  const updated: Request = { ...request, [key]: value };
  if (key === 'subtaskRequestActions') {
    updated.requestActionsCompletedAt = value ? new Date().toISOString() : '';
  }
  return updated;
}

function RequestListView({
  requests, 
  isAdmin, 
  userRole,
  onUpdateStatus, 
  onUpdateQA,
  onUpdateRequest,
  onDeleteRequest,
  onUnarchive,
  onPinRequest,
  pinnedRequestIds = [],
  onOpenComments,
  onArchive, 
  onReset,
  isArchiveView = false,
  isDarkMode = false,
  compactView = false,
  externalSearch = '',
  statusFilter,
  setStatusFilter,
  qaFilter,
  setQaFilter,
  divisionFilter,
  setDivisionFilter,
  appConfig,
  divisionCategories,
  currentUserMappedOwner = '',
  isLoading = false
}: { 
  requests: Request[], 
  isAdmin: boolean, 
  userRole?: UserRole,
  onUpdateStatus: (id: string, status: RequestStatus) => void,
  onUpdateQA: (id: string, qa: QAStatus) => void,
  onUpdateRequest: (req: Request) => void,
  onDeleteRequest: (id: string) => void,
  onUnarchive?: (id: string) => void,
  onPinRequest?: (id: string) => void,
  pinnedRequestIds?: string[],
  onOpenComments: (id: string) => void,
  onArchive?: () => void,
  onReset?: () => void,
  isArchiveView?: boolean,
  isDarkMode?: boolean,
  compactView?: boolean,
  externalSearch?: string,
  key?: string,
  statusFilter: string,
  setStatusFilter: (s: string) => void,
  qaFilter: string,
  setQaFilter: (q: string) => void,
  divisionFilter: string,
  setDivisionFilter: (d: string) => void,
  appConfig: Config,
  divisionCategories: Record<string, string[]>,
  currentUserMappedOwner?: string,
  isLoading?: boolean
}) {
  const [editingRequest, setEditingRequest] = useState<Request | null>(null);
  const [viewingRequest, setViewingRequest] = useState<Request | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [openDropdownRowId, setOpenDropdownRowId] = useState<string | null>(null);

  // Filtering State
  const [searchTerm, setSearchTerm] = useState('');

  // Sorting State
  const [sortField, setSortField] = useState<'id' | 'category' | 'slaDeadline' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: 'id' | 'category' | 'slaDeadline') => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredRequests = useMemo(() => {
    const filtered = requests.filter(req => {
      const searchLower = searchTerm.toLowerCase();
      const extSearchLower = externalSearch.toLowerCase();
      
      const matchesInternalSearch = searchTerm === '' || 
        req.category.toLowerCase().includes(searchLower) || 
        req.id.toLowerCase().includes(searchLower) ||
        (req.requestId && req.requestId.toLowerCase().includes(searchLower)) ||
        req.submitter.toLowerCase().includes(searchLower) ||
        req.owner.toLowerCase().includes(searchLower) ||
        req.status.toLowerCase().includes(searchLower) ||
        req.qaStatus.toLowerCase().includes(searchLower) ||
        req.division.toLowerCase().includes(searchLower) ||
        (req.comments && req.comments.toLowerCase().includes(searchLower));

      const matchesExternalSearch = externalSearch === '' || 
        req.category.toLowerCase().includes(extSearchLower) || 
        req.id.toLowerCase().includes(extSearchLower) ||
        (req.requestId && req.requestId.toLowerCase().includes(extSearchLower)) ||
        req.submitter.toLowerCase().includes(extSearchLower) ||
        req.owner.toLowerCase().includes(extSearchLower) ||
        req.status.toLowerCase().includes(extSearchLower) ||
        req.qaStatus.toLowerCase().includes(extSearchLower) ||
        req.division.toLowerCase().includes(extSearchLower) ||
        (req.comments && req.comments.toLowerCase().includes(extSearchLower));

      const matchesStatus = statusFilter === 'All' || req.status === statusFilter;
      const matchesQA = qaFilter === 'All' || req.qaStatus === qaFilter;
      const matchesDivision = divisionFilter === 'All' || req.division === divisionFilter;
      
      return matchesInternalSearch && matchesExternalSearch && matchesStatus && matchesQA && matchesDivision;
    });

    // Sort according to active sortField or default fallback
    return [...filtered].sort((a, b) => {
      if (sortField) {
        let valA = '';
        let valB = '';
        let comp = 0;

        if (sortField === 'id') {
          valA = (a.requestId || a.id).toLowerCase();
          valB = (b.requestId || b.id).toLowerCase();
          comp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        } else if (sortField === 'category') {
          valA = a.category.toLowerCase();
          valB = b.category.toLowerCase();
          comp = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
        } else if (sortField === 'slaDeadline') {
          const timeA = new Date(a.slaDeadline).getTime();
          const timeB = new Date(b.slaDeadline).getTime();
          comp = timeA - timeB;
        }

        if (comp !== 0) {
          return sortDirection === 'asc' ? comp : -comp;
        }
      }

      // Fallback: Sort mapped owner items to the top, then pinned items
      const aOwned = currentUserMappedOwner && a.owner && a.owner.trim().toLowerCase() === currentUserMappedOwner.trim().toLowerCase();
      const bOwned = currentUserMappedOwner && b.owner && b.owner.trim().toLowerCase() === currentUserMappedOwner.trim().toLowerCase();

      if (aOwned && !bOwned) return -1;
      if (!aOwned && bOwned) return 1;

      const aPinned = pinnedRequestIds.includes(a.id);
      const bPinned = pinnedRequestIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [requests, searchTerm, externalSearch, statusFilter, qaFilter, divisionFilter, pinnedRequestIds, currentUserMappedOwner, sortField, sortDirection]);

  return (
    <div className="max-w-[1700px] mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="space-y-1">
          <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{isArchiveView ? 'Archived Records' : 'Requests'}</h2>
          <div className={`flex items-center gap-1.5 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            <Info size={14} className="text-[#FE5900]" />
            <span>Click any row to view details</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {!isArchiveView && isAdmin && (
            <div className="flex gap-3">
              {isConfirmingReset ? (
                <div className="flex gap-2 items-center bg-red-50 p-2 rounded-lg border border-red-100">
                  <span className="text-[10px] font-bold text-red-600 uppercase">Confirm reset?</span>
                  <button 
                    onClick={() => {
                      onReset?.();
                      setIsConfirmingReset(false);
                    }}
                    className="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold cursor-pointer"
                  >
                    RESET
                  </button>
                  <button 
                    onClick={() => setIsConfirmingReset(false)}
                    className="bg-gray-400 text-white px-2 py-1 rounded text-[10px] font-bold cursor-pointer"
                  >
                    CANCEL
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsConfirmingReset(true)}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:bg-red-600 transition-colors cursor-pointer z-50"
                >
                  Reset All Data
                </button>
              )}
              <button 
                onClick={() => {
                  console.log('Archive Completed button clicked');
                  onArchive?.();
                }}
                className="bg-[#FE5900] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:opacity-90 transition-opacity cursor-pointer z-50"
              >
                Archive Completed
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className={`p-4 rounded-2xl border transition-colors ${isDarkMode ? 'bg-dark-900/60 backdrop-blur-md border-dark-800' : 'bg-white border-gray-100 shadow-sm'} flex flex-wrap gap-4 items-end`}>
        <div className="flex-1 min-w-[200px]">
          <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Search</label>
          <div className={`flex items-center px-4 py-2.5 rounded-xl border transition-all ${isDarkMode ? 'bg-dark-800 border-dark-700 focus-within:border-orange-500 focus-within:ring-4 focus-within:ring-orange-500/10 shadow-inner' : 'bg-gray-50 border-gray-200 focus-within:border-[#FE5900]'}`}>
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input 
              type="text"
              placeholder="Search category, ID, submitter..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`bg-transparent border-none text-sm ml-2 focus:ring-0 w-full outline-none ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
            />
          </div>
        </div>

        <div className="w-[150px]">
          <CustomSelect 
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            isDarkMode={isDarkMode}
            options={[
              { value: 'All', label: 'All Status' },
              { value: 'Not Started', label: 'Not Started' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Live', label: 'Live' },
              { value: 'Delayed', label: 'Delayed' },
              { value: 'Blocked', label: 'Blocked' },
            ]}
          />
        </div>

        <div className="w-[150px]">
          <CustomSelect 
            label="QA Status"
            value={qaFilter}
            onChange={setQaFilter}
            isDarkMode={isDarkMode}
            options={[
              { value: 'All', label: 'All QA' },
              { value: 'Waiting', label: 'Waiting' },
              { value: 'Pending', label: 'Pending' },
              { value: 'Approved', label: 'Approved' },
              { value: 'Rejected', label: 'Rejected' },
            ]}
          />
        </div>

        <div className="w-[150px]">
          <CustomSelect 
            label="Division"
            value={divisionFilter}
            onChange={setDivisionFilter}
            isDarkMode={isDarkMode}
            options={[
              { value: 'All', label: 'All Divisions' },
              { value: 'Home', label: 'Home' },
              { value: 'Entertainment', label: 'Entertainment' },
              { value: 'Technology', label: 'Technology' },
            ]}
          />
        </div>

        {(searchTerm || statusFilter !== 'All' || qaFilter !== 'All' || divisionFilter !== 'All') && (
          <button 
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('All');
              setQaFilter('All');
              setDivisionFilter('All');
            }}
            className="px-4 py-2.5 text-xs font-bold text-gray-400 hover:text-orange-500 transition-colors uppercase tracking-widest cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>
      <div className={`rounded-2xl border shadow-sm transition-colors relative ${isDarkMode ? 'bg-dark-900 border-dark-800' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto pb-[180px] -mb-[180px]">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className={`text-[11px] uppercase tracking-wider text-gray-400 border-b ${isDarkMode ? 'border-dark-800 bg-dark-950/20' : 'border-gray-50 bg-gray-50/20'}`}>
                <th className="w-8"></th>
                <th 
                  className={`cursor-pointer group/th select-none ${compactView ? "px-6 py-2" : "px-6 py-3"}`}
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center gap-1.5 font-bold transition-colors group-hover/th:text-orange-500">
                    <span>ID</span>
                    {sortField === 'id' ? (
                      sortDirection === 'asc' ? <ChevronUp size={12} className="text-[#FE5900] h-3.5 w-3.5" /> : <ChevronDown size={12} className="text-[#FE5900] h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-400 opacity-40 group-hover/th:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th 
                  className={`cursor-pointer group/th select-none ${compactView ? "px-6 py-2" : "px-6 py-3"}`}
                  onClick={() => handleSort('category')}
                >
                  <div className="flex items-center gap-1.5 font-bold transition-colors group-hover/th:text-orange-500">
                    <span>Category</span>
                    {sortField === 'category' ? (
                      sortDirection === 'asc' ? <ChevronUp size={12} className="text-[#FE5900] h-3.5 w-3.5" /> : <ChevronDown size={12} className="text-[#FE5900] h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-400 opacity-40 group-hover/th:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th className={compactView ? "px-6 py-2 font-bold" : "px-6 py-3 font-bold"}>Subtasks</th>
                <th className={compactView ? "px-6 py-2 font-bold" : "px-6 py-3 font-bold"}>Status</th>
                <th className={compactView ? "px-6 py-2 font-bold" : "px-6 py-3 font-bold"}>QA</th>
                <th className={compactView ? "px-6 py-2 font-bold text-center" : "px-6 py-3 font-bold text-center"}>Comments</th>
                <th 
                  className={`cursor-pointer group/th select-none ${compactView ? "px-6 py-2" : "px-6 py-3"}`}
                  onClick={() => handleSort('slaDeadline')}
                >
                  <div className="flex items-center gap-1.5 font-bold transition-colors group-hover/th:text-orange-500">
                    <span>SLA Target</span>
                    {sortField === 'slaDeadline' ? (
                      sortDirection === 'asc' ? <ChevronUp size={12} className="text-[#FE5900] h-3.5 w-3.5" /> : <ChevronDown size={12} className="text-[#FE5900] h-3.5 w-3.5" />
                    ) : (
                      <ArrowUpDown size={11} className="text-gray-400 opacity-40 group-hover/th:opacity-100 transition-opacity" />
                    )}
                  </div>
                </th>
                <th className={compactView ? "px-6 py-2 font-bold" : "px-6 py-3 font-bold"}>Req. Actions Completion</th>
                <th className={compactView ? "px-6 py-2 font-bold" : "px-6 py-3 font-bold"}>Owner</th>
                {isAdmin && <th className={compactView ? "px-6 py-2 font-bold text-right" : "px-6 py-3 font-bold text-right"}>Actions</th>}
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr 
                    key={`skeleton-row-${idx}`}
                    className={`border-b transition-colors ${
                      isDarkMode 
                        ? 'border-dark-800 hover:bg-dark-900/40' 
                        : 'border-gray-50 hover:bg-gray-50/40'
                    }`}
                  >
                    {/* Detail trigger spacer */}
                    <td className="w-8 px-4 text-center">
                      <div className={`h-4 w-4 mx-auto rounded animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                    </td>

                    {/* ID Column */}
                    <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                      <div className={`h-4 w-16 rounded animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                    </td>

                    {/* Category Column */}
                    <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                      <div className="space-y-1.5 py-1">
                        <div className={`h-4.5 w-40 rounded animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                        <div className={`h-3.5 w-60 rounded animate-pulse ${isDarkMode ? 'bg-dark-700/60' : 'bg-gray-100'}`} />
                      </div>
                    </td>

                    {/* Subtasks Column */}
                    <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                      <div className="space-y-2 py-1">
                        <div className={`h-4 w-28 rounded animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                        <div className={`h-4 w-28 rounded animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                      </div>
                    </td>

                    {/* Status Column */}
                    <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                      <div className={`h-6 w-24 rounded-full animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                    </td>

                    {/* QA Column */}
                    <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                      <div className={`h-6 w-24 rounded-full animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                    </td>

                    {/* Comments Column */}
                    <td className={compactView ? "px-6 py-2 text-center" : "px-6 py-4 text-center"}>
                      <div className={`h-8 w-14 mx-auto rounded-xl animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                    </td>

                    {/* SLA Target Column */}
                    <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                      <div className="space-y-1.5 py-1">
                        <div className={`h-4 w-28 rounded animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                        <div className={`h-3.5 w-16 rounded animate-pulse ${isDarkMode ? 'bg-dark-700/60' : 'bg-gray-100'}`} />
                      </div>
                    </td>

                    {/* Req. Actions Completion Column */}
                    <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                      <div className={`h-4 w-24 rounded animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                    </td>

                    {/* Owner Column */}
                    <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                      <div className={`h-4 w-20 rounded animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                    </td>

                    {/* Action Column for Admins */}
                    {isAdmin && (
                      <td className={compactView ? "px-6 py-2 text-right" : "px-6 py-4 text-right"}>
                        <div className="flex justify-end items-center gap-1.5">
                          <div className={`h-7 w-7 rounded-lg animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                          <div className={`h-7 w-7 rounded-lg animate-pulse ${isDarkMode ? 'bg-dark-800' : 'bg-gray-200'}`} />
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="px-6 py-12 text-center text-gray-400 italic font-medium">
                    No requests found matching your filters
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => {
                  // Once "Request Actions" is ticked the SLA clock freezes at the completion moment.
                  const reqActionsDoneAt = request.requestActionsCompletedAt ? new Date(request.requestActionsCompletedAt) : null;
                  const now = reqActionsDoneAt || new Date();
                  const deadline = new Date(request.slaDeadline);
                  const isDelayedByTime = request.status !== 'Live' && now > deadline;
                  const isDelayedByStatus = request.status === 'Delayed';
                  const isRejected = request.qaStatus === 'Rejected';
                  const isFlagged = isDelayedByStatus || isRejected;
                  const isSlaWarning = request.status !== 'Live' && !isDelayedByTime && (deadline.getTime() - now.getTime() > 0) && (deadline.getTime() - now.getTime() <= 24 * 60 * 60 * 1000);
                  const msDiff = deadline.getTime() - now.getTime();
                  const hoursRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60)));

                  const isDropdownOpen = openDropdownRowId === request.id;

                  const isPinned = pinnedRequestIds.includes(request.id);

                  return (
                    <tr 
                      key={request.id} 
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.closest('select') || target.closest('input') || target.closest('a') || target.closest('label')) {
                          return;
                        }
                        setViewingRequest(request);
                      }}
                      className={`border-b transition-all duration-300 cursor-pointer group relative ${
                        isDropdownOpen ? 'z-[50]' : 'hover:z-[30] focus-within:z-[30]'
                      } ${
                        isDarkMode 
                          ? `border-dark-800/40 hover:bg-orange-500/[0.04] ${
                              isFlagged 
                                ? 'bg-red-500/10' 
                                : isPinned 
                                  ? 'bg-amber-500/10' 
                                  : isDelayedByTime 
                                    ? 'bg-orange-500/5' 
                                    : ''
                            }` 
                          : `border-gray-50 hover:bg-[#FE5900]/[0.015] ${
                              isFlagged 
                                ? 'bg-red-50/60' 
                                : isPinned 
                                  ? 'bg-amber-100/40' 
                                  : isDelayedByTime 
                                    ? 'bg-[#FE5900]/[0.01]' 
                                    : ''
                            }`
                      }`}
                    >
                      <td className={compactView ? "pl-4 py-2 text-center relative" : "pl-4 py-4 text-center relative"}>
                        {isPinned && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" title="Pinned Request" />
                        )}
                        {!isArchiveView && (
                          <button 
                            onClick={() => onPinRequest?.(request.id)}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              isPinned
                                ? 'text-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(254,89,0,0.1)]'
                                : 'text-gray-500 hover:text-orange-500 opacity-0 group-hover:opacity-100'
                            }`}
                            title={isPinned ? "Unpin from top" : "Pin to top (max 3)"}
                          >
                            {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                          </button>
                        )}
                      </td>
                      <td className={`${compactView ? "px-6 py-2" : "px-6 py-4"} font-mono text-xs relative ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {isFlagged && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" title="Flagged: Review required" />
                        )}
                        {request.requestId || request.id.substring(0, 8)}
                      </td>
                      <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                        <div className="flex flex-col">
                          <span className={`${compactView ? "text-xs" : ""} font-bold tracking-tight ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{request.category}</span>
                          <div className={`flex items-center gap-2 ${compactView ? 'mt-0' : 'mt-1'}`}>
                             <a href={request.brief} target="_blank" rel="noopener noreferrer" className="text-[10px] text-orange-500 font-bold hover:underline flex items-center gap-1 transition-colors">
                                Brief <ExternalLink size={10} />
                             </a>
                             {!compactView && <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap">by {request.submitter}</span>}
                          </div>
                        </div>
                      </td>

                      <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                        <SubtaskChecks
                          request={request}
                          isDarkMode={isDarkMode}
                          compact={compactView}
                          disabled={request.isArchived ? true : !hasPermission(userRole, 'update_flow_status', appConfig)}
                          onToggle={(key, value) => onUpdateRequest(applySubtaskToggle(request, key, value))}
                        />
                      </td>

                      <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                        <CompactSelect
                          value={request.status}
                          onChange={(val) => onUpdateStatus(request.id, val as RequestStatus)}
                          variant="status"
                          disabled={request.isArchived ? true : !hasPermission(userRole, 'update_flow_status', appConfig)}
                          isDarkMode={isDarkMode}
                          onOpenChange={(open) => setOpenDropdownRowId(open ? request.id : null)}
                          title={request.isArchived ? "Locked (Archived)" : (!hasPermission(userRole, 'update_flow_status', appConfig) ? "Insufficient permissions" : "Update status")}
                          options={[
                            { value: 'Not Started', label: 'NOT STARTED' },
                            { value: 'In Progress', label: 'IN PROGRESS' },
                            { value: 'Live', label: 'LIVE' },
                            { value: 'Delayed', label: 'DELAYED' },
                            { value: 'Blocked', label: 'BLOCKED' },
                          ]}
                        />
                      </td>
                      <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                        <CompactSelect
                           value={request.qaStatus}
                           onChange={(val) => onUpdateQA(request.id, val as QAStatus)}
                           variant="qa"
                           disabled={request.isArchived ? true : !hasPermission(userRole, 'update_qa_status', appConfig)}
                           isDarkMode={isDarkMode}
                           onOpenChange={(open) => setOpenDropdownRowId(open ? request.id : null)}
                           title={request.isArchived ? "Locked (Archived)" : (!hasPermission(userRole, 'update_qa_status', appConfig) ? "Admins/QA owners only" : "Update QA status")}
                           options={[
                             { value: 'Waiting', label: 'WAITING' },
                             { value: 'Pending', label: 'PENDING' },
                             { value: 'Approved', label: 'APPROVED' },
                             { value: 'Rejected', label: 'REJECTED' },
                           ]}
                         />
                      </td>
                      <td className={compactView ? "px-2 py-1.5 text-center" : "px-4 py-2 text-center"}>
                        <button 
                          onClick={() => onOpenComments(request.id)}
                          className={`mx-auto group/comments flex items-center gap-2 p-3 rounded-xl transition-all justify-center cursor-pointer ${
                            isDarkMode 
                              ? 'hover:bg-dark-800 hover:ring-1 hover:ring-dark-700' 
                              : 'hover:bg-gray-50 hover:ring-1 hover:ring-orange-500/10'
                          } ${compactView ? 'py-1.5 min-w-[60px]' : 'py-3 min-w-[100px]'}`}
                          title={request.commentsList?.length ? `View comments (${request.commentsList.length})` : "Add comments"}
                        >
                          {!request.commentsList?.length ? (
                            <span className={`text-xs italic ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                              {isArchiveView ? 'None' : 'Add...'}
                            </span>
                          ) : (
                            <>
                              <MessageSquare size={14} className="text-orange-500 shadow-[0_0_8px_rgba(254,89,0,0.2)]" />
                              <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                {request.commentsList.length}
                              </span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                        <div className="flex flex-col gap-1">
                          <span className={`font-medium ${
                            isDelayedByTime || isFlagged 
                              ? 'text-red-500 font-bold' 
                              : isSlaWarning 
                                ? 'text-amber-500 font-bold shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                                : isDarkMode ? 'text-gray-300 font-bold' : 'text-gray-700 font-bold'
                          } ${compactView ? 'text-xs' : 'text-sm'}`}>
                            {new Date(request.slaDeadline).toLocaleDateString([], { month: 'short', day: 'numeric', hour: compactView ? undefined : '2-digit', minute: compactView ? undefined : '2-digit' })}
                          </span>
                          {isSlaWarning && (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border max-w-fit shadow-xs animate-pulse ${
                              isDarkMode 
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              ⚠️ {hoursRemaining}h left
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                        {reqActionsDoneAt ? (
                          <div className="flex flex-col gap-1">
                            <span className={`font-bold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} ${compactView ? 'text-xs' : 'text-sm'}`}>
                              {reqActionsDoneAt.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border max-w-fit ${
                              isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              ✓ SLA Paused
                            </span>
                          </div>
                        ) : (
                          <span className={`italic ${compactView ? 'text-xs' : 'text-sm'} ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>—</span>
                        )}
                      </td>
                      <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                        <div className="flex flex-col">
                          <span className={`${compactView ? "text-xs" : ""} font-bold tracking-tight ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{request.owner}</span>
                          {!compactView && <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{request.division}</span>}
                        </div>
                      </td>
                      {isAdmin && (
                        <td className={compactView ? "px-6 py-2" : "px-6 py-4"}>
                          <div className="flex justify-end items-center gap-2 transition-opacity">
                            {confirmDeleteId === request.id ? (
                               <div className="flex gap-1 items-center bg-red-50 p-1 rounded">
                                 <button 
                                   onClick={() => {
                                     onDeleteRequest(request.id);
                                     setConfirmDeleteId(null);
                                   }}
                                   className="p-1 px-2 bg-red-600 text-white rounded text-[10px] font-bold cursor-pointer"
                                   title="Confirm delete"
                                 >
                                   DEL
                                 </button>
                                 <button 
                                   onClick={() => setConfirmDeleteId(null)}
                                   className="p-1 px-2 bg-gray-400 text-white rounded text-[10px] font-bold cursor-pointer"
                                   title="Cancel delete"
                                 >
                                   X
                                 </button>
                               </div>
                            ) : (
                              <>
                                <button 
                                  onClick={() => setEditingRequest(request)}
                                  className={`p-2 text-gray-400 hover:text-[#FE5900] transition-colors cursor-pointer ${compactView ? 'p-1' : 'p-2'}`}
                                  title="Edit request"
                                >
                                  <Edit size={16} />
                                </button>
                                {isArchiveView && onUnarchive && (
                                  <button 
                                    onClick={() => onUnarchive(request.id)}
                                    className="p-2 text-gray-400 hover:text-green-500 transition-colors cursor-pointer"
                                    title="Unarchive request"
                                  >
                                    <ArchiveRestore size={16} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => {
                                    console.log('Trash icon clicked for request:', request.id);
                                    setConfirmDeleteId(request.id);
                                  }}
                                  className="p-2 text-gray-400 hover:text-red-500 transition-colors cursor-pointer z-10"
                                  title="Delete request"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {requests.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-gray-400 text-sm font-medium">No records found.</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingRequest && (
          <EditRequestModal 
            request={editingRequest} 
            onClose={() => setEditingRequest(null)} 
            isDarkMode={isDarkMode}
            onOpenComments={onOpenComments}
            onSubmit={(updated) => {
              onUpdateRequest(updated);
              setEditingRequest(null);
            }} 
            appConfig={appConfig}
            divisionCategories={divisionCategories}
          />
        )}
        {viewingRequest && (
          <ViewRequestModal 
            request={requests.find(r => r.id === viewingRequest.id) || viewingRequest} 
            onClose={() => setViewingRequest(null)} 
            isDarkMode={isDarkMode}
            onOpenComments={onOpenComments}
            isAdmin={isAdmin}
            userRole={userRole}
            isArchiveView={isArchiveView}
            onUpdateStatus={onUpdateStatus}
            onUpdateQA={onUpdateQA}
            onUpdateRequest={onUpdateRequest}
            appConfig={appConfig}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EditRequestModal({ 
  request, 
  onClose, 
  onSubmit,
  onOpenComments,
  isDarkMode = false,
  appConfig,
  divisionCategories
}: { 
  request: Request, 
  onClose: () => void, 
  onSubmit: (updated: Request) => void,
  onOpenComments: (id: string) => void,
  isDarkMode?: boolean,
  appConfig: Config,
  divisionCategories: Record<string, string[]>
}) {
  const [formData, setFormData] = useState<Request>({ ...request });
  const [errors, setErrors] = useState<{ submitter?: boolean, category?: boolean }>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = () => {
    const newErrors: { submitter?: boolean, category?: boolean } = {};
    if (!formData.submitter) newErrors.submitter = true;
    if (!formData.category) newErrors.category = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setErrorMessage("Submitter and Category are required to save changes.");
      return;
    }

    setErrors({});
    setErrorMessage(null);
    onSubmit(formData);
  };

  const categories = divisionCategories[formData.division] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`relative rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden transition-colors border ${
          isDarkMode ? 'bg-dark-900 border-dark-700 shadow-black/80' : 'bg-white border-white'
        }`}
      >
        <div className={`p-8 border-b flex items-center justify-between ${isDarkMode ? 'border-dark-800' : 'border-gray-100'}`}>
          <div>
            <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Edit Request {request.requestId || request.id.substring(0, 8)}</h3>
            <span className="inline-block px-2 py-0.5 mt-1 bg-orange-500/10 text-orange-500 rounded text-[9px] font-black uppercase tracking-widest">Admin Authorization Required</span>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-dark-800' : 'hover:bg-gray-50'}`}>
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto space-y-6 custom-scrollbar">
          {errorMessage && (
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-bold leading-normal flex items-center gap-2 mb-2 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <CustomSelect
              label="Submitter"
              value={formData.submitter}
              onChange={(val) => {
                setFormData({...formData, submitter: val});
                if (errors.submitter) {
                  const updatedErrors = { ...errors };
                  delete updatedErrors.submitter;
                  setErrors(updatedErrors);
                  if (Object.keys(updatedErrors).length === 0) setErrorMessage(null);
                }
              }}
              isDarkMode={isDarkMode}
              options={(appConfig.SUBMITTERS_LIST || APP_CONFIG.SUBMITTERS_LIST || []).map(s => ({ value: s, label: s }))}
              hasError={!!errors.submitter}
            />
            <CustomSelect
              label="Division"
              value={formData.division}
              onChange={(val) => setFormData({...formData, division: val as Division, category: ''})}
              isDarkMode={isDarkMode}
              options={Object.keys(appConfig.OWNERS).map(d => ({ value: d, label: d }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <CustomSelect
              label="Category"
              value={formData.category}
              onChange={(val) => {
                setFormData({...formData, category: val});
                if (errors.category) {
                  const updatedErrors = { ...errors };
                  delete updatedErrors.category;
                  setErrors(updatedErrors);
                  if (Object.keys(updatedErrors).length === 0) setErrorMessage(null);
                }
              }}
              isDarkMode={isDarkMode}
              options={categories.map(c => ({ value: c, label: c }))}
              hasError={!!errors.category}
            />
            <CustomSelect
              label="Request Type"
              value={formData.requestType}
              onChange={(val) => setFormData({...formData, requestType: val})}
              isDarkMode={isDarkMode}
              options={appConfig.REQUEST_TYPES.map(t => ({ value: t, label: t }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Values Count</label>
              <input 
                type="number" 
                value={formData.valuesCount}
                onChange={(e) => setFormData({...formData, valuesCount: parseInt(e.target.value) || 0})}
                className={`w-full px-4 py-3 border rounded-xl outline-none font-medium text-sm transition-all ${
                  isDarkMode 
                    ? 'bg-dark-800 border-dark-700 text-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10' 
                    : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-orange-100 focus:bg-white'
                }`}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Brief Link</label>
              <input 
                type="url" 
                value={formData.brief}
                onChange={(e) => setFormData({...formData, brief: e.target.value})}
                className={`w-full px-4 py-3 border rounded-xl outline-none font-medium text-sm transition-all ${
                  isDarkMode 
                    ? 'bg-dark-800 border-dark-700 text-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10' 
                    : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-orange-100 focus:bg-white'
                }`}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#FE5900] flex items-center gap-2">
                <Clock size={12} />
                Manual SLA Target (Deadline Override)
              </label>
              <button
                type="button"
                onClick={() => {
                  const createdDate = formData.createdAt ? new Date(formData.createdAt) : new Date();
                  const priorityTier = appConfig.PRIORITY_MAP[formData.requestType] || 3;
                  const calculated = calculateSLA(
                    createdDate,
                    formData.category,
                    priorityTier,
                    formData.valuesCount || 0,
                    formData.requestType
                  );
                  setFormData({ ...formData, slaDeadline: calculated.toISOString() });
                }}
                disabled={!formData.category}
                className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isDarkMode 
                    ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' 
                    : 'bg-orange-50 text-[#FE5900] hover:bg-orange-100'
                }`}
                title="Recalculate target deadline using SLA standard formula"
              >
                <Zap size={10} />
                Reset To Auto SLA
              </button>
            </div>
            <input 
              type="datetime-local" 
              value={formData.slaDeadline ? new Date(new Date(formData.slaDeadline).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
              onChange={(e) => {
                const localDate = new Date(e.target.value);
                if (!isNaN(localDate.getTime())) {
                  setFormData({...formData, slaDeadline: localDate.toISOString()});
                }
              }}
              className={`w-full px-4 py-3 border rounded-xl outline-none font-medium text-sm transition-all ${
                isDarkMode 
                  ? 'bg-dark-800 border-dark-700 text-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10' 
                  : 'bg-gray-50 border-gray-100 text-gray-900 focus:border-orange-100 focus:bg-white'
              }`}
            />
            <p className="text-[10px] text-gray-500 italic mt-1 px-1">Adjust the target date and time if this request requires an earlier or later delivery than the auto-calculated SLA.</p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-2">
              <ListTodo size={12} />
              Subtasks
            </label>
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-dark-800 border-dark-700' : 'bg-gray-50 border-gray-100'}`}>
              <SubtaskChecks
                request={formData}
                isDarkMode={isDarkMode}
                onToggle={(key, value) => setFormData(applySubtaskToggle(formData, key, value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2 mb-2">
              <MessageSquare size={12} />
              Comments / Discussion
            </label>
            <button 
              onClick={() => {
                onClose();
                onOpenComments(request.id);
              }}
              className={`w-full group/modal-comments flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                isDarkMode ? 'bg-dark-800 border-dark-700 hover:bg-dark-700' : 'bg-gray-50 border-gray-100 hover:bg-white hover:border-[#FE5900]/20'
              }`}
            >
              <div className="flex flex-col">
                <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{request.commentsList?.length || 0} Comments</span>
                <span className="text-[10px] text-gray-500 font-medium">Click to open chat-like discussion</span>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover/modal-comments:text-[#FE5900] transition-colors" />
            </button>
          </div>
        </div>

        <div className={`p-8 flex gap-4 transition-colors ${isDarkMode ? 'bg-dark-950/50 border-t border-dark-800' : 'bg-gray-50 border-t border-gray-100'}`}>
          <button 
            onClick={onClose}
            className="flex-1 py-4 text-sm font-black uppercase tracking-widest text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="flex-[2] py-4 bg-[#FE5900] text-white rounded-2xl text-sm font-bold shadow-lg shadow-orange-500/20 hover:opacity-90 transition-opacity cursor-pointer"
          >
            Save Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ViewRequestModal({ 
  request, 
  onClose, 
  onOpenComments,
  isDarkMode = false,
  isAdmin = false,
  userRole,
  isArchiveView = false,
  onUpdateStatus,
  onUpdateQA,
  onUpdateRequest,
  appConfig
}: {
  request: Request,
  onClose: () => void,
  onOpenComments: (id: string) => void,
  isDarkMode?: boolean,
  isAdmin?: boolean,
  userRole?: UserRole,
  isArchiveView?: boolean,
  onUpdateStatus: (id: string, status: RequestStatus) => void,
  onUpdateQA: (id: string, qa: QAStatus) => void,
  onUpdateRequest?: (req: Request) => void,
  appConfig?: Config
}) {
  const getStatusStyles = (status: string) => {
    const styles: Record<string, string> = {
      'Live': isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
      'Delayed': isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-100',
      'In Progress': isDarkMode ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-50 text-[#FE5900] border-orange-100',
      'Blocked': isDarkMode ? 'bg-zinc-800 text-gray-300 border-zinc-700' : 'bg-gray-900 text-white border-transparent',
      'Not Started': isDarkMode ? 'bg-zinc-850 text-zinc-400 border-zinc-700' : 'bg-gray-50 text-gray-400 border-gray-100',
      'Pending': isDarkMode ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-100'
    };
    return styles[status] || (isDarkMode ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-gray-50 text-gray-400 border-gray-100');
  };

  const getQAStyles = (qa: string) => {
    const styles: Record<string, string> = {
      'Approved': isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100',
      'Rejected': isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-red-50 text-red-600 border-red-100',
      'Pending': isDarkMode ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-purple-50 text-purple-600 border-purple-100',
      'Waiting': isDarkMode ? 'bg-zinc-850 text-zinc-405 border-zinc-700' : 'bg-gray-50 text-gray-400 border-gray-100'
    };
    return styles[qa] || (isDarkMode ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-gray-50 text-gray-400 border-gray-100');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Once "Request Actions" is ticked the SLA clock freezes at the completion moment.
  const reqActionsDoneAt = request.requestActionsCompletedAt ? new Date(request.requestActionsCompletedAt) : null;
  const now = reqActionsDoneAt || new Date();
  const deadline = new Date(request.slaDeadline);
  const isDelayedByTime = request.status !== 'Live' && now > deadline;
  const isSlaWarning = request.status !== 'Live' && !isDelayedByTime && (deadline.getTime() - now.getTime() > 0) && (deadline.getTime() - now.getTime() <= 24 * 60 * 60 * 1000);
  const msDiff = deadline.getTime() - now.getTime();
  const hoursRemaining = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60)));

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={`relative rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden transition-colors border ${
          isDarkMode ? 'bg-dark-900 border-dark-700 shadow-black/80' : 'bg-white border-white'
        }`}
      >
        <div className={`p-8 border-b flex items-center justify-between ${isDarkMode ? 'border-dark-800' : 'border-gray-100'}`}>
          <div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${
                request.division === 'Home' 
                  ? 'bg-blue-500/10 text-blue-500' 
                  : request.division === 'Entertainment' 
                    ? 'bg-purple-500/10 text-purple-500' 
                    : 'bg-emerald-500/10 text-emerald-500'
              }`}>
                {request.division}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${
                request.requestType?.toLowerCase().includes('major') 
                  ? 'bg-red-500/10 text-red-500' 
                  : request.requestType?.toLowerCase().includes('minor') 
                    ? 'bg-blue-500/10 text-blue-500' 
                    : request.requestType?.toLowerCase().includes('config') 
                      ? 'bg-amber-500/10 text-amber-500' 
                      : 'bg-[#FE5900]/10 text-[#FE5900]'
              }`}>
                {request.requestType || 'Standard'}
              </span>
            </div>
            <h3 className={`text-2xl font-black mt-2 tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Request {request.requestId || request.id.substring(0, 8)}
            </h3>
            <p className="text-xs text-gray-400 mt-1 font-semibold flex items-center gap-1.5">
              <span>Submitted by <span className="text-[#FE5900] font-bold">{request.submitter}</span></span>
              <span>•</span>
              <span>Created {formatDate(request.createdAt)}</span>
            </p>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-dark-800' : 'hover:bg-gray-50'}`} aria-label="Close modal">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-2xl border flex flex-col justify-between ${isDarkMode ? 'bg-dark-800/40 border-dark-750' : 'bg-gray-50 border-gray-100'}`}>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5 block">Operational Status</span>
              <div className="flex items-center">
                <CompactSelect
                  value={request.status}
                  onChange={(val) => onUpdateStatus(request.id, val as RequestStatus)}
                  variant="status"
                  disabled={request.isArchived ? true : !hasPermission(userRole, 'update_flow_status', appConfig || APP_CONFIG)}
                  isDarkMode={isDarkMode}
                  title={request.isArchived ? "Locked (Archived)" : (!hasPermission(userRole, 'update_flow_status', appConfig || APP_CONFIG) ? "Insufficient permissions" : "Update status")}
                  options={[
                    { value: 'Not Started', label: 'NOT STARTED' },
                    { value: 'In Progress', label: 'IN PROGRESS' },
                    { value: 'Live', label: 'LIVE' },
                    { value: 'Delayed', label: 'DELAYED' },
                    { value: 'Blocked', label: 'BLOCKED' },
                  ]}
                />
              </div>
            </div>
            <div className={`p-4 rounded-2xl border flex flex-col justify-between ${isDarkMode ? 'bg-dark-800/40 border-dark-750' : 'bg-gray-50 border-gray-100'}`}>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5 block">QA Status</span>
              <div className="flex items-center">
                <CompactSelect
                   value={request.qaStatus}
                   onChange={(val) => onUpdateQA(request.id, val as QAStatus)}
                   variant="qa"
                   disabled={request.isArchived ? true : !hasPermission(userRole, 'update_qa_status', appConfig || APP_CONFIG)}
                   isDarkMode={isDarkMode}
                   title={request.isArchived ? "Locked (Archived)" : (!hasPermission(userRole, 'update_qa_status', appConfig || APP_CONFIG) ? "Admins/QA owners only" : "Update QA status")}
                   options={[
                     { value: 'Waiting', label: 'WAITING' },
                     { value: 'Pending', label: 'PENDING' },
                     { value: 'Approved', label: 'APPROVED' },
                     { value: 'Rejected', label: 'REJECTED' },
                   ]}
                 />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block px-1">Subtasks</span>
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-dark-800/60 border-dark-750' : 'bg-gray-50/50 border-gray-100'}`}>
              <SubtaskChecks
                request={request}
                isDarkMode={isDarkMode}
                disabled={request.isArchived || !onUpdateRequest || !hasPermission(userRole, 'update_flow_status', appConfig || APP_CONFIG)}
                onToggle={(key, value) => onUpdateRequest?.(applySubtaskToggle(request, key, value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block px-1">Category</span>
              <div className={`p-4 rounded-2xl font-bold text-sm ${isDarkMode ? 'bg-dark-800/60 border border-dark-750 text-white' : 'bg-gray-50/50 border border-gray-100 text-gray-800'}`}>
                {request.category || '—'}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block px-1">Request Type</span>
              <div className={`p-4 rounded-2xl font-bold text-sm ${isDarkMode ? 'bg-dark-800/60 border border-dark-750 text-white' : 'bg-gray-50/50 border border-gray-100 text-gray-800'}`}>
                {request.requestType || '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block px-1">Values Count</span>
              <div className={`p-4 rounded-2xl font-bold text-sm ${isDarkMode ? 'bg-dark-800/60 border border-dark-750 text-white' : 'bg-gray-50/50 border border-gray-100 text-gray-800'}`}>
                {request.valuesCount?.toLocaleString() ?? 0}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block px-1">Assignee / Owner</span>
              <div className={`p-4 rounded-2xl font-bold text-sm ${isDarkMode ? 'bg-dark-800/60 border border-dark-750 text-white' : 'bg-gray-50/50 border border-gray-100 text-gray-800'}`}>
                {request.owner || 'Unassigned'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block px-1">Briefing Reference</span>
              <div className={`p-4 rounded-2xl font-bold text-sm h-full flex items-center justify-between ${isDarkMode ? 'bg-dark-800/60 border border-dark-750' : 'bg-gray-50/50 border border-gray-100'}`}>
                {request.brief ? (
                  <a 
                    href={request.brief} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[#FE5900] font-bold hover:underline inline-flex items-center gap-1.5 max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    View Brief Document <ExternalLink size={14} className="shrink-0" />
                  </a>
                ) : (
                  <span className="text-gray-400 italic">No brief document attached</span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <span className={`text-[10px] font-black uppercase tracking-widest block px-1 flex items-center gap-1.5 ${
                isSlaWarning 
                  ? 'text-amber-500' 
                  : 'text-[#FE5900]'
              }`}>
                <Clock size={12} /> SLA Target Deadline
              </span>
              <div className={`p-4 rounded-2xl font-bold text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 border ${
                isSlaWarning 
                  ? (isDarkMode ? 'bg-amber-500/5 border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.05)]' : 'bg-amber-50 border-amber-200 text-amber-700')
                  : (isDarkMode ? 'bg-dark-800/60 border border-dark-750 text-white' : 'bg-orange-500/[0.01]/50 border-gray-100 text-gray-900')
              }`}>
                <span>{formatDate(request.slaDeadline)}</span>
                {isSlaWarning && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm animate-pulse ${
                    isDarkMode
                      ? 'bg-amber-500/10 text-amber-450 border-amber-500/20'
                      : 'bg-amber-100/60 text-amber-800 border-amber-300'
                  }`}>
                    ⚠️ {hoursRemaining}h remaining
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block px-1 flex items-center gap-1.5">
                <CheckCircle2 size={12} /> Req. Actions Completion
              </span>
              <div className={`p-4 rounded-2xl font-bold text-sm flex items-center justify-between gap-2 border ${
                reqActionsDoneAt
                  ? (isDarkMode ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
                  : (isDarkMode ? 'bg-dark-800/60 border border-dark-750 text-gray-400' : 'bg-gray-50/50 border-gray-100 text-gray-400')
              }`}>
                <span>{reqActionsDoneAt ? formatDate(request.requestActionsCompletedAt!) : 'Not completed yet'}</span>
                {reqActionsDoneAt && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                    isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-100/60 text-emerald-800 border-emerald-300'
                  }`}>
                    ✓ SLA Paused
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block px-1">Discussion & Feedback</span>
            <button 
              onClick={() => {
                onOpenComments(request.id);
              }}
              className={`w-full group/modal-comments flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                isDarkMode ? 'bg-dark-800 border-dark-750 hover:bg-dark-700' : 'bg-gray-50 border-gray-100 hover:bg-white hover:border-[#FE5900]/20'
              }`}
            >
              <div className="flex flex-col">
                <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{request.commentsList?.length || 0} Comments</span>
                <span className="text-[10px] text-gray-500 font-medium">Click to open real-time team comments board</span>
              </div>
              <ChevronRight size={18} className="text-gray-300 group-hover/modal-comments:text-[#FE5900] transition-colors" />
            </button>
          </div>
        </div>

        <div className={`p-8 flex justify-end transition-colors ${isDarkMode ? 'bg-dark-950/50 border-t border-dark-800' : 'bg-gray-50 border-t border-gray-100'}`}>
          <button 
            onClick={onClose}
            className="px-8 py-3.5 bg-[#FE5900] text-white rounded-2xl text-sm font-bold shadow-lg shadow-orange-500/20 hover:opacity-90 transition-opacity cursor-pointer"
          >
            Close View
          </button>
        </div>
      </motion.div>
    </div>
  );
}
