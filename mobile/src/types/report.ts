export type Period = { month: number; year: number };

export type DoctorClass =
  | 'AA'
  | 'AB'
  | 'AC'
  | 'BA'
  | 'BB'
  | 'BC'
  | 'CA'
  | 'CB'
  | 'CC';

export type ReachBreakdown = {
  target: number;
  visited: number;
  pct: number;
};

export type CallReachReport = {
  period: Period;
  doctor: ReachBreakdown;
  non_doctor: ReachBreakdown;
  total_pct: number;
  threshold: 80;
};

export type FrequencyItem = {
  customer_id: string;
  customer_name: string;
  segment: 'Dokter' | 'Non-Dokter';
  class: DoctorClass | null;
  actual: number;
  target: number;
  point: 0 | 1;
};

export type FrequencyBreakdown = {
  target_sum: number;
  actual_sum: number;
  pct: number;
};

export type CallFrequencyReport = {
  period: Period;
  items: FrequencyItem[];
  doctor_breakdown: FrequencyBreakdown;
  non_doctor_breakdown: FrequencyBreakdown;
  total_pct: number;
  threshold: 60;
};

export type ProductivityBreakdown = {
  target: number;
  actual: number;
  pct: number;
};

export type CallProductivityReport = {
  period: Period;
  doctor: ProductivityBreakdown;
  non_doctor: ProductivityBreakdown;
  non_target_visit_count: number;
  total_pct: number;
  threshold: 80;
};
