// src/app/admin/orders/OrdersView.tsx
import React from 'react';
import OrdersClient from './OrdersClient';

export default async function OrdersView() {
  // Aquí podrías hacer prerender si quisieras, pero preferimos que sea 100% cliente
  // para refrescar y gestionar estados sin fricciones.
  return <OrdersClient />;
}
