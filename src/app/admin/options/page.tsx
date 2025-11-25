import OptionGroupsManager from "@/components/admin/OptionGroupsManager";

export const dynamic = "force-dynamic";

export default function AdminOptionsPage() {
  return (
    <div className="space-y-6">
      <OptionGroupsManager />
    </div>
  );
}
