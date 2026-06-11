import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Save, 
  Search, 
  SlidersHorizontal,
  Package, 
  Tag, 
  TrendingUp, 
  Info,
  Check,
  AlertCircle,
  Users,
  X,
  UserCheck,
  Pencil,
  Shield,
  Terminal,
  Mail,
  Play,
  RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Config } from '../types';
import { firebaseService } from '../services/firebaseService';

interface ConfigManagementViewProps {
  isDarkMode: boolean;
  appConfig: Config;
  onUpdateConfig: (config: Config & { DIVISION_CATEGORIES?: Record<string, string[]> }) => Promise<void>;
  divisionCategories: Record<string, string[]>;
  users: any[];
  onUpdateMappedOwner: (uid: string, mappedOwner: string) => Promise<void>;
}

export default function ConfigManagementView({
  isDarkMode,
  appConfig,
  onUpdateConfig,
  divisionCategories,
  users,
  onUpdateMappedOwner
}: ConfigManagementViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'taxonomy' | 'requestTypes' | 'capacities' | 'owners' | 'submitters' | 'roles' | 'testing'>('taxonomy');
  
  // Form and editing states - Roles Management
  const [newCustomRoleName, setNewCustomRoleName] = useState('');
  const [editingRoleKey, setEditingRoleKey] = useState<string | null>(null);
  const [editRoleNameVal, setEditRoleNameVal] = useState('');
  
  // Searching/filtering capacity maps
  const [capacitySearch, setCapacitySearch] = useState('');
  
  // Custom states for draft inline changes in Capacity
  const [editedCapacities, setEditedCapacities] = useState<Record<string, Record<number, number>>>({});
  const [runningAction, setRunningAction] = useState<string | null>(null);

  // Form states - Add Division
  const [newDivName, setNewDivName] = useState('');
  const [newDivOwner, setNewDivOwner] = useState('');
  
  // Form states - Add Category
  const [selectedDivForCat, setSelectedDivForCat] = useState('');
  const [newCatName, setNewCatName] = useState('');

  // Form states - Add Request Type
  const [newReqType, setNewReqType] = useState('');
  const [newReqPriority, setNewReqPriority] = useState<number>(3);

  // Editing state - Request Type / SLA Rules
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState('');
  const [editTypePriority, setEditTypePriority] = useState<number>(3);

  // Form states - Add Owner
  const [newOwnerName, setNewOwnerName] = useState('');
  const [userSearchText, setUserSearchText] = useState('');

  // Editing states - Division
  const [editingDivision, setEditingDivision] = useState<string | null>(null);
  const [editDivName, setEditDivName] = useState('');
  const [editDivLeader, setEditDivLeader] = useState('');

  // Editing states - Product Category
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryDiv, setEditingCategoryDiv] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');

  // Editing states - Owner (Pool)
  const [editingOwner, setEditingOwner] = useState<string | null>(null);
  const [editOwnerName, setEditOwnerName] = useState('');

  // Editing states - Submitter (Pool)
  const [newSubmitterName, setNewSubmitterName] = useState('');
  const [editingSubmitter, setEditingSubmitter] = useState<string | null>(null);
  const [editSubmitterName, setEditSubmitterName] = useState('');

  // Success messages/errors inside tabs
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    actionBtnText?: string;
    variant?: 'destructive' | 'primary' | 'success';
  } | null>(null);

  const triggerNotification = (text: string, type: 'success' | 'error') => {
    setErrorText(null);
    setSuccessText(null);
    if (type === 'success') {
      setSuccessText(text);
      setTimeout(() => setSuccessText(null), 4000);
    } else {
      setErrorText(text);
      setTimeout(() => setErrorText(null), 4000);
    }
  };

  // --- TESTING TAB STATE & RUNNER ---
  const [testEmail, setTestEmail] = useState('ecom_ai_qa@public.gr');
  const [testScriptCode, setTestScriptCode] = useState(`// Template 1: Node-proxy Mail Dispatcher
const response = await fetch('/api/send-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: email,
    subject: 'Aesthetic Admin Testing Portal',
    text: 'Hello, this is a live script-evaluated email test dispatched from the administration testing console!'
  })
});

if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.error || 'Fetch dispatch failed');
}

const result = await response.json();
console.log('Dispatch success!', result);
return result;`);
  const [testExecutionStatus, setTestExecutionStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [testConsoleLogs, setTestConsoleLogs] = useState<string[]>([]);
  const [testResultOutput, setTestResultOutput] = useState<string | null>(null);

  const handleRunTestScript = async () => {
    if (!testEmail || !testEmail.includes('@')) {
      triggerNotification('Please provide a valid target Email address.', 'error');
      return;
    }
    
    setTestExecutionStatus('running');
    setTestConsoleLogs(['[SYSTEM] Initializing sandbox interpreter...']);
    setTestResultOutput(null);

    const logsList = ['[SYSTEM] Initializing sandbox interpreter...'];
    const customConsole = {
      log: (...args: any[]) => {
        const line = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
        logsList.push(`[LOG] ${line}`);
        setTestConsoleLogs([...logsList]);
      },
      warn: (...args: any[]) => {
        const line = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
        logsList.push(`[WARN] ${line}`);
        setTestConsoleLogs([...logsList]);
      },
      error: (...args: any[]) => {
        const line = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
        logsList.push(`[ERROR] ${line}`);
        setTestConsoleLogs([...logsList]);
      }
    };

    try {
      logsList.push('[SYSTEM] Parsing execution scripts...');
      setTestConsoleLogs([...logsList]);

      // Create asynchronous runner wrapped in sandboxed Function environment
      const asyncRunner = new Function('email', 'firebaseService', 'console', 'fetch', 'appConfig', `
        return (async () => {
          ${testScriptCode}
        })();
      `);

      logsList.push('[SYSTEM] Executing script body...');
      setTestConsoleLogs([...logsList]);

      const result = await asyncRunner(testEmail, firebaseService, customConsole, fetch, appConfig);

      logsList.push('[SYSTEM] Script executed with no errors.');
      setTestConsoleLogs([...logsList]);
      setTestResultOutput(result !== undefined ? JSON.stringify(result, null, 2) : 'No return value');
      setTestExecutionStatus('success');
      triggerNotification('Script executed successfully!', 'success');
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      logsList.push(`[SYSTEM_CRASH] Runtime Exception: ${errMsg}`);
      setTestConsoleLogs([...logsList]);
      setTestResultOutput(errMsg);
      setTestExecutionStatus('failed');
      triggerNotification('Script execution failed.', 'error');
    }
  };

  // --- ACTIONS ---

  const handleAddDivision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDivName.trim() || !newDivOwner.trim()) {
      triggerNotification('Please provide both division name and primary leader/owner.', 'error');
      return;
    }

    const formattedDiv = newDivName.trim();
    const leader = newDivOwner.trim();
    if (appConfig.OWNERS[formattedDiv as any]) {
      triggerNotification(`Division "${formattedDiv}" already exists.`, 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Create New Division',
      message: `Are you sure you want to create a new division "${formattedDiv}" with "${leader}" assigned as the primary leader/owner?`,
      actionBtnText: 'Create Division',
      variant: 'success',
      onConfirm: async () => {
        setConfirmModal(null);
        setRunningAction('addDiv');
        try {
          const nextOwners = { ...appConfig.OWNERS, [formattedDiv]: leader };
          const nextDivCats = { ...divisionCategories, [formattedDiv]: [] };
          
          await onUpdateConfig({
            ...appConfig,
            OWNERS: nextOwners as any,
            DIVISION_CATEGORIES: nextDivCats
          });
          
          setNewDivName('');
          setNewDivOwner('');
          triggerNotification('Division created successfully with assigned leader.', 'success');
        } catch {
          triggerNotification('Failed to create division.', 'error');
        } finally {
          setRunningAction(null);
        }
      }
    });
  };

  const handleDeleteDivision = (divName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Division',
      message: `Are you sure you want to delete division "${divName}"? This will delete all associated categories and active capacity rules under it. This action cannot be undone.`,
      actionBtnText: 'Delete Division',
      variant: 'destructive',
      onConfirm: async () => {
        setRunningAction(`deleteDiv-${divName}`);
        try {
          const nextOwners = { ...appConfig.OWNERS };
          delete nextOwners[divName as any];
          
          const nextDivCats = { ...divisionCategories };
          const associatedCats = nextDivCats[divName] || [];
          delete nextDivCats[divName];

          const nextCapacityMap = { ...appConfig.CAPACITY_MAP };
          associatedCats.forEach(c => {
            delete nextCapacityMap[c];
          });

          await onUpdateConfig({
            ...appConfig,
            OWNERS: nextOwners as any,
            DIVISION_CATEGORIES: nextDivCats,
            CAPACITY_MAP: nextCapacityMap
          });

          triggerNotification(`Division "${divName}" and its categories were deleted.`, 'success');
        } catch {
          triggerNotification('Failed to delete division.', 'error');
        } finally {
          setRunningAction(null);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleUpdateDivision = (originalName: string) => {
    if (!editDivName.trim() || !editDivLeader.trim()) {
      triggerNotification('Please provide both division name and primary leader/owner.', 'error');
      return;
    }

    const formattedDiv = editDivName.trim();
    const leader = editDivLeader.trim();

    if (formattedDiv !== originalName && appConfig.OWNERS[formattedDiv as any]) {
      triggerNotification(`Division "${formattedDiv}" already exists.`, 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Update Division Config',
      message: `Are you sure you want to update division "${originalName}" to "${formattedDiv}" and assign leader "${leader}"?`,
      actionBtnText: 'Update Division',
      variant: 'primary',
      onConfirm: async () => {
        setConfirmModal(null);
        setRunningAction(`editDiv-${originalName}`);
        try {
          const nextOwners = { ...appConfig.OWNERS };
          const nextDivCats = { ...divisionCategories };

          if (formattedDiv !== originalName) {
            delete nextOwners[originalName as any];
            delete nextDivCats[originalName];
            nextOwners[formattedDiv as any] = leader;
            nextDivCats[formattedDiv] = divisionCategories[originalName] || [];
          } else {
            nextOwners[originalName as any] = leader;
          }

          await onUpdateConfig({
            ...appConfig,
            OWNERS: nextOwners as any,
            DIVISION_CATEGORIES: nextDivCats
          });

          setEditingDivision(null);
          triggerNotification('Division updated successfully.', 'success');
        } catch {
          triggerNotification('Failed to update division.', 'error');
        } finally {
          setRunningAction(null);
        }
      }
    });
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDivForCat || !newCatName.trim()) {
      triggerNotification('Please select a division and specify a category name.', 'error');
      return;
    }

    const formattedCat = newCatName.trim();
    const targetDiv = selectedDivForCat;
    
    // Check if category already exists anywhere in divisionCategories
    const allExistingCats = Object.values(divisionCategories).flat();
    if (allExistingCats.includes(formattedCat)) {
      triggerNotification(`Category name "${formattedCat}" is already defined. Duplicates are not allowed.`, 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Add New Category',
      message: `Are you sure you want to add the new category "${formattedCat}" to division "${targetDiv}"? Baseline SLA capacities will be initialized.`,
      actionBtnText: 'Add Category',
      variant: 'success',
      onConfirm: async () => {
        setConfirmModal(null);
        setRunningAction('addCategory');
        try {
          const existingCats = divisionCategories[targetDiv] || [];
          const nextDivCats = {
            ...divisionCategories,
            [targetDiv]: [...existingCats, formattedCat]
          };

          // Set default capacity limit for newly created category
          const nextCapacityMap = {
            ...appConfig.CAPACITY_MAP,
            [formattedCat]: { 1: 30, 2: 60, 3: 25 }
          };

          await onUpdateConfig({
            ...appConfig,
            DIVISION_CATEGORIES: nextDivCats,
            CAPACITY_MAP: nextCapacityMap
          });

          setNewCatName('');
          triggerNotification(`Category "${formattedCat}" added to "${targetDiv}" with baseline capacities initialized!`, 'success');
        } catch {
          triggerNotification('Failed to add category.', 'error');
        } finally {
          setRunningAction(null);
        }
      }
    });
  };

  const handleDeleteCategory = (divName: string, catName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Category',
      message: `Are you sure you want to delete category "${catName}"? This will remove all associated daily SLA throughput configurations.`,
      actionBtnText: 'Delete Category',
      variant: 'destructive',
      onConfirm: async () => {
        setRunningAction(`deleteCat-${catName}`);
        try {
          const nextDivCats = { ...divisionCategories };
          nextDivCats[divName] = (nextDivCats[divName] || []).filter(c => c !== catName);

          const nextCapacityMap = { ...appConfig.CAPACITY_MAP };
          delete nextCapacityMap[catName];

          await onUpdateConfig({
            ...appConfig,
            DIVISION_CATEGORIES: nextDivCats,
            CAPACITY_MAP: nextCapacityMap
          });

          triggerNotification(`Category "${catName}" deleted from "${divName}".`, 'success');
        } catch {
          triggerNotification('Failed to delete category.', 'error');
        } finally {
          setRunningAction(null);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleUpdateCategory = (originalName: string, divName: string) => {
    if (!editCategoryName.trim()) {
      triggerNotification('Please enter a category name.', 'error');
      return;
    }

    const formattedCat = editCategoryName.trim();

    // Check if name is already in use by any category EXCEPT the original name
    const allExistingCats = Object.values(divisionCategories).flat();
    if (formattedCat !== originalName && allExistingCats.includes(formattedCat)) {
      triggerNotification(`Category name "${formattedCat}" is already defined. Duplicates are not allowed.`, 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Rename Product Category',
      message: `Are you sure you want to rename category "${originalName}" to "${formattedCat}"? This will transfer all existing daily SLA capacities.`,
      actionBtnText: 'Rename Category',
      variant: 'primary',
      onConfirm: async () => {
        setConfirmModal(null);
        setRunningAction(`editCat-${originalName}`);
        try {
          const nextDivCats = { ...divisionCategories };
          nextDivCats[divName] = (nextDivCats[divName] || []).map(c => c === originalName ? formattedCat : c);

          const nextCapacityMap = { ...appConfig.CAPACITY_MAP };
          if (formattedCat !== originalName) {
            nextCapacityMap[formattedCat] = appConfig.CAPACITY_MAP[originalName] || { 1: 30, 2: 60, 3: 25 };
            delete nextCapacityMap[originalName];
          }

          await onUpdateConfig({
            ...appConfig,
            DIVISION_CATEGORIES: nextDivCats,
            CAPACITY_MAP: nextCapacityMap
          });

          setEditingCategory(null);
          setEditingCategoryDiv(null);
          triggerNotification(`Category renamed from "${originalName}" to "${formattedCat}" successfully.`, 'success');
        } catch {
          triggerNotification('Failed to update product category.', 'error');
        } finally {
          setRunningAction(null);
        }
      }
    });
  };

  const handleAddRequestType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReqType.trim()) {
      triggerNotification('Please enter a request type.', 'error');
      return;
    }

    const formattedType = newReqType.trim();
    const priorityTier = newReqPriority;
    if (appConfig.REQUEST_TYPES.includes(formattedType)) {
      triggerNotification(`Request type "${formattedType}" is already defined.`, 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Configure Request Type',
      message: `Are you sure you want to configure the request type "${formattedType}" at Priority Tier ${priorityTier}?`,
      actionBtnText: 'Configure Type',
      variant: 'success',
      onConfirm: async () => {
        setConfirmModal(null);
        setRunningAction('addReqType');
        try {
          const nextReqTypes = [...appConfig.REQUEST_TYPES, formattedType];
          const nextPriorityMap = { ...appConfig.PRIORITY_MAP, [formattedType]: priorityTier };

          await onUpdateConfig({
            ...appConfig,
            REQUEST_TYPES: nextReqTypes,
            PRIORITY_MAP: nextPriorityMap
          });

          setNewReqType('');
          triggerNotification(`Request type "${formattedType}" configured at Priority Tier ${priorityTier}.`, 'success');
        } catch {
          triggerNotification('Failed to configure request type.', 'error');
        } finally {
          setRunningAction(null);
        }
      }
    });
  };

  const handleDeleteRequestType = (typeName: string) => {
    if (appConfig.REQUEST_TYPES.length <= 1) {
      triggerNotification('You must keep at least one Request Type configured in the workspace.', 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete Request Type',
      message: `Are you sure you want to delete request type "${typeName}"? This modifies SLAs calculated for active workflows. This action cannot be reverted.`,
      actionBtnText: 'Delete Request Type',
      variant: 'destructive',
      onConfirm: async () => {
        setRunningAction(`deleteType-${typeName}`);
        try {
          const nextReqTypes = appConfig.REQUEST_TYPES.filter(t => t !== typeName);
          const nextPriorityMap = { ...appConfig.PRIORITY_MAP };
          delete nextPriorityMap[typeName];

          await onUpdateConfig({
            ...appConfig,
            REQUEST_TYPES: nextReqTypes,
            PRIORITY_MAP: nextPriorityMap
          });

          triggerNotification(`Request type "${typeName}" is deleted.`, 'success');
        } catch {
          triggerNotification('Failed to delete request type.', 'error');
        } finally {
          setRunningAction(null);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleSaveRequestType = (originalName: string) => {
    if (!editTypeName.trim()) {
      triggerNotification('Please enter a request type name.', 'error');
      return;
    }

    const formattedType = editTypeName.trim();
    const priorityTier = editTypePriority;

    if (formattedType !== originalName && appConfig.REQUEST_TYPES.includes(formattedType)) {
      triggerNotification(`Request type "${formattedType}" is already defined.`, 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Update Request Type',
      message: `Are you sure you want to update request type "${originalName}" to "${formattedType}" at Priority Tier ${priorityTier}?`,
      actionBtnText: 'Update Type',
      variant: 'primary',
      onConfirm: async () => {
        setConfirmModal(null);
        setRunningAction(`editType-${originalName}`);
        try {
          const nextReqTypes = appConfig.REQUEST_TYPES.map(t => t === originalName ? formattedType : t);
          const nextPriorityMap = { ...appConfig.PRIORITY_MAP };

          if (formattedType !== originalName) {
            delete nextPriorityMap[originalName];
          }
          nextPriorityMap[formattedType] = priorityTier;

          await onUpdateConfig({
            ...appConfig,
            REQUEST_TYPES: nextReqTypes,
            PRIORITY_MAP: nextPriorityMap
          });

          setEditingType(null);
          triggerNotification(`Request type "${originalName}" updated successfully!`, 'success');
        } catch {
          triggerNotification('Failed to update request type.', 'error');
        } finally {
          setRunningAction(null);
        }
      }
    });
  };

  // State tracker for inline capacity edits
  const handleCapacityChange = (category: string, tier: number, value: number) => {
    setEditedCapacities(prev => ({
      ...prev,
      [category]: {
        ...(prev[category] || appConfig.CAPACITY_MAP[category] || { 1: 30, 2: 60, 3: 25 }),
        [tier]: value
      }
    }));
  };

  const saveCapacityRow = (category: string) => {
    const changes = editedCapacities[category];
    if (!changes) return;

    const val1 = changes[1] ?? appConfig.CAPACITY_MAP[category]?.[1] ?? 30;
    const val2 = changes[2] ?? appConfig.CAPACITY_MAP[category]?.[2] ?? 60;
    const val3 = changes[3] ?? appConfig.CAPACITY_MAP[category]?.[3] ?? 25;

    setConfirmModal({
      isOpen: true,
      title: 'Update Category Capacities',
      message: `Are you sure you want to save the updated target capacities for category "${category}"? (Tier 1: ${val1}, Tier 2: ${val2}, Tier 3: ${val3})`,
      actionBtnText: 'Save Capacities',
      variant: 'primary',
      onConfirm: async () => {
        setConfirmModal(null);
        setRunningAction(`saveCap-${category}`);
        try {
          const nextCapacityMap = {
            ...appConfig.CAPACITY_MAP,
            [category]: {
              ...(appConfig.CAPACITY_MAP[category] || { 1: 30, 2: 60, 3: 25 }),
              ...changes
            }
          };

          await onUpdateConfig({
            ...appConfig,
            CAPACITY_MAP: nextCapacityMap
          });

          // Clear draft states for this row
          setEditedCapacities(prev => {
            const copy = { ...prev };
            delete copy[category];
            return copy;
          });

          triggerNotification(`Updated capacities for "${category}" successfully!`, 'success');
        } catch {
          triggerNotification('Failed to update capacities.', 'error');
        } finally {
          setRunningAction(null);
        }
      }
    });
  };

  // --- OWNERS LIST LOGIC ---

  const ownersList = useMemo(() => {
    if (appConfig.OWNERS_LIST && appConfig.OWNERS_LIST.length > 0) {
      return appConfig.OWNERS_LIST;
    }
    return Array.from(new Set(Object.values(appConfig.OWNERS)));
  }, [appConfig.OWNERS, appConfig.OWNERS_LIST]);

  const handleAddOwner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnerName.trim()) {
      triggerNotification('Please enter an owner name.', 'error');
      return;
    }

    const trimmed = newOwnerName.trim();
    if (ownersList.some(o => o.toLowerCase() === trimmed.toLowerCase())) {
      triggerNotification(`Owner "${trimmed}" already exists.`, 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Register Global Owner',
      message: `Are you sure you want to add "${trimmed}" to the system owner pool?`,
      actionBtnText: 'Add Owner',
      variant: 'success',
      onConfirm: async () => {
        setConfirmModal(null);
        setRunningAction('addOwner');
        try {
          const updatedOwnersList = [...ownersList, trimmed];
          await onUpdateConfig({
            ...appConfig,
            OWNERS_LIST: updatedOwnersList
          });
          setNewOwnerName('');
          triggerNotification(`Owner "${trimmed}" was successfully added to the system pool.`, 'success');
        } catch {
          triggerNotification('Failed to add owner.', 'error');
        } finally {
          setRunningAction(null);
        }
      }
    });
  };

  const handleUpdateOwner = (originalName: string) => {
    if (!editOwnerName.trim()) {
      triggerNotification('Please enter a valid owner name.', 'error');
      return;
    }

    const formattedName = editOwnerName.trim();

    if (formattedName !== originalName && ownersList.some(o => o.toLowerCase() === formattedName.toLowerCase())) {
      triggerNotification(`Owner "${formattedName}" already exists in pool.`, 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Update Owner Name',
      message: `Are you sure you want to change the owner name from "${originalName}" to "${formattedName}"? Any divisions currently managed by "${originalName}" will be updated to "${formattedName}".`,
      actionBtnText: 'Update Owner',
      variant: 'primary',
      onConfirm: async () => {
        setConfirmModal(null);
        setRunningAction(`editOwner-${originalName}`);
        try {
          const updatedOwnersList = ownersList.map(o => o === originalName ? formattedName : o);

          // Update divisions mapping to target the new owner name
          const updatedDivisionOwners = { ...appConfig.OWNERS };
          Object.entries(updatedDivisionOwners).forEach(([div, owner]) => {
            if (owner === originalName) {
              updatedDivisionOwners[div as any] = formattedName;
            }
          });

          await onUpdateConfig({
            ...appConfig,
            OWNERS_LIST: updatedOwnersList,
            OWNERS: updatedDivisionOwners
          });

          setEditingOwner(null);
          triggerNotification(`Owner successfully renamed to "${formattedName}".`, 'success');
        } catch {
          triggerNotification('Failed to update owner.', 'error');
        } finally {
          setRunningAction(null);
        }
      }
    });
  };

  const handleDeleteOwner = (ownerName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Global Owner',
      message: `Are you sure you want to delete owner "${ownerName}"? Any divisions currently managed by this owner will have their leadership fallback to 'Unassigned'.`,
      actionBtnText: 'Delete Owner',
      variant: 'destructive',
      onConfirm: async () => {
        setRunningAction(`deleteOwner-${ownerName}`);
        try {
          const updatedOwnersList = ownersList.filter(o => o !== ownerName);
          
          // Also set division owners to 'Unassigned' if they are currently set to this owner
          const updatedDivisionOwners = { ...appConfig.OWNERS };
          Object.entries(updatedDivisionOwners).forEach(([div, owner]) => {
            if (owner === ownerName) {
              updatedDivisionOwners[div as any] = 'Unassigned';
            }
          });

          await onUpdateConfig({
            ...appConfig,
            OWNERS_LIST: updatedOwnersList,
            OWNERS: updatedDivisionOwners
          });

          triggerNotification(`Owner "${ownerName}" deleted successfully.`, 'success');
        } catch {
          triggerNotification('Failed to delete owner.', 'error');
        } finally {
          setRunningAction(null);
          setConfirmModal(null);
        }
      }
    });
  };

  // --- SUBMITTERS LIST LOGIC ---

  const submittersList = useMemo(() => {
    if (appConfig.SUBMITTERS_LIST && appConfig.SUBMITTERS_LIST.length > 0) {
      return appConfig.SUBMITTERS_LIST;
    }
    return ['Tsatsani', 'Michailidis'];
  }, [appConfig.SUBMITTERS_LIST]);

  const handleAddSubmitter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubmitterName.trim()) {
      triggerNotification('Please enter a submitter name.', 'error');
      return;
    }

    const trimmed = newSubmitterName.trim();
    if (submittersList.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      triggerNotification(`Submitter "${trimmed}" already exists.`, 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Register Submitter Name',
      message: `Are you sure you want to add "${trimmed}" to the submitters pool?`,
      actionBtnText: 'Add Submitter',
      variant: 'success',
      onConfirm: async () => {
        setConfirmModal(null);
        setRunningAction('addSubmitter');
        try {
          const updatedSubmittersList = [...submittersList, trimmed];
          await onUpdateConfig({
            ...appConfig,
            SUBMITTERS_LIST: updatedSubmittersList
          });
          setNewSubmitterName('');
          triggerNotification(`Submitter "${trimmed}" was successfully registered.`, 'success');
        } catch {
          triggerNotification('Failed to add submitter.', 'error');
        } finally {
          setRunningAction(null);
        }
      }
    });
  };

  const handleUpdateSubmitter = (originalName: string) => {
    if (!editSubmitterName.trim()) {
      triggerNotification('Please enter a valid submitter name.', 'error');
      return;
    }

    const formattedName = editSubmitterName.trim();

    if (formattedName !== originalName && submittersList.some(s => s.toLowerCase() === formattedName.toLowerCase())) {
      triggerNotification(`Submitter name "${formattedName}" already exists.`, 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Update Submitter Name',
      message: `Are you sure you want to rename "${originalName}" to "${formattedName}"?`,
      actionBtnText: 'Update Submitter',
      variant: 'primary',
      onConfirm: async () => {
        setConfirmModal(null);
        setRunningAction(`editSubmitter-${originalName}`);
        try {
          const updatedSubmittersList = submittersList.map(s => s === originalName ? formattedName : s);
          await onUpdateConfig({
            ...appConfig,
            SUBMITTERS_LIST: updatedSubmittersList
          });
          setEditingSubmitter(null);
          triggerNotification(`Submitter successfully renamed to "${formattedName}".`, 'success');
        } catch {
          triggerNotification('Failed to update submitter.', 'error');
        } finally {
          setRunningAction(null);
        }
      }
    });
  };

  const handleDeleteSubmitter = (submitterName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Submitter Name',
      message: `Are you sure you want to remove submitter "${submitterName}"?`,
      actionBtnText: 'Remove Submitter',
      variant: 'destructive',
      onConfirm: async () => {
        setRunningAction(`deleteSubmitter-${submitterName}`);
        try {
          const updatedSubmittersList = submittersList.filter(s => s !== submitterName);
          await onUpdateConfig({
            ...appConfig,
            SUBMITTERS_LIST: updatedSubmittersList
          });
          triggerNotification(`Submitter "${submitterName}" removed successfully.`, 'success');
        } catch {
          triggerNotification('Failed to delete submitter.', 'error');
        } finally {
          setRunningAction(null);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleUserOwnerMappingChange = (uid: string, userIdentifier: string, newOwner: string) => {
    const actionLabel = newOwner ? `map to "${newOwner}"` : 'remove owner mapping';
    setConfirmModal({
      isOpen: true,
      title: 'Update User Owner Mapping',
      message: `Are you sure you want to ${actionLabel} for user "${userIdentifier}"? This will affect SLA routing and request notifications assigned to them.`,
      actionBtnText: 'Update Mapping',
      variant: 'primary',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await onUpdateMappedOwner(uid, newOwner);
        } catch {
          triggerNotification('Failed to update user owner mapping.', 'error');
        }
      }
    });
  };

  const filteredUsers = useMemo(() => {
    let list = users;
    if (userSearchText.trim()) {
      const search = userSearchText.toLowerCase();
      list = users.filter(u => 
        (u.name || '').toLowerCase().includes(search) || 
        (u.email || '').toLowerCase().includes(search) || 
        (u.role || '').toLowerCase().includes(search)
      );
    }
    return [...list].sort((a, b) => {
      const aIsOwner = (a.role || '').toLowerCase() === 'owner';
      const bIsOwner = (b.role || '').toLowerCase() === 'owner';
      if (aIsOwner && !bIsOwner) return -1;
      if (!aIsOwner && bIsOwner) return 1;
      return 0;
    });
  }, [users, userSearchText]);

  // --- Dynamic collections for Roles & Permissions ---
  const rolesList = useMemo(() => {
    return appConfig.ROLES_LIST || ['owner', 'admin', 'Team Leader', 'Manager', 'Digital Merch'];
  }, [appConfig.ROLES_LIST]);

  const rolePermissions = useMemo(() => {
    return appConfig.ROLE_PERMISSIONS || {
      'owner': ['create_requests', 'update_qa_status', 'update_flow_status', 'view_admin_panel', 'admin_configurations'],
      'admin': ['create_requests', 'update_qa_status', 'update_flow_status', 'view_admin_panel', 'admin_configurations'],
      'Team Leader': ['update_flow_status'],
      'Manager': ['update_flow_status'],
      'Digital Merch': ['create_requests']
    };
  }, [appConfig.ROLE_PERMISSIONS]);

  const handleRoleDelete = (roleToDelete: string) => {
    if (roleToDelete === 'owner' || roleToDelete === 'admin') {
      triggerNotification('System administrator and owner roles cannot be deleted.', 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Delete Operational Role',
      message: `Are you sure you want to delete the role "${roleToDelete}"? All assigned users will revert to "Team Leader". This action cannot be undone.`,
      actionBtnText: 'Delete Role',
      variant: 'destructive',
      onConfirm: async () => {
        setRunningAction(`deleteRole-${roleToDelete}`);
        try {
          const nextRolesList = rolesList.filter(r => r !== roleToDelete);
          const nextRolePerms = { ...rolePermissions };
          delete nextRolePerms[roleToDelete];

          await onUpdateConfig({
            ...appConfig,
            ROLES_LIST: nextRolesList,
            ROLE_PERMISSIONS: nextRolePerms
          } as any);

          // Update users belonging to this deleted role to default 'Team Leader'
          for (const u of users) {
            if (u.role === roleToDelete) {
              if (u.uid.startsWith('auth-')) {
                const email = u.uid.replace('auth-', '');
                await firebaseService.updateAuthorizedEmail(email, 'Team Leader');
              } else {
                await firebaseService.updateUserRole(u.uid, 'Team Leader');
              }
            }
          }

          triggerNotification(`Role "${roleToDelete}" deleted. Affected users reverted to "Team Leader".`, 'success');
        } catch (err) {
          console.error(err);
          triggerNotification('Failed to delete role.', 'error');
        } finally {
          setRunningAction(null);
          setConfirmModal(null);
        }
      }
    });
  };

  const handleTogglePermission = (roleName: string, permissionCode: string) => {
    const currentPerms = rolePermissions[roleName] || [];
    const isRevoking = currentPerms.includes(permissionCode);
    const actionWord = isRevoking ? 'revoke' : 'grant';
    const actionDesc = isRevoking ? 'Revoke' : 'Grant';

    const permissionLabels: Record<string, string> = {
      'create_requests': 'Create Requests',
      'update_qa_status': 'Update QA Status',
      'update_flow_status': 'Update Flow Status',
      'view_admin_panel': 'View Admin Panel',
      'admin_configurations': 'Configure Workspace / System Settings'
    };
    const permLabel = permissionLabels[permissionCode] || permissionCode;

    setConfirmModal({
      isOpen: true,
      title: `${actionDesc} Role Permission`,
      message: `Are you sure you want to ${actionWord} the "${permLabel}" permission for the role "${roleName}"?`,
      actionBtnText: isRevoking ? 'Revoke Permission' : 'Grant Permission',
      variant: isRevoking ? 'destructive' : 'success',
      onConfirm: async () => {
        const nextPermsForRole = isRevoking
          ? currentPerms.filter(p => p !== permissionCode)
          : [...currentPerms, permissionCode];

        const nextRolePerms = {
          ...rolePermissions,
          [roleName]: nextPermsForRole
        };

        triggerNotification(`Updating permissions for "${roleName}"...`, 'success');
        setRunningAction('toggle_permission');
        
        try {
          await onUpdateConfig({
            ...appConfig,
            ROLE_PERMISSIONS: nextRolePerms
          } as any);
          triggerNotification(`Successfully updated permissions for "${roleName}"!`, 'success');
        } catch (err) {
          console.error(err);
          triggerNotification('Failed to update permissions.', 'error');
        } finally {
          setRunningAction(null);
          setConfirmModal(null);
        }
      }
    });
  };

  // --- RENDERING HELPERS AND SECTIONS ---

  const listCategoriesForCapacityMap = useMemo(() => {
    const list: { category: string; division: string; capacities: Record<number, number> }[] = [];
    Object.entries(divisionCategories).forEach(([div, cats]) => {
      cats.forEach(c => {
        list.push({
          category: c,
          division: div,
          capacities: appConfig.CAPACITY_MAP[c] || { 1: 30, 2: 60, 3: 25 }
        });
      });
    });

    if (!capacitySearch.trim()) return list;
    const lowerSearch = capacitySearch.toLowerCase();
    return list.filter(item => 
      item.category.toLowerCase().includes(lowerSearch) || 
      item.division.toLowerCase().includes(lowerSearch)
    );
  }, [divisionCategories, appConfig.CAPACITY_MAP, capacitySearch]);

  return (
    <div id="config_manager_container" className="space-y-8 animate-fade-in mb-20 relative">
      {/* Header and Quick Summary Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={`text-3xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>System Workspace Settings</h2>
          <p className="text-gray-500 mt-1 font-medium">Configure network divisions, taxonomy, request categories, request types, and daily SLA throughput capacities.</p>
        </div>
      </div>

      {/* Feedback Notifications */}
      <AnimatePresence mode="wait">
        {successText && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-sm font-semibold flex items-center gap-2 animate-fade-in"
          >
            <Check size={18} />
            {successText}
          </motion.div>
        )}
        {errorText && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 text-sm font-semibold flex items-center gap-2 animate-fade-in"
          >
            <AlertCircle size={18} />
            {errorText}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Horizontal Navigation Tabs */}
      <div className={`p-1.5 rounded-2xl flex flex-wrap gap-1.5 border shadow-sm transition-all ${
        isDarkMode 
          ? 'bg-dark-900 border-dark-800' 
          : 'bg-gray-100 bg-opacity-65 border-gray-200'
      }`}>
        <button
          onClick={() => setActiveSubTab('taxonomy')}
          className={`group flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer border relative w-full sm:w-auto hover:translate-y-[-1px] active:translate-y-[1px] ${
            activeSubTab === 'taxonomy'
              ? (isDarkMode 
                  ? 'bg-dark-800 border-orange-500/40 text-orange-400 font-extrabold shadow-md ring-1 ring-orange-500/20' 
                  : 'bg-white border-gray-200 text-[#FE5900] shadow-sm ring-1 ring-black/5')
              : (isDarkMode 
                  ? 'bg-transparent border-transparent text-gray-400 hover:text-gray-200 hover:bg-dark-800/40 hover:border-dark-700' 
                  : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 hover:bg-white hover:border-gray-200 hover:shadow-xs')
          }`}
        >
          <Layers size={14} className={`transition-transform duration-200 group-hover:scale-115 ${activeSubTab === 'taxonomy' ? 'text-[#FE5900]' : 'text-gray-400'}`} />
          <span>Divisions & Categories</span>
          {activeSubTab === 'taxonomy' && (
            <span className="absolute bottom-1 left-5 right-5 h-0.5 bg-[#FE5900] rounded-full shadow-[0_1px_3px_rgba(254,89,0,0.3)]" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('requestTypes')}
          className={`group flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer border relative w-full sm:w-auto hover:translate-y-[-1px] active:translate-y-[1px] ${
            activeSubTab === 'requestTypes'
              ? (isDarkMode 
                  ? 'bg-dark-800 border-orange-500/40 text-orange-400 font-extrabold shadow-md ring-1 ring-orange-500/20' 
                  : 'bg-white border-gray-200 text-[#FE5900] shadow-sm ring-1 ring-black/5')
              : (isDarkMode 
                  ? 'bg-transparent border-transparent text-gray-400 hover:text-gray-200 hover:bg-dark-800/40 hover:border-dark-700' 
                  : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 hover:bg-white hover:border-gray-200 hover:shadow-xs')
          }`}
        >
          <Tag size={14} className={`transition-transform duration-200 group-hover:scale-115 ${activeSubTab === 'requestTypes' ? 'text-[#FE5900]' : 'text-gray-400'}`} />
          <span>Request Types</span>
          {activeSubTab === 'requestTypes' && (
            <span className="absolute bottom-1 left-5 right-5 h-0.5 bg-[#FE5900] rounded-full shadow-[0_1px_3px_rgba(254,89,0,0.3)]" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('capacities')}
          className={`group flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer border relative w-full sm:w-auto hover:translate-y-[-1px] active:translate-y-[1px] ${
            activeSubTab === 'capacities'
              ? (isDarkMode 
                  ? 'bg-dark-800 border-orange-500/40 text-orange-400 font-extrabold shadow-md ring-1 ring-orange-500/20' 
                  : 'bg-white border-gray-200 text-[#FE5900] shadow-sm ring-1 ring-black/5')
              : (isDarkMode 
                  ? 'bg-transparent border-transparent text-gray-400 hover:text-gray-200 hover:bg-dark-800/40 hover:border-dark-700' 
                  : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 hover:bg-white hover:border-gray-200 hover:shadow-xs')
          }`}
        >
          <TrendingUp size={14} className={`transition-transform duration-200 group-hover:scale-115 ${activeSubTab === 'capacities' ? 'text-[#FE5900]' : 'text-gray-400'}`} />
          <span>Capacity Maps</span>
          {activeSubTab === 'capacities' && (
            <span className="absolute bottom-1 left-5 right-5 h-0.5 bg-[#FE5900] rounded-full shadow-[0_1px_3px_rgba(254,89,0,0.3)]" />
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('owners')}
          className={`group flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer border relative w-full sm:w-auto hover:translate-y-[-1px] active:translate-y-[1px] ${
            activeSubTab === 'owners'
              ? (isDarkMode 
                  ? 'bg-dark-800 border-orange-500/40 text-orange-400 font-extrabold shadow-md ring-1 ring-orange-500/20' 
                  : 'bg-white border-gray-200 text-[#FE5900] shadow-sm ring-1 ring-black/5')
              : (isDarkMode 
                  ? 'bg-transparent border-transparent text-gray-400 hover:text-gray-200 hover:bg-dark-800/40 hover:border-dark-700' 
                  : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 hover:bg-white hover:border-gray-200 hover:shadow-xs')
          }`}
        >
          <Users size={14} className={`transition-transform duration-200 group-hover:scale-115 ${activeSubTab === 'owners' ? 'text-[#FE5900]' : 'text-gray-400'}`} />
          <span>Owners & Users Mapping</span>
          {activeSubTab === 'owners' && (
            <span className="absolute bottom-1 left-5 right-5 h-0.5 bg-[#FE5900] rounded-full shadow-[0_1px_3px_rgba(254,89,0,0.3)]" />
          )}
        </button>
        <button
          id="btn_subtab_submitters"
          onClick={() => setActiveSubTab('submitters')}
          className={`group flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer border relative w-full sm:w-auto hover:translate-y-[-1px] active:translate-y-[1px] ${
            activeSubTab === 'submitters'
              ? (isDarkMode 
                  ? 'bg-dark-800 border-orange-500/40 text-orange-400 font-extrabold shadow-md ring-1 ring-orange-500/20' 
                  : 'bg-white border-gray-200 text-[#FE5900] shadow-sm ring-1 ring-black/5')
              : (isDarkMode 
                  ? 'bg-transparent border-transparent text-gray-400 hover:text-gray-200 hover:bg-dark-800/40 hover:border-dark-700' 
                  : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 hover:bg-white hover:border-gray-200 hover:shadow-xs')
          }`}
        >
          <UserCheck size={14} className={`transition-transform duration-200 group-hover:scale-115 ${activeSubTab === 'submitters' ? 'text-[#FE5900]' : 'text-gray-400'}`} />
          <span>Submitters Pool</span>
          {activeSubTab === 'submitters' && (
            <span className="absolute bottom-1 left-5 right-5 h-0.5 bg-[#FE5900] rounded-full shadow-[0_1px_3px_rgba(254,89,0,0.3)]" />
          )}
        </button>
        <button
          id="btn_subtab_roles"
          onClick={() => setActiveSubTab('roles')}
          className={`group flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer border relative w-full sm:w-auto hover:translate-y-[-1px] active:translate-y-[1px] ${
            activeSubTab === 'roles'
              ? (isDarkMode 
                  ? 'bg-dark-800 border-orange-500/40 text-orange-400 font-extrabold shadow-md ring-1 ring-orange-500/20' 
                  : 'bg-white border-gray-200 text-[#FE5900] shadow-sm ring-1 ring-black/5')
              : (isDarkMode 
                  ? 'bg-transparent border-transparent text-gray-400 hover:text-gray-200 hover:bg-dark-800/40 hover:border-dark-700' 
                  : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 hover:bg-white hover:border-gray-200 hover:shadow-xs')
          }`}
        >
          <Shield size={14} className={`transition-transform duration-200 group-hover:scale-115 ${activeSubTab === 'roles' ? 'text-[#FE5900]' : 'text-gray-400'}`} />
          <span>Roles & Permissions</span>
          {activeSubTab === 'roles' && (
            <span className="absolute bottom-1 left-5 right-5 h-0.5 bg-[#FE5900] rounded-full shadow-[0_1px_3px_rgba(254,89,0,0.3)]" />
          )}
        </button>
        <button
          id="btn_subtab_testing"
          onClick={() => setActiveSubTab('testing')}
          className={`group flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-200 cursor-pointer border relative w-full sm:w-auto hover:translate-y-[-1px] active:translate-y-[1px] ${
            activeSubTab === 'testing'
              ? (isDarkMode 
                  ? 'bg-dark-800 border-orange-500/40 text-orange-400 font-extrabold shadow-md ring-1 ring-orange-500/20' 
                  : 'bg-white border-gray-200 text-[#FE5900] shadow-sm ring-1 ring-black/5')
              : (isDarkMode 
                  ? 'bg-transparent border-transparent text-gray-400 hover:text-gray-200 hover:bg-dark-800/40 hover:border-dark-700' 
                  : 'bg-transparent border-transparent text-gray-500 hover:text-gray-800 hover:bg-white hover:border-gray-200 hover:shadow-xs')
          }`}
        >
          <Terminal size={14} className={`transition-transform duration-200 group-hover:scale-115 ${activeSubTab === 'testing' ? 'text-[#FE5900]' : 'text-gray-400'}`} />
          <span>Testing</span>
          {activeSubTab === 'testing' && (
            <span className="absolute bottom-1 left-5 right-5 h-0.5 bg-[#FE5900] rounded-full shadow-[0_1px_3px_rgba(254,89,0,0.3)]" />
          )}
        </button>
      </div>

      {/* Tab Panels with Slide & Fade Transitions */}
      <div className="min-h-[400px]">
        {/* TAB 1: TAXONOMY PANEL */}
        {activeSubTab === 'taxonomy' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left side: Add form for Division & Category */}
            <div className="lg:col-span-1 space-y-6">
              <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}>
                <h3 className={`text-base font-black flex items-center gap-2 mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  <Layers size={18} className="text-[#FE5900]" />
                  Add New Division
                </h3>
                <form onSubmit={handleAddDivision} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Division Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Media"
                      value={newDivName}
                      onChange={e => setNewDivName(e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-xl outline-none font-semibold text-xs h-[40px] transition-all ${
                        isDarkMode ? 'bg-dark-900 border-dark-800 text-white focus:border-orange-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-[#FE5900]'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Primary Owner/Leader</label>
                    <select
                      value={newDivOwner}
                      onChange={e => setNewDivOwner(e.target.value)}
                      className={`w-full px-4 py-2 border rounded-xl outline-none font-semibold text-xs h-[40px] transition-all ${
                        isDarkMode ? 'bg-dark-900 border-dark-800 text-white focus:border-[#FE5900]' : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-[#FE5900]'
                      }`}
                    >
                      <option value="">Select Leader...</option>
                      {ownersList.map(owner => (
                        <option key={owner} value={owner}>{owner}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={runningAction === 'addDiv'}
                    className="w-full bg-[#FE5900] text-white py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 font-extrabold"
                  >
                    <Plus size={14} />
                    Create Division
                  </button>
                </form>
              </div>

              <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}>
                <h3 className={`text-base font-black flex items-center gap-2 mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  <Package size={18} className="text-[#FE5900]" />
                  Add Category to Division
                </h3>
                <form onSubmit={handleAddCategory} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Select Division</label>
                    <select
                      value={selectedDivForCat}
                      onChange={e => setSelectedDivForCat(e.target.value)}
                      className={`w-full px-4 py-2 border rounded-xl outline-none font-semibold text-xs h-[40px] transition-all ${
                        isDarkMode ? 'bg-dark-900 border-dark-800 text-white focus:border-[#FE5900]' : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-[#FE5900]'
                      }`}
                    >
                      <option value="">Select Division...</option>
                      {Object.keys(appConfig.OWNERS).map(div => (
                        <option key={div} value={div}>{div}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Category Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Smart Appliances"
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-xl outline-none font-semibold text-xs h-[40px] transition-all ${
                        isDarkMode ? 'bg-dark-900 border-dark-800 text-white focus:border-orange-500' : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-[#FE5900]'
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={runningAction === 'addCategory'}
                    className="w-full bg-gray-800 text-white dark:bg-dark-600 dark:hover:bg-dark-500 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-900 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 font-extrabold"
                  >
                    <Plus size={14} />
                    Add Category
                  </button>
                </form>
              </div>
            </div>

            {/* Right side: Detailed Grid list of current taxonomy */}
            <div className="lg:col-span-2 space-y-6">
              <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-dark-800">
                  <div>
                    <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Current Network Structure</h3>
                    <p className="text-xs text-gray-400 mt-1">Configured divisions, assigned business leaders, and product categories.</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-[#FE5900]/10 text-[#FE5900] rounded-full">
                    Active
                  </span>
                </div>

                <div className="space-y-6">
                  {Object.entries(appConfig.OWNERS).map(([divName, divOwner]) => {
                    const categories = divisionCategories[divName] || [];
                    const isEditingDiv = editingDivision === divName;

                    return (
                      <div 
                        key={divName} 
                        id={`division_card_${divName.toLowerCase().replace(/\s+/g, '_')}`}
                        className={`p-5 rounded-2xl border transition-colors ${
                          isDarkMode ? 'bg-dark-900/30 border-dark-800 hover:border-dark-700' : 'bg-gray-55/65 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          {isEditingDiv ? (
                            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-4 transition-all w-full">
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-gray-400 block px-1">Division Name</label>
                                  <input
                                    id={`edit_div_name_input_${divName}`}
                                    type="text"
                                    value={editDivName}
                                    onChange={e => setEditDivName(e.target.value)}
                                    className={`w-full px-3 py-1.5 border rounded-lg outline-none font-bold text-xs h-[34px] transition-all ${
                                      isDarkMode ? 'bg-dark-900 border-dark-700 text-white focus:border-[#FE5900]' : 'bg-white border-gray-200 text-gray-900 focus:border-[#FE5900]'
                                    }`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-black uppercase tracking-wider text-gray-400 block px-1">Business Leader</label>
                                  <select
                                    id={`edit_div_leader_select_${divName}`}
                                    value={editDivLeader}
                                    onChange={e => setEditDivLeader(e.target.value)}
                                    className={`w-full px-3 py-1 h-[34px] border rounded-lg outline-none font-bold text-xs transition-all ${
                                      isDarkMode ? 'bg-dark-900 border-dark-700 text-white focus:border-[#FE5900]' : 'bg-white border-gray-200 text-gray-900 focus:border-[#FE5900]'
                                    }`}
                                  >
                                    <option value="">Select Leader...</option>
                                    {ownersList.map(owner => (
                                      <option key={owner} value={owner}>{owner}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center mt-2 sm:mt-0">
                                <button
                                  id={`btn_save_div_${divName}`}
                                  onClick={() => handleUpdateDivision(divName)}
                                  disabled={runningAction !== null}
                                  className="p-1.5 bg-[#FE5900] text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center h-[34px] w-[34px]"
                                  title="Save Division Updates"
                                >
                                  <Check size={14} className="font-extrabold" />
                                </button>
                                <button
                                  id={`btn_cancel_div_${divName}`}
                                  onClick={() => setEditingDivision(null)}
                                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer h-[34px] w-[34px] flex items-center justify-center ${
                                    isDarkMode ? 'border-dark-700 hover:bg-dark-700 text-gray-400' : 'border-gray-200 hover:bg-gray-100 text-gray-500'
                                  }`}
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-0.5">
                                <span className={`text-sm font-black flex items-center gap-1.5 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                  <Layers size={14} className="text-[#FE5900]" />
                                  {divName}
                                </span>
                                <span className="text-[10px] text-gray-400 block font-medium">Assigned Leader: <b className="text-[#FE5900]">{divOwner}</b></span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  id={`btn_edit_div_trigger_${divName}`}
                                  onClick={() => {
                                    setEditingDivision(divName);
                                    setEditDivName(divName);
                                    setEditDivLeader(divOwner);
                                  }}
                                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                    isDarkMode 
                                      ? 'border-dark-800 hover:border-dark-700 text-gray-400 hover:text-white hover:bg-dark-700' 
                                      : 'border-gray-100 hover:border-gray-200 text-gray-400 hover:text-[#FE5900] hover:bg-gray-50'
                                  }`}
                                  title="Edit Division Details"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  id={`btn_delete_div_trigger_${divName}`}
                                  onClick={() => handleDeleteDivision(divName)}
                                  disabled={runningAction?.startsWith('deleteDiv')}
                                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                                  title="Delete Division"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Category Badges */}
                        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-dark-800">
                          {categories.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">No categories defined. Add one under this division to configure workflows.</span>
                          ) : (
                            categories.map(cat => {
                              const isEditingCat = editingCategory === cat && editingCategoryDiv === divName;

                              if (isEditingCat) {
                                return (
                                  <div
                                    key={`edit-${cat}`}
                                    id={`category_badge_edit_${cat}`}
                                    className={`px-2.5 py-1 rounded-xl border flex items-center gap-1.5 text-xs font-semibold ${
                                      isDarkMode ? 'bg-dark-800 border-orange-500/40 text-white' : 'bg-white border-[#FE5900]/40 text-gray-900'
                                    }`}
                                  >
                                    <input
                                      id={`edit_category_input_${cat}`}
                                      type="text"
                                      value={editCategoryName}
                                      onChange={e => setEditCategoryName(e.target.value)}
                                      className="bg-transparent outline-none font-bold text-xs py-0.5 max-w-[140px]"
                                      autoFocus
                                    />
                                    <button
                                      id={`btn_save_cat_${cat}`}
                                      onClick={() => handleUpdateCategory(cat, divName)}
                                      className="text-emerald-500 hover:text-emerald-400 p-0.5 transition-colors cursor-pointer"
                                      title="Save Category Name"
                                    >
                                      <Check size={12} className="stroke-[3]" />
                                    </button>
                                    <button
                                      id={`btn_cancel_cat_${cat}`}
                                      onClick={() => {
                                        setEditingCategory(null);
                                        setEditingCategoryDiv(null);
                                      }}
                                      className="text-gray-400 hover:text-gray-200 p-0.5 transition-colors cursor-pointer"
                                      title="Cancel"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={cat}
                                  id={`category_badge_${cat.toLowerCase().replace(/\s+/g, '_')}`}
                                  className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                                    isDarkMode ? 'bg-dark-800 border-dark-700 text-gray-300 hover:border-dark-600' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                  }`}
                                >
                                  <span>{cat}</span>
                                  <div className="flex items-center gap-1 ml-1 border-l border-gray-200 dark:border-dark-700 pl-1.5">
                                    <button
                                      id={`btn_edit_cat_trigger_${cat}`}
                                      onClick={() => {
                                        setEditingCategory(cat);
                                        setEditingCategoryDiv(divName);
                                        setEditCategoryName(cat);
                                      }}
                                      className="text-gray-400 hover:text-[#FE5900] transition-colors p-0.5 cursor-pointer"
                                      title="Rename category"
                                    >
                                      <Pencil size={10} />
                                    </button>
                                    <button
                                      id={`btn_delete_cat_trigger_${cat}`}
                                      onClick={() => handleDeleteCategory(divName, cat)}
                                      disabled={runningAction?.startsWith('deleteCat')}
                                      className="text-gray-450 hover:text-red-500 rounded-full transition-colors font-bold p-0.5 hover:bg-red-500/10 cursor-pointer"
                                      title="Delete category"
                                    >
                                      &times;
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REQUEST TYPES PANEL */}
        {activeSubTab === 'requestTypes' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form to configure standard workflow types */}
            <div className="lg:col-span-1">
              <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}>
                <h3 className={`text-base font-black flex items-center gap-2 mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  <Tag size={18} className="text-[#FE5900]" />
                  Add Request Type
                </h3>
                <form onSubmit={handleAddRequestType} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Type Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Asset Creation"
                      value={newReqType}
                      onChange={e => setNewReqType(e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-xl outline-none font-semibold text-xs h-[40px] transition-all ${
                        isDarkMode ? 'bg-dark-900 border-dark-800 text-white focus:border-[#FE5900]' : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-[#FE5900]'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Default Priority Tier</label>
                    <select
                      value={newReqPriority}
                      onChange={e => setNewReqPriority(parseInt(e.target.value))}
                      className={`w-full px-4 py-2 border rounded-xl outline-none font-semibold text-xs h-[40px] transition-all ${
                        isDarkMode ? 'bg-dark-900 border-dark-800 text-white focus:border-[#FE5900]' : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-[#FE5900]'
                      }`}
                    >
                      <option value={1}>Tier 1 (Critical SLA)</option>
                      <option value={2}>Tier 2 (Standard SLA)</option>
                      <option value={3}>Tier 3 (Relaxed SLA)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={runningAction === 'addReqType'}
                    className="w-full bg-[#FE5900] text-white py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 font-extrabold"
                  >
                    <Plus size={14} />
                    Configure Type
                  </button>
                </form>
              </div>
            </div>

            {/* List and Priority Tiers of defined Request Types */}
            <div className="lg:col-span-2">
              <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}>
                <div>
                  <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Configured SLA Rules by Request Type</h3>
                  <p className="text-xs text-gray-400 mt-1 mb-6">These workflow types dictate standard auto-assigned priority tiers for requests.</p>
                </div>

                <div className="space-y-3">
                  {appConfig.REQUEST_TYPES.map(typeName => {
                    const prTier = appConfig.PRIORITY_MAP[typeName] || 3;
                    
                    if (editingType === typeName) {
                      return (
                        <div 
                          key={typeName}
                          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-4 transition-all ${
                            isDarkMode ? 'bg-dark-800 border-[#FE5900]/30 shadow-sm' : 'bg-[#FE5900]/[0.02] border-[#FE5900]/20 shadow-sm'
                          }`}
                        >
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-wider text-gray-400 block px-1">Type Name</label>
                              <input
                                type="text"
                                value={editTypeName}
                                onChange={e => setEditTypeName(e.target.value)}
                                className={`w-full px-3 py-1.5 border rounded-lg outline-none font-bold text-xs h-[34px] transition-all ${
                                  isDarkMode ? 'bg-dark-900 border-dark-700 text-white focus:border-[#FE5900]' : 'bg-white border-gray-200 text-gray-900 focus:border-[#FE5900]'
                                }`}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-wider text-gray-400 block px-1">SLA Priority Tier</label>
                              <select
                                value={editTypePriority}
                                onChange={e => setEditTypePriority(parseInt(e.target.value))}
                                className={`w-full px-3 py-1 h-[34px] border rounded-lg outline-none font-bold text-xs transition-all ${
                                  isDarkMode ? 'bg-dark-900 border-dark-700 text-white focus:border-[#FE5900]' : 'bg-white border-gray-200 text-gray-900 focus:border-[#FE5900]'
                                }`}
                              >
                                <option value={1}>Tier 1 (Fast)</option>
                                <option value={2}>Tier 2 (Medium)</option>
                                <option value={3}>Tier 3 (Relaxed)</option>
                              </select>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-end gap-2 pt-2 sm:pt-4 shrink-0">
                            <button
                              onClick={() => handleSaveRequestType(typeName)}
                              disabled={runningAction !== null}
                              className="p-2 bg-[#FE5900] text-white rounded-lg hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center h-[34px] w-[34px]"
                              title="Save Updates"
                            >
                              <Check size={14} className="font-extrabold" />
                            </button>
                            <button
                              onClick={() => setEditingType(null)}
                              className={`p-2 rounded-lg border transition-colors cursor-pointer h-[34px] w-[34px] flex items-center justify-center ${
                                isDarkMode ? 'border-dark-700 hover:bg-dark-700 text-gray-400' : 'border-gray-200 hover:bg-gray-100 text-gray-500'
                              }`}
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={typeName} 
                        className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                          isDarkMode ? 'bg-dark-900/40 border-dark-800 hover:border-dark-700' : 'bg-gray-55/50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Tag size={16} className="text-gray-450 shrink-0" />
                          <div>
                            <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{typeName}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`w-2 h-2 rounded-full ${prTier === 1 ? 'bg-red-500' : prTier === 2 ? 'bg-[#FE5900]' : 'bg-teal-500'}`} />
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                                Priority Tier {prTier} ({prTier === 1 ? 'Fast' : prTier === 2 ? 'Medium' : 'Relaxed'})
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingType(typeName);
                              setEditTypeName(typeName);
                              setEditTypePriority(prTier);
                            }}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              isDarkMode 
                                ? 'border-dark-800 hover:border-dark-700 text-gray-400 hover:text-white hover:bg-dark-700' 
                                : 'border-gray-100 hover:border-gray-200 text-gray-400 hover:text-[#FE5900] hover:bg-gray-50'
                            }`}
                            title="Edit SLA Rules"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteRequestType(typeName)}
                            disabled={runningAction?.startsWith('deleteType')}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                            title="Delete Request Type"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CAPACITY MAPS PANEL */}
        {activeSubTab === 'capacities' && (
          <div className="space-y-6">
            <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-200'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-dark-800">
                <div>
                  <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Category SLA Execution Limits</h3>
                  <p className="text-xs text-gray-400 mt-1">Specify average daily value count processing thresholds for each category mapped against priority tiers.</p>
                </div>

                {/* Instant Search Bar */}
                <div className="relative max-w-xs w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Search category capacity..."
                    value={capacitySearch}
                    onChange={e => setCapacitySearch(e.target.value)}
                    className={`w-full pl-9 pr-4 py-1.5 border rounded-xl outline-none font-semibold text-xs h-[36px] transition-all ${
                      isDarkMode ? 'bg-dark-900 border-dark-800 text-white focus:border-[#FE5900]' : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-[#FE5900]'
                    }`}
                  />
                </div>
              </div>

              {listCategoriesForCapacityMap.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-gray-400 italic">No category mappings match search filter, or no taxonomy has been set up.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-dark-800 text-gray-400 uppercase tracking-widest text-[9px] font-bold">
                        <th className="py-3 px-4">Hierarchy (Category / Div)</th>
                        <th className="py-3 px-4 text-center">Tier 1 Limit</th>
                        <th className="py-3 px-4 text-center">Tier 2 Limit</th>
                        <th className="py-3 px-4 text-center">Tier 3 Limit</th>
                        <th className="py-3 px-4 text-right">Settings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-dark-800">
                      {listCategoriesForCapacityMap.map(({ category, division, capacities }) => {
                        // Gather draft inputs if modified, else fall back to live values
                        const val1 = editedCapacities[category]?.[1] ?? capacities[1] ?? 30;
                        const val2 = editedCapacities[category]?.[2] ?? capacities[2] ?? 60;
                        const val3 = editedCapacities[category]?.[3] ?? capacities[3] ?? 25;

                        const isRowDirty = editedCapacities[category] !== undefined;

                        return (
                          <tr 
                            key={category}
                            className={`transition-colors ${isDarkMode ? 'hover:bg-dark-800/20' : 'hover:bg-gray-50/40'}`}
                          >
                            <td className="py-4 px-4 font-bold">
                              <span className={`${isDarkMode ? 'text-white' : 'text-gray-900'} block text-xs`}>{category}</span>
                              <span className="text-[9px] text-gray-400 font-medium tracking-wide uppercase">{division}</span>
                            </td>
                            
                            <td className="py-4 px-4 text-center">
                              <div className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1" />
                                <input
                                  type="number"
                                  min="1"
                                  value={val1}
                                  onChange={e => handleCapacityChange(category, 1, parseInt(e.target.value) || 1)}
                                  className={`w-16 text-center px-1.5 py-1 border rounded font-bold text-[11px] ${
                                    isDarkMode ? 'bg-dark-900 border-dark-700 text-white font-medium' : 'bg-gray-50 border-gray-200 text-gray-800'
                                  }`}
                                />
                              </div>
                            </td>

                            <td className="py-4 px-4 text-center">
                              <div className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#FE5900] mr-1" />
                                <input
                                  type="number"
                                  min="1"
                                  value={val2}
                                  onChange={e => handleCapacityChange(category, 2, parseInt(e.target.value) || 1)}
                                  className={`w-16 text-center px-1.5 py-1 border rounded font-bold text-[11px] ${
                                    isDarkMode ? 'bg-dark-900 border-dark-700 text-white font-medium' : 'bg-gray-50 border-gray-200 text-gray-800'
                                  }`}
                                />
                              </div>
                            </td>

                            <td className="py-4 px-4 text-center">
                              <div className="inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-1" />
                                <input
                                  type="number"
                                  min="1"
                                  value={val3}
                                  onChange={e => handleCapacityChange(category, 3, parseInt(e.target.value) || 1)}
                                  className={`w-16 text-center px-1.5 py-1 border rounded font-bold text-[11px] ${
                                    isDarkMode ? 'bg-dark-900 border-dark-700 text-white font-medium' : 'bg-gray-50 border-gray-200 text-gray-800'
                                  }`}
                                />
                              </div>
                            </td>

                            <td className="py-4 px-4 text-right">
                              <button
                                onClick={() => saveCapacityRow(category)}
                                disabled={!isRowDirty || runningAction === `saveCap-${category}`}
                                className={`px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-1 ml-auto disabled:opacity-40 disabled:cursor-not-allowed ${
                                  isDarkMode 
                                    ? 'bg-orange-500/15 text-orange-400 hover:bg-orange-500/25' 
                                    : 'bg-orange-50 text-[#FE5900] hover:bg-orange-100'
                                }`}
                              >
                                <Save size={10} />
                                {runningAction === `saveCap-${category}` ? 'Saving...' : 'Save Row'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: OWNERS & USER MAPPING PANEL */}
        {activeSubTab === 'owners' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left side: Add/Delete system owners */}
            <div className="lg:col-span-4 space-y-6">
              <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}>
                <h3 className={`text-base font-black flex items-center gap-2 mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  <Plus size={18} className="text-[#FE5900]" />
                  Add New Owner
                </h3>
                <form onSubmit={handleAddOwner} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Owner Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Papadaki"
                      value={newOwnerName}
                      onChange={e => setNewOwnerName(e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-xl outline-none font-semibold text-xs h-[40px] transition-all ${
                        isDarkMode ? 'bg-dark-900 border-dark-800 text-white focus:border-[#FE5900]' : 'bg-gray-55 border-gray-100 text-gray-900 focus:bg-white focus:border-[#FE5900]'
                      }`}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={runningAction === 'addOwner'}
                    className="w-full bg-[#FE5900] text-white py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 font-extrabold"
                  >
                    <Plus size={14} />
                    Add Owner Name
                  </button>
                </form>
              </div>

              <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}>
                <div>
                  <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>System Owners Pool</h3>
                  <p className="text-xs text-gray-400 mt-1 mb-4">Users can be mapped to any owner in this selectable list.</p>
                </div>

                <div className="space-y-2">
                  {ownersList.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No owners in pool. Please add an owner.</p>
                  ) : (
                    ownersList.map(owner => {
                      const isEditingOwner = editingOwner === owner;

                      return (
                        <div 
                          key={owner} 
                          id={`owner_card_${owner.toLowerCase().replace(/\s+/g, '_')}`}
                          className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                            isDarkMode ? 'bg-dark-900/40 border-dark-800 hover:border-dark-750' : 'bg-gray-55/60 border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          {isEditingOwner ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                id={`edit_owner_input_${owner}`}
                                type="text"
                                value={editOwnerName}
                                onChange={e => setEditOwnerName(e.target.value)}
                                className={`flex-1 px-2.5 py-1 border rounded-lg outline-none font-bold text-xs h-[30px] transition-all ${
                                  isDarkMode ? 'bg-dark-900 border-dark-750 text-white focus:border-[#FE5900]' : 'bg-white border-gray-200 text-gray-900 focus:border-[#FE5900]'
                                }`}
                                autoFocus
                              />
                              <button
                                id={`btn_save_owner_${owner}`}
                                onClick={() => handleUpdateOwner(owner)}
                                disabled={runningAction !== null}
                                className="p-1 px-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors cursor-pointer flex items-center justify-center h-[30px] w-[30px]"
                                title="Save Owner Name"
                              >
                                <Check size={12} className="stroke-[3]" />
                              </button>
                              <button
                                id={`btn_cancel_owner_${owner}`}
                                onClick={() => setEditingOwner(null)}
                                className={`p-1 px-1.5 rounded-lg border transition-colors cursor-pointer h-[30px] w-[30px] flex items-center justify-center ${
                                  isDarkMode ? 'border-dark-700 hover:bg-dark-700 text-gray-400' : 'border-gray-200 hover:bg-gray-100 text-gray-500'
                                }`}
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black uppercase ${
                                  isDarkMode ? 'bg-dark-800 text-orange-400' : 'bg-orange-100 text-[#FE5900]'
                                }`}>
                                  {owner[0]}
                                </div>
                                <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{owner}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  id={`btn_edit_owner_trigger_${owner}`}
                                  onClick={() => {
                                    setEditingOwner(owner);
                                    setEditOwnerName(owner);
                                  }}
                                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                    isDarkMode 
                                      ? 'border-dark-800 hover:border-dark-700 text-gray-400 hover:text-white hover:bg-dark-700' 
                                      : 'border-gray-100 hover:border-gray-200 text-gray-400 hover:text-[#FE5900] hover:bg-gray-50'
                                  }`}
                                  title={`Edit ${owner}`}
                                >
                                  <Pencil size={11} />
                                </button>
                                <button
                                  id={`btn_delete_owner_trigger_${owner}`}
                                  onClick={() => handleDeleteOwner(owner)}
                                  disabled={runningAction?.startsWith('deleteOwner')}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                  title={`Delete ${owner}`}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Map users to owners list */}
            <div className="lg:col-span-8">
              <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-200'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-dark-800 animate-fade-in">
                  <div>
                    <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Map Workspace Users to Owners</h3>
                    <p className="text-xs text-gray-400 mt-1">Directly assign workspace users to operational owner names for dynamic SLA tracking.</p>
                  </div>

                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-450" size={14} />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearchText}
                      onChange={e => setUserSearchText(e.target.value)}
                      className={`w-full pl-9 pr-4 py-1.5 border rounded-xl outline-none font-semibold text-xs h-[36px] transition-all ${
                        isDarkMode ? 'bg-dark-900 border-dark-800 text-white focus:border-[#FE5900]' : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-[#FE5900]'
                      }`}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-dark-800 text-gray-400 uppercase tracking-widest text-[9px] font-bold">
                        <th className="py-3 px-4">User Details</th>
                        <th className="py-3 px-4">Role / Status</th>
                        <th className="py-3 px-4">Mapped Owner Assignation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-dark-800">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-gray-400 italic">
                            No users matched your query.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map(user => (
                          <tr key={user.uid} className={`transition-colors ${isDarkMode ? 'hover:bg-dark-850/30' : 'hover:bg-gray-50/20'}`}>
                            <td className="py-4 px-4 font-bold">
                              <span className={`${isDarkMode ? 'text-white' : 'text-gray-900'} block text-xs`}>
                                {user.name || 'Authorized Member'}
                              </span>
                              <span className="text-[10px] text-gray-400 block font-normal mt-0.5">{user.email}</span>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${
                                isDarkMode ? 'bg-dark-800 text-orange-400' : 'bg-gray-100 text-gray-600'
                              } mr-2`}>
                                {user.role}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider ${
                                user.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                              }`}>
                                {user.status}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <select
                                value={user.mappedOwner || ''}
                                onChange={(e) => handleUserOwnerMappingChange(user.uid, user.name || user.email || 'Authorized Member', e.target.value)}
                                className={`px-3 py-1 border rounded-xl font-bold text-xs h-[36px] outline-none transition-all w-full max-w-[200px] cursor-pointer ${
                                  isDarkMode 
                                    ? 'bg-dark-900 border-dark-700 text-white focus:border-[#FE5900]' 
                                    : 'bg-white border-gray-200 text-gray-900 focus:border-[#FE5900]'
                                }`}
                              >
                                <option value="">Unassigned</option>
                                {ownersList.map(owner => (
                                  <option key={owner} value={owner}>{owner}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SUBMITTERS POOL PANEL */}
        {activeSubTab === 'submitters' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in">
            {/* Left side: Add Submitter Name form */}
            <div className="lg:col-span-4 space-y-6">
              <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}>
                <h3 className={`text-base font-black flex items-center gap-2 mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  <Plus size={18} className="text-[#FE5900]" />
                  Add New Submitter
                </h3>
                <form onSubmit={handleAddSubmitter} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Submitter Name</label>
                    <input
                      id="input_new_submitter_name"
                      type="text"
                      placeholder="e.g. Papadopoulos"
                      value={newSubmitterName}
                      onChange={e => setNewSubmitterName(e.target.value)}
                      className={`w-full px-4 py-2.5 border rounded-xl outline-none font-semibold text-xs h-[40px] transition-all ${
                        isDarkMode ? 'bg-dark-900 border-dark-800 text-white focus:border-[#FE5900]' : 'bg-gray-55 border-gray-100 text-gray-900 focus:bg-white focus:border-[#FE5900]'
                      }`}
                    />
                  </div>
                  <button
                    id="btn_add_submitter_submit"
                    type="submit"
                    disabled={runningAction !== null}
                    className="w-full h-[40px] bg-[#FE5900] text-white flex items-center justify-center gap-2 rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-orange-500/10"
                  >
                    <Plus size={15} />
                    <span>Register Submitter</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Right side: Current Submitter List with editable items */}
            <div className="lg:col-span-8">
              <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-100'}`}>
                <div className="mb-6 pb-4 border-b border-gray-200 dark:border-dark-800">
                  <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Authorized Submitters Pool</h3>
                  <p className="text-xs text-gray-400 mt-1">These submitters are authorized to draft and submit request tickets in the system.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {submittersList.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No submitters in the pool. Please add a submitter.</p>
                  ) : (
                    submittersList.map(submitter => {
                      const isEditing = editingSubmitter === submitter;

                      return (
                        <div 
                          key={submitter} 
                          id={`submitter_card_${submitter.toLowerCase().replace(/\s+/g, '_')}`}
                          className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                            isDarkMode ? 'bg-dark-900/40 border-dark-800 hover:border-dark-750' : 'bg-gray-55/60 border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          {isEditing ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                id={`edit_submitter_input_${submitter}`}
                                type="text"
                                value={editSubmitterName}
                                onChange={e => setEditSubmitterName(e.target.value)}
                                className={`flex-1 px-2.5 py-1 border rounded-lg outline-none font-bold text-xs h-[30px] transition-all ${
                                  isDarkMode ? 'bg-dark-900 border-dark-750 text-white focus:border-[#FE5900]' : 'bg-white border-gray-200 text-gray-900 focus:border-[#FE5900]'
                                }`}
                                autoFocus
                              />
                              <button
                                id={`btn_save_submitter_${submitter}`}
                                onClick={() => handleUpdateSubmitter(submitter)}
                                disabled={runningAction !== null}
                                className="p-1 px-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors cursor-pointer flex items-center justify-center h-[30px] w-[30px]"
                                title="Save Submitter Name"
                              >
                                <Check size={12} className="stroke-[3]" />
                              </button>
                              <button
                                id={`btn_cancel_submitter_${submitter}`}
                                onClick={() => setEditingSubmitter(null)}
                                className={`p-1 px-[7px] rounded-lg border transition-colors cursor-pointer h-[30px] w-[30px] flex items-center justify-center ${
                                  isDarkMode ? 'border-dark-700 hover:bg-dark-700 text-gray-400' : 'border-gray-200 hover:bg-gray-100 text-gray-500'
                                }`}
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black uppercase ${
                                  isDarkMode ? 'bg-dark-800 text-orange-400' : 'bg-orange-100 text-[#FE5900]'
                                }`}>
                                  {submitter[0]}
                                </div>
                                <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{submitter}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  id={`btn_edit_submitter_trigger_${submitter}`}
                                  onClick={() => {
                                    setEditingSubmitter(submitter);
                                    setEditSubmitterName(submitter);
                                  }}
                                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                    isDarkMode 
                                      ? 'border-dark-800 hover:border-dark-700 text-gray-400 hover:text-white hover:bg-dark-700' 
                                      : 'border-gray-100 hover:border-gray-200 text-gray-400 hover:text-[#FE5900] hover:bg-gray-50'
                                  }`}
                                  title={`Edit ${submitter}`}
                                >
                                  <Pencil size={11} />
                                </button>
                                <button
                                  id={`btn_delete_submitter_trigger_${submitter}`}
                                  onClick={() => handleDeleteSubmitter(submitter)}
                                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                  title={`Remove ${submitter}`}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: ROLES & PERMISSIONS PANEL */}
        {activeSubTab === 'roles' && (
          <div className="space-y-6">
            <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${isDarkMode ? 'dark-card' : 'bg-white border-gray-200'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-200 dark:border-dark-800">
                <div>
                  <h3 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Roles & Operational Permissions</h3>
                  <p className="text-xs text-gray-400 mt-1">Define operational user roles and configure precise workflow and access authorizations (Δικαιώματα).</p>
                </div>
                
                {/* Form to Add New Role */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newCustomRoleName.trim()) {
                      triggerNotification('Please enter a role name.', 'error');
                      return;
                    }
                    const trimmed = newCustomRoleName.trim();
                    if (rolesList.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
                      triggerNotification(`Role "${trimmed}" already exists.`, 'error');
                      return;
                    }
                    setConfirmModal({
                      isOpen: true,
                      title: 'Register New Operational Role',
                      message: `Are you sure you want to add "${trimmed}" to the operational roles list of the workspace?`,
                      actionBtnText: 'Add Role',
                      variant: 'success',
                      onConfirm: async () => {
                        setConfirmModal(null);
                        setRunningAction('addRole');
                        try {
                          const updatedRolesList = [...rolesList, trimmed];
                          const updatedRolePerms = {
                            ...rolePermissions,
                            [trimmed]: ['update_flow_status'] // fallback default
                          };
                          await onUpdateConfig({
                            ...appConfig,
                            ROLES_LIST: updatedRolesList,
                            ROLE_PERMISSIONS: updatedRolePerms
                          } as any);
                          setNewCustomRoleName('');
                          triggerNotification(`Role "${trimmed}" successfully registered in the system.`, 'success');
                        } catch {
                          triggerNotification('Failed to add role.', 'error');
                        } finally {
                          setRunningAction(null);
                        }
                      }
                    });
                  }} 
                  className="flex items-center gap-2 max-w-sm w-full"
                >
                  <input
                    type="text"
                    placeholder="New Role (e.g., Guest)..."
                    value={newCustomRoleName}
                    onChange={e => setNewCustomRoleName(e.target.value)}
                    className={`flex-1 px-4 py-1.5 border rounded-xl outline-none font-semibold text-xs h-[36px] transition-all ${
                      isDarkMode 
                        ? 'bg-dark-900 border-dark-800 text-white focus:border-[#FE5900]' 
                        : 'bg-gray-50 border-gray-250 text-gray-900 focus:bg-white focus:border-[#FE5900]'
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={runningAction !== null}
                    className="bg-[#FE5900] text-white px-4.5 py-1.5 h-[36px] flex items-center gap-1 text-xs font-black uppercase tracking-widest rounded-xl hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-orange-500/10 shrink-0"
                  >
                    <Plus size={14} />
                    <span>Add Role</span>
                  </button>
                </form>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-dark-800 text-gray-400 uppercase tracking-widest text-[9px] font-bold">
                      <th className="py-3 px-4 w-[240px]">Role Designation</th>
                      <th className="py-3 px-4 text-center pb-3">Create Requests</th>
                      <th className="py-3 px-4 text-center pb-3">Update QA Status</th>
                      <th className="py-3 px-4 text-center pb-3">Update Flow Status</th>
                      <th className="py-3 px-4 text-center pb-3">View Admins</th>
                      <th className="py-3 px-4 text-center pb-3">Configure Workspace</th>
                      <th className="py-3 px-4 text-right pb-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 dark:divide-dark-800">
                    {rolesList.map(role => {
                      const isSystemRole = role === 'owner' || role === 'admin';
                      const isEditing = editingRoleKey === role;
                      
                      const hasCreate = (rolePermissions[role] || []).includes('create_requests') || isSystemRole;
                      const hasQA = (rolePermissions[role] || []).includes('update_qa_status') || isSystemRole;
                      const hasFlow = (rolePermissions[role] || []).includes('update_flow_status') || isSystemRole;
                      const hasViewAdmin = (rolePermissions[role] || []).includes('view_admin_panel') || isSystemRole;
                      const hasAdminConfig = (rolePermissions[role] || []).includes('admin_configurations') || isSystemRole;

                      return (
                        <tr 
                          key={role}
                          className={`transition-colors ${isDarkMode ? 'hover:bg-dark-800/25' : 'hover:bg-gray-50/50'}`}
                        >
                          <td className="py-4 px-4 font-bold">
                            {isEditing ? (
                              <div className="flex items-center gap-2 max-w-[190px]">
                                <input
                                  type="text"
                                  value={editRoleNameVal}
                                  onChange={e => setEditRoleNameVal(e.target.value)}
                                  className={`flex-1 px-2.5 py-1 border rounded-lg outline-none font-bold text-xs h-[30px] transition-all ${
                                    isDarkMode ? 'bg-dark-900 border-dark-750 text-white focus:border-[#FE5900]' : 'bg-white border-gray-200 text-gray-900 focus:border-[#FE5900]'
                                  }`}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!editRoleNameVal.trim()) {
                                      triggerNotification('Please enter a role name.', 'error');
                                      return;
                                    }
                                    const trimmed = editRoleNameVal.trim();
                                    if (trimmed !== role && rolesList.some(r => r.toLowerCase() === trimmed.toLowerCase())) {
                                      triggerNotification(`Role "${trimmed}" already exists.`, 'error');
                                      return;
                                    }
                                    setConfirmModal({
                                      isOpen: true,
                                      title: 'Rename Operational Role',
                                      message: `Are you sure you want to rename "${role}" to "${trimmed}"? Current active users with role "${role}" will be updated to "${trimmed}".`,
                                      actionBtnText: 'Rename Role',
                                      variant: 'primary',
                                      onConfirm: async () => {
                                        setConfirmModal(null);
                                        setRunningAction(`editRole-${role}`);
                                        try {
                                          const nextRolesList = rolesList.map(r => r === role ? trimmed : r);
                                          const nextRolePerms = { ...rolePermissions };
                                          if (trimmed !== role) {
                                            nextRolePerms[trimmed] = nextRolePerms[role] || [];
                                            delete nextRolePerms[role];
                                          }
                                          await onUpdateConfig({
                                            ...appConfig,
                                            ROLES_LIST: nextRolesList,
                                            ROLE_PERMISSIONS: nextRolePerms
                                          } as any);

                                          // Dynamically update existing users
                                          for (const u of users) {
                                            if (u.role === role) {
                                              if (u.uid.startsWith('auth-')) {
                                                const email = u.uid.replace('auth-', '');
                                                await firebaseService.updateAuthorizedEmail(email, trimmed);
                                              } else {
                                                await firebaseService.updateUserRole(u.uid, trimmed);
                                              }
                                            }
                                          }

                                          setEditingRoleKey(null);
                                          triggerNotification(`Role renamed to "${trimmed}". Outstanding users migrated.`, 'success');
                                        } catch {
                                          triggerNotification('Failed to rename role.', 'error');
                                        } finally {
                                          setRunningAction(null);
                                        }
                                      }
                                    });
                                  }}
                                  className="p-1 text-white bg-emerald-505 text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer flex items-center justify-center h-[30px] w-[30px]"
                                  title="Save Name"
                                >
                                  <Check size={12} className="stroke-[3]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingRoleKey(null)}
                                  className={`p-1 rounded-lg border transition-colors cursor-pointer h-[30px] w-[30px] flex items-center justify-center ${
                                    isDarkMode ? 'border-dark-700 hover:bg-dark-700 text-gray-400' : 'border-gray-250 hover:bg-gray-100 text-gray-500'
                                  }`}
                                  title="Cancel"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                <span className={`${isDarkMode ? 'text-white' : 'text-gray-900'} text-xs font-bold`}>{role}</span>
                                {isSystemRole ? (
                                  <span className="text-[8px] text-[#FE5900] font-black uppercase tracking-wider block">System Protect</span>
                                ) : (
                                  <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider block">Custom Role</span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Checkbox columns */}
                          <td className="py-4 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={hasCreate}
                              disabled={isSystemRole || runningAction !== null}
                              onChange={() => handleTogglePermission(role, 'create_requests')}
                              className={`h-4 w-4 rounded border-gray-300 text-[#FE5900] focus:ring-[#FE5900] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                            />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={hasQA}
                              disabled={isSystemRole || runningAction !== null}
                              onChange={() => handleTogglePermission(role, 'update_qa_status')}
                              className={`h-4 w-4 rounded border-gray-300 text-[#FE5900] focus:ring-[#FE5900] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                            />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={hasFlow}
                              disabled={isSystemRole || runningAction !== null}
                              onChange={() => handleTogglePermission(role, 'update_flow_status')}
                              className={`h-4 w-4 rounded border-gray-300 text-[#FE5900] focus:ring-[#FE5900] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                            />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={hasViewAdmin}
                              disabled={isSystemRole || runningAction !== null}
                              onChange={() => handleTogglePermission(role, 'view_admin_panel')}
                              className={`h-4 w-4 rounded border-gray-300 text-[#FE5900] focus:ring-[#FE5900] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                            />
                          </td>
                          <td className="py-4 px-4 text-center">
                            <input
                              type="checkbox"
                              checked={hasAdminConfig}
                              disabled={isSystemRole || runningAction !== null}
                              onChange={() => handleTogglePermission(role, 'admin_configurations')}
                              className={`h-4 w-4 rounded border-gray-300 text-[#FE5900] focus:ring-[#FE5900] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60`}
                            />
                          </td>

                          {/* Edit / Delete actions */}
                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center gap-1.5 justify-end">
                              {!isSystemRole && !isEditing && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingRoleKey(role);
                                      setEditRoleNameVal(role);
                                    }}
                                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                      isDarkMode 
                                        ? 'border-dark-800 hover:border-dark-700 text-gray-400 hover:text-white hover:bg-dark-700' 
                                        : 'border-gray-150 hover:border-gray-200 text-gray-400 hover:text-[#FE5900] hover:bg-gray-50'
                                    }`}
                                    title={`Rename ${role}`}
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  <button
                                    onClick={() => handleRoleDelete(role)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                    title={`Delete ${role}`}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </>
                              )}
                              {isSystemRole && (
                                <span className="text-[10px] text-gray-450 italic font-semibold select-none pr-1">Protected</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'testing' && (
          <div className="space-y-6 animate-fade-in">
            {/* Split layout: Editor and Console */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Form: Code compilation & configs */}
              <div className="lg:col-span-12 xl:col-span-7 space-y-6">
                <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors ${
                  isDarkMode ? 'dark-card' : 'bg-white border-gray-100'
                }`}>
                  <h3 className={`text-base font-black flex items-center gap-2 mb-4 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    <Terminal size={18} className="text-[#FE5900]" />
                    Script Execution Environment
                  </h3>
                  
                  <div className="space-y-4">
                    {/* Target Email Input */}
                    <div className="space-y-1.5">
                      <label id="lbl_testing_target_email" className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Target Email</label>
                      <div className="relative">
                        <input
                          id="inp_testing_target_email"
                          type="email"
                          placeholder="recipient@example.com"
                          value={testEmail}
                          onChange={e => setTestEmail(e.target.value)}
                          className={`w-full pl-10 pr-4 py-2.5 border rounded-xl outline-none font-semibold text-xs h-[40px] transition-all ${
                            isDarkMode 
                              ? 'bg-dark-900 border-dark-800 text-white focus:border-orange-500' 
                              : 'bg-gray-50 border-gray-200 text-gray-900 focus:bg-white focus:border-[#FE5900]'
                          }`}
                        />
                        <Mail size={14} className="absolute left-3.5 top-3.5 text-gray-400" />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 font-medium italic">
                        The variable <code className="font-mono bg-gray-100 dark:bg-dark-800 px-1 py-0.5 rounded text-[#FE5900]">email</code> in your script matches this target address.
                      </p>
                    </div>

                    {/* Quick templates button list */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Quick Script Templates</label>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          id="btn_template_node"
                          type="button"
                          onClick={() => setTestScriptCode(`// Template 1: Node-proxy Mail Dispatcher
const response = await fetch('/api/send-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: email,
    subject: 'Aesthetic Admin Testing Portal',
    text: 'Hello, this is a live script-evaluated email test dispatched from the administration testing console!'
  })
});

if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.error || 'Fetch dispatch failed');
}

const result = await response.json();
console.log('Dispatch success!', result);
return result;`)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                            isDarkMode 
                              ? 'bg-dark-800 border-dark-700 hover:border-orange-500/50 text-gray-300' 
                              : 'bg-gray-50 border-gray-200 hover:border-orange-500/50 text-gray-700'
                          }`}
                        >
                          Node API Send
                        </button>
                        <button
                          id="btn_template_html"
                          type="button"
                          onClick={() => setTestScriptCode(`// Template 2: Tailored HTML Table Envelope
const htmlContent = \`
  <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #fafafa; padding: 40px; border-radius: 16px; border: 1px solid #eaeaea; color: #333; max-width: 600px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #FE5900; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">NEXUS SYSTEM TEST</h1>
      <p style="color: #666; font-size: 14px; margin-top: 5px; font-weight: 500;">Live Administration Script Dispatcher</p>
    </div>
    
    <div style="background: #ffffff; padding: 25px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); border: 1px solid #f0f0f0;">
      <p style="margin-top: 0; font-size: 15px; line-height: 1.6;">Hello,</p>
      <p style="font-size: 15px; line-height: 1.6;">This is an advanced <strong>rich HTML email test</strong> executed directly as an authenticated administration script.</p>
      
      <div style="margin: 20px 0; padding: 15px; background: #fff5eb; border-left: 4px solid #FE5900; border-radius: 4px;">
        <span style="font-weight: 700; color: #d33c00; display: block; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Target Destination</span>
        <span style="font-family: monospace; font-size: 14px; font-weight: 600; color: #111;">\${email}</span>
      </div>
      
      <p style="font-size: 13px; color: #666; margin-bottom: 0;">If you received this, the application backend SMTP / Resend microservice is fully configured and operational.</p>
    </div>
    
    <p style="text-align: center; font-size: 11px; color: #999; margin-top: 30px; font-weight: 500;">
      Nexus Automated Services &copy; 2026 • Live Admin Sandboxed Run
    </p>
  </div>
\`;

console.log('Preparing customized HTML envelope...');
const response = await fetch('/api/send-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: email,
    subject: 'Rich HTML Template Execution Test',
    html: htmlContent,
    text: 'This is a fallback text message for HTML mail clients.'
  })
});

if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.error || 'Endpoint rejected dispatch request');
}

const data = await response.json();
console.log('Successfully delivered HTML message stream!', data);
return data;`)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                            isDarkMode 
                              ? 'bg-dark-800 border-dark-700 hover:border-orange-500/50 text-gray-300' 
                              : 'bg-gray-50 border-gray-200 hover:border-orange-500/50 text-gray-700'
                          }`}
                        >
                          Rich HTML Template
                        </button>
                        <button
                          id="btn_template_firebase"
                          type="button"
                          onClick={() => setTestScriptCode(`console.log('Testing Firestore connectivity...');
// Fetch logs from firebaseService directly in your script scope!
const logs = await firebaseService.getLogs(5);
console.log('Successfully fetched logs from Firestore:', logs);
return { 
  logCount: logs.length,
  recentLogs: logs.map(l => ({ action: l.action, user: l.userId }))
};`)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                            isDarkMode 
                              ? 'bg-dark-800 border-dark-700 hover:border-orange-500/50 text-gray-300' 
                              : 'bg-gray-50 border-gray-200 hover:border-orange-500/50 text-gray-700'
                          }`}
                        >
                          Firestore Connection
                        </button>
                      </div>
                    </div>

                    {/* Code/Script TextArea Input */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">JavaScript Solution Script</label>
                        <span className="text-[9px] font-bold text-gray-400 font-mono">SANDBOX ENVD (async supported)</span>
                      </div>
                      <div className="relative rounded-2xl overflow-hidden border border-gray-200 dark:border-dark-800 shadow-inner">
                        <textarea
                          id="txt_testing_script_code"
                          rows={15}
                          value={testScriptCode}
                          onChange={e => setTestScriptCode(e.target.value)}
                          placeholder="// Write custom JS using email, firebaseService, console, fetch, appConfig variables"
                          className="w-full p-4 font-mono text-xs leading-relaxed outline-none transition-all resize-y bg-[#0d1117] text-gray-200 dark:bg-black focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-gray-400 font-medium font-semibold">
                        <span>Variables available: <b className="font-mono">email</b>, <b className="font-mono">firebaseService</b>, <b className="font-mono">fetch</b>, <b className="font-mono">appConfig</b></span>
                        <button 
                          id="btn_testing_clear_code"
                          type="button"
                          onClick={() => setTestScriptCode('')} 
                          title="Reset editor" 
                          className="text-red-500 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                        >
                          <RotateCcw size={10} /> Clear Code
                        </button>
                      </div>
                    </div>

                    <button
                      id="btn_testing_run"
                      type="button"
                      onClick={handleRunTestScript}
                      disabled={testExecutionStatus === 'running'}
                      className={`w-full py-3 px-6 h-[46px] rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 cursor-pointer transition-all duration-200 hover:translate-y-[-1px] active:translate-y-[1px] disabled:opacity-50 ${
                        testExecutionStatus === 'running' 
                          ? 'bg-gray-700 text-gray-400' 
                          : 'bg-[#FE5900] text-white hover:bg-orange-600 shadow-md shadow-orange-500/10'
                      }`}
                    >
                      {testExecutionStatus === 'running' ? (
                        <>
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-t-white" />
                          Running Sandbox Execution...
                        </>
                      ) : (
                        <>
                          <Play size={14} className="fill-white" />
                          Execute & Dispatch Email
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Output: Interactive Terminal / Output */}
              <div className="lg:col-span-12 xl:col-span-5 flex flex-col justify-start">
                <div className={`p-6 rounded-[2rem] border shadow-sm transition-colors flex-1 flex flex-col min-h-[460px] ${
                  isDarkMode ? 'dark-card' : 'bg-white border-gray-100'
                }`}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className={`text-base font-black flex items-center gap-2 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      <Terminal size={18} className="text-[#FE5900]" />
                      Console Output & Returns
                    </h3>
                    <button
                      id="btn_testing_clear_logs"
                      type="button"
                      onClick={() => {
                        setTestConsoleLogs([]);
                        setTestResultOutput(null);
                        setTestExecutionStatus('idle');
                      }}
                      className="text-[10px] font-bold text-[#FE5900] hover:underline cursor-pointer"
                    >
                      Clear Log Output
                    </button>
                  </div>

                  <div className="flex-1 flex flex-col space-y-4">
                    {/* Console Output box */}
                    <div className="flex-1 flex flex-col">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">Execution Progress stream</label>
                      <div className="flex-grow min-h-[180px] rounded-xl p-4 font-mono text-xs overflow-y-auto max-h-[300px] bg-[#0A0E17] text-[#58a6ff] dark:bg-black border border-dark-900/40">
                        {testConsoleLogs.length === 0 ? (
                          <span className="text-gray-500 block italic">// Console logs will appear stream-wise during execution...</span>
                        ) : (
                          testConsoleLogs.map((log, index) => {
                            let style = 'text-gray-300';
                            if (log.startsWith('[SYSTEM]')) style = 'text-amber-500 font-semibold';
                            if (log.startsWith('[SYSTEM_CRASH]')) style = 'text-red-550 font-bold';
                            if (log.startsWith('[LOG]')) style = 'text-emerald-400';
                            if (log.startsWith('[WARN]')) style = 'text-yellow-400';
                            if (log.startsWith('[ERROR]')) style = 'text-red-400';
                            return (
                              <div key={index} className={`whitespace-pre-wrap ${style}`}>
                                {log}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Result payload box */}
                    <div className="flex flex-col">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">Returned Result Payload</label>
                      <div className="rounded-xl p-4 font-mono text-xs overflow-y-auto min-h-[140px] max-h-[220px] bg-[#0A0E17] border border-dark-900/40">
                        {testResultOutput === null ? (
                          <span className="text-gray-500 font-semibold block italic">{
                            testExecutionStatus === 'running' 
                              ? '// Gathering outputs...' 
                              : '// Awaiting return statement value...'
                          }</span>
                        ) : (
                          <pre className={testExecutionStatus === 'failed' ? 'text-red-400 font-semibold whitespace-pre-wrap' : 'text-emerald-400 font-semibold whitespace-pre-wrap'}>
                            {testResultOutput}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal Overlay */}
      <AnimatePresence>
        {confirmModal && confirmModal.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            
            {/* Modal Content */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className={`relative w-full max-w-md p-6 rounded-3xl border shadow-2xl ${
                isDarkMode ? 'bg-dark-950 border-dark-800 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}
            >
              <div className="space-y-4">
                <div className="flex gap-3 items-start">
                  <div className={`p-3 rounded-2xl ${
                    confirmModal.variant === 'destructive' 
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-650 dark:text-red-400' 
                      : confirmModal.variant === 'success'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-650 dark:text-emerald-400'
                        : 'bg-orange-100 dark:bg-orange-900/30 text-[#FE5900] dark:text-orange-400'
                  }`}>
                    <AlertCircle size={22} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black tracking-tight">{confirmModal.title}</h4>
                    <p className={`text-xs mt-1.5 leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {confirmModal.message}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-dark-800">
                  <button 
                    onClick={() => setConfirmModal(null)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      isDarkMode ? 'bg-dark-800 hover:bg-dark-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      confirmModal.onConfirm();
                    }}
                    className={`px-4 py-2 text-white rounded-xl text-xs font-extrabold transition-all cursor-pointer font-black uppercase tracking-wider ${
                      confirmModal.variant === 'destructive'
                        ? 'bg-red-500 hover:bg-red-650'
                        : confirmModal.variant === 'success'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-[#FE5900] hover:bg-orange-600'
                    }`}
                  >
                    {confirmModal.actionBtnText || 'Confirm'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
