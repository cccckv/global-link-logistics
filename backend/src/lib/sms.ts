export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendSMS(phone: string, code: string, type: string): Promise<boolean> {
  console.log(`[SMS ${type}] 发送验证码到 ${phone}: ${code}`);
  
  return true;
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}
