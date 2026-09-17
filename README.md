# yudao-ui-admin-vue3

芋道管理后台前端，基于 Vue3 + Element Plus + TypeScript 构建。

## 技术栈

```
Vue 3.3    / Vite 4.5    / Element Plus 2.4    / TypeScript 5.2
Pinia      / Vue Router 4 / UnoCSS             / vue-i18n
```

## 目录结构

```
src/
├── api/            # 接口层：按业务模块（system/bpm/crm/erp/mall/mp/mes/iot/ai/pay）划分
├── assets/         # 静态资源：图片、SVG、音频
├── components/     # 全局组件：DocAlert、Table、Form、Editor、UploadFile 等 40+ 组件
├── config/         # 配置：axios 实例封装
├── directives/     # 自定义指令：权限指令 v-permi
├── hooks/          # 组合式函数：useTitle、useWatermark、useNProgress 等
├── layout/         # 布局组件：ToolHeader、TagsView、Breadcrumb、UserInfo、Setting、Sidebar
├── locales/        # 国际化资源文件（中/英）
├── plugins/        # 插件：Element Plus、SVG Icon、echarts、vueI18n、UnoCSS
├── router/         # 路由：动态路由（后端权限控制）、静态路由
├── store/          # 状态管理：app、user、permission、tagsView、dict
├── styles/         # 全局样式：variables、mixins、主题
├── types/          # TypeScript 类型定义
├── utils/          # 工具函数：auth、request、dict、permission、download、color
└── views/          # 页面视图：按业务模块划分
```

## 核心模块

| 模块       | 路径                 | 说明                   |
|----------|--------------------|----------------------|
| system   | src/views/system/  | 系统管理：用户、角色、菜单、部门、字典等 |
| infra    | src/views/infra/   | 基础设施：代码生成、定时任务、配置管理  |
| bpm      | src/views/bpm/     | 工作流：Flowable 流程引擎    |
| crm      | src/views/crm/     | 客户关系管理               |
| erp      | src/views/erp/     | 企业资源计划               |
| mall     | src/views/mall/    | 商城系统                 |
| mp       | src/views/mp/      | 微信公众号管理              |
| member   | src/views/member/  | 会员中心                 |
| mes      | src/views/mes/     | 制造执行系统               |
| iot      | src/views/iot/     | 物联网                  |
| ai       | src/views/ai/      | AI 大模型：聊天、绘画、知识库     |
| pay      | src/views/pay/     | 支付系统：支付宝、微信          |
| report   | src/views/report/  | 报表与大屏设计器（积木报表/GoView） |

## 环境变量

| 变量                       | 说明          | 默认值     |
|--------------------------|-------------|---------|
| `VITE_BASE_URL`          | 后端 API 地址   | -       |
| `VITE_API_URL`           | 接口前缀        | /admin-api |
| `VITE_APP_TITLE`         | 系统标题        | -       |
| `VITE_APP_CAPTCHA_ENABLE`| 验证码开关       | true    |
| `VITE_APP_DOCALERT_ENABLE`| 文档提示条开关     | true    |
| `VITE_APP_TENANT_ENABLE` | 多租户开关       | false   |

## 快速启动

```bash
# 安装依赖（强制使用 pnpm）
pnpm install

# 本地开发（加载 .env.local）
pnpm dev

# 指定环境启动
pnpm dev-server    # 开发环境
pnpm build:prod    # 生产构建
```

## 关键组件

- **DocAlert** — 页面顶部文档提示条，通过 `VITE_APP_DOCALERT_ENABLE=false` 关闭
- **ContentWrap** — 内容区包裹容器
- **Table** — 二次封装的表格组件，集成分页、搜索、导出
- **Form** — 动态表单组件
- **Editor** — 富文本编辑器（WangEditor）
- **UploadFile** — 文件上传组件，支持 S3/本地/FTP 多后端
- **IFrame** — 内嵌外部页面

## 相关链接

- 后端项目：<https://gitee.com/zhijiantianya/ruoyi-vue-pro>
- 文档：<https://doc.iocoder.cn>
- 演示：<http://dashboard-vue3.yudao.iocoder.cn>
