export interface SeniorDebt {
  id: string;
  name: string;
  holderName: string;
  principal: number;
  accruedInterest: number;
  interestRate: number;
  finalPayment: number;
  prepaymentFeeRate: number;
  seniority: number;
}

export interface Safe {
  id: string;
  investorName: string;
  investmentAmount: number;
  valuationCap: number;
  discountRate: number;
}

export interface PreferredShare {
  id: string;
  className: string;
  pricePerShare: number;
  liquidationMultiple: number;
  participation: 'non-participating' | 'participating' | 'capped';
  participationCap: number;
  seniority: number;
  conversionRatio: number;
  holders: Holder[];
}

export interface CommonShare {
  id: string;
  className: string;
  holders: Holder[];
}

export interface Holder {
  name: string;
  shares: number;
}

export interface OptionGrant {
  id: string;
  holderName: string;
  shares: number;
  strikePrice: number;
  vested: number;
}

export interface WarrantGrant {
  id: string;
  holderName: string;
  shares: number;
  exercisePrice: number;
}

export interface CompanyData {
  seniorDebts: SeniorDebt[];
  safes: Safe[];
  preferredShares: PreferredShare[];
  commonShares: CommonShare[];
  options: OptionGrant[];
  warrants: WarrantGrant[];
}

export interface ValuationConfig {
  mode: 'single' | 'range';
  singleValuation: number;
  minValuation: number;
  maxValuation: number;
  steps: number;
  transactionCosts: number;
}

export interface StakeholderPayout {
  stakeholderName: string;
  instrumentType: string;
  instrumentName: string;
  amount: number;
}

export interface SeriesMetrics {
  investmentPPS: number;
  totalShares: number;
  seniority: number;
}

export interface WaterfallResult {
  valuations: number[];
  payoutsByValuation: Map<number, StakeholderPayout[]>;
  aggregated: AggregatedRow[];
  commonPPS: number[];
  conversionsByValuation: Map<number, Set<string>>;
  seriesMetricsByValuation: Map<number, Map<string, SeriesMetrics>>;
}

export interface AggregatedRow {
  stakeholderName: string;
  instrumentType: string;
  instrumentName: string;
  amounts: number[];
}

export type InputTab = 'upload' | 'debt' | 'safe' | 'preferred' | 'common' | 'options' | 'warrants';
