export interface ExamParticipantRole {
  id: string;
  name: string;
}

export interface ExamPassRule {
  id: string;
  roleId: string;
  roleName: string;
  score: number;
}

export interface DefaultExamProfileQuestion {
  id: string;
  stem: string;
  placeholder: string;
  answerField: 'positionName' | 'storeChannel';
}

export const EXAM_PARTICIPANT_ROLES: ExamParticipantRole[] = [
  { id: 'junior-ba', name: '初级 BA' },
  { id: 'senior-ba', name: '高级 BA' },
  { id: 'store-manager', name: '店长' },
  { id: 'regional-manager', name: '区域经理' },
  { id: 'regional-trainer', name: '区域培训师' },
  { id: 'regional-training-manager', name: '区域培训师主管' },
];

export const EXAM_PASS_SCORE_OPTIONS = Array.from({ length: 9 }, (_, index) => 60 + index * 5);

export const DEFAULT_EXAM_PASS_RULES: ExamPassRule[] = [
  {
    id: 'pass-rule-junior-ba',
    roleId: 'junior-ba',
    roleName: '初级 BA',
    score: 80,
  },
];

export const DEFAULT_EXAM_PROFILE_QUESTIONS: DefaultExamProfileQuestion[] = [
  {
    id: 'default-position-name',
    stem: '请填写你的职位名称',
    placeholder: '例如：BA、店长、区域培训师',
    answerField: 'positionName',
  },
  {
    id: 'default-store-channel',
    stem: '请填写你的门店渠道',
    placeholder: '例如：百货、商超、CS、线上渠道',
    answerField: 'storeChannel',
  },
];

export function getExamParticipantRoleName(roleId: string) {
  return EXAM_PARTICIPANT_ROLES.find(role => role.id === roleId)?.name || roleId;
}
