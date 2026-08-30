export type Company = {
  companyid: string;
  name: string;
  companyplace?: string;
  stock?: number;
  unpaid: number;
  payment: 'RECEIVED' | 'NOT PAID';
  companycreatedAt: string;
  companyupdatedAt?: string; // for cloud
}