/** EDINET 書類一覧APIレスポンス */
export type EdinetDocListResponse = {
  metadata: {
    title: string;
    parameter: {
      date: string;
      type: string;
    };
    resultset: {
      count: number;
    };
    processDateTime: string;
    status: string;
    message: string;
  };
  results: EdinetDocument[];
};

/** EDINET 書類メタデータ */
export type EdinetDocument = {
  seqNumber: number;
  docID: string;
  edinetCode: string | null;
  secCode: string | null;
  JCN: string | null;
  filerName: string | null;
  fundCode: string | null;
  ordinanceCode: string | null;
  formCode: string | null;
  docTypeCode: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  submitDateTime: string | null;
  docDescription: string | null;
  issuerEdinetCode: string | null;
  subjectEdinetCode: string | null;
  subsidiaryEdinetCode: string | null;
  currentReportReason: string | null;
  parentDocID: string | null;
  opeDateTime: string | null;
  withdrawalStatus: string | null;
  docInfoEditStatus: string | null;
  disclosureStatus: string | null;
  xbrlFlag: string | null;
  pdfFlag: string | null;
  attachDocFlag: string | null;
  englishDocFlag: string | null;
  csvFlag: string | null;
  legalStatus: string | null;
};

/** 有価証券報告書としてフィルタ済みの書類 */
export type AnnualReport = {
  docID: string;
  secCode: string;
  edinetCode: string | null;
  filerName: string;
  periodStart: string | null;
  periodEnd: string | null;
  submitDateTime: string | null;
  docDescription: string | null;
  xbrlFlag: boolean;
  csvFlag: boolean;
};
