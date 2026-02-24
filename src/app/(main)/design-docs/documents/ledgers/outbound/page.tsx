import { DocumentLedgerView } from "@/components/features/design-docs/document-ledger-view";

export default function OutboundLedgerPage() {
  return (
    <DocumentLedgerView
      title="발송대장"
      description="외부 발송 문서를 조회합니다."
      fixedDirection="outbound"
    />
  );
}
