/**
 * 输入传递状态类型定义
 */

export interface InputDeliveryState {
  toolId: string;
  status: 'pending' | 'sending' | 'success' | 'error';
  errorMessage?: string;
  timestamp: number;
}
