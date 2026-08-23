import React, { useState } from 'react';

interface ProductoOFF {
  code: string;
  product_name: string;
  brands?: string;
  nutriments: {
    'energy-kcal_100g'?: number;
    sugars_100g?: number;
    salt_100g?: number;
  };
}

export default function PruebaBuscador() {
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<ProductoOFF[]>([]);
  const [cargando, setCargando] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<ProductoOFF | null>(null);

  async function buscarProducto(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setCargando(true);
    try {
      // Petición directa a la API de Open Food Facts filtrada para España
      const res = await fetch(
        `https://es.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
          query
        )}&search_simple=1&action=process&json=1&page_size=5`
      );
      const data = await res.json();
      setResultados(data.products || []);
    } catch (error) {
      console.error('Error buscando producto:', error);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>🔍 Prueba de Buscador de Supermercado</h2>

      <form onSubmit={buscarProducto} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej: Leche entera Mercadona, Atún Hacendado..."
          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}
        />
        <button
          type="submit"
          disabled={cargando}
          style={{ backgroundColor: '#4F46E5', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer' }}
        >
          {cargando ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {/* RESULTADOS DE BÚSQUEDA */}
      {resultados.length > 0 && (
        <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '10px', marginBottom: '16px' }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>Selecciona un producto:</strong>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {resultados.map((prod) => (
              <li
                key={prod.code}
                onClick={() => setProductoSeleccionado(prod)}
                style={{
                  padding: '8px',
                  borderBottom: '1px solid #eee',
                  cursor: 'pointer',
                  backgroundColor: productoSeleccionado?.code === prod.code ? '#EEF2FF' : 'transparent'
                }}
              >
                <strong>{prod.product_name || 'Sin nombre'}</strong>
                {prod.brands && <span style={{ fontSize: '12px', color: '#666' }}> ({prod.brands})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* VALORES AUTORELLENADOS */}
      {productoSeleccionado && (
        <div style={{ backgroundColor: '#F3F4F6', padding: '12px', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '15px' }}>✅ Datos Autorellenados:</h3>
          <p style={{ margin: '4px 0' }}><strong>Producto:</strong> {productoSeleccionado.product_name}</p>
          <p style={{ margin: '4px 0' }}><strong>🔥 Calorías:</strong> {productoSeleccionado.nutriments['energy-kcal_100g'] ?? 0} kcal / 100g</p>
          <p style={{ margin: '4px 0' }}><strong>🍯 Azúcar:</strong> {productoSeleccionado.nutriments.sugars_100g ?? 0} g / 100g</p>
          <p style={{ margin: '4px 0' }}><strong>🧂 Sal:</strong> {productoSeleccionado.nutriments.salt_100g ?? 0} g / 100g</p>
        </div>
      )}
    </div>
  );
}