import { DocumentLedgerView } from "@/components/features/design-docs/document-ledger-view";

export default function InboundLedgerPage() {
  return (
    <DocumentLedgerView
      title="접수대장"
      description="외부 수신 문서를 조회합니다."
      fixedDirection="inbound"
    />
  );
}
