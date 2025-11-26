// src/app/admin/orders/page.tsx
import OrdersClient from "./OrdersClient";

export const dynamic = "force-dynamic";

export default function AdminOrdersPage() {
  // El layout de /admin ya renderiza el título y las pestañas.
  // Aquí solo montamos el cliente de pedidos.
  return <OrdersClient />;
}
