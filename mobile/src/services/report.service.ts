import type {
  CallFrequencyReport,
  CallProductivityReport,
  CallReachReport,
  FrequencyItem,
  Period,
} from '../types/report';

const MOCK_DELAY_MIN = 400;
const MOCK_DELAY_MAX = 800;

function delay(): Promise<void> {
  const ms =
    MOCK_DELAY_MIN + Math.floor(Math.random() * (MOCK_DELAY_MAX - MOCK_DELAY_MIN));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MOCK_ITEMS: FrequencyItem[] = [
  { customer_id: 'd-001', customer_name: 'Dr. SUBHAN YUDI', segment: 'Dokter', class: 'BC', actual: 1, target: 1, point: 1 },
  { customer_id: 'd-002', customer_name: 'Dr. IMELDA NITA SAPUTRI', segment: 'Dokter', class: 'BC', actual: 1, target: 1, point: 1 },
  { customer_id: 'd-003', customer_name: 'Dr. KRISTINA DYAH PURWANTI', segment: 'Dokter', class: 'BC', actual: 1, target: 1, point: 1 },
  { customer_id: 'd-004', customer_name: 'Dr. ANDIKA PRATAMA', segment: 'Dokter', class: 'AA', actual: 4, target: 4, point: 1 },
  { customer_id: 'd-005', customer_name: 'Dr. RATIH KUSUMA', segment: 'Dokter', class: 'AB', actual: 3, target: 4, point: 0 },
  { customer_id: 'd-006', customer_name: 'Dr. BAYU SAPUTRA', segment: 'Dokter', class: 'BA', actual: 4, target: 4, point: 1 },
  { customer_id: 'd-007', customer_name: 'Dr. ELLA WIJAYA', segment: 'Dokter', class: 'BB', actual: 3, target: 3, point: 1 },
  { customer_id: 'n-001', customer_name: 'APT. SAFIRA THALIB TELUK', segment: 'Non-Dokter', class: 'CC', actual: 1, target: 1, point: 1 },
  { customer_id: 'n-002', customer_name: 'RSUD. ULIN BANJARMASIN', segment: 'Non-Dokter', class: 'CC', actual: 1, target: 1, point: 1 },
  { customer_id: 'n-003', customer_name: 'KLINIK YUNITA BANJARBARU', segment: 'Non-Dokter', class: 'CC', actual: 2, target: 1, point: 1 },
  { customer_id: 'n-004', customer_name: 'PUSKESMAS CEMPAKA BARU', segment: 'Non-Dokter', class: 'CC', actual: 0, target: 1, point: 0 },
  { customer_id: 'n-005', customer_name: 'PUSKESMAS PELAMBUAN', segment: 'Non-Dokter', class: 'CC', actual: 0, target: 1, point: 0 },
  { customer_id: 'n-006', customer_name: 'PUSKESMAS GADANG HANYAR', segment: 'Non-Dokter', class: 'CC', actual: 0, target: 1, point: 0 },
  { customer_id: 'n-007', customer_name: 'APT. AL-JIHAD 1 TELUK', segment: 'Non-Dokter', class: 'BC', actual: 1, target: 1, point: 1 },
  { customer_id: 'n-008', customer_name: 'APT. KIMIA FARMA VETERAN', segment: 'Non-Dokter', class: 'BB', actual: 1, target: 1, point: 1 },
];

export async function getCallReach(period: Period): Promise<CallReachReport> {
  await delay();
  const doctor = { target: 15, visited: 15, pct: 100 };
  const non_doctor = { target: 25, visited: 21, pct: 84 };
  const total_pct = Math.round((doctor.pct + non_doctor.pct) / 2);
  return {
    period,
    doctor,
    non_doctor,
    total_pct,
    threshold: 80,
  };
}

export async function getCallFrequency(
  period: Period,
): Promise<CallFrequencyReport> {
  await delay();
  const doctor_breakdown = { target_sum: 15, actual_sum: 15, pct: 100 };
  const non_doctor_breakdown = { target_sum: 25, actual_sum: 20, pct: 80 };
  const total_pct = Math.round(
    (doctor_breakdown.pct + non_doctor_breakdown.pct) / 2,
  );
  return {
    period,
    items: MOCK_ITEMS,
    doctor_breakdown,
    non_doctor_breakdown,
    total_pct,
    threshold: 60,
  };
}

export async function getCallProductivity(
  period: Period,
): Promise<CallProductivityReport> {
  await delay();
  const doctor = { target: 34, actual: 22, pct: 65 };
  const non_doctor = { target: 68, actual: 33, pct: 49 };
  const total_pct = Math.round(
    ((doctor.actual + non_doctor.actual) / (doctor.target + non_doctor.target)) *
      100,
  );
  return {
    period,
    doctor,
    non_doctor,
    non_target_visit_count: 4,
    total_pct,
    threshold: 80,
  };
}
