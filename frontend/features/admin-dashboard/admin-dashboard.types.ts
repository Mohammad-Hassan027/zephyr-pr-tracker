export type Member = { _id?: string; name: string; code: string };

export type EventItem = {
  _id?: string;
  name: string;
  slug: string;
  description?: string;
  venue?: string;
  fee?: number;
  date?: string;
  capacity?: number | null;
};

export type EventStat = {
  eventId: string;
  name: string;
  slug: string;
  capacity: number | null;
  count: number;
};

export type ClubInfo = { name: string; slug: string; email: string };
