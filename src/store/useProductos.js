import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, productoDeDB, productoParaDB } from '../lib/supabase'
import { generarId } from '../utils/formatear'

export const useProductos = create(
  persist(
    (set, get) => ({
      productos: [],

      sincronizarDesdeSupabase: async () => {
        try {
          const { data, error } = await supabase
            .from('productos')
            .select('*')
            .order('created_at')
          if (error) { console.warn('Supabase productos:', error.message); return }
          set({ productos: data.map(productoDeDB) })
        } catch (e) {
          console.warn('Error sync productos:', e)
        }
      },

      agregarProducto: async (datos) => {
        const nuevo = {
          ...datos,
          id: datos.id?.trim() || generarId(),
          vendidos: 0,
          creadoEn: new Date().toISOString(),
          actualizadoEn: new Date().toISOString(),
        }
        const { error } = await supabase.from('productos').insert(productoParaDB(nuevo))
        if (error) throw new Error(error.message)
        set(s => ({ productos: [...s.productos, nuevo] }))
        return nuevo
      },

      editarProducto: async (id, datos) => {
        const actual = get().productos.find(p => p.id === id)
        if (!actual) return
        const actualizado = { ...actual, ...datos, actualizadoEn: new Date().toISOString() }
        const { error } = await supabase.from('productos')
          .update({ ...productoParaDB(actualizado), updated_at: actualizado.actualizadoEn })
          .eq('id', id)
        if (error) throw new Error(error.message)
        set(s => ({ productos: s.productos.map(p => p.id === id ? actualizado : p) }))
      },

      eliminarProducto: async (id) => {
        const { error } = await supabase.from('productos').delete().eq('id', id)
        if (error) throw new Error(error.message)
        set(s => ({ productos: s.productos.filter(p => p.id !== id) }))
      },

      limpiarProductos: async () => {
        const { error } = await supabase.from('productos').delete().neq('id', '__never__')
        if (error) throw new Error(error.message)
        set({ productos: [] })
      },

      toggleActivo: (id) => {
        const p = get().productos.find(prod => prod.id === id)
        if (!p) return
        const nuevoActivo = !p.activo
        set(s => ({
          productos: s.productos.map(prod =>
            prod.id === id ? { ...prod, activo: nuevoActivo, actualizadoEn: new Date().toISOString() } : prod
          ),
        }))
        supabase.from('productos')
          .update({ activo: nuevoActivo, updated_at: new Date().toISOString() })
          .eq('id', id)
          .then(({ error }) => {
            if (error) {
              console.error('Error toggleActivo:', error)
              set(s => ({
                productos: s.productos.map(prod =>
                  prod.id === id ? { ...prod, activo: p.activo } : prod
                ),
              }))
            }
          })
      },

      toggleDestacado: (id) => {
        const p = get().productos.find(prod => prod.id === id)
        if (!p) return
        const nuevoDestacado = !p.destacado
        set(s => ({
          productos: s.productos.map(prod =>
            prod.id === id ? { ...prod, destacado: nuevoDestacado, actualizadoEn: new Date().toISOString() } : prod
          ),
        }))
        supabase.from('productos')
          .update({ destacado: nuevoDestacado, updated_at: new Date().toISOString() })
          .eq('id', id)
          .then(({ error }) => {
            if (error) {
              console.error('Error toggleDestacado:', error)
              set(s => ({
                productos: s.productos.map(prod =>
                  prod.id === id ? { ...prod, destacado: p.destacado } : prod
                ),
              }))
            }
          })
      },

      // Aplica el mismo encuadre de portada (zoom + posición) a todos los
      // productos con fotos de una categoría; cada uno conserva su propia
      // foto de portada (capa.indice).
      aplicarCapaACategoria: async (categoriaId, ajuste) => {
        const ahora = new Date().toISOString()
        const actualizados = get().productos
          .filter(p => p.categoriaId === categoriaId && (p.fotos?.length || 0) > 0)
          .map(p => ({
            ...p,
            capa: {
              indice: Number.isInteger(p.capa?.indice) ? p.capa.indice : 0,
              zoom: ajuste.zoom ?? 1,
              x: ajuste.x ?? 50,
              y: ajuste.y ?? 50,
              v: 2,
            },
            actualizadoEn: ahora,
          }))
        if (actualizados.length === 0) return 0

        const resultados = await Promise.all(actualizados.map(p =>
          supabase.from('productos')
            .update({ capa: p.capa, updated_at: ahora })
            .eq('id', p.id)
        ))
        const exitosos = new Set(actualizados.filter((_, i) => !resultados[i].error).map(p => p.id))
        if (exitosos.size > 0) {
          set(s => ({
            productos: s.productos.map(p =>
              exitosos.has(p.id) ? actualizados.find(a => a.id === p.id) : p
            ),
          }))
        }
        const conError = resultados.find(r => r.error)
        if (conError) throw new Error(`Se aplicó a ${exitosos.size} de ${actualizados.length} productos. Error: ${conError.error.message}`)
        return exitosos.size
      },

      actualizarStock: async (id, cantidad) => {
        const nuevoStock = Math.max(0, cantidad)
        const { error } = await supabase.from('productos')
          .update({ stock: nuevoStock, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw new Error(error.message)
        set(s => ({
          productos: s.productos.map(p =>
            p.id === id ? { ...p, stock: nuevoStock, actualizadoEn: new Date().toISOString() } : p
          ),
        }))
      },

      descontarStock: async (id, cantidad) => {
        const p = get().productos.find(prod => prod.id === id)
        if (!p) return
        const nuevoStock = Math.max(0, p.stock - cantidad)
        const nuevosVendidos = (p.vendidos || 0) + cantidad
        const { error } = await supabase.from('productos')
          .update({ stock: nuevoStock, vendidos: nuevosVendidos, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw new Error(error.message)
        set(s => ({
          productos: s.productos.map(prod =>
            prod.id === id
              ? { ...prod, stock: nuevoStock, vendidos: nuevosVendidos, actualizadoEn: new Date().toISOString() }
              : prod
          ),
        }))
      },

      getProducto: (id) => get().productos.find(p => p.id === id),
      getProductosActivos: () => get().productos.filter(p => p.activo),
      getDestacados: () => get().productos.filter(p => p.activo && p.destacado),
      getPorCategoria: (categoriaId) => get().productos.filter(p => p.activo && p.categoriaId === categoriaId),
      getMasVendidos: () => [...get().productos.filter(p => p.activo)].sort((a, b) => (b.vendidos || 0) - (a.vendidos || 0)),
      getBajoStock: () => get().productos.filter(p => p.activo && p.stock > 0 && p.stock <= p.stockMinimo),
      getAgotados: () => get().productos.filter(p => p.activo && p.stock === 0),
    }),
    { name: 'yf-productos' }
  )
)
