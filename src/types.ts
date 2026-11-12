export type Role = "delegado" | "secretario" | "admin";
export type Profile = {
  id: string;
  name: string;
  role: Role;
  building: string;
  start_time: string;
  end_time: string;
  phone: string;
  active: boolean;
};
export type Member = {
  id: string;
  first_name: string;
  last_name: string;
  file_number: string;
  building: string;
  area: string;
  position: string;
  management: string;
  start_time: string;
  end_time: string;
  phone: string;
};
export type UnionEvent = {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  category: string;
  urgent: boolean;
};
export type Response = {
  id: string;
  event_id: string;
  user_id: string;
  status: "yes" | "no";
  reason: string;
};
export type Vacation = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
};
export type Benefit = {
  id: string;
  category: string;
  title: string;
  description: string;
  detail: string;
  contact: string;
};
export type Notice = {
  id: string;
  user_id: string;
  event_id: string;
  title: string;
  read: boolean;
};
export type Settings = {
  id: string;
  name: string;
  subtitle: string;
  contact: string;
};
export type Data = {
  profiles: Profile[];
  members: Member[];
  events: UnionEvent[];
  responses: Response[];
  vacations: Vacation[];
  benefits: Benefit[];
  notifications: Notice[];
  settings: Settings[];
};
export type Table = keyof Data;
export type Row = Data[Table][number];
