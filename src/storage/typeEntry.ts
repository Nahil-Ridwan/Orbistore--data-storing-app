export type Entry = {
  id: string;
  company?: string;
  device?: number;
  username?: string;
  mobile?: number;
  vehicle?: string;
  type?: string;
  lock?: string;
  devicemodel?: string;
  installdate: string;
  expdate?: string;
  validity?: number;
  status?: string;
  payment?: string;
  sim: number;
  imei: number;
  note?: string;
  renewal1?: string;
  renewal2?: string;
  renewal3?: string;
  renewal4?: string;
  renewal5?: string;
  createdAt: string;
  updatedAt?: string; // for cloud
};