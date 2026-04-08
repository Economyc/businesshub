// --- API Response wrapper ---
export interface PosApiResponse<T> {
  tipo: number
  data: T
  mensajes: string[]
}

// --- Dominio (locales, métodos de pago) ---
export interface PosLocal {
  local_id: number
  local_nombre: string
  local_direccion?: string
  almacenes?: PosAlmacen[]
}

export interface PosAlmacen {
  almacen_id: number
  almacen_nombre: string
}

export interface PosDominioData {
  locales: PosLocal[]
  tarjetas: PosTarjeta[]
  motorizados: unknown[]
  node?: unknown
}

export interface PosTarjeta {
  tarjeta_id: number
  tarjeta_nombre: string
}

// --- Ventas ---
export interface PosVenta {
  venta_id: number
  venta_serie: string
  venta_correlativo: string
  venta_fecha: string
  venta_subtotal: number
  venta_impuesto: number
  venta_total: number
  venta_tipopago: number // 1=efectivo, 2=tarjeta, 5=online, 7=deposito, 8=YAPE, 9=PLIN
  venta_tipocomprobante: number // 1=boleta, 2=factura
  venta_estado: number
  venta_descuento?: number
  cliente_nombres?: string
  cliente_apellidos?: string
  cliente_dniruc?: string
  detalle?: PosVentaItem[]
  [key: string]: unknown
}

export interface PosVentaItem {
  pedido_productoid: number
  pedido_descripcion: string
  pedido_cantidad: number
  pedido_precio: number
  pedido_descuento: number
  pedido_subtotal: number
  [key: string]: unknown
}

export interface PosVentasResponse {
  ventas: PosVenta[]
  total_registros?: number
  pagina_actual?: number
  total_paginas?: number
}

// --- Catálogo de productos ---
export interface PosProducto {
  producto_id: number
  producto_descripcion: string
  producto_precio: number
  producto_estado: number
  categoria_nombre?: string
  presentaciones?: PosPresentacion[]
  modificadores?: PosModificador[]
  [key: string]: unknown
}

export interface PosPresentacion {
  presentacion_id: number
  presentacion_descripcion: string
  presentacion_precio: number
}

export interface PosModificador {
  modificador_id: number
  modificador_nombre: string
  selecciones?: {
    modificadorseleccion_id: number
    modificadorseleccion_nombre: string
    modificadorseleccion_precio: number
  }[]
}

// --- Mapeo tipos de pago ---
export const TIPO_PAGO_MAP: Record<number, string> = {
  1: 'Efectivo',
  2: 'Tarjeta',
  5: 'Online',
  7: 'Depósito',
  8: 'YAPE',
  9: 'PLIN',
}

export const TIPO_COMPROBANTE_MAP: Record<number, string> = {
  1: 'Boleta',
  2: 'Factura',
}
