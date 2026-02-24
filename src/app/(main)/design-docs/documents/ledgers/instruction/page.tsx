import { DocumentLedgerView } from "@/components/features/design-docs/document-ledger-view";

export default function InstructionLedgerPage() {
  return (
    <DocumentLedgerView
      title="업무지시서 대장"
      description="업무지시 성격의 문서를 조회합니다."
      fixedLedger="instruction"
    />
  );
}
