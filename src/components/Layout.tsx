import React, { useState } from 'react';
import {
  PieChart,
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  Bell,
  LogOut,
  FolderOpen,
  ChevronDown,
  ClipboardList,
  Target,
  Layers,
  FileVideo2,
  Camera,
  ShieldCheck
} from 'lucide-react';
import { Role } from '../types';
import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useI18n } from '../lib/i18n';

interface LayoutProps {
  children: React.ReactNode;
  role: Role;
  setRole: (role: Role) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

interface SubMenuItem {
  id: string;
  label: string;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  subMenu?: SubMenuItem[];
}

export function Layout({ children, role, setRole, activeTab, setActiveTab }: LayoutProps) {
  const [expandedNavs, setExpandedNavs] = useState<string[]>(['course_group']);
  const { language, setLanguage, t } = useI18n();
  const isMultilingualLayout = language !== 'zh';
  const languageOptionLabels = {
    zh: { zh: '中文', en: '英文', id: '印尼语' },
    en: { zh: 'Chinese', en: 'English', id: 'Indonesian' },
    id: { zh: 'Mandarin', en: 'Inggris', id: 'Indonesia' },
  } as const;

  const toggleNav = (id: string) => {
    setExpandedNavs(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  };

  const getNavItems = (role: Role): NavItem[] => {
    switch (role) {
      case 'Super Admin':
        return [
          { id: 'dashboard', label: '运行概览', icon: PieChart },
          { id: 'org', label: '组织架构', icon: Layers },
          { id: 'users_manage', label: '账号管理', icon: Users },
          { id: 'category_manage', label: '品类设置', icon: BookOpen },
          { id: 'notification_settings', label: '通知设置', icon: Bell },
          { id: 'media_collection_manage', label: '媒体与审计', icon: FileVideo2 },
          { id: 'photo_checkin_records', label: 'BA打卡记录', icon: Camera },
          { id: 'material_library', label: '素材库', icon: BookOpen },
          { id: 'settings', label: '系统设置', icon: Settings },
        ];
      case 'HQ Trainer':
        return [
          { id: 'dashboard', label: '全国数据', icon: LayoutDashboard },
          { id: 'training_inspection', label: '数据审计', icon: ShieldCheck },
          { id: 'course_group', label: '在线课件', icon: BookOpen, subMenu: [
            { id: 'courses', label: '生成新课件' },
            { id: 'courses_manage', label: '课件管理' }
          ] },
          { id: 'ba_practice_group', label: 'AI陪练', icon: Users, subMenu: [
            { id: 'ba_avatars', label: '数字人顾客' },
            { id: 'ba_scripts', label: '场景剧本' },
            { id: 'ba_quotes', label: '金句库' },
            { id: 'material_library', label: '素材库' }
          ] },
          { id: 'exam_group', label: '题目与考试', icon: ClipboardList, subMenu: [
            { id: 'exam_generate', label: '生成题目' },
            { id: 'exam_bank', label: '题库管理' },
            { id: 'exam_homework', label: '关联附加题管理' },
            { id: 'exam_manage', label: '考试组卷' }
          ] },
          { id: 'tasks_group', label: '周期任务', icon: FolderOpen, subMenu: [
            { id: 'study_task_manage', label: '学习任务管理' },
            { id: 'practice_task_manage', label: '练习任务管理' },
            { id: 'media_collection_manage', label: '音视频采集任务' },
            { id: 'photo_checkin_records', label: 'BA打卡记录' },
            { id: 'exam_task_manage', label: '考试任务管理' }
          ] },
          { id: 'org_group', label: '组织与档案', icon: Users, subMenu: [
            { id: 'store_archive', label: '全国门店总档案' },
            { id: 'personnel_archive', label: '全国人员档案' }
          ] },
        ];
      case 'Regional Training Manager':
        return [
          { id: 'dashboard', label: '区域数据', icon: LayoutDashboard },
          { id: 'training_inspection', label: '数据审计', icon: ShieldCheck },
          { id: 'regional_content', label: '区域补充内容', icon: BookOpen, subMenu: [
            { id: 'courses', label: '生成新课件' },
            { id: 'courses_manage', label: '区域课件管理' },
            { id: 'ba_scripts', label: '区域场景剧本' },
            { id: 'ba_avatars', label: '区域数字人顾客' },
            { id: 'material_library', label: '素材库' }
          ] },
          { id: 'tasks', label: '周期任务', icon: Target, subMenu: [
            { id: 'study_task_manage', label: '学习任务' },
            { id: 'practice_task_manage', label: '练习任务' },
            { id: 'media_collection_manage', label: '音视频采集任务' },
            { id: 'photo_checkin_records', label: 'BA打卡记录' },
            { id: 'material_library', label: '素材库' },
            { id: 'exam_task_manage', label: '考试任务' }
          ] },
          { id: 'org_group', label: '组织与档案', icon: Users, subMenu: [
            { id: 'store_archive', label: '门店总档案' },
            { id: 'personnel_archive', label: '人员档案' }
          ] },
        ];
      case 'Regional Manager':
        return [
          { id: 'dashboard', label: '区域数据', icon: LayoutDashboard },
          { id: 'training_inspection', label: '数据审计', icon: ShieldCheck },
          { id: 'tasks_group', label: '周期任务监控', icon: ClipboardList, subMenu: [
            { id: 'study_task_manage', label: '学习任务' },
            { id: 'practice_task_manage', label: '练习任务' },
            { id: 'media_collection_manage', label: '音视频采集任务' },
            { id: 'photo_checkin_records', label: 'BA打卡记录' },
            { id: 'material_library', label: '素材库' },
            { id: 'exam_task_manage', label: '考试任务' }
          ] },
          { id: 'org_group', label: '组织与档案', icon: Users, subMenu: [
            { id: 'store_archive', label: '门店总档案' },
            { id: 'personnel_archive', label: '人员档案' }
          ] }
        ];
      case 'Regional Trainer':
        return [
          { id: 'dashboard', label: '区域数据', icon: LayoutDashboard },
          { id: 'training_inspection', label: '数据审计', icon: ShieldCheck },
          { id: 'regional_content', label: '区域补充内容', icon: BookOpen, subMenu: [
            { id: 'courses', label: '生成新课件' },
            { id: 'courses_manage', label: '区域课件管理' },
            { id: 'ba_scripts', label: '区域场景剧本' },
            { id: 'ba_avatars', label: '区域数字人顾客' },
            { id: 'material_library', label: '素材库' }
          ] },
          { id: 'tasks', label: '周期任务', icon: Target, subMenu: [
            { id: 'study_task_manage', label: '学习任务' },
            { id: 'practice_task_manage', label: '练习任务' },
            { id: 'media_collection_manage', label: '音视频采集任务' },
            { id: 'photo_checkin_records', label: 'BA打卡记录' },
            { id: 'exam_task_manage', label: '考试任务' }
          ] },
        ];

      default:
        return [];
    }
  };

  const navItems = getNavItems(role);

  // Ensure active tab is valid for role
  React.useEffect(() => {
    const validIds = navItems.reduce((acc, item) => {
      if (item.subMenu) {
         acc.push(...item.subMenu.map(sub => sub.id));
      } else {
         acc.push(item.id);
      }
      return acc;
    }, [] as string[]);

    if (!validIds.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [role, activeTab, navItems, setActiveTab]);

  return (
    <div className="flex h-screen bg-[#F7F3F1] font-sans text-[#242124] overflow-hidden flex-col md:flex-row">
      {/* Sidebar */}
      <aside className={cn(
        "w-full bg-[#171518] text-white flex flex-col flex-shrink-0 hidden md:flex transition-[width]",
        isMultilingualLayout ? "md:w-72 xl:w-80" : "md:w-64"
      )}>
        <div className="p-5 overflow-y-auto min-h-0">
          <div className="mb-6">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-tr from-rose-400 to-amber-200 rounded-lg"></div>
              <span className="font-bold tracking-tight text-lg">SalesBoost <span className="font-light opacity-60">AI</span></span>
            </div>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{t('服务客户')}</p>
              <p data-i18n-skip="true" className="mt-0.5 text-sm font-bold leading-snug text-white">Hebe Beauty</p>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <div key={item.id}>
                {item.subMenu ? (
                  <>
                    <button
                      onClick={() => toggleNav(item.id)}
                      className={cn(
                        "w-full flex items-start justify-between gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                         (item.subMenu.some(sub => sub.id === activeTab) && !expandedNavs.includes(item.id)) || expandedNavs.includes(item.id) ? "text-white" : "text-white opacity-70 hover:bg-white/[0.06]"
                      )}
                    >
                      <div className="flex items-start min-w-0">
                        <item.icon className={cn(
                           "mr-3 mt-0.5 h-5 w-5 shrink-0",
                           (item.subMenu.some(sub => sub.id === activeTab) && !expandedNavs.includes(item.id)) || expandedNavs.includes(item.id) ? "text-white" : "text-white opacity-70"
                        )} />
                        <span className="min-w-0 whitespace-normal break-words leading-snug">{item.label}</span>
                      </div>
                      <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform opacity-70 mt-0.5", expandedNavs.includes(item.id) ? "rotate-180" : "rotate-0")} />
                    </button>
                    {expandedNavs.includes(item.id) && (
                      <div className="mt-1 space-y-1 pl-10 pr-2">
                        {item.subMenu.map(subItem => {
                          const isAdditionalQuestionNote = subItem.id === 'exam_homework';
                          const subMenuButton = (
                            <button
                              onClick={() => setActiveTab(subItem.id)}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-normal break-words leading-snug",
                                activeTab === subItem.id
                                  ? "bg-white/[0.12] text-white"
                                  : "text-white opacity-60 hover:text-white hover:bg-white/[0.06]"
                              )}
                            >
                              {subItem.label}
                            </button>
                          );

                          if (!isAdditionalQuestionNote) {
                            return (
                              <React.Fragment key={subItem.id}>
                                {subMenuButton}
                              </React.Fragment>
                            );
                          }

                          return (
                            <div key={subItem.id} className="relative group/additional-question-note">
                              <span data-i18n-skip="true" className="absolute -right-1 -top-2 z-20 h-4 min-w-4 rounded-full bg-blue-950 px-1 text-[9px] font-bold leading-4 text-white text-center shadow-sm backdrop-blur-sm">
                                注
                              </span>
                              {subMenuButton}
                              <div
                                data-i18n-skip="true"
                                className="absolute left-0 top-full mt-2 hidden group-hover/additional-question-note:block z-50 w-64 rounded-lg bg-blue-950/95 px-3 py-2 text-xs leading-relaxed text-white shadow-xl backdrop-blur-sm"
                              >
                                给研发：附加题视为和课件捆绑在一起展示的部分，所有 APP 和导出课件展示后面都需要附加上关联的附加题。
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "w-full flex items-start px-4 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                      activeTab === item.id
                        ? "bg-white/[0.12] text-white"
                        : "text-white opacity-70 hover:bg-white/[0.06]"
                    )}
                  >
                    <item.icon className={cn(
                      "mr-3 mt-0.5 h-5 w-5 shrink-0",
                      activeTab === item.id ? "text-white" : "text-white opacity-70"
                    )} />
                    <span className="min-w-0 whitespace-normal break-words leading-snug">{item.label}</span>
                  </button>
                )}
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-white/5">
           {/* Role Switcher Demo */}
          <div className="bg-white/[0.06] rounded-xl p-4 mb-4">
             <p className="text-xs opacity-50 mb-1 uppercase tracking-widest font-semibold flex items-center justify-between">角色切换 (Demo)</p>
             <div className="relative mt-2">
               <select
                 value={role}
                 onChange={(event) => setRole(event.target.value as Role)}
                 className="min-h-8 h-auto w-full appearance-none rounded-lg border border-white/20 bg-[#232026] px-3 py-2 pr-8 text-left text-xs font-medium text-white outline-none transition-colors hover:bg-white/[0.12] focus:border-white/40 focus:ring-2 focus:ring-white/10"
               >
                 <option value="Super Admin">系统管理员 (SA)</option>
                 <option value="HQ Trainer">总部培训师 (HT)</option>
                 <option value="Regional Manager">区域经理 (RM)</option>
                 <option value="Regional Training Manager">区域培训师主管 (RTM)</option>
                 <option value="Regional Trainer">区域培训师 (RT)</option>
               </select>
               <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
             </div>
          </div>

          <div className="bg-white/[0.06] rounded-xl p-4 border border-white/10">
            <p className="text-[10px] opacity-40 uppercase tracking-widest font-bold flex justify-between items-center">
              当前登录用户
              <button className="hover:opacity-100 transition-opacity"><LogOut className="h-3 w-3" /></button>
            </p>
            <p className="text-sm font-medium text-amber-200 mt-1">
              {role === 'Super Admin' ? '系统管理员' :
               role === 'HQ Trainer' ? 'Sarah Lee' :
               role === 'Regional Manager' ? 'Budi Santoso' :
               role === 'Regional Training Manager' ? 'Fitriani' :
               role === 'Regional Trainer' ? 'Nurul Huda' :
               'Ahmad Maulana'}
            </p>
            <p className="text-[10px] opacity-40 uppercase mt-1">
              {role === 'Super Admin' ? 'Lumina Admin' :
               role === 'HQ Trainer' ? '全球总部' :
               role === 'Regional Manager' ? '大区管理' :
               role === 'Regional Training Manager' ? '大区培训' :
               role === 'Regional Trainer' ? '南区' :
               '门店'}
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header (Role Bar) */}
        <header className="min-h-16 bg-white border-b border-[#E5DED8] flex flex-wrap items-center justify-between gap-3 px-4 py-3 shadow-sm shrink-0 z-10 transition-colors md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-4">
             <h1 className="min-w-0 text-lg font-semibold leading-snug text-[#1F1C1F] break-words">{role === 'Super Admin' ? '系统运行概览' : role === 'HQ Trainer' ? '全国培训总览' : role === 'Regional Manager' ? '大区业务看板' : (role === 'Regional Training Manager' || role === 'Regional Trainer') ? '大区培训看板' : '门店考评看板'}</h1>
             <span className="text-[#C9C1C4] hidden md:block">|</span>
             <span className="text-xs font-medium text-[#766F73] hidden md:block">SalesBoost AI</span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3 ml-auto">
             <div className="flex items-center gap-2">
               <span className="hidden xl:block text-[10px] font-bold uppercase tracking-wider text-[#9A9396]">语言</span>
               <select
                 data-i18n-skip="true"
                 aria-label="Language"
                 value={language}
                 onChange={(event) => setLanguage(event.target.value as typeof language)}
                 className={cn(
                   "min-h-8 rounded-lg border border-[#E5DED8] bg-[#F8F5F3] px-2.5 py-1.5 text-xs font-medium text-[#3F3A3D] outline-none transition-colors focus:border-rose-400 focus:ring-2 focus:ring-rose-500/15",
                   isMultilingualLayout ? "w-[176px]" : "w-[138px]"
                 )}
               >
                 <option value="zh">{languageOptionLabels[language].zh}</option>
                 <option value="en">{languageOptionLabels[language].en}</option>
                 <option value="id">{languageOptionLabels[language].id}</option>
               </select>
             </div>
             <div className="relative group/notification-note">
               <span className="absolute -right-3 -top-2 z-20 h-4 min-w-4 rounded-full bg-blue-950 px-1 text-[9px] font-bold leading-4 text-white text-center shadow-sm backdrop-blur-sm">注</span>
               <button className="text-[#9A9396] hover:text-[#5D565A] transition-colors relative">
                 <Bell className="h-5 w-5" />
                 <span className="absolute top-0 right-0 block h-2 border-2 border-white w-2 rounded-full bg-rose-500" />
               </button>
               <div className="absolute right-0 top-full mt-2 hidden group-hover/notification-note:block z-50 w-80 rounded-lg bg-blue-950/95 px-3 py-2 text-xs leading-relaxed text-white shadow-xl backdrop-blur-sm">
                 给研发：这个通知系统可做可不做；如果做，建议先只提示课件或题目生成完成，后续最多加上周期任务到期提醒。
               </div>
             </div>
             <div className="text-right hidden md:block">
               <p className="text-sm font-semibold text-[#242124]">
                 {role === 'Super Admin' ? 'Admin' :
                  role === 'HQ Trainer' ? 'Sarah Lee' :
                  role === 'Regional Manager' ? 'Budi Santoso' :
                  role === 'Regional Training Manager' ? 'Fitriani' :
                  role === 'Regional Trainer' ? 'Nurul Huda' :
                  'Ahmad Maulana'}
               </p>
               <p className="text-[10px] text-[#9A9396] font-medium tracking-wide">
                 {role === 'Super Admin' ? 'SYSTEM ADMIN' :
                  role === 'HQ Trainer' ? 'HQ TRAINER' :
                  role === 'Regional Manager' ? 'REGIONAL MANAGER' :
                  role === 'Regional Training Manager' ? 'REGIONAL TRAINING MANAGER' :
                  role === 'Regional Trainer' ? 'REGIONAL TRAINER' :
                  'STORE MANAGER'}
               </p>
             </div>
             <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white shadow-sm overflow-hidden flex-shrink-0">
                <div className="w-full h-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-sm">
                 {role === 'Super Admin' ? 'SA' :
                  role === 'HQ Trainer' ? 'SL' :
                  role === 'Regional Manager' ? 'BS' :
                  role === 'Regional Training Manager' ? 'FI' :
                  role === 'Regional Trainer' ? 'NH' :
                  'AM'}
               </div>
             </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="md:hidden border-b border-[#E5DED8] bg-white px-4 py-2">
          <select aria-label="移动端导航" value={activeTab} onChange={event => setActiveTab(event.target.value)} className="w-full min-h-9 rounded-md border border-[#E5DED8] bg-white px-2 text-xs">
            {navItems.flatMap(item => item.subMenu ?? [{ id: item.id, label: item.label }]).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        <main className={`flex-1 overflow-x-hidden overflow-y-auto bg-transparent ${activeTab === 'training_inspection' ? 'p-4 md:p-8' : 'p-8'}`}>
          <div className="max-w-7xl mx-auto h-full space-y-6">
             {children}
          </div>
        </main>
      </div>
    </div>
  );
}
