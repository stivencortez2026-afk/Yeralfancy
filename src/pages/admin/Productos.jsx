import { useRef, useState } from 'react'
import { Plus, Edit2, Trash2, Eye, EyeOff, Star, Search, Package, Upload, X, RotateCcw, ZoomIn, ZoomOut, Layers } from 'lucide-react'
import { useProductos } from '../../store/useProductos'
import { useCategorias } from '../../store/useCategorias'
import { subirImagenProducto } from '../../lib/supabase'
import { useAdminToast } from '../../layouts/LayoutAdmin'
import { Modal } from '../../components/ui/Modal'
import { formatearPrecio, calcularGanancia, calcularMargen, generarId } from '../../utils/formatear'
import { imgSrc, estiloCapa, fotoCapa, normalizarCapa, ZOOM_MIN, ZOOM_MAX } from '../../utils/imagen'
import { EstadoVacio } from '../../components/ui/Cargando'

const PRODUCTO_VACIO = { id: '', nombre: '', descripcion: '', categoriaId: '', precioCosto: '', precioVenta: '', stock: '', stockMinimo: '5', fotos: [], capa: null, destacado: false, activo: true }
const CAPA_DEFAULT = { indice: 0, zoom: 1, x: 50, y: 50, v: 2 }
const MAX_FOTOS = 5
const LIMITE_MB = 12
const LIMITE_BYTES = LIMITE_MB * 1024 * 1024

const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const redondear1 = (v) => Math.round(v * 10) / 10

function EditorCapa({ foto, capa, onCambio, categoria, onAplicarCategoria }) {
  const contRef = useRef(null)
  const dragRef = useRef(null)
  const punterosRef = useRef(new Map())
  const pinchRef = useRef(null)
  const [interactuando, setInteractuando] = useState(false)

  const zoom = capa.zoom ?? 1

  const cambiarZoom = (valor) => {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, valor))
    // Pequeño imán en 100% para volver fácil al encuadre sin zoom
    onCambio({ ...capa, zoom: Math.abs(z - 1) < 0.03 ? 1 : Math.round(z * 100) / 100 })
  }

  const alPresionar = (e) => {
    e.preventDefault()
    punterosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    e.currentTarget.setPointerCapture(e.pointerId)
    const puntos = [...punterosRef.current.values()]
    if (puntos.length >= 2) {
      dragRef.current = null
      pinchRef.current = { dist: distancia(puntos[0], puntos[1]), zoom }
    } else {
      dragRef.current = { px: e.clientX, py: e.clientY, x: capa.x ?? 50, y: capa.y ?? 50 }
    }
    setInteractuando(true)
  }

  const alMover = (e) => {
    if (!punterosRef.current.has(e.pointerId)) return
    punterosRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const puntos = [...punterosRef.current.values()]

    if (puntos.length >= 2 && pinchRef.current) {
      const d = distancia(puntos[0], puntos[1])
      if (d > 0 && pinchRef.current.dist > 0) cambiarZoom(pinchRef.current.zoom * (d / pinchRef.current.dist))
      return
    }

    if (!dragRef.current || !contRef.current) return
    const rect = contRef.current.getBoundingClientRect()
    // Con zoom, la misma distancia de dedo mueve menos imagen visible
    const dx = ((e.clientX - dragRef.current.px) / (rect.width * zoom)) * 100
    const dy = ((e.clientY - dragRef.current.py) / (rect.height * zoom)) * 100
    onCambio({
      ...capa,
      x: redondear1(Math.min(100, Math.max(0, dragRef.current.x - dx))),
      y: redondear1(Math.min(100, Math.max(0, dragRef.current.y - dy))),
    })
  }

  const alSoltar = (e) => {
    punterosRef.current.delete(e.pointerId)
    const puntos = [...punterosRef.current.values()]
    if (puntos.length < 2) pinchRef.current = null
    if (puntos.length === 1) {
      dragRef.current = { px: puntos[0].x, py: puntos[0].y, x: capa.x ?? 50, y: capa.y ?? 50 }
    } else if (puntos.length === 0) {
      dragRef.current = null
      setInteractuando(false)
    }
  }

  return (
    <div className="mt-3 p-3 bg-marca-beige/40 rounded-xl border border-marca-beige-borde">
      <p className="text-xs font-medium text-marca-negro">Ajustar portada</p>
      <p className="text-[11px] text-marca-texto-suave mt-0.5 mb-2.5">
        Arrastra para encuadrar, pellizca o usa el control para el zoom. Así se verá en la tienda.
      </p>

      <div
        ref={contRef}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        className="relative w-40 mx-auto aspect-[4/5] rounded-[16px] overflow-hidden bg-marca-beige cursor-move touch-none select-none"
      >
        {zoom < 1 && (
          <img
            src={imgSrc(foto, 100, 40)}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-70 pointer-events-none"
          />
        )}
        <img
          src={imgSrc(foto, zoom > 1 ? 800 : 400)}
          alt=""
          draggable={false}
          className="relative w-full h-full object-cover pointer-events-none"
          style={estiloCapa(capa)}
        />
        {/* Guías de encuadre mientras se ajusta */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity duration-200 ${interactuando ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/60" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/60" />
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/60" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/60" />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          onClick={() => cambiarZoom(zoom - 0.1)}
          className="w-7 h-7 shrink-0 rounded-lg bg-white border border-marca-beige-borde flex items-center justify-center text-marca-texto-suave hover:text-marca-negro active:scale-95 transition-all"
          aria-label="Alejar"
        >
          <ZoomOut size={14} />
        </button>
        <input
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step="0.05"
          value={zoom}
          onChange={e => cambiarZoom(Number(e.target.value))}
          className="flex-1 min-w-0 accent-marca-marron"
          aria-label="Zoom de la portada"
        />
        <button
          type="button"
          onClick={() => cambiarZoom(zoom + 0.1)}
          className="w-7 h-7 shrink-0 rounded-lg bg-white border border-marca-beige-borde flex items-center justify-center text-marca-texto-suave hover:text-marca-negro active:scale-95 transition-all"
          aria-label="Acercar"
        >
          <ZoomIn size={14} />
        </button>
        <span className="w-11 shrink-0 text-right text-[11px] font-semibold text-marca-negro tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-2.5">
        <button
          type="button"
          onClick={() => onCambio({ ...capa, zoom: 1, x: 50, y: 50 })}
          className="flex items-center gap-1.5 text-[11px] font-medium text-marca-texto-suave hover:text-marca-negro transition-colors"
        >
          <RotateCcw size={12} /> Restablecer
        </button>
        <button
          type="button"
          onClick={onAplicarCategoria}
          disabled={!categoria}
          title={categoria ? `Aplicar este encuadre a todos los productos de "${categoria.nombre}"` : 'Elige una categoría primero'}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-marca-marron hover:text-marca-marron-oscuro disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Layers size={12} /> Aplicar a toda la categoría
        </button>
      </div>
    </div>
  )
}

function SelectorFotosProducto({ fotos, onCambio, capa, onCambioCapa, categoria, onAplicarCategoria }) {
  const inputRef = useRef(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const restantes = MAX_FOTOS - fotos.length
  const indiceCapa = Number.isInteger(capa?.indice) && capa.indice < fotos.length ? capa.indice : 0

  const manejarArchivos = async (archivos) => {
    setError('')
    const lista = Array.from(archivos || []).slice(0, restantes)
    if (lista.length === 0) return

    if (lista.some(a => !a.type.startsWith('image/'))) {
      setError('Solo se permiten imagenes.')
      return
    }
    if (lista.some(a => a.size > LIMITE_BYTES)) {
      setError(`Cada imagen debe pesar maximo ${LIMITE_MB} MB.`)
      return
    }

    setSubiendo(true)
    try {
      const urls = await Promise.all(lista.map(archivo => subirImagenProducto(archivo)))
      onCambio([...fotos, ...urls].slice(0, MAX_FOTOS))
    } catch (e) {
      setError('Error al subir imagenes: ' + e.message)
    } finally {
      setSubiendo(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const quitarFoto = (i) => {
    onCambio(fotos.filter((_, idx) => idx !== i))
    if (i === indiceCapa) onCambioCapa(null)
    else if (i < indiceCapa) onCambioCapa({ ...(normalizarCapa(capa) || CAPA_DEFAULT), indice: indiceCapa - 1 })
  }

  const elegirCapa = (i) => {
    if (i === indiceCapa) return
    onCambioCapa({ ...CAPA_DEFAULT, indice: i })
  }

  return (
    <div>
      <label className="etiqueta">Fotos del producto - max. {MAX_FOTOS}</label>
      <div
        onDrop={e => { e.preventDefault(); manejarArchivos(e.dataTransfer.files) }}
        onDragOver={e => e.preventDefault()}
        onClick={() => restantes > 0 && inputRef.current?.click()}
        className={`cursor-pointer border-2 border-dashed border-marca-beige-borde rounded-xl flex flex-col items-center justify-center gap-2 py-6 hover:border-marca-marron hover:bg-marca-beige/40 transition-colors ${restantes <= 0 ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        {subiendo ? (
          <div className="flex flex-col items-center gap-2 text-marca-texto-suave">
            <div className="w-6 h-6 border-2 border-marca-marron border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Subiendo...</span>
          </div>
        ) : (
          <>
            <Upload size={24} className="text-marca-marron" />
            <span className="text-sm font-medium text-marca-negro">Haz clic o arrastra imagenes aqui</span>
            <span className="text-xs text-marca-texto-suave">Puedes agregar {restantes} mas - JPG, PNG, WEBP</span>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => manejarArchivos(e.target.files)}
      />

      {fotos.length > 0 && (
        <>
          <p className="text-[11px] text-marca-texto-suave mt-3 mb-1.5">Toca una foto para usarla como portada del card.</p>
          <div className="grid grid-cols-5 gap-2">
            {fotos.map((foto, i) => (
              <div
                key={`${foto}-${i}`}
                onClick={() => elegirCapa(i)}
                className={`relative aspect-square rounded-xl overflow-hidden bg-marca-beige cursor-pointer transition-all ${i === indiceCapa ? 'ring-2 ring-marca-marron ring-offset-1' : 'hover:opacity-80'}`}
              >
                <img src={foto} alt="" className="w-full h-full object-cover" />
                {i === indiceCapa && (
                  <span className="absolute bottom-0 inset-x-0 bg-marca-marron text-white text-[9px] font-semibold text-center py-0.5">Portada</span>
                )}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); quitarFoto(i) }}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <EditorCapa
            foto={fotos[indiceCapa]}
            capa={{ ...CAPA_DEFAULT, ...(normalizarCapa(capa) || {}), indice: indiceCapa }}
            onCambio={onCambioCapa}
            categoria={categoria}
            onAplicarCategoria={onAplicarCategoria}
          />
        </>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function FormularioProducto({ datos, setDatos, categorias, onGuardar, onCancelar, esNuevo }) {
  const productos = useProductos(s => s.productos)
  const aplicarCapaACategoria = useProductos(s => s.aplicarCapaACategoria)
  const toast = useAdminToast()
  const categoriaActual = categorias.find(c => c.id === datos.categoriaId) || null

  const ganancia = datos.precioCosto && datos.precioVenta
    ? calcularGanancia(Number(datos.precioCosto), Number(datos.precioVenta))
    : null

  const manejarAplicarCategoria = async () => {
    if (!categoriaActual) return
    const ajuste = normalizarCapa(datos.capa) || { ...CAPA_DEFAULT }
    const objetivo = productos.filter(p => p.categoriaId === categoriaActual.id && (p.fotos?.length || 0) > 0)
    if (objetivo.length === 0) {
      toast('No hay productos con fotos en esta categoría todavía', 'aviso')
      return
    }
    const ok = confirm(
      `¿Aplicar este encuadre (zoom ${Math.round((ajuste.zoom ?? 1) * 100)}% y posición) a ${objetivo.length} producto(s) de "${categoriaActual.nombre}"?\n\nCada producto conserva su propia foto de portada.`
    )
    if (!ok) return
    try {
      const n = await aplicarCapaACategoria(categoriaActual.id, ajuste)
      toast(`Encuadre aplicado a ${n} producto(s) de "${categoriaActual.nombre}"`, 'exito')
    } catch (err) {
      toast('Error al aplicar a la categoría: ' + err.message, 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="etiqueta">
          Código del producto
          {esNuevo && <span className="text-[11px] font-normal text-marca-texto-suave ml-1">— vacío = autogenerar</span>}
        </label>
        {esNuevo ? (
          <input
            value={datos.id || ''}
            onChange={e => setDatos(d => ({ ...d, id: e.target.value.replace(/[^a-zA-Z0-9\-_]/g, '').toUpperCase().slice(0, 30) }))}
            className="input-campo font-mono"
            placeholder="Ej: PUL-001"
          />
        ) : (
          <div className="px-3 py-2.5 bg-marca-beige/60 rounded-xl text-marca-texto-suave font-mono text-sm select-all border border-marca-beige-borde">{datos.id}</div>
        )}
      </div>
      <div>
        <label className="etiqueta">Nombre *</label>
        <input value={datos.nombre} onChange={e => setDatos(d => ({ ...d, nombre: e.target.value }))} className="input-campo" placeholder="Nombre del producto" />
      </div>
      <div>
        <label className="etiqueta">Descripción</label>
        <textarea value={datos.descripcion} onChange={e => setDatos(d => ({ ...d, descripcion: e.target.value }))} className="input-campo resize-none" rows={3} placeholder="Descripción del producto..." />
      </div>
      <div>
        <label className="etiqueta">Categoría</label>
        <select value={datos.categoriaId} onChange={e => setDatos(d => ({ ...d, categoriaId: e.target.value }))} className="input-campo">
          <option value="">Seleccionar categoría</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="etiqueta">Precio de costo (USD)</label>
          <input type="number" min="0" step="0.01" value={datos.precioCosto} onChange={e => setDatos(d => ({ ...d, precioCosto: e.target.value }))} className="input-campo" placeholder="0.00" />
        </div>
        <div>
          <label className="etiqueta">Precio de venta (USD)</label>
          <input type="number" min="0" step="0.01" value={datos.precioVenta} onChange={e => setDatos(d => ({ ...d, precioVenta: e.target.value }))} className="input-campo" placeholder="0.00" />
        </div>
      </div>
      {ganancia !== null && (
        <div className="flex gap-2 text-xs">
          <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg font-medium">
            Ganancia: {formatearPrecio(ganancia)}
          </span>
          <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-medium">
            Margen: {calcularMargen(Number(datos.precioCosto), Number(datos.precioVenta)).toFixed(1)}%
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="etiqueta">Stock actual</label>
          <input type="number" min="0" value={datos.stock} onChange={e => setDatos(d => ({ ...d, stock: e.target.value }))} className="input-campo" placeholder="0" />
        </div>
        <div>
          <label className="etiqueta">Stock mínimo</label>
          <input type="number" min="0" value={datos.stockMinimo} onChange={e => setDatos(d => ({ ...d, stockMinimo: e.target.value }))} className="input-campo" placeholder="5" />
        </div>
      </div>
      <div>
        <SelectorFotosProducto
          fotos={datos.fotos || []}
          onCambio={fotos => setDatos(d => ({ ...d, fotos }))}
          capa={datos.capa || null}
          onCambioCapa={capa => setDatos(d => ({ ...d, capa }))}
          categoria={categoriaActual}
          onAplicarCategoria={manejarAplicarCategoria}
        />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={datos.activo} onChange={e => setDatos(d => ({ ...d, activo: e.target.checked }))} className="w-4 h-4 accent-marca-marron" />
          <span className="text-sm font-medium text-marca-negro">Activo</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={datos.destacado} onChange={e => setDatos(d => ({ ...d, destacado: e.target.checked }))} className="w-4 h-4 accent-marca-marron" />
          <span className="text-sm font-medium text-marca-negro">Destacado</span>
        </label>
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancelar} className="flex-1 btn-outline py-3">Cancelar</button>
        <button onClick={onGuardar} className="flex-1 btn-primario py-3">Guardar</button>
      </div>
    </div>
  )
}

export default function Productos() {
  const { productos, agregarProducto, editarProducto, eliminarProducto, toggleActivo, toggleDestacado } = useProductos()
  const categorias = useCategorias(s => s.getActivas())
  const toast = useAdminToast()
  const getCat = useCategorias(s => s.getCategoria)

  const [busqueda, setBusqueda] = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [nuevo, setNuevo] = useState({ ...PRODUCTO_VACIO })

  const terminoBusqueda = busqueda.replace(/^#/, '').toLowerCase()
  const filtrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(terminoBusqueda) ||
    p.id.toLowerCase().includes(terminoBusqueda)
  )

  const manejarGuardarNuevo = async () => {
    if (!nuevo.nombre.trim() || !nuevo.precioVenta) { toast('Completa nombre y precio de venta', 'error'); return }
    if (nuevo.id && productos.some(p => p.id === nuevo.id)) { toast('Ese código ya está en uso', 'error'); return }
    try {
      await agregarProducto({ ...nuevo, precioCosto: Number(nuevo.precioCosto) || 0, precioVenta: Number(nuevo.precioVenta), stock: Number(nuevo.stock) || 0, stockMinimo: Number(nuevo.stockMinimo) || 5 })
      setModalNuevo(false)
      setNuevo({ ...PRODUCTO_VACIO })
      toast('Producto creado correctamente', 'exito')
    } catch (err) {
      toast('Error al guardar producto: ' + err.message, 'error')
    }
  }

  const manejarGuardarEditar = async () => {
    if (!modalEditar.nombre.trim() || !modalEditar.precioVenta) { toast('Completa nombre y precio', 'error'); return }
    try {
      await editarProducto(modalEditar.id, { ...modalEditar, precioCosto: Number(modalEditar.precioCosto) || 0, precioVenta: Number(modalEditar.precioVenta), stock: Number(modalEditar.stock) || 0, stockMinimo: Number(modalEditar.stockMinimo) || 5 })
      setModalEditar(null)
      toast('Producto actualizado correctamente', 'exito')
    } catch (err) {
      toast('Error al actualizar producto: ' + err.message, 'error')
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-xl text-marca-negro">Productos</h1>
        <button onClick={() => setModalNuevo(true)} className="btn-primario py-2 px-4 text-sm flex items-center gap-2">
          <Plus size={16} /> Nuevo
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-marca-texto-suave" />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar productos..." className="input-campo pl-9" />
      </div>

      <div className="bg-white rounded-2xl shadow-tarjeta overflow-hidden">
        {filtrados.length === 0 ? (
          <EstadoVacio icono={<Package size={32} className="text-marca-beige-borde" />} titulo="Sin productos" descripcion="Agrega tu primer producto." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-marca-beige text-marca-texto-suave text-xs">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Producto</th>
                  <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Costo</th>
                  <th className="text-right px-4 py-3 font-medium">Precio</th>
                  <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Stock</th>
                  <th className="text-center px-4 py-3 font-medium hidden lg:table-cell">Estado</th>
                  <th className="text-right px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-marca-beige-borde">
                {filtrados.map(p => {
                  const cat = getCat(p.categoriaId)
                  const sinStock = p.stock === 0
                  const bajoStock = !sinStock && p.stock <= p.stockMinimo
                  return (
                    <tr key={p.id} className={`hover:bg-marca-beige/30 transition-colors ${!p.activo ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-marca-beige shrink-0">
                            {fotoCapa(p) ? <img src={fotoCapa(p)} alt="" className="w-full h-full object-cover" style={estiloCapa(p.capa)} /> : <Package size={16} className="text-marca-beige-borde m-auto mt-3" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-marca-negro truncate max-w-[140px]">{p.nombre}</p>
                            <p className="text-xs text-marca-texto-suave">{cat?.nombre || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell text-marca-texto-suave">{formatearPrecio(p.precioCosto)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-marca-negro">{formatearPrecio(p.precioVenta)}</td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sinStock ? 'bg-red-50 text-red-600' : bajoStock ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {sinStock ? 'Agotado' : bajoStock ? `Bajo (${p.stock})` : p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${p.activo ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                          {p.destacado && <Star size={12} className="text-amber-500 fill-amber-500" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => toggleDestacado(p.id)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${p.destacado ? 'bg-amber-50 text-amber-500' : 'hover:bg-marca-beige text-marca-texto-suave'}`} title={p.destacado ? 'Quitar destacado' : 'Destacar'}>
                            <Star size={14} />
                          </button>
                          <button onClick={() => toggleActivo(p.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-marca-beige text-marca-texto-suave transition-colors" title={p.activo ? 'Desactivar' : 'Activar'}>
                            {p.activo ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button onClick={() => setModalEditar({ ...p })} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-marca-beige text-marca-texto-suave transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={async () => { if (confirm(`¿Eliminar "${p.nombre}"?`)) { try { await eliminarProducto(p.id); toast('Producto eliminado', 'aviso') } catch(e) { toast('Error al eliminar: ' + e.message, 'error') } } }} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal abierto={modalNuevo} onCerrar={() => setModalNuevo(false)} titulo="Nuevo producto" tamano="md">
        <FormularioProducto datos={nuevo} setDatos={setNuevo} categorias={categorias} onGuardar={manejarGuardarNuevo} onCancelar={() => setModalNuevo(false)} esNuevo />
      </Modal>

      <Modal abierto={!!modalEditar} onCerrar={() => setModalEditar(null)} titulo="Editar producto" tamano="md">
        {modalEditar && <FormularioProducto datos={modalEditar} setDatos={setModalEditar} categorias={categorias} onGuardar={manejarGuardarEditar} onCancelar={() => setModalEditar(null)} />}
      </Modal>
    </div>
  )
}
