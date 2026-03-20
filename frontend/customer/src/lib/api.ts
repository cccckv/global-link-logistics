import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
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
  userId: string;
  email: string;
  userType: 'CUSTOMER' | 'EMPLOYEE';
  fullName?: string;
  companyName?: string;
}

export interface Order {
  orderId: string;
  userId: string;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  receiverCountry: string;
  weight: number;
  shipmentType: 'SEA' | 'AIR' | 'EXPRESS';
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  shipment?: Shipment;
  payment?: Payment;
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
  register: (data: { email: string; password: string; fullName?: string; companyName?: string }) =>
    api.post<{ token: string; user: User }>('/api/auth/register', data),
  
  login: (data: { email: string; password: string }) =>
    api.post<{ token: string; user: User }>('/api/auth/login', data),
  
  getMe: () => api.get<User>('/api/auth/me'),
};

export const orderApi = {
  getOrders: () => api.get<Order[]>('/api/orders'),
  
  getOrder: (orderId: string) => api.get<Order>(`/api/orders/${orderId}`),
  
  createOrder: (data: {
    senderName: string;
    senderPhone: string;
    senderAddress: string;
    receiverName: string;
    receiverPhone: string;
    receiverAddress: string;
    receiverCountry: string;
    weight: number;
    shipmentType: 'SEA' | 'AIR' | 'EXPRESS';
  }) => api.post<Order>('/api/orders', data),
};

export const trackingApi = {
  getTracking: (trackingNumber: string) =>
    api.get<Shipment>(`/api/tracking/${trackingNumber}`),
};

export const paymentApi = {
  createPaymentIntent: (orderId: string) =>
    api.post<{ clientSecret: string }>('/api/payments/create-intent', { orderId }),
};
