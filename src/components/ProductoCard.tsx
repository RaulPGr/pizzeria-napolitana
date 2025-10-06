// /src/components/ProductoCard.tsx
type ProductoProps = {
  nombre: string;
  precio: number;
  descripcion: string;
  imagen: string;
  stock?: number; // 0 = agotado (opcional para compatibilidad)
};

export default function ProductoCard({
  nombre,
  precio,
  descripcion,
  imagen,
  stock = 1,
}: ProductoProps) {
  const agotado = stock === 0;

  return (
    <div className="bg-white shadow-md rounded-xl p-4 w-full max-w-sm relative overflow-hidden">
      <div className="relative">
        <img src={imagen} alt={nombre} className="w-full h-40 object-cover rounded-md mb-4" />
        {agotado && (
          <span className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded">
            AGOTADO
          </span>
        )}
      </div>
      <h2 className="text-xl font-bold text-gray-800">{nombre}</h2>
      <p className="text-gray-600">{descripcion}</p>
      <p className="text-blue-600 font-semibold mt-2">{precio.toFixed(2)} €</p>
    </div>
  );
}
