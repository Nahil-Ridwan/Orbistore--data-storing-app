export type Company = {
  companyid: string;
  name: string;
  companyplace?: string;
  contactperson?: string;
  contactnum?: number;
  stock?: number;
  unpaid: number;
  payment: 'RECEIVED' | 'NOT PAID';
  companycreatedAt: string;
  companyupdatedAt?: string; // for cloud
}