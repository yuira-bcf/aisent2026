import { StyleSheet } from "@react-pdf/renderer";

export const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansJP",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 4,
  },
  headerSub: {
    fontSize: 8,
    color: "#666",
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerNumber: {
    fontSize: 9,
    color: "#666",
  },
  headerDate: {
    fontSize: 9,
    color: "#666",
    marginTop: 2,
  },
  reissueLabel: {
    fontSize: 8,
    color: "#c00",
    marginTop: 4,
    fontWeight: "bold",
  },
  addressSection: {
    marginBottom: 20,
  },
  customerName: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  customerAddress: {
    fontSize: 9,
    color: "#444",
  },
  totalSection: {
    backgroundColor: "#f5f5f5",
    padding: 16,
    marginBottom: 20,
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 10,
    color: "#666",
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: "bold",
  },
  totalTax: {
    fontSize: 9,
    color: "#666",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    padding: 6,
    fontSize: 8,
    fontWeight: "bold",
    color: "#666",
  },
  tableRow: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#eee",
    fontSize: 9,
  },
  colName: { flex: 3 },
  colQty: { width: 40, textAlign: "center" as const },
  colPrice: { width: 70, textAlign: "right" as const },
  colTotal: { width: 80, textAlign: "right" as const },
  summarySection: {
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    fontSize: 9,
  },
  summaryLabel: {
    color: "#666",
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 1.5,
    borderTopColor: "#1a1a1a",
    fontSize: 12,
    fontWeight: "bold",
  },
  taxSection: {
    marginBottom: 20,
  },
  taxRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    fontSize: 9,
  },
  paymentSection: {
    marginBottom: 20,
  },
  paymentRow: {
    flexDirection: "row",
    paddingVertical: 3,
    fontSize: 9,
  },
  paymentLabel: {
    width: 100,
    color: "#666",
  },
  issuerSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  issuerName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 4,
  },
  issuerDetail: {
    fontSize: 8,
    color: "#666",
    marginBottom: 2,
  },
  registrationBox: {
    marginTop: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  registrationLabel: {
    fontSize: 8,
    color: "#666",
    marginBottom: 2,
  },
  registrationNumber: {
    fontSize: 10,
    fontWeight: "bold",
    fontFamily: "Courier",
  },
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "#ddd",
    alignItems: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#999",
    marginBottom: 2,
  },
});
