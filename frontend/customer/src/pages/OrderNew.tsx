import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderApi } from '@/lib/api';
import {
  ChevronLeft,
  ChevronRight,
  User,
  MapPin,
  Package,
  Loader2,
} from 'lucide-react';

interface FormData {
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  receiverCountry: string;
  weight: number;
  shipmentType: 'SEA' | 'AIR' | 'EXPRESS';
}

const OrderNew: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    senderName: '',
    senderPhone: '',
    senderAddress: '',
    receiverName: '',
    receiverPhone: '',
    receiverAddress: '',
    receiverCountry: '',
    weight: 0,
    shipmentType: 'SEA',
  });

  const calculatePrice = (): number => {
    const baseRates: Record<string, number> = {
      SEA: 5,
      AIR: 15,
      EXPRESS: 25,
    };
    return formData.weight * baseRates[formData.shipmentType];
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'weight' ? parseFloat(value) || 0 : value,
    }));
  };

  const validateStep = (currentStep: number): boolean => {
    switch (currentStep) {
      case 1:
        return !!(
          formData.senderName &&
          formData.senderPhone &&
          formData.senderAddress
        );
      case 2:
        return !!(
          formData.receiverName &&
          formData.receiverPhone &&
          formData.receiverAddress &&
          formData.receiverCountry
        );
      case 3:
        return formData.weight > 0;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    setStep((prev) => prev - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    setLoading(true);
    try {
      const { data } = await orderApi.createOrder(formData);
      navigate(`/payment/${data.orderId}`);
    } catch (error) {
      console.error('创建订单失败:', error);
      alert('创建订单失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">创建新订单</h1>
          <p className="text-gray-600">填写发件人、收件人和货物信息</p>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((stepNum) => (
              <React.Fragment key={stepNum}>
                <div className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      step >= stepNum
                        ? 'bg-primary-blue text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {stepNum}
                  </div>
                  <span
                    className={`ml-3 text-sm font-medium ${
                      step >= stepNum ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {stepNum === 1 && '发件人信息'}
                    {stepNum === 2 && '收件人信息'}
                    {stepNum === 3 && '货物信息'}
                  </span>
                </div>
                {stepNum < 3 && (
                  <div
                    className={`flex-1 h-1 mx-4 ${
                      step > stepNum ? 'bg-primary-blue' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-5 h-5 text-gray-400" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    发件人信息
                  </h2>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="senderName"
                    value={formData.senderName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    电话 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="senderPhone"
                    value={formData.senderPhone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    地址 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="senderAddress"
                    value={formData.senderAddress}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                    required
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    收件人信息
                  </h2>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    姓名 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="receiverName"
                    value={formData.receiverName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    电话 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="receiverPhone"
                    value={formData.receiverPhone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    国家/地区 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="receiverCountry"
                    value={formData.receiverCountry}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    地址 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="receiverAddress"
                    value={formData.receiverAddress}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                    required
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-gray-400" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    货物信息
                  </h2>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    重量 (kg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight || ''}
                    onChange={handleInputChange}
                    min="0.1"
                    step="0.1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-blue focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    运输方式 <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { value: 'SEA', label: '海运', desc: '经济实惠，适合大批量', rate: 5 },
                      { value: 'AIR', label: '空运', desc: '快速稳定，3-7天', rate: 15 },
                      { value: 'EXPRESS', label: '快递', desc: '极速到达，1-3天', rate: 25 },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className={`relative flex flex-col p-4 border-2 rounded-lg cursor-pointer transition-all ${
                          formData.shipmentType === option.value
                            ? 'border-primary-blue bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="shipmentType"
                          value={option.value}
                          checked={formData.shipmentType === option.value}
                          onChange={handleInputChange}
                          className="sr-only"
                        />
                        <span className="font-semibold text-gray-900 mb-1">
                          {option.label}
                        </span>
                        <span className="text-sm text-gray-600 mb-2">
                          {option.desc}
                        </span>
                        <span className="text-xs text-gray-500">
                          ${option.rate}/kg
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">预估运费</p>
                      <p className="text-2xl font-bold text-gray-900">
                        USD {calculatePrice().toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right text-sm text-gray-600">
                      <p>{formData.weight} kg</p>
                      <p>
                        {formData.shipmentType === 'SEA' && '海运'}
                        {formData.shipmentType === 'AIR' && '空运'}
                        {formData.shipmentType === 'EXPRESS' && '快递'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={step === 1 ? () => navigate(-1) : handlePrevious}
              className="flex items-center gap-2 px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              {step === 1 ? '取消' : '上一步'}
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!validateStep(step)}
                className="flex items-center gap-2 px-6 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                下一步
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading || !validateStep(3)}
                className="flex items-center gap-2 px-6 py-2 bg-primary-blue text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>创建订单并支付</>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderNew;
