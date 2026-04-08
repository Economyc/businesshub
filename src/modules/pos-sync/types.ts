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
  subtotal: string
  descuento: string
  impuestos: string
  total: string
  estado: string
  estado_txt: string
  canalventa: string
  nombre_canaldelivery: string
  venta_observaciones: string | null
  tipo_documento: string // F=Factura, B=Boleta
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

// --- Catálogo de productos ---
export interface PosProducto {
  producto_id: number | string
  producto_descripcion: string
  producto_precio: number | string
  producto_estado: number | string
  categoria_nombre?: string
  presentaciones?: PosPresentacion[]
  modificadores?: PosModificador[]
  [key: string]: unknown
}

export interface PosPresentacion {
  presentacion_id: number | string
  presentacion_descripcion: string
  presentacion_precio: number | string
}

export interface PosModificador {
  modificador_id: number | string
  modificador_nombre: string
  selecciones?: {
    modificadorseleccion_id: number | string
    modificadorseleccion_nombre: string
    modificadorseleccion_precio: number | string
  }[]
}
