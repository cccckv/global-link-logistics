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
  postcode?: string;
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
  postcode?: string;
  address: string;
}

export interface QuickOrderDeclaration {
  trackingNumber?: string;
  productName: string;
  length?: number;
  width?: number;
  height?: number;
  outerQuantity?: number;
  innerQuantity?: number;
  weight: number;
  cnyUnitPrice?: number;
  phpUnitPrice?: number;
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
  trackingNumber?: string;
  courierCompany?: string;
  totalPackages?: number;
  note?: string;
  userMark?: string;
  mark?: string;
  attachmentUrl?: string;
  originPort?: string;
  destinationPort?: string;
  pickupAddress?: QuickOrderAddress;
  recipientAddress: QuickOrderAddress;
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
  trackingNumber?: string;
  courierCompany?: string;
  totalPackages?: number;
  note?: string;
  userMark?: string;
  mark?: string;
  attachmentUrl?: string;
  originPort?: string;
  destinationPort?: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt?: string;
  pickupAddress?: QuickOrderAddress & { id: string };
  recipientAddress: QuickOrderAddress & { id: string };
  declarations?: Array<QuickOrderDeclaration & { id: string }>;
  containers?: Array<QuickOrderContainer & { id: string }>;
  shipment?: Shipment;
  payment?: Payment;
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

  update: (orderId: string, data: { status?: QuickOrderStatus; note?: string; attachmentUrl?: string }) =>
    api.patch<QuickOrder>(`/orders/quick/${orderId}`, data),

  cancel: (orderId: string) =>
    api.delete<{ orderId: string; orderNumber: string; status: string; message: string }>(`/orders/quick/${orderId}`),
  
  getCounts: () =>
    api.get<{ all: number; pending: number; confirmed: number; inTransit: number; delivered: number; cancelled: number }>('/orders/quick/counts'),
};

export const contactApi = {
  getPickupAddresses: () =>
    api.get<{ data: ContactAddress[] }>('/contacts/pickup'),
  
  getRecipientAddresses: () =>
    api.get<{ data: ContactAddress[] }>('/contacts/recipient'),
  
  setDefaultPickup: (id: string) =>
    api.put<ContactAddress>(`/contacts/pickup/${id}/set-default`),
  
  setDefaultRecipient: (id: string) =>
    api.put<ContactAddress>(`/contacts/recipient/${id}/set-default`),
  
  deletePickup: (id: string) =>
    api.delete<{ message: string }>(`/contacts/pickup/${id}`),
  
  deleteRecipient: (id: string) =>
    api.delete<{ message: string }>(`/contacts/recipient/${id}`),
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
  declarationId: string;
  channelUnitPricePhp: number;
  receivableFreightAmount: number;
  receivableOtherAmount: number;
  actualReceivedAmount: number;
  channelFreightCost: number;
  channelOtherCost: number;
  profit: number;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    orderNumber: string;
    orderType: string;
    status: string;
    createdAt: string;
    warehouse?: string;
    destination: string;
    totalPackages?: number;
    userMark?: string;
    mark?: string;
    declarations?: Array<{
      id: string;
      productName: string;
      weight: number;
      trackingNumber?: string;
      length?: number;
      width?: number;
      height?: number;
    }>;
    containers?: Array<{
      id: string;
      containerType: string;
      quantity: number;
    }>;
  };
  declaration?: {
    id: string;
    productName: string;
    weight: number;
    trackingNumber?: string;
  };
  vouchers: Array<{
    id: string;
    fileUrl: string;
    fileName?: string;
    uploadedAt: string;
  }>;
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

export interface UpdatePaymentCollectionData {
  channelUnitPricePhp?: number;
  receivableFreightAmount?: number;
  receivableOtherAmount?: number;
  actualReceivedAmount?: number;
  channelFreightCost?: number;
  channelOtherCost?: number;
  profit?: number;
}

export const paymentCollectionApi = {
  getAll: (params?: { orderId?: string; declarationId?: string; page?: number; limit?: number }) =>
    api.get<PaymentCollectionListResponse>('/payment-collections', { params }),
  
  getOne: (id: string) =>
    api.get<PaymentCollection>(`/payment-collections/${id}`),
  
  update: (id: string, data: UpdatePaymentCollectionData) =>
    api.patch<PaymentCollection>(`/payment-collections/${id}`, data),
  
  batchUpdate: (orderId: string, updates: Array<{ declarationId: string } & UpdatePaymentCollectionData>) =>
    api.post(`/payment-collections/batch/${orderId}`, { updates }),
  
  addVoucher: (orderId: string, fileUrl: string, fileName?: string) =>
    api.post(`/payment-collections/vouchers/${orderId}`, { fileUrl, fileName }),
  
  deleteVoucher: (voucherId: string) =>
    api.delete(`/payment-collections/vouchers/${voucherId}`),
};


