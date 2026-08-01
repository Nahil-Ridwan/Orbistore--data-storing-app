export type Company = {
  companyid: string;
  name: string;
  companyplace?: string;
  stock?: number;
  unpaid: number;
  companycreatedAt: string;
  companyupdatedAt?: string; // for cloud
}