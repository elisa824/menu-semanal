import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

interface ItemCompra {
  nombre: string;
  cantidadTotal: number | null;
  unidad: string;
  comprado: boolean;
  enCasa: boolean;
}

interface DiaMenu {
  dia: string;
  comensales: number;
  esUnico: boolean;
  primero: any | null;
  segundo: any | null;
  platoUnico: any | null;
  cena: any | null;
}

export default function App() {
  const [recetas, setRecetas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [menuSemanal, setMenuSemanal] = useState<DiaMenu[]>([]);
  
  // Lista de la compra
  const [listaCompra, setListaCompra] = useState<ItemCompra[]>([]);
  const [cargandoCompra, setCargandoCompra] = useState(false);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [listaMinimizada, setListaMinimizada] = useState(false);

  // Visor de receta
  const [recetaSeleccionada, setRecetaSeleccionada] = useState<any | null>(null);
  const [ingredientesReceta, setIngredientesReceta] = useState<any[]>([]);
  const [cargandoIngredientesReceta, setCargandoIngredientesReceta] = useState(false);

  // Formulario nueva receta
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('primero');
  const [nuevosPasos, setNuevosPasos] = useState('');
  const [nuevosIngredientes, setNuevosIngredientes] = useState('');
  const [guardandoReceta, setGuardandoReceta] = useState(false);

  const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    obtenerRecetas();
  }, []);

  async function obtenerRecetas() {
    setCargando(true);
    try {
      const { data, error } = await supabase.from('recetas').select('*');
      if (error) {
        console.error('Error Supabase:', error);
      } else if (data && data.length > 0) {
        setRecetas(data);
        generarMenuEstructurado(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  function norm(str: any) {
    if (!str || typeof str !== 'string') return '';
    return str.toLowerCase().replace(/_/g, ' ').trim();
  }

  function generarMenuEstructurado(lista: any[]) {
    if (!lista || lista.length === 0) return;

    const usadosEnLaSemana = new Set<number>();

    const primeros = lista.filter(r => norm(r.categoria) === 'primero' || norm(r.categoria) === 'primeros');
    const segundos = lista.filter(r => norm(r.categoria) === 'segundo' || norm(r.categoria) === 'segundos');
    const platosUnicos = lista.filter(r => norm(r.categoria).includes('unico'));
    const cenas = lista.filter(r => norm(r.categoria) === 'cena' || norm(r.categoria) === 'cenas');

    const tomarSinRepetir = (grupo: any[]) => {
      const pool = grupo.length > 0 ? grupo : lista;
      const disponibles = pool.filter(r => !usadosEnLaSemana.has(r.id));

      let seleccion = null;
      if (disponibles.length > 0) {
        seleccion = disponibles[Math.floor(Math.random() * disponibles.length)];
      } else {
        const fallbackDisponibles = lista.filter(r => !usadosEnLaSemana.has(r.id));
        if (fallbackDisponibles.length > 0) {
          seleccion = fallbackDisponibles[Math.floor(Math.random() * fallbackDisponibles.length)];
        } else {
          seleccion = pool[Math.floor(Math.random() * pool.length)];
        }
      }

      if (seleccion) usadosEnLaSemana.add(seleccion.id);
      return seleccion;
    };

    const nuevoMenu: DiaMenu[] = DIAS_SEMANA.map(dia => {
      const hayUnicosDisponibles = platosUnicos.some(r => !usadosEnLaSemana.has(r.id));
      const esUnico = hayUnicosDisponibles && Math.random() < 0.5;

      let primero = null;
      let segundo = null;
      let platoUnico = null;

      if (esUnico) {
        platoUnico = tomarSinRepetir(platosUnicos);
      } else {
        primero = tomarSinRepetir(primeros);
        segundo = tomarSinRepetir(segundos);
      }

      const cena = tomarSinRepetir(cenas);

      return {
        dia,
        comensales: 1,
        esUnico,
        primero,
        segundo,
        platoUnico,
        cena
      };
    });

    setMenuSemanal(nuevoMenu);
    setMostrarLista(false);
    cerrarDetalles();
  }

  function cambiarComensales(indexDia: number, cantidad: number) {
    const num = Math.max(1, cantidad);
    setMenuSemanal(prev => prev.map((dia, idx) => idx === indexDia ? { ...dia, comensales: num } : dia));
  }

  async function crearNuevaReceta(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;

    setGuardandoReceta(true);
    try {
      const { data: recetaData, error: recetaError } = await supabase
        .from('recetas')
        .insert([{ nombre: nuevoNombre.trim(), categoria: nuevaCategoria, pasos: nuevosPasos.trim() }])
        .select()
        .single();

      if (recetaError) throw recetaError;

      if (nuevosIngredientes.trim() && recetaData) {
        const listaIngs = nuevosIngredientes
          .split(',')
          .map(i => i.trim().toLowerCase())
          .filter(Boolean);

        for (const ingNombre of listaIngs) {
          let { data: ingExistente } = await supabase
            .from('ingredientes')
            .select('id')
            .eq('nombre', ingNombre)
            .maybeSingle();

          let ingId = ingExistente?.id;

          if (!ingId) {
            const { data: nuevoIng, error: ingError } = await supabase
              .from('ingredientes')
              .insert([{ nombre: ingNombre }])
              .select()
              .single();

            if (!ingError && nuevoIng) {
              ingId = nuevoIng.id;
            }
          }

          if (ingId) {
            await supabase
              .from('recetas_ingredientes')
              .insert([{ recetas_id: recetaData.id, ingredientes_id: ingId }]);
          }
        }
      }

      setNuevoNombre('');
      setNuevaCategoria('primero');
      setNuevosPasos('');
      setNuevosIngredientes('');
      setMostrarFormulario(false);
      
      await obtenerRecetas();
    } catch (err) {
      console.error('Error al guardar receta:', err);
    } finally {
      setGuardandoReceta(false);
    }
  }

  // Extrae número y texto de cadenas como "150g", "250 ml", "2"
  function parsearTextoCantidad(val: any) {
    if (val === null || val === undefined) return { num: null, unidad: '' };
    if (typeof val === 'number') return { num: val, unidad: '' };

    const str = String(val).trim();
    if (!str) return { num: null, unidad: '' };

    // Buscar la parte numérica inicial
    const numPart = parseFloat(str.replace(',', '.'));
    if (!isNaN(numPart)) {
      // Extraer la unidad quitando el número inicial
      const unidadPart = str.replace(/^[\d\.,\s]+/, '').trim();
      return { num: numPart, unidad: unidadPart };
    }

    return { num: null, unidad: str };
  }

  async function generarListaCompra() {
    setCargandoCompra(true);
    setMostrarLista(true);
    setListaMinimizada(false);

    const recetaComensalesMap: { [recetaId: number]: number[] } = {};

    menuSemanal.forEach(item => {
      const numComensales = item.comensales || 1;
      const idsDelDia: number[] = [];

      if (item.esUnico && item.platoUnico) idsDelDia.push(item.platoUnico.id);
      if (!item.esUnico) {
        if (item.primero) idsDelDia.push(item.primero.id);
        if (item.segundo) idsDelDia.push(item.segundo.id);
      }
      if (item.cena) idsDelDia.push(item.cena.id);

      idsDelDia.forEach(id => {
        if (!recetaComensalesMap[id]) recetaComensalesMap[id] = [];
        recetaComensalesMap[id].push(numComensales);
      });
    });

    const idsRecetas = Object.keys(recetaComensalesMap).map(Number);

    if (idsRecetas.length === 0) {
      setCargandoCompra(false);
      return;
    }

    try {
      const { data: relData, error: relError } = await supabase
        .from('recetas_ingredientes')
        .select('recetas_id, ingredientes_id, cantidad')
        .in('recetas_id', idsRecetas);

      if (relError) throw relError;

      const idsIngredientes = Array.from(
        new Set((relData || []).map((r: any) => r.ingredientes_id).filter(Boolean))
      );

      if (idsIngredientes.length === 0) {
        setListaCompra([]);
        setCargandoCompra(false);
        return;
      }

      const { data: ingData, error: ingError } = await supabase
        .from('ingredientes')
        .select('id, nombre')
        .in('id', idsIngredientes);

      if (ingError) throw ingError;

      const ingMap: { [id: number]: string } = {};
      (ingData || []).forEach(i => { ingMap[i.id] = i.nombre; });

      const acumulador: { [nombreIng: string]: { cantidadNum: number; unidad: string; textoLibre: string } } = {};

      (relData || []).forEach((rel: any) => {
        const nombreIng = ingMap[rel.ingredientes_id];
        if (!nombreIng) return;

        const listaComensales = recetaComensalesMap[rel.recetas_id] || [1];
        const { num, unidad } = parsearTextoCantidad(rel.cantidad);

        listaComensales.forEach(comensales => {
          if (!acumulador[nombreIng]) {
            acumulador[nombreIng] = { cantidadNum: 0, unidad: unidad || '', textoLibre: '' };
          }

          if (num !== null) {
            acumulador[nombreIng].cantidadNum += num * comensales;
            if (unidad && !acumulador[nombreIng].unidad) {
              acumulador[nombreIng].unidad = unidad;
            }
          } else {
            acumulador[nombreIng].textoLibre = rel.cantidad ? String(rel.cantidad) : '';
          }
        });
      });

      const resultado: ItemCompra[] = Object.keys(acumulador).sort().map(nombre => {
        const datos = acumulador[nombre];
        return {
          nombre,
          cantidadTotal: datos.cantidadNum > 0 ? datos.cantidadNum : null,
          unidad: datos.unidad || datos.textoLibre,
          comprado: false,
          enCasa: false
        };
      });

      setListaCompra(resultado);

    } catch (e) {
      console.error('Error al generar lista de compra:', e);
    } finally {
      setCargandoCompra(false);
    }
  }

  function toggleComprado(index: number) {
    setListaCompra(prev => prev.map((item, i) => i === index ? { ...item, comprado: !item.comprado, enCasa: false } : item));
  }

  function toggleEnCasa(index: number) {
    setListaCompra(prev => prev.map((item, i) => i === index ? { ...item, enCasa: !item.enCasa, comprado: false } : item));
  }

  async function verDetalleReceta(receta: any) {
    if (!receta) return;
    setRecetaSeleccionada(receta);
    setIngredientesReceta([]);
    setCargandoIngredientesReceta(true);

    try {
      const { data: relData, error: relError } = await supabase
        .from('recetas_ingredientes')
        .select('ingredientes_id, cantidad')
        .eq('recetas_id', receta.id);

      if (relError) throw relError;

      const idsIngredientes = (relData || []).map((r: any) => r.ingredientes_id).filter(Boolean);

      if (idsIngredientes.length > 0) {
        const { data: ingData, error: ingError } = await supabase
          .from('ingredientes')
          .select('id, nombre')
          .in('id', idsIngredientes);

        if (ingError) throw ingError;

        const mapNombres: { [id: number]: string } = {};
        (ingData || []).forEach(i => { mapNombres[i.id] = i.nombre; });

        const listaDetallada = (relData || []).map((rel: any) => ({
          nombre: mapNombres[rel.ingredientes_id] || 'Ingrediente',
          cantidad: rel.cantidad
        }));

        setIngredientesReceta(listaDetallada);
      }
    } catch (e) {
      console.error('Error al cargar ingredientes de la receta:', e);
    } finally {
      setCargandoIngredientesReceta(false);
    }
  }

  function cerrarDetalles() {
    setRecetaSeleccionada(null);
    setIngredientesReceta([]);
  }

  const totalmenteResueltos = listaCompra.filter(i => i.comprado || i.enCasa).length;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '650px', margin: '0 auto', color: '#333' }}>
      
      {/* Cabecera Principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 style={{ margin: 0, fontSize: '22px' }}>📅 Menú Semanal</h1>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setMostrarFormulario(!mostrarFormulario)}
            style={{
              backgroundColor: '#8B5CF6',
              color: '#fff',
              border: 'none',
              padding: '9px 12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            ➕ Añadir Receta
          </button>

          <button
            onClick={() => {
              if (recetas.length > 0) generarMenuEstructurado(recetas);
              else obtenerRecetas();
            }}
            disabled={cargando}
            style={{
              backgroundColor: '#4F46E5',
              color: '#fff',
              border: 'none',
              padding: '9px 12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            🎲 Regenerar
          </button>

          <button
            onClick={generarListaCompra}
            disabled={cargando || menuSemanal.length === 0}
            style={{
              backgroundColor: '#10B981',
              color: '#fff',
              border: 'none',
              padding: '9px 12px',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            🛒 Lista Compra
          </button>
        </div>
      </div>

      {/* Formulario para añadir nueva receta */}
      {mostrarFormulario && (
        <form onSubmit={crearNuevaReceta} style={{ border: '2px solid #8B5CF6', borderRadius: '10px', padding: '16px', backgroundColor: '#F5F3FF', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '17px', color: '#5B21B6' }}>➕ Añadir Nueva Receta</h2>
            <button
              type="button"
              onClick={() => setMostrarFormulario(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#5B21B6' }}
            >
              ✖
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#4C1D95' }}>Nombre de la receta:*</label>
              <input
                type="text"
                required
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                placeholder="Ej: Tortilla de patatas"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #DDD6FE', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#4C1D95' }}>Categoría:*</label>
              <select
                value={nuevaCategoria}
                onChange={e => setNuevaCategoria(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #DDD6FE', backgroundColor: '#fff' }}
              >
                <option value="primero">Primero</option>
                <option value="segundo">Segundo</option>
                <option value="plato unico">Plato Único</option>
                <option value="cena">Cena</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#4C1D95' }}>Ingredientes (separados por comas):</label>
              <input
                type="text"
                value={nuevosIngredientes}
                onChange={e => setNuevosIngredientes(e.target.value)}
                placeholder="Ej: patatas, huevos, cebolla, aceite, sal"
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #DDD6FE', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#4C1D95' }}>Pasos de preparación:</label>
              <textarea
                rows={3}
                value={nuevosPasos}
                onChange={e => setNuevosPasos(e.target.value)}
                placeholder="Escribe la preparación o los pasos..."
                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #DDD6FE', boxSizing: 'border-box', fontFamily: 'sans-serif' }}
              />
            </div>

            <button
              type="submit"
              disabled={guardandoReceta}
              style={{
                backgroundColor: '#7C3AED',
                color: '#fff',
                border: 'none',
                padding: '10px',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginTop: '4px'
              }}
            >
              {guardandoReceta ? 'Guardando...' : '💾 Guardar Receta'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de la compra interactiva */}
      {mostrarLista && (
        <div style={{ border: '2px solid #10B981', borderRadius: '10px', padding: '14px 16px', backgroundColor: '#ECFDF5', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '17px', color: '#065F46' }}>
              🛒 Lista de la Compra ({totalmenteResueltos}/{listaCompra.length} resueltos)
            </h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => setListaMinimizada(!listaMinimizada)}
                style={{ background: '#A7F3D0', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#064E3B', fontWeight: 'bold' }}
              >
                {listaMinimizada ? '🔽 Mostrar' : '🔼 Minimizar'}
              </button>
              <button
                onClick={() => setMostrarLista(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#047857' }}
              >
                ✖
              </button>
            </div>
          </div>

          {!listaMinimizada && (
            <div style={{ marginTop: '12px' }}>
              {cargandoCompra ? (
                <p style={{ margin: 0, color: '#047857' }}>Calculando cantidades según comensales...</p>
              ) : listaCompra.length === 0 ? (
                <p style={{ margin: 0, color: '#047857' }}>No se encontraron ingredientes para las recetas de esta semana.</p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {listaCompra.map((item, idx) => (
                    <li key={idx} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D1FAE5' }}>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <input
                          type="checkbox"
                          checked={item.comprado}
                          onChange={() => toggleComprado(idx)}
                          style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#10B981' }}
                        />
                        <span style={{
                          textDecoration: (item.comprado || item.enCasa) ? 'line-through' : 'none',
                          color: item.comprado ? '#10B981' : item.enCasa ? '#6B7280' : '#064E3B',
                          fontWeight: item.enCasa ? 'normal' : '500',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.nombre}
                          {item.cantidadTotal !== null && (
                            <strong style={{ marginLeft: '4px', color: '#047857' }}>
                              ({item.cantidadTotal})
                            </strong>
                          )}
                          {item.unidad && <span style={{ fontSize: '11px', color: '#059669', marginLeft: '3px' }}>{item.unidad}</span>}
                          {item.enCasa && ' (en casa)'}
                        </span>
                      </div>

                      <button
                        onClick={() => toggleEnCasa(idx)}
                        title={item.enCasa ? 'Quitar de "en casa"' : 'Marcar como que ya lo tengo en casa'}
                        style={{
                          background: item.enCasa ? '#E5E7EB' : '#F3F4F6',
                          border: '1px solid #D1D5DB',
                          borderRadius: '4px',
                          padding: '2px 5px',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        🏠
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Visor de Receta Seleccionada */}
      {recetaSeleccionada && (
        <div style={{ border: '2px solid #4F46E5', borderRadius: '10px', padding: '16px', backgroundColor: '#EEF2FF', marginBottom: '20px', position: 'relative' }}>
          <button
            onClick={cerrarDetalles}
            style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#4F46E5', fontWeight: 'bold' }}
          >
            ✖
          </button>
          
          <h2 style={{ margin: '0 28px 4px 0', fontSize: '18px', color: '#312E81' }}>
            📖 {recetaSeleccionada.nombre}
          </h2>
          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#4338CA', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Categoría: {recetaSeleccionada.categoria || 'Sin especificación'}
          </p>

          <div style={{ marginBottom: '12px' }}>
            <strong style={{ fontSize: '14px', color: '#1E1B4B' }}>🥕 Ingredientes (base por persona):</strong>
            {cargandoIngredientesReceta ? (
              <p style={{ margin: '2px 0', fontSize: '13px', color: '#6366F1' }}>Cargando ingredientes...</p>
            ) : ingredientesReceta.length === 0 ? (
              <p style={{ margin: '2px 0', fontSize: '13px', color: '#6B7280' }}>Sin ingredientes asignados.</p>
            ) : (
              <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px', fontSize: '13px', color: '#374151' }}>
                {ingredientesReceta.map((ing, i) => (
                  <li key={i}>
                    {ing.nombre} {ing.cantidad ? `- ${ing.cantidad}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ fontSize: '14px', color: '#1E1B4B', lineHeight: '1.5' }}>
            <strong>📝 Pasos de preparación:</strong>
            <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-line', color: '#374151', fontSize: '13px' }}>
              {recetaSeleccionada.pasos || 'No se han añadido pasos para esta receta.'}
            </p>
          </div>
        </div>
      )}

      {/* Menú Semanal con selector de comensales */}
      {cargando ? (
        <p>Cargando recetas desde Supabase...</p>
      ) : menuSemanal.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <p>Cargando datos...</p>
          <button 
            onClick={obtenerRecetas}
            style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer' }}
          >
            🔄 Forzar carga
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {menuSemanal.map((item, indexDia) => (
            <div key={item.dia} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', backgroundColor: '#fff' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#1f2937' }}>
                  {item.dia}
                </h3>

                {/* Selector de comensales */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: '20px' }}>
                  <span style={{ fontSize: '12px', color: '#4B5563', fontWeight: 'bold' }}>👤 Comensales:</span>
                  <button
                    onClick={() => cambiarComensales(indexDia, item.comensales - 1)}
                    style={{ border: 'none', background: '#E5E7EB', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '14px', textAlign: 'center' }}>{item.comensales}</span>
                  <button
                    onClick={() => cambiarComensales(indexDia, item.comensales + 1)}
                    style={{ border: 'none', background: '#E5E7EB', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                
                {/* Comida */}
                <div style={{ backgroundColor: '#f9fafb', padding: '10px', borderRadius: '6px' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>☀️ Comida</h4>
                  {item.esUnico ? (
                    <p 
                      onClick={() => item.platoUnico && verDetalleReceta(item.platoUnico)}
                      style={{ margin: '2px 0', fontSize: '13px', cursor: item.platoUnico ? 'pointer' : 'default', textDecoration: item.platoUnico ? 'underline' : 'none', color: item.platoUnico ? '#4F46E5' : '#333' }}
                    >
                      🍲 <strong>Plato Único:</strong> {item.platoUnico?.nombre || 'Sin asignar'}
                    </p>
                  ) : (
                    <>
                      <p 
                        onClick={() => item.primero && verDetalleReceta(item.primero)}
                        style={{ margin: '2px 0', fontSize: '13px', cursor: item.primero ? 'pointer' : 'default', textDecoration: item.primero ? 'underline' : 'none', color: item.primero ? '#4F46E5' : '#333' }}
                      >
                        <strong>1.º:</strong> {item.primero?.nombre || 'Sin asignar'}
                      </p>
                      <p 
                        onClick={() => item.segundo && verDetalleReceta(item.segundo)}
                        style={{ margin: '2px 0', fontSize: '13px', cursor: item.segundo ? 'pointer' : 'default', textDecoration: item.segundo ? 'underline' : 'none', color: item.segundo ? '#4F46E5' : '#333' }}
                      >
                        <strong>2.º:</strong> {item.segundo?.nombre || 'Sin asignar'}
                      </p>
                    </>
                  )}
                </div>

                {/* Cena */}
                <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '6px' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#166534', textTransform: 'uppercase' }}>🌙 Cena</h4>
                  <p 
                    onClick={() => item.cena && verDetalleReceta(item.cena)}
                    style={{ margin: 0, fontSize: '13px', color: item.cena ? '#15803d' : '#333', cursor: item.cena ? 'pointer' : 'default', textDecoration: item.cena ? 'underline' : 'none' }}
                  >
                    🍽️ {item.cena?.nombre || 'Sin asignar'}
                  </p>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}