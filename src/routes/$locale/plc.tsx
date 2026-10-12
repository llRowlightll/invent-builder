import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout för /plc/*: ingången (plc.index) och de åtta stegen för ett projekt
// (plc.$projektId). Se planen "Plan för PLC-modulen".
export const Route = createFileRoute("/$locale/plc")({
  component: () => <Outlet />,
});
