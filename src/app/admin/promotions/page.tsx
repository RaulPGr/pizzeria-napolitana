// src/app/admin/promotions/page.tsx
import PromotionsManager from "@/components/admin/PromotionsManager";

export const dynamic = "force-dynamic";

export default function AdminPromotionsPage() {
  return (
    <div className="space-y-6">
      <PromotionsManager />
    </div>
  );
}
