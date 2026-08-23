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

    if (prod.nutriments?.['energy-kcal_100g'] !== undefined) setNuevasCalorias(Math.round(prod.nutriments['energy-kcal_100g']));
    if (prod.nutriments?.sugars_100g !== undefined) setNuevoAzucar(Number(prod.nutriments.sugars_100g.toFixed(1)));
    if (prod.nutriments?.salt_100g !== undefined) setNuevaSal(Number(prod.nutriments.salt_100g.toFixed(1)));

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

      if (error) {
        throw error; // Esto lanzará el error para que lo veas
      }

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

            if (!ingError && nuevoIng) ingId = nuevoIng.id;
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
      <div style={{ padding: '60px 20px', fontFamily: 'sans-serif', maxWidth: '400px', margin: '0 auto', color: '#333' }}>
        <div style={{ backgroundColor: '#F9FAFB', padding: '30px', borderRadius: '12px', border: '1px solid #E5E7EB', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
          <h2 style={{ textAlign: 'center', color: '#4F46E5', marginBottom: '8px' }}>
            {esRegistro ? '✨ Crea tu cuenta' : '🍳 Menú Semanal'}
          </h2>
          <p style={{ textAlign: 'center', fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
            {esRegistro ? 'Regístrate para guardar tus propias recetas y dietas.' : 'Inicia sesión para acceder a tu menú.'}
          </p>

          {errorAuth && <div style={{ backgroundColor: '#FEE2E2', color: '#B91C1C', padding: '10px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>{errorAuth}</div>}
          
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Correo electrónico:</label>
              <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Contraseña:</label>
              <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #D1D5DB', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" style={{ backgroundColor: '#4F46E5', color: '#FFF', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '6px' }}>
              {esRegistro ? 'Registrarse' : 'Entrar'}
            </button>
          </form>

          <button onClick={() => setEsRegistro(!esRegistro)} style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', fontSize: '12px', width: '100%', textAlign: 'center', marginTop: '16px', textDecoration: 'underline' }}>
            {esRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '650px', margin: '0 auto', color: '#333' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F3F4F6', padding: '10px 14px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
        <span>👤 Conectado como: <strong>{session.user.email}</strong></span>
        <button onClick={cerrarSesion} style={{ background: '#EF4444', color: '#FFF', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Cerrar Sesión</button>
      </div>

      {menuAbierto && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex' }}>
          <div style={{ width: '320px', backgroundColor: '#fff', height: '100%', padding: '20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#1F2937' }}>Mis Dietas</h2>
                <button onClick={() => setMenuAbierto(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6B7280' }}>✖</button>
              </div>

              <form onSubmit={crearNuevaDieta} style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#374151' }}>Crear nueva dieta:</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" placeholder="Ej: Dieta Keto..." value={nuevaDietaNombre} onChange={e => setNuevaDietaNombre(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '13px' }} />
                  <button type="submit" disabled={guardandoDieta} style={{ backgroundColor: '#4F46E5', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>+</button>
                </div>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => { setDietaSeleccionada(null); setMenuAbierto(false); }} style={{ padding: '10px', borderRadius: '6px', border: dietaSeleccionada === null ? '2px solid #4F46E5' : '1px solid #E5E7EB', backgroundColor: dietaSeleccionada === null ? '#EEF2FF' : '#FFF', fontWeight: 'bold', textAlign: 'left', cursor: 'pointer' }}>
                  🌐 Todas las recetas (Sin filtro)
                </button>

                {dietas.map(dieta => (
                  <div key={dieta.id} onClick={() => { setDietaSeleccionada(dieta); setMenuAbierto(false); }} style={{ padding: '8px 10px', borderRadius: '6px', border: dietaSeleccionada?.id === dieta.id ? '2px solid #4F46E5' : '1px solid #E5E7EB', backgroundColor: dietaSeleccionada?.id === dieta.id ? '#EEF2FF' : '#FFF', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>📋 {dieta.nombre}</span>
                    <button onClick={(e) => eliminarDieta(dieta.id, dieta.nombre, e)} style={{ backgroundColor: '#EF4444', color: '#FFF', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Delete</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => setMenuAbierto(true)} style={{ backgroundColor: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '6px 10px', fontSize: '18px', cursor: 'pointer' }}>☰</button>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px' }}>📅 Menú Semanal</h1>
            <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 'bold' }}>Dieta: {dietaSeleccionada ? dietaSeleccionada.nombre : 'Todas las recetas'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => { setModoEdicionId(null); setNuevoNombre(''); setNuevaCategoria('primero'); setNuevosPasos(''); setNuevosIngredientes(''); setNuevasCalorias(''); setNuevoAzucar(''); setNuevaSal(''); setMostrarFormulario(!mostrarFormulario); }} style={{ backgroundColor: '#8B5CF6', color: '#fff', border: 'none', padding: '9px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
            ➕ Añadir Receta
          </button>
          <button onClick={() => { if (recetas.length >= MINIMO_RECETAS) generarMenuEstructurado(recetas); else obtenerRecetas(); }} disabled={cargando || recetas.length < MINIMO_RECETAS} style={{ backgroundColor: recetas.length < MINIMO_RECETAS ? '#9CA3AF' : '#4F46E5', color: '#fff', border: 'none', padding: '9px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: recetas.length < MINIMO_RECETAS ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
            🎲 Regenerar
          </button>
          <button onClick={generarListaCompra} disabled={cargando || menuSemanal.length === 0} style={{ backgroundColor: menuSemanal.length === 0 ? '#9CA3AF' : '#10B981', color: '#fff', border: 'none', padding: '9px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: menuSemanal.length === 0 ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
            🛒 Lista Compra
          </button>
        </div>
      </div>

      {mostrarFormulario && (
        <form onSubmit={guardarOActualizarReceta} style={{ border: '2px solid #8B5CF6', borderRadius: '10px', padding: '16px', backgroundColor: '#F5F3FF', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '17px', color: '#5B21B6' }}>{modoEdicionId ? '✏️ Editar Receta' : '➕ Añadir Nueva Receta'}</h2>
            <button type="button" onClick={() => { setMostrarFormulario(false); setModoEdicionId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#5B21B6' }}>✖</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#4C1D95' }}>Nombre de la receta:*</label>
              <input type="text" required value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Ej: Tortilla de patatas" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #DDD6FE', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#4C1D95' }}>Categoría:*</label>
              <select value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #DDD6FE', backgroundColor: '#fff' }}>
                <option value="primero">Primero</option>
                <option value="segundo">Segundo</option>
                <option value="plato unico">Plato Único</option>
                <option value="cena">Cena</option>
              </select>
            </div>

            <div style={{ backgroundColor: '#EDE9FE', padding: '12px', borderRadius: '8px', border: '1px solid #DDD6FE' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4C1D95', marginBottom: '4px' }}>🛒 Supermercado:</label>
              <select value={supermercadoSeleccionado} onChange={e => setSupermercadoSeleccionado(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #C4B5FD', backgroundColor: '#fff', fontSize: '13px', marginBottom: '10px' }}>
                {SUPERMERCADOS.map(sup => <option key={sup} value={sup}>{sup}</option>)}
              </select>

              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4C1D95', marginBottom: '4px' }}>🔍 Buscar Producto:</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ display: 'flex', flex: 1, position: 'relative', alignItems: 'center' }}>
                  <input type="text" placeholder="Ej: Leche entera..." value={busquedaOFF} onChange={e => setBusquedaOFF(e.target.value)} style={{ width: '100%', padding: '8px', paddingRight: '28px', borderRadius: '6px', border: '1px solid #DDD6FE', fontSize: '13px', boxSizing: 'border-box' }} />
                  {busquedaOFF && <button type="button" onClick={limpiarBusqueda} style={{ position: 'absolute', right: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#6B7280' }}>✕</button>}
                </div>
                <button type="button" onClick={() => buscarEnSupermercado()} disabled={buscandoOFF} style={{ backgroundColor: buscandoOFF ? '#9CA3AF' : '#6D28D9', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                  {buscandoOFF ? 'Buscando...' : 'Buscar'}
                </button>
              </div>

              {avisoSinResultadosSup && <div style={{ marginTop: '10px', padding: '8px 10px', backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '6px', fontSize: '12px', color: '#B45309', fontWeight: 'bold' }}>⚠️ {avisoSinResultadosSup}</div>}

              {resultadosOFF.length > 0 && (
                <div style={{ marginTop: '10px', backgroundColor: '#FFF', borderRadius: '6px', border: '1px solid #C4B5FD', maxHeight: '200px', overflowY: 'auto' }}>
                  {resultadosOFF.map((prod, index) => (
                    <div key={prod.code || index} onClick={() => seleccionarProductoOFF(prod)} style={{ padding: '8px', borderBottom: '1px solid #F3E8FF', cursor: 'pointer', fontSize: '12px' }}>
                      <strong style={{ color: '#4C1D95' }}>{prod.product_name || 'Producto'}</strong>
                      {prod.brands && <span style={{ color: '#6B7280' }}> - {prod.brands}</span>}
                      {prod.stores && <span style={{ color: '#059669', fontWeight: 'bold' }}> [{prod.stores}]</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', backgroundColor: '#EDE9FE', padding: '10px', borderRadius: '6px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#5B21B6', marginBottom: '2px' }}>🔥 Calorías (100g)</label>
                <input type="number" min="0" value={nuevasCalorias} onChange={e => setNuevasCalorias(e.target.value === '' ? '' : Number(e.target.value))} placeholder="kcal" style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #DDD6FE', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#5B21B6', marginBottom: '2px' }}>🍯 Azúcar (100g)</label>
                <input type="number" step="0.1" min="0" value={nuevoAzucar} onChange={e => setNuevoAzucar(e.target.value === '' ? '' : Number(e.target.value))} placeholder="g" style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #DDD6FE', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#5B21B6', marginBottom: '2px' }}>🧂 Sal (100g)</label>
                <input type="number" step="0.1" min="0" value={nuevaSal} onChange={e => setNuevaSal(e.target.value === '' ? '' : Number(e.target.value))} placeholder="g" style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #DDD6FE', fontSize: '12px', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4C1D95', display: 'block', marginBottom: '4px' }}>Ingredientes (Formato: Ingrediente: Cantidad):</label>
              <input type="text" value={nuevosIngredientes} onChange={e => setNuevosIngredientes(e.target.value)} placeholder="Ej: patatas: 200g, huevos: 3" style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #DDD6FE', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#4C1D95' }}>Pasos de preparación:</label>
              <textarea rows={3} value={nuevosPasos} onChange={e => setNuevosPasos(e.target.value)} placeholder="Pasos..." style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #DDD6FE', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button type="submit" disabled={guardandoReceta} style={{ flex: 1, backgroundColor: guardandoReceta ? '#9CA3AF' : '#7C3AED', color: '#fff', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                {guardandoReceta ? 'Guardando...' : (modoEdicionId ? '💾 Guardar Cambios' : '💾 Guardar Receta')}
              </button>
              {modoEdicionId && <button type="button" onClick={() => { setMostrarFormulario(false); setModoEdicionId(null); }} style={{ backgroundColor: '#E5E7EB', color: '#374151', border: 'none', padding: '10px 14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>}
            </div>
          </div>
        </form>
      )}

      {mostrarLista && (
        <div style={{ border: '2px solid #10B981', borderRadius: '10px', padding: '14px 16px', backgroundColor: '#ECFDF5', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '17px', color: '#065F46' }}>🛒 Lista de la Compra ({totalmenteResueltos}/{listaCompra.length})</h2>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setListaMinimizada(!listaMinimizada)} style={{ background: '#A7F3D0', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#064E3B', fontWeight: 'bold' }}>{listaMinimizada ? '🔽 Mostrar' : '🔼 Minimizar'}</button>
              <button onClick={() => setMostrarLista(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#047857' }}>✖</button>
            </div>
          </div>

          {!listaMinimizada && (
            <div style={{ marginTop: '12px' }}>
              {cargandoCompra ? <p style={{ margin: 0, color: '#047857' }}>Calculando...</p> : listaCompra.length === 0 ? <p style={{ margin: 0, color: '#047857' }}>Sin ingredientes.</p> : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {listaCompra.map((item, idx) => (
                    <li key={idx} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #D1FAE5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <input type="checkbox" checked={item.comprado} onChange={() => toggleComprado(idx)} style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#10B981' }} />
                        <span style={{ textDecoration: (item.comprado || item.enCasa) ? 'line-through' : 'none', color: item.comprado ? '#10B981' : item.enCasa ? '#6B7280' : '#064E3B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.nombre} {item.cantidadTotal !== null && `(${item.cantidadTotal})`} {item.unidad}
                        </span>
                      </div>
                      <button onClick={() => toggleEnCasa(idx)} style={{ background: item.enCasa ? '#E5E7EB' : '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '4px', padding: '2px 5px', fontSize: '11px', cursor: 'pointer' }}>🏠</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {recetaSeleccionada && (
        <div style={{ border: '2px solid #4F46E5', borderRadius: '10px', padding: '16px', backgroundColor: '#EEF2FF', marginBottom: '20px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={(e) => abrirEditorReceta(recetaSeleccionada, e)} style={{ backgroundColor: '#4F46E5', color: '#FFF', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>✏️ Editar</button>
            <button onClick={() => eliminarReceta(recetaSeleccionada.id, recetaSeleccionada.nombre)} style={{ backgroundColor: '#EF4444', color: '#FFF', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Delete</button>
            <button onClick={cerrarDetalles} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#4F46E5', fontWeight: 'bold' }}>✖</button>
          </div>

          <h2 style={{ margin: '0 120px 4px 0', fontSize: '18px', color: '#312E81' }}>📖 {recetaSeleccionada.nombre}</h2>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#4338CA', textTransform: 'uppercase', fontWeight: 'bold' }}>Categoría: {recetaSeleccionada.categoria}</p>
          
          <div style={{ display: 'flex', gap: '12px', backgroundColor: '#E0E7FF', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontSize: '12px', fontWeight: 'bold', color: '#3730A3', flexWrap: 'wrap' }}>
            <span>🔥 {recetaSeleccionada.calorias || 0} kcal</span>
            <span>🍯 {recetaSeleccionada.azucar_g || 0}g az.</span>
            <span>🧂 {recetaSeleccionada.sal_g || 0}g sal</span>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <strong style={{ fontSize: '14px', color: '#1E1B4B' }}>🥕 Ingredientes:</strong>
            {cargandoIngredientesReceta ? <p style={{ margin: '2px 0', fontSize: '13px' }}>Cargando...</p> : (
              <ul style={{ margin: '4px 0 0 0', paddingLeft: '18px', fontSize: '13px', color: '#374151' }}>
                {ingredientesReceta.map((ing, i) => <li key={i}>{ing.nombre} {ing.cantidad ? `- ${ing.cantidad}` : ''}</li>)}
              </ul>
            )}
          </div>
          <div>
            <strong>📝 Pasos:</strong>
            <p style={{ margin: '4px 0 0 0', whiteSpace: 'pre-line', color: '#374151', fontSize: '13px' }}>{recetaSeleccionada.pasos || 'Sin pasos.'}</p>
          </div>
        </div>
      )}

      {cargando ? <p>Cargando...</p> : recetas.length < MINIMO_RECETAS ? (
        <div style={{ border: '2px dashed #F59E0B', backgroundColor: '#FEF3C7', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#B45309', fontSize: '18px' }}>⚡ Dieta en construcción</h3>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#92400E' }}>Has añadido <strong>{recetas.length}</strong> de las <strong>{MINIMO_RECETAS}</strong> recetas necesarias.</p>
          
          <button onClick={() => { setModoEdicionId(null); setNuevoNombre(''); setNuevaCategoria('primero'); setNuevosPasos(''); setNuevosIngredientes(''); setNuevasCalorias(''); setNuevoAzucar(''); setNuevaSal(''); setMostrarFormulario(true); }} style={{ backgroundColor: '#D97706', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', marginBottom: '20px' }}>
            ➕ Añadir {MINIMO_RECETAS - recetas.length} receta(s) más
          </button>

          {recetas.length > 0 && (
            <div style={{ textAlign: 'left', backgroundColor: '#FFF', borderRadius: '8px', padding: '12px 16px', border: '1px solid #FCD34D' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#78350F', display: 'block', marginBottom: '8px' }}>Recetas actuales:</span>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {recetas.map(r => (
                  <li key={r.id} style={{ fontSize: '13px', color: '#451A03', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFBEB', padding: '6px 8px', borderRadius: '4px', border: '1px solid #FDE68A' }}>
                    <span onClick={() => verDetalleReceta(r)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>{r.nombre} <span style={{ fontSize: '11px', color: '#92400E' }}>({r.categoria})</span></span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={(e) => abrirEditorReceta(r, e)} style={{ backgroundColor: '#4F46E5', color: '#FFF', border: 'none', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Editar</button>
                      <button onClick={(e) => eliminarReceta(r.id, r.nombre, e)} style={{ backgroundColor: '#EF4444', color: '#FFF', border: 'none', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {menuSemanal.map((item, indexDia) => {
            const nutricion = calcularNutricionDia(item);
            return (
              <div key={item.dia} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px', backgroundColor: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <h3 style={{ margin: 0, color: '#1f2937' }}>{item.dia}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                      <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '3px 8px', borderRadius: '6px' }}>🔥 {nutricion.calorias} kcal</span>
                      <span style={{ backgroundColor: '#F3E8FF', color: '#6B21A8', padding: '3px 8px', borderRadius: '6px' }}>🍯 {nutricion.azucar}g az.</span>
                      <span style={{ backgroundColor: '#E0F2FE', color: '#0369A1', padding: '3px 8px', borderRadius: '6px' }}>🧂 {nutricion.sal}g sal</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: '20px' }}>
                      <span style={{ fontSize: '12px', color: '#4B5563', fontWeight: 'bold' }}>👤</span>
                      <button onClick={() => cambiarComensales(indexDia, item.comensales - 1)} style={{ border: 'none', background: '#E5E7EB', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '14px', textAlign: 'center' }}>{item.comensales}</span>
                      <button onClick={() => cambiarComensales(indexDia, item.comensales + 1)} style={{ border: 'none', background: '#E5E7EB', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#f9fafb', padding: '10px', borderRadius: '6px' }}>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#6b7280', textTransform: 'uppercase' }}>☀️ Comida</h4>
                    {item.esUnico ? (
                      <p onClick={() => item.platoUnico && verDetalleReceta(item.platoUnico)} style={{ margin: '2px 0', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', color: '#4F46E5' }}>🍲 {item.platoUnico?.nombre}</p>
                    ) : (
                      <>
                        <p onClick={() => item.primero && verDetalleReceta(item.primero)} style={{ margin: '2px 0', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', color: '#4F46E5' }}><strong>1.º:</strong> {item.primero?.nombre}</p>
                        <p onClick={() => item.segundo && verDetalleReceta(item.segundo)} style={{ margin: '2px 0', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', color: '#4F46E5' }}><strong>2.º:</strong> {item.segundo?.nombre}</p>
                      </>
                    )}
                  </div>
                  <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '6px' }}>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#166534', textTransform: 'uppercase' }}>🌙 Cena</h4>
                    <p onClick={() => item.cena && verDetalleReceta(item.cena)} style={{ margin: 0, fontSize: '13px', color: '#15803d', cursor: 'pointer', textDecoration: 'underline' }}>🍽️ {item.cena?.nombre}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}