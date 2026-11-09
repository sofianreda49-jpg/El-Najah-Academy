import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'

import { useAuth } from './auth/AuthContext.jsx'
import Splash from './components/Splash.jsx'
import AppLayout from './layouts/AppLayout.jsx'
import Login from './pages/Login.jsx'

// تحميل الصفحات عند الحاجة بس (بيصغّر حجم أول تحميل)
const Register = lazy(() => import('./pages/Register.jsx'))
const ChangePassword = lazy(() => import('./pages/ChangePassword.jsx'))
const Profile = lazy(() => import('./pages/Profile.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Users = lazy(() => import('./pages/Users.jsx'))
const Requests = lazy(() => import('./pages/Requests.jsx'))
const Audit = lazy(() => import('./pages/Audit.jsx'))
const Academy = lazy(() => import('./pages/Academy.jsx'))
const CourseBuilder = lazy(() => import('./pages/academy/CourseBuilder.jsx'))
const AssessmentBuilder = lazy(() => import('./pages/academy/AssessmentBuilder.jsx'))
const StudentHome = lazy(() => import('./pages/student/StudentHome.jsx'))
const CoursePage = lazy(() => import('./pages/student/CoursePage.jsx'))
const LessonPage = lazy(() => import('./pages/student/LessonPage.jsx'))
const AssessmentIntro = lazy(() => import('./pages/student/AssessmentIntro.jsx'))
const AttemptPage = lazy(() => import('./pages/student/AttemptPage.jsx'))
const ResultsPage = lazy(() => import('./pages/student/ResultsPage.jsx'))
const ParentHome = lazy(() => import('./pages/parent/ParentHome.jsx'))
const ChildPage = lazy(() => import('./pages/parent/ChildPage.jsx'))
const TeacherHome = lazy(() => import('./pages/teacher/TeacherHome.jsx'))
const TeacherCoursePage = lazy(() => import('./pages/teacher/TeacherCoursePage.jsx'))
const TeacherResults = lazy(() => import('./pages/teacher/TeacherResults.jsx'))

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return children
}

function RequireRole({ roles, children }) {
  const { user } = useAuth()
  return roles.includes(user.role) ? children : <Navigate to="/" replace />
}

// الرئيسية بتختلف حسب الدور
function Home() {
  const { user } = useAuth()
  if (user.role === 'student') return <StudentHome />
  if (user.role === 'parent') return <ParentHome />
  if (user.role === 'teacher') return <TeacherHome />
  return <Dashboard />
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (user) return <Navigate to="/" replace />
  return children
}

const STAFF = ['super_admin', 'admin']
const OWNER = ['super_admin']
const STUDENT = ['student']
const PARENT = ['parent']
const TEACHER = ['teacher']
const EDITORS = ['super_admin', 'admin', 'teacher'] // بيدّيروا المحتوى (المعلم: كورساته بس)

export default function App() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
        <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
          <Route index element={<Home />} />
          <Route path="profile" element={<Profile />} />
          <Route path="users" element={<RequireRole roles={STAFF}><Users /></RequireRole>} />
          <Route path="requests" element={<RequireRole roles={STAFF}><Requests /></RequireRole>} />
          <Route path="audit" element={<RequireRole roles={OWNER}><Audit /></RequireRole>} />
          <Route path="academy" element={<RequireRole roles={EDITORS}><Academy /></RequireRole>} />
          <Route path="academy/courses/:courseId" element={<RequireRole roles={EDITORS}><CourseBuilder /></RequireRole>} />
          <Route path="academy/assessments/:assessmentId" element={<RequireRole roles={EDITORS}><AssessmentBuilder /></RequireRole>} />
          <Route path="learn/courses/:courseId" element={<RequireRole roles={STUDENT}><CoursePage /></RequireRole>} />
          <Route path="learn/lessons/:lessonId" element={<RequireRole roles={STUDENT}><LessonPage /></RequireRole>} />
          <Route path="learn/assessments/:assessmentId" element={<RequireRole roles={STUDENT}><AssessmentIntro /></RequireRole>} />
          <Route path="learn/attempts/:attemptId" element={<RequireRole roles={STUDENT}><AttemptPage /></RequireRole>} />
          <Route path="results" element={<RequireRole roles={STUDENT}><ResultsPage /></RequireRole>} />
          <Route path="children/:studentId" element={<RequireRole roles={PARENT}><ChildPage /></RequireRole>} />
          <Route path="teaching/courses/:courseId" element={<RequireRole roles={TEACHER}><TeacherCoursePage /></RequireRole>} />
          <Route path="teaching/assessments/:assessmentId" element={<RequireRole roles={TEACHER}><TeacherResults /></RequireRole>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
