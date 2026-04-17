// --- API Response wrapper ---
export interface PosApiResponse<T> {
  tipo: number | string
  data: T
  mensajes: string[]
}

// --- Dominio (locales, métodos de pago) ---
export interface PosLocal {
  local_id: string
  local_descripcion: string
  local_aceptadelivery?: string
  almacenes?: PosAlmacen[]
}

export interface PosAlmacen {
  almacen_id: string
  almacen_descripcion: string
}

export interface PosDominioData {
  locales: PosLocal[]
  tarjetas: unknown[]
  motorizados: unknown[]
  usuarios: unknown[]
  node?: unknown
}

// --- Ventas (estructura real de la API) ---
export interface PosVenta {
  ID: string
  serie: string
  correlativo: string
  documento: string
  fecha: string
  tipo_pago: string
  id_local: number
  caja_id: number | string
  turno_id?: number | string
  subtotal: string
  descuento: string
  impuestos: string
  total: string
  estado: string
  estado_txt: string
  canalventa: string
  nombre_canaldelivery: string
  venta_observaciones: string | null
  tipo_documento: string // F=Factura, B=Boleta, NV=Nota de Venta
  suma_impuestos: string
  costoenvio: string
  lista_propinas: PosPropina[]
  detalle: PosVentaItem[]
  pagosList: PosPago[]
  cliente: PosCliente | null
  [key: string]: unknown
}

export interface PosVentaItem {
  id_detalle: string
  id_producto: string
  nombre_producto: string
  cantidad_vendida: string
  precio_unitario: string
  descuento_unitario: string
  venta_total: string
  categoria_descripcion: string
  [key: string]: unknown
}

export interface PosPropina {
  montoConIgv: string
  montoSinIgv: string
  tipoPago: string
  tipoTarjeta: string
}

export interface PosPago {
  tipoPago?: string
  monto?: string
  [key: string]: unknown
}

export interface PosCliente {
  cliente_nombres?: string
  cliente_apellidos?: string
  cliente_dniruc?: string
  cliente_email?: string
  [key: string]: unknown
}

// --- Catálogo de productos (endpoint obtenerCartaPorLocal) ---
export interface PosProducto {
  productogeneral_id: number | string
  productogeneral_descripcion: string
  productogeneral_urlimagen?: string | null
  categoria_id?: number | string
  categoria_descripcion?: string
  lista_presentacion?: PosPresentacion[]
  listaModificadores?: PosModificador[]
  lista_agrupadores?: unknown[]
  notas?: unknown[]
  [key: string]: unknown
}

export interface PosPresentacion {
  producto_id: number | string
  producto_presentacion: string
  producto_precio: number | string
  producto_delivery?: number | string
  producto_urlimagen?: string | null
}

export interface PosModificador {
  modificadorseleccion_id: number | string
  modificadorseleccion_nombre: string
  modificadorseleccion_tipo?: number | string
  modificadorseleccion_precio?: number | string
  modificadorseleccion_urlimagen?: string | null
}
