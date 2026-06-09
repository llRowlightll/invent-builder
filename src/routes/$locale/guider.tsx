import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout for the /guider/* section (buying guides). Children: guider.index (the
// list) and guider.$slug (an individual guide). This parent only renders the
// matched child via <Outlet/>.
export const Route = createFileRoute("/$locale/guider")({
  component: () => <Outlet />,
});
