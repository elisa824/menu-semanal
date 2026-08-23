import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';

interface Dieta {
  id: number;
  nombre: string;
  user_id?: string;
}

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

interface ProductoOFF {
  code: string;
  product_name?: string;
  brands?: string;
  stores?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    sugars_100g?: number;
    salt_100g?: number;
  };
}

const MINIMO_RECETAS = 7;

const SUPERMERCADOS = [
  'Todos los supermercados',
  'Mercadona',
  'Carrefour',
  'Lidl',
  'Dia',
  'Alcampo',
  'Eroski',
  'Consum',
  'ALDI',
  'El Corte Inglés'
];

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [esRegistro, setEsRegistro] = useState(false);
  const [errorAuth, setErrorAuth] = useState('');

  const [recetas, setRecetas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [menuSemanal, setMenuSemanal] = useState<DiaMenu[]>([]);
  
  const [dietas, setDietas] = useState<Dieta[]>([]);
  const [dietaSeleccionada, setDietaSeleccionada] = useState<Dieta | null>(null);
  const [nuevaDietaNombre, setNuevaDietaNombre] = useState('');
  const [guardandoDieta, setGuardandoDieta] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  
  const [listaCompra, setListaCompra] = useState<ItemCompra[]>([]);
  const [cargandoCompra, setCargandoCompra] = useState(false);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [listaMinimizada, setListaMinimizada] = useState(false);

  const [recetaSeleccionada, setRecetaSeleccionada] = useState<any | null>(null);
  const [ingredientesReceta, setIngredientesReceta] = useState<any[]>([]);
  const [cargandoIngredientesReceta, setCargandoIngredientesReceta] = useState(false);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [modoEdicionId, setModoEdicionId] = useState<number | null>(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('primero');
  const [nuevosPasos, setNuevosPasos] = useState('');
  const [nuevosIngredientes, setNuevosIngredientes] = useState('');
  
  const [nuevasCalorias, setNuevasCalorias] = useState<number | ''>('');
  const [nuevoAzucar, setNuevoAzucar] = useState<number | ''>('');
  const [nuevaSal, setNuevaSal] = useState<number | ''>('');
  
  const [supermercadoSeleccionado, setSupermercadoSeleccionado] = useState('Todos los supermercados');
  const [busquedaOFF, setBusquedaOFF] = useState('');
  const [resultadosOFF, setResultadosOFF] = useState<ProductoOFF[]>([]);
  const [buscandoOFF, setBuscandoOFF] = useState(false);
  const [avisoSinResultadosSup, setAvisoSinResultadosSup] = useState('');

  const [guardandoReceta, setGuardandoReceta] = useState(false);
  const buscandoRef = useRef(false);

  const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      obtenerDietas();
    } else {
      setDietas([]);
      setRecetas([]);
      setMenuSemanal([]);
      setDietaSeleccionada(null);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      obtenerRecetas();
    }
  }, [dietaSeleccionada, session]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setErrorAuth('');
    try {
      if (esRegistro) {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        alert('¡Registro completado! Ya puedes iniciar sesión.');
        setEsRegistro(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      }
    } catch (err: any) {
      setErrorAuth(err.message || 'Error en la autenticación');
    }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    setSession(null);
  }

  async function buscarEnSupermercado(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!busquedaOFF.trim() || buscandoRef.current) return;

    buscandoRef.current = true;
    setBuscandoOFF(true);
    setAvisoSinResultadosSup('');
    
    try {
      const termino = encodeURIComponent(busquedaOFF.trim());
      
      if (supermercadoSeleccionado !== 'Todos los supermercados') {
        const urlEspecifica = `https://es.openfoodfacts.org/cgi/search.pl?search_terms=${termino}&search_simple=1&action=process&json=1&stores_tags=${encodeURIComponent(supermercadoSeleccionado.toLowerCase())}&page_size=100`;
        const resEsp = await fetch(urlEspecifica);
        const dataEsp = await resEsp.json();
        
        let productosEsp: ProductoOFF[] = dataEsp?.products || [];
        const terminoBusqueda = busquedaOFF.toLowerCase().trim();
        
        productosEsp = productosEsp.filter(p => {
          const nombre = (p.product_name || '').toLowerCase();
          if (terminoBusqueda.includes('leche')) {
            return nombre.includes('leche') && !nombre.includes('galleta') && !nombre.includes('chocolate');
          }
          return true;
        });

        if (productosEsp.length > 0) {
          setResultadosOFF(productosEsp);
        } else {
          setResultadosOFF([]);
          setAvisoSinResultadosSup(`No hay resultados para este producto en ${supermercadoSeleccionado}.`);
        }
        return;
      }

      const urlGeneral = `https://es.openfoodfacts.org/cgi/search.pl?search_terms=${termino}&search_simple=1&action=process&json=1&page_size=150`;
      const resGen = await fetch(urlGeneral);
      const dataGen = await resGen.json();
      
      let productosGen: ProductoOFF[] = dataGen?.products || [];
      setResultadosOFF(productosGen);

    } catch (error) {
      console.error('Error buscando en Open Food Facts:', error);
      setResultadosOFF([]);
    } finally {
      buscandoRef.current = false;
      setBuscandoOFF(false);
    }
  }

  function limpiarBusqueda() {
    setBusquedaOFF('');
    setResultadosOFF([]);
    setAvisoSinResultadosSup('');
  }

  function seleccionarProductoOFF(prod: ProductoOFF) {
    const marca = prod.brands ? ` (${prod.brands})` : '';
    const superm = prod.stores ? ` [${prod.stores}]` : (supermercadoSeleccionado !== 'Todos los supermercados' ? ` [${supermercadoSeleccionado}]` : '');
    const nombreCompleto = `${prod.product_name || 'Producto'}${marca}${superm}`;

    if (nuevosIngredientes.trim() === '') {
      setNuevosIngredientes(`${nombreCompleto}: 100g`);
    } else {
      setNuevosIngredientes(prev => `${prev}, ${nombreCompleto}: 100g`);
    }

    const kcal = prod.nutriments?.['energy-kcal_100g'];
    const azucar = prod.nutriments?.sugars_100g;
    const sal = prod.nutriments?.salt_100g;

    if (kcal !== undefined) setNuevasCalorias(Math.round(kcal));
    if (azucar !== undefined) setNuevoAzucar(Number(azucar.toFixed(1)));
    if (sal !== undefined) setNuevaSal(Number(sal.toFixed(1)));

    limpiarBusqueda();
  }

  async function obtenerDietas() {
    if (!session) return;
    try {
      const { data, error } = await supabase.from('dietas').select('*').order('nombre', { ascending: true });
      if (!error && data) setDietas(data);
    } catch (e) {
      console.error('Error al obtener dietas:', e);
    }
  }

  async function crearNuevaDieta(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaDietaNombre.trim() || guardandoDieta || !session) return;

    setGuardandoDieta(true);
    try {
      const { data, error } = await supabase
        .from('dietas')
        .insert([{ nombre: nuevaDietaNombre.trim(), user_id: session.user.id }])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setDietas(prev => [...prev, data]);
        setNuevaDietaNombre('');
      }
    } catch (err: any) {
      console.error('Error al crear dieta:', err);
      alert('No se pudo crear la dieta: ' + (err.message || 'Error desconocido'));
    } finally {
      setGuardandoDieta(false);
    }
  }

  async function eliminarDieta(id: number, nombre: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`¿Seguro que quieres eliminar la dieta "${nombre}"?`)) return;

    try {
      const { error } = await supabase.from('dietas').delete().eq('id', id);
      if (!error) {
        setDietas(prev => prev.filter(d => d.id !== id));
        if (dietaSeleccionada?.id === id) setDietaSeleccionada(null);
      }
    } catch (e) {
      console.error('Error al eliminar dieta:', e);
    }
  }

  async function eliminarReceta(id: number, nombre: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!window.confirm(`¿Seguro que quieres eliminar la receta "${nombre}"?`)) return;

    try {
      const { error } = await supabase.from('recetas').delete().eq('id', id);
      if (!error) {
        if (recetaSeleccionada?.id === id) cerrarDetalles();
        await obtenerRecetas();
      }
    } catch (e) {
      console.error('Error al eliminar la receta:', e);
    }
  }

  async function abrirEditorReceta(receta: any, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    
    setModoEdicionId(receta.id);
    setNuevoNombre(receta.nombre || '');
    setNuevaCategoria(receta.categoria || 'primero');
    setNuevosPasos(receta.pasos || '');
    setNuevasCalorias(receta.calorias ?? '');
    setNuevoAzucar(receta.azucar_g ?? '');
    setNuevaSal(receta.sal_g ?? '');
    setNuevosIngredientes('');
    setMostrarFormulario(true);
    cerrarDetalles();

    try {
      const { data: relData } = await supabase
        .from('recetas_ingredientes')
        .select('ingredientes_id, cantidad')
        .eq('recetas_id', receta.id);

      const ids = (relData || []).map((r: any) => r.ingredientes_id).filter(Boolean);
      if (ids.length > 0) {
        const { data: ingData } = await supabase.from('ingredientes').select('id, nombre').in('id', ids);
        const mapNombres: { [id: number]: string } = {};
        (ingData || []).forEach(i => { mapNombres[i.id] = i.nombre; });

        const textoIngs = (relData || []).map((rel: any) => {
          const nombreIng = mapNombres[rel.ingredientes_id] || '';
          const cantidad = rel.cantidad ? `: ${rel.cantidad}` : '';
          return `${nombreIng}${cantidad}`;
        }).filter(Boolean).join(', ');

        setNuevosIngredientes(textoIngs);
      }
    } catch (err) {
      console.error('Error al cargar ingredientes para editar:', err);
    }
  }

  async function obtenerRecetas() {
    if (!session) return;
    setCargando(true);
    try {
      let dataRecetas: any[] = [];

      if (dietaSeleccionada) {
        const { data: relData, error: relError } = await supabase
          .from('receta_dietas')
          .select('receta_id')
          .eq('dieta_id', dietaSeleccionada.id);

        if (relError) throw relError;

        const ids = (relData || []).map(r => r.receta_id);
        if (ids.length > 0) {
          const { data, error } = await supabase.from('recetas').select('*').in('id', ids);
          if (!error && data) dataRecetas = data;
        }
      } else {
        const { data, error } = await supabase.from('recetas').select('*');
        if (!error && data) dataRecetas = data;
      }

      setRecetas(dataRecetas);
      
      if (dataRecetas.length >= MINIMO_RECETAS) {
        generarMenuEstructurado(dataRecetas);
      } else {
        setMenuSemanal([]);
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
    if (!lista || lista.length < MINIMO_RECETAS) {
      setMenuSemanal([]);
      return;
    }

    const usadosEnLaSemana = new Set<number>();
    const primeros = lista.filter(r => norm(r.categoria) === 'primero' || norm(r.categoria) === 'primeros');
    const segundos = lista.filter(r => norm(r.categoria) === 'segundo' || norm(r.categoria) === 'segundos');
    const platosUnicos = lista.filter(r => norm(r.categoria).includes('unico'));
    const cenas = lista.filter(r => norm(r.categoria) === 'cena' || norm(r.categoria) === 'cenas');

    const tomarSinRepetir = (grupo: any[]) => {
      const pool = grupo.length > 0 ? grupo : lista;
      const disponibles = pool.filter(r => !usadosEnLaSemana.has(r.id));
      let seleccion = disponibles.length > 0 ? disponibles[Math.floor(Math.random() * disponibles.length)] : pool[Math.floor(Math.random() * pool.length)];
      if (seleccion) usadosEnLaSemana.add(seleccion.id);
      return seleccion;
    };

    const nuevoMenu: DiaMenu[] = DIAS_SEMANA.map(dia => {
      const esUnico = platosUnicos.some(r => !usadosEnLaSemana.has(r.id)) && Math.random() < 0.5;
      return {
        dia,
        comensales: 1,
        esUnico,
        primero: esUnico ? null : tomarSinRepetir(primeros),
        segundo: esUnico ? null : tomarSinRepetir(segundos),
        platoUnico: esUnico ? tomarSinRepetir(platosUnicos) : null,
        cena: tomarSinRepetir(cenas)
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

  async function guardarOActualizarReceta(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevoNombre.trim() || guardandoReceta || !session) return;

    setGuardandoReceta(true);
    try {
      let recetaId = modoEdicionId;

      if (recetaId) {
        const { error: updateError } = await supabase
          .from('recetas')
          .update({ 
            nombre: nuevoNombre.trim(), 
            categoria: nuevaCategoria, 
            pasos: nuevosPasos.trim(),
            calorias: nuevasCalorias === '' ? 0 : Number(nuevasCalorias),
            azucar_g: nuevoAzucar === '' ? 0 : Number(nuevoAzucar),
            sal_g: nuevaSal === '' ? 0 : Number(nuevaSal)
          })
          .eq('id', recetaId);

        if (updateError) throw updateError;
        await supabase.from('recetas_ingredientes').delete().eq('recetas_id', recetaId);

      } else {
        const { data: recetaData, error: recetaError } = await supabase
          .from('recetas')
          .insert([{ 
            nombre: nuevoNombre.trim(), 
            categoria: nuevaCategoria, 
            pasos: nuevosPasos.trim(),
            calorias: nuevasCalorias === '' ? 0 : Number(nuevasCalorias),
            azucar_g: nuevoAzucar === '' ? 0 : Number(nuevoAzucar),
            sal_g: nuevaSal === '' ? 0 : Number(nuevaSal),
            user_id: session.user.id,
            is_public: false
          }])
          .select()
          .single();

        if (recetaError) throw recetaError;
        recetaId = recetaData.id;

        if (dietaSeleccionada) {
          await supabase
            .from('receta_dietas')
            .insert([{ receta_id: recetaId, dieta_id: dietaSeleccionada.id }]);
        }
      }

      if (nuevosIngredientes.trim() && recetaId) {
        const listaItems = nuevosIngredientes.split(',').map(i => i.trim()).filter(Boolean);

        for (const itemStr of listaItems) {
          let ingNombre = itemStr;
          let cantidadTexto = '1';

          if (itemStr.includes(':')) {
            const partes = itemStr.split(':');
            ingNombre = partes[0].trim();
            cantidadTexto = partes.slice(1).join(':').trim() || '1';
          }

          ingNombre = ingNombre.toLowerCase();

          let { data: ingExistente } = await supabase
            .from('ingredientes')
            .select('id')
            .eq('nombre', ingNombre)
            .maybeSingle();

          let ingId = ingExistente?.id;

          if (!ingId) {
            const { data: nuevoIng, error: ingError } = await supabase
              .from('ingredientes')
              .insert([{ nombre: ingNombre, user_id: session.user.id }])
              .select()
              .single();

            if (!ingError && nuevoIng) {
              ingId = nuevoIng.id;
            }
          }

          if (ingId) {
            await supabase
              .from('recetas_ingredientes')
              .insert([{ recetas_id: recetaId, ingredientes_id: ingId, cantidad: cantidadTexto }]);
          }
        }
      }

      setNuevoNombre('');
      setNuevaCategoria('primero');
      setNuevosPasos('');
      setNuevosIngredientes('');
      setNuevasCalorias('');
      setNuevoAzucar('');
      setNuevaSal('');
      setModoEdicionId(null);
      limpiarBusqueda();
      setMostrarFormulario(false);
      
      await obtenerRecetas();
    } catch (err) {
      console.error('Error al guardar/actualizar receta:', err);
    } finally {
      setGuardandoReceta(false);
    }
  }

  function parsearTextoCantidad(val: any) {
    if (val === null || val === undefined) return { num: null, unidad: '' };
    if (typeof val === 'number') return { num: val, unidad: '' };
    const str = String(val).trim();
    if (!str) return { num: null, unidad: '' };
    const numPart = parseFloat(str.replace(',', '.'));
    if (!isNaN(numPart)) {
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
      const { data: relData } = await supabase
        .from('recetas_ingredientes')
        .select('recetas_id, ingredientes_id, cantidad')
        .in('recetas_id', idsRecetas);

      const idsIngredientes = Array.from(new Set((relData || []).map((r: any) => r.ingredientes_id).filter(Boolean)));
      if (idsIngredientes.length === 0) {
        setListaCompra([]);
        setCargandoCompra(false);
        return;
      }

      const { data: ingData } = await supabase.from('ingredientes').select('id, nombre').in('id', idsIngredientes);
      const ingMap: { [id: number]: string } = {};
      (ingData || []).forEach(i => { ingMap[i.id] = i.nombre; });

      const acumulador: { [nombreIng: string]: { cantidadNum: number; unidad: string; textoLibre: string } } = {};

      (relData || []).forEach((rel: any) => {
        const nombreIng = ingMap[rel.ingredientes_id];
        if (!nombreIng) return;

        const listaComensales = recetaComensalesMap[rel.recetas_id] || [1];
        const { num, unidad } = parsearTextoCantidad(rel.cantidad);

        listaComensales.forEach(comensales => {
          if (!acumulador[nombreIng]) acumulador[nombreIng] = { cantidadNum: 0, unidad: unidad || '', textoLibre: '' };
          if (num !== null) {
            acumulador[nombreIng].cantidadNum += num * comensales;
            if (unidad && !acumulador[nombreIng].unidad) acumulador[nombreIng].unidad = unidad;
          } else {
            acumulador[nombreIng].textoLibre = rel.cantidad ? String(rel.cantidad) : '';
          }
        });
      });

      const resultado: ItemCompra[] = Object.keys(acumulador).sort().map(nombre => ({
        nombre,
        cantidadTotal: acumulador[nombre].cantidadNum > 0 ? acumulador[nombre].cantidadNum : null,
        unidad: acumulador[nombre].unidad || acumulador[nombre].textoLibre,
        comprado: false,
        enCasa: false
      }));

      setListaCompra(resultado);
    } catch (e) {
      console.error(e);
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
      const { data: relData } = await supabase
        .from('recetas_ingredientes')
        .select('ingredientes_id, cantidad')
        .eq('recetas_id', receta.id);

      const idsIngredientes = (relData || []).map((r: any) => r.ingredientes_id).filter(Boolean);
      if (idsIngredientes.length > 0) {
        const { data: ingData } = await supabase.from('ingredientes').select('id, nombre').in('id', idsIngredientes);
        const mapNombres: { [id: number]: string } = {};
        (ingData || []).forEach(i => { mapNombres[i.id] = i.nombre; });

        setIngredientesReceta((relData || []).map((rel: any) => ({
          nombre: mapNombres[rel.ingredientes_id] || 'Ingrediente',
          cantidad: rel.cantidad
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoIngredientesReceta(false);
    }
  }

  function cerrarDetalles() {
    setRecetaSeleccionada(null);
    setIngredientesReceta([]);
  }

  function calcularNutricionDia(diaItem: DiaMenu) {
    const recetasDelDia: any[] = [];
    if (diaItem.esUnico && diaItem.platoUnico) recetasDelDia.push(diaItem.platoUnico);
    if (!diaItem.esUnico) {
      if (diaItem.primero) recetasDelDia.push(diaItem.primero);
      if (diaItem.segundo) recetasDelDia.push(diaItem.segundo);
    }
    if (diaItem.cena) recetasDelDia.push(diaItem.cena);

    let calorias = 0, azucar = 0, sal = 0;
    recetasDelDia.forEach(r => {
      calorias += (Number(r.calorias) || 0);
      azucar += (Number(r.azucar_g) || 0);
      sal += (Number(r.sal_g) || 0);
    });

    const factor = diaItem.comensales || 1;
    return {
      calorias: calorias * factor,
      azucar: Number((azucar * factor).toFixed(1)),
      sal: Number((sal * factor).toFixed(1))
    };
  }

  const totalmenteResueltos = listaCompra.filter(i => i.comprado || i.enCasa).length;

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F2EB', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#FFFFFF', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)', border: '1px solid #E6DFD3' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ width: '56px', height: '56px', backgroundColor: '#F4F1EA', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: '24px' }}>🍳</div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#2C2A29', margin: '0 0 8px 0' }}>
              {esRegistro ? 'Crea tu cuenta' : '¡Bienvenido a MenúKit!'}
            </h2>
            <p style={{ fontSize: '14px', color: '#78716C', margin: 0 }}>
              {esRegistro ? 'Regístrate para guardar tus recetas y planes.' : 'Inicia sesión para acceder a tu menú semanal.'}
            </p>
          </div>

          {errorAuth && (
            <div style={{ backgroundColor: '#FEF2F2', color: '#DC2626', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', marginBottom: '20px', border: '1px solid #FEE2E2', fontWeight: '500' }}>
              {errorAuth}
            </div>
          )}
          
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#44403C', display: 'block', marginBottom: '6px' }}>Correo electrónico</label>
              <input type="email" required placeholder="tu@correo.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #D6D3D1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FAFAF9', transition: 'all 0.2s' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#44403C', display: 'block', marginBottom: '6px' }}>Contraseña</label>
              <input type="password" required placeholder="••••••••" value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #D6D3D1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FAFAF9', transition: 'all 0.2s' }} />
            </div>
            {/* Azul Oscuro para Iniciar Sesión / Registro principal */}
            <button type="submit" style={{ backgroundColor: '#1E3A8A', color: '#FFF', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 12px rgba(30, 58, 138, 0.25)', transition: 'background-color 0.2s', marginTop: '6px' }}>
              {esRegistro ? 'Crear cuenta' : 'Iniciar sesión'}
            </button>
          </form>

          <button onClick={() => setEsRegistro(!esRegistro)} style={{ background: 'none', border: 'none', color: '#1E3A8A', cursor: 'pointer', fontSize: '13px', fontWeight: '600', width: '100%', textAlign: 'center', marginTop: '20px' }}>
            {esRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate gratis'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F2EB', padding: '24px 16px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#2C2A29' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        
        {/* Barra superior de usuario con el aguacate gracioso medio tumbado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '10px 20px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #E6DFD3', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', width: '36px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ 
                fontSize: '22px', 
                display: 'inline-block', 
                transform: 'rotate(-25deg) translateY(2px)', 
                filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))',
                transformOrigin: 'bottom center'
              }}>
                🥑
              </span>
              <div style={{ position: 'absolute', bottom: '1px', left: '6px', width: '20px', height: '3px', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '50%' }}></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#A8A29E', fontWeight: '700', letterSpacing: '0.5px' }}>Conectado</span>
              <span style={{ color: '#292524', fontWeight: '600', fontSize: '13px' }}>{session.user.email}</span>
            </div>
          </div>

          {/* Rojo suave/discreto para Cerrar sesión */}
          <button onClick={cerrarSesion} style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '12px', transition: 'all 0.2s' }}>Cerrar sesión</button>
        </div>

        {/* Menú Lateral Desplegable de Dietas */}
        {menuAbierto && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(44, 42, 41, 0.4)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex' }}>
            <div style={{ width: '340px', backgroundColor: '#FFFFFF', height: '100%', padding: '24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '5px 0 25px rgba(0,0,0,0.1)' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#2C2A29' }}>Mis Dietas</h2>
                  <button onClick={() => setMenuAbierto(false)} style={{ background: '#F5F2EB', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '14px', cursor: 'pointer', color: '#78716C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>

                <form onSubmit={crearNuevaDieta} style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#57534E' }}>Crear nueva dieta</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" placeholder="Ej: Dieta Keto, Verano..." value={nuevaDietaNombre} onChange={e => setNuevaDietaNombre(e.target.value)} style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', fontSize: '13px', outline: 'none', backgroundColor: '#FAFAF9' }} />
                    {/* Morado Berenjena para el botón de crear dieta */}
                    <button type="submit" disabled={guardandoDieta} style={{ backgroundColor: '#581C87', color: '#fff', border: 'none', padding: '0 16px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '16px' }}>+</button>
                  </div>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button onClick={() => { setDietaSeleccionada(null); setMenuAbierto(false); }} style={{ padding: '12px 14px', borderRadius: '12px', border: dietaSeleccionada === null ? '2px solid #581C87' : '1px solid #E6DFD3', backgroundColor: dietaSeleccionada === null ? '#F3E8FF' : '#FFFFFF', fontWeight: '600', textAlign: 'left', cursor: 'pointer', color: dietaSeleccionada === null ? '#581C87' : '#44403C', fontSize: '13px' }}>
                    🌐 Todas las recetas (Sin filtro)
                  </button>

                  {dietas.map(dieta => (
                    <div key={dieta.id} onClick={() => { setDietaSeleccionada(dieta); setMenuAbierto(false); }} style={{ padding: '10px 14px', borderRadius: '12px', border: dietaSeleccionada?.id === dieta.id ? '2px solid #581C87' : '1px solid #E6DFD3', backgroundColor: dietaSeleccionada?.id === dieta.id ? '#F3E8FF' : '#FFFFFF', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: dietaSeleccionada?.id === dieta.id ? '#581C87' : '#44403C', fontSize: '13px' }}>
                      <span>📋 {dieta.nombre}</span>
                      {/* Rojo suave/discreto para borrar dieta */}
                      <button onClick={(e) => eliminarDieta(dieta.id, dieta.nombre, e)} style={{ backgroundColor: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Borrar</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cabecera Principal y Botones de Acción */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setMenuAbierto(true)} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E6DFD3', borderRadius: '12px', width: '44px', height: '44px', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>☰</button>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#2C2A29', letterSpacing: '-0.5px' }}>Menú Semanal</h1>
              <span style={{ fontSize: '12px', color: '#78716C', fontWeight: '600' }}>Dieta activa: {dietaSeleccionada ? dietaSeleccionada.nombre : 'Todas las recetas'}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Granate para Añadir Receta */}
            <button onClick={() => { setModoEdicionId(null); setNuevoNombre(''); setNuevaCategoria('primero'); setNuevosPasos(''); setNuevosIngredientes(''); setNuevasCalorias(''); setNuevoAzucar(''); setNuevaSal(''); setMostrarFormulario(!mostrarFormulario); }} style={{ backgroundColor: '#831843', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', boxShadow: '0 2px 4px rgba(131, 24, 67, 0.2)' }}>
              + Añadir Receta
            </button>
            {/* Mostaza brillante para Regenerar */}
            <button onClick={() => { if (recetas.length >= MINIMO_RECETAS) generarMenuEstructurado(recetas); else obtenerRecetas(); }} disabled={cargando || recetas.length < MINIMO_RECETAS} style={{ backgroundColor: recetas.length < MINIMO_RECETAS ? '#D6D3D1' : '#D97706', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '600', cursor: recetas.length < MINIMO_RECETAS ? 'not-allowed' : 'pointer', fontSize: '13px', boxShadow: recetas.length >= MINIMO_RECETAS ? '0 2px 4px rgba(217, 119, 6, 0.25)' : 'none' }}>
              🎲 Regenerar
            </button>
            {/* Verde Botella para Lista Compra */}
            <button onClick={generarListaCompra} disabled={cargando || menuSemanal.length === 0} style={{ backgroundColor: menuSemanal.length === 0 ? '#D6D3D1' : '#14532D', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '600', cursor: menuSemanal.length === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', boxShadow: menuSemanal.length > 0 ? '0 2px 4px rgba(20, 83, 45, 0.25)' : 'none' }}>
              🛒 Lista Compra
            </button>
          </div>
        </div>

        {/* Formulario de Receta */}
        {mostrarFormulario && (
          <div style={{ border: '1px solid #D6D3D1', borderRadius: '20px', padding: '24px', backgroundColor: '#FFFFFF', marginBottom: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#2C2A29' }}>{modoEdicionId ? 'Editar Receta' : 'Añadir Nueva Receta'}</h2>
              <button type="button" onClick={() => { setMostrarFormulario(false); setModoEdicionId(null); }} style={{ background: '#F5F2EB', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', color: '#57534E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            <form onSubmit={guardarOActualizarReceta} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#44403C' }}>Nombre de la receta *</label>
                <input type="text" required value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Ej: Tortilla de patatas" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', boxSizing: 'border-box', backgroundColor: '#FAFAF9', fontSize: '13px', outline: 'none' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#44403C' }}>Categoría *</label>
                <select value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', backgroundColor: '#FAFAF9', fontSize: '13px', outline: 'none' }}>
                  <option value="primero">Primero</option>
                  <option value="segundo">Segundo</option>
                  <option value="plato unico">Plato Único</option>
                  <option value="cena">Cena</option>
                </select>
              </div>

              <div style={{ backgroundColor: '#F9F8F6', padding: '16px', borderRadius: '14px', border: '1px solid #E7E5E4' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#44403C', marginBottom: '6px' }}>🛒 Filtrar por supermercado</label>
                <select value={supermercadoSeleccionado} onChange={e => setSupermercadoSeleccionado(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', backgroundColor: '#FFFFFF', fontSize: '13px', marginBottom: '12px', outline: 'none' }}>
                  {SUPERMERCADOS.map(sup => <option key={sup} value={sup}>{sup}</option>)}
                </select>

                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#44403C', marginBottom: '6px' }}>🔍 Buscar Producto (Open Food Facts)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ display: 'flex', flex: 1, position: 'relative', alignItems: 'center' }}>
                    <input type="text" placeholder="Ej: Leche entera..." value={busquedaOFF} onChange={e => setBusquedaOFF(e.target.value)} style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box', backgroundColor: '#FFFFFF', outline: 'none' }} />
                    {busquedaOFF && <button type="button" onClick={limpiarBusqueda} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#78716C' }}>✕</button>}
                  </div>
                  {/* Azul Oscuro para Buscar */}
                  <button type="button" onClick={() => buscarEnSupermercado()} disabled={buscandoOFF} style={{ backgroundColor: buscandoOFF ? '#D6D3D1' : '#1E3A8A', color: '#fff', border: 'none', padding: '0 16px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '13px' }}>
                    {buscandoOFF ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>

                {avisoSinResultadosSup && <div style={{ marginTop: '10px', padding: '10px 12px', backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '10px', fontSize: '12px', color: '#B45309', fontWeight: '600' }}>⚠️ {avisoSinResultadosSup}</div>}

                {resultadosOFF.length > 0 && (
                  <div style={{ marginTop: '12px', backgroundColor: '#FFFFFF', borderRadius: '10px', border: '1px solid #D6D3D1', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    {resultadosOFF.map((prod, index) => (
                      <div key={prod.code || index} onClick={() => seleccionarProductoOFF(prod)} style={{ padding: '10px 12px', borderBottom: '1px solid #F5F2EB', cursor: 'pointer', fontSize: '12px', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#F5F2EB'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#FFFFFF'}>
                        <strong style={{ color: '#2C2A29' }}>{prod.product_name || 'Producto sin nombre'}</strong>
                        {prod.brands && <span style={{ color: '#78716C' }}> - {prod.brands}</span>}
                        {prod.stores && <span style={{ color: '#166534', fontWeight: '600' }}> [{prod.stores}]</span>}
                        <div style={{ fontSize: '11px', color: '#57534E', marginTop: '3px' }}>
                          🔥 {prod.nutriments?.['energy-kcal_100g'] ?? 0} kcal | 🍯 {prod.nutriments?.sugars_100g ?? 0}g az. | 🧂 {prod.nutriments?.salt_100g ?? 0}g sal
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', backgroundColor: '#F9F8F6', padding: '14px', borderRadius: '14px', border: '1px solid #E7E5E4' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#44403C', marginBottom: '4px' }}>🔥 Calorías (100g)</label>
                  <input type="number" min="0" value={nuevasCalorias} onChange={e => setNuevasCalorias(e.target.value === '' ? '' : Number(e.target.value))} placeholder="kcal" style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D6D3D1', boxSizing: 'border-box', fontSize: '13px', backgroundColor: '#FFFFFF', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#44403C', marginBottom: '4px' }}>🍯 Azúcar (100g)</label>
                  <input type="number" step="0.1" min="0" value={nuevoAzucar} onChange={e => setNuevoAzucar(e.target.value === '' ? '' : Number(e.target.value))} placeholder="g" style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D6D3D1', boxSizing: 'border-box', fontSize: '13px', backgroundColor: '#FFFFFF', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#44403C', marginBottom: '4px' }}>🧂 Sal (100g)</label>
                  <input type="number" step="0.1" min="0" value={nuevaSal} onChange={e => setNuevaSal(e.target.value === '' ? '' : Number(e.target.value))} placeholder="g" style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D6D3D1', boxSizing: 'border-box', fontSize: '13px', backgroundColor: '#FFFFFF', outline: 'none' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600', color: '#44403C' }}>Ingredientes y Cantidades</label>
                  <span style={{ fontSize: '11px', color: '#57534E', backgroundColor: '#F5F2EB', padding: '2px 8px', borderRadius: '8px', fontWeight: '500' }}>
                    Formato: <strong>Ingrediente: Cantidad</strong>
                  </span>
                </div>
                <input type="text" value={nuevosIngredientes} onChange={e => setNuevosIngredientes(e.target.value)} placeholder="Ej: patatas: 200g, huevos: 3 unidades" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', boxSizing: 'border-box', backgroundColor: '#FAFAF9', fontSize: '13px', outline: 'none' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#44403C' }}>Pasos de preparación</label>
                <textarea rows={3} value={nuevosPasos} onChange={e => setNuevosPasos(e.target.value)} placeholder="Escribe los pasos de preparación..." style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', boxSizing: 'border-box', fontFamily: 'inherit', backgroundColor: '#FAFAF9', fontSize: '13px', outline: 'none' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                {/* Granate para Guardar Receta */}
                <button type="submit" disabled={guardandoReceta} style={{ flex: 1, backgroundColor: guardandoReceta ? '#D6D3D1' : '#831843', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '14px', boxShadow: '0 2px 4px rgba(131, 24, 67, 0.2)' }}>
                  {guardandoReceta ? 'Guardando...' : (modoEdicionId ? 'Guardar Cambios' : 'Guardar Receta')}
                </button>
                {modoEdicionId && (
                  <button type="button" onClick={() => { setMostrarFormulario(false); setModoEdicionId(null); }} style={{ backgroundColor: '#F5F2EB', color: '#57534E', border: 'none', padding: '12px 16px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Lista de la Compra */}
        {mostrarLista && (
          <div style={{ border: '1px solid #A7F3D0', borderRadius: '20px', padding: '20px 24px', backgroundColor: '#F0FDF4', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#065F46' }}>
                🛒 Lista de la Compra <span style={{ fontSize: '13px', fontWeight: '500', color: '#047857' }}>({totalmenteResueltos}/{listaCompra.length} resueltos)</span>
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setListaMinimizada(!listaMinimizada)} style={{ background: '#D1FAE5', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: '#064E3B', fontWeight: '600' }}>
                  {listaMinimizada ? '🔽 Mostrar' : '🔼 Minimizar'}
                </button>
                <button onClick={() => setMostrarLista(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#047857', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>✕</button>
              </div>
            </div>

            {!listaMinimizada && (
              <div style={{ marginTop: '16px' }}>
                {cargandoCompra ? (
                  <p style={{ margin: 0, color: '#047857', fontSize: '13px' }}>Calculando cantidades según comensales...</p>
                ) : listaCompra.length === 0 ? (
                  <p style={{ margin: 0, color: '#047857', fontSize: '13px' }}>No se encontraron ingredientes para las recetas de esta semana.</p>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {listaCompra.map((item, idx) => (
                      <li key={idx} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '12px', border: '1px solid #D1FAE5', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          <input type="checkbox" checked={item.comprado} onChange={() => toggleComprado(idx)} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#14532D' }} />
                          <span style={{ textDecoration: (item.comprado || item.enCasa) ? 'line-through' : 'none', color: item.comprado ? '#14532D' : item.enCasa ? '#A8A29E' : '#064E3B', fontWeight: item.enCasa ? 'normal' : '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.nombre}
                            {item.cantidadTotal !== null && <strong style={{ marginLeft: '4px', color: '#047857' }}>({item.cantidadTotal})</strong>}
                            {item.unidad && <span style={{ fontSize: '11px', color: '#059669', marginLeft: '3px' }}>{item.unidad}</span>}
                          </span>
                        </div>
                        <button onClick={() => toggleEnCasa(idx)} style={{ background: item.enCasa ? '#F5F2EB' : '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }} title="Ya lo tengo en casa">🏠</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Detalle de Receta Seleccionada */}
        {recetaSeleccionada && (
          <div style={{ border: '1px solid #D6D3D1', borderRadius: '20px', padding: '24px', backgroundColor: '#FFFFFF', marginBottom: '24px', position: 'relative', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}>
            <div style={{ position: 'absolute', top: '20px', right: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={(e) => abrirEditorReceta(recetaSeleccionada, e)} style={{ backgroundColor: '#F5F2EB', color: '#44403C', border: '1px solid #D6D3D1', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>✏️ Editar</button>
              {/* Rojo suave/discreto para borrar receta */}
              <button onClick={() => eliminarReceta(recetaSeleccionada.id, recetaSeleccionada.nombre)} style={{ backgroundColor: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Borrar</button>
              <button onClick={cerrarDetalles} style={{ background: '#F5F2EB', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', color: '#78716C', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px' }}>✕</button>
            </div>

            <h2 style={{ margin: '0 180px 4px 0', fontSize: '18px', fontWeight: '700', color: '#2C2A29' }}>📖 {recetaSeleccionada.nombre}</h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#57534E', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>Categoría: {recetaSeleccionada.categoria || 'Sin especificación'}</p>
            
            <div style={{ display: 'flex', gap: '16px', backgroundColor: '#F9F8F6', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', fontSize: '12px', fontWeight: '600', color: '#44403C', flexWrap: 'wrap', border: '1px solid #E7E5E4' }}>
              <span>🔥 {recetaSeleccionada.calorias || 0} kcal (100g)</span>
              <span>🍯 {recetaSeleccionada.azucar_g || 0}g azúcar (100g)</span>
              <span>🧂 {recetaSeleccionada.sal_g || 0}g sal (100g)</span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <strong style={{ fontSize: '13px', color: '#2C2A29', display: 'block', marginBottom: '6px' }}>🥕 Ingredientes (base por persona):</strong>
              {cargandoIngredientesReceta ? (
                <p style={{ margin: '2px 0', fontSize: '13px', color: '#78716C' }}>Cargando ingredientes...</p>
              ) : ingredientesReceta.length === 0 ? (
                <p style={{ margin: '2px 0', fontSize: '13px', color: '#78716C' }}>Sin ingredientes asignados.</p>
              ) : (
                <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px', fontSize: '13px', color: '#44403C', lineHeight: '1.5' }}>
                  {ingredientesReceta.map((ing, i) => (
                    <li key={i}>{ing.nombre} {ing.cantidad ? `- ${ing.cantidad}` : ''}</li>
                  ))}
                </ul>
              )}
            </div>
            
            <div>
              <strong style={{ fontSize: '13px', color: '#2C2A29', display: 'block', marginBottom: '6px' }}>📝 Pasos de preparación:</strong>
              <p style={{ margin: 0, whiteSpace: 'pre-line', color: '#44403C', fontSize: '13px', lineHeight: '1.6', backgroundColor: '#F9F8F6', padding: '14px', borderRadius: '12px', border: '1px solid #E7E5E4' }}>{recetaSeleccionada.pasos || 'No se han añadido pasos para esta receta.'}</p>
            </div>
          </div>
        )}

        {/* Contenido Principal / Menú o Estado inicial */}
        {cargando ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#78716C', fontWeight: '500' }}>Cargando recetas desde Supabase...</div>
        ) : recetas.length < MINIMO_RECETAS ? (
          <div style={{ border: '2px dashed #E7E5E4', backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '36px 24px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
            <h3 style={{ margin: '0 0 8px 0', color: '#2C2A29', fontSize: '18px', fontWeight: '700' }}>Dieta en construcción</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#78716C', lineHeight: '1.5', maxWidth: '450px', marginLeft: 'auto', marginRight: 'auto' }}>
              Has añadido <strong>{recetas.length}</strong> de las <strong>{MINIMO_RECETAS}</strong> recetas necesarias para poder generar un menú semanal completo.
            </p>
            
            {/* Mostaza brillante para añadir receta en falta */}
            <button 
              onClick={() => {
                setModoEdicionId(null);
                setNuevoNombre('');
                setNuevaCategoria('primero');
                setNuevosPasos('');
                setNuevosIngredientes('');
                setNuevasCalorias('');
                setNuevoAzucar('');
                setNuevaSal('');
                setMostrarFormulario(true);
              }}
              style={{ backgroundColor: '#D97706', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', marginBottom: '24px', boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)' }}
            >
              + Añadir {MINIMO_RECETAS - recetas.length} receta(s) más
            </button>

            {recetas.length > 0 && (
              <div style={{ textAlign: 'left', backgroundColor: '#F9F8F6', borderRadius: '16px', padding: '16px 20px', border: '1px solid #E7E5E4', maxWidth: '500px', margin: '0 auto' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#44403C', display: 'block', marginBottom: '10px' }}>Recetas guardadas en esta dieta:</span>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recetas.map(r => (
                    <li key={r.id} style={{ fontSize: '13px', color: '#2C2A29', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '8px 12px', borderRadius: '10px', border: '1px solid #E7E5E4' }}>
                      <span onClick={() => verDetalleReceta(r)} style={{ cursor: 'pointer', fontWeight: '500', color: '#44403C' }}>
                        {r.nombre} <span style={{ fontSize: '11px', color: '#78716C', opacity: 0.8 }}>({r.categoria})</span>
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={(e) => abrirEditorReceta(r, e)} style={{ backgroundColor: '#F5F2EB', color: '#44403C', border: '1px solid #D6D3D1', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Editar</button>
                        {/* Rojo suave/discreto para borrar receta de lista */}
                        <button onClick={(e) => eliminarReceta(r.id, r.nombre, e)} style={{ backgroundColor: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Borrar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {menuSemanal.map((item, indexDia) => {
              const nutricion = calcularNutricionDia(item);
              return (
                <div key={item.dia} style={{ border: '1px solid #E6DFD3', borderRadius: '20px', padding: '20px', backgroundColor: '#FFFFFF', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F5F2EB', paddingBottom: '12px', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ margin: 0, color: '#2C2A29', fontSize: '16px', fontWeight: '750' }}>{item.dia}</h3>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', backgroundColor: '#F9F8F6', color: '#57534E', padding: '4px 10px', borderRadius: '8px', border: '1px solid #E7E5E4' }}>
                        🔥 {nutricion.calorias} kcal | 🍯 {nutricion.azucar}g az. | 🧂 {nutricion.sal}g sal
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#F5F2EB', padding: '4px 10px', borderRadius: '20px', border: '1px solid #E6DFD3' }}>
                        <span style={{ fontSize: '12px', color: '#78716C' }}>👤</span>
                        <button onClick={() => cambiarComensales(indexDia, item.comensales - 1)} style={{ border: 'none', background: '#E7E5E4', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', color: '#44403C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                        <span style={{ fontSize: '13px', fontWeight: '700', minWidth: '14px', textAlign: 'center', color: '#2C2A29' }}>{item.comensales}</span>
                        <button onClick={() => cambiarComensales(indexDia, item.comensales + 1)} style={{ border: 'none', background: '#E7E5E4', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontWeight: '700', fontSize: '12px', color: '#44403C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ backgroundColor: '#F9F8F6', padding: '14px', borderRadius: '14px', border: '1px solid #E7E5E4' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#78716C', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>☀️ Comida</h4>
                      {item.esUnico ? (
                        <p onClick={() => item.platoUnico && verDetalleReceta(item.platoUnico)} style={{ margin: '2px 0', fontSize: '13px', cursor: item.platoUnico ? 'pointer' : 'default', color: item.platoUnico ? '#44403C' : '#2C2A29', fontWeight: '500' }}>
                          🍲 <strong style={{ fontWeight: '600' }}>Plato Único:</strong> <span style={{ textDecoration: item.platoUnico ? 'underline' : 'none' }}>{item.platoUnico?.nombre || 'Sin asignar'}</span>
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <p onClick={() => item.primero && verDetalleReceta(item.primero)} style={{ margin: 0, fontSize: '13px', cursor: item.primero ? 'pointer' : 'default', color: item.primero ? '#44403C' : '#2C2A29', fontWeight: '500' }}>
                            <strong style={{ color: '#78716C', fontWeight: '600' }}>1.º:</strong> <span style={{ textDecoration: item.primero ? 'underline' : 'none' }}>{item.primero?.nombre || 'Sin asignar'}</span>
                          </p>
                          <p onClick={() => item.segundo && verDetalleReceta(item.segundo)} style={{ margin: 0, fontSize: '13px', cursor: item.segundo ? 'pointer' : 'default', color: item.segundo ? '#44403C' : '#2C2A29', fontWeight: '500' }}>
                            <strong style={{ color: '#78716C', fontWeight: '600' }}>2.º:</strong> <span style={{ textDecoration: item.segundo ? 'underline' : 'none' }}>{item.segundo?.nombre || 'Sin asignar'}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    <div style={{ backgroundColor: '#F0FDF4', padding: '14px', borderRadius: '14px', border: '1px solid #DCFCE7' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#166534', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>🌙 Cena</h4>
                      <p onClick={() => item.cena && verDetalleReceta(item.cena)} style={{ margin: 0, fontSize: '13px', color: item.cena ? '#15803D' : '#2C2A29', cursor: item.cena ? 'pointer' : 'default', fontWeight: '500' }}>
                        🍽️ <span style={{ textDecoration: item.cena ? 'underline' : 'none' }}>{item.cena?.nombre || 'Sin asignar'}</span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}