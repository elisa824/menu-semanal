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

  const [pestanaActiva, setPestanaActiva] = useState<'menu' | 'dietas' | 'sobre'>('menu');

  const [recetas, setRecetas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [menuSemanal, setMenuSemanal] = useState<DiaMenu[]>([]);
  
  const [dietas, setDietas] = useState<Dieta[]>([]);
  const [dietaSeleccionada, setDietaSeleccionada] = useState<Dieta | null>(null);
  const [nuevaDietaNombre, setNuevaDietaNombre] = useState('');
  const [guardandoDieta, setGuardandoDieta] = useState(false);
  
  const [listaCompra, setListaCompra] = useState<ItemCompra[]>([]);
  const [cargandoCompra, setCargandoCompra] = useState(false);
  const [mostrarLista, setMostrarLista] = useState(false);
  const [listaMinimizada, setListaMinimizada] = useState(false);

  const [mostrarSelectorCompra, setMostrarSelectorCompra] = useState(false);
  const [seleccionDiasCompra, setSeleccionDiasCompra] = useState<{ [dia: string]: { comida: boolean; cena: boolean } }>({
    'Lunes': { comida: true, cena: true },
    'Martes': { comida: true, cena: true },
    'Miércoles': { comida: true, cena: true },
    'Jueves': { comida: true, cena: true },
    'Viernes': { comida: true, cena: true },
    'Sábado': { comida: true, cena: true },
    'Domingo': { comida: true, cena: true },
  });

  const [tarjetaVolteada, setTarjetaVolteada] = useState<{ [dia: string]: boolean }>({});
  const [recetaActivaDia, setRecetaActivaDia] = useState<{ [dia: string]: { receta: any; tipo: string } }>({});
  const [ingredientesRecetaDia, setIngredientesRecetaDia] = useState<any[]>([]);
  const [cargandoIngredientesDia, setCargandoIngredientesDia] = useState(false);

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
      setListaCompra([]);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      inicializarDatosUsuario();
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
        await inicializarDatosUsuario();
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

  // Inicializador que carga recetas y busca si ya hay un menú guardado en Supabase
  async function inicializarDatosUsuario(forzarRegeneracion = false) {
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
        const dietaIdFiltro = dietaSeleccionada ? dietaSeleccionada.id : null;
        
        // Consultar si ya existe un menú guardado en la base de datos para este usuario/dieta
        let queryMenu = supabase.from('menus_guardados').select('*').eq('user_id', session.user.id);
        if (dietaIdFiltro) {
          queryMenu = queryMenu.eq('dieta_id', dietaIdFiltro);
        } else {
          queryMenu = queryMenu.is('dieta_id', null);
        }

        const { data: menuGuardadoData } = await queryMenu.maybeSingle();

        if (menuGuardadoData && menuGuardadoData.contenido && !forzarRegeneracion) {
          // Si existe menú guardado y no se fuerza regeneración, lo restauramos exactamente igual
          setMenuSemanal(menuGuardadoData.contenido);
          if (menuGuardadoData.lista_compra) {
            setListaCompra(menuGuardadoData.lista_compra);
            if (menuGuardadoData.lista_compra.length > 0) setMostrarLista(true);
          }
        } else {
          // Si no existe o se forzó regeneración, creamos uno nuevo y lo guardamos
          generarMenuEstructurado(dataRecetas, true);
        }
      } else {
        setMenuSemanal([]);
        setListaCompra([]);
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

  async function guardarMenuEnBD(nuevoMenu: DiaMenu[], nuevaListaCompra = listaCompra) {
    if (!session) return;
    try {
      const dietaIdFiltro = dietaSeleccionada ? dietaSeleccionada.id : null;
      
      // Comprobar si existe registro previo
      let queryCheck = supabase.from('menus_guardados').select('id').eq('user_id', session.user.id);
      if (dietaIdFiltro) queryCheck = queryCheck.eq('dieta_id', dietaIdFiltro);
      else queryCheck = queryCheck.is('dieta_id', null);

      const { data: existente } = await queryCheck.maybeSingle();

      const payload = {
        user_id: session.user.id,
        dieta_id: dietaIdFiltro,
        contenido: nuevoMenu,
        lista_compra: nuevaListaCompra,
        updated_at: new Date()
      };

      if (existente?.id) {
        await supabase.from('menus_guardados').update(payload).eq('id', existente.id);
      } else {
        await supabase.from('menus_guardados').insert([payload]);
      }
    } catch (err) {
      console.error('Error al guardar menú en BD:', err);
    }
  }

  function generarMenuEstructurado(lista: any[], guardar = false) {
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
    setListaCompra([]);
    setTarjetaVolteada({});

    if (guardar) {
      guardarMenuEnBD(nuevoMenu, []);
    }
  }

  function cambiarComensales(indexDia: number, cantidad: number) {
    const num = Math.max(1, cantidad);
    setMenuSemanal(prev => {
      const actualizado = prev.map((dia, idx) => idx === indexDia ? { ...dia, comensales: num } : dia);
      guardarMenuEnBD(actualizado, listaCompra);
      return actualizado;
    });
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
      
      await inicializarDatosUsuario();
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
    setMostrarSelectorCompra(false);

    const recetaComensalesMap: { [recetaId: number]: number[] } = {};

    menuSemanal.forEach(item => {
      const configuracionDia = seleccionDiasCompra[item.dia] || { comida: true, cena: true };
      const numComensales = item.comensales || 1;
      const idsDelDia: number[] = [];

      if (configuracionDia.comida) {
        if (item.esUnico && item.platoUnico) {
          idsDelDia.push(item.platoUnico.id);
        } else if (!item.esUnico) {
          if (item.primero) idsDelDia.push(item.primero.id);
          if (item.segundo) idsDelDia.push(item.segundo.id);
        }
      }

      if (configuracionDia.cena) {
        if (item.cena) idsDelDia.push(item.cena.id);
      }

      idsDelDia.forEach(id => {
        if (!recetaComensalesMap[id]) recetaComensalesMap[id] = [];
        recetaComensalesMap[id].push(numComensales);
      });
    });

    const idsRecetas = Object.keys(recetaComensalesMap).map(Number);
    if (idsRecetas.length === 0) {
      setListaCompra([]);
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
      guardarMenuEnBD(menuSemanal, resultado);
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoCompra(false);
    }
  }

  function toggleComprado(index: number) {
    setListaCompra(prev => {
      const actualizado = prev.map((item, i) => i === index ? { ...item, comprado: !item.comprado, enCasa: false } : item);
      guardarMenuEnBD(menuSemanal, actualizado);
      return actualizado;
    });
  }

  function toggleEnCasa(index: number) {
    setListaCompra(prev => {
      const actualizado = prev.map((item, i) => i === index ? { ...item, enCasa: !item.enCasa, comprado: false } : item);
      guardarMenuEnBD(menuSemanal, actualizado);
      return actualizado;
    });
  }

  async function voltearDiaConReceta(dia: string, receta: any, tipo: string) {
    if (!receta) return;
    setRecetaActivaDia(prev => ({ ...prev, [dia]: { receta, tipo } }));
    setTarjetaVolteada(prev => ({ ...prev, [dia]: true }));
    setIngredientesRecetaDia([]);
    setCargandoIngredientesDia(true);

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

        setIngredientesRecetaDia((relData || []).map((rel: any) => ({
          nombre: mapNombres[rel.ingredientes_id] || 'Ingrediente',
          cantidad: rel.cantidad
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCargandoIngredientesDia(false);
    }
  }

  function volverAlMenuDia(dia: string) {
    setTarjetaVolteada(prev => ({ ...prev, [dia]: false }));
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F2EB', padding: '20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#2C2A29' }}>
        <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#FFFFFF', color: '#2C2A29', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)', border: '1px solid #E6DFD3' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ width: '56px', height: '56px', backgroundColor: '#F4F1EA', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: '24px' }}>🍳</div>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#2C2A29', margin: '0 0 8px 0' }}>
              {esRegistro ? 'Crea tu cuenta' : '¡Bienvenido a MenuKit!'}
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
              <input type="email" required placeholder="tu@correo.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #D6D3D1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF', color: '#2C2A29', transition: 'all 0.2s' }} />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#44403C', display: 'block', marginBottom: '6px' }}>Contraseña</label>
              <input type="password" required placeholder="••••••••" value={authPassword} onChange={e => setAuthPassword(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #D6D3D1', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: '#FFFFFF', color: '#2C2A29', transition: 'all 0.2s' }} />
            </div>
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
    <div style={{ minHeight: '100vh', backgroundColor: '#F5F2EB', padding: '24px 16px 80px 16px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#2C2A29', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '10px 20px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #E6DFD3', fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative', width: '36px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '22px', display: 'inline-block', transform: 'rotate(-25deg) translateY(2px)', filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.1))', transformOrigin: 'bottom center' }}>🥑</span>
              <div style={{ position: 'absolute', bottom: '1px', left: '6px', width: '20px', height: '3px', backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: '50%' }}></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', color: '#A8A29E', fontWeight: '700', letterSpacing: '0.5px' }}>Conectado</span>
              <span style={{ color: '#292524', fontWeight: '600', fontSize: '13px' }}>{session.user.email}</span>
            </div>
          </div>

          <button onClick={cerrarSesion} style={{ background: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '12px', transition: 'all 0.2s' }}>Cerrar sesión</button>
        </div>

        <div style={{ animation: 'fadeIn 0.3s ease-in-out' }}>
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          {pestanaActiva === 'sobre' ? (
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '32px 24px', border: '1px solid #E6DFD3', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <h2 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '800', color: '#2C2A29' }}>Sobre MenuKit</h2>
              <p style={{ fontSize: '14px', color: '#57534E', lineHeight: '1.6', margin: '0 0 16px 0' }}>
                <strong>MenuKit</strong> guarda automáticamente todos tus cambios, estados de la lista de la compra y menús semanales para que todo se mantenga exactamente igual al cerrar y abrir la aplicación.
              </p>
            </div>
          ) : pestanaActiva === 'dietas' ? (
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', padding: '24px', border: '1px solid #E6DFD3', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
              <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: '#2C2A29' }}>Mis Dietas</h2>

              <form onSubmit={crearNuevaDieta} style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '8px', color: '#57534E' }}>Crear nueva dieta</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" placeholder="Ej: Dieta Keto, Verano..." value={nuevaDietaNombre} onChange={e => setNuevaDietaNombre(e.target.value)} style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', fontSize: '13px', outline: 'none', backgroundColor: '#FFFFFF', color: '#2C2A29' }} />
                  <button type="submit" disabled={guardandoDieta} style={{ backgroundColor: '#581C87', color: '#fff', border: 'none', padding: '0 16px', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', fontSize: '16px' }}>+</button>
                </div>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => { setDietaSeleccionada(null); setPestanaActiva('menu'); }} style={{ padding: '12px 14px', borderRadius: '12px', border: dietaSeleccionada === null ? '2px solid #581C87' : '1px solid #E6DFD3', backgroundColor: dietaSeleccionada === null ? '#F3E8FF' : '#FFFFFF', fontWeight: '600', textAlign: 'left', cursor: 'pointer', color: dietaSeleccionada === null ? '#581C87' : '#44403C', fontSize: '13px' }}>
                  🌐 Todas las recetas (Sin filtro)
                </button>

                {dietas.map(dieta => (
                  <div key={dieta.id} onClick={() => { setDietaSeleccionada(dieta); setPestanaActiva('menu'); }} style={{ padding: '10px 14px', borderRadius: '12px', border: dietaSeleccionada?.id === dieta.id ? '2px solid #581C87' : '1px solid #E6DFD3', backgroundColor: dietaSeleccionada?.id === dieta.id ? '#F3E8FF' : '#FFFFFF', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: dietaSeleccionada?.id === dieta.id ? '#581C87' : '#44403C', fontSize: '13px' }}>
                    <span>📋 {dieta.nombre}</span>
                    <button onClick={(e) => eliminarDieta(dieta.id, dieta.nombre, e)} style={{ backgroundColor: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Borrar</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#2C2A29', letterSpacing: '-0.5px' }}>Menú Semanal</h1>
                    <span style={{ fontSize: '12px', color: '#78716C', fontWeight: '600' }}>Dieta activa: {dietaSeleccionada ? dietaSeleccionada.nombre : 'Todas las recetas'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button onClick={() => { setModoEdicionId(null); setNuevoNombre(''); setNuevaCategoria('primero'); setNuevosPasos(''); setNuevosIngredientes(''); setNuevasCalorias(''); setNuevoAzucar(''); setNuevaSal(''); setMostrarFormulario(!mostrarFormulario); }} style={{ backgroundColor: '#831843', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', boxShadow: '0 2px 4px rgba(131, 24, 67, 0.2)' }}>
                    + Añadir Receta
                  </button>
                  <button onClick={() => { if (recetas.length >= MINIMO_RECETAS) inicializarDatosUsuario(true); else inicializarDatosUsuario(); }} disabled={cargando || recetas.length < MINIMO_RECETAS} style={{ backgroundColor: recetas.length < MINIMO_RECETAS ? '#D6D3D1' : '#D97706', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '600', cursor: recetas.length < MINIMO_RECETAS ? 'not-allowed' : 'pointer', fontSize: '13px', boxShadow: recetas.length >= MINIMO_RECETAS ? '0 2px 4px rgba(217, 119, 6, 0.25)' : 'none' }}>
                    🎲 Regenerar
                  </button>
                  <button onClick={() => setMostrarSelectorCompra(!mostrarSelectorCompra)} disabled={cargando || menuSemanal.length === 0} style={{ backgroundColor: menuSemanal.length === 0 ? '#D6D3D1' : '#14532D', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '12px', fontWeight: '600', cursor: menuSemanal.length === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', boxShadow: menuSemanal.length > 0 ? '0 2px 4px rgba(20, 83, 45, 0.25)' : 'none' }}>
                    🛒 Lista Compra
                  </button>
                </div>
              </div>

              {mostrarSelectorCompra && (
                <div style={{ border: '1px solid #10B981', borderRadius: '20px', padding: '20px 24px', backgroundColor: '#ECFDF5', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', color: '#065F46' }}>Selecciona días y comidas para la lista</h3>
                      <p style={{ margin: 0, fontSize: '12px', color: '#047857' }}>Marca qué días o comidas quieres incluir en tu lista de la compra.</p>
                    </div>
                    <button onClick={() => setMostrarSelectorCompra(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#047857', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>✕</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {DIAS_SEMANA.map(dia => {
                      const cfg = seleccionDiasCompra[dia] || { comida: true, cena: true };
                      return (
                        <div key={dia} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '12px', border: '1px solid #A7F3D0', fontSize: '13px' }}>
                          <strong style={{ color: '#064E3B', minWidth: '90px' }}>{dia}</strong>
                          <div style={{ display: 'flex', gap: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#065F46', fontWeight: '500' }}>
                              <input 
                                type="checkbox" 
                                checked={cfg.comida} 
                                onChange={e => {
                                  const val = e.target.checked;
                                  setSeleccionDiasCompra(prev => ({
                                    ...prev,
                                    [dia]: { ...prev[dia], comida: val }
                                  }));
                                }}
                                style={{ width: '16px', height: '16px', accentColor: '#10B981', cursor: 'pointer' }}
                              />
                              Comida
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: '#065F46', fontWeight: '500' }}>
                              <input 
                                type="checkbox" 
                                checked={cfg.cena} 
                                onChange={e => {
                                  const val = e.target.checked;
                                  setSeleccionDiasCompra(prev => ({
                                    ...prev,
                                    [dia]: { ...prev[dia], cena: val }
                                  }));
                                }}
                                style={{ width: '16px', height: '16px', accentColor: '#10B981', cursor: 'pointer' }}
                              />
                              Cena
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button onClick={generarListaCompra} style={{ backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}>Generar Lista</button>
                  </div>
                </div>
              )}

              {mostrarFormulario && (
                <div style={{ border: '1px solid #D6D3D1', borderRadius: '20px', padding: '24px', backgroundColor: '#FFFFFF', marginBottom: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#2C2A29' }}>{modoEdicionId ? 'Editar Receta' : 'Añadir Nueva Receta'}</h2>
                    <button type="button" onClick={() => { setMostrarFormulario(false); setModoEdicionId(null); }} style={{ background: '#F5F2EB', border: 'none', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', color: '#57534E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>

                  <form onSubmit={guardarOActualizarReceta} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#44403C' }}>Nombre de la receta *</label>
                      <input type="text" required value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Ej: Tortilla de patatas" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', boxSizing: 'border-box', backgroundColor: '#FFFFFF', color: '#2C2A29', fontSize: '13px', outline: 'none' }} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#44403C' }}>Categoría *</label>
                      <select value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', backgroundColor: '#FFFFFF', color: '#2C2A29', fontSize: '13px', outline: 'none' }}>
                        <option value="primero">Primero</option>
                        <option value="segundo">Segundo</option>
                        <option value="plato unico">Plato Único</option>
                        <option value="cena">Cena</option>
                      </select>
                    </div>

                    <div style={{ backgroundColor: '#F9F8F6', padding: '16px', borderRadius: '14px', border: '1px solid #E7E5E4' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#44403C', marginBottom: '6px' }}>🛒 Filtrar por supermercado</label>
                      <select value={supermercadoSeleccionado} onChange={e => setSupermercadoSeleccionado(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', backgroundColor: '#FFFFFF', color: '#2C2A29', fontSize: '13px', marginBottom: '12px', outline: 'none' }}>
                        {SUPERMERCADOS.map(sup => <option key={sup} value={sup}>{sup}</option>)}
                      </select>

                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#44403C', marginBottom: '6px' }}>🔍 Buscar Producto (Open Food Facts)</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ display: 'flex', flex: 1, position: 'relative', alignItems: 'center' }}>
                          <input type="text" placeholder="Ej: Leche entera..." value={busquedaOFF} onChange={e => setBusquedaOFF(e.target.value)} style={{ width: '100%', padding: '10px 36px 10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box', backgroundColor: '#FFFFFF', color: '#2C2A29', outline: 'none' }} />
                          {busquedaOFF && <button type="button" onClick={limpiarBusqueda} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#78716C' }}>✕</button>}
                        </div>
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
                        <input type="number" min="0" value={nuevasCalorias} onChange={e => setNuevasCalorias(e.target.value === '' ? '' : Number(e.target.value))} placeholder="kcal" style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D6D3D1', boxSizing: 'border-box', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#2C2A29', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#44403C', marginBottom: '4px' }}>🍯 Azúcar (100g)</label>
                        <input type="number" step="0.1" min="0" value={nuevoAzucar} onChange={e => setNuevoAzucar(e.target.value === '' ? '' : Number(e.target.value))} placeholder="g" style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D6D3D1', boxSizing: 'border-box', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#2C2A29', outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#44403C', marginBottom: '4px' }}>🧂 Sal (100g)</label>
                        <input type="number" step="0.1" min="0" value={nuevaSal} onChange={e => setNuevaSal(e.target.value === '' ? '' : Number(e.target.value))} placeholder="g" style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #D6D3D1', boxSizing: 'border-box', fontSize: '13px', backgroundColor: '#FFFFFF', color: '#2C2A29', outline: 'none' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#44403C' }}>Ingredientes y Cantidades</label>
                      </div>
                      <input type="text" value={nuevosIngredientes} onChange={e => setNuevosIngredientes(e.target.value)} placeholder="Ej: patatas: 200g, huevos: 3 unidades" style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', boxSizing: 'border-box', backgroundColor: '#FFFFFF', color: '#2C2A29', fontSize: '13px', outline: 'none' }} />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#44403C' }}>Pasos de preparación</label>
                      <textarea rows={3} value={nuevosPasos} onChange={e => setNuevosPasos(e.target.value)} placeholder="Escribe los pasos de preparación..." style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #D6D3D1', boxSizing: 'border-box', fontFamily: 'inherit', backgroundColor: '#FFFFFF', color: '#2C2A29', fontSize: '13px', outline: 'none' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                      <button type="submit" disabled={guardandoReceta} style={{ flex: 1, backgroundColor: guardandoReceta ? '#D6D3D1' : '#831843', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '14px', boxShadow: '0 2px 4px rgba(131, 24, 67, 0.2)' }}>
                        {guardandoReceta ? 'Guardando...' : (modoEdicionId ? 'Guardar Cambios' : 'Guardar Receta')}
                      </button>
                    </div>
                  </form>
                </div>
              )}

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
                        <p style={{ margin: 0, color: '#047857', fontSize: '13px' }}>No hay elementos en la lista.</p>
                      ) : (
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {listaCompra.map((item, idx) => (
                            <li key={idx} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '10px 14px', borderRadius: '12px', border: '1px solid #D1FAE5', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1, marginRight: '10px' }}>
                                <input type="checkbox" checked={item.comprado} onChange={() => toggleComprado(idx)} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#14532D', flexShrink: 0 }} />
                                <span style={{ textDecoration: (item.comprado || item.enCasa) ? 'line-through' : 'none', color: item.comprado ? '#14532D' : item.enCasa ? '#A8A29E' : '#064E3B', fontWeight: item.enCasa ? 'normal' : '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.nombre}
                                  {item.cantidadTotal !== null && <strong style={{ marginLeft: '4px', color: '#047857' }}>({item.cantidadTotal})</strong>}
                                  {item.unidad && <span style={{ fontSize: '11px', color: '#059669', marginLeft: '3px' }}>{item.unidad}</span>}
                                </span>
                              </div>
                              <button onClick={() => toggleEnCasa(idx)} style={{ background: item.enCasa ? '#F5F2EB' : '#FAFAF9', border: '1px solid #E7E5E4', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: '600', flexShrink: 0 }} title="Ya lo tengo en casa">🏠</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {cargando ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#78716C', fontWeight: '500' }}>Cargando menú guardado...</div>
              ) : recetas.length < MINIMO_RECETAS ? (
                <div style={{ border: '2px dashed #E7E5E4', backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '36px 24px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#2C2A29', fontSize: '18px', fontWeight: '700' }}>Dieta en construcción</h3>
                  <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#78716C', lineHeight: '1.5', maxWidth: '450px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Has añadido <strong>{recetas.length}</strong> de las <strong>{MINIMO_RECETAS}</strong> recetas necesarias.
                  </p>
                  
                  <button onClick={() => { setModoEdicionId(null); setNuevoNombre(''); setNuevaCategoria('primero'); setNuevosPasos(''); setNuevosIngredientes(''); setNuevasCalorias(''); setNuevoAzucar(''); setNuevaSal(''); setMostrarFormulario(true); }} style={{ backgroundColor: '#D97706', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '13px', marginBottom: '24px', boxShadow: '0 2px 4px rgba(217, 119, 6, 0.25)' }}>
                    + Añadir receta(s) más
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {menuSemanal.map((item, indexDia) => {
                    const nutricion = calcularNutricionDia(item);
                    const estaVolteada = tarjetaVolteada[item.dia] || false;
                    const infoRecetaActiva = recetaActivaDia[item.dia];

                    return (
                      <div key={item.dia} style={{ perspective: '1000px', width: '100%' }}>
                        <div style={{
                          position: 'relative',
                          width: '100%',
                          transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
                          transformStyle: 'preserve-3d',
                          transform: estaVolteada ? 'rotateY(180deg)' : 'rotateY(0deg)',
                          borderRadius: '20px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02)'
                        }}>
                          
                          <div style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', border: '1px solid #E6DFD3', borderRadius: '20px', padding: '20px', backgroundColor: '#FFFFFF' }}>
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
                                  <p onClick={() => item.platoUnico && voltearDiaConReceta(item.dia, item.platoUnico, 'Plato Único')} style={{ margin: '2px 0', fontSize: '13px', cursor: item.platoUnico ? 'pointer' : 'default', color: item.platoUnico ? '#44403C' : '#2C2A29', fontWeight: '500' }}>
                                    🍲 <strong style={{ fontWeight: '600' }}>Plato Único:</strong> <span style={{ textDecoration: item.platoUnico ? 'underline' : 'none' }}>{item.platoUnico?.nombre || 'Sin asignar'}</span>
                                  </p>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <p onClick={() => item.primero && voltearDiaConReceta(item.dia, item.primero, 'Primer Plato')} style={{ margin: 0, fontSize: '13px', cursor: item.primero ? 'pointer' : 'default', color: item.primero ? '#44403C' : '#2C2A29', fontWeight: '500' }}>
                                      <strong style={{ color: '#78716C', fontWeight: '600' }}>1.º:</strong> <span style={{ textDecoration: item.primero ? 'underline' : 'none' }}>{item.primero?.nombre || 'Sin asignar'}</span>
                                    </p>
                                    <p onClick={() => item.segundo && voltearDiaConReceta(item.dia, item.segundo, 'Segundo Plato')} style={{ margin: 0, fontSize: '13px', cursor: item.segundo ? 'pointer' : 'default', color: item.segundo ? '#44403C' : '#2C2A29', fontWeight: '500' }}>
                                      <strong style={{ color: '#78716C', fontWeight: '600' }}>2.º:</strong> <span style={{ textDecoration: item.segundo ? 'underline' : 'none' }}>{item.segundo?.nombre || 'Sin asignar'}</span>
                                    </p>
                                  </div>
                                )}
                              </div>

                              <div style={{ backgroundColor: '#F0FDF4', padding: '14px', borderRadius: '14px', border: '1px solid #DCFCE7' }}>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#166534', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>🌙 Cena</h4>
                                <p onClick={() => item.cena && voltearDiaConReceta(item.dia, item.cena, 'Cena')} style={{ margin: 0, fontSize: '13px', color: item.cena ? '#15803D' : '#2C2A29', cursor: item.cena ? 'pointer' : 'default', fontWeight: '500' }}>
                                  🍽️ <span style={{ textDecoration: item.cena ? 'underline' : 'none' }}>{item.cena?.nombre || 'Sin asignar'}</span>
                                </p>
                              </div>
                            </div>
                          </div>

                          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', border: '1px solid #D6D3D1', borderRadius: '20px', padding: '20px', backgroundColor: '#FFFFFF', boxSizing: 'border-box', display: estaVolteada ? 'block' : 'none', overflowY: 'auto' }}>
                            {infoRecetaActiva && (
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                  <span style={{ fontSize: '11px', backgroundColor: '#F5F2EB', color: '#57534E', padding: '3px 8px', borderRadius: '6px', fontWeight: '700', textTransform: 'uppercase' }}>{infoRecetaActiva.tipo}</span>
                                  <button onClick={() => volverAlMenuDia(item.dia)} style={{ backgroundColor: '#F5F2EB', color: '#44403C', border: '1px solid #D6D3D1', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>↩ Volver al menú</button>
                                </div>

                                <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '750', color: '#2C2A29' }}>📖 {infoRecetaActiva.receta.nombre}</h3>
                                
                                <div style={{ display: 'flex', gap: '10px', backgroundColor: '#F9F8F6', padding: '8px 12px', borderRadius: '10px', margin: '10px 0', fontSize: '11px', fontWeight: '600', color: '#44403C', flexWrap: 'wrap', border: '1px solid #E7E5E4' }}>
                                  <span>🔥 {infoRecetaActiva.receta.calorias || 0} kcal (100g)</span>
                                  <span>🍯 {infoRecetaActiva.receta.azucar_g || 0}g azúcar</span>
                                  <span>🧂 {infoRecetaActiva.receta.sal_g || 0}g sal</span>
                                </div>

                                <div style={{ marginBottom: '12px' }}>
                                  <strong style={{ fontSize: '12px', color: '#2C2A29', display: 'block', marginBottom: '4px' }}>🥕 Ingredientes:</strong>
                                  {cargandoIngredientesDia ? (
                                    <p style={{ margin: 0, fontSize: '12px', color: '#78716C' }}>Cargando...</p>
                                  ) : ingredientesRecetaDia.length === 0 ? (
                                    <p style={{ margin: 0, fontSize: '12px', color: '#78716C' }}>Sin ingredientes.</p>
                                  ) : (
                                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#44403C', lineHeight: '1.4' }}>
                                      {ingredientesRecetaDia.map((ing, i) => (
                                        <li key={i}>{ing.nombre} {ing.cantidad ? `- ${ing.cantidad}` : ''}</li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                                
                                <div>
                                  <strong style={{ fontSize: '12px', color: '#2C2A29', display: 'block', marginBottom: '4px' }}>📝 Pasos de preparación:</strong>
                                  <p style={{ margin: 0, whiteSpace: 'pre-line', color: '#44403C', fontSize: '12px', lineHeight: '1.5', backgroundColor: '#F9F8F6', padding: '10px', borderRadius: '10px', border: '1px solid #E7E5E4' }}>{infoRecetaActiva.receta.pasos || 'Sin pasos añadidos.'}</p>
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, width: '100%', backgroundColor: '#FFFFFF', borderTop: '1px solid #E6DFD3', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px', padding: '6px 0', zIndex: 1000, boxShadow: '0 -4px 10px rgba(0,0,0,0.02)' }}>
        <button onClick={() => { setPestanaActiva('menu'); setTarjetaVolteada({}); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '10px', fontWeight: '600', color: pestanaActiva === 'menu' ? '#831843' : '#78716C', gap: '2px' }}>
          Menú Semanal
        </button>
        <button onClick={() => setPestanaActiva('dietas')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '10px', fontWeight: '600', color: pestanaActiva === 'dietas' ? '#831843' : '#78716C', gap: '2px' }}>
          Mis Dietas
        </button>
        <button onClick={() => setPestanaActiva('sobre')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: '10px', fontWeight: '600', color: pestanaActiva === 'sobre' ? '#831843' : '#78716C', gap: '2px' }}>
          Sobre MenuKit
        </button>
      </div>
    </div>
  );
}