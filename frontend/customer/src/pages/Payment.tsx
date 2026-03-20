import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { paymentApi, orderApi, Order } from '@/lib/api';
import { CreditCard, Loader2, CheckCircle, XCircle } from 'lucide-react';

const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
);

const CheckoutForm: React.FC<{ order: Order; clientSecret: string }> = ({
  order,
  clientSecret,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setErrorMessage('');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order/${order.orderId}`,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message || '支付失败，请重试');
        setProcessing(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        navigate(`/order/${order.orderId}?payment=success`);
      }
    } catch (err) {
      setErrorMessage('支付过程中出现错误，请重试');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-700">订单金额</span>
          <span className="text-2xl font-bold text-gray-900">
            {order.currency} {order.totalAmount.toFixed(2)}
          </span>
        </div>
        <p className="text-sm text-gray-600">
          订单号: #{order.orderId.slice(0, 8)}
        </p>
      </div>

      <PaymentElement />

      {errorMessage && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{errorMessage}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-blue text-white rounded-md font-medium hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            处理中...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5" />
            支付 {order.currency} {order.totalAmount.toFixed(2)}
          </>
        )}
      </button>

      <p className="text-xs text-center text-gray-500">
        支付信息由 Stripe 安全加密处理
      </p>
    </form>
  );
};

const Payment: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [clientSecret, setClientSecret] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!orderId) {
      navigate('/orders');
      return;
    }

    const initPayment = async () => {
      try {
        const { data: orderData } = await orderApi.getOrder(orderId);
        setOrder(orderData);

        if (orderData.payment?.status === 'succeeded') {
          navigate(`/order/${orderId}?payment=success`);
          return;
        }

        const { data: paymentData } = await paymentApi.createPaymentIntent(orderId);
        setClientSecret(paymentData.clientSecret);
      } catch (err) {
        console.error('初始化支付失败:', err);
        setError('无法初始化支付，请重试');
      } finally {
        setLoading(false);
      }
    };

    initPayment();
  }, [orderId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-blue animate-spin mx-auto mb-4" />
          <p className="text-gray-600">正在初始化支付...</p>
        </div>
      </div>
    );
  }

  if (error || !order || !clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {error || '加载失败'}
          </h3>
          <button
            onClick={() => navigate('/orders')}
            className="mt-4 px-6 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            返回订单列表
          </button>
        </div>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#5167FC',
      },
    },
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">支付订单</h1>
          <p className="text-gray-600">请完成支付以开始处理您的订单</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <CreditCard className="w-6 h-6 text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900">支付信息</h2>
          </div>

          <Elements stripe={stripePromise} options={options}>
            <CheckoutForm order={order} clientSecret={clientSecret} />
          </Elements>
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">订单摘要</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">发件人</span>
              <span className="text-gray-900">{order.senderName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">收件人</span>
              <span className="text-gray-900">{order.receiverName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">目的地</span>
              <span className="text-gray-900">{order.receiverCountry}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">重量</span>
              <span className="text-gray-900">{order.weight} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">运输方式</span>
              <span className="text-gray-900">
                {order.shipmentType === 'SEA' && '海运'}
                {order.shipmentType === 'AIR' && '空运'}
                {order.shipmentType === 'EXPRESS' && '快递'}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between font-semibold">
              <span className="text-gray-900">总计</span>
              <span className="text-gray-900">
                {order.currency} {order.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
