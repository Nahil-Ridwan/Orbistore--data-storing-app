export type Entry = {

  // Non - searchable
  id: string;
  validity?: number;
  deviceage?: number;
  devicemodel?: string;
  expdate?: string;
  renewal1?: string;
  renewal2?: string;
  renewal3?: string;
  renewal4?: string;
  renewal5?: string;
  createdAt: string;
  updatedAt?: string; // for cloud

  // Searchable
  company?: string; 
  place?: string;
  device?: number;
  username?: string;
  mobile?: number;
  vehicle?: string;
  type?: string;
  lock?: string;
  installdate: string;
  status?: string;
  payment?: string;
  sim: number;
  imei: number;
  shipnum?: string;
  note?: string;
  address?: string;
};