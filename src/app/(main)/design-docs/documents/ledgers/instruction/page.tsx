import { DocumentLedgerView } from "@/components/features/design-docs/document-ledger-view";

export default function InstructionLedgerPage() {
  return (
    <DocumentLedgerView
      title="업무지시"
      description="업무지시 문서를 조회합니다."
      fixedLedger="instruction"
    />
  );
}
