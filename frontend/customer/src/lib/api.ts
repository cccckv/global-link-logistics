import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('jwt_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface User {
  id: string;
  phone: string;
  name: string;
  email?: string;
  userType: 'CUSTOMER' | 'EMPLOYEE';
  userRole: 'ADMIN' | 'USER';
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Shipment {
  shipmentId: string;
  trackingNumber: string;
  carrier: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  currentLocation?: string;
  currentLat?: number;
  currentLng?: number;
  events: TrackingEvent[];
}

export interface TrackingEvent {
  eventId: string;
  status: string;
  location: string;
  description?: string;
  timestamp: string;
  lat?: number;
  lng?: number;
}

export interface Payment {
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
}

export interface PaymentVoucher {
  id: string;
  orderId: string;
  fileUrl: string;
  fileName?: string;
  fileType?: string;
  voucherType?: string;
  uploadedAt: string;
}

export const authApi = {
  sendCode: (phone: string) =>
    api.post<{ message: string; expiresIn: number }>('/auth/send-code', { phone }),
  
  register: (data: { phone: string; code: string; password: string; name?: string }) =>
    api.post<{ token: string; user: User }>('/auth/register', data),
  
  login: (data: { phone: string; password: string }) =>
    api.post<{ token: string; user: User }>('/auth/login', data),
  
  forgotPasswordSendCode: (phone: string) =>
    api.post<{ message: string; expiresIn: number }>('/auth/forgot-password/send-code', { phone }),
  
  resetPassword: (data: { phone: string; code: string; newPassword: string }) =>
    api.post<{ message: string }>('/auth/forgot-password/reset', data),
  
  getMe: () => api.get<User>('/auth/me'),
};

export const trackingApi = {
  getTracking: (trackingNumber: string) =>
    api.get<{ shipment: Shipment }>(`/tracking/${trackingNumber}`),
  
  searchTracking: (params: { orderId?: string; receiverPhone?: string; trackingNumber?: string }) =>
    api.get<{ shipments: Shipment[] }>('/tracking/search', { params }),
};



export type QuickOrderType = 'SEA_LCL' | 'AIR' | 'LAND' | 'SEA_FCL' | 'PARCEL' | 'BATCH';
export type QuickOrderStatus = 'PENDING' | 'CONFIRMED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

export interface ContactAddress {
  id: string;
  name: string;
  company?: string;
  phone: string;
  region?: string;
  address: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuickOrderAddress {
  name: string;
  company?: string;
  phone: string;
  region?: string;
  address: string;
}

export interface QuickOrderDeclaration {
  trackingNumber?: string;
  productName: string;
  quantity: number;
  length?: number;
  width?: number;
  height?: number;
  weight: number;
  cnyUnitPrice?: number;
  phpUnitPrice?: number;
  channelUnitPricePhp?: number;
  channelUnitPriceCny?: number;
}

export interface QuickOrderContainer {
  containerType: 'GP_20' | 'GP_40' | 'HQ_40' | 'HQ_45';
  quantity: number;
  weight?: number;
  productsJson?: string;
}

export interface CreateQuickOrderInput {
  orderType: QuickOrderType;
  warehouse?: string;
  destination: string;
  note?: string;
  userMark?: string;
  mark?: string;
  attachmentUrl?: string;
  originPort?: string;
  destinationPort?: string;
  voyageNumber?: string;
  receivedAt?: string;
  recipientAddress: QuickOrderAddress;
  overseasAddress?: QuickOrderAddress;
  declarations?: QuickOrderDeclaration[];
  containers?: QuickOrderContainer[];
}

export interface QuickOrder {
  orderId: string;
  orderNumber: string;
  orderType: QuickOrderType;
  status: QuickOrderStatus;
  warehouse?: string;
  destination: string;
  note?: string;
  userMark?: string;
  mark?: string;
  attachmentUrl?: string;
  originPort?: string;
  destinationPort?: string;
  voyageNumber?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt?: string;
  recipientAddress: QuickOrderAddress & { id: string };
  overseasAddress?: QuickOrderAddress & { id: string };
  declarations?: Array<QuickOrderDeclaration & { id: string }>;
  containers?: Array<QuickOrderContainer & { id: string }>;
  shipment?: Shipment;
  payment?: Payment;
  paymentVouchers?: PaymentVoucher[];
}

export const quickOrderApi = {
  create: (data: CreateQuickOrderInput) =>
    api.post<QuickOrder>('/orders/quick', data),
  
  getList: (params?: {
    orderType?: QuickOrderType;
    status?: QuickOrderStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    searchType?: 'trackingNumber' | 'orderNumber' | 'productName' | 'warehouseNumber';
    keyword?: string;
    mark?: string;
  }) => api.get<{ data: QuickOrder[]; pagination: { total: number; page: number; limit: number; totalPages: number } }>('/orders/quick', { params }),
  
  getDetail: (orderId: string) =>
    api.get<QuickOrder>(`/orders/quick/${orderId}`),

  update: (orderId: string, data: { status?: QuickOrderStatus; note?: string; attachmentUrl?: string; voyageNumber?: string }) =>
    api.patch<QuickOrder>(`/orders/quick/${orderId}`, data),

  cancel: (orderId: string) =>
    api.delete<{ orderId: string; orderNumber: string; status: string; message: string }>(`/orders/quick/${orderId}`),

  updateDeclarations: (orderId: string, declarations: QuickOrderDeclaration[]) =>
    api.put(`/orders/quick/${orderId}/declarations`, { declarations }),

  addPaymentVoucher: (orderId: string, fileUrl: string, fileName?: string, fileType?: string, voucherType?: string) =>
    api.post<PaymentVoucher>(`/orders/quick/${orderId}/vouchers`, { fileUrl, fileName, fileType, voucherType }),

  getCounts: () =>
    api.get<{ all: number; pending: number; confirmed: number; inTransit: number; delivered: number; cancelled: number }>('/orders/quick/counts'),
};

export const contactApi = {
  getRecipientAddresses: () =>
    api.get<{ data: ContactAddress[] }>('/contacts/recipient'),

  getOverseasAddresses: () =>
    api.get<{ data: ContactAddress[] }>('/contacts/overseas'),

  getOverseasAddressesByUserId: (userId: string) =>
    api.get<{ data: ContactAddress[] }>('/contacts/overseas/by-user', { params: { forUserId: userId } }),
  
  setDefaultRecipient: (id: string) =>
    api.put<ContactAddress>(`/contacts/recipient/${id}/set-default`),

  setDefaultOverseas: (id: string) =>
    api.put<ContactAddress>(`/contacts/overseas/${id}/set-default`),
  
  deleteRecipient: (id: string) =>
    api.delete<{ message: string }>(`/contacts/recipient/${id}`),

  deleteOverseas: (id: string) =>
    api.delete<{ message: string }>(`/contacts/overseas/${id}`),
};

export interface UserListResponse {
  success: boolean;
  data: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateUserData {
  name: string;
  phone: string;
  password: string;
  userRole: 'ADMIN' | 'USER';
  email?: string;
}

export interface UpdateUserData {
  name?: string;
  phone?: string;
  password?: string;
  userRole?: 'ADMIN' | 'USER';
  email?: string;
}

export const userApi = {
  list: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<UserListResponse>('/users', { params }),
  
  create: (data: CreateUserData) =>
    api.post<{ success: boolean; data: User; message: string }>('/users', data),
  
  update: (id: string, data: UpdateUserData) =>
    api.put<{ success: boolean; data: User; message: string }>(`/users/${id}`, data),
  
  delete: (id: string) =>
    api.delete<{ success: boolean; message: string }>(`/users/${id}`),
};

export interface PaymentCollection {
  id: string;
  orderId: string;
  totalPieces: number;
  totalVolume: number | null;
  totalWeight: number | null;
  receivableAmount: number;
  payableAmount: number;
  receivableCurrency: string;
  payableCurrency: string;
  carPickupReceivable: number | null;
  carPickupActual: number | null;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    orderNumber: string;
    orderType: string;
    status: string;
    destination: string;
    warehouse?: string;
    userMark?: string;
    mark?: string;
    createdAt: string;
    user?: { id: string; name: string; phone: string };
  };
}

export interface PaymentCollectionListResponse {
  data: PaymentCollection[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UpsertPaymentCollectionData {
  totalPieces: number;
  totalVolume?: number;
  totalWeight?: number;
  receivableAmount: number;
  payableAmount: number;
  receivableCurrency?: string;
  payableCurrency?: string;
  carPickupReceivable?: number;
  carPickupActual?: number;
}

export const paymentCollectionApi = {
  getAll: (params?: { orderId?: string; page?: number; limit?: number }) =>
    api.get<PaymentCollectionListResponse>('/payment-collections', { params }),

  getByOrderId: (orderId: string) =>
    api.get<PaymentCollection>(`/payment-collections/order/${orderId}`),

  upsert: (orderId: string, data: UpsertPaymentCollectionData) =>
    api.put<PaymentCollection>(`/payment-collections/order/${orderId}`, data),

  addVoucher: (orderId: string, fileUrl: string, fileName?: string, fileType?: string) =>
    api.post(`/payment-collections/vouchers/${orderId}`, { fileUrl, fileName, fileType }),

  deleteVoucher: (voucherId: string) =>
    api.delete(`/payment-collections/vouchers/${voucherId}`),
};

export interface VesselSearchResult {
  matchType: number;
  mmsi: number;
  imo: number;
  callSign: string;
  shipName: string;
  dataSource: number;
  lastTime: string;
  lastTimeUtc: number;
}

export interface VesselPosition {
  mmsi: number;
  imo: number;
  callSign: string;
  shipName: string;
  shipCnName: string;
  shipType: number;
  length: number;
  width: number;
  draught: number;
  destination: string;
  destinationCode: string;
  eta: string;
  lat: number;
  lng: number;
  sog: number;
  cog: number;
  heading: number;
  rot: number;
  lastTime: string;
  lastTimeUtc: number;
}

export interface VesselSearchApiResponse {
  success: boolean;
  total: number;
  data: VesselSearchResult[];
  error?: string;
  message?: string;
}

export interface VesselPositionApiResponse {
  success: boolean;
  data?: VesselPosition;
  error?: string;
  message?: string;
}

export const vesselApi = {
  searchVessels: (keywords: string, max?: number) =>
    api.get<VesselSearchApiResponse>('/vessel/search', { params: { keywords, max } }),
  
  getPosition: (mmsi: string) =>
    api.get<VesselPositionApiResponse>('/vessel/position', { params: { mmsi } }),
};

export const uploadApi = {
  uploadReceipt: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ fileUrl: string; fileName: string; fileType: string }>(
      '/upload/receipt',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
  uploadPaymentVoucher: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ fileUrl: string; fileName: string; fileType: string }>(
      '/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
};
