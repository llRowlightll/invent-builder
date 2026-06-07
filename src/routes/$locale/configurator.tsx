import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout for the /configurator/* section. The actual configurators are the child
// routes: configurator.$family (the cylinder/valve/gripper step wizard) and
// configurator.schema.$schemaId (the electric-axis schema runner). This parent
// only renders the matched child via <Outlet/>; the bare /configurator path is
// handled by configurator.index (redirect to the family picker).
export const Route = createFileRoute("/$locale/configurator")({
  component: () => <Outlet />,
});
