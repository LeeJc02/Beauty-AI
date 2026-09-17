/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { RMDashboard } from './pages/Dashboard';
import { SADashboard } from './pages/SADashboard';
import { HTDashboard } from './pages/HTDashboard';
import { SMDashboard } from './pages/SMDashboard';
import { CourseCreation, CourseTask } from './pages/CourseCreation';
import { CourseManagement } from './pages/CourseManagement';
import { RTCourseManagement } from './pages/RTCourseManagement';
import { BAAvatars } from './pages/BAAvatars';
import { BAScripts } from './pages/BAScripts';
import { RTBAScripts } from './pages/RTBAScripts';
import { BAQuotes } from './pages/BAQuotes';
import { ExamGenerate } from './pages/ExamGenerate';
import { ExamBank } from './pages/ExamBank';
import { ExamHomework } from './pages/ExamHomework';
import { ExamManage } from './pages/ExamManage';
import { ExamTaskManage, INITIAL_EXAM_TASKS, type ExamTask } from './pages/ExamTaskManage';
import { StudyTaskManage, MOCK_STUDY_TASKS } from './pages/StudyTaskManage';
import { PracticeTaskManage, MOCK_PRACTICE_TASKS } from './pages/PracticeTaskManage';
import { TrainingInspection } from './pages/TrainingInspection';
import { getInspectionState, startInspectionScheduler, syncInspectionSource, toMediaInspectionTask } from './lib/inspectionStore';
import { MediaCollectionTaskManage, initialTasks as INITIAL_MEDIA_TASKS } from './pages/MediaCollectionTaskManage';
import { PhotoCheckinRecords } from './pages/PhotoCheckinRecords';
import { MaterialLibrary } from './pages/MaterialLibrary';
import { StoreArchive } from './pages/StoreArchive';
import { PersonnelArchive } from './pages/PersonnelArchive';
import { OrganizationView } from './pages/OrganizationView';
import { UsersManage } from './pages/UsersManage';
import { CategoryManage } from './pages/CategoryManage';
import { NotificationSettings } from './pages/NotificationSettings';
import { KnowledgeGraph } from './pages/KnowledgeGraph';
import { Role } from './types';
import { Loader2, CheckCircle } from 'lucide-react';
import { Progress } from './components/ui/progress';
import { QuestionBankProvider } from './lib/QuestionBankContext';
import type { DefaultExamProfileQuestion, ExamPassRule } from './lib/examPublishSettings';

export default function App() {
  const [role, setRole] = useState<Role>('HQ Trainer');
  // 支持 #页面标识 直接进入指定工作台（例如 #training_inspection 用于协作预览）。
  const [activeTab, setActiveTab] = useState<string>(
    () => window.location.hash.slice(1) || 'dashboard',
  );
  const [materialLibrarySubmissionId, setMaterialLibrarySubmissionId] = useState<string | null>(null);

  // Global Course Generation State
  const [courseTask, setCourseTask] = useState<CourseTask | null>(null);
  const [courseEditorReturnTab, setCourseEditorReturnTab] = useState<string | null>(null);
  const [homeworkCourseTitle, setHomeworkCourseTitle] = useState<string | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [examTasks, setExamTasks] = useState<ExamTask[]>(INITIAL_EXAM_TASKS);

  React.useEffect(() => {
    if (window.location.hash.slice(1) !== activeTab)
      window.history.replaceState(null, '', `#${activeTab}`);
  }, [activeTab]);

  React.useEffect(() => {
    // 每次启动都用当前任务快照做幂等同步；不能只看 sourceSyncedAt，否则不打开原任务页就会读到旧审计数据。
    syncInspectionSource('study', 'study_task_manage', MOCK_STUDY_TASKS);
    syncInspectionSource('practice', 'practice_task_manage', MOCK_PRACTICE_TASKS);
    syncInspectionSource('media', 'media_collection_manage', INITIAL_MEDIA_TASKS.map(toMediaInspectionTask));
    return startInspectionScheduler();
  }, []);
  React.useEffect(() => { syncInspectionSource('exam', 'exam_task_manage', examTasks); }, [examTasks]);

  React.useEffect(() => {
    if (activeTab !== 'exam_homework') {
      setHomeworkCourseTitle(null);
    }
  }, [activeTab]);

  const startGeneration = () => {
    setCourseEditorReturnTab(null);
    setCourseTask({ status: 'generating', progress: 0 });
    let p = 0;
    const interval = setInterval(() => {
      p += 5;
      if (p >= 100) {
        clearInterval(interval);
        setCourseTask({ status: 'done', progress: 100 });
        setShowSuccessBanner(true);
        setTimeout(() => setShowSuccessBanner(false), 5000);
      } else {
        setCourseTask(prev => prev ? { ...prev, progress: p } : null);
      }
    }, 500);
  };

  const openCourseEditor = (courseTitle: string) => {
    setCourseTask({ status: 'done', progress: 100, courseTitle });
    setCourseEditorReturnTab('courses_manage');
    setShowSuccessBanner(false);
    setActiveTab('courses');
  };

  const openCourseHomework = (courseTitle: string) => {
    setHomeworkCourseTitle(courseTitle);
    setShowSuccessBanner(false);
    setActiveTab('exam_homework');
  };

  const openMaterialAsset = React.useCallback((submissionId: string) => {
    setMaterialLibrarySubmissionId(submissionId);
    setActiveTab('material_library');
  }, []);

  const clearMaterialAssetRequest = React.useCallback(() => {
    setMaterialLibrarySubmissionId(null);
  }, []);

  const resetCourseTask = () => {
    setCourseTask(null);
    setCourseEditorReturnTab(null);
  };

  const exitCourseEditor = () => {
    const returnTab = courseEditorReturnTab;
    resetCourseTask();
    if (returnTab) {
      setActiveTab(returnTab);
    }
  };

  const formatPublishTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleExamPublished = (exam: {
    id: string;
    title: string;
    passRules: ExamPassRule[];
    profileQuestions: DefaultExamProfileQuestion[];
    questionCount: number;
  }) => {
    setExamTasks(prev => {
      const taskId = `published-${exam.id}`;
      if (prev.some(task => task.id === taskId)) {
        return prev;
      }

      return [
        {
          id: taskId,
          title: exam.title,
          status: '待开始',
          publishTime: formatPublishTime(new Date()),
          targetCount: 1200,
          submittedCount: 0,
          aiGraded: false,
          passRules: exam.passRules,
          profileQuestions: exam.profileQuestions,
          questionCount: exam.questionCount,
        },
        ...prev,
      ];
    });
  };

  const renderContent = () => {
    if (activeTab === 'training_inspection') {
      return <TrainingInspection role={role} onNavigate={setActiveTab} />;
    }
    if (activeTab === 'dashboard') {
      switch (role) {
        case 'Super Admin':
          return <SADashboard />;
        case 'HQ Trainer':
          return <HTDashboard onNavigate={setActiveTab} />;
        case 'Regional Training Manager':
          return <RMDashboard />;
        case 'Regional Trainer':
          return <RMDashboard />;
        case 'Regional Manager':
          return <RMDashboard />;
        default:
          return <RMDashboard />;
      }
    }
    if (activeTab === 'org' && role === 'Super Admin') {
      return <OrganizationView />;
    }
    if (activeTab === 'users_manage' && role === 'Super Admin') {
      return <UsersManage />;
    }
    if (activeTab === 'category_manage' && role === 'Super Admin') {
      return <CategoryManage />;
    }
    if (activeTab === 'notification_settings' && role === 'Super Admin') {
      return <NotificationSettings />;
    }
    if (activeTab === 'knowledge_graph' && role === 'Super Admin') {
      return <KnowledgeGraph />;
    }
    if (activeTab === 'courses') {
      return (
        <CourseCreation
          courseTask={courseTask}
          startGeneration={startGeneration}
          resetTask={resetCourseTask}
          onExitEditor={courseEditorReturnTab ? exitCourseEditor : undefined}
          onOpenHomework={openCourseHomework}
        />
      );
    }
    if (activeTab === 'courses_manage') {
      if (role === 'Regional Training Manager') {
        return <RTCourseManagement onOpenCourse={openCourseEditor} onOpenHomework={openCourseHomework} />;
      }
      return <CourseManagement onOpenCourse={openCourseEditor} onOpenHomework={openCourseHomework} />;
    }
    if (activeTab === 'ba_avatars') {
      return <BAAvatars />;
    }
    if (activeTab === 'ba_scripts') {
      if (role === 'Regional Training Manager') {
        return <RTBAScripts />;
      }
      return <BAScripts />;
    }
    if (activeTab === 'ba_quotes') {
      return <BAQuotes />;
    }
    if (activeTab === 'material_library') {
      return (
        <MaterialLibrary
          userRole={role}
          requestedSubmissionId={materialLibrarySubmissionId}
          onRequestedAssetOpened={clearMaterialAssetRequest}
        />
      );
    }
    if (activeTab === 'exam_generate') {
      return <ExamGenerate />;
    }
    if (activeTab === 'exam_bank') {
      return <ExamBank />;
    }
    if (activeTab === 'exam_homework') {
      return <ExamHomework selectedCourseTitle={homeworkCourseTitle ?? undefined} />;
    }
    if (activeTab === 'exam_manage') {
      return (
        <ExamManage
          onExamPublished={handleExamPublished}
          onGoToExamTasks={() => setActiveTab('exam_task_manage')}
        />
      );
    }
    if (activeTab === 'exam_task_manage') {
      return (
        <ExamTaskManage
          isReadOnly={role === 'Regional Manager' || role === 'Regional Training Manager' || role === 'Regional Trainer'}
          tasks={examTasks}
          onWithdrawTask={(taskId) => setExamTasks(prev => prev.filter(task => task.id !== taskId))}
        />
      );
    }
    if (activeTab === 'study_task_manage') {
      return <StudyTaskManage isReadOnly={role === 'Regional Manager'} userRole={role} />;
    }
    if (activeTab === 'practice_task_manage') {
      return <PracticeTaskManage isReadOnly={role === 'Regional Manager'} userRole={role} />;
    }
    if (activeTab === 'media_collection_manage') {
      return <MediaCollectionTaskManage userRole={role} onOpenMaterialAsset={openMaterialAsset} />;
    }
    if (activeTab === 'photo_checkin_records') {
      return <React.Fragment key={`photo-checkin-${role}`}><PhotoCheckinRecords userRole={role} /></React.Fragment>;
    }
    if (activeTab === 'store_archive') {
      return <StoreArchive userRole={role} />;
    }
    if (activeTab === 'personnel_archive') {
      return <PersonnelArchive userRole={role} />;
    }

    // Placeholder for other tabs
    return (
      <div className="flex items-center justify-center h-[60vh] border-2 border-dashed border-gray-200 rounded-xl">
        <div className="text-center">
          <h2 className="text-xl font-medium text-gray-700 mb-2">即将上线</h2>
          <p className="text-gray-500">【{activeTab}】模块正在开发中，敬请期待。</p>
        </div>
      </div>
    );
  };

  return (
    <QuestionBankProvider>
      <Layout role={role} setRole={setRole} activeTab={activeTab} setActiveTab={setActiveTab}>
        {renderContent()}
      </Layout>

      {/* Global Course Generation Banner */}
      {(courseTask?.status === 'generating' || showSuccessBanner) && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-5">
          {courseTask?.status === 'generating' ? (
            <div className="bg-[#171518] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-3 w-80 border border-white/10">
              <Loader2 className="h-5 w-5 text-[#8F98FF] font-bold animate-spin shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-bold">AI 课件生成中...</div>
                <div className="text-[10px] text-white/50 mt-0.5">请稍候，您可离开此页面</div>
                <Progress value={courseTask.progress} className="h-1 mt-2 bg-white/[0.12]" indicatorClassName="bg-[#8F98FF]" />
              </div>
            </div>
          ) : showSuccessBanner ? (
            <div className="bg-[#3B8F72] text-white px-4 py-3 rounded-xl shadow-2xl flex items-center justify-between w-80 border border-[#78B29F]">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-5 w-5 shrink-0" />
                <div>
                  <div className="text-sm font-bold">课件生成完成！</div>
                  <div className="text-[10px] text-[#CDE8DD] mt-0.5">您的课件「产品线全景」已就绪</div>
                </div>
              </div>
              <button
                onClick={() => { setActiveTab('courses'); setShowSuccessBanner(false); }}
                className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0"
              >
                去审核
              </button>
            </div>
          ) : null}
        </div>
      )}
    </QuestionBankProvider>
  );
}
