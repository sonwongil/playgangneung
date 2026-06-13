import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";

const DashboardPage    = lazy(() => import("./pages/DashboardPage"));
const InboxPage        = lazy(() => import("./pages/InboxPage"));
const NoteListPage     = lazy(() => import("./pages/NoteListPage"));
const NoteEditPage     = lazy(() => import("./pages/NoteEditPage"));
const TodayPage        = lazy(() => import("./pages/TodayPage"));
const SnsPage          = lazy(() => import("./pages/SnsPage"));
const AdListPage       = lazy(() => import("./pages/AdListPage"));
const PerformancePage  = lazy(() => import("./pages/PerformancePage"));
const BusinessPage     = lazy(() => import("./pages/BusinessPage"));
const HomeDisplayPage  = lazy(() => import("./pages/HomeDisplayPage"));
const SettingsPage     = lazy(() => import("./pages/SettingsPage"));

function V2Loader() {
  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
      <span className="w-5 h-5 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin mr-2" />
      로딩 중...
    </div>
  );
}

export default function AdminV2Router() {
  return (
    <Suspense fallback={<V2Loader />}>
      <Switch>
        <Route path="/admin/v2"               component={DashboardPage} />
        <Route path="/admin/v2/inbox"         component={InboxPage} />
        <Route path="/admin/v2/notes"         component={NoteListPage} />
        <Route path="/admin/v2/notes/:id"     component={NoteEditPage} />
        <Route path="/admin/v2/today"         component={TodayPage} />
        <Route path="/admin/v2/sns"           component={SnsPage} />
        <Route path="/admin/v2/ads"           component={AdListPage} />
        <Route path="/admin/v2/ads/:id"       component={AdListPage} />
        <Route path="/admin/v2/performance"   component={PerformancePage} />
        <Route path="/admin/v2/business"      component={BusinessPage} />
        <Route path="/admin/v2/home-display"  component={HomeDisplayPage} />
        <Route path="/admin/v2/settings"      component={SettingsPage} />
      </Switch>
    </Suspense>
  );
}
