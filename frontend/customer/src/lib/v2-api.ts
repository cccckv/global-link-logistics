import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const V2_BASE_URL = API_BASE_URL.endsWith('/api') ? `${API_BASE_URL}/v2` : (API_BASE_URL.endsWith('/api/') ? `${API_BASE_URL}v2` : `${API_BASE_URL}/api/v2`);

export const v2Api = axios.create({
  baseURL: V2_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

v2Api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

v2Api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
      if (!isAuthEndpoint) {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        const currentPath = window.location.pathname + window.location.search;
        if (window.location.pathname !== '/login') {
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

// Types
export type ShipmentType = 'SEA_LCL' | 'AIR' | 'SEA_FCL' | 'LAND';
export type WaybillStatus = 'DRAFT' | 'INBOUND' | 'LOADED' | 'IN_TRANSIT' | 'CUSTOMS' | 'DISPATCHING' | 'DELIVERED' | 'CANCELLED';
export type CurrencyType = 'CNY' | 'PHP' | 'USD';
export type FeeDirection = 'RECEIVABLE' | 'PAYABLE';
export type AttachmentType = 'PICKUP_SCREENSHOT' | 'CUSTOMS_SLIP' | 'SIGN_IMAGE' | 'BILL_OF_LADING' | 'CERT_OF_ORIGIN' | 'PAYMENT_PROOF' | 'OTHER';
export type ContainerStatus = 'LOADING' | 'SAILING' | 'ARRIVED' | 'CUSTOMS' | 'DISPATCHING' | 'COMPLETED';

export interface CustomerAddress {
  id: string;
  customerId: string;
  addressType: 'DOMESTIC_SENDER' | 'OVERSEAS_RECIPIENT';
  name: string;
  phone: string;
  company?: string;
  country?: string;
  region?: string;
  address: string;
  isDefault: boolean;
}

export interface Customer {
  id: string;
  clientCode: string;
  name: string;
  phone?: string;
  company?: string;
  destinationCountry?: string;
  destinationPort?: string;
  defaultWarehouse?: string;
  note?: string;
  addresses?: Array<Partial<CustomerAddress>>;
}

export interface WaybillItem {
  id?: string;
  itemIndex?: number;
  trackingNumber?: string;
  productName: string;
  quantity: number;
  
  // 阶段 1：预报快照 (可随时修改纠偏)
  estimatedQuantity?: number;
  estimatedLength?: number;
  estimatedWidth?: number;
  estimatedHeight?: number;
  estimatedWeight?: number;
  estimatedVolume?: number;

  // 阶段 2：仓库实测 (计费基准)
  length?: number;
  width?: number;
  height?: number;
  payableVolume?: number;
  receivableVolume?: number;
  unitWeight?: number;
  totalWeight?: number;
  receivableCurrency?: CurrencyType;
  receivableUnitPrice?: number;
  payableCurrency?: CurrencyType;
  payableUnitPrice?: number;
}

export interface WaybillFee {
  id?: string;
  feeName: string;
  feeDirection: FeeDirection;
  amount: number;
  currency: CurrencyType;
  exchangeRate?: number;
  amountInCny?: number;
  note?: string;
}

export interface WaybillAttachment {
  id: string;
  attachmentType: AttachmentType;
  fileUrl: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  uploadedAt: string;
}

export interface ContainerMaster {
  id: string;
  containerNo: string;
  containerType?: string;
  blNumber?: string;
  carrier?: string;
  vesselVoyage?: string;
  mmsi?: string;
  originPort?: string;
  destinationPort?: string;
  bookingChannel?: string;
  customsChannel?: string;
  clearanceChannel?: string;
  truckingChannel?: string;
  truckPlateNo?: string;
  driverName?: string;
  driverPhone?: string;
  truckingDate?: string;
  destArrivedDate?: string;
  loadingDate?: string;
  sailingDate?: string;
  eta?: string;
  clearanceDate?: string;
  totalShippingDays?: number;
  inspectStatus?: string;
  status: ContainerStatus;
  note?: string;
  createdAt: string;
  fees?: Array<{
    id: string;
    feeSubject: string;
    amount: number;
    currency: CurrencyType;
    amountInCny: number;
    note?: string;
  }>;
  waybills?: Array<{
    id: string;
    waybillNo: string;
    userMark: string;
    totalPieces: number;
    totalPayableCbm?: number;
    totalReceivableCbm?: number;
    receivableAmount?: number;
    status: WaybillStatus;
    items?: WaybillItem[];
    fees?: WaybillFee[];
  }>;
  _count?: { waybills: number };
}

export interface Waybill {
  id: string;
  waybillNo: string;
  orderType: ShipmentType;
  status: WaybillStatus;
  customerId?: string;
  userMark: string;
  originWarehouse?: string;
  destinationCountry: string;
  destinationPort?: string;
  expressNo?: string;
  customsType?: string;
  forwarderChannel?: string;
  voyageNumber?: string;
  airWaybillNo?: string;
  note?: string;
  isFixedPrice?: boolean;
  fixedPriceAmount?: number;
  baseReceivable?: number;
  basePayable?: number;

  recipientName?: string;
  recipientPhone?: string;
  recipientCompany?: string;
  recipientAddress?: string;
  recipientRegion?: string;

  overseasName?: string;
  overseasPhone?: string;
  overseasCompany?: string;
  overseasAddress?: string;
  overseasRegion?: string;

  inboundDate?: string;
  loadingDate?: string;
  sailingDate?: string;
  eta?: string;
  clearanceDate?: string;
  signedDate?: string;

  containerId?: string;
  containerMaster?: ContainerMaster;

  totalPieces: number;
  totalPayableCbm?: number;
  totalReceivableCbm?: number;
  totalWeightKg?: number;
  settlementCurrency?: CurrencyType;
  rawReceivableAmount?: number;
  usdRate?: number;
  phpRate?: number;
  receivableAmount?: number;
  payableAmount?: number;
  profitAmount?: number;

  createdAt: string;
  updatedAt: string;

  items: WaybillItem[];
  fees: WaybillFee[];
  attachments: WaybillAttachment[];
  customer?: Customer;
}

export const customerV2Api = {
  list: (params?: { search?: string; code?: string }) =>
    v2Api.get<{ success: boolean; data: Customer[] }>('/customers', { params }),
  
  getById: (id: string) =>
    v2Api.get<{ success: boolean; data: Customer }>(`/customers/${id}`),

  create: (data: Partial<Customer>) =>
    v2Api.post<{ success: boolean; data: Customer }>('/customers', data),

  update: (id: string, data: Partial<Customer>) =>
    v2Api.put<{ success: boolean; data: Customer }>(`/customers/${id}`, data),

  addAddress: (customerId: string, address: Partial<CustomerAddress>) =>
    v2Api.post<{ success: boolean; data: CustomerAddress }>(`/customers/${customerId}/addresses`, address),

  updateAddress: (customerId: string, addressId: string, address: Partial<CustomerAddress>) =>
    v2Api.put<{ success: boolean; data: CustomerAddress }>(`/customers/${customerId}/addresses/${addressId}`, address),

  deleteAddress: (customerId: string, addressId: string) =>
    v2Api.delete<{ success: boolean; message: string }>(`/customers/${customerId}/addresses/${addressId}`),

  setDefaultAddress: (customerId: string, addressId: string) =>
    v2Api.put<{ success: boolean; data: CustomerAddress }>(`/customers/${customerId}/addresses/${addressId}/default`),

  delete: (id: string) =>
    v2Api.delete<{ success: boolean; message: string }>(`/customers/${id}`),
};

export const waybillV2Api = {
  list: (params?: {
    orderType?: ShipmentType;
    status?: WaybillStatus;
    search?: string;
    containerId?: string;
    containerNo?: string;
    userMark?: string;
    originWarehouse?: string;
    destinationCountry?: string;
    destinationPort?: string;
    forwarderChannel?: string;
    customsType?: string;
    unassignedOnly?: boolean | string;
    overseasKeyword?: string;
    dateType?: 'createdAt' | 'inboundDate' | 'loadingDate' | 'sailingDate' | 'eta' | 'signedDate';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) =>
    v2Api.get<{
      success: boolean;
      data: Waybill[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
      counts: Record<string, number>;
    }>('/waybills', { params }),

  getById: (id: string) =>
    v2Api.get<{ success: boolean; data: Waybill }>(`/waybills/${id}`),

  create: (data: any) =>
    v2Api.post<{ success: boolean; data: Waybill }>('/waybills', data),

  update: (id: string, data: any) =>
    v2Api.post<{ success: boolean; data: Waybill }>(`/waybills/${id}/update`, data),

  batchAssignContainer: (data: { waybillIds: string[]; containerId: string; loadingDate?: string }) =>
    v2Api.post<{ success: boolean; updatedCount: number }>('/waybills/batch-assign-container', data),

  delete: (id: string) =>
    v2Api.delete<{ success: boolean; message: string }>(`/waybills/${id}`),
};

export const containerV2Api = {
  list: (params?: {
    status?: ContainerStatus;
    search?: string;
    originPort?: string;
    destinationPort?: string;
    page?: number;
    limit?: number;
  }) =>
    v2Api.get<{
      success: boolean;
      data: ContainerMaster[];
      pagination: { total: number; page: number; limit: number; totalPages: number };
      counts: Record<string, number>;
    }>('/containers', { params }),

  getById: (id: string) =>
    v2Api.get<{ success: boolean; data: ContainerMaster }>(`/containers/${id}`),

  create: (data: Partial<ContainerMaster>) =>
    v2Api.post<{ success: boolean; data: ContainerMaster }>('/containers', data),

  update: (id: string, data: Partial<ContainerMaster>) =>
    v2Api.post<{ success: boolean; data: ContainerMaster }>(`/containers/${id}/update`, data),

  addFee: (containerId: string, fee: any) =>
    v2Api.post<{ success: boolean; data: any }>(`/containers/${containerId}/fees`, fee),

  deleteFee: (feeId: string) =>
    v2Api.delete<{ success: boolean; message: string }>(`/containers/fees/${feeId}`),

  updateReturnStatus: (id: string, data: any) =>
    v2Api.patch<{ success: boolean; data: ContainerMaster }>(`/containers/${id}/return-status`, data),

  delete: (id: string) =>
    v2Api.delete<{ success: boolean; message: string }>(`/containers/${id}`),
};

export const financeV2Api = {
  addFee: (waybillId: string, fee: Partial<WaybillFee>) =>
    v2Api.post<{ success: boolean; data: WaybillFee }>(`/finance/waybills/${waybillId}/fees`, fee),

  deleteFee: (feeId: string) =>
    v2Api.delete<{ success: boolean; message: string }>(`/finance/fees/${feeId}`),

  addAttachment: (waybillId: string, att: Partial<WaybillAttachment>) =>
    v2Api.post<{ success: boolean; data: WaybillAttachment }>(`/finance/waybills/${waybillId}/attachments`, att),

  deleteAttachment: (attachmentId: string) =>
    v2Api.delete<{ success: boolean; message: string }>(`/finance/attachments/${attachmentId}`),

  getTodayExchangeRates: () =>
    v2Api.get<{
      success: boolean;
      data: {
        usdRate: number;
        phpRate: number;
        date: string;
        source: 'LIVE' | 'CACHE' | 'FALLBACK';
      };
    }>('/finance/exchange-rate/today'),
};

export type ChannelCategory =
  | 'SEA_LCL'
  | 'AIR'
  | 'FCL_BOOKING'
  | 'FCL_CUSTOMS'
  | 'FCL_CLEARANCE'
  | 'FCL_TRUCKING';

export interface ShippingChannel {
  id: string;
  category: ChannelCategory;
  name: string;
  code?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  note?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export const channelV2Api = {
  list: (params?: { category?: ChannelCategory; isActive?: boolean; search?: string }) =>
    v2Api.get<{ success: boolean; data: ShippingChannel[] }>('/channels', { params }),
  getById: (id: string) =>
    v2Api.get<{ success: boolean; data: ShippingChannel }>(`/channels/${id}`),
  create: (data: {
    category: ChannelCategory;
    name: string;
    code?: string;
    contactPerson?: string;
    contactPhone?: string;
    isDefault?: boolean;
    isActive?: boolean;
    sortOrder?: number;
    note?: string;
  }) =>
    v2Api.post<{ success: boolean; data: ShippingChannel }>('/channels', data),
  update: (
    id: string,
    data: Partial<{
      category: ChannelCategory;
      name: string;
      code?: string;
      contactPerson?: string;
      contactPhone?: string;
      isDefault?: boolean;
      isActive?: boolean;
      sortOrder?: number;
      note?: string;
    }>
  ) =>
    v2Api.put<{ success: boolean; data: ShippingChannel }>(`/channels/${id}`, data),
  toggleActive: (id: string) =>
    v2Api.post<{ success: boolean; data: ShippingChannel }>(`/channels/${id}/toggle`),
  delete: (id: string) =>
    v2Api.delete<{ success: boolean; message: string }>(`/channels/${id}`),
};


export const uploadV2Api = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return v2Api.post<{
      success: boolean;
      data: {
        fileUrl: string;
        fileName: string;
        fileType: string;
        size: number;
      };
    }>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export interface OriginWarehouse {
  id: string;
  code: string;
  name: string;
  shortName: string;
  contactName: string;
  contactPhone: string;
  province?: string | null;
  city?: string | null;
  address: string;
  receivingHours?: string | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  note?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export const originWarehouseV2Api = {
  list: (params?: { isActive?: boolean; search?: string }) =>
    v2Api.get<{ success: boolean; data: OriginWarehouse[] }>('/origin-warehouses', { params }),
  getById: (id: string) =>
    v2Api.get<{ success: boolean; data: OriginWarehouse }>(`/origin-warehouses/${id}`),
  create: (data: {
    code: string;
    name: string;
    shortName: string;
    contactName: string;
    contactPhone: string;
    province?: string;
    city?: string;
    address: string;
    receivingHours?: string;
    isDefault?: boolean;
    isActive?: boolean;
    sortOrder?: number;
    note?: string;
  }) =>
    v2Api.post<{ success: boolean; data: OriginWarehouse }>('/origin-warehouses', data),
  update: (
    id: string,
    data: Partial<{
      code: string;
      name: string;
      shortName: string;
      contactName: string;
      contactPhone: string;
      province?: string;
      city?: string;
      address: string;
      receivingHours?: string;
      isDefault?: boolean;
      isActive?: boolean;
      sortOrder?: number;
      note?: string;
    }>
  ) =>
    v2Api.put<{ success: boolean; data: OriginWarehouse }>(`/origin-warehouses/${id}`, data),
  setDefault: (id: string) =>
    v2Api.put<{ success: boolean; data: OriginWarehouse }>(`/origin-warehouses/${id}/set-default`),
  delete: (id: string) =>
    v2Api.delete<{ success: boolean; message: string }>(`/origin-warehouses/${id}`),
};


